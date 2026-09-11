## MODIFIED Requirements

### Requirement: send_now รายงานผลรายช่องทางตามจริง
คำตอบของ `send_now` SHALL ระบุสถานะรายช่องทางที่แยกได้ 4 กรณี: สำเร็จ / ข้าม (`skipped`) / ถูกบล็อกก่อนเผยแพร่ (`blocked`) / ล้มเหลว (`failed`) และ UI SHALL แสดงตามผลจริงนั้น การ dispatch ของแต่ละ channel SHALL ใช้ payload ที่เหมาะกับ platform นั้น โดย SHALL ใช้ channel override ก่อน, ใช้ `article_content.scripts[platform]` เมื่อมีค่า, และ fallback ไปเนื้อหาเดิมเมื่อไม่มี script

`blocked` SHALL หมายถึงกรณีที่ `publish_via_central_flow()` ปฏิเสธก่อนเรียก `dispatch_content()` (เช่น approval gate, quality gate, SEO/AEO gate, หรือ channel ปิดใช้งาน) ซึ่งต่างจาก `failed` ที่หมายถึงมีการเรียกปลายทางจริงแล้วแต่ปลายทางตอบล้มเหลวหรือ `dispatch_content()` มีข้อผิดพลาด — UI SHALL แสดงเหตุผลของ `blocked` จาก `result.reason` ตรง ๆ แยกจากข้อความทั่วไป ไม่ตกไปใช้ข้อความ generic เมื่อไม่มีช่องทางใดสำเร็จ

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

#### Scenario: ทุกช่องทางถูกข้ามแจ้งว่าข้าม
- **GIVEN** ทุกช่องทางในคำขอเข้าเงื่อนไข idempotency guard
- **WHEN** คำขอเสร็จสิ้น
- **THEN** UI แจ้งว่าถูกข้ามเพราะเพิ่งส่งไปแล้ว ไม่ใช่ทั้งสำเร็จและไม่ใช่ล้มเหลว

#### Scenario: ถูก gate บล็อกก่อนเผยแพร่ต้องแสดงเหตุผลจริง ไม่ใช่ข้อความทั่วไป
- **GIVEN** คอนเทนต์ยังไม่มีผล Quality ของเวอร์ชันปัจจุบัน (`quality_checked_at` เป็น NULL) ทำให้ `final_publish_gate_check()` คืน `blocked`
- **WHEN** ผู้ใช้กด "ส่งเลย" ไปยังช่องทางเดียวและไม่มีช่องทางอื่น
- **THEN** UI แสดงเหตุผลจริงจาก `result.reason` (เช่น ข้อความเกี่ยวกับ Quality gate) ไม่ใช่ข้อความทั่วไป "ไม่มีช่องทางที่ถูกส่ง"

#### Scenario: ผลผสมที่มี blocked ปนกับสถานะอื่นแสดงแยกกัน
- **GIVEN** คำขอมี 2 ช่องทาง: สำเร็จ 1 และถูกบล็อก 1
- **WHEN** คำขอเสร็จสิ้น
- **THEN** UI แสดงจำนวน "สำเร็จ" และ "ถูกบล็อก" แยกกัน ไม่นับรวมเป็นก้อนเดียวกับ `failed` หรือ `skipped`
