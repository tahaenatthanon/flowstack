## Context

เส้นทางสร้างเนื้อหาใน `api/brand-content.php`:

1. `generate-plan` สร้าง `content_plan_items` + `content_items` (1 รายการ/topic) และบันทึก `type` ที่ผู้ใช้เลือก
2. `generate-article` อ่าน `content_items.type` แล้วสร้าง prompt แยกบทความ/วิดีโอ, เรียก AI, แล้ว UPDATE `content_items` + `content_plan_items` พร้อม SEO metadata ก่อนคืน `['article' => $art]`

ปัญหาสองข้อ:

- **กฎ SEO ใน prompt ถูก hardcode** ที่ `$mainSys` (ส่วน `SEO/AEO Rules:` สำหรับบทความ) แยกจากตัวประเมินจริง `seo_evaluate()` ใน `api/lib/seo-checklist.php` — สองชุดนี้ลอยจากกันได้ (เช่น prompt บอก "150-160 chars" แต่ตัวประเมินรับ 120–160)
- **ไม่มีการตรวจหลังสร้าง** — เนื้อหาที่ติดกฎ `fail` (meta_description นอกช่วง, ไม่มี H2, คำไม่ถึง 500, slug ผิดรูปแบบ) ถูกส่งให้ผู้ใช้ทันที ผู้ใช้มารู้ทีหลังในแผง SEO/AEO

`seo_evaluate(array $item): array` เป็นฟังก์ชันบริสุทธิ์ คืน `['score' => int, 'rules' => array<{key, level, message}>]` โดย `level ∈ {pass, warn, fail, pending, skip}` และเลือก ruleset จาก `$item['type']` (article/video) อยู่แล้ว — จึงเป็นจุดเดียวที่ควรเป็น "source of truth" ของกฎ

## Goals / Non-Goals

**Goals:**
- ทำให้ AI prompt ใช้กฎชุดเดียวกับ `seo_evaluate()` (ลด drift)
- ประเมินเนื้อหาที่สร้างด้วย `seo_evaluate()` หลังสร้าง และสร้างใหม่พร้อม feedback เมื่อมีกฎ `fail` จนไม่มี `fail` (ภายในเพดาน)
- เลือก ruleset ตาม `type` ที่ผู้ใช้เลือก (article/video)
- คืนผลประเมิน (`seo`, `seo_passed`) ใน response ของ `generate-article`

**Non-Goals:**
- ไม่เปลี่ยน requirement ของ `seo_evaluate()` / เกตเผยแพร่ (spec `content-seo-checklist` คงเดิม)
- ไม่บังคับเกตเผยแพร่ตอนสร้าง — เฉพาะกฎ `fail` เท่านั้นที่กระตุ้นการสร้างใหม่; `pending`/`warn`/`skip` ไม่ขัดขวาง
- ไม่เพิ่ม DB schema / migration
- ไม่แก้ตัวสร้างภาพ (`generate-image`, `og_image`) — `og_image` ว่างเป็น `pending` ไม่กระตุ้นการสร้างใหม่

## Decisions

### 1. Source of truth อยู่ที่ `api/lib/seo-checklist.php` — แยกค่าตัวเลขเป็น constants + helper สร้าง prompt
ย้ายตัวเลข threshold (60 / 120–160 / 500 / 1) ไปเป็น named constants ในไฟล์เดิม (ถัดจาก `SEO_PENALTY_FAIL`/`SEO_PENALTY_WARN` ที่มีอยู่) แล้วเพิ่ม `seo_generation_requirements(string $type): array` คืนรายการข้อกำหนดภาษาไทยที่ฉีดเข้า prompt บทความ/วิดีโอ โดยทั้ง `seo_evaluate()` และ helper นี้ อ่านค่า constants เดียวกัน

- **เหตุผล**: ป้องกัน drift โดยไม่ต้อง rewrite `seo_evaluate()` (เสี่ยงถดถอย) — แค่ให้สองจุดอ่านค่าคงที่เดียวกัน
- **ทางเลือกที่พิจารณา**: (a) rewrite `seo_evaluate()` ให้อ่านจาก rule catalog เดียว — สะอาดสุดแต่ invasive และเสี่ยงเปลี่ยนพฤติกรรมเดิม; (b) ปล่อย prompt hardcode ต่อ — แก้ปัญหาไม่ครบ เลือก constants + helper ร่วมในไฟล์เดียวกันเป็นจุดกึ่งกลางที่เสี่ยงต่ำ

