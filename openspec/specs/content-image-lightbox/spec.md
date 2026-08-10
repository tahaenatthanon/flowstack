# content-image-lightbox Specification

## ADDED Requirements

### Requirement: User can click image to view full-screen
ระบบ SHALL แสดง lightbox แบบเต็มหน้าจอเมื่อผู้ใช้คลิกที่รูปภาพที่สร้างโดย AI ในหน้า content

#### Scenario: Click image opens lightbox
- **WHEN** ผู้ใช้คลิกที่รูปภาพ (`generated_image_url`) ใน `ContentCardDialog`, `ContentListTab`, `ContentDetailView`, หรือ `ContentArticleView`
- **THEN** ระบบแสดง lightbox พร้อมรูปภาพเต็มความละเอียด, ปุ่มปิด, และ overlay พื้นหลัง

#### Scenario: Close lightbox
- **WHEN** ผู้ใช้คลิกปุ่มปิด, คลิกพื้นหลัง overlay, หรือกด Escape
- **THEN** lightbox ปิดและกลับสู่หน้าปกติ

### Requirement: Lightbox uses existing shadcn-ui components
`ImageViewer` component SHALL ใช้ `Dialog` จาก shadcn-ui เป็น lightbox container

#### Scenario: Lightbox renders with Dialog
- **WHEN** `ImageViewer` เปิดขึ้น
- **THEN** แสดงรูปภาพใน `DialogContent` แบบ full-width, ไม่มีขอบ, รองรับ animation และ keyboard navigation
