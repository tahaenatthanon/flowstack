## MODIFIED Requirements

### Requirement: ดาวน์โหลดวิดีโอผลลัพธ์มาเก็บในระบบ
เมื่อ `clip-status` หรือ cron `video-clips-sync` พบว่างานสร้างคลิปสำเร็จ ระบบ SHALL ดาวน์โหลดไฟล์จาก URL ผลลัพธ์ของ kie.ai มาเก็บที่ `uploads/content/videos/` ด้วยชื่อไฟล์ที่มี `content_items.id` และ `taskId` (กันชื่อซ้ำ) แล้วบันทึก path ภายในรูปแบบ `/uploads/content/videos/<ชื่อไฟล์>.mp4` ลง `content_video_clips.clip_url` — SHALL ไม่บันทึก URL ภายนอกของ kie.ai และ SHALL ไม่เขียน `content_items.video_url` (ซึ่งเป็นของวิดีโอรวมเท่านั้น)

การดาวน์โหลด SHALL เขียนลงไฟล์ `.part` แล้วเปลี่ยนชื่อเมื่อครบ, SHALL ใช้ lock แบบ non-blocking กันดาวน์โหลดซ้อน และ SHALL จำกัดเวลาต่อครั้งตามที่ผู้เรียกกำหนด — ถ้า CDN ของ kie.ai รองรับ HTTP Range (ยืนยันจากการทดสอบก่อน implement) SHALL ดาวน์โหลดต่อจากขนาดของไฟล์ `.part` ที่ค้างอยู่แทนการเริ่มใหม่ — ถ้าไม่รองรับ SHALL เริ่มใหม่ และการแยกการดาวน์โหลดไปเป็นโปรเซสอื่นเป็นการตัดสินใจหลังผลทดสอบ

#### Scenario: งานสำเร็จและดาวน์โหลดได้
- **WHEN** kie.ai รายงานว่าคลิปสำเร็จพร้อม URL ผลลัพธ์
- **THEN** ระบบ SHALL ดาวน์โหลดไฟล์มาเก็บใน `uploads/content/videos/`
- **AND** SHALL บันทึก `clip_url` เป็น path ภายใน, `status = 'done'` และ `completed_at`

#### Scenario: สร้างคลิปฉากเดิมใหม่
- **WHEN** ฉากมีคลิปเดิมแล้วผู้ใช้สร้าง generation ใหม่จนสำเร็จ
- **THEN** generation ใหม่ SHALL มี `clip_url` เป็นไฟล์ใหม่ (ชื่อต่างเพราะ `taskId` ต่างกัน) และไฟล์เดิม SHALL ยังอยู่

#### Scenario: ดาวน์โหลดต่อจากไฟล์ค้าง
- **WHEN** CDN รองรับ Range และรอบก่อนดาวน์โหลดได้ 1.2MB ของไฟล์ 3MB แล้วหมดเวลา
- **THEN** รอบถัดไป SHALL ขอข้อมูลตั้งแต่ไบต์ที่ 1.2MB เป็นต้นไป และต่อท้ายไฟล์ `.part` เดิม

### Requirement: ดาวน์โหลดไม่สำเร็จไม่ถือว่างานล้มเหลว
ถ้างานบน kie.ai สำเร็จแต่ดาวน์โหลดไฟล์ไม่สำเร็จหรือยังไม่ครบ (timeout, หมดเวลาต่อครั้ง, HTTP ไม่ใช่ 2xx/206, ไฟล์ว่าง หรือเขียนไฟล์ไม่ได้) ระบบ SHALL คง `status = 'generating'` ของคลิปไว้ เพื่อให้การ poll รอบถัดไป (จากหน้าเว็บหรือ cron) ลองดาวน์โหลดต่อ — SHALL ไม่ตั้งเป็น `failed` (kie.ai คิด credit ไปแล้ว) และ SHALL บันทึก error ลง log พร้อม `taskId`

#### Scenario: ดาวน์โหลดล้มเหลวชั่วคราว
- **WHEN** kie.ai รายงานว่าคลิปสำเร็จ แต่การดาวน์โหลด timeout
- **THEN** คลิป SHALL ยังเป็น `generating`
- **AND** SHALL เขียน `error_log` ที่มี `taskId`

#### Scenario: poll รอบถัดไปดาวน์โหลดสำเร็จ
- **WHEN** การ poll รอบถัดไปดาวน์โหลดไฟล์ได้ครบ
- **THEN** ระบบ SHALL ทำตาม requirement "ดาวน์โหลดวิดีโอผลลัพธ์มาเก็บในระบบ" ตามปกติ
