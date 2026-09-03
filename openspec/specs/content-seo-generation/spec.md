## Purpose

กำหนดให้การสร้างเนื้อหาผ่าน `generate-article` ใช้กฎ SEO Checklist เป็นเงื่อนไขในการสร้างเนื้อหา โดยใช้ source of truth เดียวกับ `seo_evaluate()` ประเมินเนื้อหาที่สร้าง ก่อนคืนผล และสร้างใหม่พร้อม feedback จนไม่มีกฎ `fail` (ภายในเพดานที่กำหนด)

## Requirements

### Requirement: กฎ SEO ใน prompt มาจาก source of truth เดียวกับ seo_evaluate
ระบบ SHALL มีฟังก์ชัน `seo_generation_requirements(string $type): array` ใน `api/lib/seo-checklist.php` ที่คืนรายการข้อกำหนดภาษาไทยสำหรับฉีดเข้า AI prompt โดยอ่าน threshold เดียวกับ `seo_evaluate()` (ผ่าน named constants) และ SHALL ใช้ข้อกำหนดนี้แทนกฎ SEO ที่ hardcode ไว้เดิมใน `generate-article`

#### Scenario: prompt บทความมีข้อกำหนดครบชุด
- **WHEN** `seo_generation_requirements('article')` ถูกเรียก
- **THEN** ผลลัพธ์มีข้อกำหนดครอบคลุมอย่างน้อย seo_title (1–60), meta_description (120–160), slug (lowercase + ขีด), H2 อย่างน้อย 1, h1 ไม่เกิน 1, จำนวนคำ ≥ 500, คีย์เวิร์ดใน title/ย่อหน้าแรก/หัวข้อ, structured_data (@context/@type), และ internal_link
- **AND** ข้อกำหนดภาษาไทยอ้างอิงค่า threshold เดียวกับที่ `seo_evaluate()` ใช้ตรวจ

#### Scenario: prompt วิดีโอไม่บังคับโครงสร้างบทความ
- **WHEN** `seo_generation_requirements('video')` ถูกเรียก
- **THEN** ผลลัพธ์ไม่บังคับ H2, จำนวนคำ, และ internal_link
- **AND** ผลลัพธ์บังคับ hashtag อย่างน้อย 1 รายการ

#### Scenario: ใช้ข้อกำหนดร่วมแทนการ hardcode
- **WHEN** `generate-article` สร้าง system prompt สำหรับบทความ
- **THEN** ส่วนข้อกำหนด SEO มาจาก `seo_generation_requirements($type)` ไม่ใช่ข้อความ hardcode แยกชุด

### Requirement: ประเมินเนื้อหาที่สร้างด้วย seo_evaluate ก่อนคืนผล
ระบบ SHALL เรียก `seo_evaluate()` กับรายการที่ประกอบเสร็จแล้ว (แมป `article_content` เป็น array, `type`, `title`, `seo_title`, `slug`, `meta_description`, `meta_keywords`, `structured_data`, `og_image`) ในเส้นทาง `generate-article` ก่อนคืนผลให้ผู้ใช้

#### Scenario: ประเมินหลังสร้างเนื้อหาบทความ
- **WHEN** `generate-article` สร้างเนื้อหาบทความสำเร็จและประกอบ `$art` เสร็จ
- **THEN** ระบบเรียก `seo_evaluate()` ด้วยฟิลด์ของรายการนั้น และได้ `score` + `rules`

#### Scenario: ประเมินวิดีโอด้วย type=video
- **WHEN** รายการมี `type = 'video'`
- **THEN** ระบบส่ง `type = 'video'` ให้ `seo_evaluate()` เพื่อเลือก ruleset วิดีโอ

### Requirement: สร้างใหม่พร้อม feedback จนกว่า SEO Quality Gate ผ่าน
เมื่อผล `seo_evaluate()` มี gate status ไม่ใช่ `passed` (มีกฎ `failed`/`needs_improvement` หรือ critical rule ล้ม) ระบบ SHALL สร้างเนื้อหาใหม่อีกครั้งโดยเพิ่ม feedback (ข้อความภาษาไทยของกฎที่ติด เรียงตามน้ำหนักมากไปน้อย) เข้าในคำขอ AI และ SHALL ประเมินใหม่ครบทั้ง 15 ข้อทุกครั้ง แล้วทำซ้ำจน gate status เป็น `passed` หรือถึงเพดานที่กำหนด

