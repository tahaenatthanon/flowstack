## ADDED Requirements

### Requirement: Content items without a schedulable date are always visible in Calendar view
`ContentPlannerCalendar` SHALL แสดง content item ที่ไม่มี `scheduled_date` (ไม่ว่าจะมี `day_label` หรือไม่) ในกลุ่ม "ยังไม่กำหนดวันที่" เหนือ Calendar grid แทนที่จะข้ามหรือเก็บไว้ใต้ key ที่ grid ไม่มีทาง render ได้

#### Scenario: Item has no scheduled_date and no day_label
- **WHEN** content item ไม่มีทั้ง `scheduled_date` และ `day_label`
- **THEN** item นั้นปรากฏใน bucket "ยังไม่กำหนดวันที่" เหนือ Calendar grid
- **AND** item นั้นไม่ถูกข้ามหรือหายไปจากมุมมอง Calendar

#### Scenario: Item has a day_label but no scheduled_date
- **WHEN** content item มี `day_label` (เช่น ชื่อวันในสัปดาห์) แต่ไม่มี `scheduled_date`
- **THEN** item นั้นถือเป็น "ยังไม่กำหนดวันที่" เช่นเดียวกัน และปรากฏใน bucket
- **AND** item นั้นไม่ถูกเก็บไว้ใต้ key ที่อิงจาก `day_label` ซึ่ง grid ไม่มีทาง query เจอ

#### Scenario: Item has a real scheduled_date
- **WHEN** content item มี `scheduled_date` ที่ถูกต้อง
- **THEN** item นั้นแสดงบน Calendar grid ในวันที่ตรงกับ `scheduled_date` ตามพฤติกรรมเดิมทุกประการ
- **AND** item นั้นไม่ปรากฏใน bucket "ยังไม่กำหนดวันที่"

### Requirement: Unscheduled bucket respects existing filters and view modes
Bucket "ยังไม่กำหนดวันที่" SHALL ใช้ `typeFilter` และ `platformFilter` เดียวกับที่ใช้กรอง Calendar grid และ SHALL แสดงในทุกโหมดมุมมอง (Month, Quarter, Year) โดยแสดงเฉพาะเมื่อมีรายการอยู่ในกลุ่มนั้น

#### Scenario: Bucket is empty
- **WHEN** ไม่มี content item ที่ resolve แล้วไม่มี `scheduled_date` (หลังผ่าน `typeFilter`/`platformFilter`)
- **THEN** bucket ไม่แสดงผลเลย (ไม่มี empty state ค้างอยู่)

#### Scenario: Filter excludes an unscheduled item
- **WHEN** `typeFilter` หรือ `platformFilter` ถูกตั้งค่าไม่ตรงกับ content item ที่ไม่มี `scheduled_date`
- **THEN** item นั้นไม่ปรากฏใน bucket (กรองเหมือนที่ grid กรอง item ที่มีวันที่)

#### Scenario: Viewing Quarter or Year mode
- **WHEN** ผู้ใช้สลับมุมมองเป็น Quarter หรือ Year
- **THEN** bucket "ยังไม่กำหนดวันที่" ยังคงแสดงเหนือมุมมองนั้น ด้วยรายการและ filter เดียวกับที่ใช้ใน Month view

### Requirement: Unscheduled items support the same drag and edit interactions as scheduled items
Item ใน bucket "ยังไม่กำหนดวันที่" SHALL ลากไปวางบน day cell ใน Calendar grid เพื่อกำหนด `scheduled_date` ได้ และ SHALL คลิกเพื่อเปิด dialog แก้ไข item นั้นได้ โดยไม่ต้องเพิ่ม prop ใหม่ในคอมโพเนนต์

#### Scenario: Dragging an unscheduled item onto a day cell
- **WHEN** ผู้ใช้ลาก item จาก bucket ไปวางบน day cell ใดๆ ใน Calendar grid
- **THEN** ระบบตั้ง `scheduled_date` ของ item นั้นเป็นวันที่ของ cell ที่วาง โดยใช้ drop-handler เดิมที่ day cell มีอยู่แล้ว

#### Scenario: Clicking an unscheduled item to edit
- **WHEN** ผู้ใช้คลิก item ใน bucket
- **THEN** dialog แก้ไข content item เปิดขึ้นสำหรับ item นั้น โดยใช้ callback เดิมที่มีอยู่แล้วสำหรับเปิด dialog จาก Calendar
