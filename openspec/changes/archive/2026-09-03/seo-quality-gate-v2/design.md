## Context

`api/lib/seo-checklist.php` ปัจจุบัน (หลัง change `seo-quality-gate`):

- `SEO_WEIGHTS` 15 ข้อ รวม = 100, `critical` flags
- `seo_evaluate()` คืน `{score, gate, rules[]}` โดย rule มี `{key, level, status, weight, score, critical, message}`
- สำหรับ Video ปัจจุบันตั้งกฎบทความหลายข้อเป็น `status = 'skip'` (h1, heading_structure, content_length, search_intent, primary_keyword_placement, keyword_stuffing, related_keywords, topic_coverage, paa_questions, content_gap, internal_linking) เหลือแค่ metadata + hashtags — **ขัดกับข้อกำหนดใหม่ที่ให้ตรวจครบ 15 ข้อทุก type**
- `seo_gate_status()` คืน `pass|warning|failed` (จะเปลี่ยนชื่อเป็น `passed|needs_improvement|failed`)
- ฟิลด์ที่ video มีให้ตรวจ: `article_content` (JSON) มี `title`, `scripts` (tiktok/youtube/facebook/instagram), `script_sections` (opening/bridge/twist/ending), `visuals`, `hashtags`, `seo_title`, `slug`, `meta_description`, `structured_data`

ข้อมูล research brief มีอยู่แล้ว (ผ่าน `ai_research_validate_brief()`): `primary_keyword`, `secondary_keywords`, `intent`, `paa`, `content_gaps`, `outline`

## Goals / Non-Goals

**Goals:**
- ทุก content type ตรวจครบ 15 ข้อ ไม่มี `skip`
- น้ำหนักรวม = 100 (ชุดใหม่)
- status = `passed|needs_improvement|failed`
- Video ใช้วิธีวัดผล per-type ที่สมเหตุสมผล
- Evaluator เป็น source of truth (ไม่เชื่อ AI self-report)

**Non-Goals:**
- ไม่สร้างปุ่ม/ฟีเจอร์ UI ใหม่ ("ตรวจ SEO ใหม่", Repair เดิมถูกนำมาใช้)
- ไม่เพิ่ม DB schema / migration
- ไม่ auto generate/repair content เดิม
- ไม่เปลี่ยนตัวนับคำ/helper ที่มีอยู่

## Decisions

### 1. น้ำหนักชุดใหม่รวม = 100
ประกาศ `SEO_WEIGHTS` ใหม่ (เรียงตามลำดับ Checklist):

| key | weight | critical |
|---|---|---|
| seo_title | 8 | ✓ |
| meta_description | 8 | ✓ |
| slug | 6 | |
| h1 | 6 | ✓ |
| heading_structure | 7 | |
| content_length | 8 | ✓ |
| search_intent | 8 | |
| primary_keyword_placement | 8 | ✓ |
| keyword_stuffing | 7 | |
| related_keywords | 6 | |
| topic_coverage | 8 | |
| paa_questions | 6 | |
| content_gap | 6 | |
| structured_data | 5 | ✓ |
| internal_linking | 3 | |

- **เหตุผล**: ตรงตามข้อกำหนดโดยปรับ Search Intent (10→8) และ Topic Coverage (10→8) เพื่อให้รวม 100 (ข้อกำหนดเดิมรวม 104)
- Critical = {seo_title, meta_description, h1, content_length, primary_keyword_placement, structured_data} (technical essentials — assumption ที่ยืนยันได้ในภายหลัง)

### 2. เอา `skip` ออก — Video ใช้วิธีวัดผล per-type แทน
แทนการ `skip` ให้ `seo_evaluate()` วัดผลทุก 15 ข้อ โดยเลือก source ของเนื้อหาตาม `type`:

- **Article**: ใช้ `article_content.html` (full_html) เป็นเนื้อหาหลัก
- **Video**: ใช้ `article_content.scripts` + `script_sections` + `visuals` + `description`/`hashtags` เป็น "เนื้อหา" ที่นำมาวัด

