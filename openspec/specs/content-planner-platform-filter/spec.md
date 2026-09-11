# content-planner-platform-filter Specification

## Purpose

กำหนดให้ตัวกรองแพลตฟอร์มใน Content Planner (`ContentPlannerCalendar` และ `ContentItemList`) match content item ตามรายการแพลตฟอร์มที่ parse แล้วเสมอ ไม่ใช่เทียบค่าดิบ (`content_items.platform`, สตริง comma-joined เมื่อ item เลือกไว้หลายแพลตฟอร์ม) แบบ exact-match ตรงๆ — ป้องกันไม่ให้ content item ที่เลือกไว้หลายแพลตฟอร์มหายไปจากผลกรองอย่างผิดๆ ทั้งที่มีแพลตฟอร์มที่เลือกกรองอยู่จริง

## Requirements

### Requirement: ตัวกรองแพลตฟอร์มต้อง match content item ตามรายการแพลตฟอร์มที่ parse แล้ว
`ContentPlannerCalendar` และ `ContentItemList` SHALL กรอง content item ตาม `platformFilter` โดย parse ค่าแพลตฟอร์มของ item (`platforms` หรือ `platform`) เป็นรายการแยกก่อนเช็คว่ามีแพลตฟอร์มที่เลือกกรองอยู่หรือไม่ ห้ามเทียบค่าดิบทั้งก้อนแบบ exact-match

#### Scenario: กรองแพลตฟอร์มเจอ content item ที่มีหลายแพลตฟอร์ม
- **WHEN** ผู้ใช้เลือกกรอง `platformFilter='facebook'` และมี content item ที่ `platforms=["facebook","linkedin"]`
- **THEN** content item นั้นปรากฏในผลกรองทั้งบน `ContentPlannerCalendar` และ `ContentItemList`

#### Scenario: กรองแพลตฟอร์มไม่เจอ content item ที่ไม่มีแพลตฟอร์มนั้น
- **WHEN** ผู้ใช้เลือกกรอง `platformFilter='youtube'` และมี content item ที่ `platforms=["facebook","linkedin"]`
- **THEN** content item นั้นไม่ปรากฏในผลกรอง

#### Scenario: ไม่เลือกกรอง (all) แสดงทุก content item เหมือนเดิม
- **WHEN** `platformFilter='all'`
- **THEN** content item ทุกรายการแสดงตามปกติ ไม่ถูกกรองตามแพลตฟอร์ม

#### Scenario: content item แพลตฟอร์มเดียวยังกรองถูกต้องเหมือนเดิม
- **WHEN** ผู้ใช้เลือกกรอง `platformFilter='facebook'` และมี content item ที่มีแพลตฟอร์มเดียวคือ `facebook`
- **THEN** content item นั้นปรากฏในผลกรองเหมือนพฤติกรรมเดิมก่อนการเปลี่ยนแปลงนี้
