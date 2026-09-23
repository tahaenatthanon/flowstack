## ADDED Requirements

### Requirement: Platform Script เป็นข้อความพร้อมโพสต์
prompt ของ `generate-article` (ทั้งคอนเทนต์วิดีโอและบทความ) SHALL สั่งให้ AI เขียน `scripts[platform]` ของทุก platform ที่เลือกเป็น**ข้อความพร้อมโพสต์ลง platform นั้นทันที** — SHALL ไม่มีคำกำกับต้นบรรทัด (เช่น `Post caption:`, `CTA:`, `Hook 3 วิ:`, `Scene 1:`, `Intro:`) และ SHALL ไม่มีบรรทัดพาดหัว/ชื่อเรื่อง (ระบบเติมหัวข้อให้เอง) — ตัวอย่างใน schema ที่ส่งให้ AI SHALL ไม่มีคำกำกับเช่นกัน

รูปแบบต่อ platform:
- `tiktok`: แคปชั่นสั้น ดึงความสนใจ พร้อม hashtag (≤ 2,200 ตัวอักษร) — SHALL ไม่เป็นบทวิดีโอ/บทพูดแยกฉาก
- `youtube`: คำอธิบายคลิป (สรุปเนื้อหา + CTA) — SHALL ไม่เป็นบทวิดีโอ
- `facebook`, `instagram`, `lineoa`, `linkedin`: ข้อความโพสต์ตามลักษณะ platform
- `twitter`: ข้อความสั้นที่รวมกับหัวข้อแล้วไม่เกิน 280 ตัวอักษร

#### Scenario: คอนเทนต์วิดีโอเลือก TikTok
- **WHEN** ผู้ใช้สร้างคอนเทนต์วิดีโอที่เลือก tiktok และ facebook
- **THEN** `scripts.tiktok` SHALL เป็นแคปชั่นพร้อม hashtag ที่ไม่มีบรรทัด `Scene N:` หรือ `Hook:`
- **AND** `scripts.facebook` SHALL ไม่ขึ้นต้นด้วย `Post caption:`

#### Scenario: schema ที่ส่งให้ AI
- **WHEN** ระบบประกอบ prompt ของ `generate-article`
- **THEN** ตัวอย่างค่าของ `scripts` ใน schema SHALL ไม่มีคำกำกับต้นบรรทัด
