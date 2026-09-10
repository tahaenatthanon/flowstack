## Purpose

ผู้ใช้ต้องกดยืนยันในกล่องสรุปก่อนที่ระบบจะเริ่มเรียก AI generation จริง ครอบคลุมทั้ง Quick Create (สร้างเดี่ยว) และ Content Planner AI panel (สร้างแผน) — ป้องกันการกดพลาดที่เสียรอบ AI generation ไปฟรีๆ และให้ผู้ใช้ตรวจสอบหัวข้อ/แพลตฟอร์ม/ช่วงวันที่ก่อนยิงจริง

## Requirements

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

### Requirement: ContentCardDialog SHALL require confirmation before AI-writing content
เมื่อผู้ใช้กดปุ่ม "AI เขียนให้" ใน `ContentCardDialog` ระบบ SHALL แสดงกล่องยืนยันสรุปหัวข้อที่จะใช้เป็น Research seed และแพลตฟอร์มที่เลือกไว้ ก่อนเรียก `runResearch()` จริง โดย SHALL ไม่เรียก `runResearch()` จนกว่าผู้ใช้จะกดยืนยัน

#### Scenario: ผู้ใช้กดยืนยันในปุ่ม "AI เขียนให้"
- **WHEN** ผู้ใช้กรอกหัวข้อในฟอร์มและกดปุ่ม "AI เขียนให้"
- **THEN** ระบบแสดงกล่องยืนยันสรุปหัวข้อ (Research seed) และแพลตฟอร์มที่เลือกไว้
- **AND** ระบบยังไม่เรียก `runResearch()` จนกว่าผู้ใช้จะกดปุ่มยืนยันในกล่อง

#### Scenario: ผู้ใช้กดยกเลิกที่กล่องยืนยันของปุ่ม "AI เขียนให้"
- **WHEN** กล่องยืนยันแสดงอยู่ และผู้ใช้กดปุ่มยกเลิก (หรือปิดกล่อง)
- **THEN** ระบบไม่เรียก `runResearch()` หรือ API สร้างเนื้อหาใดๆ
- **AND** ฟอร์มยังอยู่กับค่าที่กรอกไว้เดิมครบถ้วน ให้แก้ไขต่อได้ และ `aiGenerating` ไม่ถูกตั้งเป็น `true`

#### Scenario: ข้อความในกล่องยืนยันใช้ Research seed เดียวกับที่ระบบจะใช้จริง
- **WHEN** `existingItem.source_topic` มีค่าต่างจาก `topic` ที่แก้ไขในฟอร์มปัจจุบัน
- **THEN** ข้อความในกล่องยืนยัน SHALL แสดงหัวข้อที่มาจาก `researchSeedTopic(existingItem.source_topic, topic)` เดียวกับที่ `handleAI` จะส่งเข้า `runResearch()` จริง ไม่ใช่ `topic` เฉยๆ

### Requirement: Confirmation for AI-write SHALL NOT apply to saving content manually
กล่องยืนยันตาม requirement นี้ SHALL จำกัดเฉพาะปุ่ม "AI เขียนให้" เท่านั้น โดย SHALL ไม่เพิ่มกล่องยืนยันให้ปุ่ม "บันทึก" ของ `ContentCardDialog` (ไม่ใช้ AI generation)

#### Scenario: บันทึกการ์ดคอนเทนต์ด้วยมือไม่มีกล่องยืนยันเพิ่ม
- **WHEN** ผู้ใช้กรอกและกดปุ่ม "บันทึก" ใน `ContentCardDialog`
- **THEN** ระบบบันทึกทันทีโดยไม่มีกล่องยืนยันก่อนบันทึกเพิ่มเติมจาก requirement นี้
