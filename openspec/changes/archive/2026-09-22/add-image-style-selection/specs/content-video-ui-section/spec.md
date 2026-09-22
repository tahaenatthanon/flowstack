## MODIFIED Requirements

### Requirement: Empty state เมื่อยังไม่มี scene
เมื่อ `article_content.scenes` ว่างเปล่าหรือไม่มี ระบบ SHALL แสดง section "ฉากวิดีโอ" พร้อมข้อความ "ยังไม่มีฉาก กด 'สร้างภาพทุกฉาก' เพื่อเริ่มสร้าง" — SHALL ไม่ซ่อน section นี้ไปทั้งหมด ข้อความนี้ SHALL ไม่มีปุ่ม "สร้างภาพทุกฉาก" ของตัวเองอยู่ใน empty state (อ้างอิงถึงปุ่ม "สร้างภาพทุกฉาก" ที่แสดงอยู่แล้วนอก scene cards เสมอ — ดู requirement ปุ่มเดียวต่อหน้าด้านล่าง)

#### Scenario: Content item ที่ยังไม่เคยสร้าง scene เลย
- **WHEN** ผู้ใช้เปิด `ContentVideoView` หรือ section "วิดีโอ" ใน `ContentCardDialog` ของ content item ที่ `scenes` ว่างเปล่า
- **THEN** เห็น section "ฉากวิดีโอ" พร้อมข้อความชวนสร้าง โดยไม่มีปุ่มอยู่ในข้อความนั้น — ผู้ใช้กดปุ่ม "สร้างภาพทุกฉาก" ที่อยู่นอก section นี้แทน

## ADDED Requirements

### Requirement: ปุ่ม "สร้างภาพทุกฉาก" มีเพียงปุ่มเดียวต่อหน้า
ในแต่ละหน้าที่แสดง video content (`ContentCardDialog` section "วิดีโอ" และ `ContentVideoView`) SHALL มีปุ่ม "สร้างภาพทุกฉาก" อยู่เพียงปุ่มเดียวเสมอ ไม่ว่า scenes จะว่างหรือมีอยู่แล้ว — ปุ่มนี้ SHALL ไม่ผูกเงื่อนไขการแสดงผลกับสถานะว่าง/ไม่ว่างของ scenes (แสดงตลอดเวลา) และ SHALL ใช้สไตล์ปุ่มไม่มีพื้นหลัง (`variant="outline"`) ใน `ContentCardDialog`

#### Scenario: ContentCardDialog มีปุ่มเดียวไม่ว่า scenes จะว่างหรือไม่
- **WHEN** ผู้ใช้เปิด section "วิดีโอ" ใน `ContentCardDialog` ไม่ว่า content item จะมี scene อยู่แล้วหรือยังไม่มี
- **THEN** เห็นปุ่ม "สร้างภาพทุกฉาก" สไตล์ไม่มีพื้นหลังเพียงปุ่มเดียว (ไม่มีปุ่มที่สองซ้อนอยู่ใน scene cards ด้านล่าง)

#### Scenario: ContentVideoView มีปุ่มเดียวไม่ว่า scenes จะว่างหรือไม่
- **WHEN** ผู้ใช้เปิด `ContentVideoView` ไม่ว่า content item จะมี scene อยู่แล้วหรือยังไม่มี
- **THEN** เห็นปุ่ม "สร้างภาพทุกฉาก" เพียงปุ่มเดียวในแถบปุ่มด้านล่าง (ไม่มีปุ่มที่สองซ้อนอยู่ใน scene cards ด้านบน)
