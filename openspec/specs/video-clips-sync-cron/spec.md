# video-clips-sync-cron Specification

## Purpose

กำหนดงาน cron `video-clips-sync` ที่ poll + ดาวน์โหลดคลิปวิดีโอที่ค้างเมื่อผู้ใช้ปิดแท็บ และเก็บงานค้าง โดยไม่ทำงานซ้ำกับการ poll จากหน้าเว็บ — ที่มา: change `multi-clip-video`

## Requirements

### Requirement: ลงทะเบียน cron `video-clips-sync`
ระบบ SHALL ลงทะเบียนงาน `video-clips-sync` ในตาราง `cron_jobs` ด้วยรูปแบบเดียวกับ `content-metrics-sync` (`type = 'include'`, `file_path = 'api/cron/video-clips-sync.php'`) ทำงานทุก 1 นาทีผ่าน `api/cron/tick.php` — SHALL ไม่เพิ่ม scheduler ใหม่ และการทำงานจริง SHALL ตรวจได้จากตาราง `cron_runs`

#### Scenario: tick เรียกงาน
- **WHEN** `tick.php` รันและ `video-clips-sync` ถึงกำหนด
- **THEN** ระบบ SHALL include `api/cron/video-clips-sync.php` และบันทึกผลลง `cron_runs`

### Requirement: poll และดาวน์โหลดคลิปที่ค้าง
แต่ละรอบ งาน SHALL เลือกคลิปที่ `status = 'generating'` และมี `job_id` เรียงตาม `created_at` จากเก่าไปใหม่ ไม่เกิน 30 คลิป แล้ว poll ด้วย adapter ของ `model_id` ของคลิปนั้น — สำเร็จ → ดาวน์โหลดแล้วตั้ง `done` พร้อม `clip_url`, `completed_at`; ล้มเหลว → ตั้ง `failed` พร้อม `error`, `completed_at`; ยังไม่เสร็จ → ไม่เปลี่ยน — งาน SHALL มีงบเวลาต่อรอบประมาณ 40 วินาที เมื่อหมดงบ SHALL หยุดและปล่อยที่เหลือให้รอบถัดไป — งาน SHALL ไม่รวมคลิป

#### Scenario: ผู้ใช้ปิดแท็บ
- **WHEN** ผู้ใช้สร้างคลิปแล้วปิดแท็บก่อนคลิปเสร็จ
- **THEN** cron SHALL poll และดาวน์โหลดคลิปจนเป็น `done` โดยไม่ต้องมีหน้าเว็บเปิดอยู่

#### Scenario: งานค้างมาก
- **WHEN** มีคลิป `generating` 45 คลิป
- **THEN** รอบเดียว SHALL poll ไม่เกิน 30 คลิปที่เก่าที่สุด

### Requirement: ไม่ทำงานซ้ำกับการ poll จากหน้าเว็บ
cron และ action `clip-status` ของหน้าเว็บ SHALL ใช้ทั้ง lock ของการดาวน์โหลด (ไฟล์ `.lock` แบบ non-blocking) และการอัปเดตแบบมีเงื่อนไข (`UPDATE ... WHERE id = ? AND status = 'generating'`) — ฝ่ายที่อัปเดตไม่ได้ (affected rows = 0) SHALL ถือว่าอีกฝ่ายทำไปแล้ว และ SHALL ไม่ดาวน์โหลดหรือเปลี่ยนสถานะซ้ำ

#### Scenario: เว็บและ cron poll คลิปเดียวกันพร้อมกัน
- **WHEN** หน้าเว็บและ cron พบว่าคลิปเดียวกันสำเร็จพร้อมกัน
- **THEN** SHALL มีการดาวน์โหลดเพียงครั้งเดียว และสถานะ SHALL ถูกตั้งเป็น `done` ครั้งเดียว

### Requirement: เก็บงานค้าง
แต่ละรอบ งาน SHALL:
- เปลี่ยนคลิป `generating` ที่ `job_id` เป็น NULL และจองมาแล้วเกิน 10 นาที (นับจาก `created_at`) เป็น `failed` พร้อมเหตุผล "ส่งงานไม่สำเร็จ" และ `credits_estimated = 0`, `credits_actual = 0`
- เปลี่ยนคลิป `generating` ที่มี `job_id` และสร้างมาเกิน 2 ชั่วโมงเป็น `failed` พร้อมเหตุผล "หมดเวลา"
- เปลี่ยนแถว `content_video_combines` ที่ `combining` เกิน 10 นาทีเป็น `failed` พร้อมเหตุผล "รวมไม่สำเร็จ"

ทุกการเปลี่ยน SHALL เป็นการอัปเดตแบบมีเงื่อนไขสถานะเดิม

#### Scenario: โปรเซสดับหลังจองฉาก
- **WHEN** มีคลิป `generating` ที่ `job_id` เป็น NULL และจองมา 11 นาที
- **THEN** cron SHALL เปลี่ยนเป็น `failed` "ส่งงานไม่สำเร็จ" ทำให้ผู้ใช้สร้างฉากนั้นใหม่ได้

#### Scenario: kie ไม่เสร็จนานผิดปกติ
- **WHEN** คลิปมี `job_id` และ `generating` มาแล้ว 2 ชั่วโมง 5 นาที
- **THEN** cron SHALL เปลี่ยนเป็น `failed` "หมดเวลา"
