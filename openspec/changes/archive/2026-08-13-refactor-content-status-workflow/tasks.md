## 1. การ Migration ฐานข้อมูล

- [x] 1.1 สร้างไฟล์ migration `database/migrations/YYYY_MM_DD_HHMMSS_refactor_content_status_enum.sql`
- [x] 1.2 SQL: `ALTER TABLE content_items MODIFY COLUMN status ENUM('published','draft','revision','pending_approval','rejected','approved')`
- [x] 1.3 รัน migration กับ MariaDB เครื่อง local
- [x] 1.4 ตรวจสอบ: `SHOW COLUMNS FROM content_items LIKE 'status'` แสดงค่า ENUM ใหม่

## 2. STATUS_MAP และ Types

- [x] 2.1 เปลี่ยน key `review` → `pending_approval` ใน `STATUS_MAP`
- [x] 2.2 เปลี่ยน label `draft` จาก "ร่าง" → "ฉบับร่าง"
- [x] 2.3 เปลี่ยน label `pending_approval` เป็น "รออนุมัติ"
- [x] 2.4 เพิ่ม `approved: { label: 'อนุมัติแล้ว', color: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300' }` ใน STATUS_MAP

## 3. ContentListTab — Status Keys และ Tabs

- [x] 3.1 เปลี่ยน status key `review` → `pending_approval` ใน type union ของ `statusFilter` (`'all' | 'draft' | 'revision' | 'pending_approval' | 'approved' | 'published'`)
- [x] 3.2 อัปเดต status filter tabs: ฉบับร่าง (`draft`), รอแก้ไข (`revision`), รอเผยแพร่ (`approved`), เผยแพร่แล้ว (`published`)
- [x] 3.3 อัปเดต `statusCounts`: เปลี่ยน `review` → `pending_approval`, เพิ่ม `approved`
- [x] 3.4 อัปเดต type `applyDecision`: `'published' | 'revision' | 'rejected'` → `'approved' | 'revision' | 'rejected'`
- [x] 3.5 อัปเดต `handleApprove`: เปลี่ยนสถานะเป้าหมายจาก `'published'` → `'approved'`
- [x] 3.6 อัปเดต `item.status === 'review'` → `item.status === 'pending_approval'`
- [x] 3.7 อัปเดต status badge ให้ใช้ key และ label ใหม่ (STATUS_MAP-driven — ไม่ต้องแก้โค้ดเพิ่ม)

## 4. ContentDetailView — Status Keys และปุ่มเผยแพร่

- [x] 4.1 อัปเดต type `applyDecision`: `'published' | 'revision' | 'rejected'` → `'approved' | 'revision' | 'rejected'`
- [x] 4.2 อัปเดต `canApprove`: `item.status === 'review'` → `item.status === 'pending_approval'`
- [x] 4.3 อัปเดตเป้าหมาย request-approval: `{ status: 'review' }` → `{ status: 'pending_approval' }`
- [x] 4.4 เพิ่มปุ่ม "เผยแพร่" ใน action bar (context='content') เมื่อ `item.status === 'approved'` — `<Send>` icon, `variant="default"`, สีเขียว
- [x] 4.5 สร้างฟังก์ชัน `handlePublish` — PUT `{ status: 'published' }`, invalidate queries, toast "เผยแพร่แล้ว"
- [x] 4.6 เพิ่ม confirm dialog สำหรับการเผยแพร่

## 5. ContentCardDialog — Status Key

- [x] 5.1 อัปเดตเป้าหมาย request-approval: `{ status: 'review' }` → `{ status: 'pending_approval' }`

## 6. ContentApprovalPage — Tabs, ตัวกรอง, Stat Cards

- [x] 6.1 อัปเดต TABS constant: เปลี่ยน `review` → `pending_approval` (รออนุมัติ), `published` → `approved` (อนุมัติแล้ว)
- [x] 6.2 นำ `draft` และ `published` ออกจากตัวกรอง tab "ทั้งหมด" — แสดงเฉพาะ `pending_approval`, `approved`, `revision`, `rejected`
- [x] 6.3 อัปเดต `statusCounts`: เปลี่ยน `review` → `pending_approval`, เปลี่ยน `published` → `approved`
- [x] 6.4 อัปเดต `handleApprove`: สถานะเป้าหมาย `'published'` → `'approved'`
- [x] 6.5 อัปเดตการตรวจสอบ `isPending`: `item.status === 'review'` → `item.status === 'pending_approval'`
- [x] 6.6 อัปเดต keys ของ EMPTY_STATE ให้ตรงกับค่า tab ใหม่
- [x] 6.7 อัปเดต stat cards array: key จาก `review`/`published` → `pending_approval`/`approved`

## 7. ContentDashboardPage — Status Keys

- [x] 7.1 อัปเดต `reviewCount` → `pendingApprovalCount` ด้วย `items.filter(i => i.status === 'pending_approval')`
- [x] 7.2 อัปเดต `publishedCount` — คงเดิม (published ยังใช้ key เดิม)

## 8. การทดสอบ

- [x] 8.1 อัปเดต `src/__tests__/content/ContentApprovalPage.test.tsx` — ค่า status ใน fixture `'review'` → `'pending_approval'`, อัปเดต assertions

## 9. การตรวจสอบและบูรณาการ

- [x] 9.1 รัน `pnpm build` — ตรวจสอบไม่มี TypeScript errors
- [x] 9.2 รัน `pnpm lint` — ตรวจสอบไม่มี ESLint errors
- [ ] 9.3 ทดสอบด้วยตนเอง: สร้าง content → status เป็น "ฉบับร่าง"
- [ ] 9.4 ทดสอบด้วยตนเอง: กด "ขออนุมัติ" → status เปลี่ยนเป็น "รออนุมัติ" → ปรากฏใน approval page tab "รออนุมัติ"
- [ ] 9.5 ทดสอบด้วยตนเอง: กด "อนุมัติ" → status เปลี่ยนเป็น "อนุมัติแล้ว" → ปรากฏใน content page tab "รอเผยแพร่"
- [ ] 9.6 ทดสอบด้วยตนเอง: กด "ขอแก้ไข" → status เปลี่ยนเป็น "รอแก้ไข" → ปรากฏทั้ง 2 หน้า
- [ ] 9.7 ทดสอบด้วยตนเอง: กด "ปฏิเสธ" → status เปลี่ยนเป็น "ปฏิเสธ" → ปรากฏใน approval page
- [ ] 9.8 ทดสอบด้วยตนเอง: กด "เผยแพร่" → status เปลี่ยนเป็น "เผยแพร่แล้ว" → ปรากฏใน content page tab "เผยแพร่แล้ว"
- [ ] 9.9 ทดสอบด้วยตนเอง: Approval page "ทั้งหมด" ไม่แสดง draft และ published items
- [ ] 9.10 ทดสอบด้วยตนเอง: Status badge แสดงสีตัวอักษรถูกต้องทุกสถานะ
