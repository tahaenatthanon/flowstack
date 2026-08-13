## ข้อกำหนดที่แก้ไข

### Requirement: ขออนุมัติจากหน้ารายละเอียดเนื้อหา
ระบบ SHALL แสดงปุ่ม "ขออนุมัติ" ใน ContentDetailView เมื่อ `context='content'` และสถานะเป็น `draft` หรือ `revision` เมื่อคลิกจะเปลี่ยนสถานะเป็น `pending_approval`

#### Scenario: ปุ่มแสดงเมื่อเนื้อหาเป็นฉบับร่าง
- **WHEN** ผู้ใช้เปิด ContentDetailView ด้วย `context='content'` และ `item.status === 'draft'`
- **THEN** ปุ่ม "ขออนุมัติ" ปรากฏใน action bar

#### Scenario: ปุ่มแสดงเมื่อเนื้อหาเป็นรอแก้ไข
- **WHEN** ผู้ใช้เปิด ContentDetailView ด้วย `context='content'` และ `item.status === 'revision'`
- **THEN** ปุ่ม "ขออนุมัติ" ปรากฏใน action bar

#### Scenario: ขออนุมัติเปลี่ยนสถานะเป็น pending_approval
- **WHEN** ผู้ใช้คลิก "ขออนุมัติ" และยืนยัน
- **THEN** ระบบส่ง `PUT /content-items.php?id={id}` ด้วย `{ status: 'pending_approval' }`

### Requirement: ขออนุมัติจาก footer ของ ContentCardDialog
ระบบ SHALL แสดงปุ่ม "ขออนุมัติ" ใน footer ของ ContentCardDialog เมื่อมี `existingItem` และ `contentStatus` เป็น `draft` หรือ `revision` เมื่อคลิกจะเปลี่ยนสถานะเป็น `pending_approval`

#### Scenario: ปุ่มเปลี่ยนสถานะเป็น pending_approval
- **WHEN** ผู้ใช้คลิก "ขออนุมัติ" ใน ContentCardDialog และยืนยัน
- **THEN** ระบบส่ง `PUT /content-items.php?id={id}` ด้วย `{ status: 'pending_approval' }`
