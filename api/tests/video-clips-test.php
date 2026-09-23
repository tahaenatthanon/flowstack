<?php
/**
 * multi-clip-video — ทดสอบ api/lib/video-clips.php (snapshot/ล้าสมัย, credit, ความพร้อม, model,
 * การจองแบบ atomic, generate-clips, poll ทีละคลิป, cron video-clips-sync)
 * ใช้ DB local จริง (สร้าง content item ทดสอบแล้วลบทิ้งท้าย) — mock การยิง/poll/ดาวน์โหลด ไม่ยิง kie จริง ไม่ใช้ credit
 *
 * รัน: php api/tests/video-clips-test.php
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
$SD2  = $db->query("SELECT id FROM ai_models WHERE model_id='bytedance/seedance-2'")->fetchColumn(); // inactive
$CREATED = [];

/** สร้าง content item วิดีโอทดสอบ N ฉาก (ทุกฉากพร้อม) */
function makeItem(PDO $db, int $n, array $override = []): array {
    global $TENANT, $LITE, $CREATED;
    $scenes = [];
    for ($i = 0; $i < $n; $i++) {
        $scenes[] = ['id' => 'sc_test' . $i . bin2hex(random_bytes(2)), 'visual_prompt' => "ภาพ {$i}", 'video_prompt' => "motion {$i}",
                     'narration' => "บท {$i}", 'duration_sec' => 8, 'image_url' => "/uploads/content/test_scene{$i}.jpg", 'image_gen_status' => 'done'];
    }
    foreach ($override as $i => $patch) $scenes[$i] = array_merge($scenes[$i], $patch);
    $id = generateUUID();
    $db->prepare("INSERT INTO content_items (id, tenant_id, title, type, created_by, article_content, video_aspect_ratio, video_resolution,
                  video_model_id, created_at, updated_at) VALUES (?, ?, 'ทดสอบ video-clips', 'video', 'test', ?, '9:16', '720p', ?, NOW(), NOW())")
       ->execute([$id, $TENANT, json_encode(['scenes' => $scenes], JSON_UNESCAPED_UNICODE), $LITE]);
    $CREATED[] = $id;
    return loadItem($db, $id);
}
function loadItem(PDO $db, string $id): array {
    $s = $db->prepare('SELECT * FROM content_items WHERE id = ?');
    $s->execute([$id]);
    return $s->fetch(PDO::FETCH_ASSOC);
}
function clipRows(PDO $db, string $itemId): array {
    $s = $db->prepare('SELECT * FROM content_video_clips WHERE item_id = ? ORDER BY created_at, scene_index');
    $s->execute([$itemId]);
    return $s->fetchAll(PDO::FETCH_ASSOC);
}

