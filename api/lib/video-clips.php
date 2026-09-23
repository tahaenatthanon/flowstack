<?php
/**
 * คลิปวิดีโอรายฉาก (multi-clip-video) — identity ของฉาก, snapshot/ล้าสมัย, เลือก model, credit,
 * ความพร้อม, การจองแบบ atomic, การยิงหลายฉาก และการ poll ทีละคลิป
 *
 * ตาราง content_video_clips เป็น append-only: 1 แถว = 1 generation
 *   คลิปที่ใช้งานของฉาก = แถวล่าสุดที่ status='done' ของ scene_id นั้น
 *   ล้าสมัย = input_snapshot ต่างจากค่าปัจจุบัน (คำนวณทุกครั้งที่อ่าน ไม่เก็บ flag)
 * ไม่มีฟังก์ชันใดในไฟล์นี้เขียน article_content นอกจาก _visualsToScenes (คืนค่า ไม่เขียน DB)
 *
 * ดู openspec/changes/multi-clip-video/design.md
 */

require_once __DIR__ . '/kie-video.php';
require_once __DIR__ . '/video-combine.php';

// kie.ai: $5 = 1,000 credit → 1 credit = $0.005 (ยืนยันกับ API ราคา: Veo Lite 720p $0.15 = 30 credit)
const KIE_CREDIT_USD = 0.005;
// การจองฉากที่ยังไม่ได้ job_id / การจองรวมคลิป ค้างเกินนี้ถือว่าโปรเซสดับไปแล้ว
const VIDEO_RESERVE_TTL_MINUTES = 10;
// kie ยังไม่เสร็จเกินนี้ถือว่าหมดเวลา (ปกติ Veo 1–3 นาที)
const VIDEO_JOB_TIMEOUT_MINUTES = 120;
const VIDEO_NARRATION_MAX_CHARS = 100;

// ── identity ของฉาก ──────────────────────────────────────────────────────────

function videoNewSceneId(array $taken = []): string {
    do { $id = 'sc_' . bin2hex(random_bytes(6)); } while (in_array($id, $taken, true));
    return $id;
}

/** ใส่ id ให้ฉากที่ยังไม่มี และแก้ id ที่ซ้ำกันภายใน array (ฉากหลังได้ id ใหม่) — ฉากที่มี id อยู่แล้วคงเดิม */
function videoAssignSceneIds(array $scenes): array {
    $taken = [];
    foreach ($scenes as $i => $scene) {
        if (!is_array($scene)) continue;
        $id = is_string($scene['id'] ?? null) ? trim($scene['id']) : '';
        if ($id === '' || in_array($id, $taken, true)) $id = videoNewSceneId($taken);
        $scenes[$i]['id'] = $id;
        $taken[] = $id;
    }
    return $scenes;
}

// ── visuals[] → scenes[] (ใช้ร่วมกันโดย generate-scene-images / generate-scene-image /
// generate-scene-video-prompt) — รองรับทั้ง string เดิม และ object {visual, motion, narration, duration_sec, id}
function _visualsToScenes(array $visuals): array {
    $scenes = array_values(array_map(function($v) {
        $isObj  = is_array($v) && (isset($v['visual']) || isset($v['motion']));
        $text   = $isObj ? ($v['visual'] ?? '') : (is_string($v) ? $v : ($v['visual_prompt'] ?? $v['content'] ?? ''));
        $motion = $isObj ? ($v['motion'] ?? '') : '';
        $shot   = '';
        $prompt = $text;
        if (preg_match('/^(?:Scene|Shot)\s*\d*\s*[:：-]\s*(.+)/i', $text, $m)) {
            $shot   = trim(substr($text, 0, strpos($text, $m[1]) - 1));
            $prompt = trim($m[1]);
        }
        return [
            // id ถาวรของฉาก (คลิปอ้างอิงด้วย id นี้) — visual ที่มี id อยู่แล้วใช้ต่อ, ที่เหลือแจกใน videoAssignSceneIds
            'id'                => is_array($v) && is_string($v['id'] ?? null) ? $v['id'] : '',
            'visual_prompt'     => $prompt,
            'video_prompt'      => $motion,
            'narration'         => $isObj ? trim((string)($v['narration'] ?? '')) : '',
            'duration_sec'      => $isObj && (int)($v['duration_sec'] ?? 0) > 0 ? (int)$v['duration_sec'] : KIE_VIDEO_TARGET_CLIP_SEC,
            'shot'              => $shot,
            'image_gen_status'  => 'none',
        ];
    }, $visuals));
    return videoAssignSceneIds(array_values(array_filter($scenes, fn($s) => !empty($s['visual_prompt']))));
}

