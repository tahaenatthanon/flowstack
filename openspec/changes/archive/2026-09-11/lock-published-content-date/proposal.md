## Why

`ContentPlannerCalendar` ให้ลาก content item ไปเปลี่ยน `scheduled_date` ได้เสมอ และ `ContentCardDialog` ให้พิมพ์วันที่ใหม่ในฟอร์มแก้ไขได้เสมอเช่นกัน — ทั้งสองเส้นทางไม่เคยเช็คว่า content นั้นเผยแพร่ไปแล้วจริงหรือยัง ผลคือคอนเทนต์ที่มีบางแพลตฟอร์มเผยแพร่ไปแล้ว (เช่นโพสต์ Facebook ออกไปแล้ว) ยังถูกลากหรือแก้วันที่ในระบบได้ ทำให้ "วันที่ตามแผน" ไม่ตรงกับความจริงที่เกิดขึ้นแล้วบนแพลตฟอร์ม และสร้างความสับสนว่าคอนเทนต์ชิ้นนี้ถูกโพสต์ไปเมื่อไหร่กันแน่

## What Changes

- เพิ่มการล็อกการแก้ไข `scheduled_date` ของ content item ที่มีอย่างน้อย 1 แพลตฟอร์ม (จาก `platforms[]` ของ item) เผยแพร่สำเร็จแล้ว (`status='sent'` ใน `content_publish_queue` หรือ `content_schedules`) — ใช้ตรรกะเดียวกับ `get_published_content_platforms()` ที่มีอยู่แล้ว
- คอนเทนต์ที่ยังไม่มีแพลตฟอร์มใดเผยแพร่จริง (รวมถึงที่มีคิวเผยแพร่ตั้งไว้ล่วงหน้าแล้วแต่ยัง `pending`/`processing`) ยังคงลาก/แก้วันที่ได้ตามปกติ ไม่ว่าจะมี `scheduled_date` ตั้งไว้แล้วหรือไม่
- การล็อกเป็นแบบรายการ์ง (per content item) — content item อื่นในวันเดียวกันที่ยังไม่เผยแพร่ ไม่ได้รับผลกระทบ
- บังคับกฎนี้ทั้งฝั่ง backend (แหล่งความจริง) และ frontend (ปิดการโต้ตอบเพื่อ UX ที่ชัดเจน) ครอบคลุมทั้ง 2 ช่องทางที่แก้ `scheduled_date` ได้ในปัจจุบัน:
  - Backend: `action=plan-item-date` (PUT) และ `action=plans` (PUT พร้อม `item_id`+`scheduled_date`) ใน `api/brand-content.php` ปฏิเสธด้วย HTTP 409 เมื่อ item ถูกล็อก
  - Frontend: `ContentPlannerCalendar` ปิด `draggable` ของ chip ที่ถูกล็อก พร้อมสัญลักษณ์แสดงสถานะล็อก; `ContentCardDialog` ปิดช่องแก้วันที่ (`<Input type="date">`) เมื่อ item ถูกล็อก; `ContentItemList` ปิด `draggable` ของแถวที่ถูกล็อกเช่นกันเพื่อความสอดคล้อง
- เพิ่ม field ที่บอกสถานะล็อกในผลลัพธ์ของ `plan-items` (list เดิมที่ใช้ hydrate ปฏิทิน) เพื่อไม่ต้องยิง request แยกต่อการ์ด (หลีกเลี่ยง N+1 เมื่อโหลดทั้งเดือน/ไตรมาส/ปี)

## Capabilities

### New Capabilities
- `content-scheduled-date-lock`: กฎและกลไกล็อกการแก้ไข `scheduled_date` ของ content item เมื่อมีแพลตฟอร์มใดแพลตฟอร์มหนึ่งเผยแพร่สำเร็จแล้ว ครอบคลุมทั้ง backend guard (2 endpoint) และ UI ที่เกี่ยวข้อง (ปฏิทิน, dialog แก้ไข, รายการ)

### Modified Capabilities
(ไม่มี — ไม่มี capability เดิมที่ requirement เปลี่ยน; `content-published-status-guard` คุ้มครองการถอยสถานะ `status` ผ่าน `api/content-items.php` คนละ endpoint และคนละเงื่อนไข (all-platforms-published) จากกฎใหม่นี้ที่คุมเฉพาะ `scheduled_date` ผ่าน `api/brand-content.php` ด้วยเงื่อนไข any-platform-published)

## Impact

- **Backend**: `api/brand-content.php` (`action=plan-item-date`, `action=plans`), เพิ่ม SELECT field ใหม่ในสอง query ที่ hydrate `plan-items` (ปัจจุบันอยู่ราวบรรทัด 514 และ 523/1043); ใช้ `get_published_content_platforms()` จาก `api/lib/publish-dispatch.php` ที่มีอยู่แล้วเป็นแหล่งความจริง
- **Frontend**: `src/components/content/types.ts` (เพิ่ม field ใน `PlanItem`), `src/components/content/ContentPlannerCalendar.tsx`, `src/components/content/ContentCardDialog.tsx`, `src/components/content/ContentItemList.tsx`
- **ไม่กระทบ**: schema ฐานข้อมูล (ไม่มีตาราง/คอลัมน์ใหม่ — ใช้ query แบบ derived เท่านั้น), การเผยแพร่จริง (`content-publish.php`) และ cron dispatch ไม่เปลี่ยนแปลง
