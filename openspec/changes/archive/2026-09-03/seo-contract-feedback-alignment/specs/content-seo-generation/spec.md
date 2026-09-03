## MODIFIED Requirements

### Requirement: สร้างใหม่พร้อม feedback จนกว่า Required Rules ผ่าน
เมื่อผล `seo_evaluate()` มี required rule ที่ `failed` ระบบ SHALL ส่ง feedback กลับให้ AI repair โดยแต่ละข้อระบุ `key`, `status`, `message`, `expected` (pass_condition จาก contract) และ `actual` (ค่าที่วัดได้เมื่อมี) เพื่อให้ AI แก้เฉพาะจุด แล้ว SHALL ประเมินใหม่ครบทั้ง 15 ข้อทุกครั้ง และทำซ้ำจนกว่า required rules ผ่าน (gate `passed`) หรือถึงจำนวน attempt สูงสุด

#### Scenario: feedback ระบุ expected และ actual
- **WHEN** required rule `meta_description` เป็น `failed`
- **THEN** feedback ต่อข้อมี `key`, `status`, `message`, `expected` (เช่น "120–160 ตัวอักษร") และ `actual` (เช่น "100 ตัวอักษร")

#### Scenario: required rule ล้มถูก repair
- **WHEN** ผลประเมินมี required rule `structured_data` เป็น `failed`
- **THEN** ระบบส่ง feedback ระบุ structured_data ต้องมี @context และ @type ให้ AI repair
- **AND** รอบถัดไปประเมินใหม่ครบทั้ง 15 ข้อ

### Requirement: Final gate คืนรายการ required failures ชัดเจน
เมื่อ AI repair จนครบจำนวน attempt สูงสุดแล้วยังมี required rule `failed` ระบบ SHALL คืน `failed_required` (รายการ required rule ที่ `failed` พร้อม `key`, `message`, `expected`) ใน response ควบคู่กับ `generation_status='failed'` และ SHALL ไม่ถือว่า content สร้างสำเร็จ

#### Scenario: generation ล้มเหลวคืน failed_required
- **WHEN** ระบบ repair ครบ max attempts แล้วยังมี required rule `failed`
- **THEN** response มี `failed_required` (รายการ required rule ที่ fail) และ `generation_status='failed'`
- **AND** content ถูกบันทึกด้วย `status='revision'`
