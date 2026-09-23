<?php
/**
 * รวมคลิปรายฉากเป็นวิดีโอเดียวด้วย ffmpeg (multi-clip-video)
 *
 * ขั้นตอน (ทดสอบบน local ด้วย ffmpeg 9.0.2 — design.md ข้อ 8):
 *   1. ffprobe ความยาวภาพ + ตรวจว่ามีแทร็กเสียงไหม
 *   2. ปรับเสียงทุกคลิปเป็น AAC 48kHz stereo ตัด/เติมให้ยาวเท่าภาพ (ไม่มีเสียง → ใส่เสียงเงียบ) — ภาพ copy
 *   3. concat แบบ copy ตัดชน + faststart (moov ต้นไฟล์ เล่นบนเว็บได้ทันที)
 * path ทุกตัวมาจากระบบและผ่าน escapeshellarg — ไม่รับ path จากผู้ใช้
 */

require_once __DIR__ . '/video-clips.php';

class VideoCombineException extends RuntimeException {
    public function __construct(string $message, public readonly int $httpCode = 422, public readonly array $reasons = []) {
        parent::__construct($message);
    }
}

// ── ffmpeg ──────────────────────────────────────────────────────────────────

/** @return array{0: string, 1: string} [ffmpeg, ffprobe] — FFMPEG_PATH/FFPROBE_PATH ใน .env หรือชื่อเปล่าจาก PATH */
function videoFfmpegBinaries(): array {
    $env = fn(string $k) => trim((string)(getenv($k) ?: ($_ENV[$k] ?? '')));
    return [$env('FFMPEG_PATH') ?: 'ffmpeg', $env('FFPROBE_PATH') ?: 'ffprobe'];
}

/** รันคำสั่ง (แต่ละ argument ผ่าน escapeshellarg) คืน [exit code, output รวม stderr] */
function videoExec(array $args): array {
    $cmd = implode(' ', array_map('escapeshellarg', $args)) . ' 2>&1';
    $out = [];
    $code = -1;
    exec($cmd, $out, $code);
    return [$code, $out];
}

/** ตรวจทุกครั้ง (ไม่ cache): exec ใช้ได้ และ ffmpeg + ffprobe รันได้ */
function videoFfmpegAvailable(): bool {
    if (!function_exists('exec')) return false;
    $disabled = array_map('trim', explode(',', (string)ini_get('disable_functions')));
    if (in_array('exec', $disabled, true)) return false;
    [$ffmpeg, $ffprobe] = videoFfmpegBinaries();
    foreach ([$ffmpeg, $ffprobe] as $bin) {
        [$code] = videoExec([$bin, '-hide_banner', '-version']);
        if ($code !== 0) return false;
    }
    return true;
}

/**
 * รวมคลิปตามลำดับ
 * @param string[] $clipPaths path บนดิสก์ เรียงตามฉาก
 * @return array{ok: bool, error: ?string}
 */
