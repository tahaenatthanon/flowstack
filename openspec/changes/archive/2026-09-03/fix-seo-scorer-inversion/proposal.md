## Why

SEO Checklist ถูกฉีดเข้า prompt และประเมินหลัง Generate แล้ว แต่ยัง **ไม่เป็น Quality Gate จริง** เพราะ:

1. **บาง rule ถูก "invert" สถานะ** — กฎ research ที่ควรเป็น `failed` กลับถูกจัดเป็น `pending` หรือ `passed` เช่น `search_intent` ถูก `passed` ทันทีเมื่อมี brief โดยไม่ได้ตรวจว่าคอนเทนต์สอดคล้องกับ intent จริง, ส่วน `related_keywords`/`topic_coverage`/`paa_questions`/`content_gap` ใช้ `needs_improvement` (soft) แทน `failed` เมื่อครอบคลุมไม่ถึงเกณฑ์ — ทำให้ gate ไม่ block จริง
2. **ระบบบันทึก content ได้แม้ SEO Gate ไม่ผ่าน** — เมื่อ repair ครบ max attempts แล้ว gate ยังไม่ผ่าน ระบบคืนเนื้อหา "สำเร็จ" พร้อม `seo_passed=false` แทนที่จะถือว่า Generation ล้มเหลว
3. **`primary_keyword_placement` (critical) และ `keyword_stuffing` เป็น `pending` ถาวร** เมื่อไม่มี research เพราะ backend บังคับ `meta_keywords=''` เอง ทั้งที่ AI ควรผลิต keyword ได้

## What Changes

- **บังคับ SEO Checklist เป็น Hard Requirement**: Content ถือว่าสร้างสำเร็จเมื่อผ่าน Required/Critical rules เท่านั้น ไม่ใช่ดูคะแนน SEO เพียงอย่างเดียว
- **แก้การตรวจแต่ละ rule ให้ตรงเกณฑ์จริง**:
  - `related_keywords` ต้องครอบคลุม keyword จาก research ตาม threshold; ครอบคลุม 0 → `failed`
  - `topic_coverage` ต้องครอบคลุมหัวข้อสำคัญจาก research ตาม threshold; ไม่ครอบคลุม → `failed`
  - `paa_questions` ต้องตอบคำถามที่ research พบตาม threshold; ตอบ 0 ข้อ → `failed`
  - `content_gap` ต้องเติม gap ตาม threshold; เติม 0 → `failed`
  - `search_intent` ต้องตรวจความสอดคล้องระหว่าง content กับ search intent จริง (hybrid: heuristic ตัดสิน + AI เขียน feedback)
- **แยก SEO Score ออกจาก SEO Gate**: `score` ใช้แสดงคุณภาพรวม (informational); `gate` ใช้ตัดสิน pass/fail — คะแนนสูงไม่ทำให้ผ่านหากยังมี required/critical rule ที่ `failed`
- **Generate → Evaluate → Repair Loop ที่จบด้วย failed**: หลัง AI repair ครบ max attempts แล้ว gate ยังไม่ผ่าน → เก็บ content พร้อม `status=revision` + Generation เป็น `failed` (ไม่ถือเป็นผลสำเร็จ)
- **ให้ AI ผลิต keyword ได้**: ยกเลิกการบังคับ `meta_keywords=''` — AI ผลิต `meta_keywords` ได้เมื่อไม่มี research, research override เมื่อมี

## Capabilities

### Modified Capabilities

- `content-seo-checklist`: แก้การตรวจ rule research (search_intent, related_keywords, topic_coverage, paa_questions, content_gap) ให้เป็น `failed` เมื่อไม่ถึงเกณฑ์จริง และรองรับ `meta_keywords` จาก AI
- `content-seo-generation`: repair loop ครบ max attempts แล้ว gate ไม่ผ่าน → `status=revision` + Generation failed; ไม่คืนเนื้อหาเป็นผลสำเร็จ; ให้ AI ผลิต `meta_keywords`
- `seo-quality-gate`: gate เป็นตัวตัดสิน success (ไม่ใช่ score), critical/required rule ล้ม → gate failed แม้คะแนนสูง

## Impact

- **Backend**: `api/lib/seo-checklist.php` (threshold + strict rules + search_intent heuristic), `api/brand-content.php` (`meta_keywords` จาก AI, repair loop จบด้วย revision/failed)
- **Frontend**: `src/components/content/views/ContentDetailView.tsx`, `ContentListTab.tsx`, `QuickCreateDialog.tsx` (แสดงผล generation failed + status revision), `ArticleEditor.tsx` (แสดง failed rules)
- **Behavior change**: Content เดิมไม่ถูก regenerate/repair อัตโนมัติ — ผู้ใช้กด "ตรวจ SEO ใหม่" เอง
- **ไม่เปลี่ยน**: น้ำหนัก 15 ข้อ, critical rule ชุดเดิม, publish flow, DB schema
