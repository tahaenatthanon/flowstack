## Context

`ContentPlannerCalendar.tsx` แสดง content item ในมุมมองปฏิทิน (Month/Quarter/Year) โดย bucket item ทั้งหมดจาก `plans` ผ่าน `itemsByDate` (`useMemo`) ด้วย key `item.scheduled_date || item.day_label` แล้วข้าม (`continue`) เมื่อ key เป็น falsy — สำรวจแล้วพบว่านี่ทำให้เกิดการ "หาย" ของ item ได้ 2 แบบ:

1. **Falsy key**: item ที่ไม่มีทั้ง `scheduled_date` และ `day_label` (เช่น Direct-mode item ที่ยังไม่ตั้งวันที่) → `if (!key) continue;` ข้ามไปเลย ไม่ถูกเก็บใน Map แม้แต่ใต้ key ผิด
2. **Dead key**: item ที่ไม่มี `scheduled_date` แต่มี `day_label` (เช่น `"จันทร์"`) → ถูกเก็บใน Map ใต้ key ที่เป็นชื่อวัน ไม่ใช่ `YYYY-MM-DD` แต่ `renderCell` ค้นด้วย `toDateKey(date)` เสมอ (รูปแบบ `YYYY-MM-DD`) จึงไม่มีทาง match — item ถูกเก็บไว้ในหน่วยความจำแต่ไม่มีทาง render ได้เช่นกัน

ทั้งสองแบบมีผลลัพธ์เดียวกันต่อผู้ใช้: item หายไปจาก Calendar โดยไม่มี indicator ใดๆ `ContentItemList.tsx` (List view) มี pattern แสดง item แบบนี้อยู่แล้ว (ไฮไลต์ `bg-amber-50 dark:bg-amber-950/10`, label "ยังไม่กำหนด" + `CalendarX2` icon, `draggable`) — ใช้เป็นต้นแบบ visual language

Scope ของ change นี้ถูกจำกัดไว้ที่ `ContentPlannerCalendar.tsx` ไฟล์เดียวเท่านั้น (ตัดสินใจไว้ในขั้น explore) — ไม่แตะ `ContentPlannerPage.tsx`, `ContentCardDialog.tsx`, หรือ backend

## Goals / Non-Goals

**Goals:**
- item ที่ resolve แล้วไม่มี real date key (ทั้ง falsy-key และ dead-key จากด้านบน) ต้องแสดงในมุมมอง Calendar เสมอ ผ่าน bucket "ยังไม่กำหนดวันที่" เหนือ grid
- bucket ใช้ `typeFilter`/`platformFilter` เดียวกับ grid, แสดงทุก view (Month/Quarter/Year), แสดงเฉพาะเมื่อไม่ว่าง
- item ใน bucket ลากไปวางบน day cell ได้ (schedule) และคลิกเพื่อแก้ไขได้ — โดย reuse mechanism ที่มีอยู่แล้วทั้งหมด ไม่เพิ่ม prop ใหม่ ไม่แก้ไฟล์อื่น
- Legacy Content Plan item ที่มี `scheduled_date` จริงอยู่แล้ว ต้องแสดงบน grid เหมือนเดิมทุกประการ ไม่มีการเปลี่ยนแปลง

**Non-Goals:**
- ไม่ทำ drag-กลับเข้า bucket เพื่อ unschedule (Option C จาก explore — เป็น feature เสริม)
- ไม่บังคับ QuickCreateDialog ให้เลือกวันที่ตอนสร้าง (แก้ที่ต้นทาง เป็นคนละ change)
- ไม่สืบ/แก้ backend ว่า `action=plan-items` POST สร้าง item แบบ day_label-only-ไม่มี scheduled_date ได้จริงหรือไม่ — Calendar defend แบบ generic ไปเลยไม่ว่าที่มาจะเป็นอะไร
- ไม่เพิ่ม prop ใหม่ใน `ContentPlannerCalendar` และไม่แก้ `ContentPlannerPage.tsx`

## Decisions

### 1. นิยาม "unscheduled" = ไม่มี `scheduled_date` (ไม่สนใจ `day_label`)
เดิม key คำนวณจาก `item.scheduled_date || item.day_label` เปลี่ยนเป็น: ใช้ `item.scheduled_date` เป็นตัวตัดสินเพียงตัวเดียวว่า item นี้มี real date key หรือไม่ — ถ้าไม่มี ให้เข้า unscheduled bucket ทันที ไม่สนใจว่า `day_label` จะมีค่าอะไร (ตัด `|| item.day_label` ออกจากการคำนวณ key สำหรับ grid โดยสิ้นเชิง เพราะไม่มี `day_label` ค่าไหนที่ตรงกับรูปแบบ `toDateKey()` ได้อยู่แล้ว)
ทางเลือกที่ปัดตก: เก็บ `day_label` ไว้เป็น fallback key ต่อไปแต่เพิ่มการเช็ครูปแบบ (regex `YYYY-MM-DD`) ก่อนใช้เป็น key — ซับซ้อนเกินความจำเป็น เพราะ `day_label` ไม่เคยเป็นรูปแบบวันที่จริงในโค้ดปัจจุบันเลย (`CONTENT_PLAN_DAY_DEFS` เป็นชื่อวันภาษาไทยหรือ `'วันที่ N'` เสมอ)

