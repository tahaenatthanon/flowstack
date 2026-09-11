# content-scheduled-date-lock Specification

## Purpose

ป้องกันการเปลี่ยน `scheduled_date` ของ content item ที่มีอย่างน้อย 1 แพลตฟอร์ม (จาก `platforms[]`) เผยแพร่สำเร็จไปแล้ว ไม่ว่าจะแก้ผ่านการลากบนปฏิทิน (`ContentPlannerCalendar`) หรือพิมพ์วันที่ในฟอร์มแก้ไขการ์ด (`ContentCardDialog`) — เพื่อไม่ให้ "วันที่ตามแผน" ขัดแย้งกับความจริงที่เกิดขึ้นแล้วบนแพลตฟอร์ม content item ที่ยังไม่เผยแพร่แพลตฟอร์มใดเลย (รวมถึงที่มีคิวเผยแพร่ตั้งไว้ล่วงหน้าแต่ยังไม่ยิง) ไม่ได้รับผลกระทบ และการล็อกเป็นแบบรายการ์ง (per content item) ไม่กระทบ item อื่นในวันเดียวกัน

## Requirements

### Requirement: Content item ที่มีแพลตฟอร์มใดเผยแพร่แล้วต้องล็อก scheduled_date ที่ backend
API SHALL ปฏิเสธคำขอเปลี่ยน `scheduled_date` ของ content item ด้วย HTTP 409 เมื่อ content item นั้นมีอย่างน้อย 1 แพลตฟอร์มใน `platforms` ที่เผยแพร่สำเร็จแล้ว (ตามผลลัพธ์ของ `get_published_content_platforms()`) ไม่ว่าคำขอจะมาจาก `action=plan-item-date` หรือ `action=plans` (PUT พร้อม `item_id`+`scheduled_date`) ใน `api/brand-content.php`

#### Scenario: ลากเปลี่ยนวันของ content ที่เผยแพร่ Facebook ไปแล้ว
- **WHEN** ผู้ใช้ส่ง `PUT /brand-content.php?action=plan-item-date` พร้อม `item_id` ของ content item ที่มี `platforms=["facebook","instagram"]` และ Facebook มีสถานะ `sent` ใน `content_publish_queue` หรือ `content_schedules`
- **THEN** ระบบตอบ HTTP 409 พร้อมข้อความภาษาไทยระบุว่าเผยแพร่ไปแล้วบางแพลตฟอร์ม
- **AND** `scheduled_date` ของ content item ยังคงค่าเดิมทั้งใน `content_items` และ `content_plan_items`

#### Scenario: แก้วันที่ในฟอร์มแก้ไขการ์ดของ content ที่เผยแพร่แล้ว
- **WHEN** ผู้ใช้ส่ง `PUT /brand-content.php?action=plans&id=<plan_id>` พร้อม `item_id` และ `scheduled_date` ใหม่ สำหรับ content item ที่มีแพลตฟอร์มใดแพลตฟอร์มหนึ่งเผยแพร่สำเร็จแล้ว
- **THEN** ระบบตอบ HTTP 409 และไม่อัปเดต `scheduled_date`
- **AND** field อื่นในคำขอเดียวกัน (เช่น `caption`, `topic`) ที่ไม่เกี่ยวกับ `scheduled_date` ยังคงอัปเดตได้ตามปกติถ้าส่งมาด้วย

#### Scenario: เผยแพร่ครบทุกแพลตฟอร์มแล้วก็ยังคงล็อก
- **WHEN** content item เผยแพร่สำเร็จครบทุกแพลตฟอร์มที่เลือกไว้ (`content_items.status='published'`)
- **THEN** คำขอเปลี่ยน `scheduled_date` ทั้งสอง action ถูกปฏิเสธด้วย HTTP 409 เช่นเดียวกับกรณีเผยแพร่บางส่วน

### Requirement: Content item ที่ยังไม่เผยแพร่แพลตฟอร์มใดเลยยังคงแก้ scheduled_date ได้ตามปกติ
API SHALL ยอมรับคำขอเปลี่ยน `scheduled_date` ตามปกติเมื่อ content item ไม่มีแพลตฟอร์มใดเผยแพร่สำเร็จ แม้ว่า item นั้นจะมี `scheduled_date` ตั้งไว้แล้ว หรือมีคิวเผยแพร่ที่ยังไม่เสร็จสิ้น (`pending`/`processing`) อยู่ก็ตาม

#### Scenario: ลากเปลี่ยนวันของ content ที่ยังไม่เผยแพร่เลย
- **WHEN** ผู้ใช้ลาก content item ที่ยังไม่มีแพลตฟอร์มใดเผยแพร่สำเร็จไปวางบนวันที่อื่นในปฏิทิน
- **THEN** ระบบอัปเดต `scheduled_date` สำเร็จตามพฤติกรรมเดิม

