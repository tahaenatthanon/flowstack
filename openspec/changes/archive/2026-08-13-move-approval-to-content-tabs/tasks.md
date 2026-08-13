## 1. แยก ContentApprovalTab

- [x] 1.1 สร้าง `src/components/content/tabs/ContentApprovalTab.tsx` — ย้ายเนื้อหาทั้งหมด (stat cards + toolbar + ตาราง + dialogs) จาก `ContentApprovalPage.tsx` ยกเว้น `PageShell`
- [x] 1.2 ย้าย imports ที่จำเป็น (hooks, components, types) ไปที่ `ContentApprovalTab.tsx`

## 2. Refactor ContentApprovalPage

- [x] 2.1 แก้ `src/pages/ContentApprovalPage.tsx` ให้ render `<PageShell ...>` ห่อ `<ContentApprovalTab />`
- [x] 2.2 คง breadcrumb/title เดิมของหน้า route ไว้

## 3. เพิ่ม Tab ใน ContentPage

- [x] 3.1 import `ContentApprovalTab` ใน `src/pages/ContentPage.tsx`
- [x] 3.2 เพิ่ม `<TabsTrigger value="approval">` หลัง `<TabsTrigger value="content">` ทันที (icon `ClipboardCheck`, label "รายการอนุมัติ")
- [x] 3.3 เพิ่ม `<TabsContent value="approval"><ContentApprovalTab /></TabsContent>` หลัง content
- [x] 3.4 เปลี่ยน `sm:grid-cols-4` → `sm:grid-cols-5` ใน TabsList

## 4. ลบเมนู Sidebar

- [x] 4.1 ลบรายการ `{ title: 'รายการอนุมัติ', href: '/content-approval', icon: ClipboardCheck, menuKey: 'content_approval' }` จาก `src/components/AppSidebar.tsx`
- [x] 4.2 ลบ import `ClipboardCheck` ถ้าไม่ถูกใช้ที่อื่นใน AppSidebar

## 5. การตรวจสอบและบูรณาการ

- [x] 5.1 รัน `pnpm build` — ตรวจสอบไม่มี TypeScript errors
- [x] 5.2 รัน `pnpm lint` — ตรวจสอบไม่มี ESLint errors
- [x] 5.3 รัน `pnpm test` — ตรวจสอบ test ผ่าน (ถ้ามี test เกี่ยวข้อง)
- [ ] 5.4 ทดสอบด้วยตนเอง: Sidebar ไม่มีรายการ "รายการอนุมัติ"
- [ ] 5.5 ทดสอบด้วยตนเอง: หน้าผลงานคอนเทนต์มี Tab "รายการอนุมัติ" ถัดจาก "ผลงานทั้งหมด"
- [ ] 5.6 ทดสอบด้วยตนเอง: กด Tab "รายการอนุมัติ" แสดงรายการอนุมัติถูกต้อง
