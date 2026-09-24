## MODIFIED Requirements

### Requirement: สร้างใหม่พร้อม feedback จนกว่า Required Rules ผ่าน
เมื่อผลประเมินหลังสร้าง (SEO และ AEO) มี Required rule ที่ `failed` ระบบ SHALL ส่ง feedback ให้ AI repair **1 รอบรวม SEO+AEO**
- feedback มีเฉพาะ Required rule ที่ `failed` แต่ละข้อระบุ `key`, `status`, `message`, `expected` (pass_condition จาก contract) และ `actual` (ค่าที่วัดได้ เมื่อมี) เพื่อให้ AI แก้เฉพาะจุด
- หลัง repair ระบบ SHALL ประเมินใหม่ครบทุกข้อทั้ง SEO และ AEO
- Recommended rule และ `needs_improvement` SHALL ไม่ถูกส่งเป็น feedback และ SHALL ไม่กระตุ้น repair

#### Scenario: feedback ระบุ expected และ actual
- **WHEN** required rule `meta_description` เป็น `failed` เพราะยาว 175 ตัวอักษร
- **THEN** feedback ต่อข้อมี `key`, `status`, `message`, `expected` (เช่น "ไม่ว่างและยาวไม่เกิน 160 ตัวอักษร") และ `actual` (เช่น "175 ตัวอักษร")

#### Scenario: required rule ล้มถูก repair
- **WHEN** ผลประเมินมี required rule `structured_data` เป็น `failed`
- **THEN** ระบบส่ง feedback ระบุ structured_data ต้องมี @context และ @type ให้ AI repair
- **AND** หลัง repair ประเมินใหม่ครบทุกข้อทั้ง SEO และ AEO

#### Scenario: recommended rule ไม่กระตุ้น repair
- **WHEN** ผลประเมินมี recommended rule `internal_linking` เป็น `needs_improvement` และ `content_gap` เป็น `failed` แต่ไม่มี required rule `failed`
- **THEN** ระบบไม่เรียก AI repair และถือว่า generation สำเร็จ

### Requirement: Final gate คืนรายการ required failures ชัดเจน
เมื่อ repair ครบ 1 รอบแล้วยังมี Required rule `failed` ระบบ SHALL คืน `failed_required` คู่กับ `generation_status='failed'` และ SHALL ไม่ถือว่า content สร้างสำเร็จ
- `failed_required` คือรายการ Required rule ของ SEO และ AEO ที่ `failed` แต่ละรายการมี `quality`, `key`, `message` และ `expected`
- ผู้ใช้ใช้รายการนี้แก้บทความเองได้

#### Scenario: generation ล้มเหลวคืน failed_required
- **WHEN** ระบบ repair ครบ 1 รอบแล้วยังมี required rule `failed`
- **THEN** response มี `failed_required` (รายการ required rule ที่ fail) และ `generation_status='failed'`
- **AND** content ถูกบันทึกด้วย `status='revision'`

### Requirement: pending ไม่กระตุ้นการสร้างใหม่
กฎ `pending`, `n/a` และ `needs_improvement` SHALL ไม่กระตุ้น repair และ SHALL ไม่ถูกนับเป็นเหตุให้ `seo_passed = false` โดยมีเพียง Required rule ที่ `failed` เท่านั้นที่กระตุ้น repair

#### Scenario: research ยังไม่มี (pending) ไม่สร้างใหม่
- **WHEN** ผลประเมินมีกฎ `search_intent` เป็น `pending` และไม่มี required rule `failed`
- **THEN** ระบบคืนเนื้อหาให้ผู้ใช้ทันทีโดยไม่สร้างใหม่
- **AND** `seo_passed = true`

#### Scenario: คีย์เวิร์ดรองไม่ปรากฏ (needs_improvement) ไม่สร้างใหม่
- **WHEN** ผลประเมินมีกฎ `related_keywords` เป็น `needs_improvement` และไม่มี required rule `failed`
- **THEN** ระบบไม่เรียก AI repair และ `seo_passed = true`

### Requirement: คืนผลประเมิน SEO ใน response ของ generate-article
`generate-article` SHALL คืนค่าต่อไปนี้คู่กับ `article`:
- `seo` ที่มี `score`, `gate` และ `rules`
- `aeo`
- `seo_passed` (boolean)
- `generation_status` (`success`|`failed`)

`seo_passed = true` และ `generation_status = 'success'` เมื่อ `quality_required_status()` เป็น `passed` ส่วน `false`/`'failed'` เมื่อเป็น `failed`

คอนเทนต์ `type = 'video'` SHALL ได้ `generation_status = 'success'` ด้าน quality เสมอ ผลประเมินยังคืนมาให้ดูเป็นข้อมูล

#### Scenario: คืนผลประเมินพร้อมเนื้อหาและสถานะ gate
- **WHEN** `generate-article` สร้างเนื้อหาเสร็จ
- **THEN** response มี `article`, `seo` (`score` + `gate` + `rules`), `seo_passed`, และ `generation_status`