### 2. ประเมิน + สร้างใหม่ภายใน `generate-article` (loop ไม่ใช่ endpoint แยก)
หลังประกอบ `$art` และ `$ciType` เสร็จ ให้สร้าง `$itemForEval` ที่แมปฟิลด์ (`article_content` เป็น array `$art`, `type`, `title`, `seo_title`, `slug`, `meta_description`, `meta_keywords`, `structured_data`, `og_image`) แล้วเรียก `seo_evaluate($itemForEval)`; ถ้ามีกฎ `fail` และยังไม่เกินเพดาน ให้ต่อข้อความ feedback (รายการ message ภาษาไทยของกฎที่ติด) เข้า user message แล้วเรียก AI ซ้ำ

- **เหตุผล**: ใช้ฟังก์ชัน/โมเดล/เวลาเดิม ไม่ต้องเปิด endpoint หรือ state ใหม่
- **ทางเลือก**: สร้าง action แยก (เช่น `?action=fix-seo`) แล้วให้ frontend วนเรียก — เพิ่ม round-trip และซับซ้อน frontend ไม่เลือก

### 3. เพดานการสร้างใหม่ = ค่าคงที่ `SEO_GEN_MAX_ATTEMPTS = 3` (รวมรอบแรก)
วนสร้างใหม่เฉพาะเมื่อมี `fail`; ครบเพดานแล้วคืนเนื้อหาที่ดีที่สุดพร้อม `seo_passed = false` และผล `seo` ให้ frontend แสดงเตือน

- **เหตุผล**: กัน token/latency พุ่ง และกัน loop ไม่จบจากโมเดลที่ไม่ทำตาม feedback

### 4. Feedback ต่อการสร้างใหม่
ในการวนรอบถัดไป เพิ่มข้อความเช่น "เนื้อหายังไม่ผ่านเกณฑ์ SEO — แก้ไขเฉพาะจุดต่อไปนี้แล้วส่ง JSON ใหม่ให้ครบทุกส่วน: …" พร้อมรายการ message ของกฎ `fail` ไม่เปลี่ยน system prompt หลัก

- **เหตุผล**: โมเดลแก้จุดที่ติดตรงที่สุด, ลดความเสี่ยงที่จะรื้อเนื้อหาที่ผ่านแล้ว

### 5. Response shape เพิ่มฟิลด์แบบ additive
คืน `['article' => $art, 'seo' => ['score' => int, 'rules' => array], 'seo_passed' => bool]`

- **เหตุผล**: ผู้เรียกเดิม (frontend) อ่าน `article` ต่อได้ไม่พัง; เพิ่มฟิลด์ใหม่ให้แสดงสถานะ SEO ทันที
- `seo_passed` = "ไม่มีกฎ `level = 'fail'`" (สอดคล้องเกตเผยแพร่ที่ `seo_gate_min_score = 0`); ไม่ผูกกับ score threshold

### 6. Frontend: แจ้งเตือนเมื่อ `seo_passed = false`
จุดที่เรียก `generate-article` (`ContentDetailView`, `ContentListTab`, `QuickCreateDialog`) อ่าน `seo_passed` และแสดง toast เตือนเมื่อไม่ผ่าน (แผง SEO/AEO เดิมยังใช้ `?action=seo-checklist` ต่อ)

- **เหตุผล**: ผู้ใช้เห็นสถานะทันทีหลังสร้าง โดยไม่ต้องเพิ่ม UI ใหญ่

## Risks / Trade-offs

- **สร้างใหม่เพิ่ม latency/token** → ลดด้วยเพดาน 3 รอบ และสร้างใหม่เฉพาะเมื่อมี `fail` (กรณีปกติ 1 รอบ)
- **drift prompt↔evaluator ยังเหลือบางจุด** (เช่นข้อความอธิบาย ไม่ใช่ threshold) → วาง helper ไว้ไฟล์เดียวกับ `seo_evaluate()` และเพิ่ม unit test ว่า requirement keys ครอบคลุม rule keys
- **วิดีโอ hashtags เป็น `fail`** → prompt วิดีโอต้องบังคับ hashtag และ feedback รอบถัดไปแจ้ง "ต้องมี hashtag อย่างน้อย 1" โดย `seo_evaluate` อ่าน `article_content.hashtags`
- **`seo_word_count` นับไทย ~4 อักษร/คำ** → เนื้อหาไทยสั้นอาจนับไม่ถึง 500 แม้อ่านแล้วยาว → feedback แจ้งให้ "เพิ่มเนื้อหาให้ยาวขึ้น" อย่างชัดเจน
- **`slug` regex บังคับ lowercase** → prompt/feedback ต้องระบุ "ตัวพิมพ์เล็ก คั่นขีด (a-z, 0-9, -)"

## Migration Plan

- ไม่มี schema change / migration
- Deploy: อัปโหลด `api/lib/seo-checklist.php` + `api/brand-content.php` (+ frontend toast) — กลับได้ด้วยการ revert ไฟล์
- Rollback: revert ไฟล์ข้างต้น ไม่มีข้อมูลต้องย้าย
