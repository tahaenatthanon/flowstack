# publish-dispatch-response-capture Specification

## Purpose

กำหนดให้ `dispatch_lotusdomino()` เชื่อผล HTTP status (ล้มเหลวเมื่อ >= 400) และบันทึก response body ลงคอลัมน์ใหม่ `content_publish_queue.response_snippet` ทุกครั้งที่ dispatch ทั้งสำเร็จและล้มเหลว

## Requirements

### Requirement: dispatch_lotusdomino ล้มเหลวเมื่อปลายทางตอบ HTTP >= 400
`dispatch_lotusdomino()` SHALL คืน `success=false` เมื่อปลายทางตอบด้วย HTTP status code >= 400 และ SHALL ไม่พลิกผลลัพธ์ที่ `_dispatch_post()` ตัดสินว่าล้มเหลวกลับเป็นสำเร็จ ข้อความ error SHALL ระบุ HTTP status code และเนื้อความจาก response body เพื่อให้วินิจฉัยได้จาก `error_msg` เพียงคอลัมน์เดียว

หมายเหตุ: platform อื่นที่ผ่าน `_dispatch_post()` เชื่อ HTTP status อยู่แล้ว requirement นี้จึงมีผลกับ `dispatch_lotusdomino()` ซึ่งเป็นตัวเดียวที่พลิกค่า

#### Scenario: ปลายทางตอบ 500 ถือว่าล้มเหลว
- **WHEN** `dispatch_lotusdomino()` POST แล้วปลายทางตอบ HTTP 500
- **THEN** คืน `['success' => false, ...]`
- **AND** `error` มีเลข HTTP status code (`500`) ปรากฏอยู่

#### Scenario: ปลายทางตอบ 404 ถือว่าล้มเหลว
- **WHEN** `dispatch_lotusdomino()` POST แล้วปลายทางตอบ HTTP 404
- **THEN** คืน `['success' => false, ...]` และไม่มี `platform_post_id`

#### Scenario: ปลายทางตอบ 200 ถือว่าสำเร็จ
- **WHEN** `dispatch_lotusdomino()` POST แล้วปลายทางตอบ HTTP 200
- **THEN** คืน `['success' => true, ...]` พร้อม `platform_post_id` ที่ไม่ว่าง

#### Scenario: cURL error ถือว่าล้มเหลว
- **WHEN** `dispatch_lotusdomino()` เจอ cURL error (ต่อปลายทางไม่ได้)
- **THEN** คืน `['success' => false, 'error' => ...]` โดยข้อความ error แยกแยะได้ว่าเป็น cURL error ไม่ใช่ HTTP status

### Requirement: schema มีคอลัมน์เก็บ response body ของการ dispatch
ฐานข้อมูล SHALL มีคอลัมน์ `content_publish_queue.response_snippet TEXT NULL` สำหรับเก็บเนื้อ response ที่ปลายทางตอบกลับ

#### Scenario: migration เพิ่มคอลัมน์สำเร็จ
- **WHEN** migration ของ change นี้รันสำเร็จ
- **THEN** `SHOW COLUMNS FROM content_publish_queue` มีคอลัมน์ `response_snippet`

### Requirement: บันทึก response body ทุกครั้งที่ dispatch ไม่ว่าสำเร็จหรือล้มเหลว
ทั้ง `send_now` (`api/content-publish.php`) และ cron scheduler (`api/cron/publish-scheduler.php`) SHALL เขียนเนื้อ response ที่ได้จาก `dispatch_content()` ลง `content_publish_queue.response_snippet` ของแถวที่กำลังประมวลผล ทั้งกรณีสำเร็จและล้มเหลว โดยตัดความยาวไม่เกิน 2000 ตัวอักษร

เหตุผล: `status='sent'` เพียงอย่างเดียวพิสูจน์ไม่ได้ว่าปลายทางรับเอกสารจริง — ปลายทางอาจตอบ HTTP 200 พร้อมข้อความ error ในเนื้อ response

#### Scenario: send_now สำเร็จก็ยังเก็บ response
- **WHEN** `send_now` dispatch สำเร็จ (`success=true`)
- **THEN** แถว `content_publish_queue` นั้นมี `status='sent'` และ `response_snippet` ไม่เป็น NULL

#### Scenario: send_now ล้มเหลวเก็บทั้ง error และ response
- **WHEN** `send_now` dispatch ล้มเหลวเพราะปลายทางตอบ HTTP >= 400
- **THEN** แถวนั้นมี `status='failed'`, `error_msg` ระบุ HTTP status code, และ `response_snippet` มีเนื้อ response

#### Scenario: cron เก็บ response เช่นเดียวกัน
- **WHEN** `publish-scheduler.php` ประมวลผลแถว pending แล้ว `dispatch_content()` คืนผล (สำเร็จหรือล้มเหลว)
- **THEN** แถวนั้นมี `response_snippet` ไม่เป็น NULL

#### Scenario: response ยาวเกินถูกตัด
- **WHEN** ปลายทางตอบ response ที่ยาวกว่า 2000 ตัวอักษร
- **THEN** `response_snippet` ที่บันทึกมีความยาวไม่เกิน 2000 ตัวอักษร และการบันทึกไม่ทำให้ query ล้มเหลว