#### Scenario: content ที่มีคิวเผยแพร่ตั้งไว้ล่วงหน้าแต่ยังไม่ถึงเวลายิง
- **WHEN** content item มี `content_schedules` หรือ `content_publish_queue` สถานะ `pending` หรือ `processing` อยู่ (ยังไม่มีแพลตฟอร์มใด `sent`)
- **THEN** คำขอเปลี่ยน `scheduled_date` ยังคงสำเร็จตามปกติ ไม่ถูกปฏิเสธ

#### Scenario: content item อื่นในวันเดียวกันไม่ได้รับผลกระทบ
- **WHEN** content item A ที่มีแพลตฟอร์มเผยแพร่แล้วถูกล็อก และ content item B ที่ยังไม่เผยแพร่อยู่ในวันเดียวกับ A
- **THEN** คำขอเปลี่ยน `scheduled_date` ของ B ยังคงสำเร็จตามปกติ ไม่ได้รับผลจากสถานะของ A

### Requirement: รายการ content item บนปฏิทินต้องมีสถานะล็อกให้ frontend ใช้โดยไม่ยิง request แยกต่อรายการ
Endpoint ที่ hydrate รายการ content item สำหรับปฏิทิน (`action=plans&id=<id>` และผลลัพธ์หลัง `action=generate-plan`) SHALL เพิ่ม field `has_published_platform` (boolean) ต่อ item โดยคำนวณจากแหล่งเดียวกับ `get_published_content_platforms()` ภายใน query เดียวกับที่ดึงรายการอยู่แล้ว โดยไม่เพิ่มจำนวน request ต่อรายการ

#### Scenario: โหลดแผนที่มี content item ทั้งเผยแพร่แล้วและยังไม่เผยแพร่ปนกัน
- **WHEN** ผู้ใช้เปิดปฏิทินและระบบเรียก `action=plans&id=<id>`
- **THEN** ผลลัพธ์แต่ละ item มี field `has_published_platform` เป็น `true` เมื่อมีแพลตฟอร์มใดแพลตฟอร์มหนึ่งเผยแพร่สำเร็จแล้ว และเป็น `false` เมื่อยังไม่มี
- **AND** จำนวน HTTP request ที่เกิดขึ้นไม่เพิ่มขึ้นตามจำนวน content item ในแผน

### Requirement: ปฏิทินต้องปิดการลาก content item ที่ถูกล็อก
`ContentPlannerCalendar` SHALL ปิด `draggable` ของ chip ที่แสดง content item ซึ่ง `has_published_platform` เป็น `true` และแสดงสัญลักษณ์ให้ผู้ใช้ทราบว่า item นี้ถูกล็อก โดยไม่กระทบ `draggable` ของ item อื่นในวันเดียวกันที่ `has_published_platform` เป็น `false`

#### Scenario: พยายามลาก chip ที่ถูกล็อกบนปฏิทิน
- **WHEN** ผู้ใช้พยายามลาก chip ของ content item ที่ `has_published_platform=true`
- **THEN** การลากไม่เริ่มต้น (ไม่มี `dragstart` เกิดขึ้น) และ chip แสดงสัญลักษณ์ล็อก

#### Scenario: ลาก chip ที่ไม่ถูกล็อกในวันเดียวกับ chip ที่ถูกล็อก
- **WHEN** วันเดียวกันมีทั้ง chip ที่ถูกล็อกและไม่ถูกล็อก
- **THEN** ผู้ใช้ลาก chip ที่ไม่ถูกล็อกได้ตามปกติ

### Requirement: ฟอร์มแก้ไขการ์ดต้องปิดช่องแก้วันที่เมื่อ item ถูกล็อก
`ContentCardDialog` SHALL ปิดการแก้ไข (disable) ช่อง input วันที่เผยแพร่เมื่อ `existingItem.has_published_platform` เป็น `true` และแสดงข้อความอธิบายเหตุผลที่แก้ไม่ได้

#### Scenario: เปิด dialog แก้ไข content ที่เผยแพร่บางแพลตฟอร์มไปแล้ว
- **WHEN** ผู้ใช้เปิด `ContentCardDialog` สำหรับ content item ที่ `has_published_platform=true`
- **THEN** ช่อง input วันที่ถูก disable และแสดงข้อความภาษาไทยอธิบายว่าเผยแพร่ไปแล้วบางแพลตฟอร์มจึงแก้วันที่ไม่ได้
- **AND** ช่องข้อมูลอื่นที่ไม่เกี่ยวกับวันที่ยังแก้ไขได้ตามปกติ (ถ้าไม่ถูกล็อกด้วยกฎอื่น)

### Requirement: รายการ content item แบบ list ต้องปิดการลาก item ที่ถูกล็อกเช่นเดียวกับปฏิทิน
`ContentItemList` SHALL ปิด `draggable` ของแถวที่ `has_published_platform` เป็น `true` เพื่อความสอดคล้องกับพฤติกรรมในปฏิทิน

#### Scenario: พยายามลากแถวที่ถูกล็อกในมุมมองรายการ
- **WHEN** ผู้ใช้พยายามลากแถวของ content item ที่ `has_published_platform=true` ในมุมมองรายการ
- **THEN** การลากไม่เริ่มต้น
