## Context

**ผลตรวจตอนนี้:** `seo_evaluate()` และ `aeo_evaluate()` คืน rule ที่มี `tier` (`required`/`optional`/`informational`) อยู่แล้ว แต่ SEO มีข้อ `optional` แค่ข้อเดียว (`internal_linking`) และ AEO ไม่มีเลย `seo_gate_status()`/`aeo_gate_status()` ให้ผล `failed` ในกรณีเหล่านี้:
- มี required หรือ critical rule ที่ `failed`
- คะแนนต่ำกว่า 70
- คะแนน 70–79 จะได้ `needs_improvement` ซึ่งทุกจุดถือว่าไม่ผ่าน

**การเรียก gate ตอนนี้กระจายอยู่ 5 จุด และใช้เงื่อนไขต่างกัน:**

| จุด | ฟังก์ชัน | ดู `seo_gate_enabled` | ดู `min_score` |
|---|---|---|---|
| Generate (`brand-content.php` ~2997–3170) | `seo_gate_status` / `aeo_gate_status` | ไม่ | ไม่ |
| ขออนุมัติ (`approvals.php:143`) | `content_quality_gate_check` | ไม่ | ไม่ |
| เผยแพร่ทันที/ตั้งเวลา (`final_publish_gate_check`) | `seo_gate_check` + `aeo_gate_status` | ใช่ | ใช่ (SEO) |
| Cron (`publish-scheduler.php:149`) | `seo_gate_check` | ใช่ | ใช่ |
| Recheck (`quality-recheck`) | evaluate แล้วคืน `gate` | ไม่ (แค่คืนค่ากลับ) | ไม่ |

**Repair ตอนนี้:** SEO ได้ไม่เกิน 2 รอบ แล้วตามด้วย AEO อีกไม่เกิน 2 รอบ แต่ละรอบให้ AI คืน JSON บทความทั้งฉบับ และ feedback ใส่ทั้งข้อ `failed` และ `needs_improvement`

**ข้อมูลจาก DB local (33 บทความ):** SEO ไม่ผ่าน 25 ชิ้น ข้อที่ตกบ่อย:
- `seo_title` 16 ชิ้น ยาว 61–70 ตัวอักษร
- `primary_keyword` 10 ชิ้น
- `meta_description` 9 ชิ้น
- `content_gap` 8 จาก 10 ชิ้นที่มี research
- `content_length` 5 ชิ้น

## Goals / Non-Goals

**Goals:**
- ใช้ Required rule ที่ `failed` เป็นเกณฑ์เดียวในการตัดสินผ่าน/ไม่ผ่าน ทั้ง SEO และ AEO
- ฟังก์ชัน gate กลางตัวเดียว ใช้ที่ Generate, ขออนุมัติ, เผยแพร่ และ cron
- เรียก AI ตอน generate ไม่เกิน 2 ครั้ง (สร้าง + repair 1 รอบ)
- ผู้ใช้แก้เองแล้วตรวจใหม่ได้ โดยไม่เรียก AI และตรวจจากข้อมูลที่บันทึกแล้วเท่านั้น
- แสดงผลแยกกลุ่ม Required / Recommended ให้เห็นชัด

**Non-Goals:**
- Quality Gate สำหรับวิดีโอ ทำแยกภายหลังถ้าจำเป็น
- เปลี่ยนน้ำหนักคะแนนหรือวิธีคำนวณคะแนน 0–100
- ลบคอลัมน์ `seo_gate_min_score`
- เปลี่ยนเงื่อนไข Approval และการผูก approval กับเวอร์ชันของคอนเทนต์
- เปลี่ยนการเลือก platform ที่ต้องผ่าน gate: ขออนุมัติและเผยแพร่ยังใช้ gate กับ platform เว็บ/CMS เท่านั้นเหมือนเดิม ส่วน platform โซเชียลไม่มี Quality gate

## Decisions

