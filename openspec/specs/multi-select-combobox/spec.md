# multi-select-combobox Specification

## Purpose

กำหนดพฤติกรรมของ `MultiSelectCombobox` — component ทั่วไปสำหรับเลือกได้หลายรายการพร้อมค้นหา ไม่ผูกกับ domain ใดโดยเฉพาะ สร้างจาก `Popover`+`Command`+`Badge` ที่มีอยู่แล้วในระบบ ต่างจาก Combobox อื่นในระบบ (`CompanyCombobox`, `ProjectCombobox`, `UserCombobox`, `ProjectFilterSelect` ฯลฯ) ที่เป็น single-select และปิด popover ทันทีหลังเลือก — ตัวนี้เลือกได้หลายรายการต่อเนื่องโดย popover ไม่ปิด และแสดงรายการที่เลือกไว้เป็น chip นอก popover

## Requirements

### Requirement: เลือกได้หลายรายการผ่าน dropdown ที่ค้นหาได้
`MultiSelectCombobox` SHALL แสดงปุ่ม trigger ที่เปิด popover ประกอบด้วยช่องค้นหาและรายการตัวเลือก (`options`) — ผู้ใช้พิมพ์กรองรายการและเลือกได้มากกว่า 1 รายการในการเปิด popover ครั้งเดียว โดยรายการที่เลือกไว้แสดงเครื่องหมายถูกกำกับ

#### Scenario: กรองรายการด้วยคำค้นหา
- **WHEN** ผู้ใช้พิมพ์ข้อความในช่องค้นหาของ popover
- **THEN** รายการที่ไม่ตรงกับคำค้นหา (จับคู่กับ `label`) ถูกซ่อนไป เหลือเฉพาะที่ตรง

#### Scenario: เลือกได้หลายรายการโดยไม่ต้องเปิด popover ใหม่
- **WHEN** ผู้ใช้คลิกเลือกตัวเลือกหนึ่งใน popover
- **THEN** popover ยังคงเปิดอยู่ (ไม่ปิดอัตโนมัติ) ให้ผู้ใช้เลือกรายการถัดไปต่อได้ทันที

#### Scenario: ปิด popover เมื่อคลิกนอกหรือกด Escape
- **WHEN** ผู้ใช้คลิกนอก popover หรือกดปุ่ม Escape
- **THEN** popover ปิดลง (พฤติกรรมมาตรฐานของ Popover component ที่มีอยู่แล้ว)

### Requirement: แสดงรายการที่เลือกไว้เป็น chip นอก dropdown
`MultiSelectCombobox` SHALL แสดงรายการที่ถูกเลือกไว้เป็น chip อยู่นอก popover (มองเห็นได้ตลอดเวลาไม่ต้องเปิด popover) แต่ละ chip มีปุ่มเอาออกในตัว

#### Scenario: เห็น chip ของทุกรายการที่เลือก
- **WHEN** ผู้ใช้เลือกตัวเลือกอย่างน้อย 1 รายการ
- **THEN** แสดง chip 1 อันต่อ 1 รายการที่เลือก อยู่นอก popover

#### Scenario: เอารายการออกจาก chip โดยตรง
- **WHEN** ผู้ใช้คลิกปุ่ม × บน chip
- **THEN** รายการนั้นถูกเอาออกจาก `value` ทันที โดยไม่ต้องเปิด popover

#### Scenario: ไม่มี chip เมื่อยังไม่ได้เลือกอะไร
- **WHEN** `value` เป็น array ว่าง
- **THEN** ไม่แสดง chip ใดๆ

### Requirement: ตัวเลือก "เลือกทั้งหมด"
`MultiSelectCombobox` SHALL แสดงตัวเลือก "เลือกทั้งหมด" ที่หัวรายการใน popover เมื่อ `showSelectAll` เป็นจริง (ค่าเริ่มต้น) — คลิกครั้งเดียวเลือก/ยกเลิกทุกตัวเลือกที่กำลังแสดงอยู่ (หลังกรองด้วยคำค้นหาถ้ามี)

#### Scenario: เลือกทั้งหมดในคลิกเดียว
- **WHEN** ผู้ใช้คลิก "เลือกทั้งหมด" ขณะยังไม่มีตัวเลือกไหนถูกเลือก
- **THEN** ทุกตัวเลือกที่กำลังแสดงอยู่ (หลังกรองค้นหา) ถูกเลือกทั้งหมด

#### Scenario: ปิดใช้งานเลือกทั้งหมดได้
- **WHEN** ผู้ใช้ตั้ง `showSelectAll={false}`
- **THEN** ไม่แสดงตัวเลือก "เลือกทั้งหมด" ใน popover

### Requirement: เป็น component ทั่วไป ไม่ผูกกับ domain ใดโดยเฉพาะ
`MultiSelectCombobox` SHALL รับ options ผ่าน prop ทั่วไป (`{ value, label, meta? }[]`) ไม่มี field ที่ผูกกับ domain เฉพาะ (เช่นไม่มี `member_count` ตรงๆ ในโครงสร้าง prop) เพื่อให้ใช้ซ้ำได้กับข้อมูลประเภทอื่น

#### Scenario: แสดงข้อความรอง (meta) เมื่อมี
- **WHEN** ตัวเลือกหนึ่งมี `meta` กำหนดไว้
- **THEN** แสดงข้อความ `meta` จางๆ ด้านข้างของตัวเลือกนั้นใน popover

#### Scenario: ไม่มี meta ก็แสดงได้ปกติ
- **WHEN** ตัวเลือกหนึ่งไม่มี `meta`
- **THEN** แสดงเฉพาะ `label` โดยไม่มีช่องว่างหรือข้อผิดพลาดจากการขาด `meta`
