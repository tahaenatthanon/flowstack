## 1. ลบ route และหน้า content-approval

- [x] 1.1 ใน `src/App.tsx` ลบ `const ContentApprovalPage = lazy(() => import('./pages/ContentApprovalPage'));`
- [x] 1.2 ใน `src/App.tsx` ลบ `<Route path="/content-approval" element={<PermissionRoute menuKey="content_approval"> <ContentApprovalPage /> </PermissionRoute>} />`
- [x] 1.3 ลบไฟล์ `src/pages/ContentApprovalPage.tsx`
- [x] 1.4 ลบไฟล์ `src/__tests__/content/ContentApprovalPage.test.tsx`

## 2. รองรับการเปิด Tab "รายการอนุมัติ" ในหน้า /content

- [x] 2.1 ใน `src/pages/ContentPage.tsx` เพิ่ม `useSearchParams` เพื่ออ่าน param `tab`
- [x] 2.2 เปลี่ยน `<Tabs defaultValue="content">` เป็น controlled: ใช้ state เริ่มต้นจาก param `tab` (ถ้า `tab === 'approval'` → `'approval'`, ไม่งั้น `'content'`)
- [x] 2.3 ยืนยัน `/content?tab=approval` เปิด Tab "รายการอนุมัติ" โดยตรง

## 3. เปลี่ยนปุ่มลัดในคิวรออนุมัติ

- [x] 3.1 ใน `src/pages/ContentDashboardPage.tsx` เปลี่ยน `navigate('/content-approval')` เป็น `navigate('/content?tab=approval')`

## 4. ตรวจสอบและทดสอบ

- [x] 4.1 รัน `pnpm lint` และ `pnpm build` ให้ผ่าน
- [ ] 4.2 ทดสอบบนเบราว์เซอร์: `/#/content-approval` ไม่มีหน้านี้ (NotFound); ปุ่ม "ดูรายการอนุมัติทั้งหมด" ในแดชบอร์ดเปิดหน้า `/content` ที่ Tab "รายการอนุมัติ"
