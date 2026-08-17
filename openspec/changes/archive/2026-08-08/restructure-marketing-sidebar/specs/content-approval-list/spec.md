## ADDED Requirements

### Requirement: User can view content approval list
ระบบ SHALL แสดงหน้ารายการอนุมัติคอนเทนต์ที่ `/content-approval` โดยแสดงเฉพาะ content items ที่มีสถานะรอการอนุมัติ (pending_approval)

#### Scenario: View approval list
- **WHEN** ผู้ใช้ที่มีสิทธิ์ `content_approval` เข้าถึง `/content-approval`
- **THEN** ระบบแสดงตารางรายการคอนเทนต์ที่รออนุมัติ พร้อมข้อมูล: ชื่อคอนเทนต์, ผู้สร้าง, วันที่สร้าง, แพลตฟอร์ม, สถานะ

#### Scenario: No pending items
- **WHEN** ไม่มี content items ที่สถานะ pending_approval
- **THEN** ระบบแสดงข้อความ "ไม่มีรายการรออนุมัติ"

### Requirement: User can approve a content item
ระบบ SHALL ให้ผู้ใช้ที่มีสิทธิ์สามารถอนุมัติ content item จากหน้ารายการอนุมัติ

#### Scenario: Approve content
- **WHEN** ผู้ใช้คลิก "อนุมัติ" บนรายการคอนเทนต์
- **THEN** ระบบแสดง dialog ยืนยัน และเมื่อยืนยันแล้ว สถานะเปลี่ยนเป็น approved และรายการนั้นหายไปจากตาราง

### Requirement: User can reject a content item
ระบบ SHALL ให้ผู้ใช้ที่มีสิทธิ์สามารถปฏิเสธ content item พร้อมระบุเหตุผล

#### Scenario: Reject content with reason
- **WHEN** ผู้ใช้คลิก "ปฏิเสธ" บนรายการคอนเทนต์
- **THEN** ระบบแสดง dialog ให้กรอกเหตุผล และเมื่อส่งแล้ว สถานะเปลี่ยนเป็น rejected

### Requirement: Approval list supports filtering
ระบบ SHALL รองรับการกรองรายการตามแพลตฟอร์มและประเภทคอนเทนต์

#### Scenario: Filter by platform
- **WHEN** ผู้ใช้เลือก filter แพลตฟอร์ม
- **THEN** ระบบแสดงเฉพาะรายการที่ตรงกับแพลตฟอร์มที่เลือก

### Requirement: Approval page follows mockup design
หน้า "รายการอนุมัติ" SHALL ใช้ `PageShell` component และ shadcn-ui primitives โดยอิงดีไซน์และโครงสร้างจาก mockup `mockup/pages/content/` (list.php ตาราง+filter, approval_history_handler.php workflow)

#### Scenario: Consistent layout
- **WHEN** ผู้ใช้เข้าถึง `/content-approval`
- **THEN** หน้าแสดง breadcrumb "การตลาด > คอนเทนต์โซเชียล > รายการอนุมัติ" และ title "รายการอนุมัติ" ตามมาตรฐานของโปรเจกต์

### Requirement: Dashboard page follows mockup design
หน้า "แดชบอร์ด" (`/content-dashboard`) SHALL ใช้ `PageShell` component และดีไซน์อิงจาก mockup `mockup/pages/content/` สำหรับ overview และ summary ของ content items

#### Scenario: Dashboard layout
- **WHEN** ผู้ใช้เข้าถึง `/content-dashboard`
- **THEN** หน้าแสดง breadcrumb "การตลาด > คอนเทนต์โซเชียล > แดชบอร์ด", overview metrics, และ content summary ตาม mockup design
