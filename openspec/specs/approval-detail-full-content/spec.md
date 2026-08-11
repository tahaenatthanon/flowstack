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
