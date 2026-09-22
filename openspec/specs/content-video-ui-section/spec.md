# content-video-ui-section Specification

## ADDED Requirements

### Requirement: Video section appears below image section in content editor
ใน `ContentCardDialog` และ `ContentDetailView` SHALL มีหัวข้อ "วิดีโอ" ใต้หัวข้อ "ภาพประกอบ" ในคอลัมน์ด้านขวา — แสดงเฉพาะข้อมูลที่เกี่ยวข้องกับวิดีโอ ไม่แสดงส่วนบทความ

#### Scenario: Video section renders after image section
- **WHEN** ผู้ใช้เปิด dialog แก้ไข content item
- **THEN** เห็นหัวข้อ "วิดีโอ" ใต้ "ภาพประกอบ" พร้อมข้อมูลสถานะวิดีโอ (ยังไม่มี, กำลังสร้าง, พร้อมเล่น) — icon เป็น `Clapperboard`

### Requirement: Video section has AI generation button with slate icon
หัวข้อ "วิดีโอ" SHALL มีปุ่ม "สร้างวิดีโอด้วย AI" ที่ใช้ไอคอน `Clapperboard` และเรียกใช้ endpoint `/brand-content.php?action=generate-video`

#### Scenario: Click generate video button
- **WHEN** ผู้ใช้คลิก "สร้างวิดีโอด้วย AI"
- **THEN** ระบบส่งคำขอสร้างวิดีโอไปยัง backend และแสดง loading state จนกว่าจะเสร็จ

### Requirement: Video section displays video status with helpful description
หัวข้อ "วิดีโอ" SHALL แสดงสถานะปัจจุบันของวิดีโอ: ยังไม่มีวิดีโอ → แสดงข้อความแนะนำให้เขียนหรือ AI เขียน Video Prompt ของ scene แรกก่อน (ไม่ใช่ข้อความเดิมที่บอกให้สร้างภาพก่อน เพราะไม่บังคับต้องมีภาพอีกต่อไป) และปุ่มสร้าง, กำลังสร้าง → แสดง loader, พร้อมเล่น → แสดง video player

#### Scenario: ยังไม่มี video_prompt ของ scene แรก
- **WHEN** content item ยังไม่มี `video_url`, ไม่ได้กำลังสร้าง, และ `scenes[0].video_prompt` ว่างเปล่า
- **THEN** ระบบแสดงข้อความแนะนำให้เขียนหรือกด "AI เขียน Video Prompt" ของ scene แรกก่อน — SHALL ไม่แสดงข้อความเดิม "ต้องมี scene ที่สร้างภาพแล้วอย่างน้อย 1 ฉากก่อนสร้างวิดีโอ" อีกต่อไป

#### Scenario: พร้อมเล่น
- **WHEN** content item มี `video_url` และ `video_gen_status === 'done'`
- **THEN** ระบบแสดง video player แบบ inline (ไม่เปลี่ยนจากพฤติกรรมเดิม)

### Requirement: เลือกสัดส่วนวิดีโอก่อนสร้าง
หัวข้อ "วิดีโอ" SHALL มี selector ให้เลือกสัดส่วนวิดีโอ (`9:16` / `16:9` / `Auto`) ก่อนกดปุ่ม "สร้างวิดีโอด้วย AI" — ค่าที่เลือก SHALL ถูกส่งไปกับคำขอ `generate-video` เป็น `aspect_ratio` — SHALL ไม่ persist ค่านี้ลงฐานข้อมูล (เลือกใหม่ได้ทุกครั้งที่สร้าง ไม่ผูกกับ content item ถาวร)

#### Scenario: เลือกสัดส่วนแล้วกดสร้าง
- **WHEN** ผู้ใช้เลือก "16:9" แล้วกด "สร้างวิดีโอด้วย AI"
- **THEN** คำขอที่ส่งไป backend SHALL มี `aspect_ratio: "16:9"`

#### Scenario: ค่าเริ่มต้นของ selector
- **WHEN** ผู้ใช้เปิดหัวข้อ "วิดีโอ" ครั้งแรกโดยยังไม่เคยเลือกสัดส่วน
- **THEN** selector SHALL แสดงค่าเริ่มต้นเป็น `9:16` (ตรงกับพฤติกรรมเดิมก่อน change นี้)

