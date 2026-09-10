## ADDED Requirements

### Requirement: ระบบ SHALL รองรับการยกเลิก AI generation ระหว่างกำลังทำงานในทุก entry point
เมื่อ AI generation กำลังทำงานอยู่ (research หรือ generate-article) ใน `QuickCreateDialog`, `BatchGenerateDialog`, `ContentPlannerAI` panel, หรือปุ่ม "AI เขียนให้" ของ `ContentCardDialog` ผู้ใช้ SHALL สามารถกดยกเลิกได้ โดยระบบ SHALL ตอบสนอง UI ทันที (ปิด progress/แสดงสถานะยกเลิกแล้ว) โดยไม่ต้องรอ step ที่กำลังรันอยู่เสร็จก่อน

#### Scenario: กดยกเลิกระหว่าง QuickCreateDialog กำลังสร้าง
- **WHEN** ผู้ใช้ยืนยันสร้างใน Quick Create แล้วอยู่ใน step 'progress' และกดปุ่ม/กลไกยกเลิก
- **THEN** UI ตอบสนองทันที (dialog ปิดหรือแสดงว่ายกเลิกแล้ว) โดยไม่ต้องรอ research step ปัจจุบันจบ

#### Scenario: กดยกเลิกระหว่าง BatchGenerateDialog กำลังสร้างหลายหัวข้อ
- **WHEN** ผู้ใช้อยู่ระหว่างกำลังสร้าง topic ที่ N จากทั้งหมด และกดยกเลิก
- **THEN** UI ตอบสนองทันที และ topic ที่ N+1 เป็นต้นไป SHALL ไม่ถูกเริ่มสร้างเลย

#### Scenario: กดยกเลิกระหว่าง Content Planner AI panel กำลังสร้างแผน
- **WHEN** ผู้ใช้อยู่ระหว่าง `isGenerating`/`isGeneratingArticles` และกดปุ่มยกเลิกที่เพิ่มเข้ามาใน panel
- **THEN** UI ตอบสนองทันที และ item ถัดไปในแผน SHALL ไม่ถูก research/generate ต่อ

#### Scenario: กดยกเลิกระหว่าง ContentCardDialog กำลังให้ AI เขียนเนื้อหา
- **WHEN** ผู้ใช้อยู่ระหว่าง `aiGenerating` (หลังกดยืนยัน "AI เขียนให้") และกดปุ่มยกเลิกที่เพิ่มเข้ามา
- **THEN** UI ตอบสนองทันที ปุ่มกลับสู่สถานะปกติ ไม่ต้องรอ research/generate จบ

### Requirement: Step ที่กำลังรันอยู่ ณ ขณะยกเลิก SHALL รันจนจบในเบื้องหลังโดยไม่แสดงผลต่อผู้ใช้
เนื่องจากข้อจำกัดทางสถาปัตยกรรม (PHP synchronous ไม่หยุดทำงานแค่ client ยกเลิก) step ที่กำลังรันอยู่ ณ ขณะกดยกเลิก SHALL ไม่ถูกตัดกลางคัน แต่ SHALL รันจนจบตามธรรมชาติ โดยผลลัพธ์ SHALL ไม่ถูกแสดงต่อผู้ใช้และ SHALL ถูกลบ/คืนค่าโดยอัตโนมัติหลังจากนั้น

#### Scenario: Research job ที่รันค้างอยู่ตอนยกเลิกยังคงเขียนผลลัพธ์ลง DB
- **WHEN** ผู้ใช้กดยกเลิกขณะ `content-research.php?action=fetch` หรือ `action=analyze` กำลังรันอยู่กับ provider ภายนอก
- **THEN** คำขอนั้น SHALL รันจนจบตามปกติ (ไม่ throw ทันทีที่ client ยกเลิก) และเขียนผลลัพธ์ลง `content_research_jobs` ตามปกติ
- **AND** ผลลัพธ์นั้น SHALL ไม่ปรากฏใน UI เพราะ dialog/panel ปิดไปแล้ว

