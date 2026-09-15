## ADDED Requirements

### Requirement: {{subject}} ต้องเป็น merge tag ที่ใช้งานได้จริง
`processMergeTags()` ใน `api/email-utils.php` SHALL รองรับ merge tag `{{subject}}` โดยแทนที่ด้วยหัวข้ออีเมลของแคมเปญที่กำลังส่ง เช่นเดียวกับ merge tag อื่นที่รองรับอยู่แล้ว (`{{first_name}}`, `{{company_name}}` ฯลฯ)

#### Scenario: เทมเพลตมี {{subject}} ใน body_html
- **WHEN** แคมเปญถูกส่งโดยมี `body_html` ที่มีคำว่า `{{subject}}` อยู่ (เช่นในแท็ก `<title>`)
- **THEN** อีเมลที่ส่งจริง SHALL แทนที่ `{{subject}}` ด้วยหัวข้ออีเมลของแคมเปญนั้น ไม่เหลือคำว่า `{{subject}}` เป็น literal text

#### Scenario: เทมเพลตมี {{subject}} ใน body_text
- **WHEN** แคมเปญถูกส่งโดยมี `body_text` ที่มีคำว่า `{{subject}}` อยู่
- **THEN** เนื้อหา plain-text ที่ส่งจริง SHALL แทนที่ `{{subject}}` ด้วยหัวข้ออีเมลเช่นเดียวกัน

#### Scenario: การประมวลผลหัวข้ออีเมลเองไม่ได้รับผลกระทบ
- **WHEN** หัวข้ออีเมล (`campaign.subject`) ของแคมเปญเองถูกประมวลผล merge tag
- **THEN** พฤติกรรมการแทนที่ tag อื่น (`{{first_name}}` ฯลฯ) ในหัวข้ออีเมล SHALL ไม่เปลี่ยนแปลงจากเดิม

#### Scenario: ผู้เรียก processMergeTags() เดิมที่ไม่ส่ง subject ยังทำงานได้ปกติ
- **WHEN** เรียก `processMergeTags()` โดยไม่ส่ง parameter `$subject`
- **THEN** ฟังก์ชัน SHALL ไม่เกิด error และ merge tag อื่นทั้งหมด SHALL ยังทำงานถูกต้องตามเดิม (คำว่า `{{subject}}` จะไม่ถูกแทนที่ ยังคงเป็น literal text)