### D1. Tier catalog และการเปลี่ยนชื่อ `optional` เป็น `recommended`
แก้ใน `SEO_WEIGHTS` และ `AEO_WEIGHTS` โดยตรง ซึ่งเป็น source of truth เดิม

| กลุ่ม | Required | Recommended |
|---|---|---|
| SEO | `seo_title`, `meta_description`, `slug`, `h1`, `content_length`, `primary_keyword_placement`, `keyword_stuffing`, `structured_data` | `heading_structure`, `search_intent`, `related_keywords`, `topic_coverage`, `paa_questions`, `content_gap`, `internal_linking` |
| AEO | `direct_answer`, `structured_data` | `search_intent`, `qa_structure`, `heading_questions`, `snippet_readiness`, `paa_coverage`, `entity_clarity` |

- ค่า tier เหลือ `required` | `recommended` | `informational`
- ฝั่ง TS กับ UI ยังรับค่า `optional` แล้วแสดงเป็น "ข้อแนะนำ" เพื่อรองรับข้อมูลเก่าที่แคชไว้ใน response
- ทางเลือกที่ไม่เลือก: เก็บค่า `optional` ไว้แล้วเปลี่ยนแค่ label เราไม่เลือกเพราะคำในโค้ดควรตรงกับคำที่ใช้คุยกัน และมีจุดที่ต้องแก้ไม่มาก

### D2. เพดานแข็งใช้ระดับ `status` ไม่ต้องแยก rule ใหม่
แต่ละข้อยังเป็น rule เดียว สิ่งที่ `seo_evaluate` ส่งออกมาทำให้แยกระดับได้เอง:

| rule | `failed` (บล็อก) | `needs_improvement` (ผ่าน + แนะนำ) | `passed` |
|---|---|---|---|
| `seo_title` | ว่าง หรือ > 60 | – | 1–60 |
| `meta_description` | ว่าง หรือ > 160 | 1–119 | 120–160 |
| `content_length` (article) | < 300 คำ | 300–499 | ≥ 500 |
| `primary_keyword_placement` | ไม่มี keyword หรืออยู่ 0 ตำแหน่ง | อยู่ 1 ถึง N−1 ตำแหน่ง | ครบทุกตำแหน่ง |

- เพิ่มค่าคงที่ `META_DESC_HARD_MAX = 160` (เท่ากับ `META_DESC_MAX`) และ `WORD_COUNT_HARD_MIN = 300`
- `seo_generation_requirements()` คืน `pass_condition` ที่หมายถึงเกณฑ์ Required และเพิ่มฟิลด์ `recommended` เป็นข้อความของช่วงที่แนะนำ
- prompt ยังบอก AI ให้เล็งช่วงที่แนะนำ (120–160 และ ≥500 คำ) เพื่อให้ได้คุณภาพดีตั้งแต่รอบแรก ส่วน gate ตัดสินแค่เกณฑ์ Required

### D3. `*_gate_status` ตัดสินจาก Required failed เท่านั้น
```
gate_status(eval) = 'failed' ถ้ามี rule.tier==='required' && rule.status==='failed'
                    'passed' กรณีอื่นทั้งหมด (needs_improvement, pending, n/a ถือว่าผ่าน)
```
- ตัดเงื่อนไขคะแนนและ flag `critical` ออก แต่ยังคง `critical` ไว้ใน rule object เพื่อไม่ให้ response เปลี่ยนรูป
- ค่าที่คืนเหลือ `passed` | `failed` ส่วน UI ยังรับ `needs_improvement` ได้ เพราะใช้กับสถานะรายข้อด้วย
- ค่าคงที่ `SEO_GATE_PASS_SCORE`, `SEO_GATE_WARN_SCORE`, `AEO_GATE_*` ลบทิ้ง ถ้ายังมีจุดอื่นอ้างอยู่ให้แก้ไปพร้อมกัน

