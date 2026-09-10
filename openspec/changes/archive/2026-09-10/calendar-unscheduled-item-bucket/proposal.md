## Why

`ContentPlannerCalendar.tsx` bucket ทุก content item ด้วย `key = item.scheduled_date || item.day_label` แล้ว `if (!key) continue;` — item ที่ resolve แล้วไม่มี real date key ที่ `renderCell` ใช้ query ได้ (ไม่มี `scheduled_date`, ไม่ว่า `day_label` จะมีค่าหรือไม่) จะหายไปจากมุมมอง Calendar ทั้งหมดโดยไม่มี indicator ใดๆ บอกผู้ใช้ — ต่างจาก List view (`ContentItemList.tsx`) ที่มี pattern แสดง item แบบนี้อยู่แล้ว (ไฮไลต์สีเหลือง label "ยังไม่กำหนด") ผู้ใช้ต้องสลับไป List view เองถึงจะเห็นว่ามี item เหล่านี้อยู่ ซึ่งขัดกับการใช้งาน Calendar เป็นมุมมองหลัก

## What Changes

- `ContentPlannerCalendar.tsx`: เพิ่ม bucket "ยังไม่กำหนดวันที่" แสดงเหนือ Calendar grid — แสดงเฉพาะเมื่อมีรายการ, แสดงในทุก view (Month/Quarter/Year), กรองด้วย `typeFilter`/`platformFilter` เดียวกับ grid
- ปรับ logic การจัดกลุ่ม item ให้ item ใดก็ตามที่ resolve แล้วไม่ได้ real date key (ไม่มี `scheduled_date` — ไม่ว่าจะมี `day_label` หรือไม่) ถูกจัดเป็น "ยังไม่กำหนดวันที่" แทนที่จะถูกเก็บเป็น dead key ที่ไม่มีทาง render ได้ (เช่น key `"จันทร์"`) หรือถูกข้ามเงียบๆ
- item ใน bucket ลากไปวางบน day cell ได้ (reuse `dataTransfer`/drop-handler เดิม) และคลิกเพื่อเปิด dialog แก้ไขได้ (reuse `onDateClick` เดิม ด้วยวันที่ปัจจุบันเป็น placeholder — ไม่เพิ่ม prop ใหม่)
- ไม่มี **BREAKING** change — เป็นการเพิ่มการแสดงผล ไม่เปลี่ยน data model หรือ API

## Capabilities

### New Capabilities

- `content-planner-calendar-unscheduled-bucket`: การแสดง content item ที่ไม่มีวันที่กำหนดไว้ในมุมมอง Calendar ของ Content Planner แทนที่จะถูกซ่อนเงียบๆ

### Modified Capabilities

(ไม่มี — ไม่มี capability เดิมที่ครอบคลุมพฤติกรรมการแสดงผล Calendar นี้มาก่อน)

## Impact

- `src/components/content/ContentPlannerCalendar.tsx` เท่านั้น (ตาม scope ที่ยืนยัน) — ไม่แตะ `ContentPlannerPage.tsx`, `ContentCardDialog.tsx`, หรือ backend ใดๆ
- ไม่กระทบ legacy Content Plan item ที่มี `scheduled_date` จริงอยู่แล้ว (ยัง render บน grid ตามปกติทุกประการ)
- ไม่ทำ: ลากกลับเข้า bucket เพื่อ unschedule (feature เสริม, นอก scope), บังคับให้ QuickCreateDialog เลือกวันที่ตอนสร้าง (นอก scope), สืบว่า `action=plan-items` POST สร้างเคส day_label-only ได้หรือไม่ (นอก scope — Calendar defensive ไปก่อน)
