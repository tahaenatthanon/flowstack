## ADDED Requirements

### Requirement: AI Research is verified from settings through generation
ระบบ SHALL มีรอบตรวจ end-to-end ที่ยืนยันว่า Research settings, DataForSEO connection, fetch, cache, analyze และ content generation ทำงานต่อกันได้ใน flow คอนเทนต์เดิม

#### Scenario: Research flow succeeds with configured provider
- **WHEN** tenant มี DataForSEO settings ที่ถูกต้องและผู้ใช้ fetch seed keyword ภาษาไทย
- **THEN** Research job เป็น `done`, มี normalized keywords, มี SERP/PAA data เมื่อ provider ส่งมา, มี `cost_usd`, และสามารถ analyze ต่อเป็น brief ได้

#### Scenario: Generated content uses analyzed research
- **WHEN** ผู้ใช้สร้าง content โดยส่ง `research_job_id` ของ job ที่ analyze สำเร็จ
- **THEN** content generation ใช้ brief นั้น, เขียน SEO metadata จาก keyword จริง และบันทึก linkage กลับไปยัง Research job

### Requirement: Research verification preserves legacy content generation
ระบบ SHALL ยืนยันว่า flow สร้างคอนเทนต์เดิมยังทำงานได้เมื่อไม่ใช้ Research และ SHALL ไม่สร้าง keyword หรือ metric ปลอม

#### Scenario: Content generation without research still works
- **WHEN** ผู้ใช้สร้าง content โดยไม่ส่ง `research_job_id`
- **THEN** ระบบใช้ brand context และ knowledge base เดิม, สร้าง content ได้ตามปกติ และ `meta_keywords` เป็นค่าว่างเมื่อไม่มี Research source

### Requirement: Research verification covers tenant safety and failure states
รอบตรวจ SHALL ครอบคลุม tenant isolation, invalid job, provider timeout/error และ cache behavior เพื่อยืนยันว่าไม่มีข้อมูลข้าม tenant และไม่มีผลสำเร็จปลอม

#### Scenario: Cross-tenant research access is rejected
- **WHEN** ผู้ใช้เรียก job, analyze, fetch หรือ keyword-select ด้วย id ที่ไม่ใช่ของ tenant ตนเอง
- **THEN** API ปฏิเสธ request และไม่คืนข้อมูล Research ของ tenant อื่น

#### Scenario: Provider failure creates failed job
- **WHEN** DataForSEO timeout หรือคืน error ระหว่าง fetch
- **THEN** job ถูกบันทึกเป็น `failed` พร้อม `error_msg` และ API คืน error ภาษาไทยที่เหมาะสม

#### Scenario: Cache prevents duplicate provider calls
- **WHEN** ผู้ใช้ fetch seed เดิมภายใน cache window โดยไม่ส่ง `force_refresh`
- **THEN** API คืน job เดิมพร้อม `cached: true` และไม่สร้าง provider call ใหม่

### Requirement: Research verification covers SEO approval and publish flow
รอบตรวจ SHALL ยืนยันว่า content ที่สร้างด้วย Research ผ่านการตรวจ SEO/AEO, approval, schedule และ publish ด้วย endpoint เดิมโดยแสดงผลตามจริง

#### Scenario: SEO checklist reflects generated metadata
- **WHEN** content ถูกสร้างจาก Research brief แล้วผู้ใช้เรียก SEO checklist
- **THEN** checklist แสดงผลจาก metadata และ body ปัจจุบัน โดยรองรับ `pending`, `warn`, `fail`, `pass` และ `skip`

#### Scenario: Approval gate still protects publish
- **WHEN** ผู้ใช้ publish content ที่ยังไม่ผ่าน approval
- **THEN** ระบบบล็อก publish ตาม approval gate เดิมและไม่มี dispatch ออก channel

#### Scenario: Approved content can be scheduled or sent
- **WHEN** content ผ่าน approval และมี channel ที่พร้อมใช้งาน
- **THEN** schedule/send_now ทำงานผ่าน publish flow เดิม และ response รายงานสำเร็จ ข้าม หรือล้มเหลวตามผลจริงของแต่ละ channel

### Requirement: Verification must not introduce a separate pipeline module
Phase นี้ SHALL ไม่สร้าง route, menu, permission หรือหน้า wizard สำหรับ `/content-pipeline`

#### Scenario: No separate pipeline route is added
- **WHEN** ตรวจ source หลัง implement
- **THEN** ไม่พบ `ContentPipelinePage`, route `/content-pipeline`, menu item "สายการผลิตคอนเทนต์" หรือ permission `content_pipeline`
