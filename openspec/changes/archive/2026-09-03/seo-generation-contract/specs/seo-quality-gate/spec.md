## MODIFIED Requirements

### Requirement: SEO Generation Gate ตัดสินจาก required rules (แยกจาก score)
ระบบ SHALL มีฟังก์ชัน `seo_gate_status(array $eval): string` ที่คืน `passed`, `needs_improvement` หรือ `failed` โดย gate ตัดสินจาก required rules เป็นหลัก — `failed` เมื่อมี required rule ใด `status = 'failed'` (ไม่ว่า score สูงแค่ไหน) หรือ score < 80; `needs_improvement` เมื่อ 80 ≤ score < 90 และไม่มี required failed; `passed` เมื่อ score ≥ 90 และไม่มี required failed — และ SEO Score (0–100) ใช้แสดงคุณภาพรวมเท่านั้น

#### Scenario: required failed แม้คะแนนสูงเป็น failed
- **WHEN** คะแนนรวม ≥ 90 แต่มี required rule `failed`
- **THEN** `seo_gate_status()` คืน `failed` และ generation ไม่ถือเป็น success

#### Scenario: n/a ไม่ทำให้ gate failed
- **WHEN** research rules มี `status = 'n/a'` (ปิด research) และไม่มี required rule อื่น `failed`
- **THEN** gate ไม่เป็น `failed` เพียงเพราะ research rules เป็น `n/a`

#### Scenario: optional rule ไม่ block
- **WHEN** optional rule เป็น `needs_improvement`/`failed` แต่ required rules ผ่านหมด
- **THEN** gate ไม่เป็น `failed` (optional แจ้งเตือนเท่านั้น)

### Requirement: Rule tier กำหนดว่า rule ใด block generation
ระบบ SHALL กำหนด tier ของแต่ละ rule ผ่าน weight catalog — `required` (ไม่ผ่าน → generation ล้ม), `optional` (เตือนเท่านั้น), `informational` (แสดงคุณภาพเท่านั้น) — และ SHALL เปิดเผย tier นี้ให้ `seo_gate_status()` และ UI อ้างอิงชุดเดียวกัน

#### Scenario: tier อ่านได้จาก weight catalog
- **WHEN** ผู้เรียกอ่าน weight catalog ของระบบ
- **THEN** แต่ละ rule มี `tier` ระบุว่าเป็น required/optional/informational
- **AND** `critical` flag เดิม (alias) สอดคล้องกับ tier (required + กลุ่ม critical เดิม)
