## Context

`generate-plan` (`api/brand-content.php`) รองรับ 2 mode ผ่าน `generation_mode`:
- **Direct** (`generation_mode=direct`, ใช้โดย `QuickCreateDialog.tsx`/`BatchGenerateDialog.tsx`) — ผู้ใช้พิมพ์ topic เองเสมอ ส่ง `source_topic` มาด้วยทุกครั้ง
- **Legacy/Plan** (mode อื่น/ไม่ระบุ, ใช้โดย `ContentPlannerAI.tsx` เท่านั้น) — ผู้ใช้กรอกแค่ `trigger_command` (เช่น "แผนคอนเทนต์เดือนนี้") ไม่มี topic เฉพาะเจาะจง หัวข้อรายวัน/รายชิ้นเป็นสิ่งที่ AI คิดขึ้นเองทั้งหมด

โค้ดปัจจุบันมี validation ที่บรรทัด 666 (`if ($sourceTopic === '') jsonError(...)`) บังคับ `source_topic` แบบไม่มีเงื่อนไขในทั้งสอง mode แต่ `ContentPlannerAI.tsx` ไม่มีทางส่ง `source_topic` มาได้เลย (มีแค่ input เดียวคือ `trigger_command`) ทำให้ทุก request จาก mode นี้ตกที่ HTTP 422 ก่อนจะไปถึงส่วนสร้าง plan/item ใดๆ

โค้ดส่วนที่เหลือ (`content_plan_user_message()` ใน `content-plan-prompt.php`, `$promptTopic` fallback ที่บรรทัด 919, `$planTitle` ที่บรรทัด 956) ถูกออกแบบให้รองรับ legacy mode ที่ไม่มี `source_topic` อยู่แล้ว (fallback ไป `$triggerCommand`) — มีแค่บรรทัด 666 (validation) และบรรทัด 978 (การ insert `content_items.source_topic`) สองจุดเท่านั้นที่ยังผูกกับสมมติฐานว่า `source_topic` ต้องไม่ว่างเปล่าเสมอ

## Goals / Non-Goals

**Goals:**
- Legacy/trigger-only `generate-plan` request (ไม่มี `source_topic`, มี `trigger_command`) ต้องผ่าน validation และสร้าง plan/item สำเร็จ
- `content_items.source_topic` ของแต่ละ item ที่สร้างจาก legacy mode ต้องมีค่าที่มีความหมาย (ไม่ใช่ค่าว่างเปล่า) เพื่อให้ `researchSeedTopic()`/regenerate ทำงานถูกต้องต่อไป — ไม่กลับไปใช้ AI-rewritten `title`/`topic` ปัจจุบันเป็น seed (ซึ่งเป็นบั๊กเดิมที่ `source_topic` ถูกสร้างมาเพื่อป้องกัน)
- Direct mode (QuickCreate/Batch) ต้องไม่มีการเปลี่ยนแปลงพฤติกรรมแม้แต่นิดเดียว — ยังคงบังคับ `source_topic` เหมือนเดิมทุกประการ

**Non-Goals:**
- ไม่แก้ UX ของ `ContentPlannerAI.tsx` (เช่น เพิ่มช่อง "หัวข้อ" แยก) — เป็นการตัดสินใจเชิง product ที่แยกออกไปต่างหาก ตามที่คุยไว้ใน explore mode
- ไม่แก้ปัญหา `ContentPlannerCalendar.tsx` ที่ item ไม่มี `scheduled_date`/`day_label` หายจากปฏิทิน — เป็นคนละปัญหาคนละชั้น (การแสดงผล ไม่ใช่การสร้างข้อมูล) แก้แยกเป็นอีก change
- ไม่แตะสูตร rate-limit `$totalCalls = $maxDays * $platformCount` (บรรทัด 902) — เป็น Potential Bug ที่ยังไม่ยืนยัน ไม่อยู่ในสโคปนี้
- ไม่เปลี่ยน `content_plan_items.topic` หรือ schema/DB ใดๆ

## Decisions

### 1. ผ่อน validation เฉพาะเมื่อไม่ใช่ Direct mode — ไม่ใช่ลบทิ้งทั้งหมด
เปลี่ยนบรรทัด 666 จาก `if ($sourceTopic === '') jsonError(...)` เป็น `if ($isDirect && $sourceTopic === '') jsonError(...)`

**ทำไมปลอดภัย**: บรรทัด 633 (`if (!$triggerIds && $triggerCommand === '' && !$sourceTopic) jsonError(...)`) ทำงานก่อนหน้านี้แล้ว และบังคับว่าต้องมีอย่างน้อยหนึ่งใน `{triggerIds, triggerCommand, sourceTopic}` ไม่ว่างเปล่า ดังนั้น legacy mode ที่ผ่านมาถึงบรรทัด 666 ได้ รับประกันแล้วว่ามี `triggerCommand` (หรือ `triggerIds` ที่ resolve เป็น `triggerCommand`) ไม่ว่างเปล่า — การผ่อนบรรทัด 666 จึงไม่เปิดช่องให้ request ที่ไม่มีข้อมูลอะไรเลยผ่านไปได้

