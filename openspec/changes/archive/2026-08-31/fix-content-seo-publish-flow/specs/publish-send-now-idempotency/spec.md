## MODIFIED Requirements

### Requirement: send_now รายงานผลรายช่องทางตามจริง
คำตอบของ `send_now` SHALL ระบุสถานะรายช่องทางที่แยกได้ 3 กรณี: สำเร็จ / ข้าม (`skipped`) / ล้มเหลว และ UI SHALL แสดงตามผลจริงนั้น การ dispatch ของแต่ละ channel SHALL ใช้ payload ที่เหมาะกับ platform นั้น โดย SHALL ใช้ channel override ก่อน, ใช้ `article_content.scripts[platform]` เมื่อมีค่า, และ fallback ไปเนื้อหาเดิมเมื่อไม่มี script

#### Scenario: ใช้ script เฉพาะ platform
- **GIVEN** `article_content.scripts.facebook` และ `article_content.scripts.instagram` มีข้อความต่างกัน
- **WHEN** เรียก `send_now` ไปยัง Facebook และ Instagram
- **THEN** Facebook ได้รับ script ของ Facebook และ Instagram ได้รับ script ของ Instagram

#### Scenario: channel override มีลำดับสูงสุด
- **GIVEN** channel มี override และมี script ใน `article_content.scripts`
- **WHEN** เรียก `send_now` ไปยัง channel นั้น
- **THEN** ระบบส่ง override และไม่ส่ง script ที่สร้างไว้แทน

#### Scenario: ไม่มี script ให้ใช้ fallback เดิม
- **GIVEN** ไม่มี script ที่ตรงกับ platform
- **WHEN** เรียก `send_now`
- **THEN** ระบบใช้ caption/article content เดิมตามพฤติกรรมเดิม และยังคืนผลราย channel ตามจริง

#### Scenario: ทุกช่องทางล้มเหลวต้องไม่ขึ้นว่าสำเร็จ
- **GIVEN** คอนเทนต์ถูกส่งไป 1 ช่องทาง และปลายทางตอบ HTTP 500
- **WHEN** ผู้ใช้กด "ส่งเลย" ใน dialog
- **THEN** UI แสดงข้อความล้มเหลว ไม่ใช่ "ส่งสำเร็จ!"

#### Scenario: ผลผสมแสดงจำนวนแยกกัน
- **GIVEN** คำขอมี 3 ช่องทาง: สำเร็จ 1 ข้าม 1 ล้มเหลว 1
- **WHEN** คำขอเสร็จสิ้น
- **THEN** UI แสดงจำนวนทั้งสามกรณีแยกกันให้ผู้ใช้เห็น

### Requirement: send_now ข้ามการเผยแพร่ซ้ำของคู่ content+channel
`send_now` SHALL ตรวจก่อน dispatch ว่าคู่ `(content_id, channel_id)` มีแถวใน `content_publish_queue` ที่ `status IN ('processing','sent')` และถูกสร้างภายใน 10 นาทีที่ผ่านมาหรือไม่ ถ้ามี SHALL ไม่สร้างแถวใหม่ ไม่เรียก `dispatch_content()` และคืนผลรายช่องทางนั้นเป็นสถานะ `skipped` พร้อมเหตุผลเป็นภาษาไทย

แถว `status='failed'` SHALL NOT ถูกนับเป็นการเผยแพร่ซ้ำ — ปุ่ม "ลองส่งใหม่" ต้องยังทำงานได้ทันทีหลังล้มเหลว

#### Scenario: กดส่งซ้ำในกรอบ 10 นาทีถูกข้าม
- **GIVEN** คู่ `(content_id, channel_id)` มีแถว `status='sent'` สร้างเมื่อ 1 นาทีที่แล้ว
- **WHEN** เรียก `send_now` ด้วยคู่เดิม
- **THEN** ไม่มีแถวใหม่ใน `content_publish_queue`
- **AND** ไม่มี HTTP request ออกไปยังปลายทาง
- **AND** ผลลัพธ์ของช่องทางนั้นมีสถานะ `skipped`

#### Scenario: แถวค้าง processing ก็ถูกข้าม
- **GIVEN** คู่ `(content_id, channel_id)` มีแถว `status='processing'` สร้างเมื่อ 5 นาทีที่แล้ว
- **WHEN** เรียก `send_now` ด้วยคู่เดิม
- **THEN** ผลลัพธ์ของช่องทางนั้นมีสถานะ `skipped` และไม่มี request ออกไป

#### Scenario: แถว failed ส่งซ้ำได้
- **GIVEN** คู่ `(content_id, channel_id)` มีแถว `status='failed'` สร้างเมื่อ 1 นาทีที่แล้ว
- **WHEN** เรียก `send_now` ด้วยคู่เดิม
- **THEN** สร้างแถวใหม่และเรียก `dispatch_content()` ตามปกติ

#### Scenario: พ้น 10 นาทีส่งซ้ำได้
- **GIVEN** คู่ `(content_id, channel_id)` มีแถว `status='sent'` สร้างเมื่อ 30 นาทีที่แล้ว
- **WHEN** เรียก `send_now` ด้วยคู่เดิม
- **THEN** สร้างแถวใหม่และเรียก `dispatch_content()` ตามปกติ

#### Scenario: หลาย channel ในคำขอเดียว ข้ามเฉพาะที่ซ้ำ
- **GIVEN** คำขอมี channel A ที่มีแถว `sent` เมื่อ 1 นาทีที่แล้ว และ channel B ที่ไม่มีแถวใด
- **WHEN** เรียก `send_now` ด้วย `channel_ids=[A, B]`
- **THEN** ช่องทาง A มีสถานะ `skipped` และช่องทาง B ถูก dispatch จริง

### Requirement: คำขอ send_now ที่เข้ามาพร้อมกันต้อง dispatch เพียงครั้งเดียว
`send_now` SHALL ป้องกัน race condition ระหว่างคำขอที่เข้ามาพร้อมกันด้วยคู่ `(content_id, channel_id)` เดียวกัน โดยการตรวจซ้ำและการสร้างแถวคิว SHALL อยู่ในขอบเขตการล็อกร่วมกัน — คำขอที่ไม่ได้ล็อก SHALL ถูกรายงานเป็น `skipped` ไม่ใช่ล้มเหลว

#### Scenario: สองคำขอพร้อมกัน dispatch ครั้งเดียว
- **WHEN** มี 2 คำขอ `send_now` ด้วยคู่ `(content_id, channel_id)` เดียวกันเข้ามาพร้อมกัน
- **THEN** มีเพียงคำขอเดียวที่ dispatch และสร้างแถวคิว
- **AND** คำขออีกอันได้สถานะ `skipped`

#### Scenario: การล็อกไม่บล็อกคนละคู่
- **WHEN** มี 2 คำขอ `send_now` ที่ `content_id` เดียวกันแต่ `channel_id` ต่างกันเข้ามาพร้อมกัน
- **THEN** ทั้งสองคำขอ dispatch ได้ ไม่รอกันจนหมดเวลา

#### Scenario: หลาย channel ใช้ payload แยกกันและข้ามเฉพาะที่ซ้ำ
- **GIVEN** คำขอมี channel A ที่ซ้ำและ channel B ที่ไม่ซ้ำ โดยแต่ละ channel มี script ต่างกัน
- **WHEN** เรียก `send_now`
- **THEN** channel A มีสถานะ `skipped`
- **AND** channel B ถูก dispatch ด้วย script ของ B เพียงครั้งเดียว
