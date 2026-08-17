## 1. Sidebar — เพิ่ม nested menu support

- [x] 1.1 เพิ่ม `children?: NavItem[]` ใน `NavItem` interface (`AppSidebar.tsx`)
- [x] 1.2 สร้าง `NestedNavItem` component สำหรับ render `NavItem` ที่มี children เป็น sub-group แบบ collapsible ได้ (ใช้ ChevronDown/ChevronRight animation เหมือน `CollapsibleGroup`)
- [x] 1.3 แก้ `CollapsibleGroup` ให้เรียก `NestedNavItem` เมื่อ item มี `children` property
- [x] 1.4 ปรับ `isActive` logic ให้รองรับ nested paths (เช่น `/content-approval` active ทำให้ parent "คอนเทนต์โซเชียล" expand)

## 2. Sidebar — ปรับโครงสร้างเมนูการตลาด

- [x] 2.1 แก้ไข `NAV_GROUPS` group การตลาด: เปลี่ยน items จาก flat list เป็น structure ใหม่
  - `แคมเปญอีเมล` → item ตรง `/marketing`
  - `คอนเทนต์โซเชียล` → item ที่มี children เป็น 4 รายการเรียงติดกัน:
    - `แดชบอร์ด` → `/content-dashboard`
    - `ผลงานคอนเทนต์` → `/content`
    - `รายการอนุมัติ` → `/content-approval`
    - `ปฏิทินคอนเทนต์` → `/content-planner`
  - `วิเคราะห์แคมเปญ` → item ตรง `/campaign-analytics`
  - `สตูดิโอสื่อ` → item ตรง `/media-studio`
- [x] 2.2 เลือก icons ที่เหมาะสม: `LayoutDashboard` สำหรับแดชบอร์ด, `ClipboardCheck` สำหรับรายการอนุมัติ, `PenTool` สำหรับผลงานคอนเทนต์, `CalendarDays` สำหรับปฏิทินคอนเทนต์

## 3. Backend — เพิ่ม menu key

- [x] 3.1 เพิ่ม `content_approval` ใน `ALL_MENU_KEYS` array ใน `api/auth.php`

## 4. Frontend — สร้างหน้ารายการอนุมัติ

- [x] 4.1 สร้าง `src/pages/ContentApprovalPage.tsx` และ `src/pages/ContentDashboardPage.tsx` ใช้ `PageShell` + shadcn-ui components อิงดีไซน์จาก mockup `mockup/pages/content/`
  - `ContentDashboardPage`: แสดง breadcrumb การตลาด > คอนเทนต์โซเชียล > แดชบอร์ด, overview metrics, content summary
  - `ContentApprovalPage`: แสดง breadcrumb การตลาด > คอนเทนต์โซเชียล > รายการอนุมัติ, ตาราง items status=review, approve/reject actions, filter
  - คอลัมน์: ชื่อคอนเทนต์, ผู้สร้าง, วันที่สร้าง, แพลตฟอร์ม, สถานะ
  - ปุ่ม actions: อนุมัติ (Dialog ยืนยัน), ปฏิเสธ (Dialog พร้อม textarea เหตุผล)
  - รองรับ filter ตามแพลตฟอร์ม
  - แสดง empty state เมื่อไม่มีรายการ
- [x] 4.2 เพิ่ม lazy import และ route ใน `src/App.tsx`
  - `const ContentDashboardPage = lazy(() => import('./pages/ContentDashboardPage'));`
  - `const ContentApprovalPage = lazy(() => import('./pages/ContentApprovalPage'));`
  - `<Route path="/content-dashboard" element={<PermissionRoute menuKey="marketing"><ContentDashboardPage /></PermissionRoute>} />`
  - `<Route path="/content-approval" element={<PermissionRoute menuKey="content_approval"><ContentApprovalPage /></PermissionRoute>} />`

## 5. Verification

- [x] 5.1 ตรวจสอบ sidebar แสดงผลถูกต้อง: กลุ่มการตลาดมี nested structure, กลุ่มอื่นไม่เปลี่ยนแปลง
- [x] 5.2 ตรวจสอบ navigation: ทุกลิงก์ในเมนูการตลาดนำทางไปหน้าถูกต้อง
- [x] 5.3 ตรวจสอบ permission: `content_approval` menuKey ทำงานถูกต้อง (ผู้ไม่มีสิทธิ์มองไม่เห็น)
- [x] 5.4 ตรวจสอบ active state: เมื่ออยู่ที่ `/content-approval` หรือ `/content` หรือ `/content-planner` → "คอนเทนต์โซเชียล" expand และ highlight, item ที่ active ถูก highlight
- [x] 5.5 ตรวจสอบหน้า `ContentPage`, `ContentPlannerPage`, `CampaignAnalyticsPage`, `MediaStudioPage`, `MarketingPage` ทำงานเหมือนเดิมทุกอย่าง
- [x] 5.6 รัน `pnpm lint` และ `pnpm build` เพื่อยืนยันไม่มี error