#### Scenario: meta_description นอกช่วงถูกสร้างใหม่
- **WHEN** ผลประเมินมีกฎ `meta_description` เป็น `failed`
- **THEN** ระบบสร้างเนื้อหาใหม่อีกครั้งพร้อม feedback ที่ระบุว่าคำอธิบาย meta ต้องยาว 120–160 ตัวอักษร
- **AND** รอบถัดไปประเมินใหม่ครบทั้ง 15 ข้อ

#### Scenario: critical rule ล้มถูกสร้างใหม่แม้คะแนนถึงเกณฑ์
- **WHEN** คะแนน ≥ 90 แต่ critical rule `structured_data` เป็น `failed`
- **THEN** ระบบสร้างใหม่อีกครั้งพร้อม feedback ระบุ structured_data ต้องมี @context และ @type

### Requirement: pending ไม่กระตุ้นการสร้างใหม่
กฎ `pending` SHALL ไม่กระตุ้นการสร้างเนื้อหาใหม่ และ SHALL ไม่ถูกนับเป็นเหตุให้ `seo_passed = false` ส่วน `needs_improvement` และ `failed` SHALL กระตุ้นการสร้างใหม่เมื่อ gate status ยังไม่ใช่ `passed`

#### Scenario: research ยังไม่มี (pending) ไม่สร้างใหม่
- **WHEN** ผลประเมินมีกฎ `search_intent` เป็น `pending` และไม่มีกฎ `failed`/`needs_improvement` อื่นที่ทำให้ gate ไม่ผ่าน
- **THEN** ระบบคืนเนื้อหาให้ผู้ใช้ทันทีโดยไม่สร้างใหม่
- **AND** `seo_passed = true`

#### Scenario: คีย์เวิร์ดรองไม่ปรากฏ (needs_improvement) ถูกสร้างใหม่
- **WHEN** ผลประเมินมีกฎ `related_keywords` เป็น `needs_improvement` ที่ทำให้ gate status ไม่ใช่ `passed`
- **THEN** ระบบสร้างใหม่อีกครั้งพร้อม feedback ระบุคีย์เวิร์ดรองที่ควรเพิ่ม

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

### Requirement: "ตรวจ SEO ใหม่" ตรวจด้วยกฎ 15 ข้อชุดเดียวกับ Generation
ปุ่ม/ฟังก์ชัน "ตรวจ SEO ใหม่" SHALL เรียกใช้ SEO Evaluator ชุดเดียวกับ Generation (ครบ 15 ข้อ) และ SHALL เป็น re-check อย่างเดียวโดยไม่เปลี่ยน content อัตโนมัติ

#### Scenario: ตรวจ SEO ใหม่ด้วยกฎชุดเดียว
- **WHEN** ผู้ใช้กด "ตรวจ SEO ใหม่"
- **THEN** ระบบโหลด content ปัจจุบัน + research brief แล้วเรียก `seo_evaluate()` ครบ 15 ข้อ
- **AND** ระบบแสดงคะแนนรวม, สถานะแต่ละข้อ (Passed/Needs Improvement/Failed), รายละเอียดข้อที่ติด, และ gate status ล่าสุด
- **AND** ระบบไม่ mutate content

### Requirement: เพดานการสร้างใหม่จำกัดจำนวนรอบ
ระบบ SHALL จำกัดจำนวนรอบสร้างใหม่ต่อคำขอ (ค่าคงที่ เช่น 3 รอบรวมรอบแรก) และเมื่อถึงเพดานแล้ว gate status ยังไม่ใช่ `passed` SHALL คืนเนื้อหาที่ดีที่สุดพร้อม `seo_passed = false` และผล `seo` ให้ผู้ใช้แทนการค้างหรือล้ม

#### Scenario: ถึงเพดานแล้วคืนเนื้อหาที่ดีที่สุด
- **WHEN** ระบบสร้างใหม่จนครบเพดานแล้ว gate status ยังไม่ใช่ `passed`
- **THEN** ระบบคืน `article` พร้อม `seo_passed = false` และผล `seo` ของรอบล่าสุด
- **AND** ระบบไม่เรียก AI เพิ่มเกินเพดาน
