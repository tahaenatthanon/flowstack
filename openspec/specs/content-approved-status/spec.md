# content-approved-status Specification

## Purpose

กำหนดสถานะ `approved` (อนุมัติแล้ว) ใหม่ใน workflow คอนเทนต์ — แยกสถานะ "อนุมัติแล้ว" ออกจาก "เผยแพร่แล้ว" — ครอบคลุม STATUS_MAP, database ENUM, และ tab ที่แสดงรายการ approved ทั้งในหน้าผลงานคอนเทนต์และหน้ารายการอนุมัติ

## Requirements

### Requirement: สถานะ approved มีใน STATUS_MAP
ระบบ SHALL รวม `approved` เป็น status key ใน `STATUS_MAP` พร้อม label ภาษาไทย "อนุมัติแล้ว" และสีที่แตกต่างจากสถานะอื่น (โดยเฉพาะ `published`)

#### Scenario: สถานะ approved ใน STATUS_MAP
- **WHEN** STATUS_MAP ถูก query ด้วย key `approved`
- **THEN** คืนค่า `{ label: 'อนุมัติแล้ว', color: 'bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300', icon: Stamp, iconColor: 'text-teal-600' }` — ต่างจาก `published` (เขียว CheckCircle2) และ `revision` (น้ำเงิน RotateCcw)

### Requirement: สถานะ approved ในฐานข้อมูล
`content_items.status` ENUM SHALL รวมค่า `approved`

#### Scenario: Migration เพิ่มค่า approved ใน enum
- **WHEN** database migration รันสำเร็จ
- **THEN** `content_items.status` รองรับค่า `approved`

### Requirement: Tab หน้าผลงานคอนเทนต์แสดงรายการ approved เป็น "รอเผยแพร่"
หน้าผลงานคอนเทนต์ (ContentListTab) SHALL แสดง tab ชื่อ "รอเผยแพร่" ที่กรองรายการด้วย `status === 'approved'`

#### Scenario: รายการ approved แสดงใน tab รอเผยแพร่
- **WHEN** ผู้ใช้คลิก tab "รอเผยแพร่" ในหน้าผลงานคอนเทนต์
- **THEN** แสดงเฉพาะรายการที่มี `status === 'approved'`

### Requirement: Tab หน้ารายการอนุมัติแสดงรายการ approved เป็น "อนุมัติแล้ว"
หน้ารายการอนุมัติ (ContentApprovalPage) SHALL แสดง tab ชื่อ "อนุมัติแล้ว" ที่กรองรายการด้วย `status === 'approved'`

#### Scenario: รายการ approved แสดงใน tab อนุมัติแล้ว
- **WHEN** ผู้ใช้คลิก tab "อนุมัติแล้ว" ในหน้ารายการอนุมัติ
- **THEN** แสดงเฉพาะรายการที่มี `status === 'approved'`
