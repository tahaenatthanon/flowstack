## MODIFIED Requirements

### Requirement: สร้างใหม่พร้อม feedback จนกว่า Required Rules ผ่าน
เมื่อผล `seo_evaluate()` มี required rule ที่ `failed` ระบบ SHALL ส่ง feedback (รายละเอียดของ rule ที่ไม่ผ่าน เรียงตามน้ำหนัก) กลับให้ AI repair แล้ว SHALL ประเมินใหม่ครบทั้ง 15 ข้อทุกครั้ง และทำซ้ำจนกว่า required rules ผ่าน (gate `passed`) หรือถึงจำนวน attempt สูงสุด

#### Scenario: required rule ล้มถูก repair
- **WHEN** ผลประเมินมี required rule `structured_data` เป็น `failed`
- **THEN** ระบบส่ง feedback ระบุ structured_data ต้องมี @context และ @type ให้ AI repair
- **AND** รอบถัดไปประเมินใหม่ครบทั้ง 15 ข้อ

#### Scenario: optional rule ไม่กระตุ้น repair
- **WHEN** ผลประเมินมี optional rule `internal_linking` เป็น `needs_improvement` แต่ไม่มี required rule `failed`
- **THEN** ระบบไม่ถือว่า generation ล้มเหลวเพียงเพราะ optional rule (เตือนเท่านั้น)

### Requirement: ครบ max attempts แล้ว required ยังไม่ผ่าน ให้ status=revision
เมื่อ AI repair จนครบจำนวน attempt สูงสุดแล้วยังมี required rule `failed` ระบบ SHALL บันทึก content พร้อม `status='revision'` + คืน `generation_status='failed'` และ SHALL ไม่ถือว่า content สร้างสำเร็จหรือผ่าน SEO Quality Gate

#### Scenario: ถึง max attempts แล้ว required ยังไม่ผ่าน
- **WHEN** ระบบ repair ครบ max attempts แล้วยังมี required rule `failed`
- **THEN** content ถูกบันทึกด้วย `status='revision'` และ `generation_status='failed'`

### Requirement: Model ไม่ใช่ตัวรับประกัน SEO
ระบบ SHALL ให้ผู้ใช้เปลี่ยน model ตาม AI Settings ได้ แต่ gate SHALL ตัดสินโดย Evaluator ของระบบเท่านั้น — การเปลี่ยน model SHALL ไม่ถือเป็นการรับประกันว่า content ผ่าน SEO

#### Scenario: เปลี่ยน model ไม่กระทบ gate
- **WHEN** ผู้ใช้เปลี่ยน writing model ใน AI Settings
- **THEN** เกณฑ์ gate และการตรวจของ Evaluator ยังคงเหมือนเดิม และ model มีหน้าที่เพียง generate/repair content ตาม requirements
