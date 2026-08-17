## ADDED Requirements

### Requirement: Project KPI Dashboard
ระบบ SHALL แสดง KPI dashboard สำหรับ project management ที่วัดผลได้จริง ประกอบด้วย velocity (tasks/week), burn rate (hours used/budgeted), on-time rate (% tasks เสร็จตาม due date), และ overdue count

#### Scenario: View project KPI summary
- **WHEN** user เปิดหน้า Projects หรือ project detail
- **THEN** ระบบแสดง KPI cards พร้อมค่าจริง (ไม่ใช่ placeholder) คำนวณจาก tasks ใน DB

#### Scenario: KPI drill-down
- **WHEN** user คลิก KPI card ใดๆ
- **THEN** ระบบแสดง breakdown รายการ tasks ที่เกี่ยวข้อง พร้อม filter ตาม date range

### Requirement: Sales KPI Dashboard
ระบบ SHALL แสดง KPI dashboard สำหรับ sales ที่วัดผลได้จริง ประกอบด้วย win rate (%), average deal cycle time (วัน), pipeline value (THB), และ activities per rep

#### Scenario: View sales KPI
- **WHEN** user เปิดหน้า Sales
- **THEN** ระบบแสดง win rate, cycle time, pipeline value คำนวณจาก `sales_opportunities` จริง

#### Scenario: Compare against target
- **WHEN** admin ตั้งค่า KPI targets ใน settings
- **THEN** KPI cards แสดง actual vs target พร้อม % variance และ color indicator (green/red)

### Requirement: KPI Target Configuration
ระบบ SHALL อนุญาตให้ admin ตั้งค่า KPI targets รายเดือน/รายไตรมาส สำหรับ project และ sales metrics

#### Scenario: Set monthly target
- **WHEN** admin บันทึก target ค่าหนึ่ง
- **THEN** ระบบบันทึกและแสดงใน KPI comparison ทันที
