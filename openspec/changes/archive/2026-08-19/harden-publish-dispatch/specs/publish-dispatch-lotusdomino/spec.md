## REMOVED Requirements

### Requirement: dispatch_lotusdomino assume สำเร็จเมื่อไม่มี curl error
**Reason**: พฤติกรรม "assume ok" ทำให้ `status='sent'` ไม่มีค่าเป็นหลักฐาน — ปลายทางตอบ 4xx/5xx ก็ยังถูกบันทึกว่าเผยแพร่สำเร็จ และคอนเทนต์ถูกตั้งเป็น `published` ตามไปด้วย (เกิดขึ้นจริง 16 ครั้งเมื่อ 19 ส.ค. 2026) สมมติฐานเดิมว่า "Domino agent ไม่คืน HTTP error ที่เชื่อถือได้" ไม่เคยถูกตรวจสอบ เพราะระบบไม่เคยเก็บ response ไว้ดูเลย

**Migration**: ความหมายของความสำเร็จย้ายไปอยู่ที่ capability `publish-dispatch-response-capture` — `dispatch_lotusdomino()` สำเร็จเมื่อ **ไม่มี cURL error และ HTTP status < 400** ส่วนการตรวจว่าปลายทางรับเอกสารจริงหรือไม่ ใช้คอลัมน์ใหม่ `content_publish_queue.response_snippet` ที่เก็บเนื้อ response ทุกครั้ง

ผลกระทบต่อข้อมูลเดิม: แถว `sent` ที่มีอยู่ก่อน change นี้ไม่มี `response_snippet` จึงยืนยันย้อนหลังไม่ได้ ต้องถือว่าเป็นสถานะที่พิสูจน์ไม่ได้ (unverified) ไม่ใช่สำเร็จ
