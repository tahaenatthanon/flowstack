## ADDED Requirements

### Requirement: Template กำหนด style metadata สำหรับเนื้อหาที่ประกอบจากโครงสร้าง
`emailTemplates.ts` SHALL กำหนด style metadata ต่อ template สำหรับใช้ประกอบเนื้อหาที่มาจาก input แบบโครงสร้าง (heading/blocks) ได้แก่ `heading_color`, `body_color`, และ `text_align` (`'left'` หรือ `'center'`) ให้ตรงกับธรรมเนียมสี/การจัดวางที่ template นั้นใช้อยู่แล้วใน `defaultContent`

#### Scenario: ทุก template มี style metadata ครบ
- **WHEN** ตรวจสอบ field ของ template ใดๆ ใน `emailTemplates.ts`
- **THEN** พบค่า `heading_color`, `body_color`, และ `text_align` ที่กำหนดไว้ชัดเจนสำหรับ template นั้น

### Requirement: ฟังก์ชัน compose รองรับ input แบบโครงสร้าง (heading + blocks)
ระบบ SHALL มีความสามารถรับเนื้อหาแบบโครงสร้าง (`heading` string, `blocks[]` ที่แต่ละรายการเป็น `paragraph` หรือ `list`) และ style metadata ของ template แล้วคืนค่าเป็น HTML string แบบ deterministic ที่ใช้แทนที่ `{{EMAIL_CONTENT}}` — ใช้ marker เดิม (`{{EMAIL_CONTENT}}`/`{{CTA_TEXT}}`/`{{CTA_URL}}`) ในการประกอบรวมกับ chrome ของ template ต่อ ไม่สร้าง marker ใหม่ที่แยกขาดจากเดิม (ทั้งที่ประกอบฝั่ง backend สำหรับ batch generate ที่ insert ตรงลง DB และฝั่ง frontend สำหรับ single-generate ที่ยังใช้ `composeCampaignHtml` เดิมประกอบตอนบันทึก)

#### Scenario: Heading ถูก render ด้วยสีและการจัดวางของ template
- **WHEN** เรียก compose ด้วย `heading` และ style metadata ของ template หนึ่ง
- **THEN** HTML ที่ได้มี `heading` แสดงด้วย `heading_color` และ `text_align` ตามที่ template นั้นกำหนด

#### Scenario: Paragraph block ถูก render ด้วยสีของ body
- **WHEN** เรียก compose ด้วย `blocks` ที่มีรายการประเภท `paragraph`
- **THEN** HTML ที่ได้มีแต่ละ paragraph แสดงด้วย `body_color` และ `text_align` ตามที่ template นั้นกำหนด

#### Scenario: List block ถูก render เป็นรายการที่มีสไตล์ตรงกับ body
- **WHEN** เรียก compose ด้วย `blocks` ที่มีรายการประเภท `list`
- **THEN** HTML ที่ได้มี `<ul>`/`<li>` ที่ใช้ `body_color` ตามที่ template นั้นกำหนด

#### Scenario: ผลลัพธ์ที่ประกอบแล้วถูกเก็บเป็นเนื้อหาดิบสำหรับแก้ไขซ้ำ
- **WHEN** เนื้อหาแบบโครงสร้างถูกประกอบเป็น HTML และบันทึกเป็นแคมเปญ
- **THEN** ระบบเก็บ `editable_content` ไว้ตามกลไกเดิมของ template content composition เพื่อให้เปิดแก้ไขแคมเปญร่างซ้ำได้โดยไม่ต้องแกะจาก `body_html`
