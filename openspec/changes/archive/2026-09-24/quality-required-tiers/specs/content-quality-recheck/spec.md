## MODIFIED Requirements

### Requirement: endpoint quality-recheck ประเมิน Quality โดยไม่ generate เนื้อหาใหม่
ระบบ SHALL มี endpoint `POST /api/brand-content.php?action=quality-recheck` ที่รับ `item_id` ของ `content_items` ที่เป็นของ tenant ปัจจุบัน
- ประเมิน SEO ด้วย `seo_evaluate()` และ AEO ด้วย `aeo_evaluate()` จากเนื้อหาที่บันทึกล่าสุดใน `content_items`
- คืน `gate` ของแต่ละชุด และ `failed_required` ตาม `quality_required_status()` (ตัดสินจาก Required rule)
- SHALL ไม่เรียก AI เพื่อสร้างหรือแก้ไขเนื้อหาใดๆ

#### Scenario: ประเมินสำเร็จโดยไม่แก้เนื้อหา
- **WHEN** ผู้ใช้เรียก `?action=quality-recheck` ด้วย `item_id` ที่ถูกต้องและเป็นของ tenant
- **THEN** ระบบคืนคะแนน กฎ และ gate ของทั้ง SEO และ AEO จากเนื้อหาที่บันทึกล่าสุด พร้อม `failed_required`
- **AND** `content_items.article_content` (นอกเหนือจาก `quality_checked_at`) ไม่ถูกแก้ไข

#### Scenario: item_id ไม่พบหรือไม่ใช่ของ tenant
- **WHEN** เรียก `?action=quality-recheck` ด้วย `item_id` ที่ไม่มีอยู่หรือเป็นของ tenant อื่น
- **THEN** ระบบตอบ HTTP error โดยไม่เปิดเผยข้อมูลของ tenant อื่น

### Requirement: quality-recheck เซ็ต quality_checked_at โดยไม่ขึ้นกับผลผ่าน/ไม่ผ่าน
เมื่อประเมินเสร็จ ระบบ SHALL เซ็ต `content_items.article_content.quality_checked_at = NOW()` เสมอ ไม่ว่าผล SEO/AEO จะผ่านหรือไม่ และ SHALL ไม่แก้ไข key อื่นใดใน `article_content`
- marker นี้หมายถึง "ตรวจเวอร์ชันนี้แล้ว" ไม่ได้หมายถึง "ผ่านแล้ว"
- การขออนุมัติและการเผยแพร่ SHALL ประเมินใหม่ด้วย Quality Gate กลางทุกครั้ง ไม่ใช้ผลของการ recheck เป็นตัวตัดสิน

#### Scenario: ผลไม่ผ่านก็ยังเซ็ต marker
- **WHEN** ผลประเมินมี required rule เป็น `failed`
- **THEN** `quality_checked_at` ยังคงถูกเซ็ตเป็นเวลาปัจจุบัน
- **AND** publish gate สำหรับแพลตฟอร์ม social/script (เช่น facebook) ไม่ถูกบล็อกด้วยเหตุ marker ว่างอีกต่อไป

#### Scenario: web platform ที่เปิด SEO gate ยังถูกบล็อกตามผลจริง
- **GIVEN** `seo_gate_enabled = 1` และคอนเทนต์เลือกแพลตฟอร์ม wordpress
- **WHEN** กด quality-recheck แล้วยังมี Required rule `failed`
- **THEN** Quality Gate กลางยังคงบล็อกการขออนุมัติและการเผยแพร่ไปยัง wordpress แม้ `quality_checked_at` จะถูกเซ็ตแล้วก็ตาม

### Requirement: ปุ่ม "ตรวจ Quality" เรียก quality-recheck โดยไม่ generate เนื้อหาใหม่
`ContentCardDialog.tsx` SHALL มีปุ่ม **"ตรวจ SEO/AEO ใหม่"** ที่ footer ของ dialog เพียงปุ่มเดียว แยกจากปุ่ม "AI เขียนให้" ปุ่มนี้:
- เรียก `quality-recheck` เมื่อกด
- ใช้งานได้เฉพาะเมื่อคอนเทนต์ถูกบันทึกแล้ว (มี `content_items.id`) และไม่มีการแก้ไขที่ยังไม่บันทึก
- เมื่อมีการแก้ไขค้างอยู่ SHALL ถูก disable และแสดงข้อความ "บันทึกบทความก่อนตรวจ SEO/AEO"
- หลังเรียกสำเร็จ SHALL แสดงผลผ่าน/ไม่ผ่านพร้อมจำนวนข้อบังคับที่ติด และรีเฟรชแผงผลตรวจ

#### Scenario: กดปุ่มตรวจบนคอนเทนต์ที่บันทึกแล้ว
- **WHEN** ผู้ใช้เปิดคอนเทนต์ที่บันทึกแล้วและไม่มีการแก้ไขค้าง แล้วกด "ตรวจ SEO/AEO ใหม่"
- **THEN** ระบบเรียก `quality-recheck` และแสดงผลผ่าน/ไม่ผ่านพร้อมจำนวนข้อบังคับที่ติด
- **AND** ระบบไม่เรียก AI generate เนื้อหาใหม่

#### Scenario: มีการแก้ไขที่ยังไม่บันทึก
- **WHEN** ผู้ใช้แก้เนื้อหาบทความใน dialog แต่ยังไม่กดบันทึก
- **THEN** ปุ่ม "ตรวจ SEO/AEO ใหม่" ถูก disable และแสดงข้อความ "บันทึกบทความก่อนตรวจ SEO/AEO"

#### Scenario: บันทึกแล้วตรวจได้ทันที
- **WHEN** ผู้ใช้กดบันทึกสำเร็จหลังแก้บทความ
- **THEN** ปุ่ม "ตรวจ SEO/AEO ใหม่" กลับมาใช้งานได้ และการตรวจใช้เนื้อหาที่เพิ่งบันทึก

#### Scenario: คอนเทนต์ที่ยังไม่บันทึกไม่มีปุ่มให้กด
- **WHEN** ผู้ใช้เปิดกล่องสร้างคอนเทนต์ใหม่ที่ยังไม่มี `id`
- **THEN** ปุ่ม "ตรวจ SEO/AEO ใหม่" ถูก disable หรือไม่แสดง
