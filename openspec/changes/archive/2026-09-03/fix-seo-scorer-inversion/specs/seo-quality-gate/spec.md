## MODIFIED Requirements

### Requirement: SEO Quality Gate กำหนดสถานะจากคะแนนรวมและ critical rules
ระบบ SHALL มีฟังก์ชัน `seo_gate_status(array $eval): string` ที่คืนสถานะ `passed`, `needs_improvement`, หรือ `failed` จากคะแนนรวมและ required/critical rules โดย gate เป็นตัวตัดสินว่า Content ผ่านข้อกำหนดสำหรับการสร้างหรือไม่ — `failed` เมื่อคะแนน < 80 หรือมี required/critical rule ใดมี `status = 'failed'`, `needs_improvement` เมื่อคะแนน 80–89 และไม่มี required/critical failed, และ `passed` เมื่อคะแนน ≥ 90 และไม่มี required/critical failed

#### Scenario: คะแนน ≥ 90 ไม่มี critical failed เป็น passed
- **WHEN** คะแนนรวม = 92 และไม่มี required/critical rule ที่ `failed`
- **THEN** `seo_gate_status()` คืน `passed`

#### Scenario: คะแนน 80–89 เป็น needs_improvement
- **WHEN** คะแนนรวม = 85 และไม่มี required/critical rule ที่ `failed`
- **THEN** `seo_gate_status()` คืน `needs_improvement`

#### Scenario: คะแนน < 80 เป็น failed
- **WHEN** คะแนนรวม = 74
- **THEN** `seo_gate_status()` คืน `failed`

#### Scenario: required/critical rule ล้มแม้คะแนนถึงเกณฑ์เป็น failed
- **WHEN** คะแนนรวม = 93 แต่มี required/critical rule ที่ `failed`
- **THEN** `seo_gate_status()` คืน `failed`

### Requirement: แยก SEO Score ออกจาก SEO Gate
ระบบ SHALL แยกความหมายของ `score` (คะแนนคุณภาพรวม — informational สำหรับแสดงผล) ออกจาก `gate` (ตัวตัดสินว่า Content ผ่านข้อกำหนด) โดยการมีคะแนนสูง SHALL ไม่ทำให้ Content ผ่าน หากยังมี required/critical rule ที่ `failed`

#### Scenario: คะแนนสูงแต่มี rule failed ไม่ถือว่าผ่าน
- **WHEN** คะแนนรวม ≥ 90 แต่มี required/critical rule `failed`
- **THEN** gate เป็น `failed` แม้ score สูง และ generation ไม่ถือเป็น success

### Requirement: critical rules มีชุดที่กำหนดแน่นอน
ระบบ SHALL กำหนด critical rules เป็น {`seo_title`, `meta_description`, `h1`, `content_length`, `primary_keyword_placement`, `structured_data`} และ SHALL เปิดเผยชุดนี้ผ่านรายการน้ำหนัก (weight catalog) เพื่อให้ `seo_gate_status()` และ UI อ้างอิงชุดเดียวกัน

#### Scenario: critical flags อ่านได้จาก weight catalog
- **WHEN** ผู้เรียกอ่าน weight catalog ของระบบ
- **THEN** แต่ละข้อมี flag ระบุว่าเป็น critical หรือไม่ และชุด critical ประกอบด้วย 6 ข้อที่กำหนด
