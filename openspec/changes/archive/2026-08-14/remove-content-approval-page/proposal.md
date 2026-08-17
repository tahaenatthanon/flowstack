## Why

ฟังก์ชัน "รายการอนุมัติ" ถูกย้ายไปแสดงเป็น Tab ภายในหน้า "ผลงานคอนเทนต์" (`/content`) เรียบร้อยแล้ว (ผ่าน `ContentApprovalTab`) แต่ route แยก `/content-approval` ยังคงเหลืออยู่ ทำให้ผู้ใช้เข้าถึงฟังก์ชันเดิมได้จากสองทาง ซ้ำซ้อนและสับสน อีกทั้งปุ่ม "ดูรายการอนุมัติทั้งหมด" ในคิวรออนุมัติของแดชบอร์ดคอนเทนต์ยังลิงก์ไปยัง route เก่าแทนที่จะพาไปที่ Tab "รายการอนุมัติ" ในหน้า `/content`

## What Changes

- ลบ route `/content-approval` ออกจาก `src/App.tsx` (ลบ `<Route>` + lazy import)
- ลบหน้า `src/pages/ContentApprovalPage.tsx` และ test `src/__tests__/content/ContentApprovalPage.test.tsx`
- ตรวจสอบและลบเมนู/ปุ่ม/ลิงก์ที่ชี้ไปยัง `/content-approval` — ไม่มีเมนูใน Sidebar; มีเพียงปุ่มในแดชบอร์ดคอนเทนต์
- เปลี่ยนปุ่ม "ดูรายการอนุมัติทั้งหมด" ในคิวรออนุมัติให้ลิงก์ไปยังหน้า `/content` (Tab "รายการอนุมัติ") แทน `/content-approval`
- เพิ่มการรองรับ URL query `?tab=approval` ในหน้า `/content` เพื่อให้เปิด Tab "รายการอนุมัติ" โดยตรง

## Capabilities

### New Capabilities

<!-- ไม่มี capability ใหม่ -->

### Modified Capabilities

- `content-approval-list`: หน้า "รายการอนุมัติ" ไม่มี route แยกอีกต่อไป — เข้าถึงผ่าน Tab "รายการอนุมัติ" ในหน้า `/content` เท่านั้น
- `content-dashboard-pending-queue`: ปุ่มลัด "ดูรายการ" เปลี่ยนจาก `/content-approval` เป็น `/content` (Tab รายการอนุมัติ)

## Impact

- `src/App.tsx` — ลบ lazy import `ContentApprovalPage` + `<Route path="/content-approval">`
- `src/pages/ContentApprovalPage.tsx` — ลบไฟล์
- `src/__tests__/content/ContentApprovalPage.test.tsx` — ลบไฟล์
- `src/pages/ContentDashboardPage.tsx` — เปลี่ยน `navigate('/content-approval')` เป็นลิงก์ไป `/content` (Tab รายการอนุมัติ)
- `src/pages/ContentPage.tsx` — อ่าน `?tab=approval` เพื่อเปิด Tab "รายการอนุมัติ"
- ไม่กระทบ `ContentApprovalTab.tsx` (คอมโพเนนต์ยังใช้ใน Tab) หรือ API/DB/hooks
- `api/auth.php` — menuKey `content_approval` กลายเป็นไม่ถูกใช้ (คงไว้ ไม่ลบ เพื่อไม่กระทบข้อมูล permission เดิม)
