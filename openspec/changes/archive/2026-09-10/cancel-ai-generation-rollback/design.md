## Context

4 จุดเรียก AI generation (`QuickCreateDialog`, `BatchGenerateDialog`, `ContentPlannerAI` panel ผ่าน `ContentPlannerPage.handleGenerate`, `ContentCardDialog` "AI เขียนให้") ล้วนพึ่ง `useResearchRun().run()` ([useResearchRun.ts](../../../src/hooks/useResearchRun.ts)) ซึ่งยิง 3 คำขอ sequential: `content-research.php?action=fetch` → `action=analyze` → `brand-content.php?action=generate-article` ปัจจุบันไม่มีจุดไหนยกเลิกได้จริงระหว่างทำงาน (ดูเหตุผลใน proposal.md)

ระบบมี pattern คล้ายกันอยู่แล้วที่พิสูจน์แล้วว่าใช้งานได้จริงใน production: `cron_runs.cancel_requested` ([migration](../../../database/migrations/2026_06_08_200000_add_cancel_requested_to_cron_runs.sql)) เช็คผ่าน `isCancelled($db)` คั่นระหว่างแต่ละ record ในลูป ([publish-scheduler.php:15-20](../../../api/cron/publish-scheduler.php)) — เอา pattern นี้มาปรับใช้

**สองรูปแบบเป้าหมายที่ต่างกัน** ต้อง rollback ต่างกัน:
1. **สร้างใหม่ในรอบนี้** (QuickCreate/Batch/PlannerAI) — ทุกจุดสร้าง `content_plans` ใหม่เสมอ (ยืนยันจากโค้ด: ไม่มีจุดไหนส่ง `plan_id` เข้า `generate-plan`) → ยกเลิก = ลบทั้งแผนได้เลย ไม่กระทบใคร
2. **Regenerate ของเดิม** (ContentCardDialog "AI เขียนให้") — `existingItem.id` มีอยู่ก่อนแล้ว ลบ item ทิ้งไม่ได้ (อาจมีเนื้อหาเดิมที่ผู้ใช้ทำมาก่อน) → ยกเลิก = คืนค่า field ที่จะถูกเขียนทับ (`article_content`, SEO fields) กลับเป็นค่าก่อนกด

## Goals / Non-Goals

**Goals:**
- ปุ่ม/กลไกยกเลิกที่ใช้งานได้จริงระหว่าง progress ครบทั้ง 4 จุด — กดแล้ว UI ตอบสนองทันที ไม่มี step ถัดไปเริ่มอีก
- รับประกันว่าไม่มีข้อมูลที่ไม่ต้องการหลงเหลือหลังยกเลิก (ลบ/คืนค่าเสมอ ไม่ว่า checkpoint จะทันเวลาหรือไม่)
- Rollback ประเภท "สร้างใหม่" ต้องลบเกลี้ยงจริง รวม `content_research_jobs`/`content_research_keywords` ด้วย (ทับ `SET NULL` เดิม)

**Non-Goals:**
- ไม่ตัด network request ที่กำลัง in-flight จริงกลางคัน (ทำไม่ได้ด้วยสถาปัตยกรรม PHP synchronous ปัจจุบัน — ต้องเปลี่ยนเป็น async/streaming ทั้งระบบ ซึ่งเป็นงานคนละขนาด)
- ไม่แก้ endpoint `DELETE /brand-content.php?action=plans&id=` เดิมที่ผู้ใช้กด "ลบ" ปกติ (ต้อง**คง SET NULL เดิมไว้** เพื่อรักษา research cache — เพิ่ม endpoint ใหม่แยกสำหรับ rollback path เท่านั้น)
- ไม่แก้ cache semantics ของ `content_research_jobs` สำหรับ flow ปกติที่ไม่ถูกยกเลิก

## Decisions

### 1. `cancel_requested` อยู่ที่ระดับ `content_items` ไม่ใช่ `content_plans`
เหตุผล: หน่วยงานที่ทุก endpoint (`fetch`, `analyze`, `generate-article`) รับเป็นพารามิเตอร์ร่วมกันคือ `content_item_id`/`item_id` เสมอ — ไม่ใช่ `plan_id` ContentCardDialog "AI เขียนให้" ก็ไม่มี plan ใหม่ให้ผูกด้วยซ้ำ (ใช้ item ที่มีอยู่ก่อน) ระดับ item จึงเป็นหน่วยเดียวที่ครอบคลุมทั้ง 4 entry point ได้จริง

```sql
ALTER TABLE content_items
  ADD COLUMN IF NOT EXISTS cancel_requested TINYINT(1) NOT NULL DEFAULT 0 AFTER status;
```

