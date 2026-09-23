# video-combine Specification

## Purpose

กำหนดการรวมคลิปรายฉากเป็นวิดีโอเดียวด้วย ffmpeg — ตาราง `content_video_combines`, เงื่อนไขการรวม, การตรวจ ffmpeg, ขั้นตอนปรับเสียง/ต่อคลิป/faststart, การกันรวมซ้อน และการตรวจวิดีโอรวมล้าสมัย — ที่มา: change `multi-clip-video`

## Requirements

### Requirement: เก็บวิดีโอรวมทุกครั้งในตาราง `content_video_combines`
ทุกครั้งที่ผู้ใช้สั่งรวมคลิป ระบบ SHALL สร้างแถวใหม่ใน `content_video_combines` ที่มีอย่างน้อย `id`, `tenant_id`, `item_id` (FK → `content_items` ON DELETE CASCADE), `status` (`combining` | `done` | `failed`), `video_url`, `source_clips` (JSON array ของ `{scene_id, scene_index, clip_id}` เรียงตามลำดับฉาก), `error`, `created_at`, `completed_at`, `updated_at`

เมื่อรวมสำเร็จ `content_items.video_url` SHALL ชี้ไปที่ไฟล์รวมล่าสุดที่ `done` และ `video_gen_status` SHALL เป็น `done` — แต่ละครั้ง SHALL สร้างไฟล์ใหม่ (SHALL ไม่เขียนทับไฟล์รวมเดิม) และ SHALL ไม่ลบไฟล์เดิม

#### Scenario: รวมครั้งที่สอง
- **WHEN** item มีวิดีโอรวมไฟล์ A แล้วผู้ใช้รวมใหม่สำเร็จได้ไฟล์ B
- **THEN** `content_items.video_url` SHALL เป็นไฟล์ B และไฟล์ A SHALL ยังอยู่
- **AND** แถวของ B SHALL มี `source_clips` ระบุ clip generation ที่ใช้ของแต่ละฉาก

### Requirement: รวมได้เมื่อทุก Active Scene มีคลิปพร้อมใช้
action `combine-video` SHALL รวมได้เฉพาะเมื่อ **ทุก Active Scene** มีคลิปที่ใช้งาน (`done`) และไม่ล้าสมัย และไม่มีฉากใดที่ generation ล่าสุดยัง `generating` — มิฉะนั้น SHALL ไม่รวมและ SHALL คืนเหตุผลภาษาไทยของทุกฉากที่ยังไม่พร้อม (เช่น "ฉาก 2 ยังไม่มีคลิป", "ฉาก 5 ล้าสมัย (บทพากย์เปลี่ยน)", "ฉาก 6 กำลังสร้าง") — คลิปของฉากที่ไม่ใช่ Active Scene SHALL ไม่ถูกนำมาพิจารณา

#### Scenario: บางฉากยังไม่พร้อม
- **WHEN** มี 4 Active Scene ฉาก 2 ยังไม่มีคลิปและฉาก 3 ล้าสมัย
- **THEN** ระบบ SHALL ไม่รวม และ SHALL คืนเหตุผลของฉาก 2 และฉาก 3

#### Scenario: คลิปเก่าของฉากที่ถูกซ่อน
- **WHEN** มีคลิป `done` ของฉากที่ไม่ใช่ Active Scene อยู่ด้วย
- **THEN** ระบบ SHALL รวมเฉพาะคลิปของ Active Scene ตามลำดับ `article_content.scenes[]`

### Requirement: กันการรวมซ้อนที่ backend
ก่อนเริ่มรวม ระบบ SHALL จองแบบ atomic (ล็อกแถว `content_items` ด้วย `SELECT ... FOR UPDATE` ตรวจว่าไม่มีแถว `combining` ที่ยังไม่หมดอายุ แล้ว INSERT แถว `combining`) — ถ้ามีการรวมอื่นที่ยัง `combining` อยู่และสร้างมาไม่เกิน 10 นาที SHALL ตอบ HTTP 409 พร้อมข้อความภาษาไทย "กำลังรวมวิดีโออยู่" — แถว `combining` ที่เกิน 10 นาที SHALL ถือว่าหมดอายุ

#### Scenario: กดรวมซ้ำระหว่างกำลังรวม
- **WHEN** คำขอแรกกำลังรวมอยู่ และมีคำขอที่สองเข้ามา
- **THEN** คำขอที่สอง SHALL ได้ 409 และ SHALL ไม่เรียก ffmpeg

#### Scenario: การจองค้างเพราะโปรเซสดับ
- **WHEN** มีแถว `combining` ที่สร้างมาเกิน 10 นาที
- **THEN** ผู้ใช้ SHALL รวมใหม่ได้

### Requirement: ขั้นตอนการรวมด้วย ffmpeg
ระบบ SHALL รวมคลิปด้วยขั้นตอน:
1. ต่อคลิปแต่ละคลิป ใช้ ffprobe อ่านความยาวของภาพ (video stream)
2. ปรับเสียงเป็น AAC 48kHz stereo — ถ้าคลิปไม่มีแทร็กเสียง SHALL ใส่เสียงเงียบ — และตัด/เติมเสียงให้ยาวเท่าความยาวภาพของคลิปนั้น (ภาพเป็นตัวกำหนดความยาวของฉาก)
3. ต่อคลิปที่ปรับแล้วตามลำดับฉาก โดยคัดลอกภาพ (ไม่เข้ารหัสภาพใหม่) แบบตัดชน ไม่มี transition
4. ย้าย `moov` ไว้ต้นไฟล์ (`+faststart`)

