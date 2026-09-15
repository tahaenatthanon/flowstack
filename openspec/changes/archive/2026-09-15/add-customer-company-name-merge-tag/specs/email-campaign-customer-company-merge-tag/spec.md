## ADDED Requirements

### Requirement: {{customer_company_name}} ต้องแทนที่ด้วยชื่อบริษัทของลูกค้าผู้รับ
`processMergeTags()` ใน `api/email-utils.php` SHALL รองรับ merge tag `{{customer_company_name}}` โดยแทนที่ด้วยชื่อบริษัทของลูกค้าผู้รับอีเมล แยกจาก `{{company_name}}` ซึ่ง SHALL ยังคงหมายถึงบริษัทผู้ส่งเสมอไม่เปลี่ยนแปลง

#### Scenario: เทมเพลตมี {{customer_company_name}} ในเนื้อหา
- **WHEN** แคมเปญถูกส่งโดยมี `body_html` หรือ `body_text` ที่มีคำว่า `{{customer_company_name}}` อยู่
- **THEN** อีเมลที่ส่งจริง SHALL แทนที่ `{{customer_company_name}}` ด้วยชื่อบริษัทของผู้รับอีเมลรายนั้น ไม่เหลือคำว่า `{{customer_company_name}}` เป็น literal text

#### Scenario: {{company_name}} ไม่ได้รับผลกระทบ
- **WHEN** เทมเพลตเดียวกันมีทั้ง `{{company_name}}` และ `{{customer_company_name}}`
- **THEN** `{{company_name}}` SHALL ยังคงถูกแทนที่ด้วยชื่อบริษัทผู้ส่ง (`company_settings.company_name`) เหมือนเดิมทุกประการ ไม่ปนกับค่าของ `{{customer_company_name}}`

### Requirement: Template-8 ต้องแสดงบริษัทผู้รับในช่อง Company ไม่ใช่บริษัทผู้ส่งซ้ำ
เทมเพลตที่มีฟอร์แมต "To: [ชื่อผู้รับ] / Company: [บริษัท]" SHALL แสดงชื่อบริษัทของผู้รับในช่อง Company ไม่ใช่ชื่อบริษัทผู้ส่งที่ปรากฏซ้ำกับส่วนลงชื่อท้ายเมล

#### Scenario: ส่งอีเมลด้วย template-8
- **WHEN** แคมเปญที่ใช้เทมเพลต "Company: [ตัวแปร]" ถูกส่งถึงผู้รับที่มีชื่อบริษัทในระบบ
- **THEN** ช่อง "Company:" SHALL แสดงชื่อบริษัทของผู้รับรายนั้น และส่วนลงชื่อท้ายเมล ("Sincerely,") SHALL ยังคงแสดงชื่อบริษัทผู้ส่งเหมือนเดิม
