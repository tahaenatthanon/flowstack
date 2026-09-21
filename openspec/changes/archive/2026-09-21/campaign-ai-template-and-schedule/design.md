## Context

Change `campaign-ai-generation` (archived) ทำให้ AI generate เนื้อหาแคมเปญได้ทั้งแบบเดี่ยวและแบบ batch แต่หลังใช้งานจริงพบช่องว่าง 5 กลุ่ม:

1. AI ไม่รู้จัก template เลย — `campaign_ai_system_prompt()` ไม่ส่งรายชื่อ template เข้า prompt เลย ผู้ใช้ต้องเลือกเองเสมอ ถ้าลืมเลือกอีเมลจะไม่มีแบรนด์ดิ้ง (ไม่มีโลโก้/สี/footer)
2. `aiPlanCampaigns()` ใช้ `angleInstructions` เป็น array คงที่ 3 รายการ วนด้วย `%` — เกิน 3 ฉบับจะซ้ำมุมกัน แต่ละ call เรียก AI แยกอิสระไม่เห็นกัน
3. `AICampaignPlanDialog` มีแค่ `<Input type="date">` ไม่มีเวลา — backend ใช้ `strtotime($startDate...)` ได้เที่ยงคืนเสมอ
4. การ์ดแคมเปญ ([CampaignsPage.tsx:998](../../../src/pages/CampaignsPage.tsx)) โชว์ `scheduled_at` เฉพาะ `status==='scheduled'` — แคมเปญ batch เริ่มเป็น `draft` เสมอ จึงมองไม่เห็นวันที่ที่เสนอไว้เลย และ single-create ไม่ persist `scheduled_at` ตอนบันทึกร่างด้วยซ้ำ (มีแค่ batch ที่ persist)
5. `sent_at` แสดงด้วย `toLocaleDateString` (วันที่อย่างเดียว) ต่างจาก `scheduled_at` ที่ใช้ `toLocaleString` (วันที่+เวลา)

เช็ค config แวดล้อมแล้ว: PHP `max_execution_time=120`, Apache `Timeout 300`, frontend `apiFetch()` ไม่มี client timeout — คอขวดจริงคือ PHP execution time ของ `email-campaigns.php` เพียงจุดเดียว เพราะ design ใหม่ (2 phase) อาจเรียก AI ต่อเนื่องถึง 11 ครั้งต่อ batch หนึ่งชุด (สูงสุด 10 ฉบับ)

## Goals / Non-Goals

**Goals:**
- AI เลือก template ให้เองเสมอ (เดี่ยวและ batch) โดยไม่ทับสิ่งที่ผู้ใช้เลือกไว้แล้ว
- Batch ที่มี N ฉบับ ได้ N หัวข้อที่แตกต่างกันจริง ไม่ซ้ำมุมกันเชิงโครงสร้าง
- เวลาส่งของแต่ละฉบับใน batch กระจายอย่างเหมาะสม ไม่ fix เที่ยงคืน
- ผู้ใช้เห็นวันที่/เวลาที่ AI เสนอไว้ได้ทันที ทั้งตอน generate เสร็จและตอนดูรายการภายหลัง แม้ยังเป็นร่าง
- Batch ไม่ล้มเหลวเพราะ PHP timeout เมื่อเลือกจำนวนฉบับเยอะ

**Non-Goals:**
- ไม่ทำระบบอนุมัติแบบ creator/approver คนละคน (พักไว้เป็น change แยกในอนาคต)
- ไม่ทำให้ AI เขียนสีเนื้อหาให้ตรงกับ light/dark theme ของ template ที่เลือก (พักไว้เช่นกัน — ต้องจัดหมวด template ก่อน เป็นงานแยกที่ยังไม่ scope ในรอบนี้)
- ไม่ทำ parallel AI calls (ยังคงเรียกทีละ call ต่อเนื่อง — แค่แก้ timeout ไม่แก้ความเร็ว)
- ไม่แตะ `product-catalog` capability หรือ schema ของ `products`

## Decisions

