## 1. Prompt Builder — Template Selection

- [x] 1.1 ใน `src/data/emailTemplates.ts` ไม่ต้องแก้ (ใช้ `id`+`nameTH` ที่มีอยู่แล้วส่งเข้า prompt) — ยืนยันว่าไม่ต้องเพิ่ม field ใหม่ในรอบนี้ (เรื่อง light/dark theme พักไว้)
- [x] 1.2 แก้ `api/lib/campaign-ai-prompt.php`: `campaign_ai_system_prompt()` รับ list ของ template (id+nameTH) เพิ่ม section ใน prompt ให้ AI เลือก คืน field `template_id` ในผลลัพธ์
- [x] 1.3 เพิ่มฟังก์ชัน validate `template_id` ที่ AI ตอบมา เทียบกับ id ที่มีจริง — ถ้าไม่ตรง fallback เป็น template default (กำหนดตัวแรกหรือ 'template-1')
- [x] 1.4 ถ้ามีการส่ง `current_template_id` เข้ามา (ผู้ใช้เลือกไว้ก่อนแล้ว) prompt ต้องสั่งไม่ให้ AI เปลี่ยน — backend ไม่ overwrite `template_id` ที่ frontend ส่งมาเป็นผลลัพธ์กลับ (คืนค่าเดิมกลับไปเฉยๆ)

## 2. Prompt Builder — Tone และ Suggested Schedule

- [x] 2.1 เพิ่มค่า tone ใหม่ `'auto'` ใน `campaign_ai_system_prompt()` — ถ้า tone เป็น `'auto'` ให้ AI อนุมานโทนจากสินค้า/หัวข้อเอง (ไม่ fix เป็น friendly)
- [x] 2.2 เพิ่ม field `suggested_scheduled_at` (format `YYYY-MM-DD HH:MM:SS`) ใน JSON schema ที่ `_callCampaignAI()`/prompt คืนกลับมา สำหรับ action `generate-content` (single) เท่านั้น — ไม่ใช้ใน `ai-plan` (batch มี logic เวลาของตัวเองตามงานข้อ 4)
- [x] 2.3 Validate `suggested_scheduled_at`: ต้องเป็นวันที่ในอนาคต (เทียบกับ `NOW()`) ถ้าไม่ผ่าน ไม่คืนค่านี้กลับ (ไม่ error ทั้ง request)

## 3. Backend — action `generate-content` (เดี่ยว)

- [x] 3.1 รับ `current_template_id` (nullable) และ `tone` (รองรับค่า `'auto'`) เพิ่มใน request body
- [x] 3.2 คืนผลลัพธ์เพิ่ม `template_id`, `suggested_scheduled_at` ใน response JSON ควบคู่กับ `subject`/`name`/`body_html` เดิม

## 4. Backend — action `ai-plan` (batch) แยก 2 phase

- [x] 4.1 เขียน Phase 1: เรียก AI ครั้งเดียว ส่ง `count`, สินค้า, tone เข้าไป ขอ JSON array กลับมา `[{topic, send_time}, ...]` จำนวน `count` รายการ ให้หัวข้อกระจายไม่ซ้ำและเวลากระจายไม่ซ้ำ
- [x] 4.2 Validate ผลลัพธ์ Phase 1: จำนวนรายการต้องตรงกับ `count` ที่ขอ ถ้าไม่ตรง (AI ตอบมาไม่ครบ) fallback เติมหัวข้อ/เวลา generic ให้ครบจำนวนแทนที่จะ error ทั้ง request
- [x] 4.3 แก้ loop เดิม (เคยใช้ `angleInstructions[$i % 3]`) ให้ใช้ `topic`/`send_time` จาก Phase 1 แทน — ลบ `angleInstructions` array คงที่ทิ้ง
- [x] 4.4 Phase 2 (loop เดิม N ครั้ง): แต่ละ call ส่ง `source_topic` = topic จาก Phase 1 เข้า `campaign_ai_user_message()` แทนมุมกว้างๆ เดิม, รับ `template_id` กลับมาต่อฉบับ (reuse logic validate จากงาน 1.3)
- [x] 4.5 คำนวณ `scheduled_at` ต่อฉบับ = `start_date + (sequence-1)*interval_days` (วันที่, เหมือนเดิม) + `send_time` จาก Phase 1 ของฉบับนั้น (เวลา, ใหม่) — แทนที่ `strtotime($startDate...)` เดิมที่ได้เที่ยงคืนเสมอ
- [x] 4.6 Insert `email_campaigns` เพิ่ม `template_id` ต่อแถวตามผลจากงาน 4.4

