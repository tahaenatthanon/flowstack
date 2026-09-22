## Context

ระบบสร้างภาพมี 2 เส้นทางที่แยกกันโดยสิ้นเชิง (ยืนยันจากโค้ดจริงใน `api/brand-content.php`):

```
generate-image (action)          ← ภาพปกบทความ 1 ภาพ (จาก image_brief)
  $fullPrompt = $prompt;
  ... enrichment: brand colors + product ref (~line 1339-1346) ...
  → ยิงโมเดล

_generateOneSceneImage() (helper) ← ภาพต่อ scene วิดีโอ (จาก visual_prompt)
  ใช้ $enrichSuffix parameter (brand colors + product ref)
  เรียกจาก generate-scene-images (bulk) และ generate-scene-image (retry รายฉาก)
  → ยิงโมเดล
```

ทั้ง 2 จุดมี "enrichment" อยู่แล้ว (ต่อ brand colors/product reference เข้า prompt) — ยังไม่มีคำสั่งสไตล์ภาพเลยสักจุด ทำให้โมเดล (ปัจจุบันตั้งค่าเป็น `openai/gpt-5-image-mini`) เลือก default เป็นภาพ illustration/vector แบบ corporate-deck เอง

เนื้อหา (content) ถูกเขียนโดย AI ผ่าน system prompt ที่มีกลไก "style instruction" อยู่แล้ว 2 ชุด คือ `articleToneInstruction($tone)` และ `videoScriptStyleInstruction($style)` — ทั้งคู่ผูกกับค่าที่ผู้ใช้เลือกใน `QuickCreateDialog.tsx` (state เดี่ยวระดับ dialog) และ `BatchGenerateDialog.tsx` (**state แยกต่อ topic row** ใน array `topics`, ไม่ใช่ state เดียวระดับ dialog — โครงสร้างต่างจาก QuickCreateDialog)

## Goals / Non-Goals

**Goals:**
- ให้ผู้ใช้เลือกสไตล์ภาพได้ตอนสร้างคอนเทนต์ (ทั้ง article/video, ทั้ง QuickCreate/Batch) พร้อม preset 5 แบบ + กำหนดเอง
- สไตล์ที่เลือกมีผลจริงต่อภาพที่ได้ ทั้งตอนเขียน prompt (AI) และตอนยิงสร้างภาพจริง (suffix)
- Retry สร้างภาพทีหลัง (ปุ่ม "สร้างใหม่เฉพาะฉากนี้" จาก change ก่อนหน้า) ยังคุมสไตล์เดิมได้ เพราะเก็บค่าไว้ถาวร
- เพิ่ม "AI เลือกให้" เข้า tone/script-style ที่มีอยู่แล้ว และเปลี่ยน default เป็น AI

**Non-Goals:**
- ไม่เปลี่ยนโมเดล image-gen ที่ใช้อยู่ (`openai/gpt-5-image-mini`) หรือ provider ใดๆ
- ไม่เพิ่ม preview ภาพตัวอย่างของแต่ละสไตล์ในหน้าเลือก (ตัวเลือกเป็น text label + desc เหมือน tone/scriptStyle เดิม)
- ไม่แก้ retroactive สำหรับ content เก่า — content ที่สร้างไปแล้วไม่มี `image_style` จะ derive เป็น "ai" (ไม่มีผลอะไรพิเศษ เหมือนพฤติกรรมเดิมทุกประการ)

## Decisions

### 1. `image_style` เก็บได้ทั้ง preset key และ custom text ในคอลัมน์เดียว
**ทำไม**: ลดความซับซ้อน ไม่ต้องมี column แยก + flag "is_custom" — `normalizeImageStyle()` เช็คว่าค่าตรงกับ preset ที่รู้จักไหม (`ai`, `photorealistic`, `3d-render`, `illustration`, `corporate`) ถ้าไม่ตรงแต่ไม่ว่าง ถือเป็นข้อความสไตล์ที่ผู้ใช้กำหนดเอง ใช้ตรงๆ ทั้ง 2 lever

**ผลที่ตามมา**: คอลัมน์ต้องเป็น `VARCHAR(255)` ไม่ใช่ `VARCHAR(32)` แบบ `script_style`/`tone` เดิม เพราะต้องรองรับข้อความอิสระ

### 2. Lever A (instruction ตอนเขียน content) + Lever B (suffix ตอนยิงภาพจริง) ทำทั้งคู่
**ทำไม**: Lever A อย่างเดียวไม่พอเพราะ AI เขียน `visual_prompt`/`image_brief` เป็นข้อความบรรยายเนื้อหา ไม่ได้การันตีว่าจะสื่อสไตล์ได้แม่นยำเท่าคำสั่งสไตล์ตรงๆ ที่ต่อท้ายตอนยิงโมเดลจริง (โมเดล image-gen ตอบสนองกับคำสั่งสไตล์ชัดเจนแบบ "photorealistic, 8k" ได้ดีกว่าข้อความบรรยายอ้อมๆ) — Lever B อย่างเดียวก็ไม่พอเพราะไม่ช่วยให้ตัว `visual_prompt` เองมีรายละเอียดที่เข้ากับสไตล์ (เช่น composition ที่เหมาะกับภาพสมจริง vs ภาพ 3D) ทำทั้งคู่ให้ผลลัพธ์แม่นยำสุด

