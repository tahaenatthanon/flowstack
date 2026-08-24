## ADDED Requirements

### Requirement: ห้ามถอยสถานะคอนเทนต์ที่เผยแพร่แล้วผ่าน API
API SHALL ปฏิเสธคำขอเปลี่ยนสถานะของคอนเทนต์ที่มี `published_at IS NOT NULL` ไปเป็นสถานะก่อนเผยแพร่ (`draft`, `pending_approval`, `approved`, `revision`, `rejected`) ด้วย HTTP 422 และข้อความภาษาไทยที่ระบุเวลาที่เผยแพร่

#### Scenario: พยายามตั้งคอนเทนต์ที่เผยแพร่แล้วกลับเป็น draft
- **WHEN** ผู้ใช้ส่ง `PUT /content-items.php?id=<published>` พร้อม `{"status":"draft"}`
- **THEN** ระบบตอบ HTTP 422
- **AND** แถว `content_items` ยังคง `status='published'` และ `published_at` ไม่เปลี่ยนแปลง

#### Scenario: พยายามตั้งคอนเทนต์ที่เผยแพร่แล้วกลับเป็นสถานะก่อนเผยแพร่อื่น
- **WHEN** ผู้ใช้ส่ง `PUT /content-items.php?id=<published>` พร้อม `{"status":"pending_approval"}`, `{"status":"approved"}`, `{"status":"revision"}` หรือ `{"status":"rejected"}`
- **THEN** ระบบตอบ HTTP 422 ทุกกรณี
- **AND** แถว `content_items` ยังคงสถานะและ `published_at` เดิม

#### Scenario: ตั้งสถานะ published ซ้ำไม่ถูกปฏิเสธ
- **WHEN** ผู้ใช้ส่ง `PUT /content-items.php?id=<published>` พร้อม `{"status":"published"}`
- **THEN** ระบบยอมรับและดำเนินการตามปกติ (ไม่อัปเดต `published_at` ซ้ำโดยไม่จำเป็น)

#### Scenario: คอนเทนต์ที่ยังไม่เผยแพร่เปลี่ยนสถานะได้ปกติ
- **WHEN** ผู้ใช้ส่ง `PUT /content-items.php?id=<not-published>` เปลี่ยนสถานะระหว่าง `draft`/`pending_approval`/`approved`/`revision`/`rejected`
- **THEN** ระบบดำเนินการตามปกติโดยไม่ถูกเกตขวาง
