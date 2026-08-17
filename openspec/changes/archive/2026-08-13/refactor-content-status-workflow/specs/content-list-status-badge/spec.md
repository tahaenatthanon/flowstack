## ข้อกำหนดที่แก้ไข

### Requirement: Status badge แสดงต่อท้ายชื่อบทความ
ระบบ SHALL แสดง status badge ต่อท้ายชื่อ content item แต่ละรายการใน ContentListTab โดยใช้ key และ label ที่อัปเดตแล้ว

#### Scenario: Status badge แสดงพร้อมชื่อ
- **WHEN** ContentListTab render แถว content item
- **THEN** ชื่อรายการแสดงตามด้วย status badge ที่แสดง label ภาษาไทยจาก STATUS_MAP โดยใช้ key ที่อัปเดต: `draft` → "ฉบับร่าง", `revision` → "รอแก้ไข", `pending_approval` → "รออนุมัติ", `approved` → "อนุมัติแล้ว", `published` → "เผยแพร่แล้ว", `rejected` → "ปฏิเสธ"

#### Scenario: Status badge ใช้สีตัวอักษรเท่านั้น
- **WHEN** status badge ถูก render
- **THEN** badge ใช้เฉพาะสีตัวอักษร (ไม่มีพื้นหลัง) จาก STATUS_MAP

#### Scenario: Status badge ซ่อนเมื่อกรองด้วยสถานะนั้น
- **WHEN** ContentListTab แสดง tab สถานะเฉพาะ (เช่น "ฉบับร่าง")
- **AND** `statusFilter === item.status`
- **THEN** status badge ไม่แสดง

#### Scenario: Status badge แสดงใน tab "ทั้งหมด"
- **WHEN** ContentListTab แสดง tab "ทั้งหมด" (`statusFilter === 'all'`)
- **THEN** status badge แสดงสำหรับทุกรายการโดยไม่คำนึงถึงสถานะ
