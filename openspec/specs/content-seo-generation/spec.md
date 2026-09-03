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
เมื่อผล `seo_evaluate()` มี gate status ไม่ใช่ `pass` (มีกฎ `failed`/`warning` หรือ critical rule ล้ม) ระบบ SHALL สร้างเนื้อหาใหม่อีกครั้งโดยเพิ่ม feedback (ข้อความภาษาไทยของกฎที่ติด เรียงตามน้ำหนักมากไปน้อย) เข้าในคำขอ AI และ SHALL ประเมินใหม่ครบทั้ง 15 ข้อทุกครั้ง แล้วทำซ้ำจน gate status เป็น `pass` หรือถึงเพดานที่กำหนด

#### Scenario: meta_description นอกช่วงถูกสร้างใหม่
- **WHEN** ผลประเมินมีกฎ `meta_description` เป็น `failed`
- **THEN** ระบบสร้างเนื้อหาใหม่อีกครั้งพร้อม feedback ที่ระบุว่าคำอธิบาย meta ต้องยาว 120–160 ตัวอักษร
- **AND** รอบถัดไปประเมินใหม่ครบทั้ง 15 ข้อ

#### Scenario: เนื้อหาไม่มี H2 ถูกสร้างใหม่
- **WHEN** ผลประเมินมีกฎ `heading_structure` เป็น `failed`
- **THEN** ระบบสร้างใหม่อีกครั้งพร้อม feedback ให้เพิ่มหัวข้อ H2 ในเนื้อหา

#### Scenario: critical rule ล้มถูกสร้างใหม่แม้คะแนนถึงเกณฑ์
- **WHEN** คะแนน ≥ 90 แต่ critical rule `structured_data` เป็น `failed`
- **THEN** ระบบสร้างใหม่อีกครั้งพร้อม feedback ระบุ structured_data ต้องมี @context และ @type

### Requirement: pending skip ไม่กระตุ้นการสร้างใหม่
กฎ `pending` และ `skip` SHALL ไม่กระตุ้นการสร้างเนื้อหาใหม่ และ SHALL ไม่ถูกนับเป็นเหตุให้ `seo_passed = false` ส่วน `warning` และ `failed` SHALL กระตุ้นการสร้างใหม่เมื่อ gate status ยังไม่ใช่ `pass`

#### Scenario: research ยังไม่มี (pending) ไม่สร้างใหม่
- **WHEN** ผลประเมินมีกฎ `search_intent` เป็น `pending` และไม่มีกฎ `failed`/`warning` อื่นที่ทำให้ gate ไม่ผ่าน
- **THEN** ระบบคืนเนื้อหาให้ผู้ใช้ทันทีโดยไม่สร้างใหม่
- **AND** `seo_passed = true`

#### Scenario: คีย์เวิร์ดรองไม่ปรากฏ (warning) ถูกสร้างใหม่
- **WHEN** ผลประเมินมีกฎ `related_keywords` เป็น `warning` ที่ทำให้ gate status ไม่ใช่ `pass`
- **THEN** ระบบสร้างใหม่อีกครั้งพร้อม feedback ระบุคีย์เวิร์ดรองที่ควรเพิ่ม

### Requirement: คืนผลประเมิน SEO ใน response ของ generate-article
`generate-article` SHALL คืน `seo` (มี `score`, `gate`, และ `rules`) และ `seo_passed` (boolean) ควบคู่กับ `article` โดย `seo_passed = true` เมื่อ `seo_gate_status()` คืน `pass` และ `false` เมื่อคืน `warning` หรือ `failed`

#### Scenario: คืนผลประเมินพร้อมเนื้อหาและสถานะ gate
- **WHEN** `generate-article` สร้างเนื้อหาเสร็จ
- **THEN** response มี `article`, `seo` (`score` + `gate` + `rules`), และ `seo_passed`

#### Scenario: seo_passed สะท้อน gate status
- **WHEN** `seo_gate_status()` คืน `failed` หรือ `warning`
- **THEN** `seo_passed = false`

#### Scenario: seo_passed เป็น true เมื่อ gate ผ่าน
- **WHEN** `seo_gate_status()` คืน `pass`
- **THEN** `seo_passed = true`

### Requirement: เพดานการสร้างใหม่จำกัดจำนวนรอบ
ระบบ SHALL จำกัดจำนวนรอบสร้างใหม่ต่อคำขอ (ค่าคงที่ เช่น 3 รอบรวมรอบแรก) และเมื่อถึงเพดานแล้ว gate status ยังไม่ใช่ `pass` SHALL คืนเนื้อหาที่ดีที่สุดพร้อม `seo_passed = false` และผล `seo` ให้ผู้ใช้แทนการค้างหรือล้ม

#### Scenario: ถึงเพดานแล้วคืนเนื้อหาที่ดีที่สุด
- **WHEN** ระบบสร้างใหม่จนครบเพดานแล้ว gate status ยังไม่ใช่ `pass`
- **THEN** ระบบคืน `article` พร้อม `seo_passed = false` และผล `seo` ของรอบล่าสุด
- **AND** ระบบไม่เรียก AI เพิ่มเกินเพดาน
