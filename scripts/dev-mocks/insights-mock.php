<?php
/**
 * Mock Graph API สำหรับทดสอบชั้นดึง insights ในเครื่อง — ไม่มี traffic ไป graph.facebook.com
 *
 * ใช้เป็นค่า GRAPH_API_BASE ตอนทดสอบ:
 *   http://localhost/flowstack/scripts/dev-mocks/insights-mock.php
 *
 * รูป URL ที่รองรับ (insights-fetch.php ต่อ path เอง):
 *   {base}/{post_id}/insights?metric=...&access_token=...   → รูป response ของ Facebook
 *   {base}/{media_id}?fields=...&access_token=...            → รูป response ของ Instagram
 *
 * ตัวเลขที่ตอบกลับ "เขียนไว้ใน id โพสต์" เพื่อให้ทดสอบยืนยันค่าได้แบบไม่ต้องเก็บ state:
 *   ..._v<views>_l<likes>   เช่น mockfb_v120_l7 → views 120, likes 7
 *   id ที่มีคำว่า err500    → ตอบ HTTP 500 (ใช้ทดสอบการนับ error)
 *   id ที่มีคำว่า deadvv    → แกล้งว่า metric post_video_views ถูกยกเลิก (error code 100)
 *                             ใช้ทดสอบทางถอยที่ยิง metric แยกทีละตัว
 *   ไม่มีรูปแบบ v/l         → 0 ทั้งคู่
 *
 * ฝั่ง Facebook: mock ยอมรับเฉพาะชื่อ metric ที่ Graph API จริงยังรับ
 * (post_video_views, post_reactions_by_type_total, post_clicks) ชื่ออื่นตอบ
 * "(#100) The value must be a valid insights metric" เหมือนของจริง
 *
 * ไฟล์ hit log อยู่ใน temp dir ของระบบ (ไม่เขียนลง repo) — ใช้พิสูจน์ว่า
 * "มี/ไม่มี request ออกไปจริง" สำหรับ id ไหน:
 *   sys_get_temp_dir()/flowstack-insights-mock-hits.log
 *
 * ไม่แตะฐานข้อมูล ไม่ต้อง auth — เป็นเครื่องมือทดสอบเท่านั้น
 */

$path    = trim((string) ($_SERVER['PATH_INFO'] ?? ''), '/');
$isFb    = str_ends_with($path, '/insights');
$postId  = $isFb ? substr($path, 0, -strlen('/insights')) : $path;

@file_put_contents(
    sys_get_temp_dir() . '/flowstack-insights-mock-hits.log',
    sprintf("%s\t%s\t%s\t%s\n", date('c'), $isFb ? 'facebook' : 'instagram', $postId,
        (string) ($_GET['metric'] ?? '')),
    FILE_APPEND
);

header('Content-Type: application/json; charset=utf-8');

if ($postId === '') {
    http_response_code(400);
    echo json_encode(['error' => ['message' => 'mock: ไม่ได้ระบุ id โพสต์ใน path']], JSON_UNESCAPED_UNICODE);
    return;
}

if (str_contains($postId, 'err500')) {
    http_response_code(500);
    echo json_encode(['error' => ['message' => 'mock: พังตามที่สั่ง']], JSON_UNESCAPED_UNICODE);
    return;
}

$views = preg_match('/_v(\d+)/', $postId, $m) ? (int) $m[1] : 0;
$likes = preg_match('/_l(\d+)/', $postId, $m) ? (int) $m[1] : 0;

if ($isFb) {
    // metric ที่ Graph API จริงยอมรับสำหรับโพสต์เพจ (ตรวจกับเพจจริง 21 ส.ค. 2026)
    // mock ปฏิเสธชื่ออื่นด้วย error code 100 แบบเดียวกับของจริง เพื่อให้ชุดทดสอบจับได้
    // ทันทีถ้าโค้ดกลับไปขอ metric ที่ตายแล้ว (เช่น post_impressions)
    $supported = ['post_video_views', 'post_reactions_by_type_total', 'post_clicks'];
    // id ที่มีคำว่า deadvv → แกล้งว่า post_video_views ถูกยกเลิก
    // ใช้ทดสอบทางถอย (ยิงแยกทีละ metric) ของ _insights_fb_metrics()
    if (str_contains($postId, 'deadvv')) {
        $supported = array_values(array_diff($supported, ['post_video_views']));
    }

    $requested = array_filter(array_map('trim', explode(',', (string) ($_GET['metric'] ?? ''))));
    $invalid   = array_diff($requested, $supported);
    if ($requested === [] || $invalid !== []) {
        http_response_code(400);
        echo json_encode(['error' => [
            'message' => '(#100) The value must be a valid insights metric',
            'type'    => 'OAuthException',
            'code'    => 100,
        ]], JSON_UNESCAPED_UNICODE);
        return;
    }

    // รูปเดียวกับ Graph API: ตอบเฉพาะ metric ที่ขอ, reaction แยกชนิด (insights-fetch ต้องรวมเอง)
    $values = [
        'post_video_views'             => $views,
        'post_reactions_by_type_total' => ['like' => $likes, 'love' => 0],
        'post_clicks'                  => 0,
    ];
    $data = [];
    foreach ($requested as $metric) {
        $data[] = ['name' => $metric, 'period' => 'lifetime', 'values' => [['value' => $values[$metric]]]];
    }
    echo json_encode(['data' => $data], JSON_UNESCAPED_UNICODE);
    return;
}

echo json_encode([
    'id'             => $postId,
    'like_count'     => $likes,
    'comments_count' => 0,
    'insights'       => ['data' => [['name' => 'impressions', 'values' => [['value' => $views]]]]],
], JSON_UNESCAPED_UNICODE);
