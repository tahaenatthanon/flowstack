## 1. เพิ่ม icon ให้กับ STATUS_MAP

- [x] 1.1 ใน `src/components/content/types.ts` เพิ่ม import icon ที่จำเป็น (CheckCircle2, Clock, BadgeCheck, RotateCcw, Edit3, XCircle) จาก lucide-react
- [x] 1.2 เปลี่ยน type `STATUS_MAP` เป็น `{ label: string; color: string; icon: LucideIcon; iconColor: string }`
- [x] 1.3 เติม `icon` และ `iconColor` ให้ครบทุกสถานะ (published, draft, revision, pending_approval, approved, rejected) ตาม mapping ใน design

## 2. Render ไอคอนใน Work Progress

- [x] 2.1 ใน `ContentDashboardPage.tsx` เปลี่ยน span label เป็น flex container ที่แสดง `<Icon className="h-3.5 w-3.5 {info.iconColor}" />` หน้า `{info.label}`
- [x] 2.2 ยืนยันว่าจำนวนชิ้น/เปอร์เซ็นต์/progress bar/ยอดรวม คงเดิม

## 3. ตรวจสอบและทดสอบ

- [x] 3.1 รัน `pnpm lint` และ `pnpm build` ให้ผ่าน
- [x] 3.2 ทดสอบบนเบราว์เซอร์: เปิดแดชบอร์ดคอนเทนต์ — ส่วน "ความคืบหน้าการผลิต" แสดงไอคอนหน้า label ทั้ง 5 สถานะ สีถูกต้อง
- [x] 3.3 ยืนยันว่า badge สถานะที่อื่นที่ใช้ `STATUS_MAP.color` ยังแสดงผลเหมือนเดิม (field ใหม่ไม่กระทบ)

## 4. ปรับไอคอนให้สอดคล้องกันทั้ง 3 หน้า

- [x] 4.1 ใน `ContentDashboardPage.tsx` เปลี่ยนไอคอน Stat Card "ฉบับร่าง" จาก `AlertTriangle` เป็น `Edit3`
- [x] 4.2 ใน `ContentApprovalTab.tsx` เปลี่ยนไอคอน Stat Card `revision` จาก `AlertTriangle` เป็น `RotateCcw` และ `approved` จาก `CheckCircle2` เป็น `BadgeCheck`
- [x] 4.3 ใน `ContentListTab.tsx` เปลี่ยนไอคอน status tab `approved` (label "รอเผยแพร่") จาก `Clock` เป็น `BadgeCheck` ตามสถานะ `approved`

## 5. ตรวจสอบและทดสอบ (ไอคอนข้ามหน้า)

- [x] 5.1 รัน `pnpm lint` และ `pnpm build` ให้ผ่าน
- [x] 5.2 ทดสอบบนเบราว์เซอร์: เปิดทั้ง 3 หน้า (แดชบอร์ดคอนเทนต์, ผลงานคอนเทนต์, รายการอนุมัติ) — สถานะเดียวกันใช้ไอคอนเดียวกัน (published=CheckCircle2, draft=Edit3, revision=RotateCcw, pending_approval=Clock, approved=BadgeCheck, rejected=XCircle)
- [x] 5.3 ยืนยันว่า label, จำนวน, และฟังก์ชันเดิมในแต่ละหน้าไม่ถูกกระทบ
