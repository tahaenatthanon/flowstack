## 1. ปรับ weight catalog + status ใน api/lib/seo-checklist.php

- [x] 1.1 เปลี่ยน `SEO_WEIGHTS` เป็นชุดใหม่รวม = 100 (seo_title 8, meta_description 8, slug 6, h1 6, heading_structure 7, content_length 8, search_intent 8, primary_keyword_placement 8, keyword_stuffing 7, related_keywords 6, topic_coverage 8, paa_questions 6, content_gap 6, structured_data 5, internal_linking 3)
- [x] 1.2 คง `SEO_CRITICAL_RULES` = {seo_title, meta_description, h1, content_length, primary_keyword_placement, structured_data}
- [x] 1.3 เปลี่ยน status vocabulary: `passed` / `needs_improvement` / `failed` (คง `level` alias pass/warn/fail) ใน `seo_make_rule()`
- [x] 1.4 เปลี่ยน `seo_gate_status()` ให้คืน `passed|needs_improvement|failed`

## 2. เอา skip ออก — Video ตรวจครบ 15 ข้อด้วยวิธีวัดผล per-type

- [x] 2.1 สร้าง helper แยก source เนื้อหาตาม type (article: `article_content.html`; video: `scripts`+`script_sections`+`visuals`+`description`+`hashtags`)
- [x] 2.2 ปรับ `content_length` สำหรับ video ให้วัด word count ของ script (ไม่ skip); ไม่มี source → `pending`
- [x] 2.3 ปรับ `heading_structure` สำหรับ video ให้ประเมินจากโครงสร้าง script/section (ไม่ skip)
- [x] 2.4 ปรับ `h1` สำหรับ video ให้ใช้ title เป็น 1 h1 (ไม่ skip)
- [x] 2.5 ปรับ `internal_linking` สำหรับ video ให้วัดจาก description/landing (ไม่มี → `pending`)
- [x] 2.6 ปรับ `structured_data` สำหรับ video ให้ตรวจ `@type` เป็น VideoObject (ไม่ skip)
- [x] 2.7 ปรับ research rules (search_intent, related_keywords, topic_coverage, paa_questions, content_gap) ให้ตรวจทั้ง article/video เทียบกับ title+script+description (ไม่มี brief → `pending`)
- [x] 2.8 ยืนยันว่าไม่มี rule ใดคืน `skip` สำหรับ article/video (คง `skip` ได้เฉพาะกรณีที่ไม่มีข้อมูลวัดจริงซึ่งควรเป็น `pending`)

## 3. ปรับ generate-article repair loop ให้ใช้ passed/needs_improvement

- [x] 3.1 แก้ loop ใน `api/brand-content.php` ให้วนซ้ำขณะ `seo_gate_status() !== 'passed'` (ภายใน retry cap)
- [x] 3.2 feedback ส่งกฎ `failed`/`needs_improvement` เรียงตามน้ำหนักมาก→น้อย
- [x] 3.3 response `seo` = `['score', 'gate', 'rules']` และ `seo_passed` ตาม gate (`passed` → true)

## 4. ปรับ endpoint ?action=seo-checklist (ตรวจ SEO ใหม่)

- [x] 4.1 คืน `gate`/`rules` ด้วย status ใหม่ และแนบ research brief (คงเดิมจาก v1)
- [x] 4.2 ยืนยันว่า "ตรวจ SEO ใหม่" ไม่ mutate content (re-check อย่างเดียว)

## 5. ปรับ publish gate ให้ใช้ status ใหม่

- [x] 5.1 แก้ `seo_gate_check()` ให้ใช้ `seo_gate_status()` (status ใหม่) และคงอ่าน `seo_gate_enabled`/`seo_gate_min_score`
- [x] 5.2 ตรวจ `api/content-publish.php` และ `api/cron/publish-scheduler.php` ยังใช้ `seo_gate_check()` ต่อได้

## 6. Frontend รองรับ status ใหม่ + แสดง 15 ข้อไม่มี skip

- [x] 6.1 อัปเดต `SeoRuleStatus`/`SeoGateStatus` ใน `src/components/content/types.ts` (passed/needs_improvement/failed) + `SEO_GATE_LABEL`
- [x] 6.2 ปรับ `ArticleEditor.tsx` แผง SEO/AEO ให้แสดง status ใหม่ + คะแนนรายข้อ (score/weight) ครบ 15 ข้อ
- [x] 6.3 ปรับ toast ใน `ContentDetailView.tsx` / `ContentListTab.tsx` / `QuickCreateDialog.tsx` ให้ใช้ `seo.gate` (`passed`)
- [x] 6.4 ปรับ `ContentApprovalTab.tsx` ให้ใช้ `status`/`gate` ใหม่ (fallback status เก่า)

## 7. Verify

- [x] 7.1 รัน `pnpm lint` และ `pnpm build` ให้ผ่าน
- [x] 7.2 อัปเดต/รัน PHP test: 15 keys, weight sum = 100, status ใหม่, video ไม่มี skip (ครบ 15 ข้อ), gate thresholds
- [x] 7.3 ทดสอบ gate status: ≥90 passed / 80–89 needs_improvement / <80 failed / critical failed บล็อก
- [x] 7.4 ทดสอบ video ตรวจครบ 15 ข้อด้วยวิธี per-type (content_length จาก script, structured_data จาก Video schema)
- [x] 7.5 ทดสอบ research rules pending เมื่อไม่มี brief และไม่หักคะแนน
- [x] 7.6 ยืนยัน publish gate + endpoint เดิมไม่ถดถอย
