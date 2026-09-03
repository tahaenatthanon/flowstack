## Context

`api/lib/seo-checklist.php` มี `seo_generation_requirements()` คืน `{key, tier, requirement, min?, max?, pass_condition}` แล้ว แต่ `api/brand-content.php`:
- `$jsonSchema`/`$mainSys` ยัง hardcode ค่าเกณฑ์ (เช่น meta_description "150-160 chars" — drift จาก 120–160 จริง)
- prompt mapping ใช้เฉพาะ `requirement` (ไม่ใช้ `pass_condition`/`min`/`max`)
- repair feedback ใช้ `key [status]: message` เท่านั้น

`seo_evaluate()` ข้อที่ fail มี `message` ที่บางข้อรวม actual value แล้ว (เช่น "ปัจจุบัน 140 ตัวอักษร", "~400 คำ") แต่ไม่สม่ำเสมอ และไม่มี `expected` (pass_condition) ใน feedback

## Goals / Non-Goals

**Goals:**
- prompt field hints derive จาก contract (`pass_condition` + `min`/`max`) ไม่ hardcode
- กำจัด drift (meta_description 120–160 ทั้ง prompt และ evaluator)
- feedback ต่อข้อครบ: key/status/message/expected/actual
- final gate คืนรายการ required failures ชัดเจน

**Non-Goals:**
- ไม่เปลี่ยน tier/threshold/น้ำหนัก
- ไม่เปลี่ยน validation loop ตรรกะ (loop อยู่แล้ว)
- ไม่เปลี่ยน publish gate / DB schema

## Decisions

### 1. สร้าง helper `seo_contract_hints(string $type): string`
ใน `api/lib/seo-checklist.php` คืนข้อความ field-hint ภาษาไทยที่ derive จาก contract ต่อข้อ (`requirement` + `pass_condition` + `min`/`max`) สำหรับใช้ใน `$jsonSchema`/`$mainSys` — แทนการ hardcode

- **เหตุผล**: จุดเดียวสำหรับทั้ง prompt และ evaluator; เปลี่ยน threshold ครั้งเดียวมีผลทั้งคู่
- **ทางเลือก**: แก้ hardcode ตรง ๆ ใน prompt — แต่กลับมา drift อีกเมื่อแก้ threshold; ไม่เลือก

### 2. แก้ `$jsonSchema`/`$mainSys` ให้อ้างอิง hint
- แทนที่ `"meta_description":"Meta description ภาษาไทย 150-160 chars"` ด้วยค่า 120–160 จาก contract
- แทนที่ `full_html >=500 คำ` และ slug description ด้วย pass_condition จาก contract
- Video prompt ใช้ hint เดียวกัน

### 3. feedback ต่อข้อครบ expected + actual
feedback format:
```
- [key] status
  expected: <pass_condition>
  actual: <ค่าที่วัดได้ หรือ '-' ถ้าไม่มี>
  message: <message>
```
`seo_evaluate()` ต้องให้ `actual` ใน message อย่างสม่ำเสมอ (ใช้ค่าที่มีอยู่แล้ว เช่น length, word count, coverage ratio)

### 4. final gate response เพิ่ม `failed_required`
`generate-article` response เพิ่ม `failed_required` = รายการ required rule ที่ `failed` (key, message, expected) — ให้ frontend/ผู้ใช้เห็นสาเหตุจริง

## Risks / Trade-offs

- **Prompt ยาวขึ้นเล็กน้อย** (hint ครบ) → max_tokens เพียงพอแล้ว (8192)
- **feedback verbosity** → AI ยังรับได้; แก้เฉพาะจุดดีกว่า regenerate

## Migration Plan

- ไม่มี schema change
- Deploy: `api/lib/seo-checklist.php` + `api/brand-content.php` — กลับได้ด้วย revert

## Open Questions

- ต้องการให้ `failed_required` ปรากฏใน UI toast หรือเฉพาะ API response