function videoCombineClips(string $ffmpeg, string $ffprobe, array $clipPaths, string $outPath): array {
    $tmp = sys_get_temp_dir() . '/flowstack-combine-' . bin2hex(random_bytes(6));
    if (!mkdir($tmp, 0700, true)) return ['ok' => false, 'error' => 'สร้างโฟลเดอร์ชั่วคราวไม่ได้'];
    $fail = fn(string $step, array $out) => ['ok' => false, 'error' => $step . ': ' . implode(' | ', array_slice($out, -5))];
    try {
        $list = [];
        foreach (array_values($clipPaths) as $i => $clip) {
            [$c, $out] = videoExec([$ffprobe, '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=duration', '-of', 'csv=p=0', $clip]);
            $vd = (float)($out[0] ?? 0);
            if ($c !== 0 || $vd <= 0) {
                [$c, $out] = videoExec([$ffprobe, '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', $clip]);
                $vd = (float)($out[0] ?? 0);
                if ($c !== 0 || $vd <= 0) return $fail('อ่านความยาวคลิปที่ ' . ($i + 1) . ' ไม่ได้', $out);
            }
            [, $aOut] = videoExec([$ffprobe, '-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=index', '-of', 'csv=p=0', $clip]);
            $hasAudio = trim(implode('', $aOut)) !== '';
            $norm = $tmp . '/norm' . $i . '.mp4';
            $t = sprintf('%.3F', $vd);
            $args = $hasAudio
                ? [$ffmpeg, '-v', 'error', '-y', '-i', $clip, '-map', '0:v:0', '-map', '0:a:0', '-c:v', 'copy',
                   '-af', 'aresample=48000,apad', '-t', $t, '-c:a', 'aac', '-ar', '48000', '-ac', '2', $norm]
                : [$ffmpeg, '-v', 'error', '-y', '-i', $clip, '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo',
                   '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-t', $t, '-c:a', 'aac', '-ar', '48000', '-ac', '2', $norm];
            [$c, $out] = videoExec($args);
            if ($c !== 0 || !is_file($norm)) return $fail('ปรับเสียงคลิปที่ ' . ($i + 1) . ' ไม่สำเร็จ', $out);
            $list[] = "file '" . str_replace("'", "'\\''", str_replace('\\', '/', $norm)) . "'";
        }
        $listFile = $tmp . '/list.txt';
        file_put_contents($listFile, implode("\n", $list) . "\n");
        $partOut = $outPath . '.part.mp4';
        [$c, $out] = videoExec([$ffmpeg, '-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', $listFile,
                                '-c', 'copy', '-movflags', '+faststart', $partOut]);
        if ($c !== 0 || !is_file($partOut) || filesize($partOut) <= 0) {
            @unlink($partOut);
            return $fail('ต่อคลิปไม่สำเร็จ', $out);
        }
        if (!rename($partOut, $outPath)) { @unlink($partOut); return ['ok' => false, 'error' => 'บันทึกไฟล์วิดีโอรวมไม่ได้']; }
        return ['ok' => true, 'error' => null];
    } finally {
        foreach (glob($tmp . '/*') ?: [] as $f) @unlink($f);
        @rmdir($tmp);
    }
}

// ── สถานะวิดีโอรวม ───────────────────────────────────────────────────────────

/** แถว content_video_combines ของ item (เก่า→ใหม่) พร้อม flag combining_live ที่คำนวณด้วยนาฬิกาของ DB */
function videoLoadCombines(PDO $db, string $tenantId, array $itemIds): array {
    if ($itemIds === []) return [];
    $in = implode(',', array_fill(0, count($itemIds), '?'));
    $stmt = $db->prepare("SELECT *, (status = 'combining' AND created_at > NOW() - INTERVAL " . VIDEO_RESERVE_TTL_MINUTES . " MINUTE) AS combining_live
                          FROM content_video_combines WHERE tenant_id = ? AND item_id IN ($in) ORDER BY created_at ASC, id ASC");
    $stmt->execute(array_merge([$tenantId], array_values($itemIds)));
    $out = [];
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $row['source_clips'] = json_decode((string)$row['source_clips'], true) ?: [];
        $out[$row['item_id']][] = $row;
    }
    return $out;
}

/** เหตุผลที่วิดีโอรวมล้าสมัย เทียบ source_clips กับสถานะฉากปัจจุบัน (ว่าง = ไม่ล้าสมัย) */
function videoCombineStaleReasons(array $sourceClips, array $sceneStates): array {
    $srcIds = array_map(fn($s) => (string)($s['scene_id'] ?? ''), $sourceClips);
    $curIds = array_map(fn($s) => (string)$s['scene_id'], $sceneStates);
    if ($srcIds !== $curIds) return ['ฉากเปลี่ยน — สคริปต์ถูกเขียนใหม่หรือจำนวนฉากเปลี่ยน'];
    $reasons = [];
    foreach ($sceneStates as $i => $s) {
        $n = $s['index'] + 1;
        $active = $s['active_clip'];
        $srcClip = (string)($sourceClips[$i]['clip_id'] ?? '');
        if ($active && $active['id'] !== $srcClip) $reasons[] = "ฉาก {$n} มีคลิปใหม่";
        elseif ($s['stale']) $reasons[] = "ฉาก {$n} ล้าสมัย (" . implode(', ', $s['stale_reasons']) . ')';
    }
    return $reasons;
}

