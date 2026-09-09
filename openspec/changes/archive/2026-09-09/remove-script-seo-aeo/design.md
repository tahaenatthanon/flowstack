## Context

Direct Content Generation (`api/brand-content.php` → `generate-article`) ปัจจุบันสร้าง SEO/AEO สองชั้น:

1. **Article/Core Content SEO/AEO** — ผ่าน `api/lib/seo-checklist.php` (`seo_evaluate()`, `seo_gate_status()`) และ AEO เทียบเท่า ครอบคลุมไว้ใน spec `seo-quality-gate` และ `content-seo-generation` แล้ว — **ไม่แตะ**
2. **Script SEO/AEO ต่อ platform** — ผ่าน `api/lib/script-quality-checklist.php` (`script_evaluate_seo()`, `script_evaluate_aeo()`, `script_quality_evaluate()`) ไม่เคยถูก spec ไว้อย่างเป็นทางการ แต่ฝังอยู่ใน 5 จุด: generation prompt, repair loop ใน `generate-article`, และ publish gate ที่กระจายอยู่ 3 ไฟล์ (`api/lib/publish-dispatch.php`, `api/content-publish.php`, cron auto-publish ใน `api/brand-content.php`)

จุดสำคัญที่ตรวจพบระหว่างวางแผน: **`script_quality_publish_check()` ประเมินสดจาก `article_content.scripts[platform]` ทุกครั้งที่เรียก ไม่ได้อ่านจาก field `script_quality` ที่บันทึกไว้** ดังนั้นการหยุดบันทึก `script_quality` เพียงอย่างเดียว **ไม่ทำให้ publish gate หยุดบล็อก** — ต้องลบจุดเรียกใช้ gate โดยตรงในทั้ง 3 ไฟล์ publish จึงจะได้ผล

## Goals / Non-Goals

**Goals:**
- Platform Script (ต่อ platform ที่เลือก) ไม่มี SEO/AEO evaluation, score, repair หรือ publish gate ของตัวเองอีกต่อไป
- Article/Core Content SEO/AEO ยังคงเป็นชุดเดียวของ Content ทำงานเหมือนเดิมทุกประการ (generate/display/edit/validate/save/publish gate)
- Headlines, Platform Scripts (เนื้อหา), Script Sections, ภาพประกอบ, Hashtags ยังสร้างครบตาม flow เดิม ไม่ลดรายละเอียด
- จำนวนภาพประกอบ/Hashtags เปลี่ยนจากตายตัว (ตัวอย่างเดิม 3 scene / 5 hashtag ในสคีมา) เป็นตามความเหมาะสมของเนื้อหา
- `SCRIPT_PLATFORMS` (routing constant แยก web vs script platform) ยังใช้งานได้ต่อไปหลังลบไฟล์ checklist

**Non-Goals:**
- ไม่แตะ Approval Gate (`approved_at`) — คนละ gate จาก Script SEO/AEO
- ไม่แตะ Article SEO/AEO gate, `seo-checklist.php`, ArticleEditor SEO panel, ContentArticleView SEO section
- ไม่เพิ่ม Quality Gate ใหม่ทดแทน Script SEO/AEO (เช่น ไม่สร้าง "Script Structure Gate" ใหม่) — เกินสโคป หากในอนาคตต้องการตรวจ Hook/CTA/Scene ครบ ให้เปิด change ใหม่แยก
- ไม่เปลี่ยน schema ฐานข้อมูล — ไม่มี column แยกสำหรับ Script SEO/AEO อยู่แล้ว (เก็บใน JSON ของ `article_content`)

## Decisions

