## MODIFIED Requirements

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
