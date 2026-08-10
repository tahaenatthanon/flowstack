## 1. Database migration — add `revision` status

- [x] 1.1 สร้าง migration file `database/migrations/YYYY_MM_DD_HHMMSS_add_revision_status.sql` สำหรับ ALTER TABLE `content_items` MODIFY `status` ENUM เพิ่มค่า `'revision'` หลัง `'draft'`
- [x] 1.2 รัน migration กับ MariaDB local และตรวจสอบ `DESCRIBE content_items`

## 2. Update STATUS_MAP — add `revision` and update `review`

- [x] 2.1 เปลี่ยน `STATUS_MAP.review.label` จาก `'รออนุมัติ'` เป็น `'รอเผยแพร่'` ใน `src/components/content/types.ts`
- [x] 2.2 เพิ่ม entry `revision: { label: 'รอแก้ไข', color: '...' }` ใน `STATUS_MAP`

## 3. Add status filter state and count logic

- [x] 3.1 เพิ่ม `useState` สำหรับ `statusFilter` ใน `ContentListTab` (`'all' | 'draft' | 'revision' | 'review' | 'published'`)
- [x] 3.2 เพิ่ม `useMemo` สำหรับนับจำนวน items ตาม status (`counts.draft`, `counts.revision`, `counts.review`, `counts.published`)
- [x] 3.3 เพิ่ม status filter condition ใน `filtered` `useMemo` ให้กรองตาม `statusFilter`

## 4. Add Status Sub-tab UI

- [x] 4.1 เพิ่ม `<Tabs>` component สำหรับ status filter ใน `ContentListTab` วางเหนือ Type Filter
- [x] 4.2 เพิ่ม `<TabsList>` พร้อม `<TabsTrigger>` 5 อัน: ทั้งหมด, ฉบับร่าง, รอแก้ไข, รอเผยแพร่, เผยแพร่แล้ว
- [x] 4.3 แต่ละ Sub-tab แสดงจำนวนนับใน badge (ใช้ className เดียวกับ Type Filter: `text-[10px] px-1.5 py-0 rounded-full bg-muted font-semibold`)
- [x] 4.4 เพิ่มไอคอนในแต่ละ Status Sub-tab: ทั้งหมด (`Layers`), ฉบับร่าง (`Edit3`), รอแก้ไข (`RotateCcw`), รอเผยแพร่ (`Clock`), เผยแพร่แล้ว (`CheckCircle2`) ขนาด `h-3.5 w-3.5` ระยะห่าง `gap-1.5` ตาม Design System-
- [x] 4.5 เพิ่มไอคอนใน Type Filter tab "ทั้งหมด" (`Layers` icon `h-3.5 w-3.5`) ให้สอดคล้องกับ tab "บทความ", "วีดีโอ", "รูปภาพ"
## 5. Verify and test

- [x] 5.1 ตรวจสอบว่าการกรองทำงานร่วมกับ Type Filter และ Platform Filter ได้ถูกต้อง (AND logic)
- [x] 5.2 ตรวจสอบว่า Status Sub-tab, Type Filter, และ Platform Filter ทั้งหมดรีเซ็ตกันอย่างถูกต้องเมื่อเปลี่ยน filter
- [x] 5.3 ตรวจสอบ responsive layout บน mobile — ทุก filter bar wrap ขึ้นบรรทัดใหม่ได้ (ตรวจสอบระดับโค้ด: `h-auto` + `flex-wrap`)
- [x] 5.4 รัน `pnpm lint` และ `pnpm build` ตรวจสอบไม่มี error
