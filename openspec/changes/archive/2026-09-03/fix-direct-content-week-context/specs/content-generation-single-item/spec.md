# content-generation-single-item Specification

## ADDED Requirements

### Requirement: Direct content creation SHALL be isolated from weekly/day context
เมื่อผู้ใช้สร้าง Content จาก Quick Create แบบเดี่ยว ระบบ SHALL ระบุ `generation_mode=direct` และ SHALL ไม่ส่งบริบทวันหรือสัปดาห์เข้า AI generation prompt

#### Scenario: Direct article generation
- **WHEN** ผู้ใช้เลือก Article และกดสร้างจาก Quick Create
- **THEN** request มี `generation_mode=direct`
- **AND** ระบบสร้าง content 1 item
- **AND** prompt ไม่มี `สัปดาห์เริ่มต้น`, `สร้างโพสต์สำหรับวัน...`, `วันจันทร์` หรือ day/week context ที่ระบบเติมเอง

#### Scenario: Direct video generation
- **WHEN** ผู้ใช้เลือก Video และกดสร้างจาก Quick Create
- **THEN** ระบบใช้ direct mode เช่นเดียวกับ Article
- **AND** prompt ไม่มี day/week context ที่ระบบเติมเอง

### Requirement: Direct mode SHALL NOT use days as a weekly-context trigger
Direct mode SHALL ไม่ใช้ `days: 1` เป็นตัวขับ weekly/day generation logic

#### Scenario: Direct request has no days field
- **WHEN** Quick Create ส่ง request แบบ direct
- **THEN** backend ไม่บังคับให้ request กลายเป็น weekly/day prompt เพียงเพราะไม่มีหรือมี `days`
- **AND** direct mode จำกัดผลลัพธ์ไว้ที่ 1 content item

### Requirement: Content Plan SHALL retain day/week behavior
เมื่อ request เป็น Content Plan ระบบ SHALL คง logic เดิมของ day/week context

#### Scenario: Weekly content plan
- **WHEN** Content Planner เรียก generate-plan โดยไม่ใช่ direct mode
- **THEN** ระบบยังสามารถใช้ `week_start`, day definitions, `day_label`, `day_order` และ scheduled date ตาม flow เดิม

#### Scenario: Monthly or longer plan
- **WHEN** Content Planner ใช้ monthly/quarterly/yearly plan
- **THEN** date instruction เดิมยังถูกส่งตาม plan range

### Requirement: Direct metadata SHALL not become content instructions
ระบบ MAY เก็บ `day_label=''`, `day_order=0`, `scheduled_date=null` สำหรับ direct item เพื่อ compatibility แต่ค่าเหล่านี้ SHALL ไม่ถูกใช้เป็น instruction ให้ AI เขียนเนื้อหา

#### Scenario: Direct item is persisted
- **WHEN** direct generation สำเร็จ
- **THEN** item ถูกบันทึกใน storage เดิมได้
- **AND** neutral day metadata ไม่ทำให้ content มี framing เรื่องวันจันทร์หรือเริ่มต้นสัปดาห์
