# approval-detail-full-content Specification

## Purpose

กำหนดว่ารายละเอียดเนื้อหาที่เปิดจากหน้ารายการอนุมัติ (`/content-approval`) ต้องแสดงข้อมูลครบถ้วนเทียบเท่าหน้าผลงานคอนเทนต์ทั้งหมด โดยใช้ component ชุดเดียวกัน (`ContentArticleView` / `ContentVideoView`) และ dialog ที่ใหญ่พอให้เลื่อนดูได้ทั้งหมด

## Requirements

### Requirement: Approval detail view shows complete content
ระบบ SHALL แสดงรายละเอียดเนื้อหาครบถ้วนเมื่อผู้ใช้คลิกดูเนื้อหาจากหน้ารายการอนุมัติ (`/content-approval`)

#### Scenario: View full article content from approval list
- **WHEN** ผู้ใช้คลิกที่ content item ประเภทบทความในหน้ารายการอนุมัติ
- **THEN** ระบบแสดงมุมมองรายละเอียดที่ประกอบด้วย: ชื่อเนื้อหา, ประเภท (บทความ/วิดีโอ), แพลตฟอร์ม, วันที่กำหนด, เนื้อหาบทความเต็ม (article_content), แคปชั่น, รูปภาพประกอบ (generated_image_url) และข้อมูล SEO (ถ้ามี)

#### Scenario: View full video content from approval list
- **WHEN** ผู้ใช้คลิกที่ content item ประเภทวิดีโอในหน้ารายการอนุมัติ
- **THEN** ระบบแสดงมุมมองรายละเอียดที่ประกอบด้วย: ชื่อเนื้อหา, ประเภท, แพลตฟอร์ม, วันที่กำหนด, video script/content, แคปชั่น, และ thumbnail (ถ้ามี)

#### Scenario: Content detail matches all content page layout
- **WHEN** ผู้ใช้ดูรายละเอียดเนื้อหาจากหน้ารายการอนุมัติ
- **THEN** องค์ประกอบและข้อมูลที่แสดงสอดคล้องกับหน้าผลงานคอนเทนต์ทั้งหมด (`ContentPage` / `ContentDetailView`) — ใช้ component `ContentArticleView` และ `ContentVideoView` เดียวกัน

### Requirement: Approval detail uses dialog with sufficient size
ระบบ SHALL แสดงรายละเอียดเนื้อหาใน dialog ขนาดใหญ่พอที่จะแสดงเนื้อหาครบถ้วน

#### Scenario: Dialog size accommodates full content
- **WHEN** ระบบแสดงรายละเอียดเนื้อหาจากหน้ารายการอนุมัติ
- **THEN** dialog มีขนาด `max-w-4xl max-h-[90vh]` พร้อม overflow-y scroll เพื่อให้สามารถเลื่อนดูเนื้อหาได้ทั้งหมด

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
