# AI Research End-to-End Verification

## Purpose

กำหนดเกณฑ์ตรวจสอบ end-to-end ของ Research ตั้งแต่การตั้งค่า provider ไปจนถึงการสร้างและเผยแพร่เนื้อหา โดยใช้ flow เดิมของระบบ และขยายให้ครอบคลุม provider `ai` (Research AI web search) ควบคู่กับ DataForSEO

## Requirements

### Requirement: AI Research is verified from settings through generation
ระบบ SHALL มีรอบตรวจ end-to-end ที่ยืนยันว่า Research settings, provider connection, fetch, cache, analyze และ content generation ทำงานต่อกันได้ใน flow คอนเทนต์เดิม สำหรับ provider ที่เปิดใช้งาน

#### Scenario: Research flow succeeds with the AI provider
- **WHEN** tenant เลือก provider `ai` และผู้ใช้ fetch seed keyword ภาษาไทย
- **THEN** Research job เป็น `done`, มี normalized keywords, มี SERP/PAA data, keyword มี metric ปริมาณเป็น `NULL` ทุกตัว และสามารถ analyze ต่อเป็น brief ได้

#### Scenario: Research flow succeeds with DataForSEO
- **WHEN** tenant มี DataForSEO settings ที่ถูกต้องและผู้ใช้ fetch seed keyword ภาษาไทย
- **THEN** Research job เป็น `done`, มี normalized keywords, มี SERP/PAA data, มี `cost_usd` และสามารถ analyze ต่อเป็น brief ได้

#### Scenario: Generated content uses analyzed research
- **WHEN** ผู้ใช้สร้าง content โดยใช้ Research flow และมี `research_job_id` ของ job ที่ analyze สำเร็จ
- **THEN** content generation ใช้ brief นั้น, เขียน SEO metadata จาก keyword จริง และบันทึก linkage กลับไปยัง Research job

### Requirement: AI provider test endpoint is verified
ระบบ SHALL ยืนยันว่า `action=test` ด้วย provider `ai` คืน `ok: true` เมื่อ credential + model พร้อมใช้ และคืน error ภาษาไทยเมื่อ credential ไม่พร้อม โดยไม่เปิดเผย credential

#### Scenario: AI test succeeds
- **WHEN** credential + model ของ Research AI พร้อมใช้และผู้ใช้เรียก `test` ด้วย provider `ai`
- **THEN** API คืน `ok: true` โดยไม่มี credential หลุด

#### Scenario: AI test fails when credential is missing
- **WHEN** credential ของ Research AI ไม่พร้อม
- **THEN** API คืนผลล้มเหลวพร้อมข้อความภาษาไทยโดยไม่เปิดเผย key

### Requirement: AI analyze uses the writing AI model
ระบบ SHALL ยืนยันว่า action `analyze` ยังใช้ Writing AI (`ai_research_chat`) ไม่ใช่ Research model และไม่ถอยหลัง

#### Scenario: Analyze uses the writing model
- **WHEN** ผู้ใช้ analyze job ที่ fetch สำเร็จด้วย provider `ai`
- **THEN** analysis ใช้ Writing AI และคืน brief JSON ครบ schema โดย primary keyword มาจาก keyword ที่ fetch มา

### Requirement: Mandatory Research is enforced
ระบบ SHALL ถือ Research เป็น Mandatory Internal Flow สำหรับ Normal Content Generation

#### Scenario: Generation without a usable Research job
- **WHEN** ผู้ใช้เรียก `generate-article` โดยไม่มี `research_job_id` และไม่มี Research Job ที่ตรง Topic และยังใช้งานได้
- **THEN** ระบบต้อง Reuse Research ที่ valid หรือ Fetch/Analyze ใหม่ตาม flow กลาง
- **AND** หากไม่สามารถสร้าง/Reuse Research ที่ valid ได้ ระบบต้องไม่ Generate Content