/** เหตุผลที่ยังรวมไม่ได้ตามสถานะฉาก (ไม่รวมเรื่อง ffmpeg / การจอง) */
function videoCombineSceneReasons(array $sceneStates): array {
    if ($sceneStates === []) return ['ยังไม่มีฉาก'];
    $reasons = [];
    foreach ($sceneStates as $s) {
        $n = $s['index'] + 1;
        if ($s['generating'])            $reasons[] = "ฉาก {$n} กำลังสร้าง";
        elseif (!$s['active_clip'])      $reasons[] = "ฉาก {$n} ยังไม่มีคลิป";
        elseif ($s['stale'])             $reasons[] = "ฉาก {$n} ล้าสมัย (" . implode(', ', $s['stale_reasons']) . ')';
    }
    return $reasons;
}

function videoCombineState(PDO $db, array $item, string $tenantId, array $sceneStates, ?array $combines = null, bool $checkFfmpeg = true): array {
    $combines ??= videoLoadCombines($db, $tenantId, [$item['id']])[$item['id']] ?? [];
    $latestDone = null; $combining = false; $lastFailed = null;
    foreach ($combines as $c) {
        if ($c['status'] === 'done') { $latestDone = $c; $lastFailed = null; }
        elseif ($c['status'] === 'failed') $lastFailed = $c;
        if (!empty($c['combining_live'])) $combining = true;
    }
    $ffmpegOk = $checkFfmpeg ? videoFfmpegAvailable() : null;

    $reasons = videoCombineSceneReasons($sceneStates);
    if ($ffmpegOk === false) $reasons[] = 'เซิร์ฟเวอร์ยังไม่รองรับการรวมคลิป (ไม่พบ ffmpeg) — ดูคลิปต่อกันแทนได้';
    if ($combining) $reasons[] = 'กำลังรวมวิดีโออยู่';

    $staleReasons = $latestDone ? videoCombineStaleReasons($latestDone['source_clips'], $sceneStates) : [];
    return [
        'can_combine' => $reasons === [],
        'reasons'     => $reasons,
        'ffmpeg_ok'   => $ffmpegOk,
        'combining'   => $combining,
        'latest'      => $latestDone ? [
            'id'            => $latestDone['id'],
            'video_url'     => $latestDone['video_url'],
            'created_at'    => $latestDone['created_at'],
            'stale'         => $staleReasons !== [],
            'stale_reasons' => $staleReasons,
        ] : null,
        'last_failed' => $lastFailed ? ['error' => $lastFailed['error'], 'created_at' => $lastFailed['created_at']] : null,
    ];
}

// ── รวม (action combine-video) ──────────────────────────────────────────────

/**
 * @param ?callable $combiner fn(string $ffmpeg, string $ffprobe, array $clipPaths, string $outPath): array — mock ได้
 * @throws VideoCombineException 422 (ยังรวมไม่ได้) / 409 (กำลังรวมอยู่) / 500 (ffmpeg ล้ม)
 */
