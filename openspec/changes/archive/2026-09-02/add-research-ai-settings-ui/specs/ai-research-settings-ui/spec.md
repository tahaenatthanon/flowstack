# ai-research-settings-ui Specification

## Purpose

กำหนด contract ของ UI และ settings สำหรับเลือก Research AI เป็น provider — dropdown มีตัวเลือก `ai`, ฟิลด์ login/password/location ถูกซ่อนเมื่อเลือก `ai`, backend ยอมรับ `research_provider='ai'`, ปุ่มทดสอบทำงานโดยไม่เปิดเผย credential และ settings เดิม (DataForSEO) ยังอยู่ครบ

## ADDED Requirements

### Requirement: Provider dropdown includes the AI option
หน้า Research settings SHALL มีตัวเลือก `ai` (AI web search) ใน dropdown ผู้ให้บริการ ควบคู่กับ `none` และ `dataforseo`

#### Scenario: Admin selects AI provider
- **WHEN** ผู้ดูแลเปิด dropdown ผู้ให้บริการ
- **THEN** มีตัวเลือก `AI (Perplexity/Sonar)` ค่า `ai` และผู้ดูแลเลือกได้

### Requirement: AI provider hides irrelevant fields
เมื่อ provider เป็น `ai` หน้า settings SHALL ซ่อนหรือ disable ฟิลด์ login, password และ location_code และ SHALL คงแสดง language_code และ cache_hours ที่ใช้จริงใน flow `ai`

#### Scenario: AI provider is selected
- **WHEN** ผู้ดูแลเลือก provider `ai`
- **THEN** ฟิลด์ login, password, location_code ไม่แสดงหรือถูก disable ขณะที่ language และ cache hours ยังแสดงและแก้ได้

### Requirement: DataForSEO behavior is unchanged
เมื่อ provider เป็น `dataforseo` หน้า settings SHALL คงแสดงฟิลด์ login, password, location, language, cache hours และปุ่มทดสอบเช่นเดิม

#### Scenario: DataForSEO provider is selected
- **WHEN** ผู้ดูแลเลือก provider `dataforseo`
- **THEN** ทุกฟิลด์เดิมแสดงครบและปุ่มทดสอบทำงานตามกฎ credential เดิม

### Requirement: Backend accepts the AI provider value
settings API (`brand-content.php?action=global-settings`) SHALL ยอมรับ `research_provider` เป็น `ai` และ SHALL เก็บค่าลง `content_global_settings.research_provider` โดยไม่เพิ่ม field ใหม่

#### Scenario: Admin saves AI provider
- **WHEN** ผู้ดูแลบันทึก `research_provider='ai'`
- **THEN** ค่า `ai` ถูกบันทึกและกลับมาอ่านได้ในการโหลด settings ครั้งถัดไป

### Requirement: Test connection works without DataForSEO credentials for AI
ปุ่มทดสอบการเชื่อมต่อ SHALL เรียก `content-research.php?action=test` ด้วย provider `ai` โดยไม่ต้องกรอก login/password และ SHALL แสดงผลสำเร็จ/ล้มเหลวเป็นภาษาไทยโดยไม่เปิดเผย credential

#### Scenario: AI test succeeds
- **WHEN** provider `ai` พร้อมใช้ (credential + model ยืนยันแล้ว) และผู้ดูแลกดทดสอบ
- **THEN** ระบบแสดงข้อความเชื่อมต่อสำเร็จ โดยไม่มี balance (AI ไม่มี balance) และไม่มี credential หลุด

#### Scenario: AI test fails
- **WHEN** credential ของ Research AI ไม่พร้อม
- **THEN** ระบบแสดงข้อความภาษาไทยว่าเชื่อมต่อไม่สำเร็จโดยไม่เปิดเผย key

### Requirement: Existing DataForSEO settings are preserved
ระบบ SHALL ไม่ลบหรือล้างค่า login, password, location_code เมื่อสลับ provider เป็น `ai` และ SHALL คงค่าไว้เพื่อกลับมาใช้เมื่อสลับกลับเป็น `dataforseo`

#### Scenario: Switch to AI then back to DataForSEO
- **WHEN** ผู้ดูแลสลับ provider `dataforseo` → `ai` → `dataforseo`
- **THEN** ค่า login/password/location เดิมยังอยู่ครบและใช้ได้