/** Active Scenes = article_content.scenes[] ปัจจุบัน (ยังไม่สร้างภาพ = ยังไม่มี scenes → ว่าง) */
function videoItemScenes(array $item): array {
    $ac = json_decode((string)($item['article_content'] ?? ''), true);
    $scenes = is_array($ac) ? ($ac['scenes'] ?? []) : [];
    return is_array($scenes) ? array_values(array_filter($scenes, 'is_array')) : [];
}

// ── model / credit ────────────────────────────────────────────────────────────

/**
 * model ของวิดีโอ: content_items.video_model_id ถ้ายัง active และใช้ได้ → ไม่งั้น default ของระบบ
 * ($persist = true → บันทึก default ลง item) — ไม่ได้ทั้งคู่ → RuntimeException ภาษาไทย
 */
function videoResolveModel(PDO $db, array $item, string $tenantId, bool $persist): array {
    $own = (string)($item['video_model_id'] ?? '');
    if ($own !== '' && videoModelIsActive($db, $own)) {
        try { return videoLoadModelCached($db, $own); } catch (RuntimeException $e) { /* ใช้ default แทน */ }
    }
    $stmt = $db->prepare('SELECT ai_content_video_model_id FROM company_settings WHERE tenant_id = ?');
    $stmt->execute([$tenantId]);
    $default = (string)($stmt->fetchColumn() ?: '');
    if ($default === '' || !videoModelIsActive($db, $default)) {
        throw new RuntimeException('ยังไม่ได้เลือก model สำหรับสร้างวิดีโอ หรือ model ที่เลือกถูกปิดอยู่ — กรุณาตั้งค่าในหน้าตั้งค่า AI');
    }
    $model = videoLoadModelCached($db, $default);
    if ($persist && $own !== $model['id']) {
        $db->prepare('UPDATE content_items SET video_model_id = ?, updated_at = NOW() WHERE id = ? AND tenant_id = ?')
           ->execute([$model['id'], $item['id'], $tenantId]);
    }
    return $model;
}

function videoModelIsActive(PDO $db, string $aiModelId): bool {
    $stmt = $db->prepare("SELECT status FROM ai_models WHERE id = ?");
    $stmt->execute([$aiModelId]);
    return $stmt->fetchColumn() === 'active';
}

/** kieVideoLoadModel ต่อ request ครั้งเดียวต่อ model (หน้ารายการคำนวณหลาย item — ไม่ถอดรหัส key ซ้ำ) */
function videoLoadModelCached(PDO $db, string $aiModelId): array {
    static $cache = [];
    return $cache[$aiModelId] ??= kieVideoLoadModel($db, $aiModelId);
}

/** credit ต่อคลิปจาก features.video.price_usd — ไม่มีราคา → null */
function videoClipCredits(array $model, string $resolution): ?int {
    $video = $model['video'] ?? [];
    $usd = $video['price_usd'][$resolution] ?? null;
    if (!is_numeric($usd)) return null;
    $units = ($video['price_unit'] ?? 'per_clip') === 'per_second' ? kieVideoClipDuration($video) : 1;
    return (int)round((float)$usd * $units / KIE_CREDIT_USD);
}

// ── URL สาธารณะ ──────────────────────────────────────────────────────────────

function videoAppUrl(): string {
    return rtrim((string)(getenv('VITE_APP_URL') ?: ($_ENV['VITE_APP_URL'] ?? 'http://localhost:8080')), '/');
}

function videoAbsoluteUrl(string $path): string {
    if (parse_url($path, PHP_URL_SCHEME)) return $path;
    return videoAppUrl() . (str_starts_with($path, '/') ? $path : '/' . $path);
}

