## 1. Database migration

- [x] 1.1 สร้าง `database/migrations/2026_09_22_161630_add_image_style_to_content_items.sql`: `ALTER TABLE content_items ADD COLUMN image_style VARCHAR(255) NULL AFTER image_brief`
- [x] 1.2 รัน migration กับ local MariaDB ทันที
- [x] 1.3 Verify ด้วย `DESCRIBE content_items` — คอลัมน์ `image_style varchar(255) YES NULL` ถูกเพิ่มถูกต้อง

## 2. Backend — helper functions (api/brand-content.php)

- [x] 2.1 เพิ่ม `normalizeImageStyle($raw)`: รู้จัก preset `ai`/`photorealistic`/`3d-render`/`illustration`/`corporate`, ถ้าไม่ตรง preset แต่มีข้อความ → ถือเป็น custom text, ถ้าว่าง → default `"ai"`
- [x] 2.2 เพิ่ม `imageStyleInstruction($style)`: คืน instruction ภาษาไทยสำหรับแต่ละ preset (ว่างเปล่าเมื่อ `style === "ai"`) — ถ้าเป็น custom text คืน instruction แบบ "ใช้สไตล์ภาพตามคำอธิบายนี้: {text}"
- [x] 2.3 เพิ่ม `imageStyleSuffix($style)`: คืน suffix คำสั่งสไตล์สำหรับต่อท้าย prompt ตอนยิงภาพจริง ต่อ preset (ว่างเปล่าเมื่อ `ai`) — custom text คืนข้อความนั้นตรงๆ
- [x] 2.4 แก้ `normalizeArticleTone()`: เพิ่ม `"ai"` เข้า allowed list, เปลี่ยน default parameter จาก `"friendly"` เป็น `"ai"`
- [x] 2.5 แก้ `normalizeVideoScriptStyle()`: เพิ่ม `"ai"` เข้า allowed list, เปลี่ยน default parameter จาก `"hook-story"` เป็น `"ai"`
- [x] 2.6 แก้ `articleToneInstruction($tone)`: เมื่อ `$tone === "ai"` คืนสตริงว่าง (ไม่ฝัง instruction)
- [x] 2.7 แก้ `videoScriptStyleInstruction($style)`: เมื่อ `$style === "ai"` คืนสตริงว่าง (ไม่ฝัง instruction)

## 3. Backend — generate-article (Lever A)

- [x] 3.1 อ่าน `image_style` จาก request body ตอน generate-article, เรียก `normalizeImageStyle()` — ทั้ง path จาก `$body` (สร้างใหม่) และ path จาก `$item` (regenerate content ที่มีอยู่แล้ว)
- [x] 3.2 ฝัง `imageStyleInstruction()` เข้า system prompt (ทั้ง 2 code path, ไม่ผูกกับ article/video) เหมือน pattern ของ tone/scriptStyle instruction ที่มีอยู่แล้ว
- [x] 3.3 บันทึก `image_style` ลง `content_items` ตอน INSERT (path plan/batch ที่ ~line 1312) — path manual card creation (~line 3369, ไม่มี AI generation) ไม่ต้องมี image_style เพราะไม่เกี่ยวข้อง
- [x] 3.4 `videoScriptStyleInstruction()`/`articleToneInstruction()` คืนสตริงว่างตอน "ai" อยู่แล้ว (ทำใน task 2.6/2.7) — ยืนยันจุดที่เรียกใช้ทั้ง 2 code path ไม่มี double-newline/ช่องว่างเกินเมื่อว่างเปล่า (ใช้ `\n\n` เดิมที่ยังคงรูปแบบข้อความถูกต้องแม้ instruction ว่าง)

## 4. Backend — generate-image และ _generateOneSceneImage (Lever B)

- [x] 4.1 แก้ action `generate-image`: อ่าน `content_items.image_style` ของ `item_id`, เรียก `imageStyleSuffix()`, ต่อเข้า `$fullPrompt` ก่อน brand colors enrichment
- [x] 4.2 `_generateOneSceneImage()` ไม่ต้องแก้ signature (มี `$enrichSuffix` param อยู่แล้ว) — ต่อ style suffix เข้า `$enrichSuffix` ที่ call site แทนทั้ง 2 จุด: `generate-scene-images` (bulk, อ่านจาก `$item['image_style']` ที่ SELECT เพิ่ม) และ `generate-scene-image` (retry, อ่านจาก `$item['image_style']` ที่ SELECT เพิ่มเช่นกัน แทน `''` เดิม)

## 5. Frontend — types.ts

- [x] 5.1 เพิ่ม `IMAGE_STYLE_OPTIONS` (6 ตัวเลือก: ai/photorealistic/3d-render/illustration/corporate/custom) ตาม pattern เดียวกับ `ARTICLE_TONE_OPTIONS`
- [x] 5.2 แก้ `ARTICLE_TONE_OPTIONS` เพิ่มตัวเลือก `{ value: 'ai', label: '🤖 AI เลือกให้', desc: '...' }` เป็นตัวแรก
- [x] 5.3 แก้ `VIDEO_SCRIPT_STYLE_OPTIONS` เพิ่มตัวเลือก `{ value: 'ai', label: '🤖 AI เลือกให้', desc: '...' }` เป็นตัวแรก
- [x] 5.4 เพิ่ม `image_style?: string | null` เข้า `ContentItem` type

