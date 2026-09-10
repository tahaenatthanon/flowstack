## Context

`content_plan_user_message()` (`api/lib/content-plan-prompt.php`) เป็น pure function ที่ประกาศตัวเองว่าถูกแยกออกมาเพื่อให้ทดสอบได้โดยไม่พึ่ง DB/AI (ดู docblock บนไฟล์) ปัจจุบัน branch ที่ไม่ใช่ direct (`$isDirect === false`) พิมพ์บรรทัด `Original User Topic/Seed (SOURCE OF TRUTH): ` จาก `$args['source_topic']` ตรงตัว โดยไม่ตรวจว่าค่านั้นว่างหรือไม่ — ความปลอดภัยจากค่าว่างทั้งหมดตกอยู่ที่ caller (`generate-plan` ใน `api/brand-content.php:923`) ซึ่งเตรียม `$promptTopic` มาด้วย fallback ของตัวเอง (`$originalTopic !== '' ? $originalTopic : $triggerCommand`)

จากการสำรวจ (`/opsx:explore ขั้นที่ 2`) ยืนยันว่า:
- ผ่าน UI ที่ใช้งานจริงวันนี้ (`ContentPlannerAI.tsx`) `trigger_command` การันตีไม่ว่างเสมอ (client-side guard `if (!triggerCmd.trim()) return;`) — จึงไม่มี live bug จากพฤติกรรมปัจจุบัน
- แต่ path ที่ทำให้ค่าว่างหลุดเข้าฟังก์ชันได้จริงมีอยู่ (แม้ปัจจุบันไม่ reachable ผ่าน UI ใดๆ): เลือก `trigger_ids` ที่ resolve เป็น Trigger ที่ `command` ว่าง (DB-level) โดยไม่มี `trigger_command`/`source_topic` เสริม — เกิดได้เฉพาะถ้ามีใครยิง API ตรง (บาย pass หน้า UI) เพราะ `PUT` ของ action `triggers` ไม่ validate `command` ว่าง (ต่างจาก `POST` ที่ validate ไว้แล้ว)
- นี่คือช่องว่างของการออกแบบ (ฟังก์ชัน pure พึ่ง invariant ของ caller) มากกว่า live bug — แก้เพื่อไม่ให้ caller ในอนาคตพลาดซ้ำ

## Goals / Non-Goals

**Goals:**
- `content_plan_user_message()` ต้อง defend ตัวเอง ไม่ปล่อยบรรทัด topic label ที่ไม่มีเนื้อหาเข้า prompt ไม่ว่า caller จะเตรียมค่ามาอย่างไร
- ปิดช่องที่ทำให้ `content_triggers.command` ว่างได้ผ่าน API (`PUT`) เพื่อลดโอกาสที่ edge case นี้เกิดขึ้นตั้งแต่ต้นทาง

**Non-Goals:**
- ไม่เปลี่ยน validation ที่บรรทัด 633 ของ `generate-plan` (การอนุญาตให้ `trigger_ids` อย่างเดียวผ่านได้ ยังคงเดิม — เพราะการปิดช่องที่ `PUT triggers` เพียงพอแล้วที่จะการันตีว่า Trigger ที่ resolve ออกมามี `command` จริงเสมอ)
- ไม่เปลี่ยนพฤติกรรม Direct mode ใดๆ — Direct mode validate `source_topic` ไม่ว่างอยู่แล้วตั้งแต่ change ก่อนหน้า (`fix-content-plan-source-topic`)
- ไม่เพิ่ม placeholder ข้อความอื่นแทนบรรทัดที่ถูกตัด (ตามที่ผู้ใช้ยืนยันในขั้น explore) — ตัดทิ้งเฉยๆ

## Decisions

