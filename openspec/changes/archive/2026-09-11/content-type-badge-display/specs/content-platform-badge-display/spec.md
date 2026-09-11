## MODIFIED Requirements

### Requirement: Content item ที่มีหลายแพลตฟอร์มต้องแสดงแยกทีละแพลตฟอร์มพร้อมสีที่ถูกต้อง
ทุกจุด UI ที่ยังแสดงแพลตฟอร์มของ content item (`ContentCardDialog` และ `ContentDetailView` เท่านั้น — `ContentPlannerCalendar` และ `ContentItemList` เปลี่ยนไปแสดงประเภทเนื้อหาแทนแล้ว ดู capability `content-type-badge-display`) SHALL parse ค่าแพลตฟอร์ม (ไม่ว่าจะมาจาก `platforms` แบบ JSON array หรือ `platform` แบบ comma-joined string) เป็นรายการแพลตฟอร์มแยกกัน แล้วแสดงแต่ละแพลตฟอร์มพร้อมไอคอน/สีของแพลตฟอร์มนั้นๆ ห้ามนำค่าดิบทั้งก้อนไป lookup เป็นแพลตฟอร์มเดียว

#### Scenario: Dialog แก้ไขคอนเทนต์แสดง badge แยกทีละแพลตฟอร์ม
- **WHEN** เปิด `ContentCardDialog` สำหรับ content item ที่มี `platforms=["facebook","linkedin","twitter","instagram","lineoa","wordpress","wix"]`
- **THEN** header แสดง badge แยก 7 อัน แต่ละอันมีไอคอนและสีตรงกับแพลตฟอร์มนั้นๆ ไม่ใช่ badge เดียวที่โชว์สตริงดิบ

#### Scenario: Content item ที่มีแพลตฟอร์มเดียวยังแสดงผลถูกต้องเหมือนเดิม
- **WHEN** content item มีแพลตฟอร์มเดียว (เช่น `platforms=["facebook"]`)
- **THEN** ทั้ง `ContentCardDialog` และ `ContentDetailView` แสดงไอคอน/สีของแพลตฟอร์มนั้นถูกต้อง เหมือนพฤติกรรมเดิม

### Requirement: ไม่ตัดทอนจำนวนแพลตฟอร์มที่แสดง
`ContentCardDialog` และ `ContentDetailView` SHALL แสดงครบทุกแพลตฟอร์มที่ content item นั้นมีจริง (สูงสุด 7 ตามจำนวนแพลตฟอร์มที่ระบบรองรับ) โดยไม่ตัดทอนเป็น "+N" หรือซ่อนบางแพลตฟอร์ม

#### Scenario: Content item เลือกไว้ครบ 7 แพลตฟอร์ม
- **WHEN** content item มี `platforms` ครบทั้ง 7 แพลตฟอร์มที่ระบบรองรับ
- **THEN** ทั้ง `ContentCardDialog` และ `ContentDetailView` แสดงไอคอน/badge ครบทั้ง 7 แพลตฟอร์ม ไม่มีการซ่อนหรือย่อเป็น "+N"

### Requirement: Component แสดงผลแพลตฟอร์มหลายอันต้องใช้ร่วมกันได้ทั้งแบบมี label และแบบไอคอนอย่างเดียว
`PlatformBadgeList` SHALL มีโหมดการแสดงผลแบบมีไอคอนพร้อม label (`variant="pill"`) เท่านั้น — โหมดไอคอนอย่างเดียว (`variant="icon-only"`) SHALL ถูกลบออก เนื่องจากไม่มีจุดใดในระบบเรียกใช้อีกต่อไป (`ContentPlannerCalendar` และ `ContentItemList` ซึ่งเคยเป็นผู้เรียกใช้เพียง 2 จุด เปลี่ยนไปแสดงประเภทเนื้อหาแทนแล้ว)

#### Scenario: ContentCardDialog และ ContentDetailView ใช้แบบมี label
- **WHEN** `ContentCardDialog` แสดงแพลตฟอร์มใน header หรือ `ContentDetailView` แสดงแพลตฟอร์มของ content item
- **THEN** ใช้ `PlatformBadgeList` แบบมีไอคอนและ label ต่อแพลตฟอร์ม (`variant="pill"`)

#### Scenario: ไม่มี variant icon-only เหลืออยู่
- **WHEN** ตรวจสอบ props ที่ `PlatformBadgeList` ยอมรับ
- **THEN** `variant` รับได้เฉพาะ `"pill"` เท่านั้น ไม่มีตัวเลือก `"icon-only"` อีกต่อไป
