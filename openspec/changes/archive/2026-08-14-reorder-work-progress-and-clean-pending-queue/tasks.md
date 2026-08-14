## 1. สลับลำดับสถานะใน Work Progress

- [x] 1.1 ใน `src/pages/ContentDashboardPage.tsx` เปลี่ยน `workProgressStatuses` จาก `['published', 'pending_approval', 'approved', 'revision', 'draft']` เป็น `['published', 'approved', 'pending_approval', 'revision', 'draft']`
- [x] 1.2 ยืนยัน "อนุมัติแล้ว" แสดงก่อน "รออนุมัติ" ในส่วนความคืบหน้าการผลิต

## 2. ปรับคิวรออนุมัติ

- [x] 2.1 ใน `src/pages/ContentDashboardPage.tsx` เปลี่ยน `formatDate(item.requested_at)` เป็น `formatDate(item.created_at)` ในรายการคิวรออนุมัติ
- [x] 2.2 ลบ `<Badge variant="outline" className={STATUS_MAP.pending_approval.color}>รออนุมัติ</Badge>` ออกจากแต่ละรายการในคิวรออนุมัติ
- [x] 2.3 ยืนยันคิวรออนุมัติแสดงเฉพาะ `pending_approval` (filter คงเดิม) และแสดงชื่อ + วันที่สร้าง โดยไม่มี badge สถานะ

## 3. ตรวจสอบและทดสอบ

- [x] 3.1 รัน `pnpm lint` และ `pnpm build` ให้ผ่าน
- [ ] 3.2 ทดสอบบนเบราว์เซอร์: เปิดแดชบอร์ดคอนเทนต์ — "อนุมัติแล้ว" อยู่ก่อน "รออนุมัติ" ในความคืบหน้าการผลิต, คิวรออนุมัติแสดงวันที่สร้างและไม่มี badge สถานะ
