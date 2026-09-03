## Why

จากการตรวจโค้ดปัจจุบัน พบว่า generation gate, rule tier, required-rules failed, research n/a, และ validation loop ถูก implement แล้ว (จาก change ก่อนหน้า) แต่ยังมี **gap 3 จุด** ที่ทำให้ acceptance criteria ยังไม่ครบ:

1. **Prompt ยัง duplicate threshold และ drift** — `$jsonSchema`/`$mainSys` ใน `api/brand-content.php` ยัง hardcode ค่าเกณฑ์ที่ซ้ำกับ evaluator เช่น `meta_description: 150-160 chars` (แต่ evaluator ตรวจ **120–160**) และ `>=500 คำ`/`slug` ยังเขียนมือ แทนที่จะ derive จาก `seo_generation_requirements()` ซึ่งคืน `pass_condition`/`min`/`max` อยู่แล้วแต่**ไม่ถูกใช้ใน prompt** — ตรงนี้เสี่ยง drift ระหว่างสิ่งที่ AI ถูกสั่ง กับสิ่งที่ evaluator ตรวจ
2. **Repair feedback ไม่ครบ** — feedback ปัจจุบันมี `key`/`status`/`message` แต่ขาด `expected requirement` (pass_condition) และ `actual result` ที่ชัดเจนต่อข้อ ทำให้ AI แก้ไม่ตรงจุด
3. **Final gate response** คืน `seo.rules` เต็ม แต่ไม่ได้ filter/เน้นรายการ **required rule ที่ fail** พร้อมเหตุผลชัดเจน

## What Changes

- **Prompt ใช้ Source of Truth เดียว**: สร้าง field hints ใน `$jsonSchema`/`$mainSys` จาก `seo_generation_requirements()` (ใช้ `pass_condition` + `min`/`max`) แทนการ hardcode ค่าเกณฑ์ — กำจัด drift (เช่น meta_description ต้องเป็น 120–160 ทั้ง prompt และ evaluator)
- **Feedback ที่สมบูรณ์ต่อ rule**: เมื่อ required rule fail ให้ feedback ต่อข้อมี `key`, `status`, `message`, `expected` (pass_condition), `actual` (ค่าที่วัดได้จริงเมื่อมี) เพื่อให้ AI แก้เฉพาะจุด
- **Final gate structured failure**: เมื่อ generation ล้มเหลวหลัง retry ครบ ให้คืนรายการ required rule ที่ fail พร้อมเหตุผล (ไม่ใช่แค่ raw `seo.rules`)

## Capabilities

### Modified Capabilities

- `content-seo-generation`: prompt ใช้ generation contract เป็น source of truth (ไม่ duplicate threshold), feedback ต่อข้อครบ (expected + actual), final gate คืน required failures ที่ชัดเจน
- `content-seo-checklist`: `seo_generation_requirements()` ต้องให้ `pass_condition`/`min`/`max` ที่สมบูรณ์พร้อมใช้ใน prompt และ `seo_evaluate()` ต้องให้ `actual` (ค่าที่วัดได้) ใน `message` ต่อข้อที่ fail

## Impact

- **Backend**: `api/brand-content.php` (prompt construction + repair feedback + final response), `api/lib/seo-checklist.php` (message เพิ่ม actual value)
- **Frontend**: ไม่จำเป็นต้องเปลี่ยน (response `seo.rules` ยังคงอยู่; อาจเพิ่ม `failed_required` field)
- **ไม่เปลี่ยน**: น้ำหนัก/tier/threshold ที่มีแล้ว, publish flow, DB schema

## Acceptance Criteria ที่ change นี้ตอบ

- Generation Contract และ SEO Evaluator ใช้ threshold/rules จาก Source of Truth เดียวกัน (กำจัด 150-160 vs 120-160)
- Feedback ระบุ rule key, status, message, expected requirement, actual result
- Final gate แจ้งสาเหตุที่แท้จริงเมื่อ generation ล้มเหลว
