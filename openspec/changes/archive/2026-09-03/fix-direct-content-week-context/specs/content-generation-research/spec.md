# content-generation-research Specification

## ADDED Requirements

### Requirement: Original User Topic SHALL remain the source seed
ระบบ SHALL รักษา topic ที่ผู้ใช้กรอกก่อน AI generation เป็น Original User Topic/Seed และ SHALL ไม่ใช้ AI-rewritten topic แทนค่า source นี้ใน Research

#### Scenario: Research enabled
- **WHEN** ผู้ใช้กรอก topic `YouTube` และเปิด AI Research
- **THEN** fetch ใช้ seed keyword `YouTube` หลัง trim
- **AND** seed ไม่ถูกเปลี่ยนเป็น topic ใหม่ที่ AI สร้างขึ้นจาก plan

#### Scenario: Research disabled
- **WHEN** ผู้ใช้กรอก topic และปิด AI Research
- **THEN** generate-article ยังคงสร้างจาก content item ที่อ้างอิง topic ของผู้ใช้
- **AND** ระบบไม่เติม weekly/day topic เข้าไปแทน
