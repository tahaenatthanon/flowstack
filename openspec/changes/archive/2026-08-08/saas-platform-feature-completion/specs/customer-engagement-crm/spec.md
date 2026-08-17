## ADDED Requirements

### Requirement: Campaign-to-CRM Engagement Link
ระบบ SHALL เชื่อม email campaign engagement events (open, click) กับ lead/contact ใน CRM และอัปเดต engagement score อัตโนมัติ

#### Scenario: Open event updates lead score
- **WHEN** email open event บันทึกและ recipient email ตรงกับ contact ใน CRM
- **THEN** ระบบเพิ่ม engagement score ของ contact นั้น (+1 point per open, configurable)

#### Scenario: Click event updates lead score
- **WHEN** email click event บันทึกและ recipient ตรงกับ contact
- **THEN** ระบบเพิ่ม engagement score (+3 points per click, configurable) และบันทึก activity log

### Requirement: Customer Engagement Timeline
ระบบ SHALL แสดง engagement timeline ต่อ contact แสดงรายการ touchpoints ทั้งหมด: email opens, clicks, meetings, tasks

#### Scenario: View contact engagement timeline
- **WHEN** user เปิด contact/company detail ใน CRM
- **THEN** ระบบแสดง timeline เรียงตาม date ที่มี events: email opened, link clicked, meeting held, task completed

### Requirement: Lead Scoring Configuration
ระบบ SHALL อนุญาตให้ admin ตั้งค่า point values สำหรับแต่ละ engagement action

#### Scenario: Configure scoring rules
- **WHEN** admin บันทึก scoring configuration
- **THEN** ระบบใช้ค่าใหม่สำหรับ events ที่เกิดขึ้นหลังจากนั้น (ไม่ retroactive)

#### Scenario: High-engagement leads highlighted
- **WHEN** contact มี engagement score เกิน threshold
- **THEN** ระบบแสดง badge "Hot Lead" บน contact card ใน CRM
