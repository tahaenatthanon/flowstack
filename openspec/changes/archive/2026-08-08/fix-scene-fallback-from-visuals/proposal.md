## Why

เมื่อ AI สร้างเนื้อหาวิดีโอผ่าน `generate-article` — output จะมี `visuals` array (รายการฉากพร้อมคำอธิบายภาพ) แต่ **ไม่มี** `scenes` array ซึ่งเป็นโครงสร้างที่ `generate-scene-images` และ `generate-video` ต้องการ เมื่อผู้ใช้กด "สร้างภาพทุกฉาก" หรือ "สร้างวิดีโอ" จะพบ error: "ไม่มี scenes ใน article_content — กรุณาสร้างสคริปต์ก่อน" ทำให้ workflow การผลิตคอนเทนต์วิดีโอพังตั้งแต่ขั้นตอนสร้างภาพ

## What Changes

- เพิ่ม fallback logic ใน `generate-scene-images` endpoint: ถ้าไม่มี `scenes` แต่มี `visuals` ให้แปลง `visuals` → `scenes` อัตโนมัติ โดย parse รูปแบบ `Scene N: description` หรือ `Shot N: description`
- เพิ่ม fallback logic เดียวกันใน `generate-video` endpoint
- เพิ่มปุ่ม "สร้างภาพทุกฉาก" ใน `ContentCardDialog.tsx` (dialog แก้ไขคอนเทนต์) ซึ่งปัจจุบันมีเฉพาะปุ่ม "สร้างภาพด้วย AI" และ "สร้างวิดีโอด้วย AI" แต่ไม่มีปุ่ม "สร้างภาพทุกฉาก"
- **ส่วนวิดีโอ** (Video Section) ใน `ContentCardDialog.tsx` แสดงเฉพาะสำหรับ Content ประเภทวิดีโอสคริปต์ (`type='video'`); สำหรับบทความ (`type='article'`) และโซเชียล (`type='social'`) จะไม่แสดง
  - ตรวจสอบจาก `articleData?.platform_type` (ใน `article_content` JSON) **และ** `existingItem?.content_type` (คอลัมน์ `content_items.type` ใน DB) เป็น fallback — เพราะ `generate-article` ไม่ได้ใส่ `platform_type` ใน `article_content` JSON แต่บันทึกลง `content_items.type` แทน
- ปุ่ม "สร้างวิดีโอด้วย AI" อยู่ในสถานะ disabled จนกว่าทุก scene จะมีภาพประกอบครบ (เปลี่ยนจาก "อย่างน้อย 1 ฉาก" เป็น "ครบทุกฉาก")
- เปลี่ยน description ใน Video Section เป็น "ต้องกดสร้างภาพทุกฉากก่อน"

## Capabilities

### New Capabilities
- `scene-generation-from-visuals`: แปลง `visuals` จาก AI-generated content เป็น `scenes` array ได้อัตโนมัติ ทำให้ `generate-scene-images` และ `generate-video` ทำงานได้โดยไม่ต้องมี `scenes` ใน `article_content` ตั้งแต่แรก

### Modified Capabilities
<!-- No existing spec requirements are changing — this is purely additive -->

## Impact

- **Backend**: `api/brand-content.php` — แก้ไข 2 จุดใน `generate-scene-images` (~บรรทัด 1303-1307) และ `generate-video` (~บรรทัด 2670-2673)
- **Frontend**: `src/components/content/ContentCardDialog.tsx` — เพิ่ม state, handler, และปุ่ม "สร้างภาพทุกฉาก"; ซ่อน Video Section เมื่อไม่ใช่ content ประเภทวิดีโอ; เปลี่ยนเงื่อนไขปุ่ม "สร้างวิดีโอ" จาก "อย่างน้อย 1 ฉาก" เป็น "ครบทุกฉาก"; แก้ไขการตรวจสอบ `isVideo` ให้ fallback ไปใช้ `existingItem?.content_type` (DB column) เมื่อ `article_content` ไม่มี `platform_type`
- **DB**: ไม่มี schema change
- **Breaking**: ไม่มี — fallback จะไม่ทำงานเมื่อมี `scenes` อยู่แล้ว; content เดิมไม่ได้รับผลกระทบจนกว่าจะมีคนกดปุ่ม
