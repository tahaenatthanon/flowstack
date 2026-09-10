## Why

`content_plan_user_message()` (ใน `api/lib/content-plan-prompt.php`) สร้างบรรทัด `Original User Topic/Seed (SOURCE OF TRUTH): ` เข้า prompt โดยพึ่งว่า caller (`generate-plan` ใน `api/brand-content.php`) จะเตรียมค่าที่ไม่ว่างมาให้เสมอ — ฟังก์ชันเองไม่มี fallback หรือการป้องกันใดๆ ถ้า caller ในอนาคตส่งค่าว่างเข้ามา (เช่น legacy Content Plan ที่เลือกเฉพาะ Trigger ที่ไม่มี command ข้อความ) ฟังก์ชันจะปล่อยบรรทัดที่มี label แต่ไม่มีเนื้อหาเข้า AI โดยไม่มีใครรู้ตัว — ผิดหลัก NO MAGIC (พฤติกรรมต้อง explicit และป้องกันในตัวมันเอง ไม่ใช่พึ่ง invariant ที่มองไม่เห็นจาก caller)

เพิ่มเติม: root cause หนึ่งที่ทำให้ค่าว่างเกิดขึ้นได้คือ endpoint แก้ไข Trigger (`action=triggers`, `PUT`) ไม่ validate ว่า `command` ต้องไม่ว่าง ทั้งที่ endpoint สร้าง Trigger ใหม่ (`POST`) validate อยู่แล้ว — ทำให้แก้ไข Trigger เดิมให้ command ว่างได้ผ่าน API ตรง (แม้ว่า UI ปัจจุบันจะกัน disable ปุ่ม Save ไว้แล้วก็ตาม)

## What Changes

- `content_plan_user_message()`: กรณี non-direct (legacy Content Plan) และ resolve แล้วไม่มีทั้ง topic ที่ผู้ใช้พิมพ์และ trigger command/commands เลย (ว่างสนิททุกแหล่ง) — ตัดบรรทัด `Original User Topic/Seed` ทิ้งทั้งบรรทัด ไม่ส่งค่าว่างเข้า prompt และไม่มี placeholder ข้อความอื่นมาแทน
- `api/brand-content.php` action `triggers`, method `PUT`: เพิ่ม validation ปฏิเสธ `command` ว่าง ให้เท่ากับ `POST` ที่มีอยู่แล้ว (บรรทัด 480)

## Capabilities

### New Capabilities

(ไม่มี)

### Modified Capabilities

- `content-generation-research`: เพิ่มข้อกำหนดว่า prompt ที่ส่งเข้า AI generation ต้องไม่มีบรรทัด topic label ที่ไม่มีเนื้อหา (ว่างเปล่า) — เมื่อไม่มีทั้ง user topic และ trigger instruction ให้ตัดบรรทัดนั้นออกแทนที่จะส่งค่าว่าง

## Impact

- `api/lib/content-plan-prompt.php` — แก้ `content_plan_user_message()` (pure function, มี test file คู่กันอยู่แล้วที่ `api/tests/`)
- `api/brand-content.php` — เพิ่ม validation ใน `PUT` ของ action `triggers` (บรรทัด ~492)
- ไม่กระทบ Direct mode (QuickCreateDialog/BatchGenerateDialog) — Direct mode validate `source_topic` ไม่ว่างอยู่แล้วตั้งแต่ก่อนถึงจุดนี้
- ไม่กระทบพฤติกรรมที่สังเกตได้จาก UI ปัจจุบัน (`ContentPlannerAI.tsx` การันตี `trigger_command` ไม่ว่างอยู่แล้ว) — เป็น defense-in-depth ปิด latent gap ไม่ใช่แก้ live bug
