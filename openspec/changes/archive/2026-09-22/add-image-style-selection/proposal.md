## Why

ภาพที่ระบบสร้างให้ (ทั้งภาพปกบทความและภาพต่อ scene วิดีโอ) ออกมาเป็นภาพประกอบ/การ์ตูนแบบเดียวเสมอ เพราะ prompt ที่ส่งให้โมเดลไม่เคยมีคำสั่งเรื่องสไตล์ภาพเลย ผู้ใช้ไม่มีทางเลือกว่าจะเอาภาพสมจริง, 3D, หรือสไตล์อื่น ต้องเพิ่มตัวเลือกสไตล์ภาพให้เลือกได้ตอนสร้างคอนเทนต์ พร้อม AI เลือกให้เป็นค่าเริ่มต้น และถือโอกาสเพิ่มตัวเลือก "AI เลือกให้" เข้าไปใน รูปแบบสคริปต์/สไตล์การเขียน ที่มีอยู่แล้วด้วย เพื่อความสอดคล้องกัน (ปัจจุบันสองอย่างนี้ต้องเลือกค่าคงที่ตายตัว ไม่มีทาง "ให้ AI ตัดสินใจ" ได้เลย)

## What Changes

- เพิ่มตัวเลือก "สไตล์ภาพ" (image style) ในหน้าสร้างคอนเทนต์ ใช้ได้ทั้ง article และ video: `QuickCreateDialog.tsx` และ `BatchGenerateDialog.tsx`
- ตัวเลือกมี 6 แบบ: AI เลือกให้ (default), สมจริง, 3D เรนเดอร์, อินโฟกราฟิก/ภาพประกอบ, องค์กรมืออาชีพ, กำหนดเอง (พิมพ์บรรยายสไตล์เอง)
- สไตล์ที่เลือกมีผล 2 ชั้น: (Lever A) ฝัง instruction ให้ AI เขียน `image_brief`/`visual_prompt` ให้สอดคล้องกับสไตล์ตอน generate content, (Lever B) ต่อ suffix คำสั่งสไตล์เข้า prompt ตอนยิงสร้างภาพจริง (ทั้งภาพปกบทความและภาพต่อ scene รวมถึง retry รายฉาก)
- เพิ่ม `content_items.image_style` (DB column ใหม่) เก็บค่าที่เลือกไว้ถาวร เพื่อให้ retry สร้างภาพทีหลังยังคุมสไตล์เดิมได้
- **BREAKING (พฤติกรรม default)**: เพิ่มตัวเลือก "AI เลือกให้" เข้า "รูปแบบสคริปต์" (video) และ "สไตล์การเขียน" (article) ที่มีอยู่แล้ว และเปลี่ยน default จากค่าคงที่เดิม (`hook-story`/`friendly`) เป็น "AI เลือกให้" — content ใหม่ที่สร้างโดยไม่เลือกอะไรเองจะได้ AI ตัดสินใจโทน/รูปแบบแทนค่าคงที่แบบเดิม
- **[UI cleanup ไม่เกี่ยวกับ image style]** แก้ปุ่ม "สร้างภาพทุกฉาก" ที่ซ้ำกัน — ให้เหลือปุ่มเดียวต่อหน้าเสมอ: ปุ่มที่แสดงตลอด (ไม่ผูกกับสถานะ scenes ว่าง/ไม่ว่าง) เช่นในหมวด "วิดีโอ" ของ `ContentCardDialog.tsx` และในแถบปุ่มด้านล่างของ `ContentVideoView.tsx` — **ลบปุ่มซ้ำที่อยู่ใน empty state ของ `SceneCards.tsx`** ออก (คงข้อความ "ยังไม่มีฉาก กด 'สร้างภาพทุกฉาก' เพื่อเริ่มสร้าง" ไว้เป็นข้อความอ้างอิงถึงปุ่มที่มีอยู่แล้วด้านนอก ไม่ต้องมีปุ่มซ้ำในนั้น) ปุ่มที่เหลือใน `ContentCardDialog.tsx` ยังคงใช้ `variant="outline"` (ไม่มีพื้นหลัง) เหมือนเดิม — เคยลองปรับเป็น `variant="default"` (พื้นหลังทึบ) แล้ว แต่ผู้ใช้ขอกลับมาเป็น `outline`

## Capabilities

### New Capabilities
- `image-style-selection`: ตัวเลือกสไตล์ภาพ (preset 5 แบบ + กำหนดเอง) ที่มีผลต่อทั้งการเขียน prompt และการยิงสร้างภาพจริง ใช้ได้ทั้ง article และ video
- `content-style-ai-default`: เพิ่มตัวเลือก "AI เลือกให้" เข้า tone (article) และ script style (video) ที่มีอยู่แล้ว พร้อมเปลี่ยน default เป็น AI

### Modified Capabilities
(ไม่มี — ไม่มี main spec เดิมที่ครอบคลุม tone/script-style requirements มาก่อน จึงนับเป็น capability ใหม่ทั้งคู่)

## Impact

- Database: migration ใหม่เพิ่ม `content_items.image_style VARCHAR(255) NULL`
- `api/brand-content.php`: เพิ่ม `normalizeImageStyle()`, `imageStyleInstruction()`; แก้ `normalizeArticleTone()`, `normalizeVideoScriptStyle()`, `articleToneInstruction()`, `videoScriptStyleInstruction()`; แก้ system prompt building ของ `generate-article`; แก้ `generate-image` (article cover) และ `_generateOneSceneImage()` (video scenes) ให้ต่อ style suffix; แก้ INSERT ของ content_items ให้บันทึก `image_style`
- `src/components/content/types.ts`: เพิ่ม `IMAGE_STYLE_OPTIONS`; แก้ `ARTICLE_TONE_OPTIONS`, `VIDEO_SCRIPT_STYLE_OPTIONS` ให้มีตัวเลือก "ai"
- `src/components/content/dialogs/QuickCreateDialog.tsx`: เพิ่ม UI สไตล์ภาพ (นอก block เงื่อนไข contentType), เปลี่ยน default state ของ tone/scriptStyle เป็น "ai"
- `src/components/content/dialogs/BatchGenerateDialog.tsx`: เพิ่ม UI สไตล์ภาพเช่นเดียวกัน, เปลี่ยน default เป็น "ai"
- `src/components/content/ContentCardDialog.tsx`: ปุ่ม "สร้างภาพทุกฉาก" ที่มีอยู่แล้ว (บรรทัด ~940-942, เหนือ "สร้างวิดีโอด้วย AI") กลายเป็นปุ่มเดียวของหน้านี้ — คงสไตล์ `variant="outline"` เดิม (ทดลอง `variant="default"` แล้วปรับกลับตามที่ผู้ใช้ขอ)
- `src/components/content/SceneCards.tsx`: ลบปุ่ม "สร้างภาพทุกฉาก" ใน empty state (บรรทัด ~92) ออก — เหลือแค่ข้อความ, ลบ prop `onGenerateAll`/`generatingAll` ที่ไม่ใช้แล้วออกจาก component
- `src/components/content/views/ContentVideoView.tsx`: เอา `onGenerateAll`/`generatingAll` ออกจากการเรียก `<SceneCards>` (prop ที่ลบไปแล้ว) — ปุ่ม "สร้างภาพทุกฉาก" ที่แถบด้านล่างเดิม (`variant="outline"`) ยังคงอยู่เป็นปุ่มเดียวของหน้านี้เหมือนเดิม