try {
// ═══════════════════ scene.id (งาน 3.4) ═══════════════════════════════════
$sc = _visualsToScenes([['visual' => 'ก', 'motion' => 'm'], ['visual' => 'ข', 'id' => 'sc_keepme'], 'Scene 3: ค']);
$ids = array_column($sc, 'id');
$pass = count($ids) === 3 && count(array_unique($ids)) === 3 && $ids[1] === 'sc_keepme' && str_starts_with($ids[0], 'sc_') && strlen($ids[0]) === 15;
record('VC01', '_visualsToScenes แจก id ไม่ซ้ำ และคง id เดิมของ visual', '3 id ไม่ซ้ำ, [1]=sc_keepme', implode(',', $ids), $pass); tally($pass);

$fixed = videoAssignSceneIds([['id' => 'sc_a'], ['id' => 'sc_a'], ['visual_prompt' => 'x']]);
$ids = array_column($fixed, 'id');
$pass = $ids[0] === 'sc_a' && $ids[1] !== 'sc_a' && $ids[2] !== '' && count(array_unique($ids)) === 3;
record('VC02', 'videoAssignSceneIds แก้ id ซ้ำ/ว่าง คง id แรก', 'sc_a, ใหม่, ใหม่', implode(',', $ids), $pass); tally($pass);

// ═══════════════════ snapshot / ล้าสมัย ═══════════════════════════════════
$item = ['video_aspect_ratio' => '9:16', 'video_resolution' => '720p'];
$scene = ['image_url' => '/a.jpg', 'video_prompt' => 'zoom', 'narration' => 'สวัสดี', 'duration_sec' => 8];
$snap = videoClipSnapshot($item, $scene, 'm1', ['durations' => [4, 6, 8]]);
$cases = [
    'ภาพฉากเปลี่ยน'       => [$scene + [], ['image_url' => '/b.jpg']],
    'Video Prompt เปลี่ยน' => [$scene, ['video_prompt' => 'pan']],
    'บทพากย์เปลี่ยน'       => [$scene, ['narration' => 'ลาก่อน']],
];
$got = [];
foreach ($cases as $label => [$base, $patch]) {
    $got[] = implode('', videoClipStaleReasons($snap, videoClipSnapshot($item, array_merge($base, $patch), 'm1', ['durations' => [8]])));
}
$got[] = implode('', videoClipStaleReasons($snap, videoClipSnapshot($item, $scene, 'm2', ['durations' => [8]])));
$got[] = implode('', videoClipStaleReasons($snap, videoClipSnapshot(['video_aspect_ratio' => '16:9', 'video_resolution' => '1080p'], $scene, 'm1', ['durations' => [8]])));
$pass = $got === ['ภาพฉากเปลี่ยน', 'Video Prompt เปลี่ยน', 'บทพากย์เปลี่ยน', 'model เปลี่ยน', 'อัตราส่วนเปลี่ยนความละเอียดเปลี่ยน'];
record('VC03', 'เหตุผลล้าสมัยรายฟิลด์ (ภาพ/prompt/บท/model/อัตราส่วน+ความละเอียด)', 'ครบ 5 กรณี', implode(' | ', $got), $pass); tally($pass);

$same = videoClipStaleReasons($snap, videoClipSnapshot($item, ['narration' => "  สวัสดี \n"] + $scene, 'm1', ['durations' => [8]]));
$mig  = videoClipStaleReasons($snap + ['migrated' => true], $snap);
$pass = $same === [] && $mig === [];
record('VC04', 'ช่องว่างหัวท้ายไม่นับ / key migrated ไม่นำมาเทียบ', '[] / []', json_encode([$same, $mig]), $pass); tally($pass);

// ═══════════════════ คลิปที่ใช้งาน / คำแนะนำล้มซ้ำ ════════════════════════
$c = fn(string $id, string $status, array $s) => ['id' => $id, 'status' => $status, 'input_snapshot' => $s, 'clip_url' => null, 'error' => null,
    'credits_estimated' => null, 'credits_actual' => null, 'created_at' => '', 'completed_at' => null];
$info = videoSceneClipInfo([$c('g1', 'done', $snap), $c('g2', 'failed', $snap)], $snap);
$info2 = videoSceneClipInfo([$c('g1', 'done', $snap), $c('g2', 'generating', $snap)], $snap);
$pass = $info['active']['id'] === 'g1' && $info2['active']['id'] === 'g1' && $info2['generating'] && !$info2['needs'];
record('VC05', 'generation ใหม่ที่ failed/generating ไม่แทนคลิปที่ใช้งาน', 'active=g1 ทั้งสอง, generating ไม่ต้องสร้าง', "{$info['active']['id']} / {$info2['active']['id']}", $pass); tally($pass);

$edited = array_merge($snap, ['video_prompt' => 'new']);
$h1 = videoSceneClipInfo([$c('a', 'failed', $snap), $c('b', 'failed', $snap)], $snap)['retry_hint'];
$h2 = videoSceneClipInfo([$c('a', 'failed', $snap), $c('b', 'failed', $snap)], $edited)['retry_hint'];
$h3 = videoSceneClipInfo([$c('a', 'failed', $snap), $c('b', 'failed', $edited)], $edited)['retry_hint'];
$pass = $h1 !== null && $h2 === null && $h3 === null;
record('VC06', 'คำแนะนำล้มซ้ำ: เฉพาะ 2 ครั้งติดด้วย input เดิม, แก้ข้อมูลแล้วนับใหม่', 'มี / ไม่มี / ไม่มี', json_encode([$h1 !== null, $h2 !== null, $h3 !== null]), $pass); tally($pass);

// ═══════════════════ credit ════════════════════════════════════════════════
$veo  = ['video' => ['price_unit' => 'per_clip', 'price_usd' => ['720p' => 0.15, '1080p' => 0.175], 'durations' => [4, 6, 8]]];
$sd15 = ['video' => ['price_unit' => 'per_second', 'price_usd' => ['720p' => 0.035, '1080p' => 0.075], 'durations' => ['min' => 4, 'max' => 12]]];
$cr = [videoClipCredits($veo, '720p'), videoClipCredits($veo, '1080p'), videoClipCredits($sd15, '720p'), videoClipCredits($sd15, '1080p'), videoClipCredits(['video' => []], '720p')];
$pass = $cr === [30, 35, 56, 120, null];
record('VC07', 'credit: Veo Lite 30/35, Seedance 1.5 Pro 8 วิ 56/120, ไม่มีราคา null', '30/35/56/120/null', json_encode($cr), $pass); tally($pass);

// ═══════════════════ ความพร้อม / URL สาธารณะ ═════════════════════════════
$r = [videoSceneReadiness(['id' => 'x', 'image_url' => '/a.jpg', 'image_gen_status' => 'done', 'video_prompt' => 'z'], 0),
      videoSceneReadiness(['id' => 'x', 'image_gen_status' => 'failed', 'video_prompt' => ''], 2),
      videoSceneReadiness(['image_url' => '/a.jpg', 'video_prompt' => 'z'], 0)];
$pass = $r[0] === [] && $r[1] === ['ฉาก 3 ยังไม่มีภาพ', 'ฉาก 3 ยังไม่มี Video Prompt'] && count($r[2]) === 1 && str_contains($r[2][0], 'รหัสฉาก');
record('VC08', 'ความพร้อมของฉาก (ภาพ/Video Prompt/ไม่มี id)', 'พร้อม / 2 เหตุผล / ไม่มีรหัสฉาก', json_encode($r, JSON_UNESCAPED_UNICODE), $pass); tally($pass);

$urls = ['http://localhost:8080' => false, 'http://127.0.0.1' => false, 'http://192.168.1.72' => false, 'http://10.0.0.5' => false,
         'http://172.20.1.1' => false, 'http://app.localhost' => false, 'https://platform.ktnbs.com' => true, 'https://abc.ngrok-free.app' => true];
$bad = [];
foreach ($urls as $u => $want) if (videoPublicUrlOk($u) !== $want) $bad[] = $u;
$pass = $bad === [];
record('VC09', 'URL สาธารณะ: ปฏิเสธ localhost/IP ภายใน', 'ไม่มีผิด', $bad ? implode(',', $bad) : 'ไม่มีผิด', $pass); tally($pass);

// ═══════════════════ เลือก model ═════════════════════════════════════════
$it = makeItem($db, 1);
$m1 = videoResolveModel($db, $it, $TENANT, false);
$db->prepare('UPDATE content_items SET video_model_id = ? WHERE id = ?')->execute([$SD2, $it['id']]);
$it = loadItem($db, $it['id']);
$m2 = videoResolveModel($db, $it, $TENANT, true); // seedance-2 ถูกปิด → default + บันทึก
$after = loadItem($db, $it['id'])['video_model_id'];
$err = '';
try { videoResolveModel($db, ['id' => 'x', 'video_model_id' => $SD2], 'tenant-not-exist', false); } catch (RuntimeException $e) { $err = $e->getMessage(); }
$default = $db->query("SELECT ai_content_video_model_id FROM company_settings WHERE tenant_id='tenant-default'")->fetchColumn();
$pass = $m1['id'] === $LITE && $m2['id'] === $default && $after === $default && str_contains($err, 'ยังไม่ได้เลือก model');
record('VC10', 'model: ใช้ของวิดีโอ / ถูกปิด → default + บันทึก / ไม่มีทั้งคู่ → error ไทย', 'lite / default / บันทึก / error', "{$m1['model_id']} / {$m2['model_id']} / " . ($after === $default ? 'บันทึก' : 'ไม่บันทึก') . " / {$err}", $pass); tally($pass);

// ═══════════════════ จองแบบ atomic ═══════════════════════════════════════
$it = makeItem($db, 1);
$sid = videoItemScenes($it)[0]['id'];
$a = videoReserveClip($db, $TENANT, $it['id'], $sid, 0, $snap, $LITE, 30);
$b = videoReserveClip($db, $TENANT, $it['id'], $sid, 0, $snap, $LITE, 30);
$pass = $a !== null && $b === null && count(clipRows($db, $it['id'])) === 1;
record('VC11', 'จองฉากซ้อน → ครั้งที่สองถูกปฏิเสธ (มีแถวเดียว)', 'id / null / 1 แถว', var_export($a !== null, true) . ' / ' . var_export($b, true) . ' / ' . count(clipRows($db, $it['id'])), $pass); tally($pass);

// ═══════════════════ generate-clips (mock submit) ════════════════════════
putenv('VITE_APP_URL=https://test.example.com');
$calls = [];
$okSubmit = function (array $model, array $req) use (&$calls) { $calls[] = $req; return 'task-' . count($calls); };

$it = makeItem($db, 4, [2 => ['video_prompt' => '']]); // ฉาก 3 ไม่พร้อม
$sids = array_column(videoItemScenes($it), 'id');
$res = videoGenerateClips($db, $it, $TENANT, [$sids[3], $sids[0], $sids[2], 'sc_not_exist'], $okSubmit);
$st = array_column($res['results'], 'status', 'scene_id');
$rows = clipRows($db, $it['id']);
$pass = $st[$sids[0]] === 'submitted' && $st[$sids[3]] === 'submitted' && $st[$sids[2]] === 'skipped' && $st['sc_not_exist'] === 'skipped'
    && !isset($st[$sids[1]]) && count($rows) === 2 && $rows[0]['job_id'] !== null && (int)$rows[0]['credits_estimated'] === 30
    && str_starts_with($calls[0]['image_url'], 'https://test.example.com/uploads/') && str_contains($calls[0]['prompt'], '"บท 0"');
record('VC12', 'ยิงเฉพาะ scene_ids ที่พร้อม (ข้ามไม่พร้อม/ไม่ใช่ Active) ไม่ยิงฉากที่ไม่ได้ยืนยัน', 'submitted 2 / skipped 2 / 2 แถว credit 30', json_encode($res['summary']) . ' แถว=' . count($rows), $pass); tally($pass);

$res2 = videoGenerateClips($db, loadItem($db, $it['id']), $TENANT, [$sids[0]], $okSubmit);
$pass = $res2['results'][0]['status'] === 'skipped' && str_contains($res2['results'][0]['reason'], 'กำลังสร้าง');
record('VC13', 'ฉากที่กำลังสร้างอยู่ → skipped ไม่ยิงซ้ำ', 'skipped กำลังสร้าง', $res2['results'][0]['status'] . ' ' . $res2['results'][0]['reason'], $pass); tally($pass);

$it = makeItem($db, 3);
$sids = array_column(videoItemScenes($it), 'id');
$n = 0;
$creditOut = function () use (&$n) {
    $n++;
    if ($n === 2) throw new KieVideoAccountException('Video API ไม่คืน taskId กลับ: Credits insufficient', 402);
    return 'task-ok-' . $n;
};
$res = videoGenerateClips($db, $it, $TENANT, $sids, $creditOut);
$st = array_column($res['results'], 'status');
$rows = clipRows($db, $it['id']);
$failed = array_values(array_filter($rows, fn($r) => $r['status'] === 'failed'))[0] ?? null;
$pass = $st === ['submitted', 'failed', 'skipped'] && $n === 2 && count($rows) === 2
    && $failed && (int)$failed['credits_estimated'] === 0 && (int)$failed['credits_actual'] === 0;
record('VC14', 'credit ไม่พอกลางทาง → ฉากนั้น failed credit 0/0, ฉากที่เหลือ skipped ไม่ยิง', 'submitted/failed/skipped, ยิง 2 ครั้ง', implode('/', $st) . " ยิง {$n} ครั้ง", $pass); tally($pass);

$it = makeItem($db, 2);
$sids = array_column(videoItemScenes($it), 'id');
$sceneErr = function (array $m, array $req) { if (str_contains($req['prompt'], 'motion 0')) throw new RuntimeException('prompt flagged'); return 'task-x'; };
$res = videoGenerateClips($db, $it, $TENANT, $sids, $sceneErr);
$pass = array_column($res['results'], 'status') === ['failed', 'submitted'];
record('VC15', 'error ระดับฉาก → ฉากนั้น failed แล้วยิงฉากถัดไปต่อ', 'failed/submitted', implode('/', array_column($res['results'], 'status')), $pass); tally($pass);

putenv('VITE_APP_URL=http://localhost:8080');
$res = videoGenerateClips($db, $it, $TENANT, $sids, $okSubmit);
$pass = $res['summary']['skipped'] === 2 && $res['summary']['submitted'] === 0;
record('VC16', 'URL เป็น localhost → ไม่ยิงเลย', 'skipped 2', json_encode($res['summary']), $pass); tally($pass);
putenv('VITE_APP_URL=https://test.example.com');

// ═══════════════════ poll ทีละคลิป + conditional update ════════════════════
$it = makeItem($db, 1);
$sid = videoItemScenes($it)[0]['id'];
videoGenerateClips($db, $it, $TENANT, [$sid], $okSubmit);
$clip = clipRows($db, $it['id'])[0];
$pollOk = fn() => ['status' => 'success', 'url' => 'https://cdn/x.mp4', 'error' => null, 'credits' => 56];
$s1 = videoClipPollOne($db, $clip, 5, $pollOk, fn() => '/uploads/content/videos/first.mp4');
$s2 = videoClipPollOne($db, $clip, 5, $pollOk, fn() => '/uploads/content/videos/second.mp4'); // สำเนาเก่า (ยัง generating)
$row = clipRows($db, $it['id'])[0];
$pass = $s1 === 'done' && $row['status'] === 'done' && $row['clip_url'] === '/uploads/content/videos/first.mp4' && (int)$row['credits_actual'] === 56 && $row['completed_at'] !== null;
record('VC17', 'poll สำเร็จ → done + credits_actual; poll ซ้ำจากสำเนาเก่าไม่ทับ (conditional update)', 'first.mp4 / 56', "{$s1}/{$s2} {$row['clip_url']} {$row['credits_actual']}", $pass); tally($pass);

$it = makeItem($db, 1);
videoGenerateClips($db, $it, $TENANT, [videoItemScenes($it)[0]['id']], $okSubmit);
$clip = clipRows($db, $it['id'])[0];
$s = videoClipPollOne($db, $clip, 5, fn() => ['status' => 'success', 'url' => 'u', 'error' => null], fn() => null);
$row = clipRows($db, $it['id'])[0];
$s3 = videoClipPollOne($db, $clip, 5, fn() => ['status' => 'failed', 'url' => null, 'error' => 'nsfw'], fn() => null);
$row3 = clipRows($db, $it['id'])[0];
$pass = $s === 'generating' && $row['status'] === 'generating' && $s3 === 'failed' && $row3['status'] === 'failed' && $row3['error'] === 'nsfw';
record('VC18', 'ดาวน์โหลดไม่ครบ → ยังคง generating / kie ล้ม → failed + error', 'generating / failed nsfw', "{$s}/{$row['status']} → {$row3['status']} {$row3['error']}", $pass); tally($pass);

// ═══════════════════ cron video-clips-sync ═══════════════════════════════
$it = makeItem($db, 3);
$sids = array_column(videoItemScenes($it), 'id');
$snapC = videoClipSnapshot($it, videoItemScenes($it)[0], $LITE);
$orphan  = videoReserveClip($db, $TENANT, $it['id'], $sids[0], 0, $snapC, $LITE, 30);
$old     = videoReserveClip($db, $TENANT, $it['id'], $sids[1], 1, $snapC, $LITE, 30);
$fresh   = videoReserveClip($db, $TENANT, $it['id'], $sids[2], 2, $snapC, $LITE, 30);
$db->prepare("UPDATE content_video_clips SET created_at = NOW() - INTERVAL 11 MINUTE WHERE id = ?")->execute([$orphan]);
$db->prepare("UPDATE content_video_clips SET job_id = 'old-job', created_at = NOW() - INTERVAL 125 MINUTE WHERE id = ?")->execute([$old]);
$db->prepare("UPDATE content_video_clips SET job_id = 'fresh-job' WHERE id = ?")->execute([$fresh]);
$combId = generateUUID();
$db->prepare("INSERT INTO content_video_combines (id, tenant_id, item_id, status, source_clips, created_at, updated_at)
              VALUES (?, ?, ?, 'combining', '[]', NOW() - INTERVAL 11 MINUTE, NOW())")->execute([$combId, $TENANT, $it['id']]);
$res = videoClipsSyncRun($db, 40, 30, fn() => ['status' => 'generating', 'url' => null, 'error' => null], fn() => null);
$byId = array_column(clipRows($db, $it['id']), null, 'id');
$combStatus = $db->query("SELECT status FROM content_video_combines WHERE id = " . $db->quote($combId))->fetchColumn();
$pass = $byId[$orphan]['status'] === 'failed' && $byId[$orphan]['error'] === 'ส่งงานไม่สำเร็จ' && (int)$byId[$orphan]['credits_estimated'] === 0
    && $byId[$old]['status'] === 'failed' && $byId[$old]['error'] === 'หมดเวลา'
    && $byId[$fresh]['status'] === 'generating' && $combStatus === 'failed'
    && $res['orphaned'] >= 1 && $res['timed_out'] >= 1 && $res['stale_combines'] >= 1;
record('VC19', 'cron เก็บงานค้าง: จองไม่มี job > 10 นาที / job > 2 ชม. / รวมค้าง > 10 นาที', 'failed ส่งงานไม่สำเร็จ / หมดเวลา / รวม failed / ใหม่ยัง generating',
    "{$byId[$orphan]['error']} / {$byId[$old]['error']} / {$combStatus} / {$byId[$fresh]['status']}", $pass); tally($pass);

// จำกัด 30 คลิปต่อรอบ เรียงเก่า→ใหม่
$it = makeItem($db, 1);
$sid = videoItemScenes($it)[0]['id'];
// เคลียร์คลิป generating ของ item ทดสอบเคสก่อนหน้า (เฉพาะที่เทสต์นี้สร้าง — ไม่แตะข้อมูลอื่น)
$db->prepare("UPDATE content_video_clips SET status = 'failed' WHERE status = 'generating' AND item_id IN ("
    . implode(',', array_fill(0, count($CREATED) - 1, '?')) . ')')->execute(array_slice($CREATED, 0, -1));
$otherGenerating = (int)$db->query("SELECT COUNT(*) FROM content_video_clips WHERE status = 'generating'")->fetchColumn();
if ($otherGenerating > 0) echo "⚠️ มีคลิป generating ของข้อมูลจริง {$otherGenerating} แถว — VC20 อาจนับรวม (cron ครอบคลุมทุก tenant)\n";
for ($i = 0; $i < 35; $i++) {
    $db->prepare("INSERT INTO content_video_clips (id, tenant_id, item_id, scene_id, scene_index, model_id, job_id, status, input_snapshot, created_at, updated_at)
                  VALUES (?, ?, ?, ?, 0, ?, ?, 'generating', '{}', NOW() - INTERVAL ? SECOND, NOW())")
       ->execute([generateUUID(), $TENANT, $it['id'], $sid, $LITE, 'job-' . $i, 100 - $i]);
}
$polled = [];
$res = videoClipsSyncRun($db, 40, 30, function ($m, $task) use (&$polled) { $polled[] = $task; return ['status' => 'generating', 'url' => null, 'error' => null]; }, fn() => null);
$pass = $res['polled'] === 30 && $polled[0] === 'job-0' && $polled[29] === 'job-29';
record('VC20', 'cron poll ไม่เกิน 30 คลิป เรียงจากเก่าสุด', '30 คลิป job-0 → job-29', $res['polled'] . ' คลิป ' . ($polled[0] ?? '-') . ' → ' . ($polled[29] ?? '-'), $pass); tally($pass);

} finally {
    // content_video_clips / content_video_combines ลบตาม ON DELETE CASCADE
    foreach ($CREATED as $id) $db->prepare('DELETE FROM content_items WHERE id = ?')->execute([$id]);
}

// ═══════════════════ Output ════════════════════════════════════════════════
echo "\n| TC | Test Case | Expected | Actual | PASS/FAIL |\n|----|-----------|----------|--------|-----------|\n";
foreach ($RESULTS as [$tc, $name, $expected, $actual, $pass]) {
    echo "| {$tc} | {$name} | {$expected} | " . mb_substr($actual, 0, 160) . ' | ' . ($pass ? 'PASS' : 'FAIL') . " |\n";
}
echo "\nผ่าน: {$PASS} / " . count($RESULTS) . "\nไม่ผ่าน: {$FAIL} / " . count($RESULTS) . "\n";
if ($FAIL > 0) { echo "\nRESULT: FAIL\n"; exit(1); }
echo "\nRESULT: PASS\n";
