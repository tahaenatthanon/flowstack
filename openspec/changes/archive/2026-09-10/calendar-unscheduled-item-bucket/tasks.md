## 1. Bucketing logic

- [x] 1.1 แก้ `itemsByDate` useMemo ใน `src/components/content/ContentPlannerCalendar.tsx`: เปลี่ยนนิยาม key จาก `item.scheduled_date || item.day_label` เป็นใช้ `item.scheduled_date` เพียงตัวเดียวตัดสินว่ามี real date key หรือไม่ (ตัด `day_label` ออกจากการคำนวณ key ของ grid โดยสิ้นเชิง)
- [x] 1.2 ขยาย useMemo เดียวกันให้ return เพิ่ม `unscheduledItems: PlanItem[]` (item ที่ไม่มี `scheduled_date` หลังผ่าน `typeFilter`/`platformFilter` เดียวกับที่กรอง `itemsByDate` อยู่แล้ว) — ไม่เพิ่ม `useMemo` ใหม่แยกต่างหาก
- [x] 1.3 ยืนยันว่า item ที่มี `scheduled_date` จริง ยังคง bucket และ render บน grid เหมือนเดิมทุกประการ (ไม่มีการเปลี่ยนแปลง path นี้)

## 2. Chip helper (reuse)

- [x] 2.1 แยก logic ของ item chip ที่ใช้ใน `renderCell` (PlatformIcon + topic truncate, `draggable`, `onDragStart` set `dataTransfer` เป็น `{itemId, planId}` JSON, `onClick` เรียก `onDateClick`) ออกมาเป็นฟังก์ชัน/component ภายในไฟล์เดียวกัน ให้ทั้ง `renderCell` และ bucket เรียกใช้ร่วมกัน

## 3. Unscheduled bucket UI

- [x] 3.1 เพิ่ม JSX ของ bucket "ยังไม่กำหนดวันที่" วางเป็น sibling เหนือ `{view === 'month' && renderMonthView()}...` block (นอก per-view conditional) — แสดงเฉพาะเมื่อ `unscheduledItems.length > 0`
- [x] 3.2 Chip ใน bucket ใช้ helper จาก 2.1, ใช้ visual language เดียวกับ `ContentItemList.tsx` (พื้นหลังเหลืองอ่อน + label "ยังไม่กำหนด" + ไอคอน) เพื่อความสอดคล้องกันทั้งระบบ
- [x] 3.3 คลิก chip ใน bucket เรียก `onDateClick(new Date(), [item])` (reuse prop เดิม ไม่เพิ่ม prop ใหม่)
- [x] 3.4 Chip ใน bucket มี `draggable`/`onDragStart` เดียวกับ 2.1 เพื่อให้ลากไปวางบน day cell ได้ผ่าน drop-handler เดิมที่มีอยู่แล้ว (ไม่ต้องแก้ `onDateDrop`/`onDateDragOver`)

## 4. Tests

- [x] 4.1 สร้าง `src/__tests__/content/ContentPlannerCalendar.test.tsx` ใหม่ (ไม่มีไฟล์เดิม) ครอบคลุมอย่างน้อย: (a) item มี `scheduled_date` จริง → render บน grid วันที่ถูกต้อง ไม่อยู่ใน bucket (b) item ไม่มีทั้ง `scheduled_date`/`day_label` → อยู่ใน bucket (c) item มี `day_label` แต่ไม่มี `scheduled_date` → อยู่ใน bucket เช่นกัน ไม่ใช่ dead key (d) bucket ไม่แสดงเมื่อไม่มี unscheduled item (e) `typeFilter`/`platformFilter` กรอง bucket เหมือนที่กรอง grid (f) bucket แสดงในทั้ง month/quarter/year view (g) คลิก chip ใน bucket เรียก `onDateClick` ด้วย `items=[item]` นั้น
- [x] 4.2 รัน `pnpm lint` ให้ผ่าน
- [x] 4.3 รัน `pnpm test` ให้ผ่านทั้งหมด (รวม test ใหม่และ regression suite เดิม)

## 5. Verification

- [x] 5.1 เปิด dev server จริง ตรวจด้วยตาว่า legacy item ที่มี `scheduled_date` ยังแสดงถูกวันเหมือนเดิม — ยืนยันแล้ว (Sep 1,2,3,9,10 แสดงถูกต้องเหมือนก่อนแก้)
- [x] 5.2 ตรวจสอบด้วยข้อมูลจริงที่มีอยู่ (3 item ไม่มี scheduled_date จากของเดิมในระบบ) ว่าแสดงใน bucket เหนือ grid ทั้ง 3 view (month/quarter/year ยืนยันครบ) และคลิกแล้วเปิด dialog แก้ไขได้จริง (ยืนยันแล้ว — เปิด dialog ของ item "Duckkit คืออะไร?..." สำเร็จ, เห็น cosmetic quirk วันที่ "10 ก.ย. 2569" ตามที่ยอมรับไว้ในขั้น explore) — การลากไปวางบนวันที่ไม่ได้ทดสอบผ่าน browser automation จริง (HTML5 drag-and-drop จำลองยาก) แต่ยืนยันด้วย code review ว่าใช้ `dataTransfer`/drop-handler ตัวเดียวกับที่ day cell chip ใช้อยู่แล้วทุกประการ ไม่มี logic ใหม่ที่ต้องพิสูจน์เพิ่ม
