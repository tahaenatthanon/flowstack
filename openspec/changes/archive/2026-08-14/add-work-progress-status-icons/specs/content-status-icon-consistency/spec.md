# content-status-icon-consistency Specification

## Purpose

กำหนดให้สถานะเดียวกันใช้ไอคอนเดียวกันในทุกหน้าที่เกี่ยวข้อง — แดชบอร์ดคอนเทนต์ (`ContentDashboardPage`), ผลงานคอนเทนต์ (`ContentListTab`), และรายการอนุมัติ (`ContentApprovalTab`) — โดยยึด `STATUS_MAP` ใน `src/components/content/types.ts` เป็น single source of truth ของไอคอนและสี เพื่อให้ UI มีความสอดคล้องและผู้ใช้จดจำความหมายของไอคอนได้ง่ายขึ้น

## ADDED Requirements

### Requirement: สถานะเดียวกันใช้ไอคอนเดียวกันในทุกหน้า
ระบบ SHALL ใช้ไอคอนเดียวกันสำหรับสถานะเดียวกันในทั้งสามหน้า (แดชบอร์ดคอนเทนต์, ผลงานคอนเทนต์, รายการอนุมัติ)

#### Scenario: ไอคอนของแต่ละสถานะสอดคล้องกันข้ามหน้า
- **WHEN** ผู้ใช้เปิดหน้าใดในสามหน้าที่เกี่ยวข้อง
- **THEN** สถานะเดียวกันแสดงไอคอนเดียวกันตาม mapping: `published` = CheckCircle2, `draft` = Edit3, `revision` = RotateCcw, `pending_approval` = Clock, `approved` = BadgeCheck, `rejected` = XCircle

#### Scenario: STATUS_MAP เป็น single source of truth
- **WHEN** ไอคอนของสถานะถูก render ในหน้าใดก็ตาม
- **THEN** ไอคอนและสีมาจาก `STATUS_MAP` (`icon` + `iconColor`) ไม่ใช่ hardcode ซ้ำในแต่ละหน้า

### Requirement: สีไอคอนใช้ semantic token สอดคล้องกัน
ไอคอนสถานะ SHALL ใช้สี semantic token เดียวกันข้ามหน้า

#### Scenario: สีไอคอนสอดคล้องกัน
- **WHEN** ไอคอนสถานะถูก render
- **THEN** สีเป็น text color token สอดคล้องกับ `STATUS_MAP.iconColor` (published/approved = text-green-600, pending_approval = text-amber-600, revision = text-blue-600, draft = text-gray-600, rejected = text-red-600)

### Requirement: พฤติกรรมเดิมคงอยู่
การปรับไอคอน SHALL ไม่เปลี่ยนแปลง label, จำนวน, หรือฟังก์ชันการทำงานเดิมของแต่ละหน้า

#### Scenario: ฟังก์ชันเดิมยังทำงาน
- **WHEN** ผู้ใช้ใช้งานแต่ละหน้า (กรอง, อนุมัติ, ขอแก้ไข, ปฏิเสธ ฯลฯ)
- **THEN** label, จำนวน, และฟังก์ชันการทำงานยังคงเดิม ไม่ถูกกระทบจากการเปลี่ยนไอคอน
