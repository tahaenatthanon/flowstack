# content-research-settings Specification

## Requirements

### Requirement: Research settings are tenant-scoped
ระบบ SHALL เก็บ provider, DataForSEO login, encrypted password, location, language และ cache hours แยกตาม tenant ใน `content_global_settings`

#### Scenario: Tenant saves Research settings
- **WHEN** ผู้ดูแลบันทึก Research settings
- **THEN** ระบบบันทึกค่าภายใต้ tenant ของผู้ดูแลเท่านั้น

### Requirement: Research password is encrypted at rest
ระบบ SHALL เข้ารหัส DataForSEO password ก่อนบันทึก และ SHALL ใช้ encryption helper/format เดียวกับ encrypted settings ที่มีอยู่

#### Scenario: A password is saved
- **WHEN** request มี DataForSEO password ใหม่
- **THEN** ฐานข้อมูลเก็บเฉพาะ encrypted value และไม่เก็บ plaintext password

### Requirement: Settings status does not expose secrets
ระบบ SHALL ไม่ส่ง `research_api_key_encrypted` หรือ password กลับ frontend และ SHALL ส่ง `has_research_key` แทน

#### Scenario: Settings are loaded
- **WHEN** frontend โหลด Research settings
- **THEN** response มีสถานะว่าตั้งค่า key แล้วหรือยัง แต่ไม่มี secret field

### Requirement: Research has a default provider
ระบบ SHALL ใช้ค่าเริ่มต้น provider `ai`, location `2764`, language `th` และ cache `168` ชั่วโมง

#### Scenario: New tenant has no Research configuration
- **WHEN** อ่าน settings ของ tenant ที่ยังไม่ตั้งค่า
- **THEN** ระบบคืนค่า default ดังกล่าวและระบุว่ายังไม่มี key

### Requirement: Research cache duration is configurable
ระบบ SHALL ให้ผู้ดูแลกำหนดอายุ Research Cache เป็นชั่วโมงในหน้า Settings ของ Research โดยค่าต้องอยู่ในช่วง 0-8760 ชั่วโมง

#### Scenario: Admin changes Research Cache duration
- **WHEN** ผู้ดูแลบันทึกค่า cache hours
- **THEN** ระบบบันทึกค่าเฉพาะ Research settings และใช้ค่านั้นตัดสินว่า Research Data ใดสามารถ Reuse ได้

### Requirement: Cache duration 0 means cache is disabled
ระบบ SHALL ตีความ `research_cache_hours = 0` ว่า "ปิด Research Cache — ห้าม Reuse Research เดิม ต้อง Fetch ใหม่ทุกครั้ง" และ SHALL ใช้ความหมายเดียวกันทั้งขั้น Fetch และขั้น Generate

#### Scenario: Cache is disabled and content is created
- **WHEN** `research_cache_hours = 0` และผู้ใช้สร้าง Content
- **THEN** ขั้น Fetch สร้าง Research job ใหม่เสมอโดยไม่ Reuse job เดิม และขั้น Generate ไม่ค้นหา Research job เดิมมาใช้แทน

#### Scenario: Cache is disabled and Research comes from the current run
- **WHEN** `research_cache_hours = 0` และขั้น Generate ได้รับ `research_job_id` ที่ Fetch มาในรอบเดียวกัน
- **THEN** ระบบยอมรับ job นั้นภายใน grace window ของรอบการทำงาน (fetch → analyze → generate) ซึ่งไม่ถือเป็นการ Reuse cache

### Requirement: Research settings are editable without affecting AI settings
ระบบ SHALL ให้แก้ Research settings ผ่าน settings API และ SHALL ไม่เปลี่ยนค่า AI provider/model settings เดิม

#### Scenario: Research settings are updated
- **WHEN** ผู้ดูแลแก้ location, language หรือ cache hours
- **THEN** ค่า Research เปลี่ยนเฉพาะ Research settings และค่า AI settings คงเดิม

### Requirement: Research is not a user-selectable generation option
ระบบ SHALL ไม่แสดงตัวเลือกเปิด/ปิด Research ใน Content Generation UI และ SHALL ถือ Research เป็น mandatory internal flow

#### Scenario: User creates content
- **WHEN** ผู้ใช้กรอก Topic และกดสร้าง Content
- **THEN** ระบบเริ่ม Research flow โดยอัตโนมัติ และผู้ใช้ไม่สามารถเลือก `ไม่ใช้ Research`
