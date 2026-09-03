## Purpose

กำหนด SEO Quality Gate สำหรับการสร้าง Content — สถานะ Pass/Warning/Failed จากคะแนนรวม (0–100) และ critical rules, การบังคับตรวจครบ 15 ข้อ, AI Repair loop ที่ตรวจใหม่ทั้งชุด, และการแสดงผลคะแนนรวม/รายข้อ

## Requirements

### Requirement: SEO Quality Gate กำหนดสถานะจากคะแนนรวมและ critical rules
ระบบ SHALL มีฟังก์ชัน `seo_gate_status(array $eval): string` ที่คืนสถานะ `passed`, `needs_improvement`, หรือ `failed` โดย gate ตัดสินจาก required rules เป็นหลัก — `failed` เมื่อมี required rule ใด `status = 'failed'` (ไม่ว่า score สูงแค่ไหน) หรือ score < 80; `needs_improvement` เมื่อ 80 ≤ score < 90 และไม่มี required failed; `passed` เมื่อ score ≥ 90 และไม่มี required failed — และ SEO Score (0–100) ใช้แสดงคุณภาพรวมเท่านั้น

#### Scenario: required failed แม้คะแนนสูงเป็น failed
- **WHEN** คะแนนรวม ≥ 90 แต่มี required rule `failed`
- **THEN** `seo_gate_status()` คืน `failed` และ generation ไม่ถือเป็น success

#### Scenario: n/a ไม่ทำให้ gate failed
- **WHEN** research rules มี `status = 'n/a'` (ปิด research) และไม่มี required rule อื่น `failed`
- **THEN** gate ไม่เป็น `failed` เพียงเพราะ research rules เป็น `n/a`

#### Scenario: optional rule ไม่ block
- **WHEN** optional rule เป็น `needs_improvement`/`failed` แต่ required rules ผ่านหมด
- **THEN** gate ไม่เป็น `failed` (optional แจ้งเตือนเท่านั้น)

### Requirement: แยก SEO Score ออกจาก SEO Gate
ระบบ SHALL แยกความหมายของ `score` (คะแนนคุณภาพรวม — informational สำหรับแสดงผล) ออกจาก `gate` (ตัวตัดสินว่า Content ผ่านข้อกำหนด) โดยการมีคะแนนสูง SHALL ไม่ทำให้ Content ผ่าน หากยังมี required rule ที่ `failed`

#### Scenario: คะแนนสูงแต่มี rule failed ไม่ถือว่าผ่าน
- **WHEN** คะแนนรวม ≥ 90 แต่มี required rule `failed`
- **THEN** gate เป็น `failed` แม้ score สูง และ generation ไม่ถือเป็น success

### Requirement: Rule tier กำหนดว่า rule ใด block generation
ระบบ SHALL กำหนด tier ของแต่ละ rule ผ่าน weight catalog — `required` (ไม่ผ่าน → generation ล้ม), `optional` (เตือนเท่านั้น), `informational` (แสดงคุณภาพเท่านั้น) — และ SHALL เปิดเผย tier นี้ให้ `seo_gate_status()` และ UI อ้างอิงชุดเดียวกัน

#### Scenario: tier อ่านได้จาก weight catalog
- **WHEN** ผู้เรียกอ่าน weight catalog ของระบบ
- **THEN** แต่ละ rule มี `tier` ระบุว่าเป็น required/optional/informational
- **AND** `critical` flag เดิม (alias) สอดคล้องกับ tier (required + กลุ่ม critical เดิม)

### Requirement: critical rules มีชุดที่กำหนดแน่นอน
ระบบ SHALL กำหนด critical rules เป็น {`seo_title`, `meta_description`, `h1`, `content_length`, `primary_keyword_placement`, `structured_data`} และ SHALL เปิดเผยชุดนี้ผ่านรายการน้ำหนัก (weight catalog) เพื่อให้ `seo_gate_status()` และ UI อ้างอิงชุดเดียวกัน

#### Scenario: critical flags อ่านได้จาก weight catalog
- **WHEN** ผู้เรียกอ่าน weight catalog ของระบบ
- **THEN** แต่ละข้อมี flag ระบุว่าเป็น critical หรือไม่ และชุด critical ประกอบด้วย 6 ข้อที่กำหนด

### Requirement: บังคับตรวจครบ 15 ข้อและห้ามข้าม
เมื่อสร้าง Content ระบบ SHALL ประเมินครบทั้ง 15 ข้อทุกครั้ง โดย SHALL ไม่ข้าม checklist และ SHALL ไม่ให้ AI เลือกตรวจเฉพาะบางข้อ และ SHALL ไม่ตั้งกฎใดเป็น `skip` เพียงเพราะเป็น Article หรือ Video

#### Scenario: ผลประเมินมี 15 rule object โดยไม่มี skip
- **WHEN** `seo_evaluate()` ถูกเรียกด้วย content ที่เป็น article หรือ video
- **THEN** ผลลัพธ์ `rules` มีครบทั้ง 15 key
- **AND** ไม่มี rule ใดมี `status = 'skip'`

### Requirement: AI Repair loop ตรวจใหม่ครบทั้ง 15 ข้อ
เมื่อ gate status ไม่ใช่ `passed` (มีข้อ `failed`/`needs_improvement` หรือ critical rule ล้ม) ระบบ SHALL ส่งกลับให้ AI ปรับปรุง แล้ว SHALL ประเมินใหม่ครบทั้ง 15 ข้อ (ไม่ตรวจเฉพาะข้อที่ติด) และ SHALL ทำซ้ำจน gate status เป็น `passed` หรือถึงจำนวน retry ที่กำหนด

#### Scenario: repair แล้วตรวจใหม่ทั้งชุด
- **WHEN** รอบแรก gate ไม่ใช่ `passed` และยังไม่ถึง retry cap
- **THEN** ระบบเรียก AI repair พร้อม feedback ของข้อที่ติด
- **AND** รอบถัดไปประเมินใหม่ครบทั้ง 15 ข้อ

#### Scenario: ถึง retry cap แล้วยังไม่ passed
- **WHEN** ระบบ repair จนครบ retry cap แล้ว gate status ยังไม่ใช่ `passed`
- **THEN** ระบบคืน content ที่ดีที่สุดพร้อม `seo_passed = false` และผลประเมินล่าสุด

### Requirement: แสดงผล SEO Score และคะแนนรายข้อ
ผลลัพธ์ SHALL แสดงคะแนนรวม (0–100) คะแนนของแต่ละ checklist สถานะ Passed/Needs Improvement/Failed รายละเอียดข้อที่ไม่ผ่าน ผลหลัง AI repair และสถานะสุดท้ายว่า Content ผ่านหรือไม่ผ่าน Quality Gate

#### Scenario: response คืนคะแนนรวมและคะแนนรายข้อ
- **WHEN** `generate-article` หรือ `?action=seo-checklist` คืนผล
- **THEN** response มี `score` (รวม) และ `rules` ที่แต่ละข้อมี `weight` และ `score` ของตัวเอง
- **AND** response มีสถานะ gate (`passed`/`needs_improvement`/`failed`)

#### Scenario: แสดงรายละเอียดข้อที่ไม่ผ่าน
- **WHEN** มีกฎที่มี `status = 'failed'` หรือ `needs_improvement`
- **THEN** response คืน message ภาษาไทยของแต่ละข้อที่ติด เพื่อให้ผู้ใช้เห็นรายละเอียด
