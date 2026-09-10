## 1. Prompt guard in `content_plan_user_message()`

- [x] 1.1 แก้ `api/lib/content-plan-prompt.php`: ใน branch non-direct ของ `content_plan_user_message()` resolve topic label จาก `source_topic` → trigger command ตัวแรกที่ไม่ว่างใน `trigger_commands` → `trigger_command` (ลำดับเดียวกับที่ caller ทำอยู่ที่ `brand-content.php:923`) โดยทำ trim ทุกค่าก่อนเทียบว่าง
- [x] 1.2 ถ้า resolve แล้วว่างสนิท (`''`) ไม่พิมพ์บรรทัด `Original User Topic/Seed (SOURCE OF TRUTH):` เลย — ไม่มี placeholder แทน บรรทัดอื่น (Trigger Instructions, สัปดาห์เริ่มต้น, วันที่, Platform, reminder) พิมพ์ตามปกติไม่เปลี่ยน
- [x] 1.3 อัปเดต docblock ของฟังก์ชันให้อธิบายกติกาการตัดบรรทัดนี้

## 2. Trigger `command` validation consistency

- [x] 2.1 แก้ `api/brand-content.php` action `triggers` method `PUT` (บรรทัด ~492): เพิ่ม `if (empty($body['command'])) jsonError('กรุณาระบุ Trigger Command');` ก่อน UPDATE เหมือนที่ `POST` มีอยู่แล้ว (บรรทัด 480)

## 3. Tests

- [x] 3.1 เพิ่ม test case ใน `api/tests/content-plan-source-topic-test.php` (หรือไฟล์ใหม่คู่กันถ้าเหมาะสมกว่า) ครอบคลุม: (a) มี `source_topic` → พิมพ์บรรทัดปกติ (b) ไม่มี `source_topic` แต่มี `trigger_commands` → fallback ไป trigger command ตัวแรก (c) ทุกแหล่งว่างสนิท → ไม่มีบรรทัด `Original User Topic/Seed` เลยใน output string (d) ค่าที่มีแต่ whitespace ต้องถือว่าว่างเหมือนกัน
- [x] 3.2 รัน `/c/xampp/php/php.exe -l api/lib/content-plan-prompt.php` และ `/c/xampp/php/php.exe -l api/brand-content.php`
- [x] 3.3 รัน test suite ที่เกี่ยวข้องทั้งหมดใน `api/tests/` ด้วย `/c/xampp/php/php.exe` ให้ผ่านทุกไฟล์

## 4. Verification

- [x] 4.1 รัน `pnpm lint` และ `pnpm test` ให้ผ่าน (ไม่มีการแก้ frontend แต่ต้องยืนยันไม่มีอะไรพัง)
- [x] 4.2 ยืนยันด้วย unit test ว่า prompt string ที่ได้ไม่มีบรรทัด topic ว่าง (7/7 test cases ผ่าน รวมกรณีทุกแหล่งว่างสนิทและ whitespace-only) และยืนยัน `PUT triggers` ด้วย code review ว่า guard `if (empty($body['command']))` ทำงานก่อน UPDATE เสมอ ตรงกับ pattern เดียวกับ `POST` ที่ทำงานอยู่แล้ว — **ไม่ได้ทำ live HTTP verify ผ่าน browser** เพราะไม่มี session token ที่ login ไว้ในเบราว์เซอร์ของ session นี้ และไม่ควรไปดึง credential จาก DB backup มา login แทนผู้ใช้จริง
