## ADDED Requirements

### Requirement: ตัวแก้ไขต้องคงสไตล์ของรายการ (bulletList/listItem) ไว้หลังแก้ไขเนื้อหา
`ArticleEditor` SHALL คง `style` attribute แบบ inline ที่ผูกอยู่กับ `<ul>` (bulletList) และ `<li>` (listItem) ไว้ครบถ้วน ทั้งตอน parse เนื้อหาเข้ามาครั้งแรกและตอน re-serialize กลับเป็น HTML ทุกครั้งที่ผู้ใช้แก้ไขเนื้อหา

#### Scenario: แก้ข้อความในรายการที่มีสีกำหนดไว้ แล้วสีไม่หาย
- **WHEN** ผู้ใช้พิมพ์แก้ไขข้อความภายใน `<li>` ที่มี `style="color:..."` หรือ `<ul>` ที่มี `style` กำหนดไว้
- **THEN** เนื้อหา HTML ที่ได้จากตัวแก้ไข (`editor.getHTML()`) ยังคงมี `style` attribute บน `<ul>`/`<li>` นั้นอยู่ครบ ไม่ถูกตัดทิ้ง

#### Scenario: แก้ไขเนื้อหาที่มาจากการประกอบแบบโครงสร้าง (heading/blocks) ไม่เสียสไตล์ list
- **WHEN** ผู้ใช้เปิดแก้ไขแคมเปญที่เนื้อหาส่วน list ถูกประกอบมาจาก AI generation (แปลง `blocks[]` ประเภท `list` เป็น `<ul>`/`<li>` ที่มี inline style ตามสีของ template)
- **THEN** หลังแก้ไขข้อความส่วนอื่นแล้วบันทึก สไตล์ของ `<ul>`/`<li>` ยังคงตรงกับที่ประกอบไว้ตอน generate ไม่ถูกรีเซ็ตเป็นค่าเริ่มต้นของ browser
