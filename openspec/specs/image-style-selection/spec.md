# image-style-selection Specification

## Purpose

ให้ผู้ใช้เลือกสไตล์ภาพ (photorealistic, 3D render, illustration, corporate, หรือกำหนดเอง) ตอนสร้างคอนเทนต์ โดย AI เลือกให้เป็นค่าเริ่มต้น สไตล์ที่เลือกมีผลทั้งตอน AI เขียนคำบรรยายภาพ และตอนยิงสร้างภาพจริงกับโมเดล image-gen แก้ปัญหาที่ภาพที่ระบบสร้างออกมาเป็นภาพประกอบ/การ์ตูนแบบเดียวเสมอ เพราะ prompt ไม่เคยมีคำสั่งสไตล์มาก่อน

## Requirements

### Requirement: ผู้ใช้เลือกสไตล์ภาพตอนสร้างคอนเทนต์
หน้าสร้างคอนเทนต์ (`QuickCreateDialog` และ `BatchGenerateDialog`) SHALL มีตัวเลือก "สไตล์ภาพ" ให้เลือก ใช้ได้ทั้ง content ประเภท article และ video (ไม่ผูกกับ content type) โดยมี preset 5 แบบ (AI เลือกให้, สมจริง, 3D เรนเดอร์, อินโฟกราฟิก/ภาพประกอบ, องค์กรมืออาชีพ) และตัวเลือก "กำหนดเอง" ที่เปิดช่องข้อความให้พิมพ์บรรยายสไตล์เอง

#### Scenario: เห็นตัวเลือกสไตล์ภาพใน QuickCreateDialog
- **WHEN** ผู้ใช้เปิด QuickCreateDialog เพื่อสร้าง content (ไม่ว่า article หรือ video)
- **THEN** เห็น section "สไตล์ภาพ" พร้อม 6 ตัวเลือก โดย "AI เลือกให้" ถูกเลือกไว้เป็นค่าเริ่มต้น

#### Scenario: เลือก "กำหนดเอง" เปิดช่องข้อความ
- **WHEN** ผู้ใช้เลือก "กำหนดเอง" ใน UI สไตล์ภาพ
- **THEN** ระบบแสดงช่อง textarea ให้พิมพ์บรรยายสไตล์ภาพเอง

#### Scenario: BatchGenerateDialog เลือกสไตล์ภาพต่อหัวข้อ
- **WHEN** ผู้ใช้สร้าง content แบบ batch หลายหัวข้อพร้อมกัน
- **THEN** แต่ละหัวข้อ (topic row) SHALL เลือกสไตล์ภาพของตัวเองแยกกันได้ เหมือนที่ tone/รูปแบบสคริปต์ทำได้อยู่แล้ว

### Requirement: สไตล์ภาพถูกเก็บถาวรต่อ content item
ค่าสไตล์ภาพที่เลือก (preset key หรือข้อความกำหนดเอง) SHALL ถูกบันทึกลง `content_items.image_style` ตอนสร้าง content — ไม่ใช่แค่ใช้ครั้งเดียวตอน generate แล้วทิ้ง

#### Scenario: Retry สร้างภาพทีหลังยังใช้สไตล์เดิม
- **WHEN** ผู้ใช้กดปุ่ม "สร้างใหม่เฉพาะฉากนี้" (retry รายฉาก) ของ content item ที่มี `image_style: "photorealistic"` บันทึกไว้
- **THEN** การสร้างภาพใหม่ SHALL ใช้สไตล์ "photorealistic" เดิม ไม่ใช่สไตล์ default

### Requirement: สไตล์ภาพมีผลต่อการเขียน prompt โดย AI
เมื่อ generate content ระบบ SHALL ฝัง instruction บอก AI ให้เขียน `image_brief`/`visual_prompt` ให้สอดคล้องกับสไตล์ภาพที่เลือก (ยกเว้นเมื่อเลือก "AI เลือกให้" — ไม่ฝัง instruction ใดๆ)

#### Scenario: เลือกสไตล์ "สมจริง"
- **WHEN** ผู้ใช้เลือกสไตล์ภาพ "สมจริง" แล้ว generate content
- **THEN** system prompt ที่ส่งให้ AI SHALL มี instruction ให้เขียนคำบรรยายภาพแบบภาพถ่ายจริง ไม่ใช่ภาพวาด/การ์ตูน

#### Scenario: เลือก "AI เลือกให้"
- **WHEN** ผู้ใช้เลือกสไตล์ภาพ "AI เลือกให้" แล้ว generate content
- **THEN** system prompt SHALL ไม่มี instruction เกี่ยวกับสไตล์ภาพเพิ่มเติม (พฤติกรรมเดิมก่อน capability นี้)

### Requirement: สไตล์ภาพต่อ suffix เข้า prompt ตอนยิงสร้างภาพจริง
ระบบ SHALL ต่อคำสั่งสไตล์ (suffix) เข้า prompt ที่ส่งให้โมเดล image-gen จริง ทั้ง 2 เส้นทาง: การสร้างภาพปกบทความ (`generate-image`) และการสร้างภาพต่อ scene วิดีโอ (`_generateOneSceneImage()` — ครอบคลุมทั้ง bulk `generate-scene-images` และ retry รายฉาก `generate-scene-image`) — ยกเว้นเมื่อ style เป็น "AI เลือกให้"

#### Scenario: สร้างภาพปกบทความด้วยสไตล์ 3D
- **WHEN** content item มี `image_style: "3d-render"` และผู้ใช้กด "สร้างภาพด้วย AI" (ภาพปก)
- **THEN** prompt ที่ยิงให้โมเดล image-gen SHALL มีคำสั่งสไตล์ 3D render ต่อท้าย

#### Scenario: สร้างภาพ scene วิดีโอด้วยสไตล์กำหนดเอง
- **WHEN** content item มี `image_style: "แสงนีออนโทนไซเบอร์พังก์"` (ข้อความกำหนดเอง) และผู้ใช้กด "สร้างภาพทุกฉาก"
- **THEN** ทุก scene ที่สร้างภาพ SHALL มีข้อความ "แสงนีออนโทนไซเบอร์พังก์" ต่อท้าย prompt ที่ยิงจริง

### Requirement: Backward-compatible derivation สำหรับ content เก่าที่ไม่มี image_style
Content item ที่ไม่มีค่า `image_style` เลย (สร้างก่อน capability นี้) SHALL ถูก derive เป็น "AI เลือกให้" — ไม่ error และไม่มีการเปลี่ยนพฤติกรรมการสร้างภาพจากเดิม

#### Scenario: Content เก่าไม่มี image_style
- **WHEN** content item ที่สร้างไว้ก่อนหน้านี้ (ไม่มีคอลัมน์ `image_style` ค่าใดๆ) ถูกใช้สร้างภาพ
- **THEN** ระบบ SHALL ปฏิบัติเหมือนเลือก "AI เลือกให้" (ไม่ฝัง instruction, ไม่ต่อ suffix) — พฤติกรรมเดิมทุกประการ