**ทางเลือกที่ปฏิเสธ**: ลบ validation บรรทัด 666 ทิ้งไปเลย — ปฏิเสธเพราะ Direct mode ยังต้องการบังคับ `source_topic` อย่างเข้มงวด (เป็น contract ที่มีอยู่แล้วและ QuickCreate/Batch พึ่งพา) การลบทิ้งทั้งหมดจะทำให้ Direct mode รับ request ที่ไม่มี topic ได้โดยไม่ตั้งใจ

### 2. `content_items.source_topic` resolve ต่อ item หลัง AI ตอบกลับ ไม่ใช่ค่าเดียวก่อน AI เรียก
เปลี่ยนจาก:
```php
$originalTopic = $sourceTopic;              // ครั้งเดียว ก่อน loop เรียก AI
...
foreach ($planItems as $item) {
    INSERT ... source_topic ... VALUES (..., $originalTopic, ...)   // ใช้ค่าเดียวกันทุก row
}
```
เป็น (แนวคิด — รายละเอียดจริงอยู่ใน tasks.md):
```php
foreach ($planItems as $item) {
    $itemSourceTopic = $originalTopic !== ''
        ? $originalTopic                              // Direct mode / มี source_topic จริง — เหมือนเดิม 100%
        : trim((string)($item['topic'] ?? ''));        // Legacy mode — แช่แข็ง topic ที่ AI สร้างให้ item นี้
    INSERT ... source_topic ... VALUES (..., $itemSourceTopic, ...)
}
```

**เหตุผล**: นิยาม `source_topic` ใหม่เป็น "ค่า topic ตอนสร้าง item นั้น ก่อนถูกแก้ไข/regenerate ทีหลัง" แทนที่จะเป็น "ต้องมาจากการพิมพ์ของมนุษย์เท่านั้น" — ยังทำหน้าที่ป้องกันเดิมได้ครบ (กัน `title`/`topic` ที่ถูกแก้ทีหลังไม่ให้กระทบ Research seed) เพียงแต่ต้อง resolve **ต่อ item** เพราะ legacy mode แต่ละวัน/แต่ละ item มี topic ที่ AI คิดขึ้นต่างกัน (ใช้ `trigger_command` เดียวกันทุก item จะสูญเสียความเฉพาะเจาะจงเพราะ trigger_command เป็นคำสั่งกว้างๆ ระดับทั้งแผน)

**ทางเลือกที่ปฏิเสธ**: ใช้ `$triggerCommand` เป็น `source_topic` ของทุก item ในแผน (Option A จาก explore mode) — ปฏิเสธเพราะไม่เฉพาะเจาะจงพอสำหรับ Research แต่ละ item และผู้ใช้เลือก Option B แล้วในการคุยรอบ explore

### 3. ไม่แตะ `$promptTopic` (บรรทัด 919) และ `$planTitle` (บรรทัด 956) — ทำงานถูกต้องอยู่แล้ว
`$promptTopic` fallback ไป `$triggerCommand` สำหรับ legacy mode อยู่แล้วในโค้ดปัจจุบัน (แค่ไปไม่ถึงเพราะโดนบล็อกที่บรรทัด 666) และ `$planTitle` ก็ fallback ไป `$triggerCommand` เมื่อไม่ใช่ direct mode อยู่แล้ว (เงื่อนไข `$isDirect && $sourceTopic !== ''`) — ทั้งสองจุดนี้ไม่ต้องแก้อะไรเลย เป็นเพียงผลพลอยได้จากการผ่อน validation ที่บรรทัด 666

## Risks / Trade-offs

- **[Risk]** ถ้า AI ไม่ส่ง `topic` กลับมาสำหรับ item ใดใน legacy mode (edge case ที่ parse ล้มเหลวบางส่วน) `$itemSourceTopic` จะเป็นค่าว่างเปล่าเหมือนเดิม (ไม่ได้แย่ลงกว่าพฤติกรรมปัจจุบันของ Direct mode ในสถานการณ์เทียบเท่า) → **Mitigation**: ไม่ต้องจัดการพิเศษ เป็น edge case ที่มีอยู่แล้วในระบบ (ไม่มี topic ให้ seed Research ก็จะล้มเหลวตามปกติที่ `generate-article`/`content-generation-research` spec กำหนดไว้แล้ว)
- **[Trade-off]** Legacy mode item ที่ regenerate ในภายหลัง (`handleRequestAI` ใน `ContentPlannerPage.tsx`) จะ anchor กับ topic ที่ AI คิดตอนสร้างครั้งแรก ไม่ใช่ trigger_command เดิม — เป็นพฤติกรรมที่ตั้งใจ (Option B) ไม่ใช่ผลข้างเคียงที่ไม่คาดคิด

## Migration Plan

ไม่มี database migration — แก้เฉพาะ logic ใน `api/brand-content.php` 2 จุด (validation + insert) Deploy เป็นโค้ดล้วน rollback ด้วย revert commit เดียวได้ทันที ไม่มีข้อมูลเก่าที่ต้อง backfill (content ที่สร้างไปแล้วด้วย `source_topic=''` จาก legacy mode ยังคงมีค่าว่างอยู่ตามเดิม แก้ได้เฉพาะ generation ใหม่ไปข้างหน้า)

## Open Questions

ไม่มี — ตัดสินใจ Option B ไว้แล้วระหว่าง explore mode ก่อนหน้านี้
