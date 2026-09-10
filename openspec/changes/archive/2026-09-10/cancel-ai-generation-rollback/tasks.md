## 1. Database migration

- [x] 1.1 สร้างไฟล์ `database/migrations/YYYY_MM_DD_HHMMSS_add_cancel_requested_to_content_items.sql` (ใช้วันที่/เวลาจริงตอน apply) — `ALTER TABLE content_items ADD COLUMN IF NOT EXISTS cancel_requested TINYINT(1) NOT NULL DEFAULT 0 AFTER status;`
- [x] 1.2 รัน migration ทันทีด้วย `mysql -u root flowstack < database/migrations/<filename>.sql` ตาม [Database Migrations rule](../../../database/CLAUDE.md)
- [x] 1.3 ตรวจสอบด้วย `SHOW COLUMNS FROM content_items` ว่าคอลัมน์ถูกเพิ่มจริง ค่า default เป็น 0
- [x] 1.4 ถ้ารันไม่สำเร็จ แก้ SQL แล้วรันซ้ำจนสำเร็จ

## 2. Backend: cancel-item endpoint + checkpoint ใน content-research.php

- [x] 2.1 เพิ่ม action ใหม่ใน `api/brand-content.php`: `PUT ?action=cancel-item` รับ `{item_id}` → `UPDATE content_items SET cancel_requested=1 WHERE id=? AND tenant_id=?` — idempotent, ไม่ error ถ้าเรียกซ้ำ
- [x] 2.2 ใน `api/content-research.php` action=fetch: เพิ่ม `UPDATE content_items SET cancel_requested=0 WHERE id=? AND tenant_id=?` ทันทีตอนเริ่ม (reset รอบใหม่) แล้วเช็ค `cancel_requested` ของ item **ก่อน** เรียก provider ภายนอก — ถ้าถูกตั้งไว้ (กรณี edge case ที่ตั้งไว้แล้วก่อน reset ทัน) ให้ throw error แบบมีข้อความชัดเจน (`jsonError('ถูกยกเลิกแล้ว', 409)` หรือเทียบเท่า) ไม่ยิง provider เลย
- [x] 2.3 ใน `api/content-research.php` action=analyze: เช็ค `cancel_requested` ของ item ที่ผูกกับ job **ก่อน** เรียก AI วิเคราะห์ — ถ้าถูกตั้งไว้ ให้ throw error เดียวกับ 2.2 ไม่เรียก AI เลย

## 3. Backend: checkpoint ใน generate-article + restore-item endpoint

- [x] 3.1 ใน `api/brand-content.php` action=generate-article: เพิ่มเช็ค `cancel_requested` **ตอนเริ่ม** (ก่อนเรียก AI Gateway) — ถ้าถูกตั้งไว้ throw error ไม่เรียก AI เลย
- [x] 3.2 เพิ่มเช็ค `cancel_requested` อีกครั้ง **ทันทีก่อน** บรรทัด UPDATE `content_items`/`content_plan_items` ที่ [brand-content.php:2839-2860](../../../api/brand-content.php) — ถ้าถูกตั้งไว้ ณ จุดนี้ ให้ข้ามการ UPDATE ทั้งหมด คืน response แบบระบุชัดว่าถูกยกเลิก (เช่น `{cancelled: true}`) แทนที่จะ throw (เพราะ AI เขียนงานเสร็จแล้วจริง ไม่ใช่ error)
- [x] 3.3 เพิ่ม action ใหม่: `PUT ?action=restore-item` รับ `{item_id, article_content, title, type, caption, seo_title, slug, meta_description, meta_keywords, structured_data, og_image, status}` → UPDATE ตรงๆ ทุก field ที่ส่งมา **ไม่มี logic invalidate quality/approval ใดๆ** (ต่างจาก PUT ทั่วไปที่ [brand-content.php:564-596](../../../api/brand-content.php) โดยเจตนา)

