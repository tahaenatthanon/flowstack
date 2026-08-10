## Context

`api/brand-content.php` มี 2 endpoint ที่ต้องการ `scenes` array ใน `article_content` JSON:

- `generate-scene-images` — สร้างภาพ AI สำหรับแต่ละฉาก
- `generate-video` — สร้างวิดีโอจากฉากที่มีภาพแล้ว

แต่ `generate-article` (AI สร้างเนื้อหา) สำหรับ platform วิดีโอ (tiktok, youtube) สร้าง output ที่มี `visuals` — รายการข้อความอธิบายฉาก — โดยไม่มี `scenes` array เลย

`visuals` มีรูปแบบเป็นข้อความเช่น `"Scene 1: ภาพกราฟิก..."`, `"Scene 2: เปิดภาพหน้าจอ..."` — ส่วน `scenes` ที่ 2 endpoint ต้องการมีโครงสร้าง `[{ visual_prompt, shot, image_url }]`

`ContentCardDialog.tsx` (dialog แก้ไขคอนเทนต์) มีปุ่ม "สร้างภาพด้วย AI" (generate-image สำหรับ thumbnail) และ "สร้างวิดีโอด้วย AI" (generate-video) แต่ไม่มีปุ่ม "สร้างภาพทุกฉาก" (generate-scene-images) — ปุ่มนี้มีเฉพาะใน `ContentVideoView.tsx` (หน้าพรีวิว)

## Goals / Non-Goals

**Goals:**
- แปลง `visuals` → `scenes` ได้อัตโนมัติใน runtime โดยไม่ต้องเปลี่ยน prompt ของ AI
- ทั้ง `generate-scene-images` และ `generate-video` ใช้ fallback เดียวกัน
- เพิ่มปุ่ม "สร้างภาพทุกฉาก" ใน `ContentCardDialog.tsx` ให้ครบ workflow
- Backward compatible — content ที่มี `scenes` อยู่แล้วไม่ได้รับผลกระทบ

**Non-Goals:**
- ไม่เปลี่ยน prompt ของ `generate-article` ให้สร้าง `scenes` (optional improvement)
- ไม่ migrate content เดิม — fallback ทำงานตอน runtime เท่านั้น
- ไม่เปลี่ยน schema ของ `article_content` JSON
- ไม่แก้ไข `ContentVideoView.tsx` — scope นี้จำกัดที่ `ContentCardDialog.tsx` และ `api/brand-content.php` เท่านั้น

## Decisions

### 1. Fallback ใน backend (ไม่ใช่ frontend)

**เลือก:** แปลง `visuals` → `scenes` ที่ฝั่ง backend (`api/brand-content.php`)

**เหตุผล:** 
- `FromScriptForm.tsx` มี `parseScenes()` ที่ทำ fallback จาก `visuals` อยู่แล้ว — backend ควรทำเหมือนกันเพื่อความเป็น single source of truth
- ถ้าทำที่ frontend ต้องแก้หลายที่ (ทั้ง `ContentVideoView.tsx` และ `ContentCardDialog.tsx`)
- Backend ควบคุม logic ได้ เติม `$ac['scenes']` กลับลง DB หลังสร้างภาพเสร็จ ทำให้ `generate-video` ในรอบถัดไปหา scenes เจอทันที

### 2. Regex parse รูปแบบ Scene/Shot prefix

**เลือก:** `preg_match('/^(?:Scene|Shot)\s*\d*\s*[:：-]\s*(.+)/i', ...)`

**เหตุผล:**
- `visuals` จาก AI มักมี prefix `Scene N:` หรือ `Shot N:` — แยกเป็น `shot` และ `visual_prompt` เพื่อให้ prompt ภาพสะอาดขึ้น
- ถ้าไม่ตรง pattern → ใช้ข้อความเต็มเป็น `visual_prompt` เลย (graceful degradation)
- รองรับทั้ง `:` (ASCII) และ `：` (fullwidth, AI บางตัวใช้)

