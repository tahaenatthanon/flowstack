<?php
/**
 * multi-clip-video — ทดสอบ api/lib/video-combine.php
 *   - videoCombineClips ด้วย ffmpeg จริง กับคลิปที่ดาวน์โหลดไว้ใน uploads/content/videos/ (ไม่ใช้ credit)
 *   - videoRunCombine / สถานะวิดีโอรวม ด้วย content item ทดสอบใน DB local (ลบทิ้งท้าย)
 * ไม่มี ffmpeg → ข้ามเคสที่ต้องใช้ ffmpeg พร้อมข้อความ
 *
 * รัน: php api/tests/video-combine-test.php
 */

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../lib/video-clips.php';

$RESULTS = [];
function record(string $tc, string $name, string $expected, string $actual, bool $pass): void {
    global $RESULTS;
    $RESULTS[] = [$tc, $name, $expected, $actual, $pass];
}
$PASS = 0; $FAIL = 0;
function tally(bool $pass): void { global $PASS, $FAIL; $pass ? $PASS++ : $FAIL++; }

$db = getDB();
$TENANT = 'tenant-default';
$LITE = $db->query("SELECT id FROM ai_models WHERE model_id='veo3_lite'")->fetchColumn();
$CREATED = [];
$tmp = sys_get_temp_dir() . '/video-combine-test-' . bin2hex(random_bytes(4));
mkdir($tmp);

$videoDir = realpath(__DIR__ . '/../../uploads/content/videos');
$sources = array_values(array_filter(glob($videoDir . '/*.mp4') ?: [], fn($f) => !str_contains($f, '_combined_')));
$ffOk = videoFfmpegAvailable();
[$FF, $FP] = videoFfmpegBinaries();

function probe(string $ffprobe, string $file, string $stream, string $entry): string {
    [, $o] = videoExec([$ffprobe, '-v', 'error', '-select_streams', $stream, '-show_entries', "stream={$entry}", '-of', 'csv=p=0', $file]);
    return trim($o[0] ?? '');
}

