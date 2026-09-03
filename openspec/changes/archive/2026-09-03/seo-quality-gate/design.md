## Context

`api/lib/seo-checklist.php` ปัจจุบันมี:

- `seo_evaluate(array $item): array` — ฟังก์ชันบริสุทธิ์ คืน `['score' => int, 'rules' => array<{key, level, message}>]` โดย `level ∈ {pass, warn, fail, pending, skip}` และคิดคะแนนแบบ penalty คงที่ (`SEO_PENALTY_FAIL = 12`, `SEO_PENALTY_WARN = 4`)
- `seo_gate_check(PDO $db, string $tenantId, array $item)` — อ่าน `seo_gate_enabled`/`seo_gate_min_score` แล้วบล็อกเมื่อมี `fail` หรือคะแนนต่ำ
- `seo_generation_requirements(string $type)` — คืนข้อกำหนดภาษาไทยสำหรับฉีดเข้า AI prompt (เพิ่มใน change ก่อนหน้า)
- ผู้เรียก: `generate-article` (repair loop), `?action=seo-checklist`, `?action=publish`, `cron/publish-scheduler.php`, `content-publish.php`

มีข้อมูล AI Research อยู่แล้ว (`content_research_jobs.analysis` + `content_research_keywords` ที่มี `intent`, `difficulty`, `is_selected`) ซึ่งผ่าน `ai_research_validate_brief()` คืน brief ที่มี `primary_keyword`, `secondary_keywords`, `intent`, `paa`, `content_gaps`, `outline`, `target_word_count` — กฎใหม่ 5 ข้อ (Search Intent, Related Keywords, Topic Coverage, PAA, Content Gap) จะอ่านจากตรงนี้

## Goals / Non-Goals

**Goals:**
- ขยายเป็น 15 ข้อครบชุด ครอบคลุม Technical/Content/Keyword/Intent/Research/Structured Data
- คิดคะแนน weighted (0–100) จากผลตรวจจริง พร้อมคะแนนรายข้อ
- เพิ่ม SEO Quality Gate (Pass/Warning/Failed) + critical rules
- บังคับให้ Workflow ตรวจครบ 15 ข้อ + AI Repair + ตรวจใหม่ทั้งชุดจนผ่านหรือถึง retry cap

**Non-Goals:**
- ไม่เพิ่ม DB schema / migration (ใช้ research data + `content_global_settings` เดิม)
- ไม่เปลี่ยน endpoint path (`?action=seo-checklist` ยังอยู่)
- ไม่เปลี่ยนตัวนับคำ/ตัวดึงข้อความที่มีอยู่ (นำกลับมาใช้)
- ไม่สร้างหน้าจอใหม่ — ปรับหน้า SEO/AEO เดิมให้แสดงคะแนนรายข้อ/สถานะ gate

## Decisions

### 1. Weight catalog เป็นค่าคงที่ในไฟล์เดียว (single source of truth)
ประกาศ `SEO_WEIGHTS` เป็น const array (15 ข้อ, รวม = 100) ใน `api/lib/seo-checklist.php` และใช้ทั้ง `seo_evaluate()` (คิดคะแนน) กับ `seo_generation_requirements()` (เรียง/แสดงตามน้ำหนัก) เพื่อกัน drift

น้ำหนัก (รวม 100):
| key | น้ำหนัก | critical |
|---|---|---|
| seo_title | 8 | ✓ |
| meta_description | 8 | ✓ |
| slug | 4 | |
| h1 | 5 | ✓ |
| heading_structure | 5 | |
| content_length | 8 | ✓ |
| search_intent | 7 | |
| primary_keyword_placement | 10 | ✓ |
| keyword_stuffing | 5 | |
| related_keywords | 6 | |
| topic_coverage | 7 | |
| paa_questions | 5 | |
| content_gap | 4 | |
| structured_data | 8 | ✓ |
| internal_linking | 10 | |

- **เหตุผล**: น้ำหนักประกาศที่เดียว, รวม = 100 ตรวจได้, critical flags ชัดเจน
- **ทางเลือก**: น้ำหนัก config ใน DB (`content_global_settings`) — ยืดหยุ่นแต่เพิ่ม scope/migration ไม่เลือกในรอบนี้ (บันทึกเป็น open question)

### 2. โมเดล status + คะแนนรายข้อ (additive ต่อ `level`)
กฎแต่ละข้อคืน `['key', 'level', 'status', 'weight', 'score', 'message']`:
- `level` คงค่าเดิม `pass|warn|fail|pending|skip` (alias — ไม่ breaking ผู้เรียกเดิม)
- `status` ใหม่ `pass|warning|failed|pending|skip` (mapping: warn→warning, fail→failed)
- `score` = คะแนนที่ได้ของข้อนี้ (0..weight): pass=weight, warning=round(weight/2), failed=0, pending/skip=0 (ไม่นับ)
- `weight` = น้ำหนักข้อนี้

- **เหตุผล**: คง `level` เพื่อไม่ให้ publish gate / approval tab / SEO panel พังทันที ขณะเพิ่ม `status`/`score`/`weight` ให้ UI แสดงคะแนนรายข้อได้