function videoRunCombine(PDO $db, array $item, string $tenantId, ?callable $combiner = null, ?string $outDir = null): array {
    $combiner ??= 'videoCombineClips';
    $outDir ??= __DIR__ . '/../../uploads/content/videos';

    $state = videoItemState($db, $item, $tenantId, null, null, false);
    $reasons = videoCombineSceneReasons($state['scenes']);
    if (!videoFfmpegAvailable()) $reasons[] = 'เซิร์ฟเวอร์ยังไม่รองรับการรวมคลิป (ไม่พบ ffmpeg)';
    if ($reasons !== []) throw new VideoCombineException('ยังรวมวิดีโอไม่ได้', 422, $reasons);

    $sourceClips = []; $paths = [];
    $root = realpath(__DIR__ . '/../..');
    foreach ($state['scenes'] as $s) {
        $url = (string)$s['active_clip']['clip_url'];
        $path = $url !== '' && str_starts_with($url, '/uploads/content/videos/') ? realpath($root . $url) : false;
        if ($path === false || !is_file($path)) {
            throw new VideoCombineException('ยังรวมวิดีโอไม่ได้', 422, ['ฉาก ' . ($s['index'] + 1) . ' ไม่พบไฟล์คลิป']);
        }
        $paths[] = $path;
        $sourceClips[] = ['scene_id' => $s['scene_id'], 'scene_index' => $s['index'], 'clip_id' => $s['active_clip']['id']];
    }

    // จองแบบ atomic — กันรวมซ้อนจากหลายแท็บ/ดับเบิลคลิก
    $db->beginTransaction();
    try {
        $lock = $db->prepare('SELECT id FROM content_items WHERE id = ? AND tenant_id = ? FOR UPDATE');
        $lock->execute([$item['id'], $tenantId]);
        $busy = $db->prepare("SELECT COUNT(*) FROM content_video_combines WHERE item_id = ? AND status = 'combining'
                              AND created_at > NOW() - INTERVAL " . VIDEO_RESERVE_TTL_MINUTES . " MINUTE");
        $busy->execute([$item['id']]);
        if ((int)$busy->fetchColumn() > 0) {
            $db->rollBack();
            throw new VideoCombineException('กำลังรวมวิดีโออยู่', 409);
        }
        $combineId = generateUUID();
        $db->prepare("INSERT INTO content_video_combines (id, tenant_id, item_id, status, source_clips, created_at, updated_at)
                      VALUES (?, ?, ?, 'combining', ?, NOW(), NOW())")
           ->execute([$combineId, $tenantId, $item['id'], json_encode($sourceClips, JSON_UNESCAPED_UNICODE)]);
        $db->commit();
    } catch (VideoCombineException $e) {
        throw $e;
    } catch (Throwable $e) {
        if ($db->inTransaction()) $db->rollBack();
        throw $e;
    }

    set_time_limit(0);
    ignore_user_abort(true);
    if (!is_dir($outDir)) @mkdir($outDir, 0755, true);
    $name = preg_replace('/[^A-Za-z0-9_-]/', '', $item['id']) . '_combined_' . date('YmdHis') . '_' . bin2hex(random_bytes(3)) . '.mp4';
    [$ffmpeg, $ffprobe] = videoFfmpegBinaries();
    $res = $combiner($ffmpeg, $ffprobe, $paths, $outDir . '/' . $name);

    if (!$res['ok']) {
        $db->prepare("UPDATE content_video_combines SET status = 'failed', error = ?, completed_at = NOW(), updated_at = NOW()
                      WHERE id = ? AND status = 'combining'")
           ->execute([mb_substr((string)$res['error'], 0, 2000), $combineId]);
        error_log('[video-combine] failed | item=' . $item['id'] . ' | ' . $res['error']);
        throw new VideoCombineException('รวมวิดีโอไม่สำเร็จ: ' . $res['error'], 500);
    }

    $url = '/uploads/content/videos/' . $name;
    $upd = $db->prepare("UPDATE content_video_combines SET status = 'done', video_url = ?, completed_at = NOW(), updated_at = NOW()
                         WHERE id = ? AND status = 'combining'");
    $upd->execute([$url, $combineId]);
    if ($upd->rowCount() === 0) {
        // cron ตีว่าหมดอายุไปแล้ว (รวมนานเกิน 10 นาที) — ไม่ชี้ video_url ไปยังผลของการจองที่ถูกยกเลิก
        throw new VideoCombineException('รวมวิดีโอนานเกินกำหนด — กรุณาลองใหม่', 500);
    }
    $db->prepare("UPDATE content_items SET video_url = ?, video_gen_status = 'done', updated_at = NOW() WHERE id = ? AND tenant_id = ?")
       ->execute([$url, $item['id'], $tenantId]);
    return ['status' => 'done', 'video_url' => $url, 'combine_id' => $combineId];
}