การแมป per-type:
| rule | Article source | Video source |
|---|---|---|
| content_length | word count ของ html | word count ของ scripts (รวมทุก platform) |
| heading_structure | H2/H3 ใน html | โครงสร้าง section (opening/bridge/twist/ending + scene) |
| h1 | h1 ใน html | title ของวิดีโอ (นับ 1 = pass) |
| internal_linking | `<a>` ใน html | ลิงก์ใน description/landing content (ถ้ามี) |
| structured_data | Article schema | Video schema (@type VideoObject) |
| search_intent / keyword / related / topic / paa / gap | เหมือน Article (จาก research brief เทียบกับ script+title+description) | เหมือน Article |

- **เหตุผล**: ตรงตามข้อกำหนด "วิธีประเมินต่างกันตาม type แต่ผลลัพธ์ครบ 15 ข้อ" และ "ห้าม skip"
- กรณี video ไม่มีข้อมูล source นั้น (เช่น ไม่มี description) → `pending` (ไม่หักคะแนน) แทน `skip`

### 3. status ใหม่ = passed / needs_improvement / failed
- `seo_make_rule()` คืน `status ∈ {passed, needs_improvement, failed, pending, skip}`
- `level` (alias เดิม `pass/warn/fail`) — คงไว้เพื่อ back-compat แต่ mapping ใหม่: `passed→pass`, `needs_improvement→warn`, `failed→fail`
- `seo_gate_status()` คืน `passed|needs_improvement|failed`
- **เหตุผล**: ตรงชื่อข้อกำหนด (Passed / Needs Improvement / Failed); คง `level` alias เพื่อไม่ให้ publish gate เก่าพังทันที

### 4. Evaluator เป็น source of truth (คงหลักการเดิม)
AI สร้าง/repair เท่านั้น ไม่ส่ง score/self-report; `seo_evaluate()` (deterministic) เป็นผู้ตัดสิน status/score/gate — ไม่เปลี่ยน

### 5. "ตรวจ SEO ใหม่" = re-check อย่างเดียว
`?action=seo-checklist` โหลด content + research brief → `seo_evaluate()` ครบ 15 ข้อ → คืน score/gate/rules (per-item score) โดยไม่ mutate content — คงเดิม เพิ่ม status ใหม่ + ไม่มี skip

### 6. Repair ใช้ failed/needs_improvement เป็น feedback
repair loop ใน `generate-article`: วนซ้ำขณะ `seo_gate_status() !== 'passed'` (ภายใน retry cap) — feedback ส่งกฎ `failed`/`needs_improvement` เรียงตามน้ำหนัก; หลัง repair ประเมินใหม่ครบ 15 ข้อ — คงเดิม เปลี่ยนแค่เกณฑ์จาก `pass` เป็น `passed`

## Risks / Trade-offs

- **Video ต้องมี data ครบ** → ถ้า video ไม่มี description/script แยก จะเป็น `pending` (ไม่หักคะแนน) ไม่ block — ยอมรับได้เพื่อไม่ให้ video ทุกอันตก gate
- **Research rules pending บ่อย** → normalize (ตัด pending ออกจาก denominator) คงเดิม
- **status เปลี่ยนชื่อ** → ผู้เรียกที่อ่าน `status` เดิม (`pass/warning/failed`) ต้องปรับ; `level` alias ลดความเสี่ยง
- **หัวข้อ Research ที่ประเมินเชิงความหมายหยาบ** → warning (needs_improvement) ไม่ block โดยไม่จำเป็น

## Migration Plan

- ไม่มี schema change
- Deploy: อัปโหลด `api/lib/seo-checklist.php`, `api/brand-content.php`, frontend ที่แก้ — กลับได้ด้วย revert
- Content เดิมไม่ถูก regenerate/repair อัตโนมัติ; ผู้ใช้กด "ตรวจ SEO ใหม่" เอง

## Open Questions

- ชุด critical 6 ข้อนี้ตรงตามที่ต้องการไหม (technical essentials) — ยืนยันได้
- น้ำหนักที่ปรับ (Search Intent 10→8, Topic Coverage 10→8) ตรงใจไหม หรือต้องการแจกจ่ายต่างออกไป
