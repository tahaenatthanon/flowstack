## MODIFIED Requirements

### Requirement: Direct metadata SHALL not become content instructions
ระบบ MAY เก็บ `day_label=''` และ `day_order=0` สำหรับ direct item เพื่อ compatibility แต่ค่าเหล่านี้ SHALL ไม่ถูกใช้เป็น instruction ให้ AI เขียนเนื้อหา — `scheduled_date` ของ direct item ที่สร้างผ่าน Quick Create SHALL ถูกตั้งเป็นวันที่ปัจจุบันโดยอัตโนมัติแบบ best-effort (ดู `quick-create-schedule-date`) และ SHALL เป็น `null` เฉพาะกรณีที่การตั้งวันที่ล้มเหลวจริงเท่านั้น ไม่ใช่ค่าเริ่มต้นที่ตั้งใจปล่อยว่างอีกต่อไป

#### Scenario: Direct item is persisted
- **WHEN** direct generation สำเร็จ
- **THEN** item ถูกบันทึกใน storage เดิมได้
- **AND** neutral day metadata (`day_label`/`day_order`) ไม่ทำให้ content มี framing เรื่องวันจันทร์หรือเริ่มต้นสัปดาห์

#### Scenario: Quick Create item ได้ scheduled_date เป็นวันปัจจุบันตามปกติ
- **WHEN** ผู้ใช้สร้าง content ผ่าน Quick Create และการตั้งวันที่สำเร็จ
- **THEN** `content_items.scheduled_date` ของ item นั้นเป็นวันที่ปัจจุบัน ไม่ใช่ `null`

#### Scenario: scheduled_date เป็น null เฉพาะเมื่อการตั้งวันที่ล้มเหลวจริง
- **WHEN** การเรียกตั้งวันที่ให้ Quick Create item ล้มเหลว (เช่น network error)
- **THEN** `content_items.scheduled_date` ของ item นั้นยังคงเป็น `null` ได้ตามที่ backend อนุญาต
- **AND** item นั้นยังคงแสดงผลได้ตามปกติผ่าน unscheduled bucket ใน Calendar view
