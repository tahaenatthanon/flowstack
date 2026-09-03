## Why

Change ก่อนหน้า (`seo-quality-gate`, เก็บ archive แล้ว) ได้วาง SEO Quality Gate แบบ weighted scoring 15 ข้อไว้แล้ว แต่ยังมีช่องว่างสำคัญ: **Video ยังถูกตั้ง `skip` กฎบทความหลายข้อ** (heading_structure, content_length, internal_linking, research rules ฯลฯ) ทำให้ Video ไม่ถูกตรวจครบ 15 ข้อจริงตามข้อกำหนด และ **น้ำหนักยังรวมไม่เท่ากับ 100** ปัจจุบันระบบจึงยังไม่เป็น "กฎควบคุมคุณภาพก่อนจบ Generate" ที่สมบูรณ์แบบที่ตั้งเป้าไว้

## What Changes

- **ยกเลิกการ Skip สำหรับ Video** — ทุก content type (Article/Video) ต้องมีผลตรวจครบทั้ง 15 ข้อเสมอ โดยใช้วิธีวัดผลต่างกันตามลักษณะ content (ไม่ใช้ `skip` เพื่อข้าม)
- **ปรับน้ำหนัก 15 ข้อให้รวม = 100 พอดี** (จากข้อกำหนดเดิมที่รวมได้ 104):
  1. SEO Title 8, 2. Meta Description 8, 3. SEO Slug 6, 4. H1 6, 5. Heading Structure 7, 6. Content Length 8, 7. Search Intent 8, 8. Primary Keyword Placement 8, 9. Keyword Stuffing 7, 10. Related Keywords 6, 11. Topic Coverage 8, 12. PAA 6, 13. Content Gap 6, 14. Structured Data 5, 15. Internal Linking 3
  - หมายเหตุ: ลด Search Intent (10→8) และ Topic Coverage (10→8) เพื่อให้รวม = 100
- **เปลี่ยนชื่อ status** เป็น `Passed` / `Needs Improvement` / `Failed` (แทน `pass`/`warning`/`failed`)
- **Critical Checklist Failure** — critical rule ล้ม → Gate = Failed แม้คะแนนถึงเกณฑ์ (ชุด critical: seo_title, meta_description, h1, content_length, primary_keyword_placement, structured_data)
- **วิธีวัดผลต่อ content type** — Video วัด content_length จาก script, heading_structure จากโครงสร้าง script, internal_linking จาก description/landing, structured_data จาก Video schema; research rules ตรวจเหมือน Article
- **Evaluator เป็น Source of Truth** — ห้ามใช้ AI self-reported score / AI ระบุว่าผ่าน / ค่า score จาก AI / ตัดสินจาก prompt เพียงอย่างเดียว
- **ปรับ "ตรวจ SEO ใหม่" และ Repair เดิม** ให้ใช้ Evaluator 15 ข้อชุดเดียวกัน (ไม่สร้างปุ่ม/ฟีเจอร์ใหม่)

## Capabilities

### Modified Capabilities
- `seo-quality-gate`: เปลี่ยนชื่อสถานะเป็น Passed/Needs Improvement/Failed + น้ำหนักใหม่รวม 100 + critical failure
- `content-seo-checklist`: เปลี่ยน `seo_evaluate()` เป็น 15 ข้อ (น้ำหนักใหม่) โดยไม่ skip Video — ประเมินครบทุกข้อด้วยวิธีวัดผลตาม type
- `content-seo-generation`: repair loop + "ตรวจ SEO ใหม่" ใช้ Evaluator 15 ข้อชุดเดียว, re-check ครบ 15 ข้อหลัง repair

## Impact

- **Backend**: `api/lib/seo-checklist.php` (weight catalog ใหม่, เอา `skip` ออกสำหรับ Video → ใช้วิธีวัดผล per-type, status ใหม่), `api/brand-content.php` (repair loop, `?action=seo-checklist`, response status ใหม่)
- **Frontend**: `src/components/content/types.ts` (status `Passed/Needs Improvement/Failed`), `ArticleEditor.tsx` (SEO/AEO panel), `ContentApprovalTab.tsx`, `ContentDetailView.tsx`/`ContentListTab.tsx`/`QuickCreateDialog.tsx` (toast/gate)
- **Data**: research rules (Search Intent, Related Keywords, Topic Coverage, PAA, Content Gap) อ่านจาก research brief — เมื่อไม่มี brief เป็น `pending` (ไม่หักคะแนน) ตามเดิม
- **Behavior change**: Content เดิมจะไม่ถูก Generate/Repair อัตโนมัติ — ผู้ใช้กด "ตรวจ SEO ใหม่" เองเพื่อประเมินด้วยกฎใหม่
