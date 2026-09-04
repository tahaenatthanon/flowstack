# publish-approval-gate Specification

## Purpose

กำหนด approval gate สำหรับทุกเส้นทางที่สามารถทำให้คอนเทนต์เผยแพร่ได้ โดยใช้ `content_items.approved_at` เป็นหลักฐานการอนุมัติของ content version ปัจจุบัน

## Requirements

### Requirement: send_now ต้องผ่าน approval gate
`send_now` (`api/content-publish.php`) SHALL ปฏิเสธเมื่อ `approved_at IS NULL` ด้วย HTTP 422 ก่อนสร้าง queue row และก่อน `dispatch_content()`

### Requirement: schedule ต้องผ่าน approval gate
ทั้ง `schedule` (`api/content-publish.php`) และ legacy `schedules` (`api/brand-content.php`) SHALL ปฏิเสธเมื่อ `approved_at IS NULL` ด้วย HTTP 422 และ SHALL ไม่สร้าง pending schedule

### Requirement: scheduled content ต้องผ่าน approval gate ตอน dispatch
cron publish SHALL ตรวจ `approved_at` อีกครั้งก่อน dispatch เพื่อป้องกัน schedule ที่ถูกสร้างไว้ก่อนหน้า หรือ approval ที่ถูกถอนหลังตั้งเวลาแล้ว ไม่ให้เผยแพร่โดยไม่ผ่านการอนุมัติ

### Requirement: direct publish ต้องผ่าน approval gate
`api/brand-content.php?action=publish` และการเปลี่ยน `content_items.status` เป็น `published` SHALL ปฏิเสธเมื่อ `approved_at IS NULL`

### Requirement: approval ต้องผูกกับ content version
เมื่อคอนเทนต์ถูกส่งกลับ `revision` หรือ `rejected` ค่า `approved_at` SHALL ถูกล้าง เมื่อส่ง `pending_approval` SHALL ถูกล้าง และเมื่อ `approved` SHALL บันทึก `approved_at=NOW()`

การแก้ไข field เนื้อหาของคอนเทนต์ที่ได้รับอนุมัติแล้ว SHALL ถอน approval เดิมและเปลี่ยนสถานะเป็น `revision` เพื่อให้ต้องอนุมัติใหม่ก่อนเผยแพร่

### Requirement: UI ต้องสะท้อน approval gate
ปุ่ม `ส่งทันที`, `ตั้งเวลาโพสต์` และ action เผยแพร่ SHALL ใช้งานได้เฉพาะเมื่อมี `approved_at` ของ content item ปัจจุบัน หากไม่มี approval ต้อง disabled และแสดงเหตุผลว่าต้องอนุมัติก่อน

#### Scenario: ยังไม่อนุมัติ
- **GIVEN** `approved_at IS NULL`
- **WHEN** ผู้ใช้พยายามส่งหรือตั้งเวลา
- **THEN** UI ไม่เปิด action และ API ตอบ HTTP 422
- **AND** ไม่มีการ dispatch ไปยังปลายทาง

#### Scenario: อนุมัติแล้ว
- **GIVEN** `approved_at IS NOT NULL`
- **WHEN** ผู้ใช้ส่งหรือตั้งเวลา
- **THEN** action ผ่าน approval gate และทำงานต่อไปตาม gate อื่น ๆ

#### Scenario: ถอน approval หลังแก้ไข
- **GIVEN** คอนเทนต์มี `approved_at` อยู่แล้ว
- **WHEN** มีการแก้ไข field เนื้อหา
- **THEN** approval เดิมถูกล้างและสถานะกลับเป็น `revision`
- **AND** ไม่สามารถส่งหรือตั้งเวลาได้จนกว่าจะอนุมัติใหม่
