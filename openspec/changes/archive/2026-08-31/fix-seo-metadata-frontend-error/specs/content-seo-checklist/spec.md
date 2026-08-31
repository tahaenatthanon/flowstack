## ADDED Requirements

### Requirement: หน้า SEO/AEO รองรับสถานะ pending
หน้า SEO/AEO Metadata SHALL รองรับ rule level `pending` ที่ส่งจาก endpoint และแสดงผลเป็นสถานะข้อมูลที่ยังไม่ได้กำหนด โดยไม่ทำให้หน้า Page เกิด runtime error

#### Scenario: เปิดแผง SEO ที่มี pending
- **GIVEN** endpoint คืน rule ที่มี `level = 'pending'`
- **WHEN** ผู้ใช้เปิดแผง "SEO / AEO Metadata"
- **THEN** หน้าแสดงรายการ rule พร้อมไอคอนและรูปแบบของสถานะ pending
- **AND** ไม่แสดงข้อผิดพลาดจาก ErrorBoundary ของ Page

#### Scenario: แสดงสถานะ pending เป็นภาษาไทย
- **GIVEN** rule มี `level = 'pending'` และข้อความจาก API ระบุว่ายังไม่ได้กรอกหรือยังไม่ได้กำหนด
- **WHEN** รายการ rule ถูก render
- **THEN** ผู้ใช้เห็นข้อความภาษาไทยตามข้อมูลจาก API
- **AND** pending ไม่ถูกแสดงเป็น fail หรือ warn

### Requirement: หน้า SEO/AEO ป้องกันข้อมูลสถานะที่ไม่รู้จักทำให้ล้ม
ตัวแสดงผล SEO/AEO SHALL มี fallback สำหรับ rule level ที่ frontend ยังไม่รู้จัก เพื่อให้รายการยังแสดงได้และไม่ทำให้ component หลักหยุดทำงาน

#### Scenario: API ส่ง level ใหม่ที่ frontend ยังไม่มี
- **GIVEN** endpoint คืน rule ที่มี level ซึ่งไม่มีใน mapping ปัจจุบัน
- **WHEN** หน้า render รายการ rule
- **THEN** ระบบใช้รูปแบบ fallback ที่ปลอดภัย
- **AND** หน้า SEO/AEO และหน้า Page ยังคงทำงานต่อได้
