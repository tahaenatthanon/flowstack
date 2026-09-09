## Purpose

กำหนดว่า Platform Script (ต่อ platform ที่ผู้ใช้เลือกใน Direct Content Generation) ประกอบด้วย Script + Script Sections เท่านั้น — ไม่มี SEO/AEO ของตัวเอง ไม่ถูกประเมิน/ซ่อม/บล็อกการเผยแพร่ด้วยเกณฑ์ SEO/AEO แยกต่อ platform โดย SEO/AEO ของ Content มีอยู่เพียงชุดเดียวที่ระดับ Article/Core Content เท่านั้น

## Requirements

### Requirement: Platform Script generation SHALL NOT include SEO/AEO
เมื่อระบบสร้าง Platform Script (ต่อ platform ที่ผู้ใช้เลือก) ใน `generate-article` ระบบ SHALL ไม่ส่งคำสั่งหรือ schema ที่ให้ AI สร้าง SEO/AEO สำหรับ Script นั้น โดย Script ยัง SHALL ถูกสร้างตามข้อกำหนดเฉพาะของแต่ละ platform (รูปแบบ/ความยาว/Platform-specific requirements) เหมือนเดิม

#### Scenario: สร้าง Content แบบ Direct พร้อม Platform Script
- **WHEN** ผู้ใช้เลือก platform (เช่น TikTok, Facebook) และกดสร้างคอนเทนต์
- **THEN** ผลลัพธ์ `scripts[platform]` มีเนื้อหา script ของ platform นั้น
- **AND** ไม่มี key `seo` หรือ `aeo` (หรือเทียบเท่า) ซ้อนอยู่ภายใต้ script ของ platform นั้น

#### Scenario: เลือกหลาย platform ไม่สร้าง SEO/AEO ซ้ำต่อ platform
- **WHEN** ผู้ใช้เลือก 3 platform ขึ้นไปในการสร้างคอนเทนต์เดียว
- **THEN** แต่ละ platform มี script เป็นของตัวเอง
- **AND** ไม่มี platform ใดมี SEO/AEO เป็นของตัวเอง

### Requirement: Platform Script SHALL NOT be evaluated or repaired against SEO/AEO criteria
ระบบ SHALL ไม่ประเมิน Platform Script ด้วยเกณฑ์ SEO/AEO (คะแนน, required rules, gate status) และ SHALL ไม่ส่ง Script กลับไปให้ AI แก้ไข (repair) เพียงเพราะ SEO/AEO ไม่ผ่าน

#### Scenario: generate-article ไม่มี Script SEO/AEO repair loop
- **WHEN** `generate-article` สร้าง Script สำหรับ platform ที่เลือกเสร็จ
- **THEN** ระบบไม่เรียกการประเมิน Script SEO หรือ Script AEO ใดๆ
- **AND** ไม่มีการเรียก AI ซ้ำเพื่อ "ซ่อม" Script ด้วยเหตุผลเรื่อง SEO/AEO

#### Scenario: Script สั้นหรือไม่มี keyword ก็ยังถูกยอมรับ
- **WHEN** Script ที่สร้างมีความยาวสั้นหรือไม่มี primary keyword ปรากฏ
- **THEN** ระบบยังคงบันทึก Script นั้นได้ตามปกติ โดยไม่ถือเป็นข้อผิดพลาดด้าน SEO/AEO ของ Script

### Requirement: Publish Gate SHALL NOT block on Script SEO/AEO
ทุกเส้นทางเผยแพร่ (ส่งทันที, ตั้งเวลา, cron auto-publish) SHALL ไม่ใช้คะแนนหรือสถานะ SEO/AEO ของ Platform Script เป็นเงื่อนไขในการอนุญาตหรือบล็อกการเผยแพร่ โดย Approval gate (`approved_at`) และ Article SEO/AEO gate (สำหรับ web platform) ยัง SHALL ทำงานตามเดิม

