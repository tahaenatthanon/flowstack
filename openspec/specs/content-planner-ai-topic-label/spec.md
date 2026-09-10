# content-planner-ai-topic-label Specification

## Purpose

กำหนดให้ label และ helper text ของช่อง input หลักใน "AI สร้างแผน" panel (`ContentPlannerAI`) สื่อสารบทบาทจริงของ field (หัวข้อ/ธีมของแผนที่ AI ใช้แตกหัวข้อย่อยต่อโพสต์เอง) แทนที่ label เดิม "Trigger Command" ที่ไม่ตรงกับบทบาทจริง โดยไม่เปลี่ยนพฤติกรรมการสร้างแผนหรือ Research ใดๆ

## Requirements

### Requirement: The plan input field communicates its true role as a topic/theme
"AI สร้างแผน" panel ใน `ContentPlannerAI` SHALL แสดง label ของ input หลักเป็น "หัวข้อ/คำสั่งสำหรับแผน" พร้อม helper text อธิบายว่า AI จะคิดหัวข้อย่อยของแต่ละโพสต์เอง แทนที่ label เดิม "Trigger Command" ที่ไม่สื่อสารบทบาทจริงของ field

#### Scenario: ผู้ใช้เปิด AI สร้างแผน panel
- **WHEN** ผู้ใช้เปิด panel "AI สร้างแผน" ใน Content Planner
- **THEN** label ของ input หลักแสดงเป็น "หัวข้อ/คำสั่งสำหรับแผน"
- **AND** มี helper text ใต้ input อธิบายว่า AI จะคิดหัวข้อย่อยของแต่ละโพสต์เองจากค่าที่กรอก

#### Scenario: Placeholder ไม่เปลี่ยน
- **WHEN** input ยังว่างอยู่
- **THEN** placeholder ยังคงเป็นตัวอย่างเดิม (เช่น "แผนคอนเทนต์เดือนนี้")

### Requirement: Label change does not alter request data or generation behavior
การเปลี่ยน label/helper text SHALL ไม่เปลี่ยนชื่อ field ที่ส่งไปยัง `generate-plan`, ค่าที่ส่ง, หรือพฤติกรรม Research/source_topic ที่มีอยู่แล้ว

#### Scenario: ส่งค่าเดิมไปยัง backend
- **WHEN** ผู้ใช้กรอก input และกด "สร้างแผนด้วย AI"
- **THEN** request ที่ส่งไปยัง `generate-plan` ยังมี field ชื่อ `trigger_command` เหมือนเดิมทุกประการ
- **AND** ไม่มี field `source_topic` ใหม่ถูกส่งจาก `ContentPlannerAI`

#### Scenario: Research behavior ต่อ item ไม่เปลี่ยน
- **WHEN** แผนสร้างหลาย item จาก input เดียวกัน
- **THEN** แต่ละ item ยังคงได้ `source_topic` แช่แข็งจาก topic ที่ AI คิดให้ item นั้นโดยเฉพาะ ไม่ใช่ค่าเดียวกันซ้ำทุก item ตามพฤติกรรมเดิม