#### Scenario: Existing valid Research is reused
- **WHEN** มี Research Job ที่ตรง tenant, provider, location, language และ normalized source topic และยังอยู่ใน TTL
- **THEN** ระบบใช้ Job เดิมโดยไม่ Fetch provider ใหม่

### Requirement: SEO behavior remains compatible with Research
ระบบ SHALL ยืนยันว่า SEO checklist / gate ทำงานกับ Content ที่สร้างจาก Research โดยไม่ crash และใช้ metadata/body ปัจจุบัน

#### Scenario: SEO checklist reflects generated metadata
- **WHEN** content ถูกสร้างจาก Research brief แล้วผู้ใช้เรียก SEO checklist
- **THEN** checklist แสดงผลจาก metadata และ body ปัจจุบัน โดยรองรับ `pending`, `warn`, `fail`, `pass` และ `skip`

### Requirement: Research verification covers tenant safety and failure states
รอบตรวจ SHALL ครอบคลุม tenant isolation, invalid job, provider timeout/error และ cache behavior

#### Scenario: Cross-tenant research access is rejected
- **WHEN** ผู้ใช้เรียก job, analyze, fetch หรือ keyword-select ด้วย id ที่ไม่ใช่ของ tenant ตนเอง
- **THEN** API ปฏิเสธ request และไม่คืนข้อมูล Research ของ tenant อื่น

#### Scenario: AI provider failure creates failed job
- **WHEN** Research AI timeout หรือคืน error ระหว่าง fetch
- **THEN** job ถูกบันทึกเป็น `failed` พร้อม `error_msg` ภาษาไทย และ API ไม่คืนผลสำเร็จปลอม

#### Scenario: Cache prevents duplicate provider calls
- **WHEN** ผู้ใช้ fetch seed เดิมภายใน cache window โดยไม่ส่ง `force_refresh`
- **THEN** API คืน job เดิมพร้อม `cached: true` และไม่สร้าง provider call ใหม่

#### Scenario: Force refresh bypasses cache
- **WHEN** ผู้ใช้ส่ง `force_refresh: true` หรือ Research เดิมหมด TTL
- **THEN** ระบบ Fetch Research ใหม่

### Requirement: Research verification covers SEO approval and publish flow
รอบตรวจ SHALL ยืนยันว่า Content ที่สร้างด้วย Research ผ่านการตรวจ SEO/AEO, approval, schedule และ publish ด้วย endpoint เดิมโดยแสดงผลตามจริง

#### Scenario: Approval gate still protects publish
- **WHEN** ผู้ใช้ publish content ที่ยังไม่ผ่าน approval
- **THEN** ระบบบล็อก publish ตาม approval gate เดิมและไม่มี dispatch ออก channel

#### Scenario: Approved content can be scheduled or sent
- **WHEN** content ผ่าน approval และมี channel ที่พร้อมใช้งาน
- **THEN** schedule/send_now ทำงานผ่าน publish flow เดิม และ response รายงานสำเร็จ ข้าม หรือล้มเหลวตามผลจริงของแต่ละ channel

### Requirement: Verification scope matches Phase 2
Phase 2 verification SHALL ครอบคลุม Normal Content Generation entry points ที่อยู่ใน scope และ SHALL ไม่บังคับรวม Batch/Video หากไม่มี requirement ของ Phase 2 กำหนดไว้โดยตรง

#### Scenario: Normal entry points use the same Research flow
- **WHEN** ตรวจ Quick Create, Content Planner, Card Dialog, Detail View และ Content List
- **THEN** ทุกจุดต้องเข้า Fetch/Reuse → Analyze → Generate flow เดียวกัน และไม่ bypass Research

### Requirement: Verification must not introduce a separate pipeline module
Phase นี้ SHALL ไม่สร้าง route, menu, permission หรือหน้า wizard สำหรับ `/content-pipeline`

#### Scenario: No separate pipeline route is added
- **WHEN** ตรวจ source หลัง implement
- **THEN** ไม่พบ `ContentPipelinePage`, route `/content-pipeline`, menu item "สายการผลิตคอนเทนต์" หรือ permission `content_pipeline`
