## ADDED Requirements

### Requirement: Predicted vs Actual Comparison
ระบบ SHALL เปรียบเทียบ predicted impact (จาก simulation) กับ actual outcome เมื่อ project หรือ task เสร็จสิ้น และแสดง accuracy score

#### Scenario: Auto-compare on project completion
- **WHEN** project status เปลี่ยนเป็น `done` หรือ `completed`
- **THEN** ระบบ auto-fetch impact simulation ล่าสุดของ project และบันทึก `impact_outcomes` record พร้อม actual values จาก task data

#### Scenario: View outcome comparison
- **WHEN** user เปิด project ที่เสร็จแล้วและมี impact simulation
- **THEN** ระบบแสดง side-by-side comparison: predicted duration, predicted cost, predicted risk score vs actual values

### Requirement: Impact Accuracy Score
ระบบ SHALL คำนวณ accuracy score (0–100%) ต่อ simulation โดยเปรียบเทียบ predicted vs actual ใน dimension หลัก (duration, cost, completion rate)

#### Scenario: Accuracy score display
- **WHEN** outcome record ถูกสร้าง
- **THEN** ระบบแสดง accuracy score พร้อม breakdown ต่อ dimension บน ImpactOS dashboard

#### Scenario: Historical accuracy trend
- **WHEN** user เปิด ImpactOS overview
- **THEN** ระบบแสดง accuracy trend chart (line chart) ย้อนหลัง 12 เดือน

### Requirement: Manual Outcome Entry
ระบบ SHALL อนุญาตให้ user บันทึก actual outcome values ด้วยตนเองสำหรับ metrics ที่วัดไม่ได้อัตโนมัติ

#### Scenario: Manual outcome input
- **WHEN** user กรอก actual values ใน outcome form
- **THEN** ระบบบันทึกและ recalculate accuracy score ทันที
