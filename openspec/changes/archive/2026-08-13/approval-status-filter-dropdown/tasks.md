## 1. ContentApprovalPage — ลบ Tab Menu และเพิ่ม Filter Status

- [x] 1.1 ลบ `TABS` constant และ `EMPTY_STATE` constant ออกจาก `ContentApprovalPage.tsx`
- [x] 1.2 เปลี่ยน state `activeTab` เป็น `statusFilter` (`'all' | 'approved' | 'pending_approval' | 'revision' | 'rejected'`)
- [x] 1.3 ลบ `tabCounts` object และ logic ที่อ้างอิง
- [x] 1.4 เปลี่ยน `tabItems` เป็น `statusFiltered` ที่กรองด้วย `statusFilter` แทน `activeTab`
- [x] 1.5 ปรับ `usedTypes`/`usedPlatforms` ให้อิง `statusFiltered` แทน `tabItems`
- [x] 1.6 ปรับ empty state ให้ใช้ค่าเดียว (ลบ `EMPTY_STATE[activeTab]`)
- [x] 1.7 ลบ JSX `<Tabs>...</Tabs>` และเพิ่ม `<Select>` Filter Status ใน toolbar (แถวเดียวกับ type/platform/sort)
- [x] 1.8 เปลี่ยน label sort เป็น "ล่าสุด-เก่าสุด" (`requested_desc`) และ "เก่าสุด-ล่าสุด" (`requested_asc`)
- [x] 1.9 ลบ import ที่ไม่ใช้ (`Tabs`, `TabsList`, `TabsTrigger`, และ icon ที่เหลือใช้)

## 2. การทดสอบ

- [x] 2.1 อัปเดต `src/__tests__/content/ContentApprovalPage.test.tsx` — อัปเดต assertions จาก tab เป็น filter dropdown และ label sort ใหม่

## 3. การตรวจสอบและบูรณาการ

- [x] 3.1 รัน `pnpm build` — ตรวจสอบไม่มี TypeScript errors
- [x] 3.2 รัน `pnpm lint` — ตรวจสอบไม่มี ESLint errors
- [x] 3.3 รัน `pnpm test` — ตรวจสอบ test ผ่าน
- [ ] 3.4 ทดสอบด้วยตนเอง: หน้ารายการอนุมัติไม่แสดง Tab Menu (มี Filter Status Dropdown แทน)
- [ ] 3.5 ทดสอบด้วยตนเอง: เลือก Filter Status กรองรายการถูกต้อง
- [ ] 3.6 ทดสอบด้วยตนเอง: sort แสดง label "ล่าสุด-เก่าสุด" / "เก่าสุด-ล่าสุด"
