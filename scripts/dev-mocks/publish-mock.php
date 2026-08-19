<?php
/**
 * Mock ปลายทางเผยแพร่ — ใช้ทดสอบชั้น dispatch ในเครื่อง โดยไม่มี traffic ไป production
 *
 * ใช้งาน:
 *   http://localhost/flowstack/scripts/dev-mocks/publish-mock.php?code=500
 *   http://localhost/flowstack/scripts/dev-mocks/publish-mock.php?code=200&tag=t1
 *
 * พารามิเตอร์:
 *   code : HTTP status ที่จะตอบกลับ (ค่าเริ่มต้น 200)
 *   tag  : ป้ายกำกับที่จะถูกบันทึกลงไฟล์ hit log — ใช้พิสูจน์ว่า "มี/ไม่มี request ออกไปจริง"
 *   body : ข้อความที่จะใส่ในเนื้อ response
 *
 * ไฟล์ hit log อยู่ใน temp dir ของระบบ (ไม่เขียนลง repo):
 *   sys_get_temp_dir()/flowstack-publish-mock-hits.log
 *
 * ไม่แตะฐานข้อมูล ไม่ต้อง auth — เป็นเครื่องมือทดสอบเท่านั้น
 */

$code = isset($_GET['code']) ? (int) $_GET['code'] : 200;
$tag  = isset($_GET['tag'])  ? (string) $_GET['tag'] : '';
$msg  = isset($_GET['body']) ? (string) $_GET['body'] : '';

$raw = file_get_contents('php://input');

if ($tag !== '') {
    $line = sprintf("%s\t%s\t%d\t%d bytes\n", date('c'), $tag, $code, strlen((string) $raw));
    @file_put_contents(sys_get_temp_dir() . '/flowstack-publish-mock-hits.log', $line, FILE_APPEND);
}

http_response_code($code);
header('Content-Type: application/json; charset=utf-8');
echo json_encode([
    'mock'           => true,
    'status'         => $code,
    'message'        => $msg !== '' ? $msg : ($code >= 400 ? 'mock ตอบผิดพลาดตามที่สั่ง' : 'mock รับเอกสารแล้ว'),
    'received_bytes' => strlen((string) $raw),
], JSON_UNESCAPED_UNICODE);
