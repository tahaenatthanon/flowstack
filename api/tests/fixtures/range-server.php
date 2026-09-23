<?php
// router สำหรับ `php -S 127.0.0.1:<port> range-server.php` — ใช้เฉพาะ api/tests/kie-video-adapter-test.php
// จำลอง CDN ของ kie: ?f=<ไฟล์ใน temp dir>&mode=range|norange|slow
//   range   = รองรับ Range (206 + Content-Range) เหมือน tempfile.aiquickdraw.com
//   norange = ไม่สนใจ Range ส่ง 200 ทั้งไฟล์เสมอ
//   slow    = รองรับ Range แต่ส่งทีละ 16KB เว้น 200ms (ให้ timeout กลางทางได้)
$file = realpath((string)($_GET['f'] ?? ''));
$tmp  = realpath(sys_get_temp_dir());
if ($file === false || !str_starts_with($file, $tmp) || !is_file($file)) { http_response_code(404); exit; }

$mode  = (string)($_GET['mode'] ?? 'range');
$size  = filesize($file);
$start = 0;
if ($mode !== 'norange' && preg_match('/bytes=(\d+)-/', $_SERVER['HTTP_RANGE'] ?? '', $m)) {
    $start = (int)$m[1];
    if ($start >= $size) {
        http_response_code(416);
        header('Content-Range: bytes */' . $size);
        exit;
    }
    http_response_code(206);
    header('Content-Range: bytes ' . $start . '-' . ($size - 1) . '/' . $size);
}
header('Content-Type: video/mp4');
header('Accept-Ranges: ' . ($mode === 'norange' ? 'none' : 'bytes'));
header('Content-Length: ' . ($size - $start));

$fh = fopen($file, 'rb');
fseek($fh, $start);
while (!feof($fh)) {
    echo fread($fh, 16384);
    flush();
    if ($mode === 'slow') usleep(200000);
}
fclose($fh);