/** kie.ai ต้องดึงภาพฉากจาก URL ของระบบ — localhost / IP ภายใน ดึงไม่ได้ */
function videoPublicUrlOk(?string $appUrl = null): bool {
    $host = strtolower((string)parse_url($appUrl ?? videoAppUrl(), PHP_URL_HOST));
    $host = trim($host, '[]');
    if ($host === '' || $host === 'localhost' || str_ends_with($host, '.localhost') || $host === '::1') return false;
    if (filter_var($host, FILTER_VALIDATE_IP)) {
        return (bool)filter_var($host, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE);
    }
    return str_contains($host, '.');
}

// ── snapshot / ล้าสมัย ──────────────────────────────────────────────────────

/** ข้อมูลปัจจุบันของฉากในรูปเดียวกับ input_snapshot */
function videoClipSnapshot(array $item, array $scene, ?string $modelId, ?array $modelVideo = null): array {
    return [
        'image_url'    => trim((string)($scene['image_url'] ?? '')),
        'video_prompt' => trim((string)($scene['video_prompt'] ?? '')),
        'narration'    => trim((string)($scene['narration'] ?? '')),
        'model_id'     => $modelId,
        'duration_sec' => $modelVideo ? kieVideoClipDuration($modelVideo) : (int)($scene['duration_sec'] ?? KIE_VIDEO_TARGET_CLIP_SEC),
        'aspect_ratio' => kieVideoNormalizeAspect($item['video_aspect_ratio'] ?? null),
        'resolution'   => kieVideoNormalizeResolution($item['video_resolution'] ?? null),
    ];
}

const VIDEO_SNAPSHOT_REASONS = [
    'image_url'    => 'ภาพฉากเปลี่ยน',
    'video_prompt' => 'Video Prompt เปลี่ยน',
    'narration'    => 'บทพากย์เปลี่ยน',
    'model_id'     => 'model เปลี่ยน',
    'duration_sec' => 'ความยาวเปลี่ยน',
    'aspect_ratio' => 'อัตราส่วนเปลี่ยน',
    'resolution'   => 'ความละเอียดเปลี่ยน',
];

/** เหตุผลที่คลิปล้าสมัย (ลำดับคงที่) — ว่าง = ไม่ล้าสมัย; key อื่น เช่น migrated ไม่นำมาเทียบ */
function videoClipStaleReasons(array $snapshot, array $current): array {
    $reasons = [];
    foreach (VIDEO_SNAPSHOT_REASONS as $key => $label) {
        $a = $snapshot[$key] ?? null;
        $b = $current[$key] ?? null;
        if (is_string($a)) $a = trim($a);
        if (is_string($b)) $b = trim($b);
        if ($key === 'duration_sec') { $a = (int)$a; $b = (int)$b; }
        if ($a !== $b) $reasons[] = $label;
    }
    return $reasons;
}

function videoSnapshotsEqual(array $a, array $b): bool {
    return videoClipStaleReasons($a, $b) === [];
}

// ── ความพร้อมของฉาก ──────────────────────────────────────────────────────────

// Backward-compatible derive rule for scenes generated before image_gen_status
// existed — do NOT rewrite the DB, just infer at read time (SceneCards.tsx ใช้กฎเดียวกัน)
function _deriveSceneImageStatus(array $scene): string {
    if (array_key_exists('image_gen_status', $scene) && $scene['image_gen_status']) {
        return $scene['image_gen_status'];
    }
    return !empty($scene['image_url']) ? 'done' : 'none';
}

/** เหตุผลที่ฉากยังสร้างคลิปไม่ได้ (ว่าง = พร้อม) */
function videoSceneReadiness(array $scene, int $index): array {
    $n = $index + 1;
    $reasons = [];
    if (trim((string)($scene['id'] ?? '')) === '') $reasons[] = "ฉาก {$n} ยังไม่มีรหัสฉาก (ต้องรันสคริปต์ย้ายข้อมูล)";
    if (_deriveSceneImageStatus($scene) !== 'done' || empty($scene['image_url'])) $reasons[] = "ฉาก {$n} ยังไม่มีภาพ";
    if (trim((string)($scene['video_prompt'] ?? '')) === '') $reasons[] = "ฉาก {$n} ยังไม่มี Video Prompt";
    return $reasons;
}

// ── อ่านคลิป ─────────────────────────────────────────────────────────────────

