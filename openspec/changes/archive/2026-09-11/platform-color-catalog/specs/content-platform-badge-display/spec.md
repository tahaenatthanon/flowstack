## ADDED Requirements

### Requirement: Content item ที่มีหลายแพลตฟอร์มต้องแสดงแยกทีละแพลตฟอร์มพร้อมสีที่ถูกต้อง
ทุกจุด UI ที่แสดงแพลตฟอร์มของ content item SHALL parse ค่าแพลตฟอร์ม (ไม่ว่าจะมาจาก `platforms` แบบ JSON array หรือ `platform` แบบ comma-joined string) เป็นรายการแพลตฟอร์มแยกกัน แล้วแสดงแต่ละแพลตฟอร์มพร้อมไอคอน/สีของแพลตฟอร์มนั้นๆ ห้ามนำค่าดิบทั้งก้อนไป lookup เป็นแพลตฟอร์มเดียว

#### Scenario: Dialog แก้ไขคอนเทนต์แสดง badge แยกทีละแพลตฟอร์ม
- **WHEN** เปิด `ContentCardDialog` สำหรับ content item ที่มี `platforms=["facebook","linkedin","twitter","instagram","lineoa","wordpress","wix"]`
- **THEN** header แสดง badge แยก 7 อัน แต่ละอันมีไอคอนและสีตรงกับแพลตฟอร์มนั้นๆ ไม่ใช่ badge เดียวที่โชว์สตริงดิบ

#### Scenario: Chip บนปฏิทินแสดงไอคอนแยกทีละแพลตฟอร์ม
- **WHEN** `ContentPlannerCalendar` render chip ของ content item ที่มีหลายแพลตฟอร์ม
- **THEN** chip แสดงไอคอนสีของแต่ละแพลตฟอร์มแยกกัน ไม่ใช่ไอคอน default (โลกกลม) สีเทาเดียว

#### Scenario: มุมมองรายการแสดงไอคอน/badge แยกทีละแพลตฟอร์ม
- **WHEN** `ContentItemList` render แถวของ content item ที่มีหลายแพลตฟอร์ม
- **THEN** คอลัมน์แพลตฟอร์มแสดงไอคอน/badge แยกของแต่ละแพลตฟอร์ม ไม่ใช่สตริงดิบหรือ badge สีเทา default

#### Scenario: Content item ที่มีแพลตฟอร์มเดียวยังแสดงผลถูกต้องเหมือนเดิม
- **WHEN** content item มีแพลตฟอร์มเดียว (เช่น `platforms=["facebook"]`)
- **THEN** ทั้ง 3 จุด (dialog, ปฏิทิน, รายการ) แสดงไอคอน/สีของแพลตฟอร์มนั้นถูกต้อง เหมือนพฤติกรรมเดิมก่อนมีการเปลี่ยนแปลงนี้

### Requirement: ไม่ตัดทอนจำนวนแพลตฟอร์มที่แสดง
ทุกจุดที่แสดงแพลตฟอร์มแยกทีละอัน SHALL แสดงครบทุกแพลตฟอร์มที่ content item นั้นมีจริง (สูงสุด 7 ตามจำนวนแพลตฟอร์มที่ระบบรองรับ) โดยไม่ตัดทอนเป็น "+N" หรือซ่อนบางแพลตฟอร์ม

#### Scenario: Content item เลือกไว้ครบ 7 แพลตฟอร์ม
- **WHEN** content item มี `platforms` ครบทั้ง 7 แพลตฟอร์มที่ระบบรองรับ
- **THEN** ทั้ง 3 จุด UI แสดงไอคอน/badge ครบทั้ง 7 แพลตฟอร์ม ไม่มีการซ่อนหรือย่อเป็น "+N"

### Requirement: Component แสดงผลแพลตฟอร์มหลายอันต้องใช้ร่วมกันได้ทั้งแบบมี label และแบบไอคอนอย่างเดียว
ระบบ SHALL มี component กลางสำหรับแสดงรายการแพลตฟอร์มที่ parse แล้ว รองรับอย่างน้อย 2 รูปแบบการแสดงผล: แบบมีไอคอนพร้อม label (ใช้ในพื้นที่กว้าง) และแบบไอคอนอย่างเดียวไม่มี label (ใช้ในพื้นที่แคบ เช่น chip ปฏิทินหรือคอลัมน์ตาราง)

#### Scenario: ContentCardDialog ใช้แบบมี label
- **WHEN** `ContentCardDialog` แสดงแพลตฟอร์มใน header
- **THEN** ใช้ component กลางแบบมีไอคอนและ label ต่อแพลตฟอร์ม

#### Scenario: ContentPlannerCalendar และ ContentItemList ใช้แบบไอคอนอย่างเดียว
- **WHEN** `ContentPlannerCalendar` แสดง chip หรือ `ContentItemList` แสดงคอลัมน์แพลตฟอร์ม
- **THEN** ใช้ component กลางแบบไอคอนอย่างเดียว ไม่มี label ข้อความ เพื่อประหยัดพื้นที่

### Requirement: ContentDetailView ใช้ component กลางแทน logic เดิม
`ContentDetailView.tsx` SHALL เรียกใช้ component กลางตัวใหม่แทน inline logic เดิมที่ parse และ render แพลตฟอร์มแยกกัน เพื่อไม่ให้มี logic ซ้ำกัน 2 ที่ในระบบ

#### Scenario: ContentDetailView ยังแสดงผลเหมือนเดิมหลัง refactor
- **WHEN** `ContentDetailView` แสดงแพลตฟอร์มของ content item หลังเปลี่ยนมาใช้ component กลาง
- **THEN** สี, label, และลำดับแพลตฟอร์มที่แสดงเหมือนเดิมทุกประการกับก่อน refactor
- **AND** มีไอคอนแพลตฟอร์มเพิ่มเข้ามาหน้า label (ของเดิมมีแค่ label สีไม่มีไอคอน) ให้สอดคล้องกับ pill variant ที่ใช้ร่วมกับจุดอื่น (เช่น `ContentCardDialog` header) ตามที่ design.md ระบุไว้ — ถือเป็นการปรับปรุงภาพ ไม่ใช่การถดถอย