### 2. คำนวณ unscheduled bucket ในลูปเดียวกับ `itemsByDate` (ไม่เพิ่ม `useMemo` ใหม่)
ขยาย `useMemo` เดิมให้ return ทั้ง `itemsByDate` (Map) และ `unscheduledItems` (array) จากลูปเดียวกัน — ผ่าน `typeFilter`/`platformFilter` filter เดียวกันที่มีอยู่แล้วในลูป ทำให้ bucket สอดคล้องกับ grid โดยอัตโนมัติ ไม่มี logic กรองซ้ำซ้อน

### 3. Bucket แสดงเป็น sibling เหนือ view-specific render block
วาง bucket JSX ไว้ก่อน `{view === 'month' && renderMonthView()}...` (นอก conditional ของแต่ละ view) เพื่อให้แสดงในทุก view โดยไม่ต้องแก้ `renderQuarterView`/`renderYearView` เลย — สอดคล้องกับ requirement "แสดงทุก view"

### 4. Chip ใน bucket = component/markup เดียวกับ chip ใน `renderCell`
ดึง logic ของ item chip (PlatformIcon + topic truncate, `draggable`, `onDragStart` set `dataTransfer` เป็น `{itemId, planId}` JSON, `onClick` เรียก edit) ออกมาเป็นจุดเดียวที่ทั้ง `renderCell` และ bucket เรียกใช้ร่วมกัน (ฟังก์ชัน helper ภายในไฟล์เดียวกัน) แทนการ copy-paste JSX ซ้ำ — ลดความเสี่ยงที่สองจุดจะ drift กันในอนาคต

### 5. Click-to-edit: `onDateClick(new Date(), [item])`
ใช้ prop `onDateClick` ที่มีอยู่แล้ว (ไม่เพิ่ม prop ใหม่) เรียกด้วย `new Date()` (วันนี้) เป็น placeholder date เมื่อคลิก chip ใน bucket —ยอมรับ cosmetic quirk ที่ dialog แสดง "วันนี้" ตอนเปิดจนกว่าผู้ใช้จะเลือกวันที่จริงหรือกดบันทึก (ผลลัพธ์ตอนบันทึกเหมือนกับพฤติกรรม List view's "แก้ไข" ที่มีอยู่แล้วทุกประการ — ดูหัวข้อ Risks)

## Risks / Trade-offs

- **[Risk]** dialog subtitle โชว์ "วันนี้" ทันทีที่เปิด item จาก bucket ทั้งที่ item ยังไม่ถูกกำหนดวันจริง อาจทำให้ผู้ใช้เข้าใจผิดชั่วขณะว่า item ถูกจัดตารางไว้แล้ว → **Mitigation**: ผลลัพธ์ปลายทางเหมือนกับพฤติกรรม List view ที่มีอยู่แล้ว (ซึ่งก็ pass `date=null` แล้ว dialog fallback ไปวันนี้เหมือนกันเมื่อไม่มี `existingItem.scheduled_date`) จึงไม่ใช่ regression ใหม่ เป็นความไม่สมบูรณ์ที่มีอยู่แล้วในระบบ ไม่ใช่สิ่งที่ change นี้สร้างขึ้น — ยอมรับตามที่ยืนยันไว้ในขั้น explore
- **[Risk]** ตัด `day_label` ออกจากการคำนวณ key อาจกระทบ item ที่ (ในทางทฤษฎี) มี `day_label` แต่ไม่มี `scheduled_date` และเคย (ผิดพลาด) ถูกเก็บไว้ใต้ dead key มาก่อน — แต่เนื่องจาก dead key ไม่เคย render ได้อยู่แล้วในทางปฏิบัติ การเปลี่ยนพฤติกรรมนี้มีแต่จะทำให้ item เหล่านั้น "ปรากฏ" ขึ้นมาเป็นครั้งแรก (ใน bucket) ไม่ใช่การทำให้สิ่งที่เคยแสดงอยู่หายไป → ไม่มี regression
- **[Risk]** Quarter/Year view ไม่เคย render chip รายชิ้นมาก่อน (มีแค่ summary/heatmap) — เพิ่ม bucket ที่โชว์ chip จริงในสองมุมมองนี้เป็นองค์ประกอบ UI ใหม่ที่ไม่เคยมี → **Mitigation**: bucket เป็น component เดียวกันไม่ขึ้นกับ view ที่เลือก (อยู่นอก per-view conditional) จึงไม่ต้องเพิ่ม logic เฉพาะ Quarter/Year เลย ความเสี่ยงคือแค่ด้าน UI/พื้นที่หน้าจอ ไม่ใช่ด้าน logic

## Migration Plan

ไม่มี schema/data migration — เป็นการเปลี่ยน frontend rendering logic ล้วนในไฟล์เดียว ไม่มี state เดิมที่ต้อง migrate
