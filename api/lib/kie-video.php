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
 * narration ว่าง → ขอแค่เสียงบรรยากาศ ห้ามมีเสียงพูด (กัน model แต่งบทพูดขึ้นเองในฉากโชว์ภาพ — multi-clip-video)
 */
function kieVideoComposePrompt(string $videoPrompt, string $narration): string {
    $videoPrompt = rtrim(trim($videoPrompt), " .");
    $narration   = trim($narration);
    if ($narration === '') {
        return $videoPrompt . '. Ambient sound and natural background audio only — no speech, no dialogue, no narration.';
    }
    return $videoPrompt . '. A Thai narrator speaks in Thai, clearly and naturally: "' . $narration . '"';
}

/**
 * error ระดับบัญชี/ระบบของ kie — ฉากที่เหลือในคำขอเดียวกันจะล้มแบบเดียวกันแน่นอน จึงต้องหยุดยิง
 * (401 key ไม่ถูกต้อง, 402 credit ไม่พอ, 429 ถูกจำกัดจำนวนคำขอ, 455 ปิดปรับปรุง, 505 ฟีเจอร์ถูกปิด —
 * docs.kie.ai, multi-clip-video งาน 1.3) — error อื่นเป็นระดับฉาก (RuntimeException ปกติ)
 */
class KieVideoAccountException extends RuntimeException {}

const KIE_VIDEO_ACCOUNT_ERROR_CODES = [401, 402, 429, 455, 505];

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

/**
 * @param int $httpCode HTTP status ของ response (0 = ไม่ทราบ)
 * @throws KieVideoAccountException เมื่อ code ใน body หรือ HTTP status เป็น error ระดับบัญชี
 * @throws RuntimeException เมื่อ response ไม่มี taskId (ข้อความจาก msg ของ kie)
 */
