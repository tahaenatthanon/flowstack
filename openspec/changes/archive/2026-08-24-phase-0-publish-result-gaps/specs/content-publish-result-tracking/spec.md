## ADDED Requirements

### Requirement: การเผยแพร่สำเร็จเขียน platform ให้ตรงกับ channel ที่โพสต์จริง
เมื่อการเผยแพร่ผ่านช่องทางใดสำเร็จ ระบบ SHALL เขียน `content_items.platform` ให้เท่ากับ `platform` ของ channel ที่ใช้โพสต์จริง (ค่าเดียวกับคอลัมน์ `publish_channels.platform`) พร้อมกับ `status='published'` ในทุกเส้นทางเผยแพร่

#### Scenario: send_now เขียน platform จาก channel
- **WHEN** ผู้ใช้เรียก `send_now` ไปยัง channel ที่มี `platform='facebook'` และ dispatch สำเร็จ
- **THEN** `content_items` แถวที่ถูกอัปเดตมี `platform='facebook'` และ `status='published'`

#### Scenario: cron queue เขียน platform จาก channel
- **WHEN** `publish-scheduler.php` ส่งผ่าน channel ที่มี `platform='facebook'` สำเร็จ
- **THEN** `content_items` แถว `content_id` มี `platform='facebook'`

#### Scenario: ?action=publish เขียน platform จาก channel
- **WHEN** ผู้ใช้เรียก `?action=publish` ผ่าน channel ที่มี `platform='facebook'` และสำเร็จ
- **THEN** `content_items` แถว `id=item_id` มี `platform='facebook'`

#### Scenario: ?action=cron-publish เขียน platform จาก schedule channel
- **WHEN** `?action=cron-publish` ส่งผ่าน `content_schedules` ที่ channel มี `platform='facebook'` สำเร็จ
- **THEN** `content_items` ของ `plan_item_id` ที่สอดคล้องมี `platform='facebook'`

### Requirement: published_url ของ facebook มาจาก permalink_url ของ Graph API
เมื่อการเผยแพร่ไป facebook สำเร็จ ระบบ SHALL ดึง `permalink_url` ของโพสต์จาก Graph API และบันทึกลง `content_items.published_url`; หากการดึงลิงก์ไม่สำเร็จ `published_url` SHALL เป็น NULL และการเผยแพร่ที่สำเร็จแล้ว SHALL ยังถือว่าสำเร็จ

#### Scenario: ดึง permalink สำเร็จ
- **WHEN** `dispatch_facebook()` โพสต์สำเร็จและได้ `platform_post_id` แล้วเรียก GET `/{post_id}?fields=permalink_url` สำเร็จ
- **THEN** ผล dispatch มี `published_url` เท่ากับ `permalink_url`
- **AND** `content_items.published_url` ได้รับค่านั้น

#### Scenario: ดึง permalink ไม่สำเร็จไม่ทำให้การเผยแพร่ล้มเหลว
- **WHEN** `dispatch_facebook()` โพสต์สำเร็จ แต่ GET `permalink_url` ล้มเหลว (เช่น token หมดอายุ / สิทธิ์ไม่พอ)
- **THEN** ผล dispatch ยังคง `success=true`
- **AND** `published_url` เป็น NULL และ `content_items` ยังถูกตั้ง `status='published'`
