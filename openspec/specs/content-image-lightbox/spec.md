# content-image-lightbox Specification

## Requirements

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

### Requirement: Image hover does not expand container beyond image size
ระบบ SHALL แสดงรูปภาพเมื่อ hover โดย container ไม่ขยายจนมีขนาดใหญ่กว่ารูปและไม่บดบังเนื้อหา — รูปแสดงในขนาดธรรมชาติเต็มพื้นที่

#### Scenario: Container matches image size
- **WHEN** ผู้ใช้ hover บนรูปภาพใน content list หรือรายละเอียดเนื้อหา
- **THEN** container ที่แสดงรูปมีขนาดพอดีกับรูป — ไม่มี `min-height` ที่บังคับให้ container ใหญ่เกินรูป

#### Scenario: Full image visible
- **WHEN** ผู้ใช้ดูรูปภาพใน ImageViewer dialog
- **THEN** รูปภาพแสดงในขนาด `object-contain` ภายใน `max-w-[90vw] max-h-[90vh]` — เห็นภาพอย่างชัดเจนโดยไม่ถูก crop หรือมีพื้นที่ว่างรอบข้างมากเกินไป

#### Scenario: Zoom-out click closes viewer
- **WHEN** ผู้ใช้คลิกที่พื้นหลังของ ImageViewer dialog
- **THEN** dialog ปิด — ยังคงมีปุ่ม X ปิดด้วยตนเอง

### Requirement: รูปปกในหน้ารายละเอียดคอนเทนต์แสดงเต็มรูป
ระบบ SHALL แสดงรูปปก (`generated_image_url`) ในหน้ารายละเอียดคอนเทนต์ (`ContentArticleView` และ `ContentVideoView`) โดยใช้ `object-contain` เพื่อให้เห็นรูปเต็มโดยไม่ถูกตัด และกรอบ/overlay ขยายพอดีกับขอบเขตของรูป

#### Scenario: รูปปกไม่ถูกตัด
- **WHEN** ผู้ใช้เปิดรายละเอียดคอนเทนต์ที่มีรูปปก
- **THEN** รูปปกแสดงเต็มรูปโดยไม่ถูกครอปด้วย `object-cover`

#### Scenario: overlay hover ครอบคลุมเฉพาะรูป
- **WHEN** ผู้ใช้เลื่อนเมาส์ไปวางบนรูปปกใน `ContentArticleView`
- **THEN** overlay (ไอคอนซูม) ครอบคลุมเฉพาะขอบเขตของรูป ไม่ขยายเกินกรอบ

#### Scenario: กรอบพอดีกับรูป
- **WHEN** รูปปกมีอัตราส่วนต่างจาก container
- **THEN** container/overlay ขยายตามขนาดรูป (fit) ไม่แสดงกรอบเกินขอบเขตรูป
