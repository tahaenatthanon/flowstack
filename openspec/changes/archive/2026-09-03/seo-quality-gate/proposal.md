## Why

ปัจจุบัน SEO Checklist ทำหน้าที่เป็นเพียง "รายการตรวจหลังสร้าง" ที่หักคะแนนแบบคร่าว ๆ (fail = −12, warn = −4) จากกฎ ~12 ข้อ ทำให้คะแนนไม่สะท้อนคุณภาพ SEO จริง และ AI ที่สร้างเนื้อหาไม่ถูกบังคับให้ผ่าน Checklist ทุกข้อก่อนส่งผล — Checklist จึงไม่ใช่ "กฎที่ควบคุมการสร้าง Content" ตามที่ตั้งใจไว้

## What Changes

- **ขยาย Checklist เป็น 15 ข้อครบชุด** ครอบคลุม Technical SEO, Content Quality, Keyword, Search Intent, AI Research และ Structured Data:
  1. SEO Title, 2. Meta Description, 3. SEO Slug, 4. H1, 5. Heading Structure, 6. Content Length, 7. Search Intent, 8. Primary Keyword Placement, 9. Keyword Usage / Keyword Stuffing, 10. Related Keywords, 11. Topic Coverage, 12. PAA / Questions, 13. Content Gap, 14. Structured Data, 15. Internal Linking
- **เปลี่ยนการคิดคะแนนเป็น weighted scoring**: คะแนนเต็ม 100 โดยแต่ละข้อมีน้ำหนักตามความสำคัญ (รวม = 100) คำนวณจากผลตรวจ Content จริง — ไม่ใช่ pass/fail ล้วน และไม่ใช้ penalty คงที่
- **แสดงคะแนนรายข้อ + คะแนนรวม**: `seo_evaluate()` คืน `score` (รวม), `rules` (แต่ละข้อมี `score`/`weight`/`status`), และคะแนนรวมสะท้อนคุณภาพจริง
- **SEO Quality Gate**: กำหนดสถานะจากคะแนนรวม (90–100 Pass, 80–89 Warning, <80 Fail) และ **critical rules** — หาก checklist สำคัญไม่ผ่าน แม้คะแนนถึงเกณฑ์ก็ถือว่าไม่ผ่าน
- **บังคับใช้ Checklist ใน Workflow**: Generate Content → ตรวจทั้ง 15 ข้อ → คำนวณคะแนน → AI Repair (ถ้าติด) → ตรวจใหม่ทั้ง 15 ข้อ → Final Content ห้ามข้าม และ AI เลือกตรวจข้อใดข้อหนึ่งเองไม่ได้
- **BREAKING (score semantics)**: คะแนน `score` ของ `seo_evaluate()` เปลี่ยนจาก penalty คงที่ (−12/−4) เป็น weighted scoring (0–100 ตามน้ำหนักจริง) — ผู้เรียกที่พึ่งค่าคะแนนเดิม (publish gate เปรียบเทียบ `seo_gate_min_score`, UI แสดงคะแนน) ต้องปรับความหมาย
- **Additive (ไม่ breaking)**: กฎแต่ละข้อเพิ่มฟิลด์ `status`, `weight`, `score` ขณะคง `level` เดิม (pass/warn/fail/pending/skip) ไว้เป็น alias เพื่อให้โค้ดที่อ่าน `level` ยังทำงานได้

## Capabilities

### New Capabilities
- `seo-quality-gate`: การกำหนดสถานะ Pass/Warning/Failed จากคะแนนรวม + critical rules, และบังคับให้ทุก Content ผ่านการตรวจ 15 ข้อพร้อม AI Repair loop + ตรวจใหม่ทั้งชุดก่อนถือเป็น Final Content

### Modified Capabilities
- `content-seo-checklist`: เปลี่ยน `seo_evaluate()` จากกฎ ~12 ข้อ + penalty คงที่ เป็น 15 ข้อ + weighted scoring + คะแนนรายข้อ/รวม และระดับ status ใหม่ (pass/warning/failed/pending/skip)
- `content-seo-generation`: เปลี่ยน AI Repair loop ให้ตรวจใหม่ครบทั้ง 15 ข้อทุกครั้ง (เดิมตรวจเฉพาะ `fail` ของชุดเดิม) และเกตตาม Quality Gate status แทนการนับ `fail` อย่างเดียว

## Impact

- **Backend**: `api/lib/seo-checklist.php` (rewrite `seo_evaluate()` + เพิ่ม `seo_gate_status()` + weight catalog), `api/brand-content.php` (`generate-article` repair loop, `?action=seo-checklist`), `api/content-publish.php` + `api/cron/publish-scheduler.php` (เกตใช้ status ใหม่)
- **Frontend**: `src/components/content/ArticleEditor.tsx` (แผง SEO/AEO), `src/components/content/tabs/ContentApprovalTab.tsx`, `src/components/content/views/ContentDetailView.tsx`, `src/components/content/tabs/ContentListTab.tsx`, `src/components/content/dialogs/QuickCreateDialog.tsx`, `src/components/content/types.ts` (SeoChecklistResult)
- **Data dependency**: กฎ 7/10/11/12/13 (Search Intent, Related Keywords, Topic Coverage, PAA, Content Gap) อ่านจาก research brief (`content_research_jobs.analysis` + `content_research_keywords`) — เมื่อไม่มี research job จะเป็น `skip`/`pending` ไม่หักคะแนน
- **API response**: `generate-article` และ `?action=seo-checklist` คืนโครงสร้าง `seo` ใหม่ (score, gate status, rules พร้อมคะแนนรายข้อ)