function kieVideoParseSubmit(mixed $decoded, string $raw = '', int $httpCode = 0): string {
    $taskId = is_array($decoded) ? ($decoded['data']['taskId'] ?? null) : null;
    if (!$taskId) {
        $msg = is_array($decoded) ? (string)($decoded['msg'] ?? '') : '';
        $message = 'Video API ไม่คืน taskId กลับ: ' . ($msg !== '' ? $msg : substr($raw, 0, 300));
        $bodyCode = is_array($decoded) ? (int)($decoded['code'] ?? 0) : 0;
        if (in_array($bodyCode, KIE_VIDEO_ACCOUNT_ERROR_CODES, true) || in_array($httpCode, KIE_VIDEO_ACCOUNT_ERROR_CODES, true)) {
            throw new KieVideoAccountException($message, $bodyCode ?: $httpCode);
        }
        throw new RuntimeException($message);
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
        // market ส่งยอด credit ที่ใช้จริงกลับมา (veo ไม่มี) → content_video_clips.credits_actual
        $credits = isset($data['creditsConsumed']) && is_numeric($data['creditsConsumed'])
            ? (int)round((float)$data['creditsConsumed']) : null;
        return $url
            ? ['status' => 'success', 'url' => (string)$url, 'error' => null, 'credits' => $credits]
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

/** @throws KieVideoAccountException|RuntimeException */
function kieVideoSubmit(array $model, array $req): string {
    $r = kieVideoBuildSubmit($model, $req);
    [$code, $res] = kieVideoHttp($model, 'POST', $r['path'], $r['body']);
    if ($res === false) throw new RuntimeException('เรียก Video API ไม่สำเร็จ');
    return kieVideoParseSubmit(json_decode($res, true), (string)$res, $code);
}

function kieVideoPoll(array $model, string $taskId): array {
    [, $res] = kieVideoHttp($model, 'GET', kieVideoPollPath($model, $taskId), null, 30);
    if ($res === false) return ['status' => 'generating', 'url' => null, 'error' => null];
    return kieVideoParsePoll($model['video']['api'], json_decode($res, true));
}

/**
 * ดาวน์โหลดวิดีโอผลลัพธ์มาเก็บที่ uploads/content/videos/{itemId}_{taskId}.mp4
 *
 * ดาวน์โหลดต่อจาก .part เดิมด้วย HTTP Range (CDN ของ kie รองรับ — multi-clip-video งาน 1.1):
 * 206 → ต่อท้าย, 200 (เซิร์ฟเวอร์ไม่สนใจ Range) → เริ่มใหม่, 416 → ตรวจว่าครบแล้วหรือไม่
 * .part ที่ยังไม่ครบถูกเก็บไว้ให้รอบถัดไปโหลดต่อ
 *
 * @param ?int $maxSeconds เวลารวมสูงสุดของรอบนี้ (null = ไม่จำกัด ตัดเฉพาะเมื่อโหลดหยุดนิ่ง) —
 *                         cron/poll ใช้จำกัดงบเวลาต่อรอบ ไม่ให้ถ่วงงานอื่น
 * @return ?string path ภายใน (/uploads/content/videos/...) หรือ null ถ้ายังไม่ครบ/ไม่สำเร็จ (รอบหน้าจะลองต่อ)
 */
function kieVideoDownload(string $url, string $itemId, string $taskId, ?string $dir = null, ?int $maxSeconds = null): ?string {
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

        clearstatcache(true, $part);
        $resumeFrom = is_file($part) ? (int)filesize($part) : 0;
        $fh = fopen($part, 'ab');
        if ($fh === false) {
            error_log('[kie-video] download: cannot open ' . $part . ' | taskId=' . $taskId);
            return null;
        }

        // อ่าน status/Content-Range ของ response สุดท้าย (หลัง redirect) ก่อนเขียน body
        $status = 0; $total = null; $started = false;
        $ch = curl_init($url);
        $opts = [
            CURLOPT_FOLLOWLOCATION  => true,
            CURLOPT_SSL_VERIFYPEER  => !empty(AI_SSL_VERIFY),
            CURLOPT_CONNECTTIMEOUT  => 20,
            CURLOPT_LOW_SPEED_LIMIT => 1024, // bytes/sec
            CURLOPT_LOW_SPEED_TIME  => 60,   // ต่ำกว่า limit ติดต่อกัน 60 วิ = ถือว่าหยุดนิ่ง
            CURLOPT_HEADERFUNCTION  => function ($c, string $line) use (&$status, &$total) {
                if (preg_match('#^HTTP/\S+\s+(\d{3})#', $line, $m)) { $status = (int)$m[1]; $total = null; }
                elseif (preg_match('#^content-range:\s*bytes\s+(?:\d+-\d+|\*)/(\d+)#i', $line, $m)) $total = (int)$m[1];
                elseif ($status === 200 && preg_match('#^content-length:\s*(\d+)#i', $line, $m)) $total = (int)$m[1];
                return strlen($line);
            },
            CURLOPT_WRITEFUNCTION   => function ($c, string $data) use ($fh, &$status, &$started, $resumeFrom) {
                if ($status !== 200 && $status !== 206) return strlen($data); // ไม่เขียน body ของ error/416 ลงไฟล์
                if (!$started) {
                    $started = true;
                    // เซิร์ฟเวอร์ไม่สนใจ Range → ได้ไฟล์ทั้งก้อน ต้องเริ่ม .part ใหม่
                    if ($status === 200 && $resumeFrom > 0) { ftruncate($fh, 0); rewind($fh); }
                }
                return fwrite($fh, $data);
            },
        ];
        if ($resumeFrom > 0) $opts[CURLOPT_RANGE] = $resumeFrom . '-';
        if ($maxSeconds !== null) $opts[CURLOPT_TIMEOUT] = max(1, $maxSeconds);
        curl_setopt_array($ch, $opts);
        $ok  = curl_exec($ch);
        $err = curl_error($ch);
        curl_close($ch);
        fclose($fh);

        clearstatcache(true, $part);
        $size = is_file($part) ? (int)filesize($part) : 0;
        // 416 = ขอเกินขนาดไฟล์ → .part ครบแล้วถ้าขนาดเท่ากับ total
        $complete = $ok && $size > 0 && (
            (($status === 200 || $status === 206) && ($total === null || $size >= $total))
            || ($status === 416 && $total !== null && $size === $total)
        );
        if (!$complete) {
            // .part ว่าง (เชื่อมต่อไม่ได้) หรือใช้ต่อไม่ได้ (416 ไม่ครบ / 4xx) → ลบ; มีข้อมูลบางส่วน → เก็บไว้โหลดต่อ
            if ($size === 0 || $status === 416 || ($status >= 400 && $status !== 429 && $status < 500)) @unlink($part);
            error_log('[kie-video] download incomplete | taskId=' . $taskId . ' | http=' . $status . ' | size=' . $size
                . ' | total=' . ($total ?? '?') . ' | resume_from=' . $resumeFrom . ' | ' . $err);
            return null;
        }
        if (!rename($part, $final)) {
            error_log('[kie-video] download: rename failed ' . $part . ' | taskId=' . $taskId);
            return null;
        }
        return $publicPath;
    } finally {
        flock($lock, LOCK_UN);
        fclose($lock);
        @unlink($final . '.lock');
    }
}
