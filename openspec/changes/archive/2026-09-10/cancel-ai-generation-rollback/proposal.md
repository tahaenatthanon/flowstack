## Why

หลัง `confirm-before-content-create` และ `confirm-before-ai-content-write` (archived 2026-09-10) ผู้ใช้ต้องยืนยันก่อนเริ่ม AI generation แล้วทุกจุด แต่**เมื่อยืนยันแล้วและเริ่มสร้างจริง ยังไม่มีทางยกเลิกที่ใช้งานได้จริงเลยสักจุด**:

- `QuickCreateDialog` และ `BatchGenerateDialog`: `handleClose` ดักไว้ว่า `if (!v && step === 'progress') return;` — กด X / Esc / คลิกฉากระหว่างกำลังสร้างจะเงียบ ไม่ทำอะไรเลย ไม่มี feedback ใดๆ
- `ContentPlannerAI` panel: ไม่มีปุ่มยกเลิกเลย และไม่บล็อกการ navigate ออกจากหน้า — งานยังรันต่อในเบื้องหลังแบบมองไม่เห็น
- `ContentCardDialog` ("AI เขียนให้"): ปิด dialog ได้ระหว่าง `aiGenerating` แต่ `runResearch()` ที่กำลังรันไม่ถูกตัด ผลลัพธ์จะยังเขียนทับ `article_content`/SEO ของ item เดิมแม้ผู้ใช้ปิดหน้าไปแล้ว

ทุกจุดมีปัญหาเดียวกัน: กดปิด/ยกเลิกแล้ว งานเบื้องหลังไม่หยุด ข้อมูลที่ backend เขียนไปแล้วก็ค้างอยู่โดยไม่มีใครรู้ ผู้ใช้ต้องไปไล่ลบเองด้วยมือ (ตามที่ทำจริงระหว่างทดสอบ change ก่อนหน้า)

## What Changes

- เพิ่มกลไก **cancel_requested flag** บน `content_items` (คอลัมน์ใหม่ ตาม pattern เดียวกับ `cron_runs.cancel_requested` ที่มีอยู่แล้วในระบบ) — ผู้ใช้กดยกเลิกแล้ว flag ถูกตั้งทันที (fire-and-forget ไม่บล็อก UI)
- Backend (`content-research.php` action=fetch/analyze, `brand-content.php` action=generate-article) เช็ค flag นี้ **ก่อนเขียนผลลัพธ์ลง DB ทุกจุด** — ถ้าถูกตั้งไว้แล้ว ไม่เขียนผลลัพธ์นั้น
- เพิ่ม endpoint ใหม่สำหรับตั้ง flag: `PUT /brand-content.php?action=cancel-item`
- เพิ่มปุ่ม/กลไกยกเลิกที่ใช้งานได้จริงระหว่าง progress ใน **ทั้ง 4 จุด**: `QuickCreateDialog`, `BatchGenerateDialog`, `ContentPlannerAI` panel (ผ่าน `ContentPlannerPage.handleGenerate`), `ContentCardDialog` ("AI เขียนให้")
- **Rollback แยก 2 แบบตามลักษณะเป้าหมาย**:
  - **เนื้อหาที่สร้างใหม่ในรอบนี้** (`QuickCreateDialog`, `BatchGenerateDialog`, `ContentPlannerAI` panel — ทุกจุดสร้าง `content_plans` ใหม่เสมอ): ยกเลิก = ลบทั้งแผนที่สร้างไปแล้วในรอบนั้นทั้งหมด (cascade content_items + content_plan_items) ผ่าน endpoint `DELETE /brand-content.php?action=plans&id=` ที่มีอยู่แล้ว **รวมถึงลบ `content_research_jobs`/`content_research_keywords` ที่เพิ่งสร้างในรอบนั้นด้วย** (ทับพฤติกรรม `SET NULL` เดิมที่ตั้งใจรักษา cache — ตามที่ตัดสินใจไว้ก่อนหน้าว่า "ยกเลิกจริง" ต้องไม่เหลือร่องรอยแม้ต้องเสีย cache)
  - **เนื้อหาเดิมที่กำลัง regenerate** (`ContentCardDialog` "AI เขียนให้" — แก้ item ที่มีอยู่ก่อนแล้ว ลบทั้ง item ไม่ได้): ยกเลิก = คืนค่า `article_content`/SEO fields กลับเป็น snapshot ก่อนกด "AI เขียนให้" แทนการลบ
- **ยอมรับข้อจำกัดทางเทคนิค**: PHP ไม่หยุดทำงานแค่ client ยกเลิก — step ที่กำลังรันอยู่ ณ ขณะกดยกเลิกจะรันจนจบตามธรรมชาติในเบื้องหลัง (ใช้เวลาเท่าที่เหลือ) แต่ผลลัพธ์จะไม่ถูกเขียน (ถ้า checkpoint ทันเวลา) หรือถูกลบ/คืนค่าทันทีที่ settle (การันตีด้วย rollback เสมอ ไม่ว่า checkpoint จะทันหรือไม่)

## Capabilities

### New Capabilities
- `ai-generation-cancel-rollback`: ผู้ใช้กดยกเลิกระหว่าง AI generation กำลังทำงานได้จริงทุกจุด และระบบรับประกันว่าจะไม่มีข้อมูลที่ไม่ต้องการหลงเหลืออยู่ (ลบ/คืนค่าอัตโนมัติ) แม้ step ปัจจุบันจะรันจนจบไปแล้วก่อนเช็คทัน

### Modified Capabilities
(ไม่มี — capability `content-generation-confirmation` ไม่เปลี่ยน requirement เดิม แค่ทำงานร่วมกับ capability ใหม่นี้)

## Impact

- **Database**: migration ใหม่เพิ่ม `content_items.cancel_requested TINYINT(1) NOT NULL DEFAULT 0`
- **Backend**: `api/content-research.php` (action=fetch, analyze — เพิ่ม checkpoint), `api/brand-content.php` (action=generate-article — เพิ่ม checkpoint; เพิ่ม action ใหม่ `cancel-item`; action=plans DELETE เดิมนำมาใช้ซ้ำสำหรับ rollback เต็มรูปแบบ แต่ต้องแก้ให้ลบ `content_research_jobs`/`content_research_keywords` ที่ผูกกับ item ในแผนนั้นด้วย ซึ่งเป็นพฤติกรรมใหม่ต่างจาก DELETE ปกติ — ต้องแยก endpoint หรือ parameter ให้ชัดว่าเป็น "cancel rollback" ไม่ใช่ "ลบแผนตามปกติของผู้ใช้" เพื่อไม่กระทบ use case ลบแผนทั่วไปที่ยังอยากรักษา cache)
- **Frontend**: `src/hooks/useResearchRun.ts` (เพิ่ม `cancel()`), `QuickCreateDialog.tsx`, `BatchGenerateDialog.tsx`, `ContentPlannerPage.tsx`, `ContentCardDialog.tsx` — ทั้ง 4 ไฟล์ต้องมี track ref ของ item/plan ที่สร้างไปแล้วในรอบปัจจุบัน เพื่อใช้ rollback ได้ถูกต้อง (`BatchGenerateDialog` ต้อง track เป็น array เพราะสร้างแยกแผนต่อหัวข้อ)
- **ไม่กระทบ** endpoint `DELETE /brand-content.php?action=plans&id=` เดิมที่ใช้จาก `useDeleteContentPlan` (ปุ่ม "ลบ" ปกติของผู้ใช้) — ต้องแยกจาก rollback path ให้ชัดเจนตามที่ระบุข้างต้น