### 2. Checkpoint 2 จุดต่อ item ไม่ใช่จุดเดียว
- **ต้นทาง (ก่อนยิง external call)**: `content-research.php` (fetch, analyze) และ `brand-content.php` (generate-article) เช็ค `cancel_requested` **ก่อนเริ่มงานเสมอ** — ถ้าถูกตั้งไว้จากขั้นก่อนหน้า (เช่น cancel ระหว่าง fetch แต่ analyze ยังไม่ทันเริ่ม) ให้ throw ทันทีไม่ยิง external call เลย ประหยัด credit ได้จริง
- **ปลายทาง (ก่อนเขียนผลลัพธ์)**: เฉพาะ `generate-article` เช็คซ้ำอีกครั้ง**ก่อน INSERT/UPDATE `content_items`** เพราะเป็นจุดเดียวที่เขียนผลลัพธ์ที่ผู้ใช้เห็นจริง (fetch/analyze เขียนแค่ `content_research_jobs` ซึ่งถูก rollback ลบทิ้งเสมออยู่แล้วไม่ว่าจะเช็ค checkpoint ทันหรือไม่ จึงไม่จำเป็นต้องมี end-checkpoint)
- **Reset ตอนเริ่มรอบใหม่**: `action=fetch` ต้อง `UPDATE content_items SET cancel_requested=0 WHERE id=?` ทุกครั้งที่เริ่ม fetch ใหม่ — ป้องกัน flag ค้างจากรอบที่แล้วบล็อกการสร้างครั้งถัดไปของ item เดิมถาวร

### 3. Endpoint ใหม่ 3 ตัว แยกจาก endpoint เดิมชัดเจน
- `PUT /brand-content.php?action=cancel-item` body `{item_id}` — ตั้ง `cancel_requested=1` (idempotent, fire-and-forget จาก frontend)
- `DELETE /brand-content.php?action=cancel-plan&id=<plan_id>` — rollback เต็มรูปแบบสำหรับ "สร้างใหม่": ลบ `content_research_keywords` (cascade อัตโนมัติจาก FK) → `content_research_jobs` ที่ `content_item_id IN (SELECT id FROM content_items WHERE plan_id=?)` → `content_items` → `content_plan_items` → `content_plans` (4 คำสั่งแรกต่างจาก `action=plans` DELETE เดิมตรงที่เพิ่มการลบ research_jobs ก่อน — endpoint เดิมไม่แตะเลย)
- `PUT /brand-content.php?action=restore-item` body `{item_id, article_content, title, type, caption, seo_title, slug, meta_description, meta_keywords, structured_data, og_image, status}` — คืนค่า field ที่ `generate-article` เขียนทับ กลับเป็นค่าที่ส่งมาตรงๆ **ไม่มี side effect ใดๆ** (ไม่ invalidate quality, ไม่แตะ `approved_at`) ต่างจาก PUT ทั่วไปของ item ที่มี logic invalidate quality/approval แฝงอยู่ ([brand-content.php:564-596](../../../api/brand-content.php)) ซึ่งถ้าใช้ตัวนั้นตรงๆ จะทำให้ item ที่เคย approved ถูกดีดเป็น `revision` ทั้งที่เนื้อหาจริงกลับมาเหมือนเดิมทุกอย่าง
- **เหตุผลที่แยก endpoint ไม่ใช้ query param บน endpoint เดิม**: `action=plans` DELETE และ PUT ทั่วไปของ item ผูกกับ flow ปกติที่ผู้ใช้แก้ไข/ลบด้วยความตั้งใจ — พฤติกรรม side effect (invalidate quality, รักษา research cache) ต้องคงเดิมสำหรับ flow นั้น การ rollback เป็นคนละเจตนาโดยสิ้นเชิง (คืนสภาพให้เหมือนไม่เคยเกิดอะไรขึ้น) จึงควรมี endpoint ของตัวเองชัดเจน ไม่ปนกัน

### 4. Rollback ประเภท "regenerate ของเดิม" (ContentCardDialog)
ตรวจโค้ด backend แล้วยืนยันว่า `generate-article` ([brand-content.php:2839-2860](../../../api/brand-content.php)) **เขียนตรงเข้า `content_items` ทันที** (`article_content`, `title`, `type`, `caption`, `seo_title`, `slug`, `meta_description`, `meta_keywords`, `structured_data`, `og_image`, `status` แล้วแต่เคส) รวมถึง `content_plan_items.article_content` ด้วย — **ไม่รอ "บันทึก" อีกที** ดังนั้น rollback ประเภทนี้ต้อง:
1. Snapshot field ทั้งหมดข้างต้นจาก `existingItem`/state ปัจจุบัน **ก่อน** เรียก `handleAI()`
2. ถ้ายกเลิกและตรวจพบว่า `generate-article` เขียนไปแล้วจริง (เช็คจาก response หรือ re-fetch item) → ยิง `PUT action=restore-item` ด้วย snapshot เดิม
3. ถ้ายกเลิกก่อน `generate-article` เขียนทัน (เช่น ยังอยู่ขั้น fetch/analyze) → ไม่ต้องคืนค่าอะไรเลย เพราะยังไม่มีอะไรถูกเขียนทับ

