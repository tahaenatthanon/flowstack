## MODIFIED Requirements

### Requirement: สร้างใหม่พร้อม feedback จนกว่า SEO Quality Gate ผ่าน
เมื่อผล `seo_evaluate()` มี gate status ไม่ใช่ `passed` (มีกฎ `failed`/`needs_improvement` หรือ critical rule ล้ม) ระบบ SHALL สร้างเนื้อหาใหม่อีกครั้งโดยเพิ่ม feedback (ข้อความภาษาไทยของกฎที่ติด เรียงตามน้ำหนักมากไปน้อย) เข้าในคำขอ AI และ SHALL ประเมินใหม่ครบทั้ง 15 ข้อทุกครั้ง แล้วทำซ้ำจน gate status เป็น `passed` หรือถึงเพดานที่กำหนด

#### Scenario: meta_description นอกช่วงถูกสร้างใหม่
- **WHEN** ผลประเมินมีกฎ `meta_description` เป็น `failed`
- **THEN** ระบบสร้างเนื้อหาใหม่อีกครั้งพร้อม feedback ที่ระบุว่าคำอธิบาย meta ต้องยาว 120–160 ตัวอักษร
- **AND** รอบถัดไปประเมินใหม่ครบทั้ง 15 ข้อ

#### Scenario: critical rule ล้มถูกสร้างใหม่แม้คะแนนถึงเกณฑ์
- **WHEN** คะแนน ≥ 90 แต่ critical rule `structured_data` เป็น `failed`
- **THEN** ระบบสร้างใหม่อีกครั้งพร้อม feedback ระบุ structured_data ต้องมี @context และ @type

### Requirement: pending ไม่กระตุ้นการสร้างใหม่
กฎ `pending` SHALL ไม่กระตุ้นการสร้างเนื้อหาใหม่ และ SHALL ไม่ถูกนับเป็นเหตุให้ `seo_passed = false` ส่วน `needs_improvement` และ `failed` SHALL กระตุ้นการสร้างใหม่เมื่อ gate status ยังไม่ใช่ `passed`

#### Scenario: research ยังไม่มี (pending) ไม่สร้างใหม่
- **WHEN** ผลประเมินมีกฎ `search_intent` เป็น `pending` และไม่มีกฎ `failed`/`needs_improvement` อื่นที่ทำให้ gate ไม่ผ่าน
- **THEN** ระบบคืนเนื้อหาให้ผู้ใช้ทันทีโดยไม่สร้างใหม่
- **AND** `seo_passed = true`

#### Scenario: คีย์เวิร์ดรองไม่ปรากฏ (needs_improvement) ถูกสร้างใหม่
- **WHEN** ผลประเมินมีกฎ `related_keywords` เป็น `needs_improvement` ที่ทำให้ gate status ไม่ใช่ `passed`
- **THEN** ระบบสร้างใหม่อีกครั้งพร้อม feedback ระบุคีย์เวิร์ดรองที่ควรเพิ่ม

### Requirement: คืนผลประเมิน SEO ใน response ของ generate-article
`generate-article` SHALL คืน `seo` (มี `score`, `gate`, และ `rules`) และ `seo_passed` (boolean) ควบคู่กับ `article` โดย `seo_passed = true` เมื่อ `seo_gate_status()` คืน `passed` และ `false` เมื่อคืน `needs_improvement` หรือ `failed`

#### Scenario: คืนผลประเมินพร้อมเนื้อหาและสถานะ gate
- **WHEN** `generate-article` สร้างเนื้อหาเสร็จ
- **THEN** response มี `article`, `seo` (`score` + `gate` + `rules`), และ `seo_passed`

#### Scenario: seo_passed สะท้อน gate status
- **WHEN** `seo_gate_status()` คืน `needs_improvement` หรือ `failed`
- **THEN** `seo_passed = false`

#### Scenario: seo_passed เป็น true เมื่อ gate ผ่าน
- **WHEN** `seo_gate_status()` คืน `passed`
- **THEN** `seo_passed = true`

### Requirement: "ตรวจ SEO ใหม่" ตรวจด้วยกฎ 15 ข้อชุดเดียวกับ Generation
ปุ่ม/ฟังก์ชัน "ตรวจ SEO ใหม่" SHALL เรียกใช้ SEO Evaluator ชุดเดียวกับ Generation (ครบ 15 ข้อ) และ SHALL เป็น re-check อย่างเดียวโดยไม่เปลี่ยน content อัตโนมัติ

#### Scenario: ตรวจ SEO ใหม่ด้วยกฎชุดเดียว
- **WHEN** ผู้ใช้กด "ตรวจ SEO ใหม่"
- **THEN** ระบบโหลด content ปัจจุบัน + research brief แล้วเรียก `seo_evaluate()` ครบ 15 ข้อ
- **AND** ระบบแสดงคะแนนรวม, สถานะแต่ละข้อ (Passed/Needs Improvement/Failed), รายละเอียดข้อที่ติด, และ gate status ล่าสุด
- **AND** ระบบไม่ mutate content

### Requirement: เพดานการสร้างใหม่จำกัดจำนวนรอบ
ระบบ SHALL จำกัดจำนวนรอบสร้างใหม่ต่อคำขอ (ค่าคงที่ เช่น 3 รอบรวมรอบแรก) และเมื่อถึงเพดานแล้ว gate status ยังไม่ใช่ `passed` SHALL คืนเนื้อหาที่ดีที่สุดพร้อม `seo_passed = false` และผล `seo` ให้ผู้ใช้แทนการค้างหรือล้ม

#### Scenario: ถึงเพดานแล้วคืนเนื้อหาที่ดีที่สุด
- **WHEN** ระบบสร้างใหม่จนครบเพดานแล้ว gate status ยังไม่ใช่ `passed`
- **THEN** ระบบคืน `article` พร้อม `seo_passed = false` และผล `seo` ของรอบล่าสุด
- **AND** ระบบไม่เรียก AI เพิ่มเกินเพดาน
