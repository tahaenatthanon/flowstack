# video-scene-motion-prompt Specification

## Purpose

กำหนด field `video_prompt` ต่อ scene (คำอธิบายการเคลื่อนไหว/มุมกล้อง สำหรับใช้สร้างวิดีโอ แยกจาก `visual_prompt` ที่เป็นคำอธิบายภาพนิ่ง) พร้อม API สำหรับแก้ไข/retry รายฉาก และการเก็บ `image_gen_error` เมื่อสร้างภาพล้มเหลว — ใช้เตรียมข้อมูลสำหรับ mode-detection (image-to-video/text-to-video) ของ `generate-video` ใน phase ถัดไป (ยังไม่รวม logic การเลือกโหมดใน capability นี้)

## Requirements

### Requirement: AI เขียน `video_prompt` คู่กับ `visual_prompt` ต่อ scene
เมื่อ generate content ประเภทวิดีโอ AI SHALL เขียน `video_prompt` (คำอธิบายการเคลื่อนไหว/มุมกล้อง) คู่กับ `visual_prompt` (คำอธิบายภาพนิ่ง) ของแต่ละ scene ในการยิงครั้งเดียว — SHALL ไม่มี AI call แยกต่างหากสำหรับ `video_prompt`

#### Scenario: Generate content วิดีโอใหม่
- **WHEN** ผู้ใช้ generate content ประเภทวิดีโอที่มีหลาย scene
- **THEN** แต่ละ scene ที่ได้ SHALL มีทั้ง `visual_prompt` และ `video_prompt` ไม่ว่างเปล่า

#### Scenario: Generate content ประเภทบทความ/โซเชียล
- **WHEN** ผู้ใช้ generate content ประเภทบทความหรือโซเชียล (ไม่ใช่วิดีโอ)
- **THEN** ระบบ SHALL ไม่เพิ่ม `video_prompt` เข้าไปใน `visuals`/`scenes` เพราะไม่เกี่ยวกับวิดีโอ

### Requirement: ผู้ใช้แก้ไข `video_prompt` และ `visual_prompt` รายฉากผ่าน API เดียวกัน
ระบบ SHALL มี API action `update-scene` รับ `item_id`, `scene_index`, และอย่างน้อยหนึ่งใน `video_prompt` หรือ `visual_prompt` เพื่ออัปเดตค่าของ scene เดียวใน `article_content.scenes[]` โดยไม่กระทบ scene อื่น — แต่ละ field อัปเดตแบบ partial (ส่งมาเฉพาะ field ที่ต้องการแก้ ไม่ต้องส่งอีก field มาด้วย)

#### Scenario: แก้ video_prompt ของ scene หนึ่งสำเร็จ
- **WHEN** ผู้ใช้แก้ข้อความ `video_prompt` ของ scene index 2 แล้วกดปุ่ม "บันทึก"
- **THEN** ระบบ SHALL เรียก `update-scene` และอัปเดตเฉพาะ `scenes[2].video_prompt` โดย scene อื่นไม่เปลี่ยนแปลง

#### Scenario: แก้ visual_prompt ของ scene หนึ่งสำเร็จ
- **WHEN** ผู้ใช้แก้ข้อความ `visual_prompt` ของ scene index 0 แล้วบันทึกผ่านปุ่ม "บันทึก" หลักของ dialog
- **THEN** ระบบ SHALL เรียก `update-scene` พร้อม `visual_prompt` และอัปเดตเฉพาะ `scenes[0].visual_prompt` โดย `video_prompt` และ scene อื่นไม่เปลี่ยนแปลง

#### Scenario: บันทึกแบบ explicit ไม่ auto-save
- **WHEN** ผู้ใช้กำลังพิมพ์แก้ `video_prompt` หรือ `visual_prompt` แต่ยังไม่กดปุ่มบันทึก
- **THEN** ระบบ SHALL ไม่ส่ง API request ใดๆ จนกว่าผู้ใช้จะกดปุ่มบันทึกด้วยตนเอง