### 1. ลบ publish gate call sites พร้อมกับ generation ในการ deploy เดียวกัน ไม่ทยอยลบทีละส่วน
**เหตุผล**: เพราะ `script_quality_publish_check()` ประเมินสดจาก script text ทุกครั้ง ไม่ใช่จาก field ที่บันทึกไว้ ถ้าลบเฉพาะ generation/repair ก่อนแล้วเว้น publish gate ไว้ Content ใหม่ที่ไม่ผ่าน repair (เพราะไม่มี repair แล้ว) จะไม่มีทางผ่าน publish gate เดิมได้เลย กลายเป็น Content ที่สร้างเสร็จแต่เผยแพร่ไม่ได้ถาวร
**ทางเลือกที่ปฏิเสธ**: ทยอยปิด (feature flag) — เกินความจำเป็นสำหรับการลบฟีเจอร์ที่ไม่เคยถูก spec ไว้ และเพิ่มความซับซ้อนโดยไม่มีประโยชน์ เพราะนี่คือการ "ปลดล็อก" (publish ง่ายขึ้น) ไม่ใช่ "เพิ่มข้อจำกัด" จึงไม่มี regression risk ต่อ user ที่ publish ได้อยู่แล้ว

### 2. ย้าย `SCRIPT_PLATFORMS` ออกจาก `script-quality-checklist.php` ก่อนเลิกใช้ไฟล์ ไม่ลบพร้อมกัน
**เหตุผล**: `SCRIPT_PLATFORMS` เป็น routing constant (แยก platform ที่เป็น script/social ออกจาก web platform) ถูกใช้ใน `publish-dispatch.php` และ `content-publish.php` เพื่อกำหนดว่าจะ evaluate Article SEO/AEO (web) หรือ Script gate (social) — เป็นคนละหน้าที่จาก SEO/AEO scoring ของ script เอง ถ้าลบไฟล์ทั้งไฟล์ทันทีจะทำให้ publish gate แยก web/script ไม่ได้เลย
**ทางเลือกที่เลือก**: ย้าย constant ไปประกาศใน `api/lib/publish-dispatch.php` (ไฟล์ปลายทางที่ใช้งานหลัก) ก่อน แล้วค่อยลบ `require_once` ของ `script-quality-checklist.php` ที่ไม่มี symbol เหลือให้ใช้
**ทางเลือกที่ปฏิเสธ**: คงไฟล์ `script-quality-checklist.php` ไว้ทั้งไฟล์เป็น "thin file" ที่มีแค่ constant — ทำให้ชื่อไฟล์ (`script-quality-checklist`) สื่อความหมายผิดจากเนื้อหาจริงที่เหลือ

### 3. ลบ evaluation functions ทั้งหมดแทนการปิดด้วย flag/config
**เหตุผล**: ฟังก์ชัน SEO/AEO evaluation (`script_evaluate_seo`, `script_evaluate_aeo`, `script_quality_evaluate`, `script_quality_check_platform`, `script_quality_publish_check`, `script_quality_generation_requirements`) ไม่ถูกใช้จากที่อื่นนอกเหนือ generation/publish/UI ที่ระบุไว้ในสโคปนี้แล้ว (ตรวจสอบ dependency ด้วย grep ทั่ว repo แล้วก่อนเขียน design นี้) การลบตรงจึงปลอดภัยกว่าและลดหนี้เทคนิค ไม่ต้องคง dead code ไว้เผื่ออนาคต
**หมายเหตุ**: หาก QA พบว่ามีการเรียกใช้จุดอื่นที่ grep ไม่ครอบคลุม (เช่น cron script แยกที่ไม่อยู่ใน `api/`) ให้หยุดและตรวจสอบก่อนลบจริงตาม tasks.md

### 4. Visuals/Hashtags: ปรับเฉพาะข้อความตัวอย่างใน prompt schema ไม่เพิ่ม validation ใหม่
**เหตุผล**: ตรวจโค้ดแล้วพบว่าจำนวน 2 ภาพ/5 hashtag ไม่เคยถูกบังคับด้วย validation ใดๆ อยู่แล้ว (เป็นแค่ตัวอย่าง shape ในสคีมาที่ป้อนให้ AI) จึงไม่ต้องเพิ่ม/ลด logic ใดๆ เพียงปรับถ้อยคำตัวอย่างใน `generate-article` prompt (ทั้ง video และ article branch) ให้เป็นกลางขึ้น ไม่ระบุจำนวนตายตัว
**ทางเลือกที่ปฏิเสธ**: เพิ่ม min/max validation ใหม่ — นอกสโคปของ requirement (ระบุแค่ "ตามความเหมาะสม" ไม่ใช่ "ต้องมีขั้นต่ำ/สูงสุด X")

