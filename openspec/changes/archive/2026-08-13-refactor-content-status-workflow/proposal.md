## ทำไม

Workflow สถานะคอนเทนต์ปัจจุบันมี 5 สถานะ (`draft`, `revision`, `review`, `published`, `rejected`) ที่มีความหมายซ้ำซ้อน — `review` ทำหน้าที่สองอย่างคือ "รออนุมัติ" (จากมุมผู้สร้าง) และ "รอเผยแพร่" (จากมุมผู้อนุมัติ) ทำให้เกิดความสับสนระหว่างหน้าผลงานคอนเทนต์กับหน้ารายการอนุมัติ นอกจากนี้ยังไม่มีสถานะ `approved` ที่แยกระหว่างอนุมัติแล้วกับเผยแพร่แล้ว ทำให้ label ของสถานะไม่สอดคล้องกันในแต่ละ tab และ badge

## สิ่งที่เปลี่ยนแปลง

- **BREAKING**: เปลี่ยนชื่อ status key `review` → `pending_approval` ทั่วทั้งระบบ (DB, API, frontend)
- เพิ่มสถานะใหม่ `approved` (อนุมัติแล้ว) — แทรกระหว่าง `pending_approval` และ `published` ใน workflow
- เปลี่ยน label ภาษาไทยของ `draft` จาก "ร่าง" → "ฉบับร่าง"
- อัปเดต `STATUS_MAP` เพิ่มสถานะ `approved` และปรับ label ของ `draft` กับ `pending_approval`
- **Tabs หน้าผลงานคอนเทนต์**: ทั้งหมด, ฉบับร่าง (`draft`), รอแก้ไข (`revision`), รอเผยแพร่ (`approved`), เผยแพร่แล้ว (`published`)
- **Tabs หน้ารายการอนุมัติ**: ทั้งหมด (ไม่รวม `draft`/`published`), รออนุมัติ (`pending_approval`), อนุมัติแล้ว (`approved`), ขอแก้ไข (`revision`), ปฏิเสธ (`rejected`)
- ปุ่ม "อนุมัติ" ทั้งหมดเปลี่ยนเป้าหมายเป็น `approved` แทน `published`
- เพิ่มปุ่ม "เผยแพร่" ใน `ContentDetailView` สำหรับรายการที่มีสถานะ `approved` → `published`
- ปุ่มอนุมัติ/ขอแก้ไข/ปฏิเสธ ใช้ `pending_approval` เป็นสถานะต้นทาง
- DB migration: ALTER TABLE เปลี่ยน `review` → `pending_approval` และเพิ่ม `approved`

## ความสามารถ

### ความสามารถใหม่
- `content-publish-action`: ปุ่มเผยแพร่เนื้อหาที่อนุมัติแล้ว (`approved` → `published`) ใน `ContentDetailView`
- `content-approved-status`: สถานะ `approved` ใหม่ พร้อม tab, สี badge, และ logic การเปลี่ยนสถานะ

### ความสามารถที่ถูกแก้ไข
- `content-status-filter`: อัปเดตค่าและ label ของ tab — `review` → `pending_approval`, เพิ่ม tab `approved` ในหน้าผลงานคอนเทนต์
- `content-approval-list`: อัปเดตค่า tab — `review` → `pending_approval`, `published` → `approved`, กรองเฉพาะสถานะที่เกี่ยวข้องกับการอนุมัติ
- `content-request-approval`: เปลี่ยนเป้าหมายการขออนุมัติจาก `review` → `pending_approval`
- `approval-detail-actions`: เปลี่ยนเป้าหมายการอนุมัติจาก `published` → `approved`; เปลี่ยนการตรวจสอบต้นทางเป็น `pending_approval`
- `content-list-approval-actions`: เปลี่ยนเป้าหมายการอนุมัติจาก `published` → `approved`; เปลี่ยนการตรวจสอบต้นทางเป็น `pending_approval`
- `content-list-status-badge`: อัปเดต key และ label ของสถานะ
- `approval-tab-navigation`: อัปเดตค่า tab
- `approval-stats-cards`: อัปเดต key ของ stat

## ผลกระทบ

- **Database**: `content_items.status` ENUM — เปลี่ยน `review` → `pending_approval`, เพิ่ม `approved`
- **Migrations**: ไฟล์ migration ใหม่ 1 ไฟล์ (`database/migrations/`)
- **Backend**: `api/content-items.php` — ไม่ต้องแก้ไข (ไม่มีการ validate status ฝั่ง server)
- **Frontend**: `src/components/content/types.ts` (STATUS_MAP), `ContentListTab.tsx`, `ContentDetailView.tsx`, `ContentCardDialog.tsx`, `ContentApprovalPage.tsx`, `ContentDashboardPage.tsx`
- **Tests**: `src/__tests__/content/ContentApprovalPage.test.tsx` — ค่า status ใน fixture
