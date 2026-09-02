# ai-research-web-search Specification

## Purpose

กำหนด contract ว่า Research AI (ชั้น FETCH, `provider='ai'`) ต้องใช้โมเดลที่ผ่านการยืนยันว่าค้นเว็บจริง และกำหนดค่าคงที่ (model string, base_url, credential resolve path, param บังคับ search) ให้ Phase 2–3 นำไปใช้ได้โดยไม่ต้องเดา

## ADDED Requirements

### Requirement: Research AI model string is verified
ระบบ SHALL ใช้เฉพาะ model string ที่ผ่านการยืนยันว่า gateway ของ provider ที่ใช้งานจริงรับได้และตอบกลับสำเร็จ และ SHALL บันทึก string ที่เลือกเป็นค่าคงที่ของ Research AI พร้อมชื่อ provider/base_url ที่ใช้ยืนยัน

#### Scenario: A supported model string is resolved
- **WHEN** gateway รับ model string และคืน HTTP 200 พร้อม `choices[0].message.content`
- **THEN** string นั้นถูกบันทึกเป็นค่าคงที่ model ของ Research AI

#### Scenario: An unsupported model string is rejected
- **WHEN** gateway ปฏิเสธ model string (HTTP >= 400 หรือ `error` ใน response)
- **THEN** string นั้นไม่ถูกใช้เป็นค่าคงที่ และระบบรายงานว่าต้องลอง string อื่น

### Requirement: Real web search is evidenced by citations
ระบบ SHALL ยืนยันว่า Research AI ค้นเว็บจริงโดยดูหลักฐาน citation/URL ปัจจุบันใน response และ SHALL ไม่ถือว่า search เปิดถ้า response ไม่มี citation หรืออ้างข้อมูล stale ที่ขัดกับเวลาปัจจุบัน

#### Scenario: Response contains current citations
- **WHEN** query ผูกกับเวลาปัจจุบันและ response มี URL ต้นทางที่ชี้ไปหน้า/ข่าวปัจจุบัน
- **THEN** ระบบบันทึกว่า web search เปิดจริงพร้อมตัวอย่าง citation

#### Scenario: Response has no citations or stale sources
- **WHEN** response ไม่มี URL หรืออ้างข้อมูลเก่าที่ขัดกับเวลาปัจจุบัน หรือ URL ปลอมที่เข้าไม่ถึง
- **THEN** ระบบบันทึกว่า search ไม่เปิดจริง และสรุป "ต้องเปลี่ยน gateway/provider"

#### Scenario: Citation field location is recorded
- **WHEN** ยืนยันแล้วว่า search เปิดจริง
- **THEN** ระบบบันทึก **field path ที่ citation อยู่จริง** ใน response ของ gateway นั้นเป็นค่าคงที่ให้ Phase 2 อ่าน — และ SHALL ไม่สมมติว่าอยู่ที่ `citations[]` โดยไม่ตรวจ เพราะ gateway ต่างตัววาง citation คนละที่

### Requirement: Mandatory search parameters are identified
ระบบ SHALL ระบุ param (ถ้ามี) ที่จำเป็นต่อการบังคับให้ gateway เปิด web search และ SHALL บันทึก payload ขั้นต่ำที่ทำให้ search ได้ผลน่าเชื่อถือ

#### Scenario: A parameter enables search
- **WHEN** payload ที่มี param เฉพาะทำให้ response มี citation ขณะที่ payload ที่ไม่มี param ไม่มี
- **THEN** ระบบบันทึก param นั้นเป็น param บังคับ search

#### Scenario: No extra parameter is required
- **WHEN** search เปิดได้ด้วย model string เพียงอย่างเดียวโดยไม่ต้องส่ง param พิเศษ
- **THEN** ระบบบันทึกว่าไม่ต้องส่ง param บังคับ search

### Requirement: Credential resolution path is verified
ระบบ SHALL ยืนยันว่า credential resolve path เดิม (`resolveAICreds()`: DB `ai_providers` → env token fallback) ใช้กับ sonar ได้จริงกับ provider ที่ใช้งานจริง และ SHALL บันทึก path ที่ Research AI ใช้ resolve key

#### Scenario: DB provider credential works
- **WHEN** key จาก `ai_providers` ของ provider ที่ใช้งานจริง ถอดรหัสด้วย `decryptApiKey()` แล้วใช้ยิง sonar สำเร็จ
- **THEN** ระบบบันทึกว่า Research AI resolve key จาก `ai_providers`

#### Scenario: Environment token fallback works
- **WHEN** ไม่มี key ใน DB แต่มี env token ของ provider นั้นและยิง sonar สำเร็จ
- **THEN** ระบบบันทึกว่า env fallback ใช้ได้จริง พร้อมชื่อตัวแปร env ที่ใช้

### Requirement: Verification conclusion gates later phases
ระบบ SHALL บันทึกข้อสรุป "ผ่าน" หรือ "ต้องเปลี่ยน gateway/provider" พร้อมค่าคงที่ลงในไฟล์ข้อสรุปที่ Phase 2–3 อ้างอิง และ SHALL ไม่เริ่ม Phase 2 ก่อนข้อสรุปชัด

#### Scenario: Verification passes
- **WHEN** model string, citation, param และ credential path ผ่านทุกข้อ
- **THEN** ข้อสรุป "ผ่าน" พร้อมค่าคงที่ถูกบันทึกและ Phase 2 เริ่มได้

#### Scenario: Verification fails
- **WHEN** ข้อใดข้อหนึ่งไม่ผ่านและไม่สามารถแก้ด้วย string/param ที่ลองแล้ว
- **THEN** ข้อสรุป "ต้องเปลี่ยน gateway/provider" ถูกบันทึกและ Phase 2 ถูกระงับ