### Requirement: ปุ่ม "AI เขียน Video Prompt" ต่อ scene ที่ยังว่าง
แต่ละ scene card ที่ `video_prompt` ว่างเปล่า SHALL มีปุ่ม "AI เขียน Video Prompt" ที่เรียก action `generate-scene-video-prompt` — ปุ่มนี้ SHALL แสดงในทุก scene (ไม่จำกัดแค่ scene แรก) เพื่อความสอดคล้องกับ scene card อื่นที่ใช้ component เดียวกัน

#### Scenario: กด "AI เขียน Video Prompt" สำเร็จ
- **WHEN** ผู้ใช้กดปุ่ม "AI เขียน Video Prompt" ของ scene ที่ `video_prompt` ว่าง
- **THEN** ระบบเรียก AI เขียนคำสั่งการเคลื่อนไหวจาก `visual_prompt` ของ scene นั้น แล้วเติมลงช่อง Video Prompt ทันทีเมื่อสำเร็จ (บันทึกลง DB แล้ว ไม่ต้องกด "บันทึก Video Prompt" ซ้ำ)

#### Scenario: กด "AI เขียน Video Prompt" ไม่สำเร็จ
- **WHEN** การเรียก AI ล้มเหลว (เช่น provider error)
- **THEN** ระบบ SHALL แสดง toast แจ้ง error — SHALL ไม่ persist ข้อความ error นี้ลง scene (ต่างจาก `image_gen_error` ที่ persist)

### Requirement: Video section does not display article content
Video section SHALL แสดงเฉพาะข้อมูลและองค์ประกอบที่เกี่ยวข้องกับวิดีโอเท่านั้น — ไม่แสดงส่วนบทความ (Article)

#### Scenario: Article content hidden in video context
- **WHEN** ผู้ใช้เปิด dialog แก้ไข content item แบบวิดีโอ
- **THEN** video section ไม่แสดง article body, excerpts, หรือส่วนประกอบบทความใดๆ

### Requirement: Video icon on content detail page header
หน้ารายละเอียด Content (`ContentDetailView`) SHALL แสดงไอคอนประเภทวิดีโอ (`Play`) ที่มุมซ้ายบนของ header — ใช้ไอคอนเดียวกับหน้า "ผลงานทั้งหมด" (`ContentListTab`)

#### Scenario: Video icon visible on detail header
- **WHEN** ผู้ใช้เปิดดูรายละเอียด content item ที่เป็นประเภทวิดีโอ (`type === 'video'`)
- **THEN** ระบบแสดงไอคอน `Play` และข้อความ "วิดีโอ" ที่มุมซ้ายบนของ header
- **AND** ใช้รูปแบบเดียวกับ `ContentListTab` ที่ใช้ `🎬 วิดีโอ` ในรายการเนื้อหา

### Requirement: Platform sub-tab ของ script แสดงเฉพาะ platform ที่มีจริง
ใน `ContentVideoView` sub-tab ที่ใช้เลือกดู script รายแพลตฟอร์ม SHALL แสดงเฉพาะ platform ที่มี key อยู่จริงใน `article_content.scripts` เท่านั้น — SHALL ไม่แสดงรายชื่อ platform ที่ hardcode ไว้ตายตัวโดยไม่เช็คว่ามี script อยู่จริงหรือไม่

#### Scenario: เลือกไว้ 2 platform เห็นแค่ 2 แท็บ
- **WHEN** content item มี `article_content.scripts` = `{"tiktok": "...", "facebook": "..."}` เท่านั้น (ไม่มี `youtube`, `instagram`)
- **THEN** `ContentVideoView` SHALL แสดง sub-tab แค่ `tiktok` และ `facebook`
- **AND** SHALL ไม่แสดง sub-tab ของ `youtube` หรือ `instagram`

#### Scenario: ไม่มี script เลยไม่มี sub-tab
- **WHEN** content item ไม่มี `article_content.scripts` หรือเป็น object ว่าง
- **THEN** `ContentVideoView` SHALL ไม่แสดง sub-tab ใดๆ ในส่วนนี้

