## Why

Popup "ส่งเดี๋ยวนี้" และ "ตั้งเวลาโพสต์" (`SchedulePublishDialog.tsx`) ปัจจุบันใช้ความกว้างคงที่ `sm:max-w-lg` (512px) ซึ่งแคบเกินไป ทำให้เนื้อหาภายใน (รายการ channel + textarea + ช่องวันที่/เวลา) ดูอึดอัดและจัดวางไม่เหมาะสม และเลื่อนทั้ง dialog ด้วย `max-h-[90vh] overflow-y-auto` ทำให้เมื่อมี channel จำนวนมาก ทั้งหัวข้อและปุ่มกดจะเลื่อนหลุดออกจากจอ ใช้งานไม่สะดวก

## What Changes

- ปรับความกว้างของ popup "ส่งเดี๋ยวนี้" และ "ตั้งเวลาโพสต์" ให้กว้างขึ้นและพอดีกับเนื้อหา (จาก `sm:max-w-lg` → `sm:max-w-xl`)
- ปรับ Layout และระยะห่างภายใน popup (ระยะห่างระหว่าง section และ padding ของรายการ channel) ให้เหมาะสมและดูเป็นระเบียบ
- แยกการเลื่อน (scroll) ให้เกิดขึ้นเฉพาะรายการ channel ภายในกล่อง แทนการเลื่อนทั้ง dialog เพื่อให้หัวข้อและปุ่ม footer คงอยู่กับที่
- จัดขนาดตามโหมด: โหมด "ส่งเดี๋ยวนี้" ใช้พื้นที่น้อยกว่าโหมด "ตั้งเวลาโพสต์" (ซึ่งมีช่องวันที่/เวลาเพิ่ม)
- รักษาการแสดงผลบนมือถือ (full-screen) และรองรับกรณี channel จำนวนมากโดยไม่ overflow

## Capabilities

### New Capabilities

- `send-schedule-dialog-sizing`: กำหนดขนาด (กว้างขึ้น) การจัดวาง/ระยะห่าง และพฤติกรรมการเลื่อนของ popup "ส่งเดี๋ยวนี้" และ "ตั้งเวลาโพสต์" ให้พอดีกับเนื้อหาภายในทั้งสองโหมด

### Modified Capabilities

<!-- ไม่มีการเปลี่ยนแปลง requirement ของ spec เดิม -->

## Impact

- `src/components/content/SchedulePublishDialog.tsx` — ปรับ `DialogContent` layout (width, height, spacing, scroll) ตามโหมด
- ไม่กระทบ API, hooks (`useScheduleContent`, `useSendNow`) หรือ logic การส่ง/ตั้งเวลา