## 4. Backend: cancel-plan rollback endpoint

- [x] 4.1 เพิ่ม action ใหม่ใน `api/brand-content.php`: `DELETE ?action=cancel-plan&id=<plan_id>` — ลำดับการลบต้องเป็น:
  1. `DELETE FROM content_research_jobs WHERE content_item_id IN (SELECT id FROM content_items WHERE plan_id=? AND tenant_id=?)` (ต้องทำ**ก่อน**ลบ content_items เสมอ ไม่งั้น subquery หาไม่เจอ — ตามที่ระบุใน [design.md](design.md) หัวข้อ Risks; `content_research_keywords` cascade ลบเองผ่าน FK `ON DELETE CASCADE` อยู่แล้ว)
  2. `DELETE FROM content_items WHERE plan_id=? AND tenant_id=?`
  3. `DELETE FROM content_plan_items WHERE plan_id=?`
  4. `DELETE FROM content_plans WHERE id=? AND tenant_id=?`
- [x] 4.2 ตรวจสอบว่า endpoint เดิม `DELETE ?action=plans&id=` ([brand-content.php:609-616](../../../api/brand-content.php)) **ไม่ถูกแก้ไขเลย** ยังคงพฤติกรรมเดิมทุกประการ (ไม่แตะ content_research_jobs)

## 5. Frontend: useResearchRun รองรับ cancel

- [x] 5.1 ใน `src/hooks/useResearchRun.ts` เพิ่มฟังก์ชัน `cancel(itemId: string)` ที่เรียก `apiFetch('/brand-content.php?action=cancel-item', { method: 'PUT', body: JSON.stringify({ item_id: itemId }) })` แบบ fire-and-forget (ไม่ await ผลจาก caller ที่ต้องการ UI ตอบสนองทันที)
- [x] 5.2 export `cancel` จาก `useResearchRun()` เพิ่มเติมจาก `run`, `step`, `error`, `reset`

## 6. Frontend: QuickCreateDialog

- [x] 6.1 เพิ่ม `createdItemIdRef = useRef<string | null>(null)` — เก็บ item id ทันทีที่ `generate-plan` สำเร็จ (ก่อนเริ่ม research)
- [x] 6.2 เพิ่ม `createdPlanIdRef = useRef<string | null>(null)` — เก็บ plan id จาก response ของ `generate-plan`
- [x] 6.3 เพิ่ม `cancelledRef = useRef(false)`
- [x] 6.4 เอา `handleClose` ที่ block ระหว่าง `step === 'progress'` ออก — เปลี่ยนเป็นเรียก `handleCancel()` แทนเมื่อกด X/Esc/คลิกฉากระหว่าง progress
- [x] 6.5 เพิ่มปุ่ม "ยกเลิก" ในหน้า progress ([QuickCreateDialog.tsx](../../../src/components/content/dialogs/QuickCreateDialog.tsx) step 'progress')
- [x] 6.6 เขียน `handleCancel()`: ตั้ง `cancelledRef.current = true` → เรียก `cancel(createdItemIdRef.current)` (fire-and-forget) → toast "ยกเลิกแล้ว" → ปิด dialog ทันที (ไม่รอ) → ถ้ามี `createdPlanIdRef.current` ยิง `DELETE ?action=cancel-plan&id=` เป็น fire-and-forget เช่นกัน แล้ว invalidate `['content','plans']`/`['content','items']`
- [x] 6.7 ตรวจว่า `handleCreate` เดิมไม่ถูกแก้ไข logic หลักเลย (แค่เพิ่มการเก็บ ref)

## 7. Frontend: BatchGenerateDialog (ต้อง track array)

