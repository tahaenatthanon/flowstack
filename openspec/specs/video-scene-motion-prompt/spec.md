# video-scene-motion-prompt Specification

## Purpose

กำหนด field `video_prompt` ต่อ scene (คำอธิบายการเคลื่อนไหว/มุมกล้อง สำหรับใช้สร้างวิดีโอ แยกจาก `visual_prompt` ที่เป็นคำอธิบายภาพนิ่ง) พร้อม API สำหรับแก้ไข/retry รายฉาก และการเก็บ `image_gen_error` เมื่อสร้างภาพล้มเหลว — ใช้เตรียมข้อมูลสำหรับ mode-detection (image-to-video/text-to-video) ของ `generate-video` ใน phase ถัดไป (ยังไม่รวม logic การเลือกโหมดใน capability นี้)

## Requirements

### Requirement: AI เขียน `video_prompt` คู่กับ `visual_prompt` ต่อ scene
เมื่อ generate content ประเภทวิดีโอ AI SHALL เขียน `video_prompt` (คำอธิบายการเคลื่อนไหว/มุมกล้อง), `visual_prompt` (คำอธิบายภาพนิ่ง) และ `narration` (บทพากย์ภาษาไทยของฉาก ≤ 100 ตัวอักษร เพื่อให้พูดจบใน 8 วินาที) ของแต่ละ scene ในการยิงครั้งเดียว — SHALL ไม่มี AI call แยกต่างหากสำหรับ `video_prompt` หรือ `narration`

จำนวนฉาก SHALL เท่ากับ `round(duration_sec / 8)` โดยถ้าห่างเท่ากันให้ปัดลง (30 → 4, 45 → 6, 60 → 7, 90 → 11) และทุกฉาก SHALL มี `duration_sec = 8` — prompt SHALL บอก AI ว่าวิดีโอเป็นแนวตั้งหรือแนวนอนตาม `video_aspect_ratio` เพื่อจัดองค์ประกอบภาพ — ทุกฉาก SHALL มี key `narration` แต่ AI SHALL ใส่บทพากย์เฉพาะฉากที่ควรมีเสียงพูด ฉากที่เน้นโชว์ภาพ/สินค้า/เปลี่ยนจังหวะ SHALL เป็น `""` ได้ ยกเว้นฉากแรก (Hook) และฉากสุดท้าย (CTA) ที่ SHALL มีบทพากย์เสมอ — บทพากย์ที่มีเรียงกัน SHALL เล่าเรื่องต่อเนื่องกันเป็นบทบรรยายเดียว — ฉากที่ไม่มีบทพากย์ SHALL สร้างวิดีโอได้ตามปกติ (มีแต่เสียงบรรยากาศ)

`_visualsToScenes` SHALL คัดลอก `narration` และ `duration_sec` จาก `visuals` ลง `scenes` (ไม่มีค่า → `narration: ''`, `duration_sec: 8`)

#### Scenario: Generate content วิดีโอใหม่ 60 วินาที
- **WHEN** ผู้ใช้ generate content ประเภทวิดีโอที่ `duration_sec = 60`
- **THEN** `visuals` SHALL มี 7 ฉาก แต่ละฉากมี `visual_prompt`/`visual`, `video_prompt`/`motion`, key `narration` และ `duration_sec = 8`
- **AND** `narration` ของฉากแรกและฉากสุดท้าย SHALL ไม่ว่าง
- **AND** `narration` ที่ไม่ว่างของแต่ละฉาก SHALL ยาวไม่เกิน 100 ตัวอักษร

#### Scenario: ฉากโชว์ภาพไม่มีบทพากย์
- **WHEN** AI เห็นว่าฉากที่ 3 เป็นฉากโชว์สินค้าที่ไม่ควรมีเสียงพูด
- **THEN** ฉากนั้น SHALL มี `narration: ""` และสร้างวิดีโอได้โดย prompt เป็น `video_prompt` อย่างเดียว

#### Scenario: Generate content ประเภทบทความ/โซเชียล
- **WHEN** ผู้ใช้ generate content ประเภทบทความหรือโซเชียล (ไม่ใช่วิดีโอ)
- **THEN** ระบบ SHALL ไม่เพิ่ม `video_prompt`, `narration` หรือ `duration_sec` เข้าไปใน `visuals`/`scenes` เพราะไม่เกี่ยวกับวิดีโอ

