## ADDED Requirements

### Requirement: Research jobs are stored per tenant
ระบบ SHALL เก็บ Research job โดยมี tenant id, seed keyword, provider, location, language, status, raw response, analysis, cost และ timestamps ที่จำเป็นต่อการตรวจสอบย้อนหลัง

#### Scenario: A research job is created
- **WHEN** ระบบเริ่มบันทึก Research request
- **THEN** job มี tenant id และสถานะเริ่มต้น `pending` โดยไม่ใช้ค่า metric ปลอม

### Requirement: Research content linkage is nullable
ระบบ SHALL อนุญาตให้ Research job ไม่มี `content_item_id` และเมื่อ content item ถูกลบ ระบบ SHALL คง job ไว้โดยเปลี่ยนความสัมพันธ์เป็น `NULL`

#### Scenario: Linked content is deleted
- **WHEN** content item ที่ผูกกับ Research job ถูกลบ
- **THEN** Research job ยังคงอยู่และ `content_item_id` เป็น `NULL`

### Requirement: Research keywords preserve provider values
ระบบ SHALL เก็บ keyword metrics แยกจาก job และ SHALL เก็บค่าที่ provider ไม่ส่งเป็น `NULL` โดยไม่แปลงเป็น `0`

#### Scenario: Keyword has no search volume
- **WHEN** provider ไม่ส่ง search volume หรือ difficulty
- **THEN** แถว keyword เก็บ field นั้นเป็น `NULL`

### Requirement: Research job deletion cascades keywords
ระบบ SHALL ลบ keyword rows ที่เป็นของ job เมื่อ job ถูกลบ เพื่อไม่ให้เกิดข้อมูล keyword orphan

#### Scenario: A research job is deleted
- **WHEN** job ถูกลบ
- **THEN** keyword rows ที่มี `job_id` เดียวกันถูกลบตาม

### Requirement: Research schema is tenant-queryable
ตาราง Research SHALL มี index สำหรับค้นตาม tenant, creation time, content item และ cache identity เพื่อรองรับการแยก tenant และ reuse cache

#### Scenario: Cache lookup is performed
- **WHEN** ระบบค้น Research เดิมของ tenant เดียวกัน
- **THEN** query สามารถใช้ tenant, provider, location, language, seed keyword และ fetched time เป็นเงื่อนไขได้