- [x] 7.1 เพิ่ม `createdPlanIdsRef = useRef<string[]>([])` — push plan id ทุกครั้งที่ `generate-plan` สำเร็จในลูป (สร้างแยกคนละแผนต่อหัวข้อ ตามที่ยืนยันจากโค้ดจริง)
- [x] 7.2 เพิ่ม `cancelledRef = useRef(false)` — เช็คใน loop ก่อนเริ่ม topic ถัดไปทุกครั้ง ถ้า true ให้ break loop ทันที
- [x] 7.3 เอา `handleClose` ที่ block ระหว่าง progress ออก + เพิ่มปุ่ม "ยกเลิก" ในหน้า progress
- [x] 7.4 เขียน `handleCancel()`: ตั้ง `cancelledRef.current = true` → เรียก `cancel(itemId)` ของ item ปัจจุบันที่กำลังรัน (ถ้ามี) → toast "ยกเลิกแล้ว" → ปิด dialog → วนลูป `createdPlanIdsRef.current` ยิง `DELETE ?action=cancel-plan&id=` ทุกแผนที่สร้างไปแล้ว (fire-and-forget ทั้งหมด ไม่ต้องรอทีละอัน) → invalidate queries

## 8. Frontend: ContentPlannerPage (Content Planner AI panel)

- [x] 8.1 เพิ่ม `createdPlanIdRef`, `cancelledRef` ใน `ContentPlannerPage.tsx` (pattern เดียวกับ QuickCreateDialog)
- [x] 8.2 ใน loop ของ `handleGenerate` ([ContentPlannerPage.tsx:250](../../../src/pages/ContentPlannerPage.tsx)) เช็ค `cancelledRef.current` ก่อนเริ่ม item ถัดไปทุกครั้ง ถ้า true ให้ break
- [x] 8.3 เพิ่มปุ่ม "ยกเลิก" ใน `ContentPlannerAI` panel component ตอน `isGenerating`/`isGeneratingArticles` เป็น true (ส่ง callback ใหม่ `onCancel` เข้า props เหมือน `onGenerate`)
- [x] 8.4 เขียน `handleCancelGenerate()`: ตั้ง `cancelledRef.current = true` → `cancel(itemId ปัจจุบัน)` → toast "ยกเลิกแล้ว" → `setGenerating(false)`/`setGeneratingArticles(false)` ทันที → ยิง `DELETE ?action=cancel-plan&id=` สำหรับ `createdPlanIdRef.current` → invalidate queries

## 9. Frontend: ContentCardDialog ("AI เขียนให้")

- [x] 9.1 เพิ่ม snapshot state/ref ก่อนเรียก `handleAI()`: เก็บค่าปัจจุบันของ `articleHtml`, `seoFields`, `existingItem.title`, `existingItem.type`, `existingItem.caption`, `existingItem.status` ไว้ใน ref
- [x] 9.2 เพิ่ม `cancelledRef = useRef(false)` และปุ่ม "ยกเลิก" แทนที่ spinner เฉยๆ ตอน `aiGenerating`
- [x] 9.3 เขียน `handleCancelAI()`: ตั้ง `cancelledRef.current = true` → `cancel(existingItem.id)` → toast "ยกเลิกแล้ว" → `setAiGenerating(false)` ทันที
- [x] 9.4 หลัง `runResearch()` resolve (ไม่ว่าจะสำเร็จหรือ error) เช็ค `cancelledRef.current` — ถ้า true และ response บ่งชี้ว่าเขียนผลลัพธ์ไปแล้ว (`res?.cancelled !== true` และมี `res?.article`) ให้ยิง `PUT ?action=restore-item` ด้วย snapshot ที่เก็บไว้ใน 9.1 ทันที แล้ว re-fetch/reset state UI กลับเป็นค่าเดิม

## 10. Manual verification (จำกัดเฉพาะสิ่งที่ไม่มีต้นทุน — ห้ามคลิกยืนยันจริงเพื่อทดสอบซ้ำๆ เหมือน change ก่อนหน้า)

