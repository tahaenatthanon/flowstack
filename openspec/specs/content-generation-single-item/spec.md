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