### 5. ลำดับการแก้ backend: generation+gate ก่อน UI ก่อน tests ปิดท้าย
1. ย้าย `SCRIPT_PLATFORMS` → `publish-dispatch.php`
2. ลบ generation/repair logic ใน `brand-content.php` (`generate-article`)
3. ลบ publish gate call sites ทั้ง 3 จุด (`publish-dispatch.php`, `content-publish.php`, cron path ใน `brand-content.php`)
4. ลบ `api/lib/script-quality-checklist.php` (หลังไม่มีจุดใด require แล้ว)
5. ลบ dead code ใน `content-items.php` (invalidate `script_quality`)
6. ลบ UI ใน `ContentCardDialog.tsx`
7. ปรับ/เขียน test ใหม่ทั้งฝั่ง PHP และ frontend ให้ตรงกับ behavior ใหม่
8. รัน lint/test/build ยืนยันไม่มี regression ตาม Development Rules ข้อ 2 (VERIFY BEFORE DONE)

## Risks / Trade-offs

- **[Risk]** เนื้อหาเก่าที่เคยถูก block ไว้ด้วย Script SEO/AEO gate (สถานะ `revision`) จะไม่ได้รับการปลดบล็อกอัตโนมัติแค่เพราะ deploy โค้ดใหม่ เพราะสถานะ `revision` ถูกบันทึกไว้แล้วในอดีตและต้องผ่าน flow อนุมัติใหม่ตามปกติ → **Mitigation**: ไม่ต้อง migrate ข้อมูลเก่า เพราะ workflow อนุมัติใหม่ (resubmit → approve → publish) เป็น flow ปกติอยู่แล้ว ผู้ใช้แค่กด "ส่งอนุมัติ" ใหม่ ระบบจะไม่เจอ Script gate อีกต่อไป
- **[Risk]** ลบ `script_quality_generation_requirements()` ออกจาก prompt อาจทำให้ script คุณภาพลดลงจากการไม่มี "แนวทาง" ใดๆ กำกับ (ไม่ใช่แค่ SEO/AEO) เพราะข้อความเดิมปนทั้ง SEO/AEO instruction และ instruction ทั่วไป (เช่น "ห้ามสร้าง platform อื่นที่ไม่ได้เลือก") → **Mitigation**: ย้าย non-SEO/AEO constraint ที่จำเป็น (เช่น platform boundary, ห้าม copy ข้าม platform) ไปรวมไว้ใน prompt system message โดยตรง ไม่ลบทิ้งทั้งหมด — ระบุเป็น task แยกใน tasks.md
- **[Trade-off]** เลิก Script Quality Gate หมายความว่าไม่มีการควบคุมคุณภาพขั้นต่ำของ Script อีกเลย (ไม่ใช่แค่ SEO/AEO) เพราะระบบไม่เคยมี "Script Structure Gate" แยกจาก SEO/AEO — ยอมรับ trade-off นี้ตามที่ requirement ระบุชัดว่าต้องการลบ quality gate ของ Script ทั้งหมด หากอนาคตต้องการ non-SEO quality check (Hook/CTA ครบ) ต้องเปิด change ใหม่

## Migration Plan

ไม่มี database migration (ไม่มี column แยกสำหรับ Script SEO/AEO) Deploy เป็นโค้ดล้วน:
1. Deploy backend changes (generation + gate + lib) พร้อมกันในรอบเดียว ตาม Decision #1
2. Deploy frontend UI change
3. Deploy test updates คู่กับโค้ด (ไม่แยก PR ทดสอบ เพื่อไม่ให้ CI/test suite แดงระหว่างขั้นตอน)
4. Rollback: revert commit เดียวได้ทั้งหมดเพราะไม่มี schema เปลี่ยน — ไม่ต้อง migration ย้อนกลับ

## Open Questions

ไม่มี — ยืนยันสโคปและจุดที่ต้องแก้ทั้งหมดจากการตรวจโค้ดจริงแล้วก่อนเขียน design นี้
