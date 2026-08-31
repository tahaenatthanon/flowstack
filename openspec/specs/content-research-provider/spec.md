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
