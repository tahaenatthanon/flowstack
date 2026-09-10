## ADDED Requirements

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
