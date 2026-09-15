## Context

หน้าจัดการแคมเปญอีเมล (component `MarketingPage.tsx`) อยู่ที่ route `/marketing` มาตั้งแต่ก่อนรอบที่แล้วที่เปลี่ยนชื่อหน้าเป็น "แคมเปญอีเมล" (breadcrumb, page title, sidebar label ถูกแก้ไปแล้ว) แต่ตัว URL/ไฟล์/component ยังไม่ถูกแตะ ทำให้เกิดความไม่สอดคล้องกัน: URL `/marketing` ไปพ้องกับชื่อกลุ่มเมนู "การตลาด" ที่ครอบคลุม 6 หน้า (คอนเทนต์แดชบอร์ด, คอนเทนต์โซเชียล, ปฏิทินคอนเทนต์, แคมเปญอีเมล, วิเคราะห์แคมเปญ, สตูดิโอสื่อ) ไม่ใช่หน้านี้หน้าเดียว ขณะที่ `/campaigns` ที่ควรจะเป็นชื่อที่ตรงกว่า กลับเป็นแค่ dead-code route ที่ redirect ไป `/marketing`

ระหว่างสำรวจ (`/opsx:explore`) ตรวจสอบ naming ทั่วทั้งระบบแล้วพบว่า "campaign" เป็นคำที่ใช้เยอะกว่า "marketing" อยู่แล้ว (`email-campaigns.php`, `campaign-analytics.php`, `content-to-campaign.php`, `CampaignAnalyticsPage.tsx`) มีเพียง route/ไฟล์นี้ที่ยังค้าง ส่วน `api/marketing-attribution.php` และ `marketingKeys` ใน `useMarketing.ts` ตรวจแล้วว่าใช้คำ "marketing" ถูกต้องอยู่แล้ว (ครอบคลุมกว้างกว่าแคมเปญเดียว: attribution ข้าม lead source ทุกประเภทรวม SEO/referral, groups/settings/customerStats) จึงไม่รวมอยู่ใน scope นี้

## Goals / Non-Goals

**Goals:**
- `/campaigns` เป็น canonical route จริงของหน้าจัดการแคมเปญอีเมล ไม่ใช่แค่ redirect
- `/marketing` ยังใช้งานได้ (redirect ไป `/campaigns`) เพื่อ backward compatibility กับ bookmark/ลิงก์เก่า
- ไฟล์/component name (`CampaignsPage.tsx`) ตรงกับ URL และ terminology ที่เหลือในระบบ
- ทุกจุดที่อ้างอิง URL นี้ (sidebar, breadcrumb, spec, e2e test) ต้องตรงกับ route ใหม่ ไม่มีจุดไหนหลุด

**Non-Goals:**
- ไม่แตะ backend endpoint `api/marketing-attribution.php`, component `AttributionTab.tsx`, หรือ `marketingKeys`/`useMarketing.ts` — ชื่อ "marketing" ในจุดเหล่านี้ถูกต้องตามขอบเขตจริงแล้ว (ครอบคลุมกว้างกว่าแคมเปญอีเมลอย่างเดียว)
- ไม่แก้ label "การตลาด" ในกลุ่มเมนู sidebar หรือ breadcrumb ของ `ContentPage.tsx`/`ContentPlannerPage.tsx`/`ContentDashboardPage.tsx` (เป็นชื่อกลุ่มที่ถูกต้องอยู่แล้ว ครอบคลุมหลายหน้า) — แก้แค่ href ให้ชี้ไป URL ใหม่
- ไม่แก้เอกสารทั่วไป (`docs/features.md`, `docs/PRD.md`, `README.md`, `database/README.md`) ที่ยังพูดถึง `/marketing`
- ไม่แก้ menuKey (`'marketing'` ใน `AppSidebar.tsx`/`api/auth.php`) — เป็นคนละ concern จาก URL ตาม `CLAUDE.md`

## Decisions