### 5. Frontend ต้อง track ref ของสิ่งที่สร้างไปแล้วในรอบปัจจุบัน
- `QuickCreateDialog`/`ContentPlannerPage.handleGenerate`: เก็บ `createdPlanIdRef` (plan เดียว)
- `BatchGenerateDialog`: เก็บ `createdPlanIdsRef: string[]` (แผนแยกต่อหัวข้อ ตามที่ยืนยันจากโค้ดจริงว่า `generate-plan` ถูกเรียกในลูป)
- `ContentCardDialog`: เก็บ snapshot ของ field ก่อนแก้ (ไม่ใช่ id เพราะ item มีอยู่แล้ว)
- ทุกจุดเก็บ `cancelledRef = useRef(false)` เพื่อหยุด loop ไม่ให้เริ่ม item/topic ถัดไปทันทีที่กดยกเลิก (ส่วนนี้ไม่ต้องรอ backend เลย ตัดได้จริง 100%)

### UI: ปุ่มยกเลิกที่ต้องเพิ่ม
- `QuickCreateDialog`/`BatchGenerateDialog`: เปลี่ยน `handleClose` ให้ไม่ block ระหว่าง progress อีกต่อไป แต่ให้กด X/Esc/ปุ่ม "ยกเลิก" ใหม่ในหน้า progress เรียก flow ยกเลิก (ตั้ง flag + track ref + close) แทนที่จะ no-op เงียบๆ แบบเดิม
- `ContentPlannerAI` panel: เพิ่มปุ่ม "ยกเลิก" ในสถานะ `isGenerating`/`isGeneratingArticles`
- `ContentCardDialog`: เพิ่มปุ่ม "ยกเลิก" แทนที่ spinner เฉยๆ ตอน `aiGenerating`

## Risks / Trade-offs

- **[Risk]** ยังมี "หน้าต่างเวลา" เล็กๆ ที่ external call (LLM/DataForSEO) กำลังรันพอดีตอนกดยกเลิก — checkpoint ต้นทางเช็คไม่ทัน เพราะ PHP call ไปแล้ว รอผลอยู่ **Mitigation**: end-checkpoint ก่อนเขียน `content_items` ที่ generate-article ดักจุดนี้ได้เกือบหมด (เว้นแต่ cancel มาในเสี้ยววินาทีสุดท้ายระหว่าง check กับ write จริง ซึ่งความน่าจะเป็นต่ำมากและ rollback ยัง cleanup ได้อยู่ดีถ้าจำเป็น)
- **[Risk]** `action=cancel-plan` เพิ่ม query ลบ `content_research_jobs`/`content_research_keywords` ต้องแน่ใจว่า scope เฉพาะ item ในแผนนั้นจริง ไม่หลุดไปกระทบ job ของ item อื่นที่ไม่เกี่ยวข้อง (WHERE ผ่าน subquery `content_item_id IN (SELECT id FROM content_items WHERE plan_id=?)` ต้อง execute **ก่อน** ลบ `content_items` เพราะพอลบ content_items ไปแล้ว subquery จะหาไม่เจอ)
- **[Risk]** เพิ่ม friction ให้ 4 UI ที่ต่างกัน (dialog แบบ block, panel ไม่ block, dialog แบบไม่ block) ต้องระวังไม่ให้ pattern การยกเลิกไม่สอดคล้องกันข้ามจุด — **Mitigation**: ยึด pattern เดียวกัน (ปุ่ม "ยกเลิก" ชัดเจน + toast "ยกเลิกแล้ว" ทันที) ทุกจุด แม้ UI container จะต่างกัน

## Migration Plan

1. สร้างและรัน migration `content_items.cancel_requested` ทันทีตาม [Database Migrations rule](../../../database/CLAUDE.md)
2. Deploy backend ก่อน (checkpoint + endpoint ใหม่) แล้วค่อย deploy frontend — backend เดิมไม่พังถ้า frontend ยังไม่เรียก endpoint ใหม่ (backward compatible)
3. ไม่มี data migration สำหรับแถวเดิม (`cancel_requested` default 0 ปลอดภัยสำหรับทุกแถวที่มีอยู่)

## Open Questions

(ไม่มี — ตรวจโค้ด backend ยืนยันแล้วว่า `generate-article` เขียนตรงเข้า `content_items`/`content_plan_items` ทันที ไม่รอ "บันทึก" ดูข้อ 4 ในหัวข้อ Decisions)
