## Why

`generate-plan` (`api/brand-content.php:666`) บังคับให้ต้องมี `source_topic` แบบไม่มีเงื่อนไขในทุก request แต่ `ContentPlannerAI.tsx` — ซึ่งเป็น UI เดียวของฟีเจอร์ "AI สร้างแผน" (legacy weekly/monthly Content Plan) — ไม่มีช่องกรอก `source_topic` เลย มีแต่ `trigger_command` ผลคือทุกครั้งที่ผู้ใช้กดปุ่ม "สร้างแผนด้วย AI" บนหน้า Content Planner จะได้ HTTP 422 "กรุณาระบุหัวข้อ" ทันที — ฟีเจอร์นี้ใช้งานไม่ได้เลยในสถานะปัจจุบัน

## What Changes

- ผ่อนเงื่อนไขที่ `generate-plan` ให้บังคับ `source_topic` เฉพาะเมื่อ `generation_mode=direct` เท่านั้น — legacy/trigger-only mode (ผ่านมาจาก `content_plan_triggers`/`trigger_command` อยู่แล้วตาม guard เดิมที่บรรทัด 633) ไม่ต้องมี `source_topic` มาด้วยอีกต่อไป
- แก้จุดบันทึก `content_items.source_topic` ให้ resolve ต่อ item (ไม่ใช่ค่าเดียวใช้ร่วมกันทุก row เหมือนเดิม): ถ้ามี `source_topic` จริงจาก request (Direct mode) ใช้ค่านั้นเหมือนเดิมทุกประการ — ถ้าไม่มี (legacy mode) ให้ใช้ `topic` ที่ AI สร้างให้กับ item นั้นๆ แช่แข็งไว้ ณ ตอนสร้าง เป็น `source_topic` ของ item นั้น
- ไม่แตะ Direct mode (QuickCreateDialog/BatchGenerateDialog) เลยแม้แต่บรรทัดเดียว — เงื่อนไขใหม่ยังคงบังคับ `source_topic` เหมือนเดิมทุกประการเมื่อ `generation_mode=direct`

## Capabilities

### New Capabilities
(ไม่มี)

### Modified Capabilities
- `content-generation-research`: ขยาย requirement "Research Topic is the source of truth" ให้ครอบคลุมกรณีที่ไม่มี Topic ที่ผู้ใช้พิมพ์เอง (legacy/trigger-only Content Plan) — นิยาม `source_topic` ใหม่ให้ครอบคลุมทั้ง "หัวข้อที่ผู้ใช้พิมพ์" (Direct mode, เหมือนเดิม) และ "หัวข้อที่ AI สร้างให้ แช่แข็ง ณ ตอนสร้าง item" (legacy mode) โดยยังคงหน้าที่หลักเดิมไว้ครบ: ป้องกันไม่ให้ Research ใช้ `title`/`topic` ที่ถูกแก้ไขภายหลังมาเป็น seed

## Impact

- Backend: `api/brand-content.php` (`generate-plan` — validation ที่บรรทัด 666 และจุด insert `content_items.source_topic` ที่บรรทัด 978)
- ไม่กระทบ: `api/lib/content-plan-prompt.php` (fallback `$promptTopic` ไป `$triggerCommand` มีอยู่แล้ว ไม่ต้องแก้), `QuickCreateDialog.tsx`, `BatchGenerateDialog.tsx`, Direct mode ทั้งหมด
- ไม่กระทบ Database schema — ไม่มี column ใหม่ ไม่มี migration
- Downstream ที่ได้ประโยชน์โดยอัตโนมัติ: `ContentPlannerAI.tsx` "AI สร้างแผน" กลับมาใช้งานได้; `researchSeedTopic()`/regenerate (`handleRequestAI`) จะ seed ถูกต้องจาก topic ที่แช่แข็งไว้แทนที่จะ fallback ไป topic ปัจจุบันที่อาจถูกแก้ไขแล้ว
