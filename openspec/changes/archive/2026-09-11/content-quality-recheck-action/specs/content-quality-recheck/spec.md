## ADDED Requirements

### Requirement: endpoint quality-recheck ประเมิน Quality โดยไม่ generate เนื้อหาใหม่
ระบบ SHALL มี endpoint `POST /api/brand-content.php?action=quality-recheck` ที่รับ `item_id` ของ `content_items` ที่เป็นของ tenant ปัจจุบัน ประเมิน SEO ด้วย `seo_evaluate()` และ AEO ด้วย `aeo_evaluate()` (ฟังก์ชันเดิม ไม่มีการเปลี่ยนเกณฑ์/น้ำหนัก) จากเนื้อหาที่บันทึกล่าสุดใน `content_items` และ SHALL ไม่เรียก AI เพื่อสร้างหรือแก้ไขเนื้อหาใด ๆ

#### Scenario: ประเมินสำเร็จโดยไม่แก้เนื้อหา
- **WHEN** ผู้ใช้เรียก `?action=quality-recheck` ด้วย `item_id` ที่ถูกต้องและเป็นของ tenant
- **THEN** ระบบคืนคะแนนและกฎของทั้ง SEO และ AEO จากเนื้อหาปัจจุบัน
- **AND** `content_items.article_content` (นอกเหนือจาก `quality_checked_at`) ไม่ถูกแก้ไข

#### Scenario: item_id ไม่พบหรือไม่ใช่ของ tenant
- **WHEN** เรียก `?action=quality-recheck` ด้วย `item_id` ที่ไม่มีอยู่หรือเป็นของ tenant อื่น
- **THEN** ระบบตอบ HTTP error โดยไม่เปิดเผยข้อมูลของ tenant อื่น

### Requirement: quality-recheck เซ็ต quality_checked_at โดยไม่ขึ้นกับผลผ่าน/ไม่ผ่าน
เมื่อประเมินเสร็จ ระบบ SHALL เซ็ต `content_items.article_content.quality_checked_at = NOW()` เสมอ ไม่ว่าผล SEO/AEO จะผ่านเกณฑ์หรือไม่ — สอดคล้องกับความหมายเดิมของ marker นี้ใน `generate-article` ที่บอกว่า "ประเมินแล้วบนเวอร์ชันนี้" ไม่ใช่ "ผ่านแล้ว" และ SHALL ไม่แก้ไข key อื่นใดใน `article_content`

#### Scenario: คะแนนไม่ผ่านเกณฑ์ก็ยังเซ็ต marker
- **WHEN** ผลประเมินมี required rule เป็น `failed`
- **THEN** `quality_checked_at` ยังคงถูกเซ็ตเป็นเวลาปัจจุบัน
- **AND** publish gate สำหรับแพลตฟอร์ม social/script (เช่น facebook) ไม่ถูกบล็อกด้วยเหตุ marker ว่างอีกต่อไป

#### Scenario: web platform ที่เปิด SEO gate ยังถูกบล็อกตามคะแนนจริง
- **GIVEN** `seo_gate_enabled = 1` และคอนเทนต์เลือกแพลตฟอร์ม wordpress
- **WHEN** กด quality-recheck แล้วผล SEO ยังไม่ผ่านเกณฑ์
- **THEN** `final_publish_gate_check()` ยังคงบล็อกการเผยแพร่ไปยัง wordpress ด้วยเหตุผล SEO gate เดิม แม้ `quality_checked_at` จะถูกเซ็ตแล้วก็ตาม

### Requirement: ปุ่ม "ตรวจ Quality" เรียก quality-recheck โดยไม่ generate เนื้อหาใหม่
`ContentCardDialog.tsx` SHALL มีปุ่มแยกต่างหากจากปุ่ม "AI เขียนให้" ที่เรียก `quality-recheck` เมื่อกด และ SHALL รีเฟรชสถานะ Quality/ปุ่มเผยแพร่ให้สะท้อนผลใหม่ทันทีหลังเรียกสำเร็จ โดย SHALL ใช้งานได้เฉพาะเมื่อคอนเทนต์นั้นถูกบันทึกแล้ว (มี `content_items.id`)

#### Scenario: กดปุ่มตรวจ Quality บนคอนเทนต์ที่บันทึกแล้ว
- **WHEN** ผู้ใช้เปิดคอนเทนต์ที่มีอยู่แล้วและกดปุ่ม "ตรวจ Quality"
- **THEN** ระบบเรียก `quality-recheck` และแสดงผลคะแนน/สถานะ gate ที่ได้กลับมา
- **AND** เมื่อสำเร็จ ปุ่ม "ส่งเลย"/"ขออนุมัติ" ที่เคยถูกบล็อกด้วยเหตุ "ยังไม่มีผล Quality" ใช้งานได้ตามเงื่อนไข gate อื่นที่เหลือ

#### Scenario: คอนเทนต์ที่ยังไม่บันทึกไม่มีปุ่มให้กด
- **WHEN** ผู้ใช้เปิดกล่องสร้างคอนเทนต์ใหม่ที่ยังไม่มี `id`
- **THEN** ปุ่ม "ตรวจ Quality" ถูก disable หรือไม่แสดง
