<?php
/**
 * kie.ai video adapter — submit / poll / download แยกตามตระกูล API ของ model
 * (อ่านจาก ai_models.features.video.api):
 *
 *   veo    POST /api/v1/veo/generate     GET /api/v1/veo/record-info  (successFlag 0/1/2/3)
 *   market POST /api/v1/jobs/createTask  GET /api/v1/jobs/recordInfo  (state waiting/…/success/fail)
 *
 * ฟังก์ชัน build/parse เป็น pure function (ไม่ยิง HTTP) เพื่อให้ทดสอบด้วย fixture ได้
 * — ดู api/tests/kie-video-adapter-test.php และ openspec/changes/kie-video-adapter/design.md
 */

const KIE_VIDEO_ASPECT_RATIOS = ['9:16', '16:9'];
const KIE_VIDEO_RESOLUTIONS   = ['720p', '1080p'];
// kie คิดราคา Veo ต่อคลิปเท่ากันทุกความยาว (ทดสอบแล้ว: 4 วิ = 30 credit เท่าคลิป 8 วิ)
// จึงใช้ 8 วิเป็นความยาวเป้าหมายของทุกตระกูล
const KIE_VIDEO_TARGET_CLIP_SEC = 8;

// ── ความยาววิดีโอ / จำนวนฉาก (video-creation-options) ─────────────────────────
// ตัวเลือกความยาวที่ผู้ใช้เลือกได้ — ทุกฉากยาว KIE_VIDEO_TARGET_CLIP_SEC (8 วิ) ไม่ขึ้นกับ model
// เพื่อให้สคริปต์ใช้ได้กับทุก model วิดีโอที่เปิดใช้ แม้แอดมินเปลี่ยน model ภายหลัง
const VIDEO_DURATIONS = [30, 45, 60, 90];

/** Normalize requested video duration to seconds (30/45/60/90, อื่นๆ → 60). */
function normalizeVideoDuration(mixed $raw): int {
    $duration = (int)$raw;
    return in_array($duration, VIDEO_DURATIONS, true) ? $duration : 60;
}

/** จำนวนฉาก = round(duration / 8) ปัดลงเมื่อห่างเท่ากัน → 30→4, 45→6, 60→7, 90→11 */
function videoSceneCount(int $duration): int {
    return max(1, (int)round($duration / KIE_VIDEO_TARGET_CLIP_SEC, 0, PHP_ROUND_HALF_DOWN));
}

function kieVideoNormalizeAspect(mixed $v): string {
    return in_array($v, KIE_VIDEO_ASPECT_RATIOS, true) ? $v : '9:16';
}

function kieVideoNormalizeResolution(mixed $v): string {
    return in_array($v, KIE_VIDEO_RESOLUTIONS, true) ? $v : '720p';
}

/** ความยาวคลิปที่จะขอ: 8 ถ้ารองรับ ไม่งั้นค่าที่ใกล้ 8 ที่สุดใน durations ของ model */
function kieVideoClipDuration(array $video): int {
    $d = $video['durations'] ?? null;
    $target = KIE_VIDEO_TARGET_CLIP_SEC;
    if (is_array($d) && isset($d['min'], $d['max'])) {
        return max((int)$d['min'], min((int)$d['max'], $target));
    }
    if (is_array($d) && $d !== []) {
        $best = (int)$d[0];
        foreach ($d as $v) {
            if (abs((int)$v - $target) < abs($best - $target)) $best = (int)$v;
        }
        return $best;
    }
    return $target;
}

/**
 * ประกอบ prompt ที่ส่งให้ Veo/Seedance: video_prompt ของฉาก + คำสั่งให้ผู้บรรยายพูดบทพากย์ภาษาไทย
 * ตรงตามที่บันทึกไว้ (ไม่แปล ไม่ตัดทอน) — ทดสอบแล้วว่า Veo 3.1 Lite พูดไทยได้ (video-creation-options 1.1)
 * narration ว่าง → คืน video_prompt เดิม
 */
function kieVideoComposePrompt(string $videoPrompt, string $narration): string {
    $videoPrompt = trim($videoPrompt);
    $narration   = trim($narration);
    if ($narration === '') return $videoPrompt;
    return rtrim($videoPrompt, " .") . '. A Thai narrator speaks in Thai, clearly and naturally: "' . $narration . '"';
}