### Requirement: Backend SHALL ตรวจสอบ cancel flag ก่อนเริ่มงานแต่ละ step เพื่อประหยัด credit เมื่อเป็นไปได้
`content-research.php` (action=fetch, analyze) และ `brand-content.php` (action=generate-article) SHALL ตรวจสอบ `content_items.cancel_requested` ของ item เป้าหมายก่อนเริ่มเรียก external provider/AI ทุกครั้ง หากถูกตั้งค่าไว้แล้ว SHALL ยกเลิก request ทันทีโดยไม่เรียก external call

#### Scenario: Cancel ระหว่าง fetch ทำให้ analyze ที่ยังไม่เริ่มไม่ถูกเรียก
- **WHEN** ผู้ใช้กดยกเลิกระหว่าง `action=fetch` กำลังรัน และ `cancel_requested` ถูกตั้งเป็น 1 ก่อนที่ `action=analyze` จะถูกเรียก
- **THEN** `action=analyze` SHALL ตรวจพบ flag และไม่เรียก AI/provider ภายนอกเลย

### Requirement: generate-article SHALL ตรวจสอบ cancel flag ก่อนเขียนผลลัพธ์ลง content_items
`brand-content.php` (action=generate-article) SHALL ตรวจสอบ `content_items.cancel_requested` อีกครั้งทันทีก่อน UPDATE `content_items`/`content_plan_items` หากถูกตั้งค่าไว้แล้ว SHALL ไม่เขียนผลลัพธ์นั้นลง DB

#### Scenario: Cancel มาถึงหลัง AI เขียนเสร็จแต่ก่อนเขียนผลลัพธ์ลง DB
- **WHEN** `cancel_requested` ถูกตั้งเป็น 1 ระหว่างที่ `generate-article` กำลังรอผลจาก AI Gateway อยู่ (ก่อนถึงจุด UPDATE `content_items`)
- **THEN** `generate-article` SHALL ตรวจพบ flag ที่จุดก่อน UPDATE และไม่เขียนผลลัพธ์ AI ที่เพิ่งได้มาลง `content_items`

### Requirement: cancel_requested SHALL ถูก reset เมื่อเริ่ม generation รอบใหม่สำหรับ item เดิม
`content-research.php` (action=fetch) SHALL ตั้ง `content_items.cancel_requested = 0` ทุกครั้งที่เริ่ม fetch ใหม่สำหรับ item นั้น เพื่อไม่ให้ flag ที่ค้างจากรอบที่ถูกยกเลิกไปแล้วบล็อกการสร้างเนื้อหาครั้งถัดไปของ item เดิมอย่างถาวร

#### Scenario: สร้างเนื้อหาใหม่สำหรับ item ที่เคยถูกยกเลิกไปก่อนหน้า
- **WHEN** item หนึ่งเคยถูกยกเลิกระหว่าง generation ก่อนหน้า (`cancel_requested = 1`) และผู้ใช้เริ่ม generation ใหม่สำหรับ item เดียวกัน
- **THEN** `action=fetch` ของรอบใหม่ SHALL reset `cancel_requested` เป็น 0 ก่อน และ generation รอบใหม่ SHALL ดำเนินต่อได้ตามปกติ ไม่ถูกบล็อกจาก flag เดิม

### Requirement: ยกเลิกเนื้อหาที่สร้างใหม่ในรอบนี้ SHALL ลบทั้งแผนรวมถึง research cache ที่เกี่ยวข้อง
สำหรับ `QuickCreateDialog`, `BatchGenerateDialog`, และ `ContentPlannerAI` panel (ทุกจุดสร้าง `content_plans` ใหม่เสมอ) เมื่อผู้ใช้ยกเลิก ระบบ SHALL เรียก endpoint rollback ใหม่ที่ลบ `content_plans` ที่สร้างในรอบนั้นทั้งหมด (cascade `content_items`, `content_plan_items`) รวมถึง SHALL ลบ `content_research_jobs`/`content_research_keywords` ที่ผูกกับ item ในแผนนั้นด้วย โดย SHALL ไม่กระทบ endpoint ลบแผนปกติ (`DELETE action=plans`) ที่ยังคงพฤติกรรมเดิม (รักษา research cache ด้วย `SET NULL`)

