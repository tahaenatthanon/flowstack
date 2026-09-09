## MODIFIED Requirements

### Requirement: Direct content creation SHALL be isolated from weekly/day context
เมื่อผู้ใช้สร้าง Content จาก Quick Create แบบเดี่ยว หรือจาก Batch generation ต่อหัวข้อ ระบบ SHALL ระบุ `generation_mode=direct` และ SHALL ไม่ส่งบริบทวันหรือสัปดาห์เข้า AI generation prompt

#### Scenario: Direct article generation (Quick Create)
- **WHEN** ผู้ใช้เลือก Article และกดสร้างจาก Quick Create
- **THEN** request มี `generation_mode=direct`
- **AND** ระบบสร้าง content 1 item
- **AND** prompt ไม่มี `สัปดาห์เริ่มต้น`, `สร้างโพสต์สำหรับวัน...`, `วันจันทร์` หรือ day/week context ที่ระบบเติมเอง

#### Scenario: Direct video generation (Quick Create)
- **WHEN** ผู้ใช้เลือก Video และกดสร้างจาก Quick Create
- **THEN** ระบบใช้ direct mode เช่นเดียวกับ Article
- **AND** prompt ไม่มี day/week context ที่ระบบเติมเอง

#### Scenario: Direct generation ต่อหัวข้อ (Batch)
- **WHEN** ผู้ใช้กรอกหลายหัวข้อใน Batch generation และกดเริ่มสร้าง
- **THEN** แต่ละหัวข้อถูกส่งเป็น request แยกที่มี `generation_mode=direct`
- **AND** แต่ละหัวข้อได้ content 1 item เสมอ ไม่ว่าจะเลือก content type หรือมีกี่หัวข้อในการรันนั้น
- **AND** prompt ของแต่ละหัวข้อไม่มี day/week context ที่ระบบเติมเอง
