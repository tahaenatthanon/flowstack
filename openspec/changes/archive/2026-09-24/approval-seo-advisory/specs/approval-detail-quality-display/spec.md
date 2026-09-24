## ADDED Requirements

### Requirement: SEO/AEO แสดงทันทีตอนเปิดดูเนื้อหา
`ContentDetailView` ที่ `context='approval'` SHALL ดึงและแสดงผลตรวจ SEO/AEO Checklist ทันทีที่เปิดดูเนื้อหา (ไม่ต้องรอผู้ใช้กดปุ่ม "อนุมัติ" ก่อน) — ยกเว้นคอนเทนต์ประเภทวิดีโอ (`item.type === 'video'`) ซึ่งไม่ผ่าน SEO/AEO gate อยู่แล้วตาม capability `quality-required-gate`

#### Scenario: เปิดดูเนื้อหาบทความเห็น SEO/AEO ทันที
- **WHEN** manager เปิดหน้ารายละเอียดของคอนเทนต์ `type='article'` จากรายการอนุมัติ
- **THEN** ระบบดึงผลตรวจ SEO และ AEO และแสดง `QualityChecklist` ทั้งสองทันที โดยไม่ต้องกดปุ่ม "อนุมัติ" ก่อน

#### Scenario: เปิดดูเนื้อหาวิดีโอไม่แสดง SEO/AEO
- **WHEN** manager เปิดหน้ารายละเอียดของคอนเทนต์ `type='video'` จากรายการอนุมัติ
- **THEN** ระบบไม่ดึงและไม่แสดงผลตรวจ SEO/AEO

### Requirement: ผล SEO/AEO เป็นข้อมูลประกอบการตัดสินใจ ไม่บล็อกปุ่มอนุมัติ
หน้ารายละเอียดฝั่งอนุมัติ SHALL ไม่ปิดใช้งานปุ่ม "อนุมัติ" หรือแสดงข้อความบล็อกใดๆ จากผล SEO/AEO — ปุ่ม "อนุมัติ" SHALL กดได้เสมอเมื่อ `item.status === 'pending_approval'` ไม่ว่าผล SEO/AEO จะเป็นอย่างไร

#### Scenario: กดอนุมัติได้แม้ SEO/AEO ไม่ผ่าน
- **WHEN** manager เปิดดูเนื้อหาที่มี Required rule ของ SEO เป็น `failed` แล้วกดปุ่ม "อนุมัติ"
- **THEN** ระบบไม่แสดงข้อความบล็อกใดๆ และดำเนินการเปลี่ยนสถานะเป็น `approved` ได้สำเร็จเมื่อยืนยัน

### Requirement: Dialog ยืนยันอนุมัติไม่แสดง SEO/AEO ซ้ำ
Dialog ยืนยันการอนุมัติ (เปิดหลังกดปุ่ม "อนุมัติ") SHALL ไม่แสดง `QualityChecklist` ของ SEO/AEO อีก เนื่องจากผู้ใช้เห็นข้อมูลนี้ไปแล้วตอนเปิดดูเนื้อหา

#### Scenario: Confirm dialog มีแค่ข้อความยืนยัน
- **WHEN** manager กดปุ่ม "อนุมัติ" เพื่อเปิด dialog ยืนยัน
- **THEN** dialog แสดงเฉพาะข้อความยืนยันการอนุมัติ (ชื่อคอนเทนต์ + คำถามยืนยัน) — ไม่มีส่วน SEO/AEO Checklist หรือข้อความ "เกต SEO/AEO เปิดอยู่"
