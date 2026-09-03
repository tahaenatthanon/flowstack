## 1. เพิ่ม rule tier ใน weight catalog

- [x] 1.1 เพิ่ม `tier` (required/optional/informational) ใน `SEO_WEIGHTS` แต่ละข้อ (internal_linking = optional, ที่เหลือ required)
- [x] 1.2 เพิ่ม constant `SEO_TIERS` หรือ map tier → behavior และคง `critical` flag เป็น alias (required + กลุ่ม critical เดิม)
- [x] 1.3 เพิ่ม status `n/a` ใน `seo_make_rule()` (level alias → skip) และ `seo_normalized_score()` (ตัด `n/a` ออกจาก denominator)

## 2. แก้ pending → failed / n/a ใน seo_evaluate()

- [x] 2.1 เปลี่ยน required rule ที่ data missing จาก `pending` เป็น `failed`: seo_title ว่าง, meta_description ว่าง, slug ว่าง, structured_data ว่าง, primary_keyword_placement ไม่มี keyword, content_length/heading_structure ไม่มี body
- [x] 2.2 เปลี่ยน research rules: research OFF → `n/a`; research ON + brief field ว่าง → `n/a`; research ON + มีข้อมูล → ตรวจจริง (coverage threshold เดิม)
- [x] 2.3 คง internal_linking เป็น optional (ไม่ block; ว่าง → `n/a` หรือ `needs_improvement` ตามความเหมาะสม)

## 3. seo_generation_requirements() เป็น generation contract

- [x] 3.1 เปลี่ยน return shape เป็น `{key, tier, requirement, min?, max?, pass_condition}` ต่อข้อ
- [x] 3.2 เพิ่ม min/max และ pass_condition ตาม threshold เดียวกับ `seo_evaluate()` (เช่น content_length min=500)
- [x] 3.3 คงการแยก article/video และ research-dependent rules

## 4. gate ตัดสินจาก required rules

- [x] 4.1 แก้ `seo_gate_status()` ให้ `failed` เมื่อมี required rule `failed` (ไม่ใช่แค่ critical) แม้ score ≥ 90
- [x] 4.2 ยืนยัน `n/a`/`skip` ไม่นับเป็น failure และ optional ไม่ block

## 5. Frontend รองรับ tier + status n/a

- [x] 5.1 อัปเดต `SeoRule`/status type ใน `src/components/content/types.ts` (เพิ่ม `tier`, status `n/a`)
- [x] 5.2 ปรับ `ArticleEditor.tsx` ให้แสดง tier (required/optional) และ status `n/a` ชัดเจน
- [x] 5.3 ตรวจ toast ใน `ContentDetailView.tsx`/`ContentListTab.tsx`/`QuickCreateDialog.tsx` ยังทำงานกับ gate ใหม่

## 6. Verify

- [x] 6.1 รัน `pnpm lint` — ผ่าน (0 errors)
- [x] 6.2 รัน `pnpm build` — ผ่าน
- [x] 6.3 รัน `pnpm test` — Vitest ผ่าน
- [x] 6.4 อัปเดต/รัน PHP test `scripts/test-seo-generation-requirements.php` — ยืนยัน required data missing = failed, research OFF = n/a, tier, gate ตัดสินจาก required
- [x] 6.5 รัน `php -l` บน `api/lib/seo-checklist.php` และ `api/brand-content.php`
- [x] 6.6 ยืนยัน publish gate + endpoint เดิมไม่ถดถอย