**หมายเหตุ**: repo นี้ไม่มี PHP test framework (composer.json ไม่มี phpunit) — ตรวจ backend logic ด้วยมือผ่าน browser/Network tab เท่านั้น ไม่มี automated backend test ให้เขียน

- [x] 10.1 รัน `pnpm lint` และ `pnpm test` ให้ผ่านทั้งหมด (regression check — ไม่ควรกระทบเทสต์เดิมของ 2 change ก่อนหน้า เพราะไม่ได้แก้ logic เดิมของ `handleCreate`/`handleGenerate`/`handleAI`) — ผ่านทั้งหมด: lint 0 errors (มีแต่ warning เดิมที่ไม่เกี่ยวกับ change นี้), test 30 files / 201 tests ผ่านหมด
- [x] 10.2 ทดสอบด้วยมือ (เสีย credit บางส่วนจากการเริ่ม generation จริงแล้วยกเลิกกลางคัน — ต้องขอ sign-off จากผู้ใช้ก่อนเสมอ): เริ่มสร้างจริงใน Quick Create → กดยกเลิกระหว่าง step 'fetching' หรือ 'analyzing' → ตรวจ DB ว่า `content_plans`/`content_items`/`content_research_jobs` ที่เกี่ยวข้องถูกลบหมดจริงหลังจาก step ที่ค้างอยู่ settle — **พบบั๊กจริงระหว่างทดสอบรอบแรก**: กดยกเลิกเร็วกว่า `generate-plan` resolve ทำให้ `createdPlanIdRef`/`createdItemIdRef` ยังเป็น null, `cancel-item`/`cancel-plan` ถูกข้ามเงียบๆ, generation รันจนจบเต็ม (เสีย credit จริง ~$0.03-0.05, cleanup ด้วย SQL ตรงแล้ว) — แก้โดยเพิ่มจุดเช็ค `cancelledRef.current` ทันทีหลัง `generate-plan` resolve ใน `handleCreate` แล้วทดสอบซ้ำด้วยจังหวะเร็วสุดเท่าเดิม: `generate-plan` (201) → `cancel-plan` DELETE (200) ทันที ไม่มี fetch/analyze/generate-article เกิดขึ้นเลย ตรวจ DB ยืนยัน 0 แถวเหลือ
- [x] 10.3 ทดสอบเดียวกันกับ Batch (ยกเลิกหลังสร้างไปแล้ว ≥1 หัวข้อ) → ตรวจว่าทุกแผนที่สร้างไปแล้วถูกลบหมด ไม่ใช่แค่แผนแรก — ทดสอบจริง 3 หัวข้อ: ปล่อยหัวข้อ 1 สร้างจนจบสมบูรณ์ (fetch+analyze+generate-article สำเร็จ) → กดยกเลิกตอนหัวข้อ 2 กำลัง analyzing → ตรวจ DB: แผน/item/research job ของ**ทั้งหัวข้อ 1 (ที่เสร็จแล้ว) และหัวข้อ 2 (ที่ค้างอยู่)** ถูกลบหมด 0 แถวเหลือ ตรงตาม spec "ลบทุกแผนที่สร้างไปแล้ว ไม่ใช่แค่แผนแรก" และหัวข้อ 3 ไม่ถูกเริ่มเลย (ไม่มี generate-plan call) — **พบบั๊กเสริมระหว่างทดสอบ**: หลังยกเลิกแล้ว tail ของ flow เดิมที่ยังรันต่อในเบื้องหลังจนจบ loop กลับไปเด้ง toast "สร้าง content สำเร็จ! 🎉" ทับ toast "ยกเลิกแล้ว" (ข้อมูลจริงถูกลบไปแล้ว ข้อความจึงขัดแย้งกัน) — แก้โดยเพิ่ม `if (cancelledRef.current) return;` ก่อน toast/setStep ท้าย flow ทั้งใน `BatchGenerateDialog.tsx` และ `QuickCreateDialog.tsx` (จุดเดียวกันที่ ContentPlannerPage/ContentCardDialog มีการ์กันไว้อยู่แล้วตั้งแต่แรก)
- [x] 10.4 ทดสอบเดียวกันกับ Content Planner AI panel และ ContentCardDialog "AI เขียนให้" (กรณีหลังต้องเช็คว่า field คืนค่ากลับเป็นค่าเดิมจริง ไม่ใช่ว่างเปล่า) — **Planner AI panel**: กดยกเลิกทันทีตอน "กำลังสร้างแผน" (จังหวะเดียวกับที่เคยเจอบั๊กใน 10.2) → `generate-plan` (201) resolve แล้ว `cancel-plan` DELETE (200) ทันที ตรวจ DB 0 แถวเหลือ ยืนยัน fix เดียวกันครอบคลุมจุดนี้ด้วย. **ContentCardDialog "AI เขียนให้"** (ทดสอบกับ item จริงที่มีบทความอนุมัติแล้วอยู่ก่อน): กดยกเลิกตอน step แสดง "เขียนบทความ" (fetch เจอ cache ข้าม analyze ตรงเข้า generate-article) → `cancel-item` (ตั้ง `cancel_requested=1`) มาถึงก่อน `generate-article` เขียนผลลัพธ์เสร็จ → response กลับมาเป็น `{cancelled:true}` (checkpoint ปลายทางดักได้ทัน) → ตรวจ DB: `article_content`/`updated_at` ของ item **ไม่เปลี่ยนแปลงเลย** (ค่าเดิมก่อนกด "AI เขียนให้" ทุกประการ) → ไม่มีการเรียก `restore-item` เกิดขึ้น (ถูกต้องตรงตาม spec เพราะยังไม่มีอะไรถูกเขียนทับให้ต้องคืนค่า) — เส้นทาง "เขียนทับไปแล้วก่อน checkpoint จะทัน แล้วต้องเรียก restore-item จริง" ตรวจผ่าน code review เท่านั้น (จับจังหวะ race แคบมากด้วยการคลิกจริงไม่ได้ ทำได้แค่จำลองผ่านโค้ด ไม่ใช่ live click)
- [x] 10.5 ทดสอบว่าการลบแผนปกติ (ปุ่ม "ลบ" ใน `ContentPlannerAI` panel) ยังทำงานเหมือนเดิม ไม่ถูกกระทบจาก endpoint ใหม่ — ตรวจแบบไม่เสีย credit ด้วย SQL fixture (ไม่ผ่าน AI เลย): สร้าง plan/item/research_job ปลอมตรงๆ ยิง `DELETE ?action=plans&id=` จริงผ่าน curl → plan/plan_item/item ถูกลบหมด (0 แถว) แต่ `content_research_jobs` รอดด้วย `content_item_id=NULL` (SET NULL ไม่ใช่ CASCADE) — endpoint เดิมยืนยันไม่ถูกแตะเลย
- [x] 10.6 ทดสอบ item ที่เคยถูกยกเลิกไปแล้ว 1 ครั้ง แล้วลองสร้าง/regenerate ใหม่อีกครั้ง → ต้องไม่ถูกบล็อกจาก `cancel_requested` ที่ค้างจากรอบก่อน — ตรวจแบบไม่เสีย credit: ตั้ง `cancel_requested=1` ด้วย SQL จำลองรอบที่ถูกยกเลิกไปก่อนหน้า แล้วยิง `action=fetch` จริงผ่าน curl ด้วย seed เดิมที่มี cache อยู่แล้ว (168h) → ได้ HTTP 200 (ไม่ใช่ 409), `cached:true` (hit cache ไม่เรียก provider จริง) และ `cancel_requested` ถูก reset เป็น 0 ในฐานข้อมูลหลังเรียก — ยืนยัน reset-on-fetch ทำงานถูกต้องและไม่บล็อกรอบใหม่