#### Scenario: ยกเลิก Quick Create ลบแผนที่เพิ่งสร้างพร้อม research job
- **WHEN** ผู้ใช้ยืนยันสร้างใน Quick Create แล้วกดยกเลิกก่อนหรือระหว่างกำลังสร้าง
- **THEN** `content_plans`/`content_plan_items`/`content_items` ที่เพิ่งสร้างในรอบนั้น SHALL ถูกลบทั้งหมด
- **AND** `content_research_jobs` ที่ผูกกับ item นั้น (ถ้ามี) SHALL ถูกลบด้วย ไม่ใช่แค่ unlink

#### Scenario: ยกเลิก Batch ลบทุกแผนที่สร้างไปแล้ว ไม่ใช่แค่แผนแรก
- **WHEN** ผู้ใช้กำลังสร้าง Batch หลายหัวข้อ (แต่ละหัวข้อสร้างแยกคนละ `content_plans`) และกดยกเลิกหลังสร้างไปแล้วบางหัวข้อ
- **THEN** ทุกแผนที่สร้างสำเร็จไปแล้วในรอบนั้น SHALL ถูกลบทั้งหมด ไม่ใช่แค่แผนแรกหรือแผนล่าสุด

#### Scenario: การลบแผนปกติของผู้ใช้ยังคงรักษา research cache เหมือนเดิม
- **WHEN** ผู้ใช้กดปุ่ม "ลบ" แผนที่สร้างเสร็จสมบูรณ์แล้วตามปกติ (ไม่ใช่ผ่านการยกเลิกกลางคัน)
- **THEN** endpoint `DELETE action=plans` เดิม SHALL ทำงานเหมือนเดิมทุกประการ (unlink research job ด้วย `SET NULL` ไม่ลบทิ้ง)

### Requirement: ยกเลิก AI เขียนให้ในเนื้อหาเดิม SHALL คืนค่าฟิลด์ที่ถูกเขียนทับ ไม่ใช่ลบ item
สำหรับปุ่ม "AI เขียนให้" ใน `ContentCardDialog` (แก้ไข item ที่มีอยู่ก่อนแล้ว) เมื่อผู้ใช้ยกเลิกและ `generate-article` เขียนผลลัพธ์ลง `content_items` ไปแล้วก่อนที่ระบบจะเช็ค flag ทัน ระบบ SHALL คืนค่าฟิลด์ที่ถูกเขียนทับ (`article_content`, `title`, `type`, `caption`, `seo_title`, `slug`, `meta_description`, `meta_keywords`, `structured_data`, `og_image`, `status`) กลับเป็นค่าก่อนกด "AI เขียนให้" โดย SHALL ไม่ลบ item นั้นทิ้ง

#### Scenario: ยกเลิกหลัง generate-article เขียนผลลัพธ์ไปแล้ว
- **WHEN** ผู้ใช้กดยกเลิกปุ่ม "AI เขียนให้" และ `generate-article` เขียนผลลัพธ์ลง `content_items` ไปแล้วก่อนเช็ค flag ทัน
- **THEN** ระบบ SHALL เรียก endpoint คืนค่าเพื่อคืนฟิลด์ทั้งหมดกลับเป็น snapshot ก่อนกด "AI เขียนให้"
- **AND** item นั้น SHALL ยังคงอยู่ (ไม่ถูกลบ)
- **AND** สถานะ `approved_at`/quality เดิมของ item (ถ้ามี) SHALL ไม่ถูกกระทบจากการคืนค่านี้

#### Scenario: ยกเลิกก่อน generate-article เขียนผลลัพธ์
- **WHEN** ผู้ใช้กดยกเลิกขณะยังอยู่ขั้น fetch/analyze (generate-article ยังไม่เริ่ม)
- **THEN** ระบบ SHALL ไม่เรียก endpoint คืนค่าใดๆ เพราะยังไม่มีฟิลด์ใดถูกเขียนทับ
