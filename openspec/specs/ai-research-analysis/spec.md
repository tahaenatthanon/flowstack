## Purpose

กำหนดการวิเคราะห์ Research job ด้วย AI และ Research brief ที่ตรวจสอบย้อนกลับได้

## Requirements

### Requirement: Completed research can be analyzed by the tenant AI model
ระบบ SHALL รองรับการวิเคราะห์ Research job ที่มีสถานะ `done` ด้วย AI content model ของ tenant และ SHALL บันทึกผลเป็น Research brief ใน job เดิม

#### Scenario: Analyze a completed job
- **WHEN** ผู้ใช้ส่งคำขอ analyze พร้อม job id ของ tenant ตนเองที่มีสถานะ `done`
- **THEN** ระบบเรียก AI model, validate JSON brief และบันทึก brief ลง `content_research_jobs.analysis` พร้อม `analyzed_at`

#### Scenario: Analyze an incomplete job
- **WHEN** job ไม่มีอยู่, ไม่ใช่ของ tenant หรือยังไม่ใช่สถานะ `done`
- **THEN** ระบบปฏิเสธคำขอและไม่เรียก AI provider

### Requirement: Research brief has a stable schema
Research brief SHALL มี primary keyword, secondary keywords, search intent, PAA, content gaps, competitor angles, outline, target word count และ AEO notes ในรูปแบบ JSON ที่ validate ได้

#### Scenario: Valid brief is returned
- **WHEN** AI คืน JSON ตาม schema ที่กำหนด
- **THEN** API คืน brief ที่มี field และชนิดข้อมูลตาม contract

#### Scenario: Invalid brief is returned
- **WHEN** AI คืน JSON ที่ parse ไม่ได้หรือขาด required field
- **THEN** ระบบคืนข้อผิดพลาดภาษาไทยและไม่บันทึก brief ที่ไม่สมบูรณ์เป็นผลสำเร็จ

### Requirement: Research metrics are source-bound
ระบบ SHALL ใช้ search volume, difficulty และ metrics อื่นเฉพาะค่าที่มีใน Research source และ SHALL ไม่ให้ AI แต่งตัวเลขแทนค่าที่หายไป

#### Scenario: A metric is missing from provider data
- **WHEN** Research source มี metric เป็น `null` หรือไม่มี field นั้น
- **THEN** brief คงค่าเป็น `null` หรือไม่ระบุ และไม่เติมตัวเลขจาก AI inference

### Requirement: Analysis is traceable
ผล analyze SHALL ระบุ provider, location, language และเวลาที่ fetch สำเร็จจาก Research job เพื่อให้ตรวจสอบแหล่งข้อมูลย้อนหลังได้

#### Scenario: Brief source metadata is inspected
- **WHEN** ผู้ใช้เปิดผลวิเคราะห์ของ job
- **THEN** response มี source metadata ที่ตรงกับ job และไม่มี credential ลับ
