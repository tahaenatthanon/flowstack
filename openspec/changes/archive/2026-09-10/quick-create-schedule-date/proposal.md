## Why

`QuickCreateDialog.tsx` สร้าง content item ผ่าน `generate-plan` (Direct mode) โดยไม่เคยเรียก `action=plan-item-date` เพื่อกำหนด `scheduled_date` เลย — ต่างจาก `BatchGenerateDialog.tsx` ที่ผู้ใช้ตั้ง "เริ่มวันที่" แล้วระบบเรียก `plan-item-date` ให้ทุก item หลัง `generate-plan` สำเร็จ ผลคือ item ทุกชิ้นที่สร้างผ่าน Quick Create ไม่มีวันที่กำหนดตั้งแต่ต้น (ต้องพึ่ง `calendar-unscheduled-item-bucket` เป็นทางแสดงผลสำรองเพียงอย่างเดียว) — แก้ที่ต้นเหตุคู่กับที่ทำไปแล้วเพื่อปิดช่องโหว่ทั้งสองด้าน (การแสดงผล + การสร้างข้อมูล)

## What Changes

- `QuickCreateDialog.tsx`: หลัง `generate-plan` สำเร็จและได้ `item.id` แล้ว เรียก `action=plan-item-date` ตั้ง `scheduled_date` เป็นวันที่ปัจจุบัน (local date, ไม่ใช้ `toISOString()`) ก่อนเริ่ม `runResearch()` — ไม่มี UI ใหม่ ไม่มีช่องให้ผู้ใช้เลือกวันที่เอง
- การเรียก `plan-item-date` แยก try/catch ของตัวเอง — ล้มเหลวแล้วไม่ทำให้ทั้ง flow (Research/Generate) ล้มตาม
- ถ้า `plan-item-date` ล้มเหลว แสดง toast แจ้งผู้ใช้ตรงๆ ว่า content สร้างสำเร็จแต่ยังไม่ได้กำหนดวันที่ (ไม่ปล่อยเงียบ ต่างจาก Batch ที่รวม error ท้าย batch เพราะ Quick Create สร้างทีละ 1 ชิ้น)
- ไม่มี **BREAKING** change — เป็นการเพิ่มพฤติกรรม best-effort ไม่เปลี่ยน data model หรือ API ที่มีอยู่

## Capabilities

### New Capabilities

- `quick-create-schedule-date`: Quick Create ตั้ง `scheduled_date` เริ่มต้นเป็นวันปัจจุบันให้ content item โดยอัตโนมัติหลังสร้างสำเร็จ (คู่ขนานกับ `batch-content-scheduling` ที่มีอยู่แล้วสำหรับ Batch)

### Modified Capabilities

- `content-generation-single-item`: requirement "Direct metadata SHALL not become content instructions" เดิมระบุว่า direct item `MAY` เก็บ `scheduled_date=null` ไว้เพื่อ compatibility — ต้องปรับให้สะท้อนว่า Quick Create (Direct mode ผ่าน UI นี้) จะพยายามตั้ง `scheduled_date` เป็นวันปัจจุบันแบบ best-effort เสมอ ไม่ปล่อยเป็น `null` โดยเจตนาอีกต่อไป (แม้ backend ยังอนุญาตให้ `scheduled_date=null` ได้ในกรณีที่การตั้งวันที่ล้มเหลว)

## Impact

- `src/components/content/dialogs/QuickCreateDialog.tsx` เท่านั้น — ไม่แตะ backend (`action=plan-item-date` มีอยู่แล้ว ใช้งานร่วมกับ Batch อยู่แล้ว ไม่ต้องแก้), ไม่แตะ `BatchGenerateDialog.tsx`
- ลดจำนวน item ที่ตกไปอยู่ใน `calendar-unscheduled-item-bucket` ลงในเคสปกติ (bucket ยังทำงานเป็นทางสำรองเมื่อ `plan-item-date` ล้มเหลวจริง)
- ไม่กระทบ Batch mode หรือ legacy Content Plan mode — คนละ dialog คนละ flow