## 5. Backend — เพิ่ม `set_time_limit(0)`

- [x] 5.1 เพิ่ม `set_time_limit(0);` ที่หัวไฟล์ `api/email-campaigns.php` (mirror `brand-content.php:4`)

## 6. Backend — persist `scheduled_at` ตอนบันทึกร่าง

- [x] 6.1 แก้ `createEmailCampaign()` ให้รับ `scheduled_at` (optional) เป็นส่วนหนึ่งของ payload — insert ลงคอลัมน์ `scheduled_at` โดย**ไม่เปลี่ยน `status`** (ยังคง `'draft'` เสมอ ไม่ว่าจะมีค่านี้หรือไม่)
- [x] 6.2 แก้ `updateEmailCampaign()` ให้รับ/อัปเดต `scheduled_at` แบบเดียวกัน (เฉพาะตอน status ยัง `'draft'` ตาม guard เดิมที่มีอยู่แล้ว)
- [x] 6.3 ตรวจโค้ดยืนยันว่าไม่มี path ไหนอนุมานจาก `scheduled_at IS NOT NULL` (grep ทั้ง `api/` แล้ว — cron `send-scheduled-campaigns.php:23` gate ด้วย `status='scheduled' AND scheduled_at<=NOW()` เสมอ ไม่มีจุดไหนเช็คแค่ `scheduled_at` เดี่ยวๆ) ว่าแคมเปญ "พร้อมส่ง" — cron และ gate อื่นต้องอ่านจาก `status='scheduled'` เท่านั้น (ตามที่ระบุใน design.md เป็น invariant)

## 7. Frontend — Tone ตัวเลือกที่ 5

- [x] 7.1 แก้ panel "สร้างด้วย AI" ใน `CampaignsPage.tsx`: เพิ่มปุ่ม tone "ให้ AI เลือกเอง" เป็น default state (`aiTone` เริ่มต้นเป็น `'auto'` แทน `'friendly'`)
- [x] 7.2 แก้ `AICampaignPlanDialog.tsx`: เพิ่มปุ่ม tone เดียวกัน เป็น default เช่นกัน

## 8. Frontend — ส่ง `current_template_id` และรับผลลัพธ์ template/schedule (เดี่ยว)

- [x] 8.1 `handleGenerateWithAI()`: ส่ง `current_template_id: selectedTemplate || null` เข้า request
- [x] 8.2 รับผลลัพธ์ `template_id` กลับมา — ถ้า `selectedTemplate` ว่างตอนกด generate ให้เรียก `applyTemplateSelection(template)` ด้วย template ที่ AI เลือก ก่อน set เนื้อหา (ตาม pattern ที่ `handleTemplateClick`/`applyTemplateSelection` ใช้อยู่แล้ว)
- [x] 8.3 รับผลลัพธ์ `suggested_scheduled_at` — ถ้า `scheduleAt` (state footer) ว่างอยู่ ให้ `setScheduleAt(...)` จากค่านี้ (แปลง format ให้ตรงกับ `datetime-local` input)

## 9. Frontend — Batch dialog: เวลา + แสดงผล

- [x] 9.1 ตรวจแล้ว — `AICampaignPlanDialog` ไม่เคยมีช่องกรอกเวลาอยู่แล้ว (มีแค่ `type="date"`) จึงไม่มีอะไรต้องลบ ไม่มี UI ที่บอกผิดว่า "เวลาคงที่" หลงเหลือ
- [x] 9.2 แก้หน้า "เสร็จแล้ว" (`step==='done'`) ให้ list รายฉบับพร้อมวันที่/เวลาที่ได้ (ใช้ผลลัพธ์ `campaigns` array ที่ `ai-plan` คืนกลับมาอยู่แล้ว ซึ่งมี `scheduled_at` ต่อฉบับ)

