## 1. Source of truth ใน api/lib/seo-checklist.php

- [x] 1.1 ประกาศ named constants สำหรับ threshold ที่ใช้ร่วม (SEO_TITLE_MAX=60, META_DESC_MIN=120, META_DESC_MAX=160, WORD_COUNT_MIN=500, H2_MIN=1, H1_MAX=1) ถัดจาก `SEO_PENALTY_FAIL`/`SEO_PENALTY_WARN`
- [x] 1.2 เพิ่มฟังก์ชัน `seo_generation_requirements(string $type): array` คืนรายการข้อกำหนดภาษาไทย (article/video) ที่อ้าง constants เดียวกับ `seo_evaluate()`
- [x] 1.3 เขียน unit test (Vitest/สคริปต์ PHP) ยืนยัน rule keys ที่ `seo_generation_requirements()` ครอบคลุมตรงกับ rule keys ที่ `seo_evaluate()` ผลิตสำหรับ type นั้น

## 2. ปรับ generate-article ใช้ข้อกำหนดร่วม

- [x] 2.1 แทนที่บล็อก `SEO/AEO Rules:` ที่ hardcode ใน `$mainSys` (บทความ) ด้วยผลจาก `seo_generation_requirements('article')`
- [x] 2.2 เพิ่มข้อกำหนดวิดีโอจาก `seo_generation_requirements('video')` ลงใน prompt วิดีโอ (บังคับ hashtag, ไม่บังคับ H2/word count/internal link)

## 3. ประเมิน + สร้างใหม่ใน generate-article

- [x] 3.1 ประกาศค่าคงที่เพดาน `SEO_GEN_MAX_ATTEMPTS = 3` (หรือเทียบเท่า) ใน `api/brand-content.php`
- [x] 3.2 ประกอบ `$itemForEval` (map `article_content`=$art array, `type`, `title`, `seo_title`, `slug`, `meta_description`, `meta_keywords`, `structured_data`, `og_image`) แล้วเรียก `seo_evaluate()`
- [x] 3.3 วน loop สร้างใหม่เมื่อมีกฎ `fail` และยังไม่ถึงเพดาน: ต่อ feedback (รายการ message ภาษาไทยของกฎ `fail`) เข้า user message แล้วเรียก AI ซ้ำ, sanitize + re-assemble `$art` แต่ละรอบ
- [x] 3.4 หลังวนเสร็จ เก็บผล `seo` (score + rules) และคำนวณ `seo_passed = (ไม่มีกฎ fail)`

## 4. คืนผลประเมินใน response

- [x] 4.1 เปลี่ยน `jsonResponse(['article' => $art])` เป็น `jsonResponse(['article' => $art, 'seo' => ['score'=>int,'rules'=>array], 'seo_passed' => bool])`

## 5. Frontend แสดงสถานะ SEO หลังสร้าง

- [x] 5.1 ใน `ContentDetailView.tsx` (`handleGenerateArticle`/`handleEditAI`) อ่าน `seo_passed` และแสดง toast เตือนเมื่อ `false`
- [x] 5.2 ทำแบบเดียวกันใน `ContentListTab.tsx` และ `QuickCreateDialog.tsx` (จุดที่เรียก `generate-article`)

## 6. Verify

- [x] 6.1 รัน `pnpm lint` และ `pnpm build` ให้ผ่าน
- [x] 6.2 ทดสอบสร้างเนื้อหาบทความ: meta_description/slug/H2/word_count ที่ AI สร้างผิดเกณฑ์จะถูกสร้างใหม่จนผ่าน หรือถึงเพดานแล้วคืน `seo_passed=false`
- [x] 6.3 ทดสอบสร้างวิดีโอ: hashtag ว่างถูกสร้างใหม่, กฎ H2/word count/internal link เป็น `skip`
- [x] 6.4 ยืนยัน `?action=seo-checklist` และเกตเผยแพร่เดิมไม่ถดถอย (spec `content-seo-checklist`)