**Decision 1 — สลับทิศ redirect แทนที่จะลบ `/marketing` ทิ้ง**

ทางเลือกที่พิจารณา: ลบ route `/marketing` ออกไปเลย ไม่เก็บ redirect — ตัดออก เพราะจะทำให้ลิงก์/bookmark เก่าที่ผู้ใช้เคยบันทึกไว้พัง ไม่มีเหตุผลที่ต้องยอมรับความเสี่ยงนี้เมื่อ redirect 1 บรรทัดแก้ปัญหาได้เลย (เหมือนที่ `/campaigns` เคย redirect ไป `/marketing` มาก่อน ตอนนี้แค่สลับทิศ)

```tsx
// เดิม (App.tsx)
<Route path="/marketing" element={<PermissionRoute menuKey="marketing"><MarketingPage /></PermissionRoute>} />
...
<Route path="/campaigns" element={<Navigate to="/marketing" replace />} />

// ใหม่
<Route path="/campaigns" element={<PermissionRoute menuKey="marketing"><CampaignsPage /></PermissionRoute>} />
...
<Route path="/marketing" element={<Navigate to="/campaigns" replace />} />
```

**Decision 2 — Rename ไฟล์/component แทนที่จะสร้างไฟล์ใหม่แล้ว re-export**

ทางเลือกที่พิจารณา: สร้าง `CampaignsPage.tsx` เป็น thin wrapper ที่ import และ re-export `MarketingPage.tsx` เดิม — ตัดออก เพราะจะเหลือชื่อไฟล์ `MarketingPage.tsx` ค้างอยู่ในระบบ ไม่แก้ปัญหาความไม่สอดคล้องของชื่อที่เป็นต้นเหตุของ change นี้ตั้งแต่แรก เลือก rename ไฟล์จริงแทน (mv + เปลี่ยนชื่อ `export default function MarketingPage()` → `CampaignsPage()`) เนื้อหาภายในไฟล์ไม่ต้องแก้อะไรเพิ่มนอกจากชื่อ function

ยืนยันแล้วว่าไม่มี test อ้างอิงชื่อ `MarketingPage`/`CampaignsPage` โดยตรง (grep `src/__tests__` ไม่เจอ) จึงไม่มี test ต้องแก้จากการ rename นี้

**Decision 3 — อัปเดต href แบบ literal string ไม่ใช้ constant กลาง**

ทางเลือกที่พิจารณา: สร้าง constant กลาง (เช่น `ROUTES.CAMPAIGNS`) แล้วให้ทุกไฟล์ import มาใช้ — ตัดออก เพราะ codebase ปัจจุบันไม่มี pattern นี้อยู่แล้ว (ทุก route เป็น literal string กระจายอยู่ใน `AppSidebar.tsx`/breadcrumb ต่างๆ) การเริ่ม pattern ใหม่ตอนนี้เป็น refactor ที่ใหญ่กว่าที่ change นี้ต้องการ (SCOPE DRIFT) ทำตาม pattern เดิมคือแก้ literal string ตรงๆ ในแต่ละไฟล์

**Decision 4 — sidebar-nested-menu spec ต้องมี MODIFIED requirement**

`openspec/specs/sidebar-nested-menu/spec.md` requirement "Marketing menu flattened" hardcode `/marketing` ไว้ในเนื้อหา (บรรทัดแสดงลำดับเมนู) เป็น live spec ที่ยังมีผลบังคับใช้อยู่ ไม่ใช่แค่ archived — ต้องคัดลอก requirement block เต็มมาแก้ URL จุดเดียว ไม่แก้ scenario อื่นเพราะเนื้อหาเรื่องลำดับ/โครงสร้างเมนูไม่เปลี่ยน

**Decision 5 — อัปเดต e2e test ให้ตรงกับ route ใหม่ (ตามที่ผู้ร้องขอ)**