1. **Template list + ผลลัพธ์ `template_id` อยู่ใน prompt/JSON schema เดียวกับเนื้อหา ไม่แยก call ต่างหาก**
   เหตุผล: การเลือก template ต้องรู้เนื้อหาที่เขียนจริงก่อนถึงจะเลือกให้เข้ากันได้ (ตามที่ตกลงกันว่า batch แต่ละฉบับเลือกอิสระตามเนื้อหาของฉบับนั้น) การแยก call เพิ่มจะเสียเวลาและความซับซ้อนโดยไม่จำเป็น
   ทางเลือกที่พิจารณา: เลือก template ล่วงหน้าใน Phase 1 (ตอนวางแผนหัวข้อ) — ตัดออกเพราะตอนนั้นยังไม่มีเนื้อหาจริงให้ AI อ้างอิง เสี่ยงเลือกไม่เข้ากับสิ่งที่เขียนจริง

2. **Validate `template_id` ที่ AI ตอบกลับมาเทียบกับลิสต์จริงเสมอ**
   เหตุผล: AI อาจ hallucinate id ที่ไม่มีจริง ต้องมี fallback (เช่น ใช้ template แรกในลิสต์ หรือ template ที่กำหนดเป็นค่า default) ไม่ปล่อยให้ frontend เรียก `applyTemplateSelection()` ด้วย id ที่ไม่มีอยู่จริง

3. **Batch แยก 2 phase: วางแผน (หัวข้อ+เวลา) แล้วค่อยเขียน (เนื้อหา+template)**
   เหตุผล: หัวข้อ+เวลา ต้องเห็นภาพรวมทั้งชุดพร้อมกันถึงจะกระจายให้ไม่ซ้ำได้ (ตัดสินใจระดับซีรีส์) ส่วน template ต้องรู้เนื้อหาจริงก่อน (ตัดสินใจระดับฉบับ) สองอย่างนี้มีธรรมชาติการตัดสินใจต่างกัน จึงแยก phase ตามนั้น ไม่ใช่แบ่งเพราะสะดวก
   ทางเลือกที่พิจารณา: ให้ Phase 1 ตัดสินใจ template ไปด้วยเลย — ตัดออกด้วยเหตุผลเดียวกับข้อ 1

4. **วันที่ยังคำนวณจาก `start_date + i×interval_days` เหมือนเดิม เปลี่ยนแค่เวลา**
   เหตุผล: ผู้ใช้ยังคุมระยะห่างวันได้ตรงไปตรงมา (เป็น parameter ที่ผู้ใช้ตั้งใจกำหนดเอง) ส่วนเวลาในแต่ละวันเป็นรายละเอียดที่ AI ช่วยตัดสินใจแทนได้โดยไม่ขัดกับ intent ของผู้ใช้

5. **`createEmailCampaign()`/`updateEmailCampaign()` ต้องรับ `scheduled_at` แม้ตอนบันทึกร่าง**
   เหตุผล: เพื่อให้ single-create ที่ AI แนะนำวันที่ไว้ ไม่หายไปถ้าผู้ใช้กด "บันทึกร่าง" แทน "ตั้งเวลาส่ง" — ให้ single กับ batch ใช้กลไกเดียวกัน (เขียนลง DB ตั้งแต่ตอนสร้าง/แก้ไข ไม่ต้องรอ action `schedule`)
   ผลข้างเคียงที่ต้องระวัง: `scheduled_at` ที่มีอยู่ในแถว `draft` **ไม่ได้แปลว่าแคมเปญจะถูกส่งอัตโนมัติ** — cron อ่านจาก `status='scheduled'` เท่านั้น ไม่สนใจว่า `scheduled_at` มีค่าหรือไม่ ต้องคง invariant นี้ไว้ (ห้ามมี code path ไหนอนุมานจาก `scheduled_at IS NOT NULL` ว่าแคมเปญพร้อมส่ง)

6. **แยกคำว่า "วันที่เสนอ" (draft ที่มี `scheduled_at`) กับ "กำหนดส่ง" (`status='scheduled'` แล้วเท่านั้น) อย่างชัดเจนใน UI**
   เหตุผล: ป้องกันผู้ใช้เข้าใจผิดว่าเห็นวันที่แล้วแปลว่าจะส่งอัตโนมัติแน่นอน ทั้งที่ยังต้องกด "ตั้งเวลาส่ง"/"ส่ง" เองเสมอตาม safety gate เดิม