## 10. Frontend — การ์ดรายการแคมเปญ

- [x] 10.1 แก้เงื่อนไขที่ [CampaignsPage.tsx:998](../../../src/pages/CampaignsPage.tsx) ให้แสดง "วันที่เสนอ" เมื่อ `status==='draft'` และมี `scheduled_at` (ไม่ว่าจะมาจาก single หรือ batch) แยก label จาก "กำหนดส่ง" ที่ใช้กับ `status==='scheduled'` เท่านั้น
- [x] 10.2 แก้บรรทัด `sent_at` จาก `toLocaleDateString` เป็น `toLocaleString` ให้โชว์เวลาด้วย

## 11. Verification (ตาม CLAUDE.md)

- [x] 11.1 รัน `pnpm lint` (0 errors, 47 warning เดิม ไม่มีใหม่)
- [x] 11.2 รัน `pnpm test` (252/254 ผ่าน — 2 fail เดิมใน `PullFromContentDialog.test.tsx` ที่ยืนยันแล้วว่าไม่เกี่ยวกับ change นี้)
- [x] 11.3 รัน `pnpm build` (สำเร็จ ไม่มี TypeScript error)
- [x] 11.4 ทดสอบ manual ผ่าน dev server ครบทุก flow (ผ่านทั้งหมด):
      - (ก) generate เดี่ยว ไม่เลือก template ล่วงหน้า สินค้า Smart Factory 360° → AI เลือก `template-8` (คอร์เปอเรตบลู) เอง เนื้อหาตรงสินค้า ชื่อ/หัวข้อถูกเติมให้ครบ
      - (ข) เลือก template "เทคสตาร์ทอัพ" (`template-11`) ไว้ก่อน แล้วกด "สร้างด้วย AI" → AI ตอบ `template_id: "template-11"` กลับมาตรงตัว ไม่ถูกทับ (ยืนยันจาก response body ตรงๆ)
      - (ค) generate batch 5 ฉบับ (สินค้า DocCapture) → ได้ 5 หัวข้อไม่ซ้ำกันจริง (แนะนำตัว→ลดข้อผิดพลาด→เคสศึกษา→ทดลองใช้→ข้อเสนอสุดท้าย) เวลาส่งกระจาย (09:30, 14:15, 11:00, 13:45, 16:30 — ไม่ใช่เที่ยงคืนหรือเวลาเดียวกันทั้งหมด) template_id ต่างกันตามเนื้อหา (`template-1`, `template-11`, `template-4`)
      - (ง) การ์ดแคมเปญ draft ทั้ง 5 ฉบับ โชว์ "🕐 วันที่เสนอ (รอตั้งเวลาส่ง)" พร้อมวันเวลาเต็ม และ badge "ชุดแผน (0/5)"
      - (จ) แคมเปญที่ส่งแล้วโชว์ "ส่งเมื่อ 21/9/2569 09:20:35" มีเวลาแล้ว (ของเดิมมีแค่วันที่)
      - เจอ error ชั่วคราวจาก OpenRouter (credit check timeout) 1 ครั้งระหว่างทดสอบ — ยืนยันว่า error handling ทำงานถูกต้อง (toast แจ้ง ไม่ทำฟอร์มพัง ลองใหม่สำเร็จ) ไม่ใช่บั๊กของโค้ดที่แก้
      - ลบข้อมูลทดสอบ (5 แคมเปญ DocCapture) ทิ้งหลังยืนยันเสร็จ กลับเป็น 42 แคมเปญ (มี 3 แคมเปญ "AI Portal Duckkit" ที่ template_id เป็น NULL และเวลาเที่ยงคืนหลงเหลืออยู่ตั้งแต่ก่อน apply รอบนี้ — ไม่แน่ใจว่าใครสร้าง จึงไม่ลบให้ ต้องแจ้ง user ให้ตรวจสอบเอง
