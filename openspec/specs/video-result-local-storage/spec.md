# video-result-local-storage Specification

## Purpose

กำหนดการดาวน์โหลดวิดีโอผลลัพธ์จาก kie.ai (URL ชั่วคราว) มาเก็บใน `uploads/content/videos/` และพฤติกรรมเมื่อดาวน์โหลดไม่สำเร็จ — ที่มา: change `kie-video-adapter`

## Requirements

### Requirement: ดาวน์โหลดวิดีโอผลลัพธ์มาเก็บในระบบ
เมื่อ `video-status` พบว่างานสร้างวิดีโอสำเร็จ ระบบ SHALL ดาวน์โหลดไฟล์จาก URL ผลลัพธ์ของ kie.ai มาเก็บที่ `uploads/content/videos/` ด้วยชื่อไฟล์ที่มี `content_items.id` และ `taskId` (กันชื่อซ้ำเมื่อสร้างใหม่) แล้วบันทึก path ภายในรูปแบบ `/uploads/content/videos/<ชื่อไฟล์>.mp4` ลง `content_items.video_url` — SHALL ไม่บันทึก URL ภายนอกของ kie.ai (`tempfile.aiquickdraw.com`) ลง `video_url`

#### Scenario: งานสำเร็จและดาวน์โหลดได้
- **WHEN** kie.ai รายงานว่างานสำเร็จพร้อม URL ผลลัพธ์
- **THEN** ระบบ SHALL ดาวน์โหลดไฟล์มาเก็บใน `uploads/content/videos/`
- **AND** SHALL บันทึก `video_url` เป็น path ภายใน และ `video_gen_status = 'done'`
- **AND** SHALL ตอบ frontend เป็น `{"status": "done", "video_url": "/uploads/content/videos/..."}`

#### Scenario: สร้างวิดีโอใหม่ทับของเดิม
- **WHEN** item มี `video_url` จากการสร้างครั้งก่อน และผู้ใช้กด "สร้างวิดีโอใหม่" จนสำเร็จ
- **THEN** `video_url` SHALL ชี้ไปที่ไฟล์ใหม่ (ชื่อไฟล์ต่างจากเดิมเพราะ `taskId` ต่างกัน)

### Requirement: ดาวน์โหลดไม่สำเร็จไม่ถือว่างานล้มเหลว
ถ้างานบน kie.ai สำเร็จแต่ดาวน์โหลดไฟล์ไม่สำเร็จ (timeout, HTTP ไม่ใช่ 2xx, ไฟล์ว่าง หรือเขียนไฟล์ไม่ได้) ระบบ SHALL คง `video_gen_status = 'generating'` ไว้และตอบ frontend ว่ายังสร้างอยู่ เพื่อให้การ poll รอบถัดไปลองดาวน์โหลดใหม่ — SHALL ไม่ตั้งเป็น `failed` (เพราะ kie.ai คิด credit ไปแล้ว การตั้ง `failed` จะทำให้ผู้ใช้กดสร้างใหม่และเสีย credit ซ้ำ) และ SHALL บันทึก error ลง log พร้อม `taskId`

#### Scenario: ดาวน์โหลดล้มเหลวชั่วคราว
- **WHEN** kie.ai รายงานว่างานสำเร็จ แต่การดาวน์โหลดไฟล์ timeout
- **THEN** `video_gen_status` SHALL ยังเป็น `generating`
- **AND** ระบบ SHALL ตอบ frontend เป็น `{"status": "generating", ...}`
- **AND** SHALL เขียน `error_log` ที่มี `taskId`

#### Scenario: poll รอบถัดไปดาวน์โหลดสำเร็จ
- **WHEN** การ poll รอบถัดไปดาวน์โหลดไฟล์ได้
- **THEN** ระบบ SHALL ทำตาม requirement "ดาวน์โหลดวิดีโอผลลัพธ์มาเก็บในระบบ" ตามปกติ
