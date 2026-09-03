## Why

SEO Checklist ถูกฉีดเข้า prompt, ประเมินหลัง Generate และมี repair loop แล้ว แต่ยัง**ไม่เป็น Generation Contract ที่สมบูรณ์** เพราะ:

1. **บาง Required rule ยัง "ผ่าน" ได้ทั้งที่ข้อมูลไม่ครบ** — `structured_data`, `seo_title`, `meta_description` เป็น `critical` แต่เมื่อข้อมูลว่างกลับเป็น `pending` (ไม่ block) แทนที่จะเป็น `failed`
2. **`pending` ถูกใช้เพื่อเลี่ยงการตรวจ** — research rules ที่มีข้อมูลแล้วยังอาจถูก `pending` ได้ และเมื่อมี research brief บาง rule ไม่ถูกตรวจกับข้อมูล research จริง (แค่ตรวจ substring คร่าว ๆ)
3. **ไม่มี tier ที่ชัดเจน** — มีแต่ `critical` flag แต่ไม่แยก Required/Optional/Informational ทำให้แยกไม่ออกว่า rule ไหน "บังคับให้ generation ล้ม" กับ rule ไหนแค่ "แจ้งเตือน"
4. **Generation Requirements (prompt) กับ Evaluator ยังไม่ align เต็มที่** — AI ถูกสั่งแบบกว้าง ๆ แต่ Evaluator ตรวจด้วย threshold ที่อาจต่างจากสิ่งที่สั่ง

## What Changes

- **แปลง SEO Checklist เป็น Generation Contract**: `seo_generation_requirements()` คืนข้อกำหนดที่ AI ต้องทำครบ (สิ่งที่ต้องมี, ค่า min/max, ข้อมูล Research ที่ต้องใช้, เงื่อนไขผ่าน) โดยแต่ละ rule มี tier ชัดเจน
- **เพิ่ม Rule Tier 3 ระดับ**: `required` (ไม่ผ่าน → generation ล้ม), `optional` (เตือนเท่านั้น), `informational` (แสดงคุณภาพเท่านั้น) — แทนที่/ต่อยอดจาก `critical` flag เดิม
- **แก้ pending → failed/n/a**: Required rule ที่ข้อมูลจำเป็นหายไป → `failed` (ไม่ใช่ pending); research rule ที่ปิด research → `n/a` (not applicable, ไม่นับเป็น failure) และเมื่อเปิด research ต้องตรวจกับข้อมูล research จริง (ห้าม pending dodge)
- **Evaluator ใช้เกณฑ์เดียวกับ Requirements**: `related_keywords`/`topic_coverage`/`paa_questions`/`content_gap`/`search_intent` ตรวจกับ research data จริง (ต่อยอดจาก coverage threshold ที่มีแล้ว)
- **แยก SEO Score ออกจาก SEO Generation Gate**: score แสดงคุณภาพรวม; gate ตัดสิน success จาก required rules เท่านั้น — คะแนนสูงไม่ทำให้ผ่านหาก required rule failed
- **Model ไม่ใช่ตัวรับประกัน**: ระบบ (Evaluator) เป็นผู้ตัดสิน; การเปลี่ยน model ใน AI Settings ไม่กระทบ gate

## Capabilities

### Modified Capabilities

- `content-seo-checklist`: เพิ่ม rule tier (required/optional/informational), แก้ pending→failed/n/a, `seo_generation_requirements()` เป็น generation contract
- `content-seo-generation`: repair loop บังคับ required rules, required data missing → failed
- `seo-quality-gate`: gate ตัดสินจาก required rules (ไม่ใช่ score), tier เป็นตัวกำหนด blocking

## Impact

- **Backend**: `api/lib/seo-checklist.php` (tier ใน `SEO_WEIGHTS`, `seo_make_rule` เพิ่ม `tier`/`n/a`, `seo_evaluate` pending→failed/n/a, `seo_gate_status` ใช้ required), `api/brand-content.php` (repair loop)
- **Frontend**: `src/components/content/types.ts` (tier/n/a status), `ArticleEditor.tsx` (แสดง tier), toast ที่เกี่ยวข้อง
- **ไม่เปลี่ยน**: น้ำหนัก 15 ข้อ, coverage threshold (0.6/0.7/0.5) ที่มีแล้ว, publish flow, DB schema