path ทุกตัวที่ส่งให้ ffmpeg/ffprobe SHALL มาจากระบบเท่านั้นและ SHALL ครอบด้วย `escapeshellarg` — ไฟล์ชั่วคราว SHALL ถูกลบหลังรวมเสร็จหรือล้มเหลว

#### Scenario: ฉากกลางไม่มีเสียง
- **WHEN** รวม 3 คลิปที่คลิปกลางไม่มีแทร็กเสียง
- **THEN** ไฟล์รวม SHALL มีแทร็กเสียงต่อเนื่องตลอด โดยช่วงคลิปกลางเป็นเสียงเงียบ

#### Scenario: เสียงไม่เลื่อนสะสม
- **WHEN** รวม 11 คลิป ที่เสียงของแต่ละคลิปยาวกว่าภาพ
- **THEN** ความยาวเสียงของไฟล์รวม SHALL ต่างจากความยาวภาพไม่เกิน 0.1 วินาที

#### Scenario: เล่นบนเว็บได้ทันที
- **WHEN** รวมเสร็จ
- **THEN** กล่อง `moov` ของไฟล์ SHALL อยู่ก่อน `mdat`

### Requirement: รวมไม่สำเร็จไม่กระทบวิดีโอรวมเดิม
ถ้า ffmpeg ล้มเหลว ระบบ SHALL บันทึกแถวเป็น `failed` พร้อม `error` และ SHALL ไม่เปลี่ยน `content_items.video_url` — วิดีโอรวมเดิม (ถ้ามี) SHALL ยังเล่นได้

#### Scenario: ffmpeg error
- **WHEN** ffmpeg คืน exit code ไม่ใช่ 0
- **THEN** แถวรวม SHALL เป็น `failed` และ `video_url` เดิมของ item SHALL ไม่เปลี่ยน

### Requirement: ตรวจความพร้อมของ ffmpeg ทุกครั้ง
ระบบ SHALL ตรวจทุกครั้งที่ต้องใช้ (ไม่เก็บผลไว้) ว่า `exec` ใช้ได้ และ ffmpeg กับ ffprobe รันได้ — path SHALL มาจาก `FFMPEG_PATH` / `FFPROBE_PATH` ใน `.env` ถ้าตั้งไว้ มิฉะนั้นใช้ `ffmpeg` / `ffprobe` จาก PATH — ถ้าไม่พร้อม `combine-video` SHALL ไม่รวมและคืนเหตุผลภาษาไทยว่าเซิร์ฟเวอร์ยังไม่รองรับการรวมคลิป

#### Scenario: เซิร์ฟเวอร์ไม่มี ffmpeg
- **WHEN** ffmpeg รันไม่ได้
- **THEN** สถานะวิดีโอ SHALL ระบุว่ารวมไม่ได้พร้อมเหตุผล และ `combine-video` SHALL ไม่สร้างแถว `combining`

#### Scenario: ตั้ง path ใน .env
- **WHEN** `.env` มี `FFMPEG_PATH` เป็น path เต็มของ ffmpeg.exe
- **THEN** ระบบ SHALL ใช้ path นั้นแม้ PATH ของ Apache จะไม่มี ffmpeg

### Requirement: วิดีโอรวมล้าสมัย
วิดีโอรวมล่าสุดที่ `done` SHALL ถือว่า **ล้าสมัย** เมื่อข้อใดข้อหนึ่งเป็นจริง: (ก) ชุด `scene_id` ใน `source_clips` ไม่ตรงกับ Active Scene ปัจจุบัน (ข) ฉากใดมีคลิปที่ใช้งานเป็น generation อื่นที่ไม่ใช่ `clip_id` ใน `source_clips` (ค) คลิปใน `source_clips` ของฉากใดล้าสมัยตาม `input_snapshot` — ระบบ SHALL คำนวณทุกครั้งที่อ่านและ SHALL ส่งเหตุผลภาษาไทย — generation ใหม่ที่ยัง `generating` หรือ `failed` SHALL ไม่ทำให้ล้าสมัย — วิดีโอรวมที่ล้าสมัย SHALL ยังเล่นได้ และผู้ใช้ SHALL เป็นผู้สั่งรวมใหม่เอง (ไม่รวมใหม่อัตโนมัติ)

#### Scenario: เขียนสคริปต์ใหม่
- **WHEN** ฉากถูกเขียนใหม่จน `scene_id` เปลี่ยน
- **THEN** วิดีโอรวม SHALL ล้าสมัยพร้อมเหตุผล "ฉากเปลี่ยน"

#### Scenario: ฉากมีคลิปใหม่
- **WHEN** ฉาก 3 มีคลิป generation ใหม่ที่ `done`
- **THEN** วิดีโอรวม SHALL ล้าสมัยพร้อมเหตุผล "ฉาก 3 มีคลิปใหม่"

#### Scenario: แก้บทพากย์โดยยังไม่สร้างคลิปใหม่
- **WHEN** ผู้ใช้บันทึกบทพากย์ของฉาก 4 ใหม่ แต่ยังไม่ได้สร้างคลิป
- **THEN** วิดีโอรวม SHALL ล้าสมัยพร้อมเหตุผล "ฉาก 4 ล้าสมัย (บทพากย์เปลี่ยน)"

#### Scenario: สร้างคลิปใหม่แล้วล้ม
- **WHEN** ฉาก 3 มี generation ใหม่ที่ `failed` และคลิปที่ใช้งานยังเป็นคลิปเดิมที่อยู่ใน `source_clips`
- **THEN** วิดีโอรวม SHALL ไม่ล้าสมัย