### 3. เมื่อเลือก "AI เลือกให้" (`ai`) — ทั้ง 2 lever ไม่ทำอะไรเพิ่ม
**ทำไม**: คงพฤติกรรมปัจจุบันไว้เป๊ะ (ไม่ฝัง instruction, ไม่ต่อ suffix) เพื่อให้ "AI เลือกให้" หมายถึง "ปล่อยให้ AI ตัดสินใจตามธรรมชาติของเนื้อหา" ไม่ใช่การบังคับสไตล์ใดสไตล์หนึ่งเป็นพิเศษ

### 4. BatchGenerateDialog เก็บ `image_style` ต่อ topic row ไม่ใช่ระดับ dialog เดียว
**ทำไม**: โครงสร้างเดิมของ `tone`/`scriptStyle` ใน BatchGenerateDialog อยู่ใน array `topics[i].tone`/`topics[i].scriptStyle` (แต่ละหัวข้อเลือกโทน/สไตล์ต่างกันได้) — `image_style` ต้องตามรูปแบบเดียวกัน (`topics[i].imageStyle`) ไม่ใช่ state เดียวทั้ง batch ไม่งั้นพฤติกรรมจะไม่สอดคล้องกับ tone/scriptStyle ที่มีอยู่แล้วในหน้าเดียวกัน

### 5. เปลี่ยน default ของ tone/scriptStyle เป็น "ai" (ตามที่ผู้ใช้ยืนยัน)
**ทำไม**: ผู้ใช้ยืนยันชัดเจนว่าต้องการให้สอดคล้องกับ `image_style` ที่ AI เป็น default — **นี่คือ breaking behavior change** ของฟีเจอร์ที่ใช้งานอยู่จริง (เดิม default คือ `hook-story`/`friendly` ค่าคงที่) ต้องระบุใน proposal.md ชัดเจน (ทำไปแล้ว) ผลคือ content ใหม่ที่ผู้ใช้ไม่ได้กดเลือกอะไรเองจะได้โทน/รูปแบบที่ AI ตัดสินใจแทนค่าคงที่เดิม

## Risks / Trade-offs

- **[Risk] "AI เลือกให้" เป็น default ใหม่ของ tone/scriptStyle อาจทำให้ผลลัพธ์เนื้อหาไม่สม่ำเสมอเท่าเดิม** (เพราะเดิมทุก content ที่ไม่เลือกอะไรจะได้ hook-story/friendly เหมือนกันหมด ตอนนี้ AI จะเลือกต่างกันไปตามเนื้อหาแต่ละครั้ง) → ยอมรับความเสี่ยงนี้ตามที่ผู้ใช้ยืนยัน ถ้าไม่ชอบผลลัพธ์ ผู้ใช้ยังเลือกค่าคงที่เดิมเองได้เสมอ (ตัวเลือกไม่ได้หายไป แค่ default เปลี่ยน)
- **[Risk] Custom image style text อาจถูกผู้ใช้พิมพ์เป็นคำสั่งที่ขัดกับ brand guideline** (เช่น สีที่ไม่ตรงแบรนด์) → ไม่ validate เนื้อหาข้อความ (เหมือน `video_prompt` ที่ไม่ validate เช่นกัน) ปล่อยเป็นความรับผิดชอบผู้ใช้ที่กรอกเอง
- **[Trade-off] ไม่ backfill `image_style` ให้ content เก่า** → content เก่าอ่านค่า derive เป็น "ai" เสมอ (ไม่มีผลต่างจากพฤติกรรมปัจจุบัน เพราะปัจจุบันก็ไม่มีสไตล์อยู่แล้ว) ปลอดภัย ไม่ต้อง migration ข้อมูล

## Migration Plan

1. สร้าง migration `database/migrations/YYYY_MM_DD_HHMMSS_add_image_style_to_content_items.sql` เพิ่ม `image_style VARCHAR(255) NULL` ใน `content_items`
2. รันทันทีกับ local MariaDB ตาม workflow ใน CLAUDE.md (`mysql -u root flowstack < ...`), verify ด้วย `DESCRIBE content_items`
3. Deploy backend ก่อน (branch ใหม่ไม่ require `image_style` ต้องมีค่าเสมอ — ถ้า NULL ให้ `normalizeImageStyle()` default เป็น "ai" เหมือนกัน ไม่ error)
4. Deploy frontend
5. Rollback: DB column เป็น nullable เฉยๆ ลบทิ้งได้โดยไม่กระทบข้อมูลอื่น หาก revert โค้ด backend/frontend กลับ ระบบทำงานเหมือนเดิมทุกประการ (column ที่เหลือใน DB ไม่ถูกอ่านอีก)

## Open Questions

ไม่มี — คำถามที่เปิดค้างทั้งหมดถูกปิดในขั้นตอน explore ก่อนหน้า change นี้