#### Scenario: generation failed เมื่อ gate ไม่ผ่าน
- **WHEN** `quality_required_status()` คืน `failed` หลัง repair 1 รอบ
- **THEN** `seo_passed = false` และ `generation_status = 'failed'`

#### Scenario: generation success เมื่อ gate ผ่าน
- **WHEN** `quality_required_status()` คืน `passed`
- **THEN** `seo_passed = true` และ `generation_status = 'success'`

#### Scenario: วิดีโอไม่ถูกตัดสินด้วย SEO/AEO
- **WHEN** generate คอนเทนต์ `type = 'video'` และผล SEO มี Required failed
- **THEN** `generation_status = 'success'` และไม่มีการ repair หรือตั้ง `status = 'revision'` ด้วยเหตุผล SEO/AEO

### Requirement: ครบ max attempts แล้วไม่ผ่าน ให้ status=revision
เมื่อ repair ครบ 1 รอบแล้ว `quality_required_status()` ยังเป็น `failed` (และไม่ใช่วิดีโอ) ระบบ SHALL:
- บันทึก content พร้อม `status='revision'` โดยไม่ถือเป็นผลสำเร็จ
- ไม่ตั้ง `quality_checked_at`
- ไม่คืน content เป็นผลลัพธ์ที่ผ่าน SEO

ผู้ใช้ยังเห็นรายการ Required rule ที่ไม่ผ่าน เพื่อแก้เองแล้วบันทึกและกด "ตรวจ SEO/AEO ใหม่"

#### Scenario: ถึง max attempts แล้วไม่ผ่าน ถูกบันทึกเป็น revision
- **WHEN** ระบบ repair ครบ 1 รอบแล้วยังมี Required rule `failed`
- **THEN** content ถูกบันทึกด้วย `status='revision'`
- **AND** response มี `generation_status='failed'`, `seo_passed=false` และรายละเอียด rule ที่ยังไม่ผ่าน

### Requirement: "ตรวจ SEO ใหม่" ตรวจด้วยกฎ 15 ข้อชุดเดียวกับ Generation
การตรวจใหม่ SHALL มีจุดเดียวคือปุ่ม "ตรวจ SEO/AEO ใหม่" ที่เรียก `quality-recheck` การตรวจนี้:
- SHALL ใช้ SEO Evaluator และ AEO Evaluator ชุดเดียวกับ Generation (SEO ครบ 15 ข้อ)
- SHALL ตัดสินผลด้วย `quality_required_status()`
- SHALL ตรวจอย่างเดียว ไม่เปลี่ยน content อัตโนมัติ

แผงผลตรวจใน `ArticleEditor` SHALL ไม่มีปุ่มตรวจของตัวเอง และแสดงผลล่าสุดที่ได้รับเท่านั้น

#### Scenario: ตรวจ SEO/AEO ใหม่ด้วยกฎชุดเดียว
- **WHEN** ผู้ใช้กด "ตรวจ SEO/AEO ใหม่" บนคอนเทนต์ที่บันทึกแล้ว
- **THEN** ระบบโหลด content ที่บันทึกล่าสุด + research brief แล้วเรียก `seo_evaluate()` ครบ 15 ข้อ และ `aeo_evaluate()`
- **AND** ระบบแสดงคะแนนรวม, สถานะแต่ละข้อแยก Required/Recommended, รายละเอียดข้อที่ติด, และผลผ่าน/ไม่ผ่าน
- **AND** ระบบไม่ mutate content (ยกเว้น `quality_checked_at`)

#### Scenario: ArticleEditor ไม่มีปุ่มตรวจแยก
- **WHEN** ผู้ใช้เปิดแผงผลตรวจ SEO ใน `ArticleEditor`
- **THEN** ไม่มีปุ่ม "ตรวจ SEO" ในแผงนั้น

### Requirement: เพดานการสร้างใหม่จำกัดจำนวนรอบ
ระบบ SHALL จำกัดการ repair ด้าน quality ต่อคำขอ `generate-article` ไว้ที่ **1 รอบ** รวม SEO และ AEO ผ่านค่าคงที่ `QUALITY_REPAIR_MAX_ROUNDS = 1` ดังนั้นเรียก AI สร้างเนื้อหาได้ไม่เกิน 2 ครั้ง (สร้าง + repair)

เมื่อครบเพดานแล้วยังไม่ผ่าน ระบบ SHALL คืนเนื้อหาล่าสุดพร้อม `seo_passed = false` และผลประเมิน แทนการค้างหรือล้ม

#### Scenario: ถึงเพดานแล้วคืนเนื้อหาล่าสุด
- **WHEN** ระบบ repair ครบ 1 รอบแล้วยังมี Required rule `failed`
- **THEN** ระบบคืน `article` พร้อม `seo_passed = false` และผล `seo` ของรอบล่าสุด
- **AND** ระบบไม่เรียก AI เพิ่มเกินเพดาน

#### Scenario: ไม่เกิน 2 ครั้งต่อคำขอ
- **WHEN** generate บทความที่รอบแรกมี Required failed ทั้ง SEO และ AEO
- **THEN** ระบบเรียก AI สร้าง/แก้เนื้อหารวมไม่เกิน 2 ครั้ง