/** คลิปทุก generation ของ item ที่ขอ → [item_id => [scene_id => [clip…เก่า→ใหม่]]] */
function videoLoadClips(PDO $db, string $tenantId, array $itemIds): array {
    if ($itemIds === []) return [];
    $in = implode(',', array_fill(0, count($itemIds), '?'));
    $stmt = $db->prepare("SELECT * FROM content_video_clips WHERE tenant_id = ? AND item_id IN ($in) ORDER BY created_at ASC, id ASC");
    $stmt->execute(array_merge([$tenantId], array_values($itemIds)));
    $out = [];
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $row['input_snapshot'] = json_decode((string)$row['input_snapshot'], true) ?: [];
        $out[$row['item_id']][$row['scene_id']][] = $row;
    }
    return $out;
}

/**
 * สรุปคลิปของฉากเดียว
 * @param array $clips generation ของฉากนี้ เรียงเก่า→ใหม่
 * @param array $current snapshot ของค่าปัจจุบัน
 */
function videoSceneClipInfo(array $clips, array $current): array {
    $active = null; $latest = null;
    foreach ($clips as $c) {
        $latest = $c;
        if ($c['status'] === 'done') $active = $c;
    }
    $generating = false;
    foreach ($clips as $c) if ($c['status'] === 'generating') $generating = true;

    $staleReasons = $active ? videoClipStaleReasons($active['input_snapshot'], $current) : [];

    // ล้มซ้ำ 2 ครั้งติดกันด้วยข้อมูลเดียวกับปัจจุบัน → แนะนำให้แก้ข้อมูลก่อน (ไม่บล็อก)
    $retryHint = null;
    $n = count($clips);
    if ($n >= 2) {
        [$a, $b] = [$clips[$n - 2], $clips[$n - 1]];
        if ($a['status'] === 'failed' && $b['status'] === 'failed'
            && videoSnapshotsEqual($a['input_snapshot'], $b['input_snapshot'])
            && videoSnapshotsEqual($b['input_snapshot'], $current)) {
            $retryHint = 'ล้มเหลว 2 ครั้งด้วยข้อมูลเดิม — แนะนำให้แก้ Video Prompt หรือบทพากย์ก่อนลองใหม่';
        }
    }

    $needs = !$generating && ($active === null || $staleReasons !== [] || ($latest && $latest['status'] === 'failed'));
    return [
        'active'        => $active,
        'latest'        => $latest,
        'generating'    => $generating,
        'stale_reasons' => $staleReasons,
        'retry_hint'    => $retryHint,
        'needs'         => $needs,
    ];
}

function videoClipPublic(?array $c): ?array {
    if (!$c) return null;
    return [
        'id'                => $c['id'],
        'status'            => $c['status'],
        'clip_url'          => $c['clip_url'],
        'error'             => $c['error'],
        'credits_estimated' => $c['credits_estimated'] !== null ? (int)$c['credits_estimated'] : null,
        'credits_actual'    => $c['credits_actual'] !== null ? (int)$c['credits_actual'] : null,
        'migrated'          => !empty($c['input_snapshot']['migrated']),
        'created_at'        => $c['created_at'],
        'completed_at'      => $c['completed_at'],
    ];
}

// ── สถานะรวมของ item (action video-state) ───────────────────────────────────

/**
 * @param ?array $clipsByScene คลิปของ item นี้ (จาก videoLoadClips) — null = โหลดเอง
 * @param ?array $combines แถว content_video_combines ของ item (เก่า→ใหม่) — null = โหลดเอง
 * @param bool $checkFfmpeg false = ไม่ตรวจ ffmpeg (หน้ารายการ ไม่ต้องใช้)
 */
