## Why

ฟีเจอร์ AI generate เนื้อหาแคมเปญ (จาก change `campaign-ai-generation` ที่ archive ไปแล้ว) ยังมีช่องว่างที่พบระหว่างใช้งานจริง: (1) AI ไม่รู้จักเรื่อง template เลย ทำให้อีเมลที่ไม่มีคนเลือก template อาจไม่มีแบรนด์ดิ้งเลย (2) แคมเปญชุด (batch) ที่ AI วางแผนให้ ถ้าจำนวนฉบับเกิน 3 จะได้เนื้อหาซ้ำมุมกันเพราะ logic วนซ้ำ 3 มุมตายตัว (3) เวลาส่งของ batch ถูก parse เป็นเที่ยงคืนเสมอเพราะ input มีแค่วันที่ไม่มีเวลา (4) วันที่/เวลาที่เสนอไว้มองไม่เห็นในรายการแคมเปญตราบใดที่ยังเป็นสถานะร่าง และ (5) การแสดงเวลาที่ส่งจริงไม่สอดคล้องกับการแสดงเวลาที่ตั้งไว้

## What Changes

- AI เลือก template ให้เสมอ (บังคับ 1 ใน 20) ทั้งในโหมด generate เดี่ยวและ batch โดยไม่ทับ template ที่ผู้ใช้เลือกไว้ก่อนแล้ว
- เพิ่มตัวเลือกที่ 5 "ให้ AI เลือกเอง" ในตัวเลือกโทนการเขียน เป็นค่า default ใหม่ (แทนที่ "เป็นกันเอง") ทั้งใน panel generate เดี่ยวและ AI plan dialog
- ปรับ batch planning เป็น 2 phase: Phase 1 (1 call) วางแผนหัวข้อ + เวลาส่งของทุกฉบับพร้อมกันเพื่อความหลากหลาย/ไม่ซ้ำ, Phase 2 (N call) เขียนเนื้อหาเต็ม + เลือก template ต่อฉบับ
- เวลาส่งของแต่ละฉบับใน batch เปลี่ยนจาก fix เที่ยงคืนเป็น AI-decided ต่อฉบับ (วันที่ยังคำนวณจาก start_date + interval เหมือนเดิม)
- **BREAKING (internal)**: `createEmailCampaign()`/`updateEmailCampaign()` ต้องรับ `scheduled_at` เป็นส่วนหนึ่งของ payload ตอนบันทึกร่างด้วย ไม่ใช่แค่ตอนเรียก action `schedule` เท่านั้น — เพื่อให้ single-create เก็บวันที่ที่ AI แนะนำไว้ได้เหมือน batch
- แสดงวันที่/เวลาที่ตั้ง/แนะนำไว้ (ทั้งจาก user และจาก AI) ในหน้า "เสร็จแล้ว" ของ batch dialog และในการ์ดรายการแคมเปญ แม้ยังเป็นสถานะร่าง โดยใช้คำว่า "วันที่เสนอ" แยกจาก "กำหนดส่ง" (ที่ยืนยันแล้วเท่านั้น) เพื่อไม่ให้เข้าใจผิดว่าจะถูกส่งอัตโนมัติ
- แก้การแสดงเวลาที่ส่งจริง (`sent_at`) ให้โชว์เวลาด้วย ไม่ใช่แค่วันที่ (ให้สอดคล้องกับ "วันที่เสนอ"/"กำหนดส่ง" ที่โชว์ทั้งคู่อยู่แล้ว)
- แคมเปญเดี่ยว: AI แนะนำวันที่/เวลาส่งด้วย (prefill ถ้าว่าง ไม่ทับถ้ามีอยู่แล้ว ต้อง validate ไม่ให้เป็นอดีต) — การ commit จริงยังต้องกดปุ่ม "ตั้งเวลาส่ง" เองเสมอ
- เพิ่ม `set_time_limit(0)` ใน `api/email-campaigns.php` เพื่อรองรับ batch ที่เรียก AI ต่อเนื่องได้สูงสุด 11 ครั้ง (เกินเพดาน `max_execution_time=120` วินาทีของ PHP)

## Capabilities

### New Capabilities
(ไม่มี — ทุกอย่างเป็นส่วนขยาย/แก้ไขของ 2 capability ที่มีอยู่แล้วจาก change ก่อนหน้า)

### Modified Capabilities
- `campaign-ai-content-generation`: เพิ่ม requirement เรื่องการเลือก template อัตโนมัติ, ตัวเลือกโทน "ให้ AI เลือกเอง", การแนะนำวันที่/เวลาส่ง, และการคงค่า `scheduled_at` ของฉบับร่างไว้ในฐานข้อมูล
- `campaign-ai-batch-planning`: แก้ requirement "Batch Generation Creates Draft Campaigns Only" ให้สะท้อนการวางแผนแบบ 2 phase และเวลาที่ AI ตัดสินใจแทนค่า fix เที่ยงคืน, เพิ่ม requirement เรื่องความหลากหลายของหัวข้อ, การเลือก template ต่อฉบับ, และการแสดงวันที่/เวลาที่เสนอไว้ในรายการ

## Impact

- **Backend**: `api/lib/campaign-ai-prompt.php` (เพิ่ม template list + field `template_id`, `suggested_scheduled_at` ใน schema, เพิ่ม logic วางแผนหัวข้อ+เวลาแบบ 2 phase), `api/email-campaigns.php` (action `generate-content` และ `ai-plan` ต้องรองรับ field ใหม่ + validate, `createEmailCampaign`/`updateEmailCampaign` ต้องรับ `scheduled_at`, เพิ่ม `set_time_limit(0)`)
- **Frontend**: `CampaignsPage.tsx` (tone เพิ่มตัวเลือกที่ 5, การ์ดแสดงวันที่เสนอ, แก้ format `sent_at`), `AICampaignPlanDialog.tsx` (tone ตัวเลือกที่ 5, หน้าเสร็จแล้วแสดงวันที่/เวลารายฉบับ), ไม่มี component ใหม่ ไม่มี route ใหม่
- **ไม่กระทบ**: `product-catalog` capability (ไม่แตะ), โครงสร้าง `email_campaigns` เดิม (ไม่เพิ่มคอลัมน์ใหม่ — ใช้ `scheduled_at`/`product_id`/`plan_batch_id`/`plan_sequence` ที่มีอยู่แล้วจาก change ก่อนหน้า), cron `send-scheduled-campaigns.php` (ไม่ต้องแก้)
- **พักไว้นอกขอบเขตของ change นี้**: ระบบอนุมัติแคมเปญแบบ creator/approver คนละคน, การเขียนเนื้อหาให้สีตรงกับ light/dark theme ของ template ที่เลือก