#### Scenario: เพิ่ม platform ใหม่ภายหลังไม่ต้องแก้โค้ด
- **WHEN** `article_content.scripts` มี key ของ platform ที่ไม่เคยอยู่ในรายชื่อ hardcode เดิม (เช่น `linkedin`)
- **THEN** `ContentVideoView` SHALL แสดง sub-tab ของ platform นั้นด้วย โดยไม่ต้องแก้รายชื่อ platform ที่ hardcode ไว้ในโค้ด

### Requirement: Scene cards แสดงและแก้ไขข้อมูลรายฉาก ทั้งใน ContentVideoView และ ContentCardDialog
Scene cards SHALL แสดงใน**ทั้งสองจุด**ที่ผู้ใช้เห็น video content: `ContentVideoView` (หน้ารีวิว/อนุมัติ) และ section "วิดีโอ" ใน `ContentCardDialog` (หน้าแก้ไข content ที่ใช้งานทั่วไป) — SHALL ใช้ UI/logic ชุดเดียวกัน (component กลาง) ไม่ใช่ 2 ชุดโค้ดแยกกัน เพื่อไม่ให้พฤติกรรม drift ระหว่าง 2 จุด แต่ละการ์ด SHALL แสดงภาพ (`image_url` ถ้ามี), สถานะ (`image_gen_status`, ใช้ derive rule กับ scene เก่าที่ไม่มี key นี้), ข้อความ error (`image_gen_error`) เมื่อสถานะเป็น `"failed"`, และช่องข้อความ `video_prompt` ที่แก้ไขได้พร้อมปุ่ม "บันทึก Video Prompt"

#### Scenario: เห็น scene cards จาก ContentCardDialog (หน้าแก้ไขทั่วไป)
- **WHEN** ผู้ใช้เปิด content item ประเภทวิดีโอจาก "ผลงานคอนเทนต์" หรือปฏิทินวางแผน (ContentCardDialog)
- **THEN** ใน section "วิดีโอ" SHALL เห็น scene card ต่อทุก scene แบบเดียวกับที่เห็นใน ContentVideoView

#### Scenario: Scene สำเร็จแสดงภาพและ video_prompt
- **WHEN** scene มี `image_gen_status: "done"` และ `image_url`
- **THEN** การ์ดแสดงภาพนั้น พร้อมช่อง `video_prompt` ที่แก้ไขได้และปุ่มบันทึก

#### Scenario: Scene ล้มเหลวแสดงสาเหตุ
- **WHEN** scene มี `image_gen_status: "failed"` และ `image_gen_error`
- **THEN** การ์ดแสดงข้อความ error นั้น พร้อมปุ่ม "สร้างใหม่เฉพาะฉากนี้"

#### Scenario: Scene ยังไม่เคยสร้างภาพ
- **WHEN** scene มี `image_gen_status: "none"`
- **THEN** การ์ดแสดงสถานะ "ยังไม่ได้สร้างภาพ" โดยไม่มี error

### Requirement: บันทึก video_prompt แบบ explicit
การแก้ไขช่อง `video_prompt` ในแต่ละ scene card SHALL ไม่ถูกบันทึกอัตโนมัติ (ไม่มี auto-save/debounce) — SHALL บันทึกก็ต่อเมื่อผู้ใช้กดปุ่ม "บันทึก Video Prompt" ของ scene นั้นเท่านั้น โดยเรียก API `update-scene`

#### Scenario: พิมพ์แก้ไขแต่ยังไม่กดบันทึก
- **WHEN** ผู้ใช้พิมพ์แก้ `video_prompt` ของ scene หนึ่งแล้วสลับไปแก้ scene อื่นโดยไม่กดปุ่มบันทึก
- **THEN** ค่าที่แก้ SHALL ไม่ถูกส่งไป backend และค่าเดิมยังคงอยู่จนกว่าจะโหลดหน้าใหม่