### 1. Fallback logic ย้ายเข้าไปอยู่ใน `content_plan_user_message()` เอง ไม่ใช่แค่ที่ caller
ทางเลือกที่พิจารณา: (A) แก้เฉพาะ caller ให้ fallback แน่นขึ้น (B) ย้าย fallback เข้าไปในฟังก์ชัน pure เอง (C) ทำทั้งคู่
เลือก **B ควบคู่กับปิดช่องที่ต้นตอ (การ validate `PUT triggers`)** — เพราะฟังก์ชันนี้มี test file คู่กัน (`api/tests/`) และมีเจตนาให้ทดสอบแยกจาก caller ได้ การให้ฟังก์ชันรับผิดชอบ invariant ของตัวเองตรงกับหลัก NO MAGIC และป้องกัน caller ใหม่ในอนาคตที่อาจลืม fallback เอง
ไม่เลือก A เพียงอย่างเดียว เพราะไม่ปิด class ของ bug นี้จริง (ยังมี caller อื่นที่อาจพลาดได้)

### 2. เงื่อนไขตัดบรรทัด: ตรวจทั้ง `source_topic` และ `trigger_command`/`trigger_commands` รวมกัน
ฟังก์ชันต้องประกอบค่าที่จะพิมพ์จาก 3 แหล่งที่มีอยู่แล้วใน `$args`: `source_topic`, `trigger_command`, `trigger_commands` (array) — resolve ตามลำดับเดียวกับที่ caller ทำอยู่ (`source_topic` ก่อน แล้วค่อย trigger command ที่ไม่ว่างตัวแรก) ถ้า resolve แล้วยังว่าง (trim แล้วเป็น `''`) → ไม่พิมพ์บรรทัด `Original User Topic/Seed` เลย บรรทัดอื่น (Trigger Instructions, สัปดาห์เริ่มต้น, วันที่, Platform, reminder) พิมพ์ตามปกติไม่เปลี่ยน
เหตุผลที่ resolve ในฟังก์ชันแทนที่จะรับค่า resolved แล้วจาก caller ตรงๆ: ลด duplicate logic สองที่ (caller ไม่ต้อง maintain `$promptTopic` fallback เองอีกต่อไป — ส่ง arg ดิบเข้ามาได้เลย)

### 3. `PUT` ของ action `triggers` validate `command` ไม่ว่าง เหมือน `POST`
เพิ่ม `if (empty($body['command'])) jsonError('กรุณาระบุ Trigger Command');` ที่จุดเดียวกับ `POST` (บรรทัด 480) เพื่อความสอดคล้องกัน — ไม่ต้องเปลี่ยน UI (`SkillsTriggerTab.tsx`) เพราะ disable ปุ่ม Save ไว้แล้วอยู่แล้ว การเพิ่มนี้คือ server-side defense เสริมเท่านั้น

## Risks / Trade-offs

- **[Risk]** ย้าย fallback logic เข้าไปในฟังก์ชันอาจทำให้ caller (`brand-content.php:923`) มี logic ซ้ำซ้อนที่ไม่จำเป็นอีกต่อไป (`$promptTopic`) → **Mitigation**: เก็บ `$promptTopic` ไว้เหมือนเดิมที่ caller (ยังใช้เป็น argument ส่งเข้า เหมือนเดิม ไม่ลบ) เพื่อไม่ให้กระทบ `content_plan_item_source_topic()` ที่ใช้ `$originalTopic` แยกอยู่แล้ว (คนละ concern — คนละตัวแปร) — การเปลี่ยนที่ `content_plan_user_message()` เป็นแค่ safety net ชั้นที่สอง ไม่ได้แทนที่ fallback เดิมที่ caller
- **[Risk]** การเพิ่ม validation ที่ `PUT triggers` อาจกระทบ integration test หรือ script ภายนอกที่เคย PATCH command เป็นค่าว่างได้ (ไม่น่าจะมี แต่ต้องรัน test suite เดิมทั้งหมดก่อน apply เสร็จ) → **Mitigation**: รัน `php -l` + PHP test suites + `pnpm test` ตามขั้นตอน verify ปกติของโปรเจกต์ก่อนถือว่าเสร็จ

## Migration Plan

ไม่มี schema migration — เป็นการแก้ logic ล้วน ไม่มี rollback พิเศษนอกจาก revert commit
