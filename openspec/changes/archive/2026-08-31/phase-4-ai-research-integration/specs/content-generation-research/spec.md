## ADDED Requirements

### Requirement: Content generation can use a completed research brief
`generate-article` SHALL รับ `research_job_id` แบบ optional และเมื่อมีค่า SHALL ใช้เฉพาะ brief ของ tenant เดียวกันที่ job มีสถานะ `done` เป็น input ของการสร้าง content

#### Scenario: Content is generated with research
- **WHEN** ผู้ใช้ส่ง `research_job_id` ที่ถูกต้องและ job มี brief ที่ผ่านการ validate
- **THEN** prompt มี brief, selected keywords และ provider/location/language/fetched time ของ job

#### Scenario: Invalid research is rejected
- **WHEN** research job ไม่ใช่ของ tenant, ไม่ใช่สถานะ `done` หรือไม่มี brief ที่ใช้ได้
- **THEN** ระบบไม่โหลดข้อมูลของ job เข้า prompt และคืน error ภาษาไทย

### Requirement: Research primary keyword controls SEO metadata
เมื่อสร้าง content จาก Research ระบบ SHALL ใช้ primary keyword ที่มาจาก Research เป็นหลักสำหรับ SEO title, slug, meta description, ย่อหน้าแรก และ headings โดยไม่ให้ LLM สร้าง `meta_keywords` ที่ไม่มีแหล่ง Research

#### Scenario: SEO fields use selected keyword
- **WHEN** Research brief มี primary keyword และ content generation สำเร็จ
- **THEN** SEO fields ที่กำหนดมี primary keyword ตามกติกา และ `meta_keywords` มาจาก keyword ที่เลือกใน Research

### Requirement: Content generation remains compatible without research
เมื่อไม่ส่ง `research_job_id` ระบบ SHALL สร้าง content ด้วย flow เดิมได้ และ SHALL ปล่อย `meta_keywords` ว่างโดยไม่สร้าง metrics หรือ keyword ปลอม

#### Scenario: Legacy generation has no research id
- **WHEN** request สร้าง article ไม่มี `research_job_id`
- **THEN** ระบบใช้ brand context/knowledge base เดิม สร้าง content ได้ และ `meta_keywords` เป็นค่าว่าง

### Requirement: Research linkage is persisted after content creation
เมื่อสร้าง content จาก Research สำเร็จ ระบบ SHALL บันทึก `content_item_id` กลับไปยัง Research job ของ tenant เดียวกัน

#### Scenario: Created content is linked to research
- **WHEN** content item ถูกสร้างสำเร็จจาก Research job
- **THEN** job ถูกอัปเดตด้วย `content_item_id` ของ content นั้น และยังคงข้อมูล source เดิม
