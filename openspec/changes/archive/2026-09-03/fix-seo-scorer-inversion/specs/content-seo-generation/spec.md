## MODIFIED Requirements

### Requirement: คืนผลประเมิน SEO ใน response ของ generate-article
`generate-article` SHALL คืน `seo` (มี `score`, `gate`, และ `rules`), `seo_passed` (boolean) และ `generation_status` (`success`|`failed`) ควบคู่กับ `article` โดย `seo_passed = true` และ `generation_status = 'success'` เมื่อ `seo_gate_status()` คืน `passed` และ `false`/`'failed'` เมื่อคืน `needs_improvement` หรือ `failed`

#### Scenario: คืนผลประเมินพร้อมเนื้อหาและสถานะ gate
- **WHEN** `generate-article` สร้างเนื้อหาเสร็จ
- **THEN** response มี `article`, `seo` (`score` + `gate` + `rules`), `seo_passed`, และ `generation_status`

#### Scenario: generation failed เมื่อ gate ไม่ผ่าน
- **WHEN** `seo_gate_status()` คืน `needs_improvement` หรือ `failed` (หลัง repair ครบ max attempts)
- **THEN** `seo_passed = false` และ `generation_status = 'failed'`

#### Scenario: generation success เมื่อ gate ผ่าน
- **WHEN** `seo_gate_status()` คืน `passed`
- **THEN** `seo_passed = true` และ `generation_status = 'success'`

### Requirement: ครบ max attempts แล้วไม่ผ่าน ให้ status=revision
เมื่อ AI repair จนครบจำนวน attempt สูงสุดแล้ว gate status ยังไม่ใช่ `passed` ระบบ SHALL บันทึก content พร้อม `status='revision'` (ไม่ถือเป็นผลสำเร็จ) และ SHALL ไม่คืน content เป็นผลลัพธ์ที่ผ่าน SEO โดยผู้ใช้ยังเห็นรายละเอียด rule ที่ไม่ผ่านเพื่อตรวจสอบต่อได้

#### Scenario: ถึง max attempts แล้วไม่ผ่าน ถูกบันทึกเป็น revision
- **WHEN** ระบบ repair จนครบ max attempts แล้ว gate status ยังไม่ใช่ `passed`
- **THEN** content ถูกบันทึกด้วย `status='revision'`
- **AND** response มี `generation_status='failed'`, `seo_passed=false` และรายละเอียด rule ที่ยังไม่ผ่าน

### Requirement: AI ผลิต meta_keywords ได้เมื่อไม่มี research
เมื่อไม่ส่ง `research_job_id` ระบบ SHALL ใช้ `meta_keywords` ที่ AI ผลิต (จาก `mainData['meta_keywords']`) แทนการบังคับเป็น `''` และเมื่อมี research brief SHALL ใช้ keywords จาก research เป็น override

#### Scenario: ไม่มี research ใช้ keyword จาก AI
- **WHEN** generate-article ถูกเรียกโดยไม่มี research_job_id และ AI ผลิต `meta_keywords` ให้
- **THEN** `content_items.meta_keywords` เก็บ keyword ที่ AI ผลิต (ไม่เป็น `''` เสมอ)
- **AND** `primary_keyword_placement`/`keyword_stuffing` ไม่เป็น `pending` ถาวรเมื่อมี keyword

#### Scenario: มี research ใช้ keyword จาก research
- **WHEN** generate-article ถูกเรียกพร้อม research_job_id
- **THEN** `content_items.meta_keywords` ใช้ keywords จาก research เป็น override (ตามพฤติกรรมเดิม)
