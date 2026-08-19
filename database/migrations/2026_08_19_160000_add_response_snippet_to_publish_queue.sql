-- เพิ่มคอลัมน์เก็บเนื้อ response ที่ปลายทางตอบกลับตอน dispatch
-- เหตุผล: status='sent' เพียงอย่างเดียวพิสูจน์ไม่ได้ว่าปลายทางรับเอกสารจริง
-- error_msg (varchar 500) ตอบว่า "ทำไมถือว่าล้มเหลว" ส่วน response_snippet ตอบว่า "ปลายทางพูดว่าอะไร"
-- เก็บทั้งกรณีสำเร็จและล้มเหลว ตัดที่ 2000 ตัวอักษรในชั้นแอป

ALTER TABLE content_publish_queue
  ADD COLUMN response_snippet TEXT NULL AFTER error_msg;
