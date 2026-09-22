## ADDED Requirements

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
เมื่อ `article_content.scenes` ว่างเปล่าหรือไม่มี ระบบ SHALL แสดง section "ฉากวิดีโอ" พร้อมข้อความ "ยังไม่มีฉาก กด 'สร้างภาพทุกฉาก' เพื่อเริ่มสร้าง" และปุ่ม "สร้างภาพทุกฉาก" — SHALL ไม่ซ่อน section นี้ไปทั้งหมด

#### Scenario: Content item ที่ยังไม่เคยสร้าง scene เลย
- **WHEN** ผู้ใช้เปิด `ContentVideoView` ของ content item ที่ `scenes` ว่างเปล่า
- **THEN** เห็น section "ฉากวิดีโอ" พร้อมข้อความชวนสร้างและปุ่มกดได้ทันที
