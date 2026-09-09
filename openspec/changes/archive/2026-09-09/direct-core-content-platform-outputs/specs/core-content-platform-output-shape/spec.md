## ADDED Requirements

### Requirement: Platform selection SHALL NOT be restricted by Content Type
Direct Create (QuickCreateDialog) SHALL อนุญาตให้เลือก platform ใดก็ได้ ไม่ว่า Content Type จะตั้งเป็น Article หรือ Video โดย Content Type SHALL ใช้กำหนดวิธีเขียน Core Article เท่านั้น ไม่ใช้กรองรายชื่อ platform ที่เลือกได้

#### Scenario: เลือก Video พร้อม Website และ Facebook
- **WHEN** ผู้ใช้ตั้ง Content Type เป็น Video แล้วเลือก platform WordPress และ Facebook ร่วมกับ TikTok
- **THEN** ระบบอนุญาตให้เลือกทั้งสามได้ในการสร้างครั้งเดียว

#### Scenario: เลือก Article พร้อม TikTok
- **WHEN** ผู้ใช้ตั้ง Content Type เป็น Article แล้วเลือก TikTok
- **THEN** ระบบอนุญาตให้เลือกได้ (ไม่ถูกกรองออกเหมือนเดิม)

### Requirement: Script + Script Sections generation SHALL be derived from selected platform, not Content Type
ระบบ SHALL กำหนด platform ที่ต้องการ Script + Script Sections (TikTok, YouTube) ผ่านรายการกลาง (single source of truth) ที่ใช้ร่วมกันทั้ง backend และ frontend และ SHALL ไม่ใช้ Content Type (`$isVideo`) เป็นตัวตัดสินว่าจะขอ/แสดง Script Sections หรือไม่

#### Scenario: Content Type = Article แต่เลือก TikTok ร่วมด้วย
- **WHEN** ผู้ใช้ตั้ง Content Type เป็น Article และเลือก TikTok เป็นหนึ่งใน platform
- **THEN** ระบบขอ Script + Script Sections จาก AI สำหรับ TikTok เหมือนกับกรณี Content Type = Video

#### Scenario: Content Type = Video แต่ไม่มี platform วิดีโอถูกเลือก
- **WHEN** ผู้ใช้ตั้ง Content Type เป็น Video แต่เลือกเฉพาะ Facebook และ Website (ไม่มี TikTok/YouTube)
- **THEN** ระบบไม่ขอ Script Sections จาก AI และ Content Detail/Edit ไม่แสดงบล็อก Script Sections

#### Scenario: มี platform วิดีโอถูกเลือกอย่างน้อยหนึ่ง
- **WHEN** platform ที่เลือกมี TikTok หรือ YouTube อย่างน้อยหนึ่งรายการ
- **THEN** ระบบขอและแสดง Script Sections ตามปกติ

### Requirement: Core Article SHALL always have body content regardless of Content Type
ระบบ SHALL สร้างเนื้อหา Core Article (body ที่แปลงเป็น HTML ได้) เสมอไม่ว่า Content Type จะเป็น Article หรือ Video และ SHALL ไม่ใช้ script ของ platform ใดโดยเฉพาะ (เช่น Facebook) เป็นแหล่งเนื้อหาสำรองของ Core Article

#### Scenario: Content Type = Video ไม่ได้เลือก Facebook
- **WHEN** สร้าง Content แบบ Video โดยเลือก platform TikTok, YouTube, Instagram (ไม่มี Facebook)
- **THEN** Core Article ยังมีเนื้อหา body ที่ไม่ใช่ค่าว่างเปล่า (ไม่ได้มีแค่ title/excerpt)

#### Scenario: AI ไม่ส่ง field เนื้อหาบทความกลับมา
- **WHEN** AI ตอบกลับโดยไม่มี field เนื้อหา Core Article (เช่น `full_html`)
- **THEN** ระบบสร้าง fallback จาก `excerpt` และ `visuals`/scene description ของ Content นั้น แทนที่จะหยิบ script ของ platform ใดมาใช้

### Requirement: Batch generation SHALL NOT require UI changes for this capability
Batch (BatchGenerateDialog) ที่เลือก platform อิสระอยู่แล้วโดยไม่ผูกกับ Content Type SHALL ยังคงทำงานเหมือนเดิมและได้รับผลลัพธ์ที่ถูกต้องขึ้นจาก backend logic เดียวกัน โดยไม่ต้องแก้ไข UI ของ Batch

#### Scenario: Batch เลือก platform ผสมทั้งวิดีโอและไม่ใช่วิดีโอ
- **WHEN** หัวข้อใน Batch เลือก TikTok ร่วมกับ Facebook และ WordPress
- **THEN** ระบบสร้าง Script + Script Sections ให้เฉพาะ TikTok และ Core Article ยังมีเนื้อหาเสมอ โดยไม่ต้องแก้ไฟล์ BatchGenerateDialog.tsx