### 3. คะแนนรวมแบบ normalized (skip/pending ไม่ถูกลงโทษ)
`score = round(100 × Σ(score ของข้อที่ถูกประเมิน) / Σ(weight ของข้อที่ถูกประเมิน))`
- ข้อที่ `skip` (ไม่เกี่ยวกับชนิด เช่น วิดีโอข้ามกฎบทความ) และ `pending` (ยังไม่มี research/data) ถูก **ตัดออกจากทั้งเศษและส่วน** แล้ว normalize กลับเป็น 100
- **เหตุผล**: ไม่ลงโทษ content ที่ยังไม่มี research job; "เต็ม 100" ยังมีความหมายเทียบเท่ากัน
- **ทางเลือก**: skip/pending = คะแนนเต็ม — แต่จะทำให้ content ผ่านง่ายเกินไปโดยไม่ต้องมี research ขัดกับเป้าหมาย; เลือก normalize

### 4. SEO Quality Gate จาก score + critical rules
เพิ่ม `seo_gate_status(array $eval): string` คืน `pass|warning|failed`:
- `failed` ถ้า score < 80 **หรือ** มี critical rule ใด `status = 'failed'`
- `warning` ถ้า 80 ≤ score < 90 และไม่มี critical failed
- `pass` ถ้า score ≥ 90 และไม่มี critical failed

Critical rules = {seo_title, meta_description, h1, content_length, primary_keyword_placement, structured_data}

- **เหตุผล**: ตรงตามข้อกำหนด 90–100 ผ่าน / 80–89 ปรับปรุง / <80 ไม่ผ่าน + critical บังคับ
- `seo_gate_check()` เดิมเปลี่ยนมาใช้ `seo_gate_status()` แทนการนับ `fail` อย่างเดียว แต่คงการอ่าน `seo_gate_enabled`/`seo_gate_min_score` ไว้ (min_score เทียบกับ score ใหม่)

### 5. Mapping 15 ข้อ → ข้อมูล/เงื่อนไข
- ข้อ 1–6, 8, 9, 14, 15 = technical/content/keyword/structure (ใช้ HTML + metadata เดิม ขยาย heading_structure, keyword_stuffing)
- ข้อ 7, 10, 11, 12, 13 = ขึ้นกับ research brief:
  - `search_intent`: เทียบ `intent` จาก brief กับเนื้อหา (best-effort keyword/intent hint) — `pending` เมื่อไม่มี brief
  - `related_keywords`: นับ `secondary_keywords` ที่ปรากฏในเนื้อหา — `pending` เมื่อไม่มี
  - `topic_coverage`: เทียบ `outline` กับ H2/H3 ที่มี — `pending` เมื่อไม่มี outline
  - `paa_questions`: นับคำถามจาก `paa` ที่เนื้อหาตอบ — `pending` เมื่อไม่มี
  - `content_gap`: ใช้ `content_gaps` เป็น checklist — `pending` เมื่อไม่มี
- **เหตุผล**: ใช้ data ที่มีอยู่แล้ว ไม่ต้องเพิ่ม API; เมื่อไม่มี research → pending → ไม่หักคะแนน (normalize)

### 6. Workflow บังคับครบ 15 ข้อ + re-check ทั้งชุด
`generate-article` repair loop เปลี่ยนจาก "ซ้ำเมื่อมี `fail`" เป็น "ซ้ำขณะ `seo_gate_status() !== 'pass'`" (ยังไม่ถึง retry cap) และ feedback ส่งกฎที่ `failed`/`warning` เรียงตามน้ำหนักมาก→น้อย; หลังแต่ละรอบ **ตรวจใหม่ครบ 15 ข้อ** (ไม่ตรวจเฉพาะข้อที่ติด)
- `SEO_GEN_MAX_ATTEMPTS` คงที่ 3 (รวมรอบแรก)
- **เหตุผล**: "ห้ามข้าม Checklist" + "ตรวจใหม่ทั้งหมด" ตามข้อกำหนด

## Risks / Trade-offs

- **คะแนนเปลี่ยนความหมาย** (penalty → weighted/normalized) → ผู้เรียกที่ hardcode คะแนน (เช่น `seo_gate_min_score` เดิมตั้งไว้ต่ำ) อาจเห็นเกตพฤติกรรมต่าง → แจ้งใน migration plan + เทียบ min_score ใหม่
- **Research-dependent rules เป็น pending บ่อย** (ไม่มี research job) → normalize ทำให้คะแนนอาจสูงจากข้อที่เหลือ → ลดผลกระทบด้วย critical rules ที่ไม่ขึ้นกับ research (technical 6 ข้อ)
- **Search Intent/Content Gap ประเมินได้หยาบ** (ไม่มี NLP เต็มรูปแบบ) → ใช้ best-effort keyword/intent match + `warning` ไม่ใช่ `failed` (ไม่ block โดยไม่จำเป็น)
- **Repair จนกว่า pass (≥90) แพงขึ้น** → bounded ด้วย retry cap 3 รอบ; กรณีไม่ถึง pass คืน `seo_passed=false` + ผลล่าสุด

## Migration Plan

- ไม่มี schema change
- Deploy: อัปโหลด `api/lib/seo-checklist.php`, `api/brand-content.php`, `api/content-publish.php`, `api/cron/publish-scheduler.php`, frontend ที่แก้ — กลับได้ด้วย revert ไฟล์
- หลัง deploy ตรวจ `seo_gate_min_score` เดิม (ถ้าเคยตั้งตาม penalty score) ควรปรับให้สอดคล้องกับ scale ใหม่ (0–100 weighted)

## Open Questions

- ควรย้ายน้ำหนัก/critical flags ไป config ใน DB (`content_global_settings`) เพื่อให้ admin ปรับได้ไหม (รอบนี้ hardcode ใน code)
- Search Intent / Content Gap ควรใช้ AI ประเมินเชิงความหมายแทน keyword match ไหม (เพิ่ม token/latency)