### D4. ฟังก์ชัน gate กลาง `quality_required_gate()` ใน `api/lib/publish-dispatch.php`
```php
quality_required_gate(PDO $db, string $tenantId, array $content, ?array $brief, bool $requireMarker = true): array
// คืน ['blocked'=>bool, 'reason'=>?string, 'seo'=>?eval, 'aeo'=>?eval, 'failed_required'=>list]
```
ลำดับการตรวจ:
1. `type === 'video'` คืน `blocked=false` ทันที ไม่เช็ค marker และไม่ evaluate
2. `seo_gate_enabled` ของ tenant เป็น 0 จะเช็คเฉพาะ marker (ถ้า `requireMarker`) แล้วคืนผลว่าไม่บล็อก
3. `requireMarker` และ `article_content.quality_checked_at` ว่าง คืน `blocked` พร้อมข้อความ "ยังไม่ได้ตรวจ SEO/AEO ของเวอร์ชันนี้ กรุณาบันทึกแล้วกด ตรวจ SEO/AEO ใหม่"
4. evaluate SEO+AEO ใหม่จาก `$content` ที่อ่านจาก DB ในคำขอนั้น แล้วบล็อกถ้า Required ใด `failed` พร้อมข้อความรายข้อภาษาไทยในรูป "SEO: …" และ "AEO: …"

จุดที่เรียก:
- **ขออนุมัติ:** `content_quality_gate_check()` ยังจำกัดเฉพาะเมื่อเลือก platform เว็บเหมือนเดิม แล้วเรียก gate กลาง
- **เผยแพร่:** `final_publish_gate_check()` เรียก gate กลางแทน `seo_gate_check` + `aeo_gate_status` สำหรับ platform เว็บ
- **Cron:** `publish-scheduler.php` เรียก gate กลางแทน `seo_gate_check`
- **Generate:** ใช้ `quality_required_status($seoEval, $aeoEval)` ที่เป็น pure function ตัวเดียวกับที่ gate กลางใช้ภายใน เพราะตอน generate ยังไม่มีข้อมูลใน DB และ marker ยังไม่ถูกตั้ง

`seo_gate_check()` เดิมจะลบทิ้ง หรือเปลี่ยนเป็น wrapper ที่เรียก gate กลาง ขึ้นกับว่ายังมีคนใช้อยู่ไหม ส่วน `seo_gate_min_score` ไม่ถูกอ่านเพื่อตัดสินผลอีก

- ทางเลือกที่ไม่เลือก: ให้ใช้ผลตรวจล่าสุดที่เก็บไว้เป็นตัวตัดสิน เราไม่เลือกเพราะ user กำหนดให้ขออนุมัติและเผยแพร่ต้องประเมินใหม่ทุกครั้ง และการประเมินเป็น pure function ที่เร็ว

### D5. Repair รวม SEO+AEO 1 รอบ
- หลังสร้างบทความ ให้ evaluate SEO+AEO
- ถ้า `quality_required_status` เป็น `failed` ให้เรียก AI 1 ครั้ง feedback ใส่เฉพาะ Required ที่ `failed` จากทั้งสองชุด แต่ละข้อมี `key`, `message`, `expected`, และ `actual` ถ้ามี
- หลัง repair ให้ evaluate ใหม่ทั้งสองชุด แล้วตัดสินครั้งเดียว
- ใช้ค่าคงที่ใหม่ `QUALITY_REPAIR_MAX_ROUNDS = 1` แทน `SEO_GEN_MAX_ATTEMPTS` ในเส้นทางนี้
- ถ้ายังไม่ผ่าน ให้บันทึก `status='revision'` และคืน `failed_required` ตามกลไกเดิม และไม่ตั้ง `quality_checked_at`
- วิดีโอ (`$isVideo`) ยัง evaluate เพื่อเก็บคะแนนไว้ดู แต่ไม่ repair, ไม่ตั้ง `revision` เพราะ SEO/AEO และถือว่า `generation_status='success'` ด้าน quality
- ทางเลือกที่ไม่เลือก: 0 รอบ เราไม่เลือกเพราะข้อ Required ที่ตกบ่อย เช่น title ยาวเกิน หรือ slug/structured_data หาย AI แก้ได้ถูกและได้ผลแน่นอน

