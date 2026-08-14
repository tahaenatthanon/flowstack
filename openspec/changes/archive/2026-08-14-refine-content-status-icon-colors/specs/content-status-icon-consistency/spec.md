# content-status-icon-consistency Specification (delta)

## MODIFIED Requirements

### Requirement: สถานะเดียวกันใช้ไอคอนเดียวกันในทุกหน้า
ระบบ SHALL ใช้ไอคอนเดียวกันสำหรับสถานะเดียวกันในทั้งสามหน้า (แดชบอร์ดคอนเทนต์, ผลงานคอนเทนต์, รายการอนุมัติ)

#### Scenario: ไอคอนของแต่ละสถานะสอดคล้องกันข้ามหน้า
- **WHEN** ผู้ใช้เปิดหน้าใดในสามหน้าที่เกี่ยวข้อง
- **THEN** สถานะเดียวกันแสดงไอคอนเดียวกันตาม mapping: `published` = CheckCircle2, `draft` = Edit3, `revision` = RotateCcw, `pending_approval` = Clock, `approved` = Stamp, `rejected` = XCircle

#### Scenario: STATUS_MAP เป็น single source of truth
- **WHEN** ไอคอนของสถานะถูก render ในหน้าใดก็ตาม
- **THEN** ไอคอนและสีมาจาก `STATUS_MAP` (`icon` + `iconColor`) ไม่ใช่ hardcode ซ้ำในแต่ละหน้า

### Requirement: สีไอคอนใช้ semantic token สอดคล้องกัน
ไอคอนสถานะ SHALL ใช้สี semantic token เดียวกันข้ามหน้า

#### Scenario: สีไอคอนสอดคล้องกัน
- **WHEN** ไอคอนสถานะถูก render
- **THEN** สีเป็น text color token สอดคล้องกับ `STATUS_MAP.iconColor` (published = text-green-600, approved = text-teal-600, pending_approval = text-amber-600, revision = text-blue-600, draft = text-gray-600, rejected = text-red-600)
