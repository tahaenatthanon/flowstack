<?php
/**
 * ย้ายข้อมูลครั้งเดียวสำหรับ change multi-clip-video — รันหลัง migration สร้างตาราง content_video_clips
 *
 *   php scripts/migrate-multi-clip-video.php --dry-run   (แสดงสิ่งที่จะทำ ไม่เขียนอะไร)
 *   php scripts/migrate-multi-clip-video.php
 *
 * ลำดับ (ต่อ content item):
 *   0. backup id, article_content, video_* ของทุกแถวที่จะแตะ → database/backups/multi-clip-video-<เวลา>.json
 *   1. แจก scene.id ให้ฉากที่ยังไม่มี (article_content.scenes[].id)
 *   2. วิดีโอเดิม (video_url / video_job_id จาก generate-video ที่ยิงแค่ฉากแรก) → แถว content_video_clips ของฉาก 1
 *      input_snapshot = ค่าปัจจุบันของฉาก 1 + migrated: true, credit = NULL (ไม่ได้จดไว้ตอนนั้น)
 *   3. ล้าง video_url / video_job_id, video_gen_status = 'none' (video_url ใหม่ = วิดีโอรวมเท่านั้น) — คง video_model_id
 *
 * Idempotent: ฉากที่มี id แล้วไม่แตะ, item ที่มีคลิป migrated แล้วข้าม — ไม่ย้าย/ไม่ลบไฟล์วิดีโอ
 * Rollback: คืน video_url / video_job_id / video_gen_status / article_content จากไฟล์ backup
 */

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("CLI only\n");
}

require_once __DIR__ . '/../api/config.php';
require_once __DIR__ . '/../api/lib/video-clips.php';

$dryRun = in_array('--dry-run', $argv, true);
$db = getDB();