### D6. ปุ่ม "ตรวจ SEO/AEO ใหม่" ใน footer
- เปลี่ยนชื่อปุ่ม "ตรวจ Quality" ใน `ContentCardDialog` และปิดปุ่มเมื่อ `isDirty` ที่ใช้คำนวณปุ่มบันทึกอยู่แล้ว (บรรทัด ~283)
- ตอนปุ่มปิด tooltip และข้อความข้างปุ่มแสดงว่า "บันทึกบทความก่อนตรวจ SEO/AEO"
- endpoint `quality-recheck` คงเดิม: อ่านจาก DB แล้วตั้ง `quality_checked_at` ทุกครั้ง และคืน `gate` ตามกฎใหม่ พร้อมเพิ่ม `failed_required`
- `ArticleEditor` ถอดปุ่ม "ตรวจ SEO" และการเรียก `?action=seo-checklist` เองออก แผงผลตรวจรับผลจากที่ dialog ส่งลงมา ซึ่งมาจากผล recheck ล่าสุดหรือผลที่เก็บไว้ ถ้ายังไม่มีผลให้แสดง "ยังไม่ได้ตรวจ"
- endpoint `seo-checklist` ยังเก็บไว้ให้ผู้เรียกอื่นใช้ แต่คืน gate ตามกฎใหม่

### D7. การแสดงผลแยก Required / Recommended
- ใช้คอมโพเนนต์รายการผลตรวจตัวเดียว ทั้งในแผง `ArticleEditor` และ `ContentApprovalTab`
- แบ่งเป็นสองกลุ่ม: **ข้อบังคับ (Required)** และ **ข้อแนะนำ (Recommended)**
- แต่ละข้อแสดงสถานะ ผ่าน / ควรปรับปรุง / ไม่ผ่าน / ไม่เกี่ยวข้อง พร้อมข้อความ
- หัวแผงแสดง "ผ่าน" หรือ "ไม่ผ่าน (ติดข้อบังคับ N ข้อ)" และมีคะแนน "xx/100" เป็นข้อมูลรอง

## Risks / Trade-offs

- **[คุณภาพ SEO เฉลี่ยอาจลดลง** เพราะข้อที่อิง research ไม่บล็อกแล้ว] → ยังแสดงเป็นข้อแนะนำพร้อมคะแนน และ prompt ยังขอให้ครอบคลุม research เหมือนเดิม
- **[บทความเดิมที่ตั้ง `revision` ไว้เพราะกฎเก่า** จะยังเป็น `revision` อยู่] → ผู้ใช้กด "ตรวจ SEO/AEO ใหม่" แล้วส่งอนุมัติได้เลย ไม่ต้อง migrate ข้อมูล
- **[ข้อความที่อ้างคะแนน 80/70 ยังค้างอยู่** ใน UI หรือเทสต์] → tasks มีขั้นตอนค้นหา `80`/`SEO_GATE_*` ทั้ง repo
- **[repair รอบเดียวอาจแก้ไม่ครบ]** → ตั้งใจให้เป็นแบบนี้ ผู้ใช้เห็นรายการ Required ที่ตกและแก้เองได้
- **[ผู้เรียก `seo_gate_check` จากที่อื่น]** → ค้นหาทุกจุดก่อนลบ ถ้ายังมีคนใช้ให้เปลี่ยนเป็น wrapper
- **[การตัด `needs_improvement` ออกจากค่าที่ gate คืน]** อาจกระทบ UI ที่ map ค่านี้เป็น label → UI ยังเก็บ mapping ไว้ แค่ gate ไม่คืนค่านี้แล้ว
