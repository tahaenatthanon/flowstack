## 1. Weight catalog และโครงสร้างผลลัพธ์ใหม่ใน api/lib/seo-checklist.php

- [x] 1.1 ประกาศ `SEO_WEIGHTS` เป็น const array 15 ข้อ (รวม = 100) พร้อม `critical` flags (ตาม design)
- [x] 1.2 ประกาศ `SEO_CRITICAL_RULES` และ threshold constants ที่ใช้ร่วม (นำของเดิม + เพิ่ม keyword stuffing ratio, heading structure rules)
- [x] 1.3 เพิ่ม helper `seo_gate_status(array $eval): string` คืน `pass|warning|failed` จาก score + critical rules
- [x] 1.4 เพิ่ม helper `seo_normalized_score(array $rules): int` คิดคะแนน normalized (ตัด skip/pending จากเศษและส่วน)

## 2. เขียน seo_evaluate() ใหม่เป็น 15 ข้อ + weighted scoring

- [x] 2.1 เปลี่ยน rule object เป็น `['key','level','status','weight','score','message']` โดย `level` คงเดิมเป็น alias
- [x] 2.2 Implement technical rules 1–6 (seo_title, meta_description, slug, h1, heading_structure, content_length) พร้อม status pass/warning/failed
- [x] 2.3 Implement keyword rules 8–9 (primary_keyword_placement, keyword_stuffing) ใช้ keyword/เนื้อหาเดิม + อัตราความถี่
- [x] 2.4 Implement research rules 7, 10–13 (search_intent, related_keywords, topic_coverage, paa_questions, content_gap) อ่านจาก research brief (`$item['research_brief']`/`article_content` meta) เป็น `pending` เมื่อไม่มี
- [x] 2.5 Implement rules 14–15 (structured_data, internal_linking) + คง hashtags สำหรับวิดีโอ
- [x] 2.6 คำนวณ `score` = normalized score และ return gate status ในผลลัพธ์ (หรือให้ผู้เรียกใช้ `seo_gate_status`)

## 3. ปรับ seo_generation_requirements() ครอบคลุม 15 ข้อ

- [x] 3.1 ขยาย `seo_generation_requirements()` ให้คืนข้อกำหนดครบ 15 ข้อ (เรียงตามน้ำหนัก) แทนชุดเดิม ~11 ข้อ
- [x] 3.2 คงการแยก ruleset article/video (วิดีโอข้ามโครงสร้างบทความ, บังคับ hashtag)
- [x] 3.3 อัปเดต test สคริปต์ให้ตรวจ rule keys ครบ 15 ข้อตรงกับ `seo_evaluate()`

## 4. ปรับ publish gate ให้ใช้ seo_gate_status

- [x] 4.1 แก้ `seo_gate_check()` ใน `api/lib/seo-checklist.php` ให้ใช้ `seo_gate_status()` (score < 80 หรือ critical failed) และคงอ่าน `seo_gate_enabled`/`seo_gate_min_score`
- [x] 4.2 ตรวจ `api/content-publish.php` และ `api/cron/publish-scheduler.php` ว่าเรียก `seo_gate_check()` ต่อได้โดยไม่พัง

## 5. ปรับ generate-article repair loop ให้ตรวจครบ 15 ข้อจนกว่า pass

- [x] 5.1 แก้ loop ใน `api/brand-content.php` จาก "ซ้ำเมื่อมี `fail`" เป็น "ซ้ำขณะ `seo_gate_status() !== 'pass'`" (ภายใน retry cap)
- [x] 5.2 feedback ส่งกฎ `failed`/`warning` เรียงตามน้ำหนักมาก→น้อย และประเมินใหม่ครบ 15 ข้อหลังแต่ละรอบ
- [x] 5.3 คืน response `seo` เป็น `['score', 'gate', 'rules']` และ `seo_passed` ตาม gate status

## 6. ปรับ endpoint ?action=seo-checklist

- [x] 6.1 คืนผลลัพธ์ใหม่ (`score`, `gate`, `rules` พร้อม weight/score) และคง `seo_gate_enabled`/`seo_gate_min_score`
- [x] 6.2 ส่ง research brief (ถ้ามี) ให้ `seo_evaluate()` เพื่อให้ research rules ไม่เป็น pending เสมอ

## 7. Frontend แสดงคะแนนรายข้อและสถานะ gate

- [x] 7.1 อัปเดต type `SeoChecklistResult` ใน `src/components/content/types.ts` (เพิ่ม `status`, `weight`, `score`, `gate`)
- [x] 7.2 ปรับ `ArticleEditor.tsx` แผง SEO/AEO ให้แสดงคะแนนรวม + คะแนนรายข้อ + สถานะ Passed/Warning/Failed + รายละเอียดข้อที่ไม่ผ่าน
- [x] 7.3 ปรับ toast ใน `ContentDetailView.tsx` / `ContentListTab.tsx` / `QuickCreateDialog.tsx` ให้ใช้ `seo.gate`/`seo.score` ใหม่
- [x] 7.4 ปรับ `ContentApprovalTab.tsx` ที่ใช้ `?action=seo-checklist` ให้รองรับโครงสร้างใหม่ (มี fallback สำหรับ status ที่ไม่รู้จัก)

## 8. Verify

- [x] 8.1 รัน `pnpm lint` และ `pnpm build` ให้ผ่าน
- [x] 8.2 เขียน/รัน PHP test ยืนยัน 15 rule keys, ผลรวมน้ำหนัก = 100, และ normalized score ถูกต้อง
- [x] 8.3 ทดสอบ gate status: score ≥ 90 pass / 80–89 warning / < 80 failed / critical failed บล็อกแม้คะแนนถึง
- [x] 8.4 ทดสอบ research rules เป็น pending เมื่อไม่มี brief และไม่หักคะแนน
- [x] 8.5 ยืนยัน publish gate + endpoint เดิมไม่ถดถอย
