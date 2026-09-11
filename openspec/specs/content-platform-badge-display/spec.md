# content-platform-badge-display Specification

## Purpose

Content item เลือกได้หลายแพลตฟอร์มพร้อมกัน (เก็บเป็น JSON array ใน `platforms` และสตริง comma-joined ใน `platform`) — กำหนดให้ `ContentCardDialog` และ `ContentDetailView` (จุดเดียวที่ยังแสดงแพลตฟอร์มของ content item อยู่ — `ContentPlannerCalendar`/`ContentItemList` เปลี่ยนไปแสดงประเภทเนื้อหาแทนแล้ว ดู capability `content-type-badge-display`) ต้อง parse แล้วแสดงแยกทีละแพลตฟอร์มพร้อมไอคอน/สีที่ถูกต้องเสมอ ห้ามนำค่าดิบทั้งก้อนไป lookup เป็นแพลตฟอร์มเดียว (ซึ่งพังเสมอเมื่อมีมากกว่า 1 แพลตฟอร์ม กลายเป็นสตริงดิบหรือไอคอน/สีเทา default)

## Requirements

### Requirement: Content item ที่มีหลายแพลตฟอร์มต้องแสดงแยกทีละแพลตฟอร์มพร้อมสีที่ถูกต้อง
ทุกจุด UI ที่ยังแสดงแพลตฟอร์มของ content item (`ContentCardDialog` และ `ContentDetailView` เท่านั้น) SHALL parse ค่าแพลตฟอร์ม (ไม่ว่าจะมาจาก `platforms` แบบ JSON array หรือ `platform` แบบ comma-joined string) เป็นรายการแพลตฟอร์มแยกกัน แล้วแสดงแต่ละแพลตฟอร์มพร้อมไอคอน/สีของแพลตฟอร์มนั้นๆ ห้ามนำค่าดิบทั้งก้อนไป lookup เป็นแพลตฟอร์มเดียว

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

### Requirement: Component แสดงผลแพลตฟอร์มหลายอันมีโหมดการแสดงผลแบบมี label เท่านั้น
`PlatformBadgeList` SHALL มีโหมดการแสดงผลแบบมีไอคอนพร้อม label (`variant="pill"`) เท่านั้น — ไม่มีโหมดไอคอนอย่างเดียว (`variant="icon-only"` ถูกลบออกแล้ว เพราะผู้เรียกใช้เดิมทั้ง 2 จุด คือ `ContentPlannerCalendar` และ `ContentItemList` เปลี่ยนไปแสดงประเภทเนื้อหาแทนแล้ว ดู capability `content-type-badge-display`)

#### Scenario: ContentCardDialog และ ContentDetailView ใช้แบบมี label
- **WHEN** `ContentCardDialog` แสดงแพลตฟอร์มใน header หรือ `ContentDetailView` แสดงแพลตฟอร์มของ content item
- **THEN** ใช้ `PlatformBadgeList` แบบมีไอคอนและ label ต่อแพลตฟอร์ม (`variant="pill"`)

#### Scenario: ไม่มี variant icon-only เหลืออยู่
- **WHEN** ตรวจสอบ props ที่ `PlatformBadgeList` ยอมรับ
- **THEN** `variant` รับได้เฉพาะ `"pill"` เท่านั้น ไม่มีตัวเลือก `"icon-only"` อีกต่อไป

### Requirement: ContentDetailView ใช้ component กลางแทน logic เดิม
`ContentDetailView.tsx` SHALL เรียกใช้ component กลางตัวใหม่แทน inline logic เดิมที่ parse และ render แพลตฟอร์มแยกกัน เพื่อไม่ให้มี logic ซ้ำกัน 2 ที่ในระบบ

#### Scenario: ContentDetailView ยังแสดงผลเหมือนเดิมหลัง refactor
- **WHEN** `ContentDetailView` แสดงแพลตฟอร์มของ content item หลังเปลี่ยนมาใช้ component กลาง
- **THEN** สี, label, และลำดับแพลตฟอร์มที่แสดงเหมือนเดิมทุกประการกับก่อน refactor
- **AND** มีไอคอนแพลตฟอร์มเพิ่มเข้ามาหน้า label (ของเดิมมีแค่ label สีไม่มีไอคอน) ให้สอดคล้องกับ pill variant ที่ใช้ร่วมกับจุดอื่น (เช่น `ContentCardDialog` header) ตามที่ design.md ระบุไว้ — ถือเป็นการปรับปรุงภาพ ไม่ใช่การถดถอย