function videoItemState(PDO $db, array $item, string $tenantId, ?array $clipsByScene = null, ?array $combines = null, bool $checkFfmpeg = true): array {
    $scenes = videoItemScenes($item);
    $clipsByScene ??= videoLoadClips($db, $tenantId, [$item['id']])[$item['id']] ?? [];

    $model = null; $modelError = null;
    try { $model = videoResolveModel($db, $item, $tenantId, false); }
    catch (RuntimeException $e) { $modelError = $e->getMessage(); }
    $resolution = kieVideoNormalizeResolution($item['video_resolution'] ?? null);

    $publicUrlOk = videoPublicUrlOk();
    $sceneStates = []; $readyClips = 0; $toGenerate = []; $notReady = [];
    foreach ($scenes as $i => $scene) {
        $sceneId = (string)($scene['id'] ?? '');
        $clips = $sceneId !== '' ? ($clipsByScene[$sceneId] ?? []) : [];
        // model ปัจจุบันใช้ไม่ได้ → เทียบกับ model ของ snapshot เอง (ไม่ขึ้น "model เปลี่ยน" ผิดๆ)
        $lastSnapModel = $clips ? ($clips[count($clips) - 1]['input_snapshot']['model_id'] ?? null) : null;
        $current = videoClipSnapshot($item, $scene, $model['id'] ?? $lastSnapModel, $model['video'] ?? null);
        $info = videoSceneClipInfo($clips, $current);
        $readiness = videoSceneReadiness($scene, $i);
        $narrationLen = mb_strlen(trim((string)($scene['narration'] ?? '')));

        if ($info['active'] && $info['stale_reasons'] === []) $readyClips++;
        if ($readiness !== []) array_push($notReady, ...$readiness);
        elseif ($info['needs']) $toGenerate[] = $sceneId;

        $sceneStates[] = [
            'scene_id'           => $sceneId,
            'index'              => $i,
            'ready'              => $readiness === [],
            'not_ready_reasons'  => $readiness,
            'narration_length'   => $narrationLen,
            'narration_too_long' => $narrationLen > VIDEO_NARRATION_MAX_CHARS,
            'active_clip'        => videoClipPublic($info['active']),
            'latest'             => videoClipPublic($info['latest']),
            'generating'         => $info['generating'],
            'stale'              => $info['active'] !== null && $info['stale_reasons'] !== [],
            'stale_reasons'      => $info['stale_reasons'],
            'needs_generation'   => $readiness === [] && $info['needs'],
            'retry_hint'         => $info['retry_hint'],
        ];
    }

    $genReasons = [];
    if ($scenes === []) $genReasons[] = 'ยังไม่มีฉาก — กด "สร้างภาพทุกฉาก" ก่อน';
    array_push($genReasons, ...$notReady);
    if ($modelError) $genReasons[] = $modelError;
    if (!$publicUrlOk) $genReasons[] = 'ระบบยังไม่มี URL สาธารณะ (VITE_APP_URL เป็น localhost/IP ภายใน) — kie.ai เข้าถึงภาพฉากไม่ได้';
    if ($genReasons === [] && $toGenerate === []) $genReasons[] = 'ทุกฉากมีคลิปพร้อมใช้หรือกำลังสร้างอยู่แล้ว';

    return [
        'item_id'              => $item['id'],
        'aspect_ratio'         => kieVideoNormalizeAspect($item['video_aspect_ratio'] ?? null),
        'resolution'           => $resolution,
        'model'                => $model ? ['id' => $model['id'], 'name' => $model['name'], 'credits_per_clip' => videoClipCredits($model, $resolution)] : null,
        'model_error'          => $modelError,
        'public_url_ok'        => $publicUrlOk,
        'scenes'               => $sceneStates,
        'counts'               => ['ready' => $readyClips, 'total' => count($scenes)],
        'any_generating'       => (bool)array_filter($sceneStates, fn($s) => $s['generating']),
        'can_generate_all'     => $genReasons === [],
        'generate_all_reasons' => $genReasons,
        'scenes_to_generate'   => $genReasons === [] ? $toGenerate : [],
        'combine'              => videoCombineState($db, $item, $tenantId, $sceneStates, $combines, $checkFfmpeg),
    ];
}

// ── จองฉาก + ยิง ────────────────────────────────────────────────────────────

/**
 * จองฉากแบบ atomic: ล็อกแถว content_items → ไม่มี generation ที่ generating ของฉากนี้ → INSERT
 * @return ?string id ของแถวที่จอง หรือ null ถ้าฉากกำลังสร้างอยู่
 */
