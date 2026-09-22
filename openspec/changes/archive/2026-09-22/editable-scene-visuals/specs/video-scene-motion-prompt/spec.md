## MODIFIED Requirements

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

## ADDED Requirements

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
