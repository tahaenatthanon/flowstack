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

### Requirement: Research settings have Thai defaults
ระบบ SHALL ใช้ค่าเริ่มต้น provider `none`, location `2764`, language `th` และ cache `168` ชั่วโมง

#### Scenario: New tenant has no Research configuration
- **WHEN** อ่าน settings ของ tenant ที่ยังไม่ตั้งค่า
- **THEN** ระบบคืนค่า default ดังกล่าวและระบุว่ายังไม่มี key

### Requirement: Research settings are editable without affecting AI settings
ระบบ SHALL ให้แก้ Research settings ผ่าน settings API และ SHALL ไม่เปลี่ยนค่า AI provider/model settings เดิม

#### Scenario: Research settings are updated
- **WHEN** ผู้ดูแลแก้ location หรือ cache hours
- **THEN** ค่า Research เปลี่ยนเฉพาะ Research settings และค่า AI settings คงเดิม
