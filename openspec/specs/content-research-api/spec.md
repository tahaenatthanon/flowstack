# Content Research API

## Purpose

ให้ระบบค้นคว้าข้อมูลคำค้นและ SERP ต่อ tenant อย่างปลอดภัย พร้อมเก็บผลลัพธ์ที่ตรวจสอบย้อนหลังได้

## Requirements

### Requirement: Research API requires authentication and tenant scope
ทุก action ของ Research API SHALL เรียก `requireAuth()` และ SHALL ใช้ tenant id จาก authenticated user ในทุก query และ mutation

#### Scenario: Authenticated user fetches research
- **WHEN** ผู้ใช้เรียก Research API
- **THEN** ระบบประมวลผลเฉพาะข้อมูลของ tenant ผู้ใช้

#### Scenario: Unauthenticated request is sent
- **WHEN** request ไม่มี authentication ที่ถูกต้อง
- **THEN** ระบบปฏิเสธ request ก่อนเข้าถึงฐานข้อมูลหรือ provider

### Requirement: Research fetch supports cache
`fetch` SHALL reuse job สถานะ `done` ที่ตรงกับ tenant, provider, location, language, seed keyword และ cache window และ SHALL รองรับ `force_refresh`

#### Scenario: A valid cached job exists
- **WHEN** fetch seed เดิมภายใน cache window โดยไม่ส่ง force refresh
- **THEN** ระบบคืน job เดิมพร้อม `cached: true` และไม่เรียก provider

#### Scenario: Force refresh is requested
- **WHEN** ผู้ใช้ส่ง `force_refresh: true`
- **THEN** ระบบไม่ใช้ cached job และสร้างการ fetch ใหม่

### Requirement: Research fetch persists traceable results
`fetch` SHALL บันทึก job status, raw response, normalized keywords, fetched time และ cost และ SHALL คืนผลที่ frontend ใช้แสดงได้

#### Scenario: Fetch succeeds
- **WHEN** provider คืนข้อมูลสำเร็จ
- **THEN** job เป็น `done`, keywords ถูกบันทึก และ response มี job id, SERP, keywords, cache flag และ cost

### Requirement: Research failures are represented by failed jobs
เมื่อ provider ล้มเหลว ระบบ SHALL เปลี่ยน job เป็น `failed`, บันทึกข้อความผิดพลาดภาษาไทย และ SHALL ไม่รายงาน job เป็น `done`

#### Scenario: Fetch fails
- **WHEN** provider timeout หรือคืน error
- **THEN** job เป็น `failed` พร้อม `error_msg` และ API คืน HTTP error ที่เหมาะสม

### Requirement: Research job history is tenant-safe
API SHALL รองรับการอ่าน job เดี่ยวและรายการ job โดยกรอง tenant และรองรับการกรองด้วย `content_item_id` หรือ limit

#### Scenario: Job history is listed
- **WHEN** ผู้ใช้ขอรายการ job
- **THEN** ระบบคืนเฉพาะ job ของ tenant ผู้ใช้และเรียงตามเวลาสร้างล่าสุด

### Requirement: Keyword selection is persisted
API SHALL รองรับการเลือก keyword ของ job และ SHALL ตรวจว่า job อยู่ใน tenant เดียวกันก่อนแก้ `is_selected`

#### Scenario: Keywords are selected
- **WHEN** ผู้ใช้ส่งรายการ keyword ของ job ที่เป็นของ tenant ตนเอง
- **THEN** ระบบ reset selection ของ job นั้นและบันทึกเฉพาะรายการที่เลือก

### Requirement: Research API analyzes completed jobs
Research API SHALL มี action `analyze` ที่รับ Research job ของ tenant เดียวกันและสถานะ `done` แล้วคืน Research brief ที่บันทึกใน job

#### Scenario: Analyze request succeeds
- **WHEN** authenticated user เรียก `analyze` ด้วย job id ที่เป็นของ tenant และสถานะ `done`
- **THEN** API เรียก AI analysis และคืน job id, brief, source metadata และเวลาวิเคราะห์

#### Scenario: Analyze request is not allowed
- **WHEN** job id ไม่พบ, อยู่คนละ tenant หรือสถานะไม่ใช่ `done`
- **THEN** API คืน error ที่เหมาะสมและไม่ส่งข้อมูล job เข้า AI prompt
