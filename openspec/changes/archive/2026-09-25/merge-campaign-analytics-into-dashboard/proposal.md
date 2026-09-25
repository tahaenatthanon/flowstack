## Why

ผลการตลาดตอนนี้กระจายอยู่ 2 เมนู คือ "แดชบอร์ดคอนเทนต์" (ผลโซเชียลและการผลิต) กับ "วิเคราะห์แคมเปญ" (ผลอีเมลแคมเปญ) ผู้บริหารต้องเปิด 2 หน้าเพื่อดูภาพรวม รวมเป็นหน้าเดียวที่สลับระหว่างคอนเทนต์กับแคมเปญได้ จะเข้าถึงง่ายกว่าและลดเมนูลง 1 รายการ เป็นการย้ายของเดิมมารวมกัน ไม่เปลี่ยนตัวเลขหรือแหล่งข้อมูล

## What Changes

- เพิ่มปุ่มสลับ [คอนเทนต์ │ แคมเปญ] ที่มุมขวาบนของหัวหน้า (ช่อง `actions` ของ `PageShell`) ผูกกับ URL `?section=campaign` ถ้าไม่มีพารามิเตอร์นี้คือคอนเทนต์
- ส่วนคอนเทนต์ = แท็บภาพรวม + วิเคราะห์ เหมือนเดิมทุกอย่าง (URL `tab`/`view` เดิมใช้ได้ทั้งหมด)
- ส่วนแคมเปญ = เนื้อหาจาก `CampaignAnalyticsPage` แยกเป็น component `CampaignAnalyticsTab` (ตัด breadcrumb และหัวข้อหน้า คงตัวกรอง 30 วัน/90 วัน/12 เดือน และ API `api/campaign-analytics.php` เดิม)
- **BREAKING (URL):** `/campaign-analytics` เปลี่ยนเป็น redirect ไป `/content-dashboard?section=campaign` และลบไฟล์หน้าเดิม
- เปลี่ยนชื่อที่ผู้ใช้เห็นจาก "แดชบอร์ดคอนเทนต์" เป็น "แดชบอร์ดการตลาด" (เมนูข้าง, หัวข้อหน้า, breadcrumb, ข้อความในฟอร์มตั้งเป้าคอนเทนต์) route `/content-dashboard` และชื่อโค้ดคงเดิม
- เอาเมนู "วิเคราะห์แคมเปญ" ออกจาก sidebar
- GlobalSearch: รายการ "วิเคราะห์แคมเปญ" ชี้ไปส่วนแคมเปญ และเพิ่มรายการ "แดชบอร์ดการตลาด"
- หน้าแคมเปญอีเมลเพิ่มลิงก์เล็ก "ดูผลแคมเปญ" ข้างหัวข้อ (ไม่แย่งตำแหน่งปุ่มหลัก 3 ปุ่มเดิม)
- คำอธิบายใต้หัวข้อหน้าเปลี่ยนตามส่วนที่เลือก
- ส่วนแคมเปญไม่ต้องรอข้อมูลคอนเทนต์โหลด (แต่ละส่วนรอเฉพาะข้อมูลของตัวเอง)

## Capabilities

### New Capabilities
- `marketing-dashboard-sections`: ปุ่มสลับส่วนคอนเทนต์/แคมเปญของแดชบอร์ดการตลาด, การผูก URL, redirect จาก `/campaign-analytics`, ชื่อที่แสดง และลิงก์ "ดูผลแคมเปญ" จากหน้าแคมเปญอีเมล

### Modified Capabilities
- `email-campaign-analytics`: analytics แคมเปญย้ายจากหน้า `/campaign-analytics` ไปอยู่ส่วนแคมเปญของแดชบอร์ดการตลาด และถอด requirement breadcrumb ของหน้าเดิม
- `sidebar-nested-menu`: เมนูการตลาดเหลือ 5 รายการ และรายการแรกชื่อ "แดชบอร์ดการตลาด"
- `global-search-marketing-entries`: รายการ "วิเคราะห์แคมเปญ" ชี้ไปส่วนแคมเปญ และมีรายการ "แดชบอร์ดการตลาด"
- `campaigns-page-canonical-route`: รายการหน้าที่มี breadcrumb ไป `/campaigns` ไม่มี `CampaignAnalyticsPage` อีก

## Impact

- **Frontend:** `src/pages/ContentDashboardPage.tsx`, `src/pages/CampaignAnalyticsPage.tsx` (ลบ), ไฟล์ใหม่ `src/components/content/CampaignAnalyticsTab.tsx`, `src/App.tsx`, `src/components/AppSidebar.tsx`, `src/components/GlobalSearch.tsx`, `src/pages/CampaignsPage.tsx`, `src/components/brand/ContentGoalForm.tsx`
- **Backend / DB:** ไม่มีการเปลี่ยนแปลง
- **Permission:** ใช้ `menuKey="marketing"` เดิม ไม่มี menuKey ใหม่
- **ลิงก์ภายนอก / bookmark:** `/campaign-analytics` ยังใช้ได้ผ่าน redirect
