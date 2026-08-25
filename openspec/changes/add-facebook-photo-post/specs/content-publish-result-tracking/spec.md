## MODIFIED Requirements

### Requirement: published_url ของ facebook มาจาก permalink_url ของ Graph API
เมื่อการเผยแพร่ไป facebook สำเร็จ ระบบ SHALL ดึง `permalink_url` ของโพสต์จาก Graph API และบันทึกลง `content_items.published_url`; หากการดึงลิงก์ไม่สำเร็จ `published_url` SHALL เป็น NULL และการเผยแพร่ที่สำเร็จแล้ว SHALL ยังถือว่าสำเร็จ

id ที่ใช้เรียก permalink lookup SHALL เป็น id ของ **โพสต์** ในรูปแบบผสม `{page_id}_{post_id}` ไม่ใช่ id ของสื่อ — เมื่อโพสต์ผ่าน `/{page_id}/feed` ค่านี้คือ `response.id` แต่เมื่อโพสต์ผ่าน `/{page_id}/photos` ค่านี้คือ `response.post_id` ขณะที่ `response.id` เป็น photo id เปล่าซึ่งใช้ทั้ง lookup permalink และดึง engagement ไม่ได้ ระบบจึง SHALL อ่าน `post_id` ก่อน แล้วจึง fallback ไป `id`

#### Scenario: ดึง permalink สำเร็จ
- **WHEN** `dispatch_facebook()` โพสต์สำเร็จและได้ `platform_post_id` แล้วเรียก GET `/{post_id}?fields=permalink_url` สำเร็จ
- **THEN** ผล dispatch มี `published_url` เท่ากับ `permalink_url`
- **AND** `content_items.published_url` ได้รับค่านั้น

#### Scenario: ดึง permalink ไม่สำเร็จไม่ทำให้การเผยแพร่ล้มเหลว
- **WHEN** `dispatch_facebook()` โพสต์สำเร็จ แต่ GET `permalink_url` ล้มเหลว (เช่น token หมดอายุ / สิทธิ์ไม่พอ)
- **THEN** ผล dispatch ยังคง `success=true`
- **AND** `published_url` เป็น NULL และ `content_items` ยังถูกตั้ง `status='published'`

#### Scenario: โพสต์รูปใช้ post_id เรียก permalink
- **WHEN** `dispatch_facebook()` โพสต์ผ่าน `/photos` สำเร็จและ response มีทั้ง `id` (photo id) และ `post_id` (รูปแบบผสม)
- **THEN** permalink lookup ถูกเรียกด้วยค่า `post_id` ไม่ใช่ `id`
- **AND** `content_items.external_post_id` และ `content_publish_queue.platform_post_id` เก็บค่า `post_id` นั้น

#### Scenario: โพสต์ข้อความเปล่าใช้ id เรียก permalink ตามเดิม
- **WHEN** `dispatch_facebook()` โพสต์ผ่าน `/feed` สำเร็จและ response มีเฉพาะ `id`
- **THEN** permalink lookup ถูกเรียกด้วยค่า `id` นั้นตามพฤติกรรมเดิม
