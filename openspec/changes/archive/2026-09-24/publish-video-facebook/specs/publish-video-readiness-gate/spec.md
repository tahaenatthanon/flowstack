## ADDED Requirements

### Requirement: คอนเทนต์วิดีโอต้องมีไฟล์พร้อมจริงก่อนเผยแพร่
`final_publish_gate_check()` SHALL ปฏิเสธการเผยแพร่คอนเทนต์ที่ `type === 'video'` เมื่อ `video_gen_status !== 'done'` หรือไฟล์ที่ `video_url` ชี้ถึงไม่มีอยู่จริงบนดิสก์ — การเช็คนี้ SHALL ทำงานก่อน dispatch จริงไปยังปลายทางเสมอ (ไม่ปล่อยให้ไป error ที่ `dispatch_facebook()`)

#### Scenario: วิดีโอยังไม่เสร็จถูกปฏิเสธ
- **GIVEN** คอนเทนต์ `type='video'` ที่ `video_gen_status` ไม่ใช่ `'done'` (เช่น `'none'` หรือค่าอื่น)
- **WHEN** ผู้ใช้พยายามส่งทันทีหรือตั้งเวลาเผยแพร่ไปยัง facebook
- **THEN** `final_publish_gate_check()` คืน `blocked=true` พร้อมเหตุผลภาษาไทยที่ระบุว่าวิดีโอยังไม่พร้อม
- **AND** ไม่มีการสร้างแถวคิวเผยแพร่และไม่มีการ dispatch

#### Scenario: ไฟล์วิดีโอหายไปหลังบันทึกสถานะว่าเสร็จ
- **GIVEN** คอนเทนต์ `type='video'` ที่ `video_gen_status='done'` แต่ไฟล์ที่ `video_url` ชี้ถึงไม่มีอยู่จริงบนดิสก์
- **WHEN** ผู้ใช้พยายามเผยแพร่ไปยัง facebook
- **THEN** `final_publish_gate_check()` คืน `blocked=true` พร้อมเหตุผลที่ระบุว่าไม่พบไฟล์วิดีโอ

#### Scenario: วิดีโอพร้อมจริงผ่าน gate
- **GIVEN** คอนเทนต์ `type='video'` ที่ `video_gen_status='done'` และไฟล์ที่ `video_url` ชี้ถึงมีอยู่จริง
- **WHEN** ผู้ใช้เผยแพร่ไปยัง facebook ผ่าน Approval gate และ Platform gate แล้ว
- **THEN** `final_publish_gate_check()` คืน `blocked=false`

### Requirement: เช็คนี้ใช้ร่วมกันทั้ง send now, schedule และ cron
เนื่องจาก `final_publish_gate_check()` เป็น gate กลางที่ทั้งสามเส้นทางเรียกร่วมกันอยู่แล้ว เช็คความพร้อมของวิดีโอ SHALL มีผลกับทั้งสามเส้นทางโดยไม่ต้องเพิ่มจุดเช็คแยกต่างหาก

#### Scenario: cron ปฏิเสธ schedule ที่วิดีโอไม่พร้อมตอน dispatch จริง
- **GIVEN** schedule ที่ถูกสร้างไว้ตอนวิดีโอยังไม่เสร็จ (ผ่าน gate ตอนสร้างไม่ได้ในทางปฏิบัติ แต่กันไว้เผื่อสถานะเปลี่ยนหลังตั้งเวลา)
- **WHEN** cron `publish-scheduler.php` พยายาม dispatch schedule นั้น
- **THEN** `final_publish_gate_check()` ปฏิเสธด้วยเหตุผลเดียวกับ send now

### Requirement: คอนเทนต์ที่ไม่ใช่วิดีโอไม่ได้รับผลกระทบ
เช็คความพร้อมของวิดีโอ SHALL มีผลเฉพาะคอนเทนต์ `type === 'video'` เท่านั้น — คอนเทนต์ประเภทอื่น (article) SHALL ผ่าน gate นี้โดยไม่มีการเช็คเพิ่มเติม

#### Scenario: คอนเทนต์บทความไม่ถูกเช็คไฟล์วิดีโอ
- **WHEN** คอนเทนต์ `type='article'` ถูกเผยแพร่ไปยัง facebook
- **THEN** `final_publish_gate_check()` ไม่เช็ค `video_gen_status` หรือไฟล์วิดีโอเลย
