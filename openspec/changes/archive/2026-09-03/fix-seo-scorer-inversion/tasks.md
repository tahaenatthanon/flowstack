## 1. ปรับ seo_evaluate() — research rules เข้มขึ้น

- [x] 1.1 เพิ่ม constants threshold (SEO_RELATED_MIN=0.6, SEO_TOPIC_MIN=0.7, SEO_TOPIC_FAIL=0.3, SEO_PAA_MIN=0.5, SEO_GAP_MIN=0.5) ใน `api/lib/seo-checklist.php`
- [x] 1.2 แก้ `related_keywords` ให้ =0 → `failed`, 0<x<0.6 → `needs_improvement`, ≥0.6 → `passed`
- [x] 1.3 แก้ `topic_coverage` ให้ <0.3 → `failed`, 0.3–0.7 → `needs_improvement`, ≥0.7 → `passed`
- [x] 1.4 แก้ `paa_questions` ให้ =0 → `failed`, 0<x<0.5 → `needs_improvement`, ≥0.5 → `passed`
- [x] 1.5 แก้ `content_gap` ให้ =0 → `failed`, 0<x<0.5 → `needs_improvement`, ≥0.5 → `passed`

## 2. search_intent ตรวจจริง (hybrid heuristic)

- [x] 2.1 เพิ่ม `seo_intent_signals(string $intent): array` map intent → signal terms (informational/commercial/transactional/navigational)
- [x] 2.2 แก้ `search_intent` ให้ตรวจ signal terms ของ intent เทียบกับ content: ตรง → `passed`, ขัด → `failed`, ไม่ชัด → `needs_improvement`, ไม่มี brief/intent → `pending`
- [x] 2.3 feedback repair loop ส่งผล `search_intent` + intent ภาษาไทยให้ AI ปรับเนื้อหา

## 3. แยก score กับ gate + repair จบด้วย failed

- [x] 3.1 ยืนยัน `seo_gate_status()` คืน `failed` เมื่อมี required/critical rule `failed` แม้ score ≥ 90
- [x] 3.2 แก้ `generate-article` ใน `api/brand-content.php`: หลัง repair loop ถ้า gate ≠ `passed` → save `status='revision'` + คืน `generation_status='failed'`
- [x] 3.3 response เพิ่ม `generation_status` (`success`|`failed`) และคง `seo_passed`

## 4. meta_keywords — ให้ AI ผลิต (research override)

- [x] 4.1 แก้ `generate-article` ให้ `$art['meta_keywords']` = research keywords เมื่อมี brief, มิฉะนั้น `$mainData['meta_keywords'] ?? ''`
- [x] 4.2 ยืนยัน `primary_keyword_placement`/`keyword_stuffing` ไม่เป็น `pending` ถาวรเมื่อ AI ผลิต keyword ให้

## 5. Frontend แสดง generation failed + status revision

- [x] 5.1 ปรับ toast ใน `ContentDetailView.tsx` / `ContentListTab.tsx` / `QuickCreateDialog.tsx` ให้ใช้ `generation_status` และแสดง "สร้างไม่ผ่าน SEO → สถานะ revision"
- [x] 5.2 ปรับ `ArticleEditor.tsx` ให้แสดง rule ที่ `failed` ชัดเจน (ถ้าจำเป็น)

## 6. Verify

- [x] 6.1 รัน `pnpm lint` — ผ่าน (0 errors)
- [x] 6.2 รัน `pnpm build` — ผ่าน
- [x] 6.3 รัน `pnpm test` — Vitest ผ่าน
- [x] 6.4 อัปเดต/รัน PHP test `scripts/test-seo-generation-requirements.php` — ยืนยัน research rules เป็น `failed` เมื่อ coverage = 0, search_intent ตรวจจริง, meta_keywords จาก AI
- [x] 6.5 รัน `php -l` บน `api/lib/seo-checklist.php` และ `api/brand-content.php`
- [x] 6.6 ทดสอบ repair loop: gate ไม่ผ่านครบ max attempts → `status=revision` + `generation_status=failed`
- [x] 6.7 ยืนยัน publish gate + endpoint เดิมไม่ถดถอย
