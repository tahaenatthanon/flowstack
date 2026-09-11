## ADDED Requirements

### Requirement: Chip บนปฏิทินต้องแสดงประเภทเนื้อหาแทนแพลตฟอร์ม
`ContentPlannerCalendar` SHALL แสดง chip ของแต่ละ content item ด้วยสีพื้นหลัง (รวมสีตัวอักษร) ตามประเภทเนื้อหา (`TYPE_MAP` ผ่าน `getCanonicalContentType()`) พร้อมไอคอนประเภทเดียว ไม่มี label ข้อความ แทนไอคอนแพลตฟอร์มที่เคยแสดง — บทความ SHALL ใช้โทนสีฟ้า วีดีโอ SHALL ใช้โทนสีแดง ตามที่ `TYPE_MAP` กำหนดไว้

#### Scenario: Chip ของ content item ประเภทบทความ
- **WHEN** `ContentPlannerCalendar` render chip ของ content item ที่ `content_type='article'`
- **THEN** chip มีพื้นหลังโทนสีฟ้า (ตาม `TYPE_MAP.article.color`) พร้อมไอคอน `FileText` ไม่มีไอคอนแพลตฟอร์มใดๆ ปรากฏบน chip

#### Scenario: Chip ของ content item ประเภทวีดีโอ
- **WHEN** `ContentPlannerCalendar` render chip ของ content item ที่ `content_type='video'`
- **THEN** chip มีพื้นหลังโทนสีแดง (ตาม `TYPE_MAP.video.color`) พร้อมไอคอน `Video` ไม่มีไอคอนแพลตฟอร์มใดๆ ปรากฏบน chip

#### Scenario: Content item หลายแพลตฟอร์มไม่ทำให้ chip ต่างจาก content item แพลตฟอร์มเดียว
- **WHEN** content item สองรายการมี `content_type` เดียวกันแต่รายการหนึ่งมี 1 แพลตฟอร์ม อีกรายการมี 7 แพลตฟอร์ม
- **THEN** chip ของทั้งสองรายการมีสีพื้นหลัง/ไอคอนเหมือนกันทุกประการ (ไม่ขึ้นกับจำนวนแพลตฟอร์มอีกต่อไป)

#### Scenario: สัญลักษณ์ล็อกยังแสดงคู่กับ type badge ได้ตามปกติ
- **WHEN** content item ที่ `has_published_platform=true` (ถูกล็อกตาม `lock-published-content-date`) แสดงบนปฏิทิน
- **THEN** chip แสดงทั้งไอคอนล็อกและ type badge พร้อมกัน ไม่มีอันไหนถูกซ่อน

### Requirement: มุมมองรายการต้องแสดงคอลัมน์ประเภทเนื้อหาแทนแพลตฟอร์ม
`ContentItemList` SHALL แสดงคอลัมน์ที่ตำแหน่งเดิม (เคยเป็น "แพลตฟอร์ม") เป็นคอลัมน์ "ประเภท" แสดง badge ไอคอน+ชื่อประเภทเนื้อหา (เช่น "บทความ", "วีดีโอ") แทนไอคอนแพลตฟอร์ม โดยหัวคอลัมน์และปุ่ม sort SHALL สื่อความหมายตรงกับข้อมูลที่แสดง

#### Scenario: คอลัมน์แสดง badge ประเภทเนื้อหา
- **WHEN** `ContentItemList` render แถวของ content item ที่ `content_type='article'`
- **THEN** คอลัมน์แสดง badge มีทั้งไอคอนและข้อความ "บทความ" สีฟ้า ไม่ใช่ไอคอนแพลตฟอร์ม

#### Scenario: หัวคอลัมน์และการเรียงลำดับตรงกับข้อมูลที่แสดง
- **WHEN** ผู้ใช้กดปุ่มหัวคอลัมน์เพื่อเรียงลำดับตามคอลัมน์นี้
- **THEN** รายการเรียงตามประเภทเนื้อหา (บทความ/วีดีโอ) ไม่ใช่ตามแพลตฟอร์ม และหัวคอลัมน์แสดงข้อความ "ประเภท" ไม่ใช่ "แพลตฟอร์ม"

### Requirement: Component แสดงผล type badge ต้องใช้ร่วมกันได้ทั้งแบบมี label และแบบไอคอนอย่างเดียว
ระบบ SHALL มี component กลางสำหรับแสดงประเภทเนื้อหา รองรับอย่างน้อย 2 รูปแบบ: แบบไอคอนอย่างเดียวไม่มี label (ใช้ใน `ContentPlannerCalendar`) และแบบมีไอคอนพร้อม label (ใช้ใน `ContentItemList`) โดยทั้งสองรูปแบบ SHALL ดึงไอคอน/สี/label จาก `TYPE_MAP` เดียวกัน ไม่มีการนิยามซ้ำ

#### Scenario: ContentPlannerCalendar ใช้แบบไอคอนอย่างเดียว
- **WHEN** `ContentPlannerCalendar` แสดง type badge บน chip
- **THEN** ใช้ component กลางแบบไอคอนอย่างเดียว ไม่มี label ข้อความ

#### Scenario: ContentItemList ใช้แบบมี label
- **WHEN** `ContentItemList` แสดง type badge ในคอลัมน์ประเภท
- **THEN** ใช้ component กลางแบบมีไอคอนและ label