### Requirement: สร้างภาพฉากใหม่หลังแก้ไข visual_prompt ต้องยืนยันก่อน
เมื่อ `visual_prompt` ของ scene ที่มีภาพอยู่แล้วถูกแก้ไขและบันทึกสำเร็จ ระบบ SHALL แสดงปุ่ม "สร้างภาพฉากนี้ใหม่" สำหรับ scene นั้น — เมื่อกดปุ่มนี้ ระบบ SHALL แสดง dialog ยืนยันก่อนเสมอ ก่อนจะเรียก API สร้างภาพ (retry รายฉากเดียวที่มีอยู่แล้ว) — SHALL ไม่สร้างภาพใหม่ให้อัตโนมัติทันทีที่บันทึกข้อความ

#### Scenario: บันทึก visual_prompt ใหม่แล้วเห็นปุ่มสร้างภาพใหม่
- **WHEN** ผู้ใช้แก้ `visual_prompt` ของ scene ที่มีภาพอยู่แล้ว (`image_gen_status: "done"`) แล้วบันทึกสำเร็จ
- **THEN** scene การ์ดนั้น SHALL แสดงปุ่ม "สร้างภาพฉากนี้ใหม่"

#### Scenario: กดปุ่มสร้างภาพใหม่ต้องยืนยันก่อน
- **WHEN** ผู้ใช้กดปุ่ม "สร้างภาพฉากนี้ใหม่"
- **THEN** ระบบ SHALL แสดง dialog ยืนยันแจ้งว่าจะใช้เครดิต AI ก่อนดำเนินการต่อ
- **AND** ระบบ SHALL ไม่เรียก API สร้างภาพจนกว่าผู้ใช้จะกดยืนยันใน dialog

#### Scenario: ยืนยันแล้วสร้างภาพสำเร็จ
- **WHEN** ผู้ใช้กดยืนยันใน dialog
- **THEN** ระบบ SHALL เรียก API สร้างภาพเฉพาะ scene นั้นด้วย `visual_prompt` ล่าสุดที่บันทึกไว้ และเมื่อสำเร็จปุ่ม "สร้างภาพฉากนี้ใหม่" SHALL หายไป

### Requirement: Retry สร้างภาพเฉพาะ scene เดียว
ระบบ SHALL มี API action สำหรับสร้างภาพใหม่เฉพาะ scene เดียว (ระบุ `item_id` + `scene_index`) แยกจาก `generate-scene-images` (bulk ทุก scene)

#### Scenario: Retry scene ที่ failed
- **WHEN** scene index 3 มี `image_gen_status: "failed"` และผู้ใช้กดปุ่ม "สร้างใหม่เฉพาะฉากนี้" ของ scene นั้น
- **THEN** ระบบ SHALL ยิง AI image-gen เฉพาะ `scenes[3].visual_prompt` เท่านั้น โดย scene อื่นไม่ถูกยิงซ้ำ

#### Scenario: Retry สำเร็จอัปเดตสถานะ
- **WHEN** การ retry scene เดียวสำเร็จ
- **THEN** ระบบ SHALL อัปเดต `scenes[i].image_url`, `image_gen_status: "done"` และล้าง `image_gen_error` เดิมทิ้ง

### Requirement: เก็บ `image_gen_error` เมื่อสร้างภาพล้มเหลว
เมื่อการสร้างภาพของ scene ใดล้มเหลว (ทั้งจาก bulk `generate-scene-images` และ retry รายฉาก) ระบบ SHALL เขียน `image_gen_status: "failed"` และ `image_gen_error` (ข้อความ error ล่าสุดจาก provider) กลับเข้า scene object นั้นใน `article_content.scenes[]` — SHALL ไม่เก็บ error ไว้แค่ใน response ชั่วคราวเท่านั้น

#### Scenario: Bulk generate มีบาง scene ล้มเหลว
- **WHEN** `generate-scene-images` รันแล้ว scene index 1 ล้มเหลวด้วย error จาก provider
- **THEN** `scenes[1].image_gen_status` SHALL เป็น `"failed"` และ `scenes[1].image_gen_error` SHALL มีข้อความ error นั้น หลังบันทึกลง DB

#### Scenario: ปิดหน้าแล้วเปิดใหม่ยังเห็นสาเหตุ error
- **WHEN** ผู้ใช้ปิด dialog แล้วเปิด content item เดิมใหม่อีกครั้งหลังมี scene ที่ failed
- **THEN** UI SHALL แสดง `image_gen_error` ที่บันทึกไว้ ไม่ใช่ข้อความ error ทั่วไปที่ไม่มีบริบท
