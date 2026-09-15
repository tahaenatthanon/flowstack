## 1. Rename ไฟล์และ component

- [x] 1.1 Rename `src/pages/MarketingPage.tsx` → `src/pages/CampaignsPage.tsx` (ทับไฟล์ dead code เดิม เก็บเนื้อหาทั้งหมดไว้เหมือนเดิม)
- [x] 1.2 เปลี่ยนชื่อ `export default function MarketingPage()` → `export default function CampaignsPage()` ในไฟล์ที่ rename แล้ว

## 2. สลับ route ใน App.tsx

- [x] 2.1 แก้ import: `const MarketingPage = lazy(() => import('./pages/MarketingPage'))` → `const CampaignsPage = lazy(() => import('./pages/CampaignsPage'))`
- [x] 2.2 แก้ `<Route path="/marketing" element={<PermissionRoute menuKey="marketing"><MarketingPage /></PermissionRoute>} />` → ย้ายไปเป็น `<Route path="/campaigns" element={<PermissionRoute menuKey="marketing"><CampaignsPage /></PermissionRoute>} />`
- [x] 2.3 แก้ `<Route path="/campaigns" element={<Navigate to="/marketing" replace />} />` → เปลี่ยนเป็น `<Route path="/marketing" element={<Navigate to="/campaigns" replace />} />` (สลับทิศ)

## 3. อัปเดต href ที่อ้างอิงหน้านี้

- [x] 3.1 `src/components/AppSidebar.tsx:91` — href `/marketing` → `/campaigns`
- [x] 3.2 `src/pages/CampaignAnalyticsPage.tsx:75` — breadcrumb href `/marketing` → `/campaigns`
- [x] 3.3 `src/pages/ContentPage.tsx:33` — breadcrumb href `/marketing` → `/campaigns` (label "การตลาด" คงเดิม)
- [x] 3.4 `src/pages/ContentPlannerPage.tsx:381` — breadcrumb href `/marketing` → `/campaigns` (label "การตลาด" คงเดิม)
- [x] 3.5 `src/pages/ContentDashboardPage.tsx:193` — breadcrumb href `/marketing` → `/campaigns` (label "การตลาด" คงเดิม)

## 4. อัปเดต e2e test

- [x] 4.1 `e2e/login-test.spec.ts` — แก้ test title บรรทัด 87 `'3. Navigate to Marketing page'` → `'3. Navigate to Campaigns page'`
- [x] 4.2 แก้ `console.log`/comment ที่เหลือในบรรทัด 88, 98 จาก "Marketing" เป็น "Campaigns"
- [x] 4.3 แก้ `page.goto(\`${BASE_URL}/#/marketing\`)` ทั้ง 2 จุด (บรรทัด 91, 110) → `\`${BASE_URL}/#/campaigns\``
- [x] 4.4 แก้ comment บรรทัด 109 "Navigate to marketing page" → "Navigate to campaigns page"

## 5. ตรวจสอบ

- [x] 5.1 รัน `pnpm lint` — ต้องไม่มี error ใหม่เพิ่มขึ้น
- [x] 5.2 รัน `pnpm build` — ต้องผ่าน
- [x] 5.3 รัน `pnpm test` — ต้องผ่าน
- [x] 5.4 เปิดแอปจริง เข้า `/#/campaigns` โดยตรง — ยืนยันแสดงหน้าจัดการแคมเปญอีเมล ไม่มีการ redirect URL
- [x] 5.5 เข้า `/#/marketing` โดยตรง — ยืนยัน redirect ไป `/#/campaigns` อัตโนมัติ และหน้าแสดงผลถูกต้อง
- [x] 5.6 คลิกเมนู "แคมเปญอีเมล" ใน sidebar — ยืนยันไปที่ `/#/campaigns` โดยตรง
- [x] 5.7 คลิก breadcrumb "แคมเปญอีเมล" จากหน้า "วิเคราะห์แคมเปญ" — ยืนยันไปที่ `/#/campaigns`
- [x] 5.8 ทดสอบ Cmd+K พิมพ์ "แคมเปญ" — ยืนยันคลิกแล้วไป `/#/campaigns` โดยตรง (ไม่ผ่าน redirect อีกต่อไป)
