## Context

`api/lib/seo-checklist.php` ปัจจุบัน (หลัง `fix-seo-scorer-inversion`):

- `SEO_WEIGHTS` 15 ข้อ มี `weight` + `critical` flag
- `seo_make_rule()` คืน `{key, level, status, weight, score, critical, message}`; status `passed/needs_improvement/failed/pending/skip`
- `seo_normalized_score()` ตัด `pending`/`skip` ออกจาก denominator
- `seo_gate_status()` คืน `failed` เมื่อมี `critical` rule `failed` หรือ score < 80
- research rules ใช้ coverage threshold (related ≥0.6, topic ≥0.7, paa ≥0.5, gap ≥0.5) โดย =0 → `failed` (แก้แล้ว)
- `search_intent` ตรวจ heuristic (signal terms) แล้ว

ปัญหา remaining:
- `structured_data`/`seo_title`/`meta_description` เป็น `critical` แต่เมื่อว่าง → `pending` (ไม่ block) — **required data missing ควรเป็น `failed`**
- research rules: เมื่อ research OFF → `pending`; เมื่อ research ON แต่ brief field ว่าง → `pending` — **ควรเป็น `n/a` (OFF) / ตรวจจริง (ON)**
- ไม่มี tier แยก required/optional/informational

## Goals / Non-Goals

**Goals:**
- เพิ่ม tier `required`/`optional`/`informational` แทน `critical` flag (คง `critical` เป็น alias)
- Required rule data missing → `failed`; research OFF → `n/a`
- `seo_generation_requirements()` เป็น generation contract (min/max + pass condition)
- gate ตัดสินจาก required rules (ไม่ใช่ score)
- Evaluator ใช้เกณฑ์เดียวกับ requirements

**Non-Goals:**
- ไม่เปลี่ยนน้ำหนัก/coverage threshold ที่มีแล้ว
- ไม่เปลี่ยน publish flow / DB schema
- ไม่ auto regenerate content เดิม

## Decisions

### 1. Rule tier 3 ระดับ (แทน `critical` flag)
`SEO_WEIGHTS[$key]` เพิ่ม `tier`:

| rule | tier | note |
|---|---|---|
| seo_title, meta_description, slug, h1, heading_structure, content_length, structured_data, primary_keyword_placement, keyword_stuffing | `required` | ตรวจจาก content/metadata โดยตรง |
| search_intent, related_keywords, topic_coverage, paa_questions, content_gap | `required` | research-dependent (research OFF → `n/a`) |
| internal_linking | `optional` | เตือนเท่านั้น ไม่ block |
| (เผื่อ extensibility) | `informational` | แสดงคุณภาพเท่านั้น |

- `critical` flag เดิม → คงไว้เป็น alias (true = required + กลุ่ม critical เดิม) เพื่อ back-compat กับ publish gate
- **เหตุผล**: ตรงตามโจทย์ "กำหนด Required, Optional, Informational ให้ชัดเจน"; internal_linking เป็น best-effort จริง จึง optional

### 2. Status `n/a` + pending→failed
- เพิ่ม status `n/a` (not applicable) — research rules เมื่อ research OFF หรือ brief field นั้นว่าง → `n/a` (ตัดออกจาก gate + scoring, เหมือน skip)
- Required rule (non-research) ที่ data missing → `failed` (ไม่ใช่ pending): `seo_title` ว่าง, `meta_description` ว่าง, `slug` ว่าง, `structured_data` ว่าง, `primary_keyword_placement` ไม่มี keyword, `content_length`/`heading_structure` ไม่มี body → `failed`
- `pending` คงเหลือเฉพาะกรณีที่ไม่เข้าข่าย required/optional (legacy) — หรือตัดทิ้งจาก required rules ทั้งหมด
- **เหตุผล**: ตรงตามคำตอบ user — "required data missing = failed", "research off = n/a"

### 3. seo_generation_requirements() → generation contract
แต่ละข้อคืน object `{key, tier, requirement, min?, max?, pass_condition}` แทนแค่ string:
- requirement: คำสั่งภาษาไทยที่ AI ต้องทำ
- min/max: ค่าที่ต้องมี (เช่น 60 char, 500 คำ)
- pass_condition: เงื่อนไขที่ถือว่าผ่าน (ให้ AI รู้เกณฑ์เดียวกับ evaluator)

- **เหตุผล**: "แปลงแต่ละ Rule เป็นข้อกำหนดที่ AI ต้องปฏิบัติตาม" + "Evaluator ใช้เกณฑ์เดียวกับ Generation Requirements"

### 4. gate ตัดสินจาก required (ไม่ใช่ score)
`seo_gate_status()`:
- มี required rule `failed` → `failed` (ไม่ว่า score สูงแค่ไหน)
- score < 80 → `failed` (คงเดิม)
- 80 ≤ score < 90 → `needs_improvement`
- else → `passed`
- `n/a`/`skip` ไม่นับ

- **เหตุผล**: "แยก Score ออกจาก Gate" + "required failed → generation ไม่สำเร็จ"

### 5. Evaluator ใช้ research data จริง (ต่อยอด)
research rules (search_intent/related/topic/paa/gap) เมื่อ research ON:
- ใช้ coverage threshold เดิม (มีแล้ว)
- ไม่ใช้ `pending` — brief field ว่าง → `n/a`; brief field มีค่า → ตรวจจริง

## Risks / Trade-offs

- **Required เข้มขึ้น → generation ล้มบ่อย** → repair loop (cap เดิม) + status=revision รองรับแล้ว; ไม่ block ลูกค้า forever
- **structured_data ว่าง → failed** (เดิม pending) → content เดิมที่ยังไม่ตั้ง structured_data จะตก gate → ผู้ใช้ต้องกรอกหรือ generate ใหม่; แจ้งชัดใน UI
- **`critical` alias กับ `tier` อาจลอย** → กำหนดให้ tier เป็น source of truth, critical คำนวณจาก tier (required + กลุ่ม critical เดิม)

## Migration Plan

- ไม่มี schema change
- Deploy: อัปโหลด `api/lib/seo-checklist.php`, `api/brand-content.php`, frontend — กลับได้ด้วย revert
- Content เดิมไม่ถูก auto-regenerate; ผู้ใช้กด "ตรวจ SEO ใหม่" เอง

## Open Questions

- `slug` ว่าง → failed จริงไหม (อาจ auto-generate จาก title แทนได้) — ปัจจุบันจัดเป็น required
- tier ไหนที่ควรเป็น `optional`/`informational` เพิ่มเติม (internal_linking เดียวพอไหม)
