# content-publish-action Specification

## Purpose

กำหนดปุ่ม "เผยแพร่" ใน ContentDetailView ที่ให้ผู้สร้างเผยแพร่เนื้อหาที่อนุมัติแล้ว — เปลี่ยนสถานะจาก `approved` เป็น `published` — โดยแสดงเฉพาะในบริบท content (ไม่ใช่ approval) และใช้รูปแบบที่เด่นชัด

## Requirements

### Requirement: ผู้ใช้สามารถเผยแพร่เนื้อหาที่อนุมัติแล้วจากหน้ารายละเอียด
ระบบ SHALL แสดงปุ่ม "เผยแพร่" ใน ContentDetailView เมื่อ `context='content'` และ `item.status === 'approved'`

#### Scenario: ปุ่มแสดงเมื่อเนื้อหาอนุมัติแล้ว
- **WHEN** ผู้ใช้เปิด ContentDetailView ด้วย `context='content'` และ `item.status === 'approved'`
- **THEN** ปุ่ม "เผยแพร่" ปรากฏใน action bar

#### Scenario: ปุ่มไม่แสดงเมื่อเนื้อหายังไม่อนุมัติ
- **WHEN** ผู้ใช้เปิด ContentDetailView ด้วย `context='content'` และ `item.status` ไม่ใช่ `approved`
- **THEN** ปุ่ม "เผยแพร่" ไม่แสดง

#### Scenario: ปุ่มไม่แสดงในบริบทอนุมัติ
- **WHEN** ผู้ใช้เปิด ContentDetailView ด้วย `context='approval'`
- **THEN** ปุ่ม "เผยแพร่" ไม่แสดงไม่ว่าสถานะจะเป็นอะไร

### Requirement: การเผยแพร่เปลี่ยนสถานะเป็นเผยแพร่แล้ว
เมื่อผู้ใช้คลิก "เผยแพร่" ระบบ SHALL เปลี่ยนสถานะจาก `approved` เป็น `published`

#### Scenario: เผยแพร่สำเร็จ
- **WHEN** ผู้ใช้คลิก "เผยแพร่" และยืนยัน
- **THEN** ระบบส่ง `PUT /content-items.php?id={id}` ด้วย `{ status: 'published' }`
- **AND** invalidate queries ของ content list และ plan
- **AND** แสดง toast ชื่อ "เผยแพร่แล้ว"

### Requirement: รูปแบบปุ่มเผยแพร่
ปุ่ม "เผยแพร่" SHALL ใช้รูปแบบที่เด่นชัดเพื่อแยกจาก action อื่น

#### Scenario: รูปแบบปุ่ม
- **WHEN** ปุ่ม "เผยแพร่" ถูก render
- **THEN** ใช้ `variant="default"` กับ `size="sm"`
- **AND** แสดง `Send` icon และข้อความ "เผยแพร่"
- **AND** ใช้สีเขียว/สำเร็จ (เช่น `text-green-600 hover:bg-green-50`)
