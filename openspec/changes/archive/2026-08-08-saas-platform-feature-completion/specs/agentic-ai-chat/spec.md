## ADDED Requirements

### Requirement: AI Tool-Calling (Action Execution)
ระบบ SHALL ให้ AI chat สามารถ execute actions จริงในระบบผ่าน tool-calling ได้แก่: สร้าง task, สร้าง project, สร้าง lead/opportunity, query ข้อมูล (tasks, projects, sales), trigger workflow, และ summarize reports

#### Scenario: Create task via AI
- **WHEN** user พิมพ์ "สร้าง task ชื่อ X ใน project Y"
- **THEN** AI เรียก create_task tool, สร้าง task จริงใน DB และตอบกลับพร้อม link ไปยัง task ที่สร้าง

#### Scenario: Query data via AI
- **WHEN** user พิมพ์ "task ที่ค้างอยู่ของฉันมีกี่รายการ"
- **THEN** AI เรียก query_tasks tool, ดึงข้อมูลจริง และตอบกลับพร้อมรายการ

#### Scenario: Tool permission enforcement
- **WHEN** AI พยายาม execute tool ที่ user ไม่มีสิทธิ์
- **THEN** ระบบปฏิเสธการทำงานและ AI ตอบกลับว่าไม่มีสิทธิ์

### Requirement: AI Tool Registry
ระบบ SHALL มี tool registry ที่ลงทะเบียน tools ที่ AI ใช้ได้ พร้อม schema, description, และ permission requirement

#### Scenario: Tool list available to AI
- **WHEN** AI session เริ่มต้น
- **THEN** ระบบส่ง tool definitions ให้ AI provider พร้อม permission context ของ user ปัจจุบัน

### Requirement: Agentic Analysis Reports
ระบบ SHALL ให้ AI สร้าง analysis reports ได้เมื่อ user ร้องขอ เช่น project health report, sales pipeline analysis, BPM bottleneck summary

#### Scenario: Generate project health report
- **WHEN** user พิมพ์ "วิเคราะห์สุขภาพ project X"
- **THEN** AI query ข้อมูล tasks, milestones, budget, risks แล้วสรุปเป็น report ในรูปแบบ markdown พร้อม recommendations

#### Scenario: AI response with data visualization hint
- **WHEN** AI ตอบกลับพร้อม structured data (table/chart)
- **THEN** frontend render ข้อมูลนั้นเป็น table หรือ chart แทน plain text