7. **`set_time_limit(0)` ใส่ที่หัวไฟล์ `email-campaigns.php` แบบไม่มีเงื่อนไข (เหมือน `brand-content.php`)**
   เหตุผล: action อื่นในไฟล์เดียวกัน (list/get/create/update/delete/send/schedule) ทำงานเร็วอยู่แล้ว การตั้งค่า 0 (ไม่จำกัด) ไม่กระทบ ไม่จำเป็นต้อง scope เฉพาะ action `generate-content`/`ai-plan`

## Risks / Trade-offs

- **[Risk]** Batch ที่เลือกจำนวนฉบับเยอะ (7-10) ยังคงใช้เวลารวมนาน (~100+ วินาที) แม้แก้ timeout แล้ว เพราะเรียก AI ทีละ call ต่อเนื่อง → **Mitigation**: อยู่นอกขอบเขต non-goal ของ change นี้ (ไม่ทำ parallel calls) — `AICampaignPlanDialog` ควรมี progress indicator ที่บอกความคืบหน้าเป็นฉบับ (เช่น "กำลังเขียนฉบับที่ 4 จาก 7") ไม่ใช่ spinner เดียวเฉยๆ เพื่อลดความรู้สึกค้าง
- **[Risk]** AI เลือก template ที่มีพื้นหลังเข้ม (เช่น "หรูหรูระดับพรีเมียม") แต่เขียนเนื้อหาด้วยสีตัวอักษร default (มักเป็นสีเข้ม) ทำให้อ่านไม่ออก (ข้อความสีเข้มบนพื้นเข้ม) → **Mitigation**: เป็น non-goal ของ change นี้ตามที่ตกลงไว้ — บันทึกเป็น known limitation ชัดเจน ผู้ใช้ควรพรีวิวก่อนส่งจริงเสมอ (มี tab "ตัวอย่าง" อยู่แล้วในไดอะล็อก) จนกว่าจะมี change แยกมาแก้เรื่อง theme matching
- **[Risk]** `scheduled_at` ที่มีอยู่ในแถว draft อาจถูกเข้าใจผิดโดย code ในอนาคตว่าหมายถึง "พร้อมส่ง" → **Mitigation**: ระบุ invariant ไว้ชัดเจนในคอมเมนต์โค้ดจุดที่เกี่ยวข้อง (cron, gate เดิม) ว่า source of truth คือ `status='scheduled'` เท่านั้น
- **[Risk]** Validate `template_id`/`suggested_scheduled_at` ที่ AI ตอบกลับมาผิดพลาด (id ไม่มีจริง, เวลาที่ผ่านไปแล้ว) → **Mitigation**: มี fallback ทุกจุด (template → ใช้ default, เวลา → ไม่ prefill ปล่อยว่างให้กรอกเอง) ไม่ทำให้ generate ทั้งหมดล้มเหลวเพราะ field เสริมผิดพลาด

## Migration Plan

1. ไม่มี DB migration ใหม่ (ใช้คอลัมน์ที่มีอยู่แล้วจาก change ก่อนหน้า: `scheduled_at`, `product_id`, `plan_batch_id`, `plan_sequence`)
2. แก้ `api/lib/campaign-ai-prompt.php` และ `api/email-campaigns.php` (schema ใหม่ + validate + `set_time_limit(0)`) ก่อน
3. แก้ frontend (`CampaignsPage.tsx`, `AICampaignPlanDialog.tsx`) ต่อ
4. ทดสอบ manual ผ่าน dev server ครบทุก flow ก่อนถือว่าเสร็จ (ตาม CLAUDE.md — ต้องมี evidence ไม่ใช่แค่ build ผ่าน)
5. Rollback: revert commit ได้ตรงๆ ไม่มี schema ต้อง rollback

## Open Questions

- ควรเพิ่ม progress indicator แบบ "กำลังเขียนฉบับที่ X จาก N" ใน `AICampaignPlanDialog` ไหม (ยกมาจาก risk ด้านบน — ยังไม่ตัดสินใจ ปล่อยเป็น nice-to-have ที่ไม่บล็อก tasks หลัก)
- เมื่อไหร่จะกลับมาทำเรื่องระบบอนุมัติ (creator/approver) และเรื่อง template color theme — ทั้งสองเรื่องถูกพักไว้นอก scope ของ change นี้โดยเจตนา