$rows = $db->query("SELECT id, tenant_id, article_content, video_aspect_ratio, video_resolution, video_model_id,
                           video_url, video_job_id, video_gen_status
                    FROM content_items
                    WHERE article_content LIKE '%\"scenes\"%' OR video_url IS NOT NULL OR video_job_id IS NOT NULL")
           ->fetchAll(PDO::FETCH_ASSOC);

echo ($dryRun ? '[dry-run] ' : '') . 'พบ content item ที่เกี่ยวข้อง ' . count($rows) . " รายการ\n";

$hasMigrated = $db->prepare("SELECT COUNT(*) FROM content_video_clips WHERE item_id = ? AND JSON_EXTRACT(input_snapshot, '$.migrated') = true");

// backup เฉพาะแถวที่จะถูกแก้จริง ก่อนแก้ — ชื่อไฟล์ไม่ซ้ำและเปิดแบบ 'x' (ห้ามเขียนทับ backup เดิม)
$toChange = array_values(array_filter($rows, function (array $r) use ($hasMigrated) {
    $ac = json_decode((string)$r['article_content'], true);
    foreach ((is_array($ac) && is_array($ac['scenes'] ?? null) ? $ac['scenes'] : []) as $s) {
        if (is_array($s) && trim((string)($s['id'] ?? '')) === '') return true;
    }
    if (empty($r['video_url']) && empty($r['video_job_id'])) return false;
    $hasMigrated->execute([$r['id']]);
    return (int)$hasMigrated->fetchColumn() === 0;
}));
if (!$dryRun && $toChange !== []) {
    $dir = __DIR__ . '/../database/backups';
    if (!is_dir($dir)) mkdir($dir, 0755, true);
    $file = $dir . '/multi-clip-video-' . date('Ymd_His') . '-' . bin2hex(random_bytes(3)) . '.json';
    $fh = fopen($file, 'x');
    if ($fh === false || fwrite($fh, json_encode($toChange, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT)) === false) {
        fwrite(STDERR, "เขียนไฟล์ backup ไม่ได้ — หยุด ไม่แก้ข้อมูล\n");
        exit(1);
    }
    fclose($fh);
    echo "backup: {$file} (" . count($toChange) . " รายการ)\n";
} elseif (!$dryRun) {
    echo "ไม่มีข้อมูลที่ต้องย้าย — ไม่สร้าง backup\n";
}

$stats = ['scene_ids' => 0, 'clips' => 0, 'cleared' => 0, 'skipped_migrated' => 0];

foreach ($rows as $item) {
    $short = substr($item['id'], 0, 8);
    $ac = json_decode((string)$item['article_content'], true);
    $scenes = is_array($ac) && is_array($ac['scenes'] ?? null) ? $ac['scenes'] : [];

    // 1. scene.id
    $missing = count(array_filter($scenes, fn($s) => is_array($s) && trim((string)($s['id'] ?? '')) === ''));
    if ($missing > 0) {
        $ac['scenes'] = videoAssignSceneIds($scenes);
        $scenes = $ac['scenes'];
        echo "  {$short}: แจก scene.id {$missing} ฉาก\n";
        $stats['scene_ids'] += $missing;
        if (!$dryRun) {
            $db->prepare('UPDATE content_items SET article_content = ? WHERE id = ?')
               ->execute([json_encode($ac, JSON_UNESCAPED_UNICODE), $item['id']]);
        }
    }

    // 2–3. วิดีโอเดิม → คลิปฉาก 1
    $hasOldVideo = !empty($item['video_url']) || !empty($item['video_job_id']);
    if (!$hasOldVideo) continue;
    $hasMigrated->execute([$item['id']]);
    if ((int)$hasMigrated->fetchColumn() > 0) { $stats['skipped_migrated']++; continue; }
    if ($scenes === [] || empty($scenes[0]['id'])) {
        echo "  {$short}: มีวิดีโอเดิมแต่ไม่มีฉาก — ข้าม (ไม่แตะ video_url)\n";
        continue;
    }

    $done = !empty($item['video_url']) && ($item['video_gen_status'] ?? '') === 'done';
    $status = $done ? 'done' : (($item['video_gen_status'] ?? '') === 'generating' && !empty($item['video_job_id']) ? 'generating' : 'failed');
    $snapshot = videoClipSnapshot($item, $scenes[0], $item['video_model_id'] ?: null) + ['migrated' => true];
    echo "  {$short}: วิดีโอเดิม ({$item['video_gen_status']}) → คลิปฉาก 1 สถานะ {$status}" . ($done ? " ({$item['video_url']})" : '') . "\n";
    $stats['clips']++;
    if ($dryRun) continue;

    $db->beginTransaction();
    try {
        $db->prepare("INSERT INTO content_video_clips
            (id, tenant_id, item_id, scene_id, scene_index, model_id, job_id, status, clip_url, error, input_snapshot,
             credits_estimated, credits_actual, created_at, completed_at, updated_at)
            VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, NULL, NULL, NOW(), ?, NOW())")
           ->execute([
               generateUUID(), $item['tenant_id'], $item['id'], $scenes[0]['id'], $item['video_model_id'] ?: null,
               $item['video_job_id'] ?: null, $status, $done ? $item['video_url'] : null,
               $status === 'failed' ? 'วิดีโอจากระบบเดิมสร้างไม่สำเร็จ' : null,
               json_encode($snapshot, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
               $status === 'generating' ? null : date('Y-m-d H:i:s'),
           ]);
        $db->prepare("UPDATE content_items SET video_url = NULL, video_job_id = NULL, video_gen_status = 'none' WHERE id = ?")
           ->execute([$item['id']]);
        $db->commit();
        $stats['cleared']++;
    } catch (Throwable $e) {
        $db->rollBack();
        fwrite(STDERR, "  {$short}: ล้มเหลว — " . $e->getMessage() . "\n");
    }
}

echo ($dryRun ? '[dry-run] ' : '') . "สรุป: แจก scene.id {$stats['scene_ids']} ฉาก · ย้ายวิดีโอเดิม {$stats['clips']} รายการ"
    . " · ล้างค่าบน item {$stats['cleared']} · ข้าม (ย้ายแล้ว) {$stats['skipped_migrated']}\n";