try {
// ═══════════════════ ffmpeg จริง ══════════════════════════════════════════
if (!$ffOk || count($sources) < 2) {
    echo "⚠️ ข้ามเคส ffmpeg: " . (!$ffOk ? 'ไม่พบ ffmpeg/ffprobe (ตั้ง FFMPEG_PATH/FFPROBE_PATH)' : 'มีคลิปใน uploads/content/videos ไม่ถึง 2 ไฟล์') . "\n";
} else {
    // คลิปไม่มีเสียง + คลิปเสียง 44.1kHz (จำลอง Seedance) สร้างจากคลิปเดิม
    $mute = $tmp . '/mute.mp4';
    $sd44 = $tmp . '/sd44.mp4';
    videoExec([$FF, '-v', 'error', '-y', '-i', $sources[0], '-an', '-c:v', 'copy', $mute]);
    videoExec([$FF, '-v', 'error', '-y', '-i', $sources[1], '-c:v', 'copy', '-c:a', 'aac', '-ar', '44100', $sd44]);

    $out = $tmp . '/combined.mp4';
    $r = videoCombineClips($FF, $FP, [$sources[0], $mute, $sd44, $sources[1]], $out);
    $vDur = (float)probe($FP, $out, 'v:0', 'duration');
    $aDur = (float)probe($FP, $out, 'a:0', 'duration');
    $aRate = probe($FP, $out, 'a:0', 'sample_rate');
    $pass = $r['ok'] && is_file($out) && abs($vDur - 32.0) < 0.1 && abs($aDur - $vDur) <= 0.1 && $aRate === '48000';
    record('CB01', 'รวม 4 คลิป (มีคลิปไม่มีเสียง + คลิปเสียง 44.1kHz) → ภาพ 32 วิ เสียงต่อเนื่อง 48kHz ต่างจากภาพ ≤ 0.1 วิ',
        'ok, v=32.0, |a-v|≤0.1, 48000', sprintf('%s, v=%.3f, a=%.3f, %s', $r['ok'] ? 'ok' : $r['error'], $vDur, $aDur, $aRate), $pass); tally($pass);

    $head = file_get_contents($out, false, null, 0, 4 * 1024 * 1024);
    $moov = strpos($head, 'moov'); $mdat = strpos($head, 'mdat');
    $pass = $moov !== false && $mdat !== false && $moov < $mdat;
    record('CB02', 'faststart: moov อยู่ก่อน mdat', 'moov < mdat', var_export($moov, true) . ' < ' . var_export($mdat, true), $pass); tally($pass);

    $bad = videoCombineClips($FF, $FP, [$sources[0], $tmp . '/not-a-video.mp4'], $tmp . '/bad.mp4');
    $pass = !$bad['ok'] && !is_file($tmp . '/bad.mp4') && $bad['error'] !== '';
    record('CB03', 'คลิปเสีย → ok=false พร้อม error และไม่มีไฟล์ผลลัพธ์ค้าง', 'false + error', ($bad['ok'] ? 'true' : 'false') . ' ' . mb_substr((string)$bad['error'], 0, 60), $pass); tally($pass);
}

// ═══════════════════ videoRunCombine + สถานะ (DB) ═════════════════════════
if (count($sources) < 2) throw new RuntimeException('ต้องมีคลิปอย่างน้อย 2 ไฟล์ใน uploads/content/videos');
$root = realpath(__DIR__ . '/../..');
$clipUrls = array_map(fn($f) => '/uploads/content/videos/' . basename($f), array_slice($sources, 0, 2));

$scenes = [];
for ($i = 0; $i < 2; $i++) {
    $scenes[] = ['id' => 'sc_cb' . $i . bin2hex(random_bytes(2)), 'visual_prompt' => "ภาพ {$i}", 'video_prompt' => "motion {$i}", 'narration' => "บท {$i}",
                 'duration_sec' => 8, 'image_url' => "/uploads/content/cb{$i}.jpg", 'image_gen_status' => 'done'];
}
$itemId = generateUUID();
$CREATED[] = $itemId;
$db->prepare("INSERT INTO content_items (id, tenant_id, title, type, created_by, article_content, video_aspect_ratio, video_resolution, video_model_id,
              video_url, created_at, updated_at) VALUES (?, ?, 'ทดสอบ video-combine', 'video', 'test', ?, '9:16', '720p', ?, '/uploads/content/videos/old-combined.mp4', NOW(), NOW())")
   ->execute([$itemId, $TENANT, json_encode(['scenes' => $scenes], JSON_UNESCAPED_UNICODE), $LITE]);
$load = function () use ($db, $itemId) { $s = $db->prepare('SELECT * FROM content_items WHERE id = ?'); $s->execute([$itemId]); return $s->fetch(PDO::FETCH_ASSOC); };
$addClip = function (int $i, string $status, ?string $url, string $ago = '5 MINUTE') use ($db, $TENANT, $itemId, $scenes, $LITE, $load) {
    $id = generateUUID();
    $snap = videoClipSnapshot($load(), $scenes[$i], $LITE, ['durations' => [4, 6, 8]]);
    $db->prepare("INSERT INTO content_video_clips (id, tenant_id, item_id, scene_id, scene_index, model_id, job_id, status, clip_url, input_snapshot,
                  created_at, completed_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW() - INTERVAL {$ago}, NOW(), NOW())")
       ->execute([$id, $TENANT, $itemId, $scenes[$i]['id'], $i, $LITE, 'job-' . $id, $status, $url, json_encode($snap, JSON_UNESCAPED_UNICODE)]);
    return $id;
};

// ยังไม่ครบ → 422 พร้อมเหตุผลรายฉาก
$c0 = $addClip(0, 'done', $clipUrls[0], '10 MINUTE');
$code = 0; $reasons = [];
try { videoRunCombine($db, $load(), $TENANT, fn() => ['ok' => true, 'error' => null], $tmp); }
catch (VideoCombineException $e) { $code = $e->httpCode; $reasons = $e->reasons; }
$pass = $code === 422 && in_array('ฉาก 2 ยังไม่มีคลิป', $reasons, true);
record('CB04', 'ยังไม่ครบทุก Active Scene → 422 + เหตุผลรายฉาก', '422 ฉาก 2 ยังไม่มีคลิป', "{$code} " . implode(',', $reasons), $pass); tally($pass);

$c1 = $addClip(1, 'done', $clipUrls[1], '10 MINUTE');

// ffmpeg ล้ม → failed, video_url เดิมไม่เปลี่ยน
$code = 0;
try { videoRunCombine($db, $load(), $TENANT, fn() => ['ok' => false, 'error' => 'boom'], $tmp); }
catch (VideoCombineException $e) { $code = $e->httpCode; }
$last = $db->query("SELECT status, error FROM content_video_combines WHERE item_id = " . $db->quote($itemId) . " ORDER BY created_at DESC LIMIT 1")->fetch(PDO::FETCH_ASSOC);
$pass = $code === 500 && $last['status'] === 'failed' && $last['error'] === 'boom' && $load()['video_url'] === '/uploads/content/videos/old-combined.mp4';
record('CB05', 'ffmpeg ล้ม → แถว failed และ video_url เดิมไม่เปลี่ยน', '500 / failed boom / old-combined', "{$code} / {$last['status']} {$last['error']} / " . basename((string)$load()['video_url']), $pass); tally($pass);

// จองซ้อน → 409
$busyId = generateUUID();
$db->prepare("INSERT INTO content_video_combines (id, tenant_id, item_id, status, source_clips, created_at, updated_at) VALUES (?, ?, ?, 'combining', '[]', NOW(), NOW())")
   ->execute([$busyId, $TENANT, $itemId]);
$code = 0;
try { videoRunCombine($db, $load(), $TENANT, fn() => ['ok' => true, 'error' => null], $tmp); }
catch (VideoCombineException $e) { $code = $e->httpCode; }
$pass = $code === 409;
record('CB06', 'มีการรวมที่ยัง combining (< 10 นาที) → 409', '409', (string)$code, $pass); tally($pass);
$db->prepare("UPDATE content_video_combines SET created_at = NOW() - INTERVAL 11 MINUTE WHERE id = ?")->execute([$busyId]);

// สำเร็จ (combiner mock คัดลอกไฟล์) → video_url ใหม่ + source_clips
$res = videoRunCombine($db, $load(), $TENANT, function ($ff, $fp, array $paths, string $out) { copy($paths[0], $out); return ['ok' => true, 'error' => null]; }, $tmp);
$row = $db->query("SELECT * FROM content_video_combines WHERE id = " . $db->quote($res['combine_id']))->fetch(PDO::FETCH_ASSOC);
$src = json_decode($row['source_clips'], true);
$pass = $res['status'] === 'done' && $load()['video_url'] === $res['video_url'] && $load()['video_gen_status'] === 'done'
    && array_column($src, 'clip_id') === [$c0, $c1] && array_column($src, 'scene_id') === array_column($scenes, 'id')
    && is_file($tmp . '/' . basename($res['video_url'])) && str_contains($res['video_url'], '_combined_');
record('CB07', 'การจองเกิน 10 นาทีหมดอายุ → รวมใหม่ได้; สำเร็จ → video_url ใหม่ + source_clips ตรงคลิปที่ใช้', 'done / source ตรง', "{$res['status']} " . basename($res['video_url']), $pass); tally($pass);

$state = fn() => videoItemState($db, $load(), $TENANT, null, null, false)['combine']['latest'];
$s0 = $state();
$pass = $s0 && !$s0['stale'];
record('CB08', 'หลังรวม: วิดีโอรวมไม่ล้าสมัย', 'stale=false', json_encode($s0['stale'] ?? null), $pass); tally($pass);

// generation ใหม่ที่ failed ไม่ทำให้ล้าสมัย
$addClip(0, 'failed', null, '1 MINUTE');
$s1 = $state();
$pass = !$s1['stale'];
record('CB09', 'generation ใหม่ที่ failed → วิดีโอรวมไม่ล้าสมัย', 'stale=false', json_encode($s1['stale_reasons'], JSON_UNESCAPED_UNICODE), $pass); tally($pass);

// (ค) คลิปที่ใช้รวมล้าสมัยเพราะบทพากย์เปลี่ยน
$ac = json_decode($load()['article_content'], true);
$ac['scenes'][1]['narration'] = 'บทใหม่';
$db->prepare('UPDATE content_items SET article_content = ? WHERE id = ?')->execute([json_encode($ac, JSON_UNESCAPED_UNICODE), $itemId]);
$s2 = $state();
$pass = $s2['stale'] && $s2['stale_reasons'] === ['ฉาก 2 ล้าสมัย (บทพากย์เปลี่ยน)'];
record('CB10', 'แก้บทพากย์ (ยังไม่สร้างคลิปใหม่) → วิดีโอรวมล้าสมัย', 'ฉาก 2 ล้าสมัย (บทพากย์เปลี่ยน)', implode(',', $s2['stale_reasons']), $pass); tally($pass);
$ac['scenes'][1]['narration'] = 'บท 1';
$db->prepare('UPDATE content_items SET article_content = ? WHERE id = ?')->execute([json_encode($ac, JSON_UNESCAPED_UNICODE), $itemId]);

// (ข) ฉากมีคลิปใหม่ที่ done
$addClip(0, 'done', $clipUrls[1], '0 MINUTE');
$s3 = $state();
$pass = $s3['stale'] && $s3['stale_reasons'] === ['ฉาก 1 มีคลิปใหม่'];
record('CB11', 'ฉากมีคลิปใหม่ที่ done → วิดีโอรวมล้าสมัย', 'ฉาก 1 มีคลิปใหม่', implode(',', $s3['stale_reasons']), $pass); tally($pass);

// (ก) ชุดฉากเปลี่ยน (เขียนสคริปต์ใหม่)
$ac['scenes'][1]['id'] = 'sc_rewritten';
$db->prepare('UPDATE content_items SET article_content = ? WHERE id = ?')->execute([json_encode($ac, JSON_UNESCAPED_UNICODE), $itemId]);
$s4 = $state();
$pass = $s4['stale'] && str_starts_with($s4['stale_reasons'][0] ?? '', 'ฉากเปลี่ยน');
record('CB12', 'ชุดฉากเปลี่ยน → วิดีโอรวมล้าสมัย "ฉากเปลี่ยน"', 'ฉากเปลี่ยน …', implode(',', $s4['stale_reasons']), $pass); tally($pass);

} finally {
    foreach ($CREATED as $id) $db->prepare('DELETE FROM content_items WHERE id = ?')->execute([$id]);
    foreach (glob($tmp . '/*') ?: [] as $f) @unlink($f);
    @rmdir($tmp);
}

echo "\n| TC | Test Case | Expected | Actual | PASS/FAIL |\n|----|-----------|----------|--------|-----------|\n";
foreach ($RESULTS as [$tc, $name, $expected, $actual, $pass]) {
    echo "| {$tc} | {$name} | {$expected} | " . mb_substr($actual, 0, 160) . ' | ' . ($pass ? 'PASS' : 'FAIL') . " |\n";
}
echo "\nผ่าน: {$PASS} / " . count($RESULTS) . "\nไม่ผ่าน: {$FAIL} / " . count($RESULTS) . "\n";
if ($FAIL > 0) { echo "\nRESULT: FAIL\n"; exit(1); }
echo "\nRESULT: PASS\n";
