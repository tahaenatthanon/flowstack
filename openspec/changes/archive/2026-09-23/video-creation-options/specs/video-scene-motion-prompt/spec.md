## MODIFIED Requirements

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