#### Scenario: AI ส่งบทพากย์ยาวเกิน
- **WHEN** AI คืน `narration` ของฉากใดยาวเกิน 100 ตัวอักษร
- **THEN** ระบบ SHALL เก็บตามที่ได้ (ไม่ตัดกลางประโยค) และ scene card SHALL แสดงคำเตือนว่าอาจพูดไม่จบใน 8 วินาที

#### Scenario: คอนเทนต์เก่าที่ไม่มี narration
- **WHEN** แปลง `visuals` ของคอนเทนต์เก่าที่ไม่มี `narration` เป็น `scenes`
- **THEN** scene SHALL มี `narration: ''` และ `duration_sec: 8`

### Requirement: ผู้ใช้แก้ไข `video_prompt` และ `visual_prompt` รายฉากผ่าน API เดียวกัน
ระบบ SHALL มี API action `update-scene` รับ `item_id`, `scene_index`, และอย่างน้อยหนึ่งใน `video_prompt`, `visual_prompt` หรือ `narration` เพื่ออัปเดตค่าของ scene เดียวใน `article_content.scenes[]` โดยไม่กระทบ scene อื่น — แต่ละ field อัปเดตแบบ partial (ส่งมาเฉพาะ field ที่ต้องการแก้ ไม่ต้องส่ง field อื่นมาด้วย)

#### Scenario: แก้ video_prompt ของ scene หนึ่งสำเร็จ
- **WHEN** ผู้ใช้แก้ข้อความ `video_prompt` ของ scene index 2 แล้วกดปุ่ม "บันทึก"
- **THEN** ระบบ SHALL เรียก `update-scene` และอัปเดตเฉพาะ `scenes[2].video_prompt` โดย scene อื่นไม่เปลี่ยนแปลง

#### Scenario: แก้ visual_prompt ของ scene หนึ่งสำเร็จ
- **WHEN** ผู้ใช้แก้ข้อความ `visual_prompt` ของ scene index 0 แล้วบันทึกผ่านปุ่ม "บันทึก" หลักของ dialog
- **THEN** ระบบ SHALL เรียก `update-scene` พร้อม `visual_prompt` และอัปเดตเฉพาะ `scenes[0].visual_prompt` โดย `video_prompt` และ scene อื่นไม่เปลี่ยนแปลง

#### Scenario: แก้บทพากย์ของ scene หนึ่งสำเร็จ
- **WHEN** ผู้ใช้แก้ `narration` ของ scene index 1 แล้วกดปุ่ม "บันทึก" หลักของ dialog
- **THEN** ระบบ SHALL เรียก `update-scene` พร้อม `narration` และอัปเดตเฉพาะ `scenes[1].narration`

#### Scenario: บันทึกแบบ explicit ไม่ auto-save
- **WHEN** ผู้ใช้กำลังพิมพ์แก้ `video_prompt`, `visual_prompt` หรือ `narration` แต่ยังไม่กดปุ่มบันทึก
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

### Requirement: ฉากใหม่ได้ `scene.id` และทุกจุดที่เขียนฉากคง id ไว้
`_visualsToScenes()` SHALL ใส่ `id` ที่ไม่ซ้ำให้ทุกฉากที่สร้าง (ฉากที่แปลงมาจาก `visuals` ที่มี `id` อยู่แล้ว SHALL ใช้ `id` เดิม) — ทุก action ที่เขียน `article_content.scenes[]` (`generate-scene-images`, `generate-scene-image`, `update-scene`, `generate-scene-video-prompt` และการบันทึกจาก dialog) SHALL คง `id` ของฉากที่มีอยู่แล้วไว้ — การเขียนสคริปต์ใหม่ที่ได้ `visuals` ชุดใหม่ SHALL ได้ฉากที่มี `id` ใหม่

#### Scenario: สร้างภาพทุกฉากครั้งแรก
- **WHEN** คอนเทนต์ยังไม่มี `scenes` และผู้ใช้กด "สร้างภาพทุกฉาก"
- **THEN** ทุกฉากใน `scenes` ที่บันทึก SHALL มี `id` ไม่ซ้ำกัน

#### Scenario: สร้างภาพฉากเดียวใหม่
- **WHEN** ผู้ใช้สร้างภาพของฉาก 3 ใหม่
- **THEN** `scenes[2].id` SHALL ไม่เปลี่ยน (แต่ `image_url` เปลี่ยน)

#### Scenario: แก้บทพากย์ผ่าน update-scene
- **WHEN** เรียก `update-scene` แก้ `narration` ของฉาก 1
- **THEN** `id` ของทุกฉาก SHALL ไม่เปลี่ยน
