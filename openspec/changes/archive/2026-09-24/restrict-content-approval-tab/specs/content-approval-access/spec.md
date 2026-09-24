## ADDED Requirements

### Requirement: สิทธิ์ content_approval ควบคุมการอนุมัติคอนเทนต์ และต้องมี role assignment เสมอ
ระบบ SHALL ใช้ menu key `content_approval` เป็นสิทธิ์เดียวที่อนุญาตให้ตัดสินอนุมัติคอนเทนต์ (อนุมัติ, ขอแก้ไข, ปฏิเสธ) และให้เห็นแท็บ "รายการอนุมัติ"
- ผู้ใช้ SHALL ได้สิทธิ์นี้เฉพาะเมื่อ `tenant_users.role_id` ของตนชี้ไป role ที่มีแถว `content_approval` ใน `role_menu_permissions` จริง
- `users.is_superadmin = 1` และ `tenant_users.is_admin = 1` SHALL ไม่ทำให้ได้สิทธิ์นี้โดยอัตโนมัติ (ต่างจากสิทธิ์เมนูอื่นทุกเมนูในระบบที่ยัง bypass ตามปกติ) — ถ้าไม่มี `role_id` หรือ role ไม่มี `content_approval` SHALL ถือว่าไม่มีสิทธิ์แม้เป็น superadmin หรือ is_admin
- ระบบ SHALL ไม่ตัดสินสิทธิ์จากชื่อหรือ label ของ role

#### Scenario: is_admin ที่ไม่มี role ไม่ได้สิทธิ์
- **WHEN** ผู้ใช้ `is_admin = 1` ที่ `role_id IS NULL`
- **THEN** ผู้ใช้ไม่เห็นแท็บ "รายการอนุมัติ" และตัดสินอนุมัติไม่ได้ แม้ยังเข้าเมนูอื่นทั้งหมดของแอปได้ตามปกติ

#### Scenario: is_admin ที่มี role ซึ่งมีสิทธิ์นี้
- **WHEN** ผู้ใช้ `is_admin = 1` ที่ `role_id` ชี้ไป role ซึ่งมีแถว `content_approval`
- **THEN** ผู้ใช้เห็นแท็บ "รายการอนุมัติ" และอนุมัติคอนเทนต์ได้ (เพราะมี role assignment จริง ไม่ใช่เพราะ `is_admin`)

#### Scenario: role ที่ไม่มีสิทธิ์
- **WHEN** ผู้ใช้ `is_admin = 0` ที่ role ไม่มี `content_approval` (เช่น สมาชิกทีม)
- **THEN** ผู้ใช้ไม่เห็นแท็บ "รายการอนุมัติ" และตัดสินอนุมัติไม่ได้

### Requirement: แท็บรายการอนุมัติแสดงเฉพาะผู้มีสิทธิ์
หน้า `/content` SHALL แสดงแท็บ "รายการอนุมัติ" เฉพาะเมื่อ `hasRolePermission('content_approval')` เป็นจริง (เช็คจาก `role_permissions` ที่ไม่ bypass ด้วย `is_admin`/`is_superadmin`) เมื่อไม่มีสิทธิ์ SHALL ไม่ render ทั้งปุ่มแท็บและเนื้อหาแท็บ และเมื่อเปิด URL `?tab=approval` SHALL เปิดแท็บ "ผลงานทั้งหมด" แทน

#### Scenario: ไม่มีสิทธิ์แล้วเปิดลิงก์แท็บอนุมัติตรงๆ
- **WHEN** ผู้ใช้ที่ไม่มีสิทธิ์เปิด `/#/content?tab=approval`
- **THEN** หน้าแสดงแท็บ "ผลงานทั้งหมด" และไม่มีแท็บ "รายการอนุมัติ" ให้เลือก

#### Scenario: มีสิทธิ์
- **WHEN** ผู้ใช้ role ผู้จัดการที่มีสิทธิ์ `content_approval` เปิดหน้า `/content`
- **THEN** เห็นแท็บ "รายการอนุมัติ" และเปิดใช้งานได้ตามปกติ

### Requirement: API ตัดสินอนุมัติบล็อกผู้ไม่มีสิทธิ์
ระบบ SHALL ตอบ HTTP 403 พร้อมข้อความ "ไม่มีสิทธิ์อนุมัติคอนเทนต์ — ต้องเป็นผู้ดูแลระบบหรือผู้จัดการ" และ SHALL ไม่เปลี่ยนข้อมูลใดๆ เมื่อผู้ใช้ที่ไม่มีสิทธิ์ `content_approval` เรียก:
- `PUT api/content-items.php` ที่ส่ง `status` เป็น `approved` หรือ `rejected`
- `PUT api/content-items.php` ที่ส่ง `status = revision` ขณะคอนเทนต์ใน DB มีสถานะ `pending_approval`
- `POST api/approvals.php?action=decide` ของคำขอที่ `entity_type = content_item`

