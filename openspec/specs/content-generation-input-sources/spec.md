# content-generation-input-sources Specification

## Purpose

กำหนดกติกา "อย่างน้อย 1 แหล่งข้อมูล" สำหรับการสร้างคอนเทนต์แบบ Direct mode (QuickCreateDialog และ BatchGenerateDialog ทั้งบทความและวีดีโอสคริปต์) — หัวข้อ, Trigger, Skill และ Knowledge Base นับเป็นแหล่งข้อมูลให้ AI เท่ากัน ไม่บังคับหัวข้อเป็นช่องเดียว ครอบคลุมทั้ง client (ปุ่มเปิดใช้งาน/validation ต่อแถว) และ server (`content_plan_has_any_topic_source()` ใน `generate-plan`) — ที่มา: change `content-campaign-optional-topic-sources`

## Requirements

### Requirement: Direct mode ผ่านได้เมื่อมีอย่างน้อย 1 ใน 4 แหล่งข้อมูล
เมื่อสร้างคอนเทนต์แบบ Direct mode (`generation_mode=direct`) ทั้งจาก QuickCreateDialog และ BatchGenerateDialog ระบบ SHALL อนุญาตให้ดำเนินการต่อเมื่อมีอย่างน้อยหนึ่งใน: หัวข้อที่พิมพ์เอง (`source_topic`), Trigger ที่เลือก (`trigger_ids`), Skill ที่เลือก (`skill_ids`), หรือ Knowledge Base ที่เลือก (`brand_context_ids`) — ระบบ SHALL ไม่บังคับให้ต้องมีหัวข้อเสมอไปอีกต่อไป

#### Scenario: มีแค่ Trigger ไม่มีหัวข้อ
- **WHEN** ผู้ใช้เลือก Trigger อย่างน้อย 1 รายการ แต่ไม่ได้พิมพ์หัวข้อ ไม่ได้เลือก Skill หรือ Knowledge Base
- **THEN** ปุ่มสร้าง/เริ่มสร้าง เปิดใช้งานได้ และคำขอ `generate-plan` ไม่ถูกปฏิเสธ

#### Scenario: มีแค่ Skill ไม่มีหัวข้อ
- **WHEN** ผู้ใช้เลือก Skill อย่างน้อย 1 รายการ แต่ไม่ได้พิมพ์หัวข้อ ไม่ได้เลือก Trigger หรือ Knowledge Base
- **THEN** ปุ่มสร้าง/เริ่มสร้าง เปิดใช้งานได้ และคำขอ `generate-plan` ไม่ถูกปฏิเสธ

#### Scenario: มีแค่ Knowledge Base ไม่มีหัวข้อ
- **WHEN** ผู้ใช้เลือก Knowledge Base อย่างน้อย 1 รายการ แต่ไม่ได้พิมพ์หัวข้อ ไม่ได้เลือก Trigger หรือ Skill
- **THEN** ปุ่มสร้าง/เริ่มสร้าง เปิดใช้งานได้ และคำขอ `generate-plan` ไม่ถูกปฏิเสธ

#### Scenario: ไม่มีแหล่งข้อมูลใดเลย
- **WHEN** ผู้ใช้ไม่ได้พิมพ์หัวข้อ ไม่ได้เลือก Trigger, Skill, หรือ Knowledge Base เลย
- **THEN** ปุ่มสร้าง/เริ่มสร้าง ถูกปิดใช้งาน (client) และคำขอ `generate-plan` ถูกปฏิเสธด้วยข้อความให้ระบุแหล่งข้อมูลอย่างน้อยหนึ่งอย่าง (server)

### Requirement: Batch generation เช็คแหล่งข้อมูลต่อแถวหัวข้อ
`BatchGenerateDialog` SHALL เช็คกติกา "อย่างน้อย 1 ใน 4 แหล่งข้อมูล" แยกเป็นรายแถว (แต่ละหัวข้อในการรันเดียวกัน) — แถวที่ไม่มีแหล่งข้อมูลใดเลย SHALL ถูกรายงานเป็น error ก่อนเริ่มสร้าง โดยไม่กระทบเงื่อนไขจำนวนแถวขั้นต่ำ (`MIN_TOPICS`) หรือการเลือกแพลตฟอร์มต่อแถวที่มีอยู่เดิม

#### Scenario: บางแถวมีแค่ Trigger บางแถวมีหัวข้อ
- **WHEN** ผู้ใช้กรอก 3 แถว โดยแถวที่ 1 มีหัวข้อ แถวที่ 2 เลือก Trigger อย่างเดียว แถวที่ 3 เลือก Skill อย่างเดียว
- **THEN** ทั้ง 3 แถวผ่านการตรวจสอบ ไม่มี error รายงาน (ตราบใดที่ทุกแถวเลือกแพลตฟอร์มแล้ว)

#### Scenario: มีแถวที่ไม่มีแหล่งข้อมูลเลย
- **WHEN** แถวใดแถวหนึ่งไม่มีทั้งหัวข้อ Trigger Skill และ Knowledge Base
- **THEN** ระบบรายงาน error ของแถวนั้นก่อนเริ่มสร้าง ระบุว่ายังไม่มีแหล่งข้อมูล

### Requirement: content_plan_has_any_topic_source นับ Skill และ Knowledge Base เป็นแหล่งข้อมูล
ฟังก์ชัน `content_plan_has_any_topic_source()` (`api/lib/content-plan-prompt.php`) SHALL รับพารามิเตอร์เพิ่ม `array $skillIds` และ `array $brandContextIds` และคืนค่า `true` เมื่อมีค่าใดค่าหนึ่งไม่ว่างจาก: `triggerIds`, `triggerCommand`, `sourceTopic`, `skillIds`, `brandContextIds`

#### Scenario: skillIds ไม่ว่างเพียงอย่างเดียว
- **WHEN** เรียกฟังก์ชันด้วย `triggerIds=[]`, `triggerCommand=''`, `sourceTopic=''`, `skillIds=['skill-1']`, `brandContextIds=[]`
- **THEN** ฟังก์ชันคืนค่า `true`

#### Scenario: brandContextIds ไม่ว่างเพียงอย่างเดียว
- **WHEN** เรียกฟังก์ชันด้วยทุกพารามิเตอร์ว่างยกเว้น `brandContextIds=['ctx-1']`
- **THEN** ฟังก์ชันคืนค่า `true`

#### Scenario: ทุกพารามิเตอร์ว่าง
- **WHEN** เรียกฟังก์ชันด้วยทุกพารามิเตอร์ว่างหมด
- **THEN** ฟังก์ชันคืนค่า `false`
