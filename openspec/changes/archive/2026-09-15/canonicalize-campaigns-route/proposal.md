## Why

หน้าจัดการแคมเปญอีเมล (component `MarketingPage.tsx`) ปัจจุบันอยู่ที่ route `/marketing` ซึ่งเป็นชื่อเก่าจากก่อนรอบเปลี่ยนชื่อหน้าเป็น "แคมเปญอีเมล" ทำให้ URL ไม่ตรงกับตัวตนจริงของหน้า และไปชนความหมายกับ "การตลาด" ซึ่งเป็นชื่อกลุ่มเมนูข้างที่ครอบคลุมหลายหน้า (คอนเทนต์, แคมเปญ, วิเคราะห์) ไม่ใช่หน้านี้หน้าเดียว ขณะที่ทั้งฝั่ง backend endpoint (`email-campaigns.php`, `campaign-analytics.php`) และหน้า UI ที่เกี่ยวข้อง (`CampaignAnalyticsPage.tsx`, `CampaignsPage.tsx` ซึ่งเป็น dead code) ต่างใช้คำว่า "campaign" กันหมดแล้ว มีเพียง route/ไฟล์นี้ที่ยังค้างชื่อ "marketing" — ทำให้ URL `/campaigns` ที่ควรจะเป็นปลายทางจริง กลับเป็นแค่ redirect ไป `/marketing`

## What Changes

- สลับ canonical route: `/campaigns` กลายเป็นปลายทางจริง (primary), `/marketing` กลายเป็น redirect ไป `/campaigns` แทน (สลับทิศจากเดิม) — ผู้ใช้ที่เคย bookmark `/marketing` ยังใช้งานได้ปกติผ่าน redirect
- Rename ไฟล์ `src/pages/MarketingPage.tsx` → `src/pages/CampaignsPage.tsx` พร้อมเปลี่ยนชื่อ component function ตาม (ทับไฟล์ `CampaignsPage.tsx` เดิมที่เป็น dead code อยู่แล้ว — ตรวจยืนยันแล้วว่าไม่มีฟีเจอร์ตกหล่นจากไฟล์เดิม)
- อัปเดต href ที่ชี้ไปหน้านี้ในทุกจุดที่ยังอ้างอิง `/marketing` ให้ชี้ไป `/campaigns` แทน (sidebar, breadcrumb ของหน้าที่เกี่ยวข้อง)
- อัปเดต spec `sidebar-nested-menu` (requirement "Marketing menu flattened") ให้ URL ที่ระบุไว้ตรงกับ route ใหม่
- อัปเดต e2e smoke test (`e2e/login-test.spec.ts`) ที่ hardcode `/#/marketing` ให้ตรงกับ route ใหม่ พร้อมแก้ชื่อ test/comment ที่ล้าสมัย
- **ไม่รวม**: backend endpoint `api/marketing-attribution.php`, `AttributionTab.tsx`, `marketingKeys`/`useMarketing.ts` — ตรวจสอบแล้วว่าชื่อ "marketing" ในจุดเหล่านี้ถูกต้องอยู่แล้ว (ครอบคลุมกว้างกว่าแค่แคมเปญอีเมล เช่น attribution ข้าม lead source ทุกประเภท, groups/settings/customerStats) การ rename จะทำให้ชื่อผิดความหมายมากขึ้นไม่ใช่ดีขึ้น
- **ไม่รวม**: เอกสารทั่วไป (`docs/features.md`, `docs/PRD.md`, `README.md`, `database/README.md`) ที่ยังพูดถึง `/marketing` — ไม่กระทบการทำงาน ปล่อยไว้พิจารณาแยกภายหลัง

## Capabilities

### New Capabilities
- `campaigns-page-canonical-route`: หน้าจัดการแคมเปญอีเมลต้องมี `/campaigns` เป็น canonical route พร้อม `/marketing` เป็น legacy redirect สำหรับ backward compatibility

### Modified Capabilities
- `sidebar-nested-menu`: requirement "Marketing menu flattened" ต้องระบุ URL ของรายการ "แคมเปญอีเมล" เป็น `/campaigns` แทน `/marketing`

## Impact

- `src/pages/MarketingPage.tsx` → rename เป็น `src/pages/CampaignsPage.tsx` (เนื้อหาไม่เปลี่ยน แค่ชื่อไฟล์/component)
- `src/App.tsx` — import path, สลับทิศ `<Route>` ระหว่าง `/campaigns` และ `/marketing`
- `src/components/AppSidebar.tsx`, `src/pages/CampaignAnalyticsPage.tsx`, `src/pages/ContentPage.tsx`, `src/pages/ContentPlannerPage.tsx`, `src/pages/ContentDashboardPage.tsx` — แก้ href จาก `/marketing` เป็น `/campaigns`
- `openspec/specs/sidebar-nested-menu/spec.md` — แก้ URL ในเนื้อหา requirement
- `e2e/login-test.spec.ts` — แก้ URL และชื่อ test/comment ที่ล้าสมัย
- ไม่กระทบ backend, database, หรือ permission/menuKey (`marketing` ยังคงเป็น menuKey เดิม เพราะเป็นคนละ concern จาก URL)