## 6. Frontend — QuickCreateDialog.tsx

- [x] 6.1 เปลี่ยน default state `tone` และ `scriptStyle` เป็น `'ai'` (รวมถึงใน `handleReset()`)
- [x] 6.2 เพิ่ม state `imageStyle` (default `'ai'`) และ `imageStyleCustomText`
- [x] 6.3 เพิ่ม UI section "สไตล์ภาพ" นอก block เงื่อนไข `contentType === 'article'`/`'video'` — วางหลัง video block ปิด ก่อน platform multi-select
- [x] 6.4 เมื่อเลือก "กำหนดเอง" แสดง textarea — ค่าที่ส่งจริงคือ `imageStyleCustomText.trim()` ไม่ใช่ literal `"custom"`
- [x] 6.5 ส่ง `image_style` เข้า request body ของ `generate-plan` (ไม่ผูก contentType เหมือน tone/script_style)

## 7. Frontend — BatchGenerateDialog.tsx

- [x] 7.1 เปลี่ยน default `tone`/`scriptStyle` ใน `createTopic()` เป็น `'ai'`
- [x] 7.2 เพิ่ม `imageStyle`/`imageStyleCustomText` เข้า `createTopic()` (state ต่อแถว)
- [x] 7.3 เพิ่ม UI "สไตล์ภาพ" ต่อ topic row หลัง block เงื่อนไข article/video ปิด ก่อนแพลตฟอร์ม
- [x] 7.4 ส่ง `image_style` ของแต่ละ topic เข้า request body ของ `generate-plan`

## 8a. UI cleanup — ปุ่ม "สร้างภาพทุกฉาก" ซ้ำ (ไม่เกี่ยวกับ image style, รวมมาตามที่ผู้ใช้ขอ)

ยืนยันแล้ว: ปุ่มที่ **เหลือ** คือปุ่มที่แสดงตลอดเวลา (ไม่ผูกกับสถานะ scenes ว่าง/ไม่ว่าง) ส่วนปุ่มใน empty state ของ `SceneCards.tsx` **ถูกลบทิ้ง** (ตรงข้ามกับที่ร่างไว้ตอนแรก)

- [x] 8a.1 แก้ `ContentCardDialog.tsx`: ปุ่ม "สร้างภาพทุกฉาก" (เหนือ "สร้างวิดีโอด้วย AI") — ลอง `variant="default"` (พื้นหลังทึบ) ก่อน แต่ผู้ใช้ขอปรับกลับเป็น `variant="outline"` (ไม่มีพื้นหลัง) สุดท้าย
- [x] 8a.2 แก้ `SceneCards.tsx`: ลบปุ่ม empty-state ออก เหลือแค่ icon + ข้อความ, ลบ prop `onGenerateAll`/`generatingAll` ออกจาก component interface
- [x] 8a.3 แก้ `ContentCardDialog.tsx` และ `ContentVideoView.tsx`: เอา `onGenerateAll`/`generatingAll` ออกจากทุกจุดที่เรียก `<SceneCards>`
- [x] 8a.4 ทดสอบผ่าน `pnpm lint`/`pnpm build` ผ่านทั้งคู่ (ไม่มี error ใหม่) — ยังไม่ได้ทดสอบผ่าน UI จริง (รอ verification รวมใน section 8)

## 8. Verification

- [x] 8.1-8.4 ยืนยันด้วย code review (ไม่ได้ยิง AI จริงเพราะ generate-plan/generate-image/generate-scene-image ทุกจุดเสีย credit จริงของ provider ที่ตั้งค่าไว้ — เหมือนแนวทางที่ใช้ใน change ก่อนหน้านี้) ไล่ทวน logic path ครบ:
      - `normalizeImageStyle()`/`imageStyleInstruction()`/`imageStyleSuffix()` คืนค่าถูกต้องตามตาราง preset ทั้ง 5 + custom text passthrough
      - Lever A ฝังเข้า sysParts/baseCtx ทั้ง 2 code path (สร้างใหม่ผ่าน `$body`, regenerate ผ่าน `$item`) ไม่ผูก article/video
      - Lever B ต่อ suffix ทั้ง `generate-image`, `generate-scene-images` (bulk), `generate-scene-image` (retry) — ทุกจุดอ่าน `image_style` จาก DB ของ item เดียวกัน จึงสม่ำเสมอ
- [x] 8.5 ยืนยันด้วยข้อมูลจริง: content item `149b941b-...` (สร้างก่อน migration) มี `image_style = NULL` จริงในฐานข้อมูล → ไล่ logic `normalizeImageStyle(null ?? 'ai')` ได้ `'ai'` ถูกต้อง ไม่ error
- [x] 8.6 รัน `pnpm lint` และ `pnpm build` ผ่านทั้งคู่ (0 errors, เฉพาะ warning เดิมที่ไม่เกี่ยวกับ change นี้) — รันซ้ำหลังแก้ทุกไฟล์จนจบ