การตรวจ SHALL ใช้ค่า `status` ที่ client ส่งมา ไม่ใช่ค่าที่ระบบตั้งให้เอง

#### Scenario: สมาชิกทีมเรียก API อนุมัติตรงๆ
- **WHEN** ผู้ใช้ role สมาชิกทีมส่ง `PUT content-items.php?id=X` ด้วย `{"status":"approved"}`
- **THEN** ระบบตอบ 403 และ `status`, `approved_at` ของคอนเทนต์ X ไม่เปลี่ยน

#### Scenario: ตีกลับคอนเทนต์ที่รออนุมัติ
- **WHEN** ผู้ใช้ที่ไม่มีสิทธิ์ส่ง `{"status":"revision","reject_reason":"..."}` ให้คอนเทนต์ที่อยู่ในสถานะ `pending_approval`
- **THEN** ระบบตอบ 403 และไม่บันทึกรอบการอนุมัติใน `content_approval_rounds`

#### Scenario: approver ใน chain ที่ไม่มีสิทธิ์
- **WHEN** ผู้ใช้ที่เป็น `approver_id` ของคำขอ content_item แต่ไม่มีสิทธิ์ `content_approval` เรียก `approvals.php?action=decide`
- **THEN** ระบบตอบ 403 และคำขอยังคงสถานะ `pending`

#### Scenario: ผู้มีสิทธิ์อนุมัติได้ตามปกติ
- **WHEN** ผู้ใช้ role ผู้ดูแลระบบที่มีสิทธิ์ `content_approval` ส่ง `{"status":"approved"}`
- **THEN** ระบบทำงานตาม flow อนุมัติเดิม (รวม Quality Gate)

### Requirement: การขออนุมัติและการแก้ไขคอนเทนต์ไม่ถูกจำกัดด้วยสิทธิ์นี้
ระบบ SHALL ไม่ตรวจสิทธิ์ `content_approval` สำหรับ:
- `status = pending_approval` (ขออนุมัติ)
- การแก้ไขเนื้อหาที่ไม่ได้ส่ง `status`
- การที่ระบบตั้ง `status = revision` อัตโนมัติเมื่อแก้เนื้อหาของคอนเทนต์ที่อนุมัติแล้ว

#### Scenario: สมาชิกทีมขออนุมัติงานตัวเอง
- **WHEN** ผู้ใช้ role สมาชิกทีมกด "ขออนุมัติ" (`status = pending_approval`)
- **THEN** ระบบไม่ตอบ 403 ด้วยเหตุผลเรื่องสิทธิ์ (ยังผ่าน Quality Gate ตามเดิม)

#### Scenario: แก้คอนเทนต์ที่อนุมัติแล้ว
- **WHEN** ผู้ใช้ที่ไม่มีสิทธิ์แก้เนื้อหาคอนเทนต์ที่อนุมัติแล้วโดยไม่ส่ง `status`
- **THEN** ระบบบันทึกได้และเปลี่ยนสถานะเป็น `revision` ตามเดิม

### Requirement: ตั้งค่าสิทธิ์ผ่านหน้าผู้ดูแลระบบ และค่าเริ่มต้นของ role
- หน้าผู้ดูแลระบบ SHALL แสดง "อนุมัติคอนเทนต์" (`content_approval`) ในรายการสิทธิ์ของ role ให้เลือกเปิด/ปิดได้
- migration SHALL เพิ่มสิทธิ์ `content_approval` ให้ role ที่ `name` เป็น `admin` หรือ `manager` ของทุก tenant ที่มีอยู่ โดยรันซ้ำได้โดยไม่เกิดแถวซ้ำ
- `api/auth/seed-defaults.php` SHALL ให้สิทธิ์ `content_approval` กับ role `admin` และ `manager` ของ tenant ใหม่ และ SHALL ไม่ให้กับ role `staff`

#### Scenario: หลังรัน migration
- **WHEN** รัน migration บน DB ที่มี role admin/manager/staff ใน 3 tenant
- **THEN** role admin และ manager ทุก tenant มีแถว `content_approval` และ role staff/member ไม่มี

#### Scenario: แอดมินให้สิทธิ์ role อื่น
- **WHEN** แอดมินติ๊ก "อนุมัติคอนเทนต์" ให้ role "ทดสอบ2" แล้วบันทึก
- **THEN** ผู้ใช้ใน role นั้นเห็นแท็บ "รายการอนุมัติ" หลังล็อกอินใหม่ และอนุมัติคอนเทนต์ได้
