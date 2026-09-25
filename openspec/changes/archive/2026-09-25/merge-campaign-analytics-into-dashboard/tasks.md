## 1. แยกส่วนแคมเปญเป็น component

- [x] 1.1 สร้าง `src/components/content/CampaignAnalyticsTab.tsx` จากเนื้อหา `CampaignAnalyticsPage.tsx` เอา `PageShell`/breadcrumb/หัวข้อออก คงตัวกรอง `range` (30 วัน/90 วัน/12 เดือน), `topSort`, `queryKey` และ API เดิม
- [x] 1.2 เปลี่ยนจุด return ก่อน (กำลังโหลด / error) ให้แสดงภายใน component ไม่ครอบ `PageShell`

## 2. ปุ่มสลับส่วนในแดชบอร์ด

- [x] 2.1 `ContentDashboardPage.tsx`: อ่าน `section` จาก URL (`campaign` = แคมเปญ, อื่น ๆ = คอนเทนต์) และ handler สลับส่วน (ไปแคมเปญ = `{ section: 'campaign' }`, กลับคอนเทนต์ = `{}`) โดยไม่แก้ `handleTabChange`/`handleViewChange` เดิม
- [x] 2.2 ใส่ปุ่มสลับ [คอนเทนต์ │ แคมเปญ] ด้วย `ToggleGroup` ในช่อง `actions` ของ `PageShell` แสดงชื่อเต็มทุกขนาดจอ
- [x] 2.3 ย้ายจุดรอโหลด (`isLoading`) ให้ครอบเฉพาะส่วนคอนเทนต์ และ render `CampaignAnalyticsTab` เมื่ออยู่ส่วนแคมเปญ
- [x] 2.4 หัวข้อหน้า "แดชบอร์ดการตลาด", breadcrumb "การตลาด" (`/campaigns`) › "แดชบอร์ด" และคำอธิบายใต้หัวข้อตามส่วน

## 3. Route, เมนู, การค้นหา และข้อความ

- [x] 3.1 `App.tsx`: `/campaign-analytics` เป็น `<Navigate to="/content-dashboard?section=campaign" replace />` ภายใต้ `PermissionRoute menuKey="marketing"` และเอา lazy import ของ `CampaignAnalyticsPage` ออก
- [x] 3.2 ลบ `src/pages/CampaignAnalyticsPage.tsx` (ยืนยันก่อนว่าไม่มีที่อื่น import)
- [x] 3.3 `AppSidebar.tsx`: เอารายการ "วิเคราะห์แคมเปญ" ออก และเปลี่ยนชื่อ "แดชบอร์ดคอนเทนต์" เป็น "แดชบอร์ดการตลาด"
- [x] 3.4 `GlobalSearch.tsx`: รายการ "วิเคราะห์แคมเปญ" ชี้ไป `/content-dashboard?section=campaign` และเพิ่มรายการ "แดชบอร์ดการตลาด" (`/content-dashboard`)
- [x] 3.5 `ContentGoalForm.tsx`: เปลี่ยนข้อความ "แดชบอร์ดคอนเทนต์" เป็น "แดชบอร์ดการตลาด"
- [x] 3.6 `CampaignsPage.tsx`: เพิ่มลิงก์ "ดูผลแคมเปญ" (ghost + ไอคอนกราฟ) ไป `/content-dashboard?section=campaign` นอกแถวปุ่มหลัก ตาม D7

## 4. ตรวจสอบ

- [x] 4.1 เพิ่ม test: ปุ่มสลับเปลี่ยน URL/ส่วนได้, `?section=campaign` แสดงส่วนแคมเปญ, ลิงก์เดิม `?tab=analytics&view=social` ยังเปิดแท็บเดิม, ส่วนคอนเทนต์ไม่เรียก `campaign-analytics.php`
- [x] 4.2 เปิด dev server ตรวจ: สลับส่วนไปมา, refresh ค้างส่วนเดิม, `#/campaign-analytics` redirect ถูก, เมนูข้างเหลือ 5 รายการ, GlobalSearch, ลิงก์ในหน้าแคมเปญอีเมล และหน้าตาบนจอมือถือ
- [x] 4.3 รัน `pnpm lint`, `pnpm build`, `pnpm test` — lint 0 error (48 warning เท่าเดิม), build ผ่าน, test ผ่าน 326 (เพิ่ม 5 ตัวใหม่) fail 8 ตัวเดิมใน BatchGenerateDialog/PullFromContentDialog/QuickCreateDialog ที่ fail อยู่ก่อนแล้ว
