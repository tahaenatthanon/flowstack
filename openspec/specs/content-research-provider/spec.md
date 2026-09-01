# Content Research Provider

## Purpose

แยกการเชื่อมต่อและการแปลงผล DataForSEO ออกจาก Research API เพื่อให้เปลี่ยนหรือเพิ่ม provider ได้ภายหลัง

## Requirements

### Requirement: DataForSEO credentials are tested
ระบบ SHALL รองรับการทดสอบ DataForSEO credential ผ่าน endpoint user data และ SHALL คืนผลสำเร็จ/ล้มเหลวโดยไม่เปิดเผย credential

#### Scenario: Valid credentials are tested
- **WHEN** ระบบได้รับ credential ที่ถูกต้อง
- **THEN** adapter คืนผลสำเร็จและข้อมูล balance ที่ provider ส่งมาได้ โดยไม่มี password ใน response

#### Scenario: Invalid credentials are tested
- **WHEN** provider ปฏิเสธ credential
- **THEN** adapter คืนผลล้มเหลวพร้อมข้อความที่ endpoint แปลงเป็นภาษาไทย

### Requirement: Provider responses are normalized
adapter SHALL normalize SERP, PAA, related searches และ keyword metrics เป็น shape กลางที่ endpoint ใช้ได้โดยไม่รู้โครงสร้างเฉพาะของ DataForSEO

#### Scenario: Provider returns research data
- **WHEN** ทั้งสาม provider calls สำเร็จ
- **THEN** adapter คืน `serp`, `keywords`, `raw` และ `cost_usd` ในรูปแบบกลาง

### Requirement: Missing provider metrics remain null
adapter SHALL แปลง metric ที่ไม่มีใน provider response เป็น `null` และ SHALL ไม่เติมค่า `0` แทนข้อมูลที่ไม่ทราบ

#### Scenario: Provider omits a metric
- **WHEN** keyword ไม่มี search volume หรือ difficulty
- **THEN** normalized keyword มี field นั้นเป็น `null`

### Requirement: Provider failures are explicit
adapter SHALL ตรวจ HTTP status, provider status code, response shape และ timeout แล้วคืน error ที่ endpoint จัดการได้

#### Scenario: Provider request times out
- **WHEN** DataForSEO ไม่ตอบกลับภายใน timeout
- **THEN** adapter คืนผลล้มเหลวโดยไม่คืนข้อมูลบางส่วนเป็นผลสำเร็จ

### Requirement: Research settings UI can test DataForSEO credentials
หน้า Research settings SHALL ให้ผู้ดูแลกดทดสอบการเชื่อมต่อ DataForSEO ผ่าน `api/content-research.php?action=test` ได้เมื่อเลือก provider เป็น DataForSEO และมี login/password ที่บันทึกไว้หรือกรอกใหม่

#### Scenario: Test succeeds from settings UI
- **WHEN** ผู้ดูแลกดปุ่มทดสอบการเชื่อมต่อและ backend คืน `ok: true`
- **THEN** UI แสดงข้อความภาษาไทยว่าเชื่อมต่อสำเร็จและแสดง balance ถ้ามี โดยไม่แสดง credential

#### Scenario: Test fails from settings UI
- **WHEN** ผู้ดูแลกดปุ่มทดสอบการเชื่อมต่อและ backend คืน `ok: false` หรือ HTTP error
- **THEN** UI แสดงข้อความภาษาไทยว่าเชื่อมต่อไม่สำเร็จและไม่ล้างค่าที่ผู้ใช้กรอกในฟอร์ม

#### Scenario: Test button is disabled only when test cannot run
- **WHEN** provider ไม่ใช่ DataForSEO หรือกำลังบันทึก/ทดสอบอยู่
- **THEN** ปุ่มทดสอบถูก disabled
- **AND** เมื่อ provider เป็น DataForSEO และมี credential พร้อมใช้ ปุ่มต้องกดได้
