## ADDED Requirements

### Requirement: Quick Create SHALL require confirmation before generating
เมื่อผู้ใช้กดปุ่ม "สร้างบทความ" หรือ "สร้างวีดีโอสคริปต์" ใน Quick Create ระบบ SHALL แสดงกล่องยืนยันสรุปหัวข้อ ประเภทเนื้อหา แพลตฟอร์มที่เลือก และสไตล์/รูปแบบที่ตั้งไว้ ก่อนเรียก AI generation จริง โดย SHALL ไม่เรียก `generate-plan` จนกว่าผู้ใช้จะกดยืนยัน

#### Scenario: ผู้ใช้กดยืนยันใน Quick Create
- **WHEN** ผู้ใช้กรอกฟอร์ม Quick Create ครบและกดปุ่ม "สร้างบทความ" หรือ "สร้างวีดีโอสคริปต์"
- **THEN** ระบบแสดงกล่องยืนยันสรุปหัวข้อ ประเภท แพลตฟอร์ม และสไตล์ที่เลือกไว้
- **AND** ระบบยังไม่เรียก `generate-plan` จนกว่าผู้ใช้จะกดปุ่มยืนยันในกล่อง

#### Scenario: ผู้ใช้กดยกเลิกที่กล่องยืนยันของ Quick Create
- **WHEN** กล่องยืนยันแสดงอยู่ และผู้ใช้กดปุ่มยกเลิก (หรือปิดกล่อง)
- **THEN** ระบบไม่เรียก `generate-plan` หรือ API สร้างเนื้อหาใดๆ
- **AND** ฟอร์ม Quick Create ยังอยู่ที่ step 'form' พร้อมค่าที่กรอกไว้เดิมครบถ้วน ให้แก้ไขต่อได้

#### Scenario: กล่องยืนยันของ Quick Create แสดงค่าตรงกับฟอร์ม
- **WHEN** ผู้ใช้เลือกประเภท "วีดีโอ" หัวข้อ "5 วิธีใช้ AI" และแพลตฟอร์ม TikTok, YouTube
- **THEN** ข้อความในกล่องยืนยัน SHALL ระบุหัวข้อ "5 วิธีใช้ AI" ประเภทวีดีโอสคริปต์ และแพลตฟอร์ม TikTok, YouTube ตรงกับที่เลือกไว้ในฟอร์ม

### Requirement: Content Planner AI panel SHALL require confirmation before generating a plan
เมื่อผู้ใช้กดปุ่ม "สร้างแผนด้วย AI" ใน Content Planner AI panel ระบบ SHALL แสดงกล่องยืนยันสรุปคำสั่ง/หัวข้อ ประเภทแผน ช่วงวันที่เริ่ม-สิ้นสุด และแพลตฟอร์มที่เลือก พร้อมข้อความแจ้งว่า AI จะเป็นผู้กำหนดจำนวนโพสต์เอง ก่อนเรียก `generate-plan` จริง โดย SHALL ไม่เรียก `generate-plan` จนกว่าผู้ใช้จะกดยืนยัน

#### Scenario: ผู้ใช้กดยืนยันใน Content Planner AI panel
- **WHEN** ผู้ใช้กรอกคำสั่ง/ประเภทแผน/ช่วงวันที่ในฟอร์ม AI สร้างแผน และกดปุ่ม "สร้างแผนด้วย AI"
- **THEN** ระบบแสดงกล่องยืนยันสรุปคำสั่ง ประเภทแผน ช่วงวันที่ และแพลตฟอร์มที่เลือก พร้อมข้อความว่า AI จะกำหนดจำนวนโพสต์เอง
- **AND** ระบบยังไม่เรียก `generate-plan` จนกว่าผู้ใช้จะกดปุ่มยืนยันในกล่อง

#### Scenario: ผู้ใช้กดยกเลิกที่กล่องยืนยันของ Content Planner AI panel
- **WHEN** กล่องยืนยันแสดงอยู่ และผู้ใช้กดปุ่มยกเลิก (หรือปิดกล่อง)
- **THEN** ระบบไม่เรียก `generate-plan` หรือ research ใดๆ
- **AND** ไม่มีการตั้งค่า `isGenerating`/`isGeneratingArticles` เป็น true และฟอร์มในpanel ยังอยู่กับค่าที่กรอกไว้เดิม

### Requirement: Confirmation SHALL NOT apply to entry points that already confirm or do not use AI
กล่องยืนยันก่อนสร้างตาม requirement นี้ SHALL จำกัดเฉพาะ Quick Create และ Content Planner AI panel เท่านั้น โดย SHALL ไม่เปลี่ยนพฤติกรรมของ `BatchGenerateDialog` (มีกล่องยืนยันของตัวเองอยู่แล้ว) และ SHALL ไม่เพิ่มกล่องยืนยันให้การบันทึกคอนเทนต์แบบมือใน `ContentCardDialog` (ไม่ใช้ AI generation)

#### Scenario: Batch generation ไม่เปลี่ยนพฤติกรรม
- **WHEN** ผู้ใช้ใช้งาน Batch สร้างคอนเทนต์ตามปกติ
- **THEN** กล่องยืนยันเดิมของ `BatchGenerateDialog` ยังทำงานเหมือนเดิมทุกประการ ไม่มีกล่องยืนยันซ้อนเพิ่ม

#### Scenario: บันทึกการ์ดคอนเทนต์ด้วยมือไม่มีกล่องยืนยันเพิ่ม
- **WHEN** ผู้ใช้กรอกและกดบันทึกการ์ดคอนเทนต์ใน `ContentCardDialog` (ไม่ผ่าน AI)
- **THEN** ระบบบันทึกทันทีโดยไม่มีกล่องยืนยันก่อนสร้างเพิ่มเติมจาก requirement นี้
