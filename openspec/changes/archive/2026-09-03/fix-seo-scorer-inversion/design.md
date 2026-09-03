## Context

`api/lib/seo-checklist.php` ปัจจุบัน (หลัง `seo-quality-gate-v2`):

- `seo_evaluate()` 15 ข้อ weighted, status `passed/needs_improvement/failed/pending/skip`
- research rules 5 ข้ออ่านจาก `research_brief`:
  - `search_intent`: มี brief + `intent` → `passed` ทันที (**ไม่ตรวจจริง**)
  - `related_keywords`: พบ ≥1 → `passed`, พบ 0 → `needs_improvement` (**ไม่เคย failed**)
  - `topic_coverage`: ratio ≥0.5 → `passed`, <0.5 → `needs_improvement` (**ไม่เคย failed**)
  - `paa_questions`: ตอบ ≥1 → `passed`, ตอบ 0 → `needs_improvement` (**ไม่เคย failed**)
  - `content_gap`: เติม ≥1 → `passed`, เติม 0 → `needs_improvement` (**ไม่เคย failed**)
- `seo_gate_status()` คืน `passed/needs_improvement/failed` (≥90 / 80–89 / <80 + critical)
- `seo_normalized_score()` ตัด pending/skip จาก denominator

`api/brand-content.php` (`generate-article`):

- `$art['meta_keywords'] = $researchMetaKeywords` (เป็น `''` เมื่อไม่มี research) — ค่า AI ผลิตถูก discard → `primary_keyword_placement`/`keyword_stuffing` เป็น `pending` ถาวร
- repair loop วนขณะ gate ≠ passed (cap `SEO_GEN_MAX_ATTEMPTS=3`); ครบ cap → คืน `article` + `seo_passed=false` (HTTP สำเร็จ, ไม่ set `status`)

## Goals / Non-Goals

**Goals:**
- rule research ต้องเป็น `failed` เมื่อไม่ถึงเกณฑ์จริง (ไม่ invert เป็น pending/passed)
- `search_intent` ตรวจความสอดคล้องจริง (heuristic + AI feedback)
- แยก score (informational) ออกจาก gate (ตัดสิน success)
- repair ครบ cap แล้ว gate ไม่ผ่าน → `status=revision` + Generation failed
- ให้ AI ผลิต `meta_keywords` ได้ (research override)

**Non-Goals:**
- ไม่เปลี่ยนน้ำหนัก/critical rule ชุดเดิม
- ไม่เปลี่ยน publish flow / DB schema
- ไม่ auto regenerate content เดิม

## Decisions

### 1. Threshold แบบ 3 ระดับ (failed / needs_improvement / passed)
แต่ละ rule research ใช้ threshold coverage ratio (ครอบคลุมต่อรายการ research):

| rule | passed | needs_improvement | failed |
|---|---|---|---|
| related_keywords | ≥ 0.6 | 0 < x < 0.6 | = 0 |
| topic_coverage | ≥ 0.7 | 0.3–0.7 | < 0.3 |
| paa_questions | ≥ 0.5 | 0 < x < 0.5 | = 0 |
| content_gap | ≥ 0.5 | 0 < x < 0.5 | = 0 |

- `pending` เมื่อไม่มี brief หรือ field ของ brief นั้นว่าง (ไม่มี data ให้ตรวจ) — คงเดิม
- **เหตุผล**: ตรงตามข้อกำหนด "ต้องครอบคลุมตามเกณฑ์" และ "แก้สถานะที่ควร failed"; `=0` คือ hard fail (ไม่ใช่ soft)
- **ทางเลือก**: ใช้ `passed/failed` 2 ระดับ — แต่จะตีเนื้อหาที่ครอบคลุมบางส่วนเป็น failed ทันที ซึ่ง aggressive เกิน; 3 ระดับสมดุลกว่า

### 2. search_intent — hybrid heuristic + AI feedback
`seo_evaluate()` ตรวจ intent ด้วย heuristic (deterministic):
- map intent → signal terms (informational: วิธี/คือ/ทำไม/how/what; commercial: เปรียบเทียบ/รีวิว/ดีที่สุด; transactional: ซื้อ/สมัคร/ราคา/สั่งซื้อ; navigational: brand/เข้าเว็บ)
- ถ้า primary keyword + signal terms ของ intent ตรง ปรากฏใน content → `passed`; ถ้าขัด (signal ของ intent อื่นเด่นกว่า) → `failed`; ไม่มี signal ชัด → `needs_improvement` (uncertain)