`e2e/login-test.spec.ts` มี `page.goto('#/marketing')` 2 จุด และชื่อ test/comment ที่อ้างถึง "Marketing page" — แก้ URL และข้อความเป็น "Campaigns" ให้ตรงกับ route ใหม่ ไม่แก้ logic การเช็คเนื้อหา (บรรทัดที่เช็ค `hasMarketingContent`/`hasEmailRelatedContent`) เพราะเป็นคนละเรื่อง (ทดสอบว่าเนื้อหาอีเมล/แคมเปญโหลดมา ไม่ใช่ทดสอบ URL) และไฟล์นี้ไม่ได้รันใน `pnpm test` (vitest) อยู่แล้ว เป็นแค่ `pnpm test:e2e` (playwright) แยกต่างหาก — การแก้นี้เป็น cosmetic cleanup ไม่ใช่การแก้ CI gate

## Risks / Trade-offs

- **[Risk] มี navigate('/marketing') 3 จุดในไฟล์ dead code `CampaignsPage.tsx` เดิม** → **Mitigation:** ไฟล์นี้จะถูกทับทั้งไฟล์ด้วยเนื้อหาจาก `MarketingPage.tsx` ที่ rename มา ไม่มี navigate('/marketing') เหลืออยู่ในไฟล์ที่ import (ยืนยันแล้วว่า `MarketingPage.tsx` ไม่มี self-navigate ไปที่ `/marketing` เลย)
- **[Risk] Breadcrumb label "การตลาด" ใน ContentPage.tsx/ContentPlannerPage.tsx/ContentDashboardPage.tsx ยังคงความหมายไม่ตรงกับปลายทางเฉพาะเจาะจง (เป็นปัญหาที่มีอยู่ก่อนแล้ว ไม่ได้เกิดจาก change นี้)** → **Mitigation:** ไม่อยู่ใน scope นี้ ยอมรับว่ายังไม่แก้ ตัว href จะยังคงถูกต้อง (ไปหน้าที่ถูกต้อง) แค่ label ยังเป็นชื่อกลุ่มไม่ใช่ชื่อหน้าเฉพาะ ไม่ต่างจากพฤติกรรมปัจจุบัน
- **[Risk] เอกสารทั่วไป (README, docs/features.md, docs/PRD.md) จะพูดถึง `/marketing` แบบล้าสมัยหลัง change นี้** → **Mitigation:** ยอมรับความเสี่ยงนี้ เป็นเอกสารอ้างอิงไม่กระทบการทำงานจริง พิจารณาแก้แยกในอนาคตถ้าต้องการ
- **[Risk] SQL backup files (`flowstack_backup.sql` ฯลฯ) มีคำว่า `/marketing` อยู่ในข้อมูล** → **Mitigation:** เป็น historical snapshot ที่ freeze ไว้แล้ว ไม่เกี่ยวข้องกับโค้ดที่รันจริง ไม่ต้องแก้

## Migration Plan

1. Rename `src/pages/MarketingPage.tsx` → `src/pages/CampaignsPage.tsx` (เปลี่ยนชื่อ component function)
2. แก้ `src/App.tsx` (import path + สลับ `<Route>`)
3. แก้ href ใน `AppSidebar.tsx`, `CampaignAnalyticsPage.tsx`, `ContentPage.tsx`, `ContentPlannerPage.tsx`, `ContentDashboardPage.tsx`
4. แก้ `e2e/login-test.spec.ts`
5. Sync spec `sidebar-nested-menu` (MODIFIED requirement) ตอน archive
6. ไม่มี DB migration, ไม่มี feature flag
7. Rollback: revert commit ที่เกี่ยวข้อง ไม่มีข้อมูลถูกทำลาย (route `/marketing` ยังคงใช้งานได้ตลอดผ่าน redirect ไม่ว่าจะ rollback หรือไม่)

## Open Questions

- ไม่มีคำถามค้างอยู่ — ขอบเขตตกลงกันครบแล้วระหว่าง explore mode (ไม่รวม backend, ไม่รวม docs ทั่วไป, รวม e2e test)