/**
 * โหลด model วิดีโอ + credentials ของ provider
 * @throws RuntimeException ข้อความภาษาไทย เมื่อ model ใช้สร้างวิดีโอไม่ได้
 */
function kieVideoLoadModel(PDO $db, string $aiModelId): array {
    $stmt = $db->prepare('
        SELECT am.id, am.model_id, am.name, am.features, ap.api_base_url, ap.api_key_encrypted
        FROM ai_models am
        JOIN ai_providers ap ON ap.id = am.provider_id
        WHERE am.id = ?
    ');
    $stmt->execute([$aiModelId]);
    $row = $stmt->fetch();
    if (!$row) throw new RuntimeException('ไม่พบ model วิดีโอที่ตั้งค่าไว้ — กรุณาเลือก model วิดีโอในหน้าตั้งค่า AI');

    $features = json_decode((string)($row['features'] ?? ''), true);
    $video = is_array($features) ? ($features['video'] ?? null) : null;
    if (!is_array($video) || !in_array($video['api'] ?? null, ['veo', 'market'], true)) {
        throw new RuntimeException('Model "' . $row['name'] . '" ใช้สร้างวิดีโอไม่ได้ — กรุณาเลือก model วิดีโอ (Veo / Seedance) ในหน้าตั้งค่า AI');
    }
    if (($video['api'] === 'market') && empty($video['image_field'])) {
        throw new RuntimeException('Model "' . $row['name'] . '" ยังไม่ได้กำหนด image_field ใน features.video');
    }

    $apiKey = !empty($row['api_key_encrypted']) ? trim(decryptApiKey($row['api_key_encrypted'])) : '';
    if ($apiKey === '') throw new RuntimeException('ยังไม่ได้ตั้งค่า API Key ของ provider สำหรับ model "' . $row['name'] . '"');

    // api_base_url ของ kie ใน DB มี /api/v1 ต่อท้าย — ตัดออกแล้วต่อ path เต็มเสมอ กัน path ซ้อน
    $baseUrl = preg_replace('#/api/v1/?$#', '', rtrim((string)$row['api_base_url'], '/'));
    if ($baseUrl === '') throw new RuntimeException('ยังไม่ได้ตั้งค่า API Base URL ของ provider สำหรับ model "' . $row['name'] . '"');

    return [
        'id'       => $row['id'],
        'model_id' => $row['model_id'],
        'name'     => $row['name'],
        'video'    => $video,
        'base_url' => $baseUrl,
        'api_key'  => $apiKey,
    ];
}

/**
 * สร้าง request สำหรับ submit
 * $req = ['prompt' => string, 'aspect_ratio' => string, 'resolution' => string, 'image_url' => ?string (absolute)]
 * @return array{path: string, body: array}
 */
function kieVideoBuildSubmit(array $model, array $req): array {
    $video      = $model['video'];
    $aspect     = kieVideoNormalizeAspect($req['aspect_ratio'] ?? null);
    $resolution = kieVideoNormalizeResolution($req['resolution'] ?? null);
    $duration   = kieVideoClipDuration($video);
    $imageUrl   = $req['image_url'] ?? null;

    if ($video['api'] === 'veo') {
        $body = [
            'prompt'       => (string)$req['prompt'],
            'model'        => $model['model_id'],
            'aspect_ratio' => $aspect,
            'resolution'   => $resolution,
            'duration'     => $duration,
        ];
        if ($imageUrl) $body['imageUrls'] = [$imageUrl];
        else           $body['generationType'] = 'TEXT_2_VIDEO';
        return ['path' => '/api/v1/veo/generate', 'body' => $body];
    }

    $input = [
        'prompt'         => (string)$req['prompt'],
        'aspect_ratio'   => $aspect,
        'resolution'     => $resolution,
        'duration'       => $duration,
        // Seedance 1.5 Pro ปิดเสียงเป็นค่าเริ่มต้น — ส่ง true เสมอ ไม่พึ่งค่าเริ่มต้นของ kie
        'generate_audio' => true,
    ];
    if ($imageUrl) {
        $field = $video['image_field'];
        $input[$field] = $field === 'input_urls' ? [$imageUrl] : $imageUrl;
    }
    return ['path' => '/api/v1/jobs/createTask', 'body' => ['model' => $model['model_id'], 'input' => $input]];
}

/** @throws RuntimeException เมื่อ response ไม่มี taskId (ข้อความจาก msg ของ kie) */
function kieVideoParseSubmit(mixed $decoded, string $raw = ''): string {
    $taskId = is_array($decoded) ? ($decoded['data']['taskId'] ?? null) : null;
    if (!$taskId) {
        $msg = is_array($decoded) ? ($decoded['msg'] ?? '') : '';
        throw new RuntimeException('Video API ไม่คืน taskId กลับ: ' . ($msg !== '' ? $msg : substr($raw, 0, 300)));
    }
    return (string)$taskId;
}

function kieVideoPollPath(array $model, string $taskId): string {
    return ($model['video']['api'] === 'veo' ? '/api/v1/veo/record-info' : '/api/v1/jobs/recordInfo')
        . '?taskId=' . urlencode($taskId);
}

/**
 * แปลง response ของการ poll เป็นสถานะกลาง
 * @return array{status: 'generating'|'success'|'failed', url: ?string, error: ?string}
 */
function kieVideoParsePoll(string $api, mixed $decoded): array {
    $pending = ['status' => 'generating', 'url' => null, 'error' => null];
    if (!is_array($decoded)) return $pending;

    $code = (int)($decoded['code'] ?? 200);
    if ($code !== 200) {
        // 5xx = ปัญหาชั่วคราวฝั่ง kie → poll ใหม่รอบหน้า / 4xx = task นี้ใช้ไม่ได้ (เช่นไม่พบ task)
        if ($code >= 500) return $pending;
        return ['status' => 'failed', 'url' => null, 'error' => (string)($decoded['msg'] ?? ('HTTP ' . $code))];
    }
    $data = $decoded['data'] ?? null;
    if (!is_array($data)) return $pending;

    if ($api === 'veo') {
        $flag = (int)($data['successFlag'] ?? 0);
        if ($flag === 1) {
            // resultUrls = ความละเอียดที่ขอ (เช่น 1080p) / originUrls = 720p ก่อน upscale — ห้ามใช้ originUrls
            $url = $data['response']['resultUrls'][0] ?? null;
            return $url
                ? ['status' => 'success', 'url' => (string)$url, 'error' => null]
                : ['status' => 'failed', 'url' => null, 'error' => 'kie.ai รายงานว่าสำเร็จแต่ไม่มี resultUrls'];
        }
        if ($flag === 2 || $flag === 3) {
            return ['status' => 'failed', 'url' => null, 'error' => (string)($data['errorMessage'] ?: 'สร้างวิดีโอไม่สำเร็จ')];
        }
        return $pending;
    }

    $state = (string)($data['state'] ?? '');
    if ($state === 'success') {
        // resultJson เป็น JSON string ซ้อนอีกชั้น
        $result = json_decode((string)($data['resultJson'] ?? ''), true);
        $url = $result['resultUrls'][0] ?? null;
        return $url
            ? ['status' => 'success', 'url' => (string)$url, 'error' => null]
            : ['status' => 'failed', 'url' => null, 'error' => 'kie.ai รายงานว่าสำเร็จแต่ไม่มี resultUrls'];
    }
    if ($state === 'fail') {
        return ['status' => 'failed', 'url' => null, 'error' => (string)($data['failMsg'] ?: 'สร้างวิดีโอไม่สำเร็จ')];
    }
    return $pending;
}

/** @return array{0: int, 1: string|false} [http code, body] */
function kieVideoHttp(array $model, string $method, string $path, ?array $body = null, int $timeout = 60): array {
    $ch = curl_init($model['base_url'] . $path);
    $opts = [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER     => ['Authorization: Bearer ' . $model['api_key'], 'Content-Type: application/json'],
        CURLOPT_SSL_VERIFYPEER => !empty(AI_SSL_VERIFY),
        CURLOPT_TIMEOUT        => $timeout,
    ];
    if ($method === 'POST') {
        $opts[CURLOPT_POST] = true;
        $opts[CURLOPT_POSTFIELDS] = json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }
    curl_setopt_array($ch, $opts);
    $res = curl_exec($ch);
    $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return [$code, $res];
}

/** @throws RuntimeException */
function kieVideoSubmit(array $model, array $req): string {
    $r = kieVideoBuildSubmit($model, $req);
    [, $res] = kieVideoHttp($model, 'POST', $r['path'], $r['body']);
    if ($res === false) throw new RuntimeException('เรียก Video API ไม่สำเร็จ');
    return kieVideoParseSubmit(json_decode($res, true), (string)$res);
}

function kieVideoPoll(array $model, string $taskId): array {
    [, $res] = kieVideoHttp($model, 'GET', kieVideoPollPath($model, $taskId), null, 30);
    if ($res === false) return ['status' => 'generating', 'url' => null, 'error' => null];
    return kieVideoParsePoll($model['video']['api'], json_decode($res, true));
}

/**
 * ดาวน์โหลดวิดีโอผลลัพธ์มาเก็บที่ uploads/content/videos/{itemId}_{taskId}.mp4
 * @return ?string path ภายใน (/uploads/content/videos/...) หรือ null ถ้าไม่สำเร็จ (poll รอบหน้าจะลองใหม่)
 */
function kieVideoDownload(string $url, string $itemId, string $taskId, ?string $dir = null): ?string {
    $dir ??= __DIR__ . '/../../uploads/content/videos';
    if (!is_dir($dir) && !mkdir($dir, 0755, true) && !is_dir($dir)) {
        error_log('[kie-video] download: cannot create dir ' . $dir . ' | taskId=' . $taskId);
        return null;
    }
    $safe = preg_replace('/[^A-Za-z0-9_-]/', '', $itemId . '_' . $taskId);
    $final = $dir . '/' . $safe . '.mp4';
    $part  = $final . '.part';
    $publicPath = '/uploads/content/videos/' . $safe . '.mp4';

    // โหลดเสร็จไปแล้วในรอบก่อน (เช่น request ก่อนหน้าโหลดเสร็จแต่ยังไม่ได้อัปเดต DB)
    if (is_file($final) && filesize($final) > 0) return $publicPath;

    // frontend poll ทุก 5 วิ — ถ้ามี request อื่นกำลังโหลดไฟล์นี้อยู่ ห้ามเริ่มซ้ำ
    // (fopen 'wb' จะ truncate .part ที่อีก request กำลังเขียน) ให้ตอบ "ยังสร้างอยู่" ไปก่อน
    $lock = fopen($final . '.lock', 'c');
    if ($lock === false || !flock($lock, LOCK_EX | LOCK_NB)) {
        if ($lock) fclose($lock);
        return null;
    }
    try {
        // CDN ของ kie ความเร็วไม่แน่นอน (วัดได้ ~10–50KB/วิ ในบางช่วง) — ไม่ใช้ timeout รวมตายตัว
        // ยกเลิกเฉพาะเมื่อโหลดหยุดนิ่ง และไม่ให้ max_execution_time / client ปิดแท็บตัดกลางทาง
        set_time_limit(0);
        ignore_user_abort(true);

        $fh = fopen($part, 'wb');
        if ($fh === false) {
            error_log('[kie-video] download: cannot open ' . $part . ' | taskId=' . $taskId);
            return null;
        }
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_FILE             => $fh,
            CURLOPT_FOLLOWLOCATION   => true,
            CURLOPT_SSL_VERIFYPEER   => !empty(AI_SSL_VERIFY),
            CURLOPT_CONNECTTIMEOUT   => 20,
            CURLOPT_LOW_SPEED_LIMIT  => 1024, // bytes/sec
            CURLOPT_LOW_SPEED_TIME   => 60,   // ต่ำกว่า limit ติดต่อกัน 60 วิ = ถือว่าหยุดนิ่ง
        ]);
        $ok   = curl_exec($ch);
        $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err  = curl_error($ch);
        curl_close($ch);
        fclose($fh);

        $size = is_file($part) ? filesize($part) : 0;
        if (!$ok || $code < 200 || $code >= 300 || $size <= 0 || !rename($part, $final)) {
            @unlink($part);
            error_log('[kie-video] download failed | taskId=' . $taskId . ' | http=' . $code . ' | size=' . $size . ' | ' . $err);
            return null;
        }
        return $publicPath;
    } finally {
        flock($lock, LOCK_UN);
        fclose($lock);
        @unlink($final . '.lock');
    }
}