feedback ให้ AI ใน repair loop ใช้ผลนี้ + ข้อความ intent เพื่อให้ AI ปรับเนื้อหา

- **เหตุผล**: ตรงตาม "Hybrid: heuristic ตัดสิน + AI เขียน feedback" — evaluator deterministic เป็น source of truth, AI รับ feedback ไป repair
- **ทางเลือก**: ใช้ AI ประเมิน intent ตรง ๆ — เพิ่ม token/latency และขัดหลัก "evaluator เป็น source of truth"; ไม่เลือก

### 3. แยก score กับ gate (strengthen)
`seo_gate_status()` คงเดิม แต่ clarify ว่า gate เป็นตัวตัดสิน success:
- `passed` = ไม่มี required/critical rule `failed` และ score ≥ 90
- `failed` = มี required/critical rule `failed` (ไม่ว่า score สูงแค่ไหน) หรือ score < 80
- score คงเป็นตัวเลข informational ที่ UI แสดง

- **เหตุผล**: "คะแนนสูงไม่ควรทำให้ผ่าน หากยังมี Required/Critical Rule ที่ไม่ผ่าน" — critical rule logic เดิมทำอยู่แล้ว แต่ต้องขยายให้ research rules ที่เป็น `failed` ทำให้ gate ไม่ `passed` ด้วย (ผ่านกลไก score<80 หรือทำให้ research rules เป็น required)
- Research rules ไม่ใช่ critical → จะ block ผ่านกลไก score (หาก coverage ต่ำ คะแนนรวมจะ < 90) — ยืนยันว่าระบบ normalize คะแนนถูกต้อง

### 4. Repair loop จบด้วย status=revision + failed
`generate-article`:
- วน repair ขณะ gate ≠ `passed` (cap เดิม)
- หลัง loop ถ้า gate = `passed` → save ปกติ (status คงเดิม/ไม่บังคับ)
- ถ้า gate ≠ `passed` → save content ด้วย `status='revision'` + คืน `seo_passed=false` + `generation_status='failed'` (ไม่ถือเป็นผลสำเร็จ)
- **เหตุผล**: ตรงตาม "เก็บ + status=revision" และ "ไม่ให้ content ที่ไม่ผ่านถูกถือว่าสร้างสำเร็จ"
- requirement เดิม "ถึงเพดานแล้วคืนเนื้อหาที่ดีที่สุดพร้อม seo_passed=false" ถูก **MODIFIED** ให้เป็น status=revision + failed

### 5. meta_keywords — ให้ AI ผลิต (research override)
`generate-article` เปลี่ยน `$art['meta_keywords']`:
- มี research brief → ใช้ research keywords (เดิม)
- ไม่มี research → ใช้ `$mainData['meta_keywords'] ?? ''` (AI ผลิต) แทน `''` เสมอ
- `primary_keyword_placement`/`keyword_stuffing` จึงไม่เป็น `pending` ถาวรเมื่อ AI ผลิต keyword ให้

- **เหตุผล**: ตรงตาม "ให้ AI ผลิต keyword ได้"; research ยัง override ตามเดิม

## Risks / Trade-offs

- **Research rules เข้มขึ้น → repair บ่อย/แพงขึ้น** → bounded ด้วย retry cap; ครบ cap → revision (ไม่ block ลูกค้า forever)
- **search_intent heuristic หยาบ** → intent signal terms best-effort; uncertain → `needs_improvement` (ไม่ block โดยไม่จำเป็น) + AI feedback
- **meta_keywords จาก AI อาจไม่ตรง research** → research override ยังคงทำงานก่อนเสมอ

## Migration Plan

- ไม่มี schema change
- Deploy: อัปโหลด `api/lib/seo-checklist.php`, `api/brand-content.php`, frontend ที่แก้ — กลับได้ด้วย revert
- Content เดิมไม่ถูก auto-regenerate; ผู้ใช้กด "ตรวจ SEO ใหม่" เอง

## Open Questions

- Threshold coverage (0.6/0.7/0.5) ตรงใจไหม หรือต้องการให้ research rules ทั้งหมดเป็น required (block ทันทีเมื่อ =0)
