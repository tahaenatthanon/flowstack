## MODIFIED Requirements

### Requirement: เลือกสัดส่วนวิดีโอก่อนสร้าง
หัวข้อ "วิดีโอ" SHALL แสดงอัตราส่วนวิดีโอและความละเอียดวิดีโอของ content item เป็น badge อ่านอย่างเดียว เช่น `9:16 · 1080p` (NULL → `9:16 · 720p`) โดยมีรูปสี่เหลี่ยมขนาดเล็กตามอัตราส่วนจริงนำหน้า (component เดียวกับตัวเลือกตอนสร้างคอนเทนต์) พร้อม tooltip "อัตราส่วนวิดีโอ · ความละเอียดวิดีโอ (กำหนดตอนสร้างคอนเทนต์)" — SHALL ไม่มี selector สัดส่วนหรือความละเอียดในหัวข้อวิดีโอ เพราะค่าถูกเลือกและล็อกตั้งแต่ตอนสร้างคอนเทนต์ (ดู capability `video-creation-options`) — คำขอ `generate-clips` SHALL ไม่มี `aspect_ratio` หรือ `resolution`

#### Scenario: แสดง badge
- **WHEN** ผู้ใช้เปิดหัวข้อ "วิดีโอ" ของคอนเทนต์ที่ `video_aspect_ratio = '16:9'`, `video_resolution = '1080p'`
- **THEN** SHALL เห็น badge `16:9 · 1080p` และไม่มีปุ่มเลือกสัดส่วนหรือความละเอียด

#### Scenario: คอนเทนต์เก่า
- **WHEN** ผู้ใช้เปิดหัวข้อ "วิดีโอ" ของคอนเทนต์ที่ยังไม่มีสองค่านี้
- **THEN** SHALL เห็น badge `9:16 · 720p`

#### Scenario: กดยืนยันสร้างคลิป
- **WHEN** ผู้ใช้ยืนยันสร้างคลิปใน dialog ยืนยัน credit
- **THEN** คำขอที่ส่งไป backend SHALL มี `item_id` และ `scene_ids` — SHALL ไม่มี `aspect_ratio` หรือ `resolution`

## ADDED Requirements

### Requirement: การบันทึกฉากใน dialog คง `scene.id`
เมื่อ `ContentCardDialog` บันทึก `article_content` หรือเรียก `update-scene` ระบบ SHALL คง `id` ของทุกฉากไว้ตามเดิม — SHALL ไม่ลบ ไม่สร้างใหม่ และไม่สลับ `id` ระหว่างฉาก เพราะคลิปอ้างอิงฉากด้วย `scene.id`

#### Scenario: บันทึก dialog หลังแก้บทพากย์
- **WHEN** ผู้ใช้แก้บทพากย์ของฉาก 2 แล้วกด "บันทึก"
- **THEN** `scenes[*].id` ทุกฉากหลังบันทึก SHALL เท่ากับก่อนบันทึก และคลิปของทุกฉาก SHALL ยังผูกกับฉากเดิม

## REMOVED Requirements

### Requirement: Video section has AI generation button with slate icon
**Reason**: ปุ่ม "สร้างวิดีโอด้วย AI" ที่เรียก `generate-video` (ยิงแค่ฉากแรก) ถูกแทนด้วยปุ่ม "สร้างคลิปทุกฉาก" / "สร้างคลิปฉากนี้" และ "สร้างวิดีโอรวม"
**Migration**: ดู capability `video-clips-ui`

### Requirement: Video section displays video status with helpful description
**Reason**: สถานะวิดีโอเดียวถูกแทนด้วยสถานะคลิปรายฉาก ตัวนับ "คลิป X/N" และสถานะวิดีโอรวม
**Migration**: ดู requirement "หน้าจอวิดีโอทำงาน 2 จังหวะ" และ "คลิปแสดงในการ์ดของแต่ละฉาก" ใน capability `video-clips-ui`

### Requirement: Dialog แก้ไขคอนเทนต์ติดตามสถานะวิดีโอจนเสร็จ
**Reason**: polling `video-status` ของวิดีโอเดียวถูกแทนด้วย polling `clip-status` รายคลิป
**Migration**: ดู requirement "polling สถานะคลิป" ใน capability `video-clips-ui`
