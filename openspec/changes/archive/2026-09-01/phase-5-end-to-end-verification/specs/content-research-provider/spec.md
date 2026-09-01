## ADDED Requirements

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
