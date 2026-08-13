## MODIFIED Requirements

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