function videoReserveClip(PDO $db, string $tenantId, string $itemId, string $sceneId, int $sceneIndex, array $snapshot, ?string $modelId, ?int $credits): ?string {
    $db->beginTransaction();
    try {
        $lock = $db->prepare('SELECT id FROM content_items WHERE id = ? AND tenant_id = ? FOR UPDATE');
        $lock->execute([$itemId, $tenantId]);
        if (!$lock->fetchColumn()) { $db->rollBack(); return null; }

        $busy = $db->prepare("SELECT COUNT(*) FROM content_video_clips WHERE item_id = ? AND scene_id = ? AND status = 'generating'");
        $busy->execute([$itemId, $sceneId]);
        if ((int)$busy->fetchColumn() > 0) { $db->rollBack(); return null; }

        $id = generateUUID();
        $db->prepare("INSERT INTO content_video_clips
            (id, tenant_id, item_id, scene_id, scene_index, model_id, job_id, status, input_snapshot, credits_estimated, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, NULL, 'generating', ?, ?, NOW(), NOW())")
           ->execute([$id, $tenantId, $itemId, $sceneId, $sceneIndex, $modelId,
                      json_encode($snapshot, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), $credits]);
        $db->commit();
        return $id;
    } catch (Throwable $e) {
        if ($db->inTransaction()) $db->rollBack();
        throw $e;
    }
}

/**
 * ยิงคลิปของฉากที่ผู้ใช้ยืนยัน (action generate-clips) — ยิงทีละฉากตามลำดับฉาก
 * ไม่ยิงเกิน $sceneIds; ฉากที่ไม่ใช่ Active Scene / ไม่พร้อม / ไม่ต้องสร้าง / กำลังสร้าง → skipped
 * error ระดับบัญชี → หยุดฉากที่เหลือ (skipped)
 *
 * @param ?callable $submit fn(array $model, array $req): string taskId — ทดสอบใส่ mock ได้ (ค่าเริ่มต้น kieVideoSubmit)
 * @return array{results: array, summary: array}
 */
function videoGenerateClips(PDO $db, array $item, string $tenantId, array $sceneIds, ?callable $submit = null): array {
    $submit ??= 'kieVideoSubmit';
    $sceneIds = array_values(array_unique(array_map('strval', $sceneIds)));
    $results = [];
    $skip = fn(string $id, ?int $idx, string $reason) => ['scene_id' => $id, 'index' => $idx, 'status' => 'skipped', 'reason' => $reason];

    if (!videoPublicUrlOk()) {
        foreach ($sceneIds as $id) $results[] = $skip($id, null, 'ระบบยังไม่มี URL สาธารณะ — kie.ai เข้าถึงภาพฉากไม่ได้');
        return ['results' => $results, 'summary' => videoSummarize($results)];
    }

    $model = videoResolveModel($db, $item, $tenantId, true); // ครั้งเดียวต่อคำขอ ทุกฉากใช้ model เดียวกัน
    $credits = videoClipCredits($model, kieVideoNormalizeResolution($item['video_resolution'] ?? null));
    $clipsByScene = videoLoadClips($db, $tenantId, [$item['id']])[$item['id']] ?? [];

    $scenes = videoItemScenes($item);
    $byId = [];
    foreach ($scenes as $i => $s) if (!empty($s['id'])) $byId[(string)$s['id']] = $i;

    // ฉากที่ไม่ใช่ Active Scene ตอบก่อน แล้วยิงที่เหลือตามลำดับฉาก
    foreach ($sceneIds as $id) if (!isset($byId[$id])) $results[] = $skip($id, null, 'ฉากนี้ไม่อยู่ในสคริปต์ปัจจุบันแล้ว');
    $ordered = array_values(array_filter($sceneIds, fn($id) => isset($byId[$id])));
    usort($ordered, fn($a, $b) => $byId[$a] <=> $byId[$b]);

    $accountError = null;
    foreach ($ordered as $sceneId) {
        $i = $byId[$sceneId];
        $scene = $scenes[$i];
        $n = $i + 1;
        if ($accountError !== null) { $results[] = $skip($sceneId, $i, $accountError); continue; }

        $readiness = videoSceneReadiness($scene, $i);
        if ($readiness !== []) { $results[] = $skip($sceneId, $i, implode(' · ', $readiness)); continue; }

        $snapshot = videoClipSnapshot($item, $scene, $model['id'], $model['video']);
        $info = videoSceneClipInfo($clipsByScene[$sceneId] ?? [], $snapshot);
        if ($info['generating']) { $results[] = $skip($sceneId, $i, "ฉาก {$n} กำลังสร้างอยู่"); continue; }
        if (!$info['needs'])     { $results[] = $skip($sceneId, $i, "ฉาก {$n} มีคลิปพร้อมใช้แล้ว"); continue; }

        $clipId = videoReserveClip($db, $tenantId, $item['id'], $sceneId, $i, $snapshot, $model['id'], $credits);
        if ($clipId === null) { $results[] = $skip($sceneId, $i, "ฉาก {$n} กำลังสร้างอยู่"); continue; }

        try {
            $taskId = $submit($model, [
                'prompt'       => kieVideoComposePrompt($snapshot['video_prompt'], $snapshot['narration']),
                'aspect_ratio' => $snapshot['aspect_ratio'],
                'resolution'   => $snapshot['resolution'],
                'image_url'    => videoAbsoluteUrl($snapshot['image_url']),
            ]);
            $db->prepare("UPDATE content_video_clips SET job_id = ?, updated_at = NOW() WHERE id = ? AND status = 'generating'")
               ->execute([$taskId, $clipId]);
            $results[] = ['scene_id' => $sceneId, 'index' => $i, 'status' => 'submitted', 'reason' => null, 'clip_id' => $clipId];
        } catch (RuntimeException $e) {
            // ยิงไม่ผ่านตั้งแต่แรก → ไม่เสีย credit
            $db->prepare("UPDATE content_video_clips SET status = 'failed', error = ?, credits_estimated = 0, credits_actual = 0,
                          completed_at = NOW(), updated_at = NOW() WHERE id = ? AND status = 'generating'")
               ->execute([mb_substr($e->getMessage(), 0, 2000), $clipId]);
            $results[] = ['scene_id' => $sceneId, 'index' => $i, 'status' => 'failed', 'reason' => $e->getMessage(), 'clip_id' => $clipId];
            if ($e instanceof KieVideoAccountException) {
                $accountError = 'หยุดส่งฉากที่เหลือ: ' . $e->getMessage();
            }
        }
    }
    return ['results' => $results, 'summary' => videoSummarize($results)];
}

function videoSummarize(array $results): array {
    $s = ['submitted' => 0, 'skipped' => 0, 'failed' => 0];
    foreach ($results as $r) $s[$r['status']] = ($s[$r['status']] ?? 0) + 1;
    return $s;
}

// ── poll ทีละคลิป (ใช้ร่วมกันโดย clip-status และ cron video-clips-sync) ────────

/**
 * poll คลิป generating 1 แถวด้วย adapter ของ model ที่ใช้สร้างคลิปนั้น → done/failed/generating
 * อัปเดตแบบมีเงื่อนไข (WHERE status='generating') — อีกฝ่ายทำไปแล้วจะไม่ทับซ้ำ
 *
 * @param ?callable $poll     fn(array $model, string $taskId): array — mock ได้
 * @param ?callable $download fn(string $url, string $itemId, string $taskId, ?int $maxSeconds): ?string — mock ได้
 */
function videoClipPollOne(PDO $db, array $clip, ?int $maxDownloadSeconds = null, ?callable $poll = null, ?callable $download = null): string {
    if (($clip['status'] ?? '') !== 'generating' || empty($clip['job_id']) || empty($clip['model_id'])) {
        return (string)($clip['status'] ?? '');
    }
    $poll ??= 'kieVideoPoll';
    $download ??= fn(string $url, string $itemId, string $taskId, ?int $max) => kieVideoDownload($url, $itemId, $taskId, null, $max);
    try {
        $model = kieVideoLoadModel($db, (string)$clip['model_id']);
    } catch (RuntimeException $e) {
        error_log('[video-clips] poll: ' . $e->getMessage() . ' | clip=' . $clip['id']);
        return 'generating';
    }

    $r = $poll($model, (string)$clip['job_id']);
    if ($r['status'] === 'success') {
        $local = $download((string)$r['url'], (string)$clip['item_id'], (string)$clip['job_id'], $maxDownloadSeconds);
        // kie คิด credit แล้ว — ดาวน์โหลดไม่ครบคง generating ไว้ให้รอบหน้าโหลดต่อ (ห้ามตั้ง failed)
        if ($local === null) return 'generating';
        $upd = $db->prepare("UPDATE content_video_clips SET status = 'done', clip_url = ?, credits_actual = COALESCE(?, credits_actual),
                             completed_at = NOW(), updated_at = NOW() WHERE id = ? AND status = 'generating'");
        $upd->execute([$local, $r['credits'] ?? null, $clip['id']]);
        return 'done';
    }
    if ($r['status'] === 'failed') {
        $db->prepare("UPDATE content_video_clips SET status = 'failed', error = ?, completed_at = NOW(), updated_at = NOW()
                      WHERE id = ? AND status = 'generating'")
           ->execute([mb_substr((string)($r['error'] ?? 'สร้างคลิปไม่สำเร็จ'), 0, 2000), $clip['id']]);
        return 'failed';
    }
    return 'generating';
}

/**
 * งาน cron video-clips-sync (ทุก tenant): เก็บงานค้าง แล้ว poll + ดาวน์โหลดคลิป generating ที่เก่าที่สุด
 * ไม่เกิน $limit คลิป ภายในงบเวลา $budgetSeconds (ไม่ถ่วงงาน cron อื่นในโปรเซสเดียวกัน) — ไม่รวมคลิป
 * ทุกการเปลี่ยนสถานะเป็น conditional UPDATE (WHERE status เดิม) — ชนกับ clip-status ของหน้าเว็บไม่ได้
 */
function videoClipsSyncRun(PDO $db, int $budgetSeconds = 40, int $limit = 30, ?callable $poll = null, ?callable $download = null): array {
    $deadline = microtime(true) + $budgetSeconds;
    $ttl = VIDEO_RESERVE_TTL_MINUTES;
    $timeout = VIDEO_JOB_TIMEOUT_MINUTES;

    // จองแล้วแต่ไม่ได้ job_id (โปรเซสดับระหว่างยิง) — นับจากเวลาที่จอง
    $orphan = $db->exec("UPDATE content_video_clips SET status = 'failed', error = 'ส่งงานไม่สำเร็จ', credits_estimated = 0, credits_actual = 0,
                         completed_at = NOW(), updated_at = NOW()
                         WHERE status = 'generating' AND job_id IS NULL AND created_at < NOW() - INTERVAL {$ttl} MINUTE");
    $timedOut = $db->exec("UPDATE content_video_clips SET status = 'failed', error = 'หมดเวลา', completed_at = NOW(), updated_at = NOW()
                           WHERE status = 'generating' AND job_id IS NOT NULL AND created_at < NOW() - INTERVAL {$timeout} MINUTE");
    $staleCombine = $db->exec("UPDATE content_video_combines SET status = 'failed', error = 'รวมไม่สำเร็จ', completed_at = NOW(), updated_at = NOW()
                               WHERE status = 'combining' AND created_at < NOW() - INTERVAL {$ttl} MINUTE");

    $stmt = $db->prepare("SELECT * FROM content_video_clips WHERE status = 'generating' AND job_id IS NOT NULL
                          ORDER BY created_at ASC, id ASC LIMIT " . max(1, $limit));
    $stmt->execute();
    $counts = ['polled' => 0, 'done' => 0, 'failed' => 0, 'generating' => 0, 'out_of_time' => 0];
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $clip) {
        $left = (int)floor($deadline - microtime(true));
        if ($left < 2) { $counts['out_of_time']++; continue; }
        $status = videoClipPollOne($db, $clip, $left, $poll, $download);
        $counts['polled']++;
        $counts[$status] = ($counts[$status] ?? 0) + 1;
    }
    return $counts + ['orphaned' => (int)$orphan, 'timed_out' => (int)$timedOut, 'stale_combines' => (int)$staleCombine];
}

/** poll คลิป generating ของ Active Scene ของ item (action clip-status) ภายในงบเวลา */
function videoPollItemClips(PDO $db, array $item, string $tenantId, int $budgetSeconds = 20): void {
    $activeIds = array_values(array_filter(array_map(fn($s) => (string)($s['id'] ?? ''), videoItemScenes($item))));
    if ($activeIds === []) return;
    $in = implode(',', array_fill(0, count($activeIds), '?'));
    $stmt = $db->prepare("SELECT * FROM content_video_clips WHERE tenant_id = ? AND item_id = ? AND status = 'generating'
                          AND job_id IS NOT NULL AND scene_id IN ($in) ORDER BY created_at ASC");
    $stmt->execute(array_merge([$tenantId, $item['id']], $activeIds));
    $deadline = microtime(true) + $budgetSeconds;
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $clip) {
        $left = (int)floor($deadline - microtime(true));
        if ($left < 2) break;
        videoClipPollOne($db, $clip, $left);
    }
}
