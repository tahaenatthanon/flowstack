## ADDED Requirements

### Requirement: Research contract is tenant-safe
ระบบ SHALL กำหนด contract สำหรับ Research ที่ผูกกับ tenant จาก session/authenticated user และไม่ใช้ tenant id จาก request body เป็นตัวตัดสินสิทธิ์

#### Scenario: Authenticated tenant reads a research job
- **WHEN** ผู้ใช้เรียกดู Research job
- **THEN** ระบบค้นหา job ด้วย `tenant_id` ของผู้ใช้ร่วมกับ job id

#### Scenario: User requests another tenant's job
- **WHEN** job id มีอยู่แต่ `tenant_id` ไม่ตรงกับผู้ใช้
- **THEN** ระบบไม่คืนข้อมูล job และไม่เปิดเผยรายละเอียดของ tenant อื่น

### Requirement: Research settings do not expose secrets
ระบบ SHALL ส่งสถานะ credential เป็น `has_research_key` และ SHALL ไม่ส่งค่า login, password หรือ encrypted key ที่ใช้เชื่อมต่อ provider กลับไปยัง frontend

#### Scenario: Settings status is returned
- **WHEN** frontend ขอ Research settings status
- **THEN** response มี provider, location, language, cache hours และ `has_research_key` โดยไม่มี encrypted secret

### Requirement: Research data preserves unknown metrics
ระบบ SHALL ใช้ `null` สำหรับ metric ที่ provider ไม่ส่งมา และ SHALL แยกความหมายของ `null` ออกจากค่า `0`

#### Scenario: Provider omits search volume
- **WHEN** provider ไม่ส่ง search volume ของ keyword
- **THEN** keyword record มี `search_volume: null` และไม่ถูกแทนด้วยศูนย์

### Requirement: Research can be optional
ระบบ SHALL อนุญาตให้ content generation ดำเนินต่อได้เมื่อไม่มี Research job ที่เสร็จสมบูรณ์ และ SHALL ไม่สร้างข้อมูล Research ปลอมเพื่อเติมช่องว่าง

#### Scenario: Generation has no research job
- **WHEN** generation request ไม่มี Research job หรือ job ยังไม่อยู่สถานะ `done`
- **THEN** ระบบสร้าง content ได้โดยไม่เติม keyword metrics ที่ไม่มีแหล่งข้อมูลจริง

### Requirement: Research responses are traceable
ระบบ SHALL ระบุสถานะ cache และ metadata ที่จำเป็นต่อการตรวจสอบแหล่งข้อมูล Research ได้แก่ provider, location, language และเวลาที่ fetch สำเร็จ

#### Scenario: Cached research is returned
- **WHEN** ระบบคืนผลจาก cache
- **THEN** response ระบุ `cached: true` และยังคงแสดง metadata ของ job เดิม

### Requirement: Existing SEO and publish behavior remains the baseline
Phase นี้ SHALL ถือ behavior ที่แก้ไขแล้วของ SEO checklist, SEO gate, approval และ publish flow เป็น baseline และ SHALL ไม่เปลี่ยน behavior ดังกล่าวโดยไม่มี change แยก

#### Scenario: Readiness validation is performed
- **WHEN** ตรวจความพร้อมก่อนเริ่ม Research implementation
- **THEN** ผลตรวจยืนยัน first h1, pending rule, video rule set, per-platform script, approval gate และ tenant filter ตามโค้ดปัจจุบัน
