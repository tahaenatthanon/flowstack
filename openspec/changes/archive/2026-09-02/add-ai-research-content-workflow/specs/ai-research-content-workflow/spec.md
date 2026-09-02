# ai-research-content-workflow Specification

## Purpose

กำหนด contract ของ orchestration ฝั่ง frontend ที่ต่อ Fetch → Analyze → Generate เข้า flow สร้างคอนเทนต์ พร้อม toggle เปิด/ปิดต่อชิ้นงาน, progress 3 ขั้น, derive seed keyword จาก topic, link research job กับ content item และ precondition สลับ writing model ไป OpenRouter

## ADDED Requirements

### Requirement: Research is optional per content item
ผู้ใช้ SHALL เปิดหรือปิด Research ต่อชิ้นงานได้ และเมื่อปิด ระบบ SHALL สร้างคอนเทนต์แบบเดิมโดยไม่เรียก Research endpoint

#### Scenario: Research is disabled
- **WHEN** ผู้ใช้ปิด toggle Research แล้วกดสร้าง
- **THEN** ระบบเรียก generate-article โดยไม่มี research_job_id (พฤติกรรมเดิม)

#### Scenario: Research is enabled
- **WHEN** ผู้ใช้เปิด toggle Research
- **THEN** ระบบเรียก fetch → analyze → generate ตามลำดับ

### Requirement: Workflow runs fetch then analyze then generate
เมื่อเปิด Research ระบบ SHALL เรียก `action=fetch` ด้วย seed keyword แล้วรอ job `done`, แล้ว SHALL เรียก `action=analyze`, แล้ว SHALL เรียก `generate-article` พร้อม `research_job_id`

#### Scenario: Full workflow succeeds
- **WHEN** fetch สำเร็จ → analyze สำเร็จ
- **THEN** generate-article ได้รับ research_job_id ที่ถูกต้องและคืนบทความ

#### Scenario: Fetch fails
- **WHEN** fetch คืน job failed หรือ error
- **THEN** ระบบหยุดที่ขั้น fetch และแสดงข้อความภาษาไทยโดยไม่ไป generate

#### Scenario: Analyze fails
- **WHEN** analyze คืน error หรือ brief ใช้ไม่ได้
- **THEN** ระบบหยุดที่ขั้น analyze และแสดงข้อความภาษาไทยโดยไม่ไป generate

### Requirement: Progress is shown in three steps
ระบบ SHALL แสดงสถานะ 3 ขั้น (ค้นข้อมูล → วิเคราะห์ → เขียนบทความ) ระหว่างรัน workflow

#### Scenario: Progress updates per step
- **WHEN** workflow กำลังรัน
- **THEN** ผู้ใช้เห็นว่าอยู่ขั้นไหนและขั้นใดเสร็จแล้ว

### Requirement: Seed keyword derives from topic
ระบบ SHALL ใช้ topic ของชิ้นงาน (trim แล้ว) เป็น seed keyword ในการเรียก fetch

#### Scenario: Topic becomes seed
- **WHEN** ผู้ใช้สร้างคอนเทนต์และเปิด Research
- **THEN** fetch ใช้ topic เป็น seed_keyword

### Requirement: Research job links to content item
ระบบ SHALL เชื่อม Research job เข้ากับ content item ที่สร้างผ่าน `content_item_id` โดยไม่ให้ผู้ใช้ต้องผูกเอง

#### Scenario: Job is linked after generate
- **WHEN** workflow จบสำเร็จ
- **THEN** research job มี content_item_id ชี้ไปชิ้นงานที่สร้าง

### Requirement: Writing model uses OpenRouter
ระบบ SHALL ตั้งค่า `company_settings.ai_content_text_model_id` ให้ชี้ model ใต้ `provider-openrouter` เพื่อให้ analyze และ generate ทำงานได้โดยไม่พึ่ง provider ที่หมดเครดิต

#### Scenario: Writing model is switched
- **WHEN** analyze หรือ generate ถูกเรียก
- **THEN** resolveAICreds() แก้ base_url และ api_key ไปยัง provider-openrouter ของ model นั้น
