## MODIFIED Requirements

### Requirement: Detail view shows reject reason history
ระบบ SHALL แสดงประวัติการตัดสินใจอนุมัติทุกรอบ (`content_approval_rounds`) ในหน้ารายละเอียดเนื้อหา (`ContentDetailView`) เรียงตามเวลาที่ตัดสินใจ โดยแต่ละรอบแสดงผลการตัดสินใจ (อนุมัติ/ขอแก้ไข/ปฏิเสธ) และเหตุผล (ถ้ามี) — ไม่ใช่แสดงแค่เหตุผลของรอบล่าสุดรอบเดียวเหมือนเดิม

#### Scenario: Show full round-by-round history
- **WHEN** ผู้ใช้เปิดรายละเอียดเนื้อหาที่เคยถูกขอแก้ไขหรือปฏิเสธมาแล้วหลายรอบ
- **THEN** ระบบแสดงรายการทุกรอบเรียงตามเวลา (รอบ 1, รอบ 2, ... ) แต่ละรอบแสดงผลการตัดสินใจและเหตุผลของรอบนั้นแยกกัน ไม่ปะปนกัน

#### Scenario: Show single round when only one decision exists
- **WHEN** ผู้ใช้เปิดรายละเอียดเนื้อหาที่เคยถูกตัดสินใจมาแล้วแค่ 1 ครั้ง
- **THEN** ระบบแสดงประวัติ 1 รอบนั้น

#### Scenario: No history section when never decided
- **WHEN** ผู้ใช้เปิดรายละเอียดเนื้อหาที่ยังไม่เคยผ่านการตัดสินใจอนุมัติเลย (ไม่มีแถวใน `content_approval_rounds`)
- **THEN** ระบบไม่แสดงส่วนประวัติการตัดสินใจ

#### Scenario: Round without reason shows decision only
- **WHEN** รอบใดรอบหนึ่งมีผลการตัดสินใจแต่ไม่มีเหตุผล (เหตุผลเป็นค่าว่าง — ระบุไว้แล้วว่าเหตุผลไม่บังคับกรอก)
- **THEN** ระบบแสดงผลการตัดสินใจของรอบนั้นโดยไม่ต้องมีข้อความเหตุผล

#### Scenario: Content items created before this change show no history
- **WHEN** content item เคยมี `reject_reason` แบบเก่าอยู่ก่อนแล้ว (ก่อน migration นี้) แต่ยังไม่มีการตัดสินใจใหม่เกิดขึ้นหลัง deploy
- **THEN** ระบบแสดงประวัติว่างเปล่า (ไม่ backfill ข้อมูลเก่าให้เป็นรอบปลอม)
