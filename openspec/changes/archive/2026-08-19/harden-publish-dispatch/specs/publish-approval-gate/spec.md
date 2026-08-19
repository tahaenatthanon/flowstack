## ADDED Requirements

### Requirement: send_now ปฏิเสธคอนเทนต์ที่ยังไม่ผ่านการอนุมัติ
`send_now` (`api/content-publish.php`) SHALL ปฏิเสธคำขอเมื่อคอนเทนต์มี `approved_at IS NULL` ด้วย HTTP 422 และข้อความภาษาไทยที่บอกว่าต้องอนุมัติก่อน การปฏิเสธ SHALL เกิดขึ้นก่อนสร้างแถว `content_publish_queue` และก่อนเรียก `dispatch_content()` — คำขอที่ถูกปฏิเสธ SHALL NOT ทำให้เกิด HTTP request ออกไปยังปลายทางใด ๆ

การตรวจนี้ SHALL ใช้ `approved_at` เป็นเกณฑ์ (ไม่ใช่ `status`) เพราะเป็นหลักฐานเวลาที่อนุมัติจริง

#### Scenario: คอนเทนต์ยังไม่อนุมัติถูกบล็อก
- **GIVEN** คอนเทนต์มี `approved_at IS NULL`
- **WHEN** เรียก `send_now` กับคอนเทนต์นั้น
- **THEN** ตอบ HTTP 422 พร้อมข้อความภาษาไทยว่าต้องอนุมัติก่อน
- **AND** ไม่มีแถวใหม่ใน `content_publish_queue`
- **AND** ไม่มี HTTP request ออกไปยังปลายทาง

#### Scenario: คอนเทนต์อนุมัติแล้วส่งได้
- **GIVEN** คอนเทนต์มี `approved_at` เป็นค่าเวลาที่ไม่ NULL
- **WHEN** เรียก `send_now` กับคอนเทนต์นั้น
- **THEN** คำขอผ่าน gate นี้ไปทำงานต่อตามปกติ

#### Scenario: gate ทำงานก่อนการตรวจ SEO
- **GIVEN** คอนเทนต์มี `approved_at IS NULL` และไม่ผ่านเกณฑ์ SEO ด้วย
- **WHEN** เรียก `send_now` กับคอนเทนต์นั้น
- **THEN** ข้อความที่ตอบกลับเป็นเรื่องการอนุมัติ ไม่ใช่เรื่อง SEO

### Requirement: ขอบเขตของ approval gate จำกัดที่ send_now
`send_now` เท่านั้นที่อยู่ใต้ requirement นี้ — เส้นทาง `schedule` และ cron scheduler (`api/cron/publish-scheduler.php`) SHALL ยังทำงานตามพฤติกรรมเดิม เพื่อไม่ให้แถวที่เข้าคิวไว้ก่อนหน้าหยุดทำงานทันทีจากการ deploy

#### Scenario: schedule ยังตั้งเวลาคอนเทนต์ที่ไม่อนุมัติได้
- **GIVEN** คอนเทนต์มี `approved_at IS NULL`
- **WHEN** เรียก action `schedule` กับคอนเทนต์นั้น
- **THEN** สร้างแถว `pending` ได้ตามพฤติกรรมเดิม ไม่ถูกปฏิเสธด้วย 422

#### Scenario: cron ยังประมวลผลแถว pending เดิม
- **GIVEN** มีแถว `pending` ของคอนเทนต์ที่ `approved_at IS NULL` ถึงเวลาแล้ว
- **WHEN** cron scheduler ทำงาน
- **THEN** แถวนั้นถูกประมวลผลตามพฤติกรรมเดิม