### Requirement: ปุ่ม retry สร้างภาพเฉพาะ scene
แต่ละ scene card ที่มี `image_gen_status: "failed"` SHALL มีปุ่ม "สร้างใหม่เฉพาะฉากนี้" ที่เรียก API สร้างภาพเฉพาะ scene นั้น (ไม่ใช่ bulk ทุก scene)

#### Scenario: กด retry แล้วรอผล
- **WHEN** ผู้ใช้กดปุ่ม "สร้างใหม่เฉพาะฉากนี้" ของ scene ที่ failed
- **THEN** ปุ่มแสดง loading state เฉพาะการ์ดนั้น และ scene อื่นไม่ถูกรบกวน
- **AND** เมื่อสำเร็จ การ์ดนั้นอัปเดตเป็นสถานะ `"done"` พร้อมภาพใหม่ โดยไม่ต้องโหลดหน้าใหม่

### Requirement: Empty state เมื่อยังไม่มี scene
เมื่อ `article_content.scenes` ว่างเปล่าหรือไม่มี ระบบ SHALL แสดง section "ฉากวิดีโอ" พร้อมข้อความ "ยังไม่มีฉาก กด 'สร้างภาพทุกฉาก' เพื่อเริ่มสร้าง" — SHALL ไม่ซ่อน section นี้ไปทั้งหมด ข้อความนี้ SHALL ไม่มีปุ่ม "สร้างภาพทุกฉาก" ของตัวเองอยู่ใน empty state (อ้างอิงถึงปุ่ม "สร้างภาพทุกฉาก" ที่แสดงอยู่แล้วนอก scene cards เสมอ — ดู requirement ปุ่มเดียวต่อหน้าด้านล่าง)

#### Scenario: Content item ที่ยังไม่เคยสร้าง scene เลย
- **WHEN** ผู้ใช้เปิด `ContentVideoView` หรือ section "วิดีโอ" ใน `ContentCardDialog` ของ content item ที่ `scenes` ว่างเปล่า
- **THEN** เห็น section "ฉากวิดีโอ" พร้อมข้อความชวนสร้าง โดยไม่มีปุ่มอยู่ในข้อความนั้น — ผู้ใช้กดปุ่ม "สร้างภาพทุกฉาก" ที่อยู่นอก section นี้แทน

### Requirement: ปุ่ม "สร้างภาพทุกฉาก" มีเพียงปุ่มเดียวต่อหน้า
ในแต่ละหน้าที่แสดง video content (`ContentCardDialog` section "วิดีโอ" และ `ContentVideoView`) SHALL มีปุ่ม "สร้างภาพทุกฉาก" อยู่เพียงปุ่มเดียวเสมอ ไม่ว่า scenes จะว่างหรือมีอยู่แล้ว — ปุ่มนี้ SHALL ไม่ผูกเงื่อนไขการแสดงผลกับสถานะว่าง/ไม่ว่างของ scenes (แสดงตลอดเวลา) และ SHALL ใช้สไตล์ปุ่มไม่มีพื้นหลัง (`variant="outline"`) ใน `ContentCardDialog`

#### Scenario: ContentCardDialog มีปุ่มเดียวไม่ว่า scenes จะว่างหรือไม่
- **WHEN** ผู้ใช้เปิด section "วิดีโอ" ใน `ContentCardDialog` ไม่ว่า content item จะมี scene อยู่แล้วหรือยังไม่มี
- **THEN** เห็นปุ่ม "สร้างภาพทุกฉาก" สไตล์ไม่มีพื้นหลังเพียงปุ่มเดียว (ไม่มีปุ่มที่สองซ้อนอยู่ใน scene cards ด้านล่าง)

#### Scenario: ContentVideoView มีปุ่มเดียวไม่ว่า scenes จะว่างหรือไม่
- **WHEN** ผู้ใช้เปิด `ContentVideoView` ไม่ว่า content item จะมี scene อยู่แล้วหรือยังไม่มี
- **THEN** เห็นปุ่ม "สร้างภาพทุกฉาก" เพียงปุ่มเดียวในแถบปุ่มด้านล่าง (ไม่มีปุ่มที่สองซ้อนอยู่ใน scene cards ด้านบน)
