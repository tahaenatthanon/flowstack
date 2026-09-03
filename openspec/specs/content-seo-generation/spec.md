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

### Requirement: สร้างใหม่พร้อม feedback เมื่อมีกฎ fail
เมื่อผล `seo_evaluate()` มีกฎ `level = 'fail'` ระบบ SHALL สร้างเนื้อหาใหม่อีกครั้งโดยเพิ่ม feedback (ข้อความภาษาไทยของกฎที่ติด) เข้าในคำขอ AI และ SHALL ทำซ้ำจนไม่มีกฎ `fail` หรือถึงเพดานที่กำหนด

#### Scenario: meta_description นอกช่วงถูกสร้างใหม่
- **WHEN** ผลประเมินมีกฎ `meta_description` เป็น `fail`
- **THEN** ระบบสร้างเนื้อหาใหม่อีกครั้งพร้อม feedback ที่ระบุว่าคำอธิบาย meta ต้องยาว 120–160 ตัวอักษร
- **AND** เนื้อหาที่คืนให้ผู้ใช้ไม่มีกฎ `fail` (เมื่อยังไม่ถึงเพดาน)

#### Scenario: เนื้อหาไม่มี H2 ถูกสร้างใหม่
- **WHEN** ผลประเมินมีกฎ `has_h2` เป็น `fail`
- **THEN** ระบบสร้างใหม่อีกครั้งพร้อม feedback ให้เพิ่มหัวข้อ H2 ในเนื้อหา

#### Scenario: slug ผิดรูปแบบถูกสร้างใหม่
- **WHEN** ผลประเมินมีกฎ `slug` เป็น `fail`
- **THEN** ระบบสร้างใหม่อีกครั้งพร้อม feedback ให้ slug เป็นตัวพิมพ์เล็กคั่นขีด (a-z, 0-9, -)

### Requirement: pending warn skip ไม่กระตุ้นการสร้างใหม่
เฉพาะกฎ `level = 'fail'` เท่านั้นที่ SHALL กระตุ้นการสร้างเนื้อหาใหม่ — `pending`, `warn`, และ `skip` SHALL ไม่ทำให้ระบบสร้างใหม่ และ SHALL ไม่ถูกนับเป็นเหตุให้ `seo_passed = false`

#### Scenario: og_image ว่าง (pending) ไม่สร้างใหม่
- **WHEN** ผลประเมินมี `og_image` เป็น `pending` และไม่มีกฎ `fail`
- **THEN** ระบบคืนเนื้อหาให้ผู้ใช้ทันทีโดยไม่สร้างใหม่
- **AND** `seo_passed = true`

#### Scenario: คีย์เวิร์ดไม่ปรากฏในหัวข้อ (warn) ไม่สร้างใหม่
- **WHEN** ผลประเมินมี `keyword_in_headings` เป็น `warn` และไม่มีกฎ `fail`
- **THEN** ระบบคืนเนื้อหาให้ผู้ใช้โดยไม่สร้างใหม่

### Requirement: คืนผลประเมิน SEO ใน response ของ generate-article
`generate-article` SHALL คืน `seo` (มี `score` และ `rules`) และ `seo_passed` (boolean) ควบคู่กับ `article` โดย `seo_passed = true` เมื่อไม่มีกฎ `fail` และ `false` เมื่อมีกฎ `fail`

#### Scenario: คืนผลประเมินพร้อมเนื้อหา
- **WHEN** `generate-article` สร้างเนื้อหาเสร็จ
- **THEN** response มี `article`, `seo` (`score` + `rules`), และ `seo_passed`

#### Scenario: seo_passed สะท้อนการมีกฎ fail
- **WHEN** ผลประเมินมีกฎ `fail` อย่างน้อยหนึ่งรายการ
- **THEN** `seo_passed = false`

### Requirement: เพดานการสร้างใหม่จำกัดจำนวนรอบ
ระบบ SHALL จำกัดจำนวนรอบสร้างใหม่ต่อคำขอ (ค่าคงที่ เช่น 3 รอบรวมรอบแรก) และเมื่อถึงเพดานแล้วยังมีกฎ `fail` SHALL คืนเนื้อหาที่ดีที่สุดพร้อม `seo_passed = false` และผล `seo` ให้ผู้ใช้แทนการค้างหรือล้ม

#### Scenario: ถึงเพดานแล้วคืนเนื้อหาที่ดีที่สุด
- **WHEN** ระบบสร้างใหม่จนครบเพดานแล้วยังมีกฎ `fail`
- **THEN** ระบบคืน `article` พร้อม `seo_passed = false` และผล `seo` ของรอบล่าสุด
- **AND** ระบบไม่เรียก AI เพิ่มเกินเพดาน
