## Purpose

กำหนดให้การสร้างคอนเทนต์ไม่คูณจำนวนรายการด้วยจำนวน platform ที่เลือก — platform เป็นช่องทางเผยแพร่ ไม่ใช่ตัวคูณรายการ

## Requirements

### Requirement: Generate ไม่คูณจำนวนรายการด้วยจำนวน platform
เมื่อผู้ใช้เลือกหลาย platform ในการสร้างคอนเทนต์ ระบบ SHALL สร้าง `content_plan_items` และ `content_items` 1 รายการต่อ topic/generate โดยไม่สร้างรายการแยกต่อ platform และ platform ที่เลือก SHALL ถูกเก็บเป็นรายการช่องทางเผยแพร่ของคอนเทนต์นั้น โดย 1 วัน SHALL สามารถมีหลายรายการจากหลาย topic/generate ได้

#### Scenario: เลือก 3 platform สร้าง 1 คอนเทนต์
- **WHEN** ผู้ใช้ส่ง `generate-plan` พร้อม `platforms: ['facebook','linkedin','instagram']` และ 1 topic
- **THEN** ระบบสร้าง `content_items` เพียง 1 รายการสำหรับ topic นั้น
- **AND** รายการ platform ทั้ง 3 ค่าถูกบันทึกไว้กับคอนเทนต์นั้น

#### Scenario: หลาย topic ในวันเดียวกันสร้างหลายรายการ
- **WHEN** แผนสร้างหลาย topic ที่มี `scheduled_date` เป็นวันเดียวกัน
- **THEN** ระบบสร้าง `content_items` หลายรายการในวันนั้นได้
- **AND** แต่ละรายการเก็บรายการ platform ของตัวเอง

### Requirement: รายการ platform ที่เลือกถูกเก็บเป็นช่องทางเผยแพร่
คอนเทนต์ SHALL เก็บรายการ platform ที่ผู้ใช้เลือกในคอลัมน์ `platforms` (JSON array) และ SHALL เก็บค่าแรกของรายการไว้ในคอลัมน์ `platform` เดิมเพื่อความเข้ากันได้กับฟีเจอร์เดิม

#### Scenario: บันทึกรายการ platform เป็น JSON
- **WHEN** ผู้ใช้เลือก `['tiktok','youtube']`
- **THEN** `content_items.platforms` เก็บ `["tiktok","youtube"]`
- **AND** `content_items.platform` เก็บ `"tiktok"` (ค่าแรก)

#### Scenario: ค่าเดิมยังทำงานเมื่อเลือก platform เดียว
- **WHEN** ผู้ใช้เลือกเพียง 1 platform
- **THEN** `content_items.platforms` เก็บรายการค่าเดียว และ `platform` เก็บค่าเดียวกัน

### Requirement: Publish flow ใช้รายการ platform และ script เฉพาะ platform
การเผยแพร่ SHALL ใช้รายการ platform ที่บันทึกไว้ (ผ่าน `platforms` แล้ว fallback ไป `platform`) เป็นช่องทางเป้าหมาย และ SHALL เลือก `article_content.scripts[platform]` เมื่อมีค่า โดยคง fallback ไป caption/article HTML เดิมเมื่อไม่มี script

#### Scenario: dispatch หลายช่องทางจากคอนเทนต์เดียว
- **WHEN** คอนเทนต์มี `platforms: ['facebook','linkedin']` และมี `scripts.facebook` กับ `scripts.linkedin`
- **THEN** การเผยแพร่สามารถ dispatch ไปทั้งสองช่องทางโดยแต่ละช่องทางใช้ script ของตัวเอง

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