**ทางเลือกที่ไม่ได้ใช้:** แยก `visuals` ด้วย newline/period → ไม่แม่นยำพอ เพราะ prompt อาจมีเครื่องหมายวรรคตอน

### 3. เพิ่มปุ่ม "สร้างภาพทุกฉาก" ใน ContentCardDialog

**เลือก:** เพิ่ม state `generatingScenes`, handler `handleGenerateScenes`, และปุ่มใน Video Section

**เหตุผล:**
- ปัจจุบัน dialog มีปุ่ม "สร้างวิดีโอด้วย AI" ซึ่งบอกว่า "ต้องมี scene ที่สร้างภาพแล้วอย่างน้อย 1 ฉาก" — แต่ไม่มีปุ่มให้สร้างภาพฉาก
- ปุ่ม "สร้างภาพด้วย AI" ใน dialog เป็น `generate-image` (สร้าง thumbnail/cover) ไม่ใช่ `generate-scene-images`

### 4. แสดง Video Section เฉพาะ Content ประเภทวิดีโอสคริปต์

**เลือก:** ใช้ `isVideo` flag จาก `articleData?.platform_type || existingItem?.content_type` เพื่อควบคุมการแสดงผล Video Section ทั้งบล็อก

**เหตุผล:**
- `ContentCardDialog` ใช้กับ content ทุกประเภท (บทความ, โซเชียล, วิดีโอ) — ไม่ควรแสดงส่วนวิดีโอสำหรับบทความและโซเชียล
- ป้องกันความสับสนของผู้ใช้: ปุ่ม "สร้างภาพทุกฉาก" และ "สร้างวิดีโอ" ไม่มีความหมายในบริบทของบทความหรือโซเชียลโพสต์
- `generate-article` ไม่ได้ใส่ `platform_type` ใน `article_content` JSON — บันทึกเป็น `content_items.type` ใน DB แทน (`'video'` สำหรับ tiktok/youtube, `'article'` สำหรับ platform อื่น)
- ดังนั้น frontend ต้องเช็คทั้ง 2 แหล่ง: `articleData?.platform_type` (จาก JSON) ก่อน แล้ว fallback ไป `existingItem?.content_type` (จาก DB column)

### 5. ปุ่ม "สร้างวิดีโอ" ต้องรอให้ทุก scene มีภาพก่อน

**เลือก:** ตรวจสอบจำนวน scenes ที่มี `image_url` เทียบกับจำนวน scenes ทั้งหมด — ถ้าไม่ครบ → disabled

**เหตุผล:**
- เดิมเช็คแค่ "อย่างน้อย 1 ฉาก" — ไม่เพียงพอ เพราะวิดีโอต้องการภาพครบทุกฉากถึงจะสมบูรณ์
- เปลี่ยน logic จาก `array_filter(scenes, has image_url)` มาเช็ค `count(scenes_with_images) < count(all_scenes)`
- แสดงข้อความ "ต้องกดสร้างภาพทุกฉากก่อน" แทนข้อความเดิม

## Risks / Trade-offs

- **[Risk] visual_prompt จาก visuals อาจไม่ละเอียดพอสำหรับ DALL-E/Flux** → Mitigation: AI (`generate-article`) จะถูกปรับ prompt ให้สร้าง scenes array โดยตรงในอนาคต; ตอนนี้ `visuals` ที่ AI สร้างให้ก็มีรายละเอียดเพียงพอ (มีความยาว scene description, mood, visual elements)
- **[Risk] ถ้ากด generate-article ซ้ำหลังสร้างภาพฉากแล้ว scenes จะหาย** → Mitigation: ยังไม่เกิดในทางปฏิบัติเพราะผู้ใช้ไม่ regenerate content หลังจากสร้างภาพแล้ว; ถ้าเป็น issue จริงให้ preserve `scenes` ใน `generate-article` ทีหลัง