#### Scenario: ส่งทันทีด้วย Script ที่ SEO/AEO ต่ำ (ตามเกณฑ์เดิม)
- **GIVEN** Content ผ่าน Approval gate แล้ว และเลือก platform ที่เป็น script/social platform
- **WHEN** ผู้ใช้กด "ส่งทันที"
- **THEN** ระบบไม่ปฏิเสธการเผยแพร่ด้วยเหตุผลเกี่ยวกับ Script SEO หรือ Script AEO

#### Scenario: ตั้งเวลาและ cron auto-publish
- **GIVEN** Content ที่ตั้งเวลาเผยแพร่ไว้ล่วงหน้าสำหรับ script/social platform
- **WHEN** cron dispatch เนื้อหาตามเวลาที่ตั้งไว้
- **THEN** ระบบไม่ปฏิเสธหรือ mark เป็น failed ด้วยเหตุผลเกี่ยวกับ Script SEO/AEO gate

#### Scenario: Gate อื่นยังทำงานตามเดิม
- **GIVEN** Content ที่ยังไม่ผ่าน Approval (`approved_at IS NULL`) หรือเป็น web platform ที่ Article SEO/AEO ยังไม่ผ่าน
- **WHEN** ผู้ใช้พยายามเผยแพร่
- **THEN** ระบบยังคงปฏิเสธตาม Approval gate หรือ Article SEO/AEO gate ตามเดิม (ไม่เกี่ยวกับการเปลี่ยนแปลงนี้)

### Requirement: UI SHALL NOT display Script SEO/AEO information
หน้าจอที่แสดง Platform Script (เช่น Content Card / Content Detail) SHALL ไม่แสดงคะแนน, checklist, หรือสถานะผ่าน/ไม่ผ่านของ SEO/AEO สำหรับ Script แต่ SHALL ยังแสดง Script, Script Sections, ภาพประกอบ และ Hashtags ตามเดิม

#### Scenario: เปิดดู Platform Script ใน Content Card
- **WHEN** ผู้ใช้เปิดดูรายละเอียด Platform Script ของ Content
- **THEN** ไม่มีองค์ประกอบ UI ที่แสดง "SEO: X/100", "AEO: X/100" หรือ checklist ของ Script
- **AND** ยังเห็น Script เต็ม, Script Sections, ภาพประกอบ และ Hashtags ของ platform นั้น

### Requirement: Article/Core Content SEO/AEO SHALL remain the single set per Content
SEO/AEO SHALL ยังคงมีอยู่เพียงชุดเดียวต่อ Content ที่ระดับ Article/Core Content ไม่ว่าจะเลือก platform กี่รายการ และ SHALL generate/display/edit/validate/save ได้ตามระบบเดิมโดยไม่ถูกกระทบจากการเปลี่ยนแปลงนี้

#### Scenario: เลือกหลาย platform ยังมี Article SEO/AEO ชุดเดียว
- **WHEN** ผู้ใช้เลือก 1 หรือหลาย platform แล้วสร้างคอนเทนต์
- **THEN** Content มี Article SEO/AEO (seo_title, meta_description, slug, meta_keywords, structured_data) เพียง 1 ชุด
- **AND** จำนวน platform ที่เลือกไม่ทำให้เกิด Article SEO/AEO ชุดเพิ่ม

### Requirement: Visuals and Hashtags count SHALL fit the content, not a fixed number
ระบบ SHALL ยังคงสร้างภาพประกอบและ Hashtags ให้ Content เสมอ โดยจำนวน SHALL เหมาะสมกับเนื้อหาของแต่ละครั้ง ไม่ SHALL บังคับจำนวนตายตัว

#### Scenario: จำนวนภาพประกอบ/Hashtags ไม่ถูกกำหนดตายตัว
- **WHEN** ระบบสร้าง Content ใหม่
- **THEN** `visuals` และ `hashtags` มีอย่างน้อย 1 รายการ
- **AND** ไม่มี validation ใดบังคับให้ต้องมีจำนวนเท่ากับค่าคงที่ที่กำหนดไว้ล่วงหน้า
