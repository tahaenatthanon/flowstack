## Context

- `src/pages/ContentDashboardPage.tsx` (route `/content-dashboard`) มีแท็บ ภาพรวม/วิเคราะห์ ผูก URL ด้วย `tab` และ sub-tab ของแท็บวิเคราะห์ผูกด้วย `view` (`social`/`website`/`content`) ทั้งหน้าแสดง "กำลังโหลด..." จนกว่ารายการคอนเทนต์จะโหลดเสร็จ (`isLoading`)
- `src/pages/CampaignAnalyticsPage.tsx` (route `/campaign-analytics`, 324 บรรทัด) ครอบด้วย `PageShell` มี breadcrumb "แคมเปญอีเมล › วิเคราะห์แคมเปญ" มีตัวกรอง `range` (30d/90d/12m) และ `topSort` เป็น state ภายใน เรียก `api/campaign-analytics.php` และมีจุด return ก่อน 2 จุด (โหลด/error) ที่ครอบ `PageShell` ของตัวเอง
- จุดที่อ้างถึงหน้าเดิม: `App.tsx` (route), `AppSidebar.tsx` (เมนู), `GlobalSearch.tsx` (`NAV_ITEMS`) และ spec 4 ตัว
- หน้า `/campaigns` มีปุ่มหลัก 3 ปุ่มในช่อง `actions` ของ `PageShell` อยู่แล้ว
- มี `src/components/ui/toggle-group.tsx` (shadcn) ให้ใช้ทำปุ่มสลับ

## Goals / Non-Goals

**Goals:**
- ผู้ใช้ดูผลคอนเทนต์และผลแคมเปญอีเมลได้จากหน้าเดียว โดยพฤติกรรมของแต่ละส่วนเหมือนเดิม
- ลิงก์เก่าทุกแบบ (`/campaign-analytics`, `?tab=`, `?view=`) ยังใช้ได้

**Non-Goals:**
- ไม่เปลี่ยนตัวเลข, API หรือ database
- ไม่ทำหน้าสรุปผู้บริหาร / เป้าหมายรายเดือน / ROI (เป็น change ถัดไป)
- ไม่ใช้ตัวกรองวันที่ร่วมกันระหว่างส่วนคอนเทนต์กับแคมเปญ (แต่ละส่วนมีตัวกรองของตัวเองตามเดิม)
- ไม่เปลี่ยน route `/content-dashboard` หรือชื่อไฟล์/ชื่อ component

## Decisions

### D1: พารามิเตอร์ URL ชื่อ `section` ไม่ใช่ `view`
`view` ถูกใช้เป็น sub-tab ของแท็บวิเคราะห์อยู่แล้ว ถ้าใช้ซ้ำจะชนกัน เลือก `section=campaign` และให้ "ไม่มีพารามิเตอร์" = ส่วนคอนเทนต์
- ผลดี: handler เดิม `handleTabChange` / `handleViewChange` ที่เขียน `setSearchParams({...})` ทับทั้งชุดไม่ต้องแก้ เพราะทำงานเฉพาะในส่วนคอนเทนต์ซึ่งไม่มี `section` อยู่แล้ว
- การสลับไปแคมเปญ = `setSearchParams({ section: 'campaign' })` สลับกลับ = `setSearchParams({})` (กลับแท็บภาพรวม ตาม spec)

### D2: ปุ่มสลับอยู่ในช่อง `actions` ของ `PageShell` ใช้ `ToggleGroup`
ทางเลือกที่ไม่เลือก: เพิ่มแถวแท็บที่ 3 เหนือแท็บภาพรวม/วิเคราะห์ จะได้แท็บซ้อน 3 ชั้นที่หน้าตาคล้ายกัน ผู้ใช้แยกไม่ออกว่าชั้นไหนสลับอะไร
การใส่ในหัวหน้าทำให้ "สลับทั้งหน้า" ต่างจาก "สลับเนื้อหาในหน้า" โดยตำแหน่ง ส่วนในหน้ายังมีแท็บ 2 ชั้นเท่าเดิม ปุ่มสลับแสดงชื่อเต็ม ("คอนเทนต์"/"แคมเปญ") ทุกขนาดจอ ไม่ซ่อน label แบบแท็บเดิม

### D3: ย้ายจุดรอโหลดไปอยู่ในส่วนคอนเทนต์
`PageShell` และปุ่มสลับ render เสมอ ส่วน `isLoading ? 'กำลังโหลด...' : <Tabs>` ย้ายไปอยู่ใต้เงื่อนไข "ส่วนคอนเทนต์" เท่านั้น ส่วนแคมเปญมีสถานะโหลด/error ของตัวเองจาก query ของมัน

### D4: แยก `CampaignAnalyticsTab` แล้วลบหน้าเดิม
ย้ายเนื้อหาของ `CampaignAnalyticsPage` ไปไฟล์ใหม่ `src/components/content/CampaignAnalyticsTab.tsx`:
- เอา `PageShell` / breadcrumb / หัวข้อออก
- จุด return ก่อน (โหลด/error) เปลี่ยนเป็นการแสดงภายใน component
- ตัวกรอง `range` และ `topSort` คงเป็น state ภายในเหมือนเดิม (วางตัวกรองไว้บนสุดของ component)
- `queryKey` `['campaign-analytics', range, topSort]` คงเดิม และ component ถูก mount เฉพาะเมื่ออยู่ส่วนแคมเปญ จึงไม่เรียก API ตอนอยู่ส่วนคอนเทนต์
ทางเลือกที่ไม่เลือก: เก็บหน้าเดิมไว้คู่กัน → โค้ดซ้ำ 2 ที่ แก้ที่หนึ่งแล้วอีกที่ไม่ตาม ประวัติไฟล์เดิมยังอยู่ใน git จึงย้อนกลับได้

### D5: `/campaign-analytics` เป็น `<Navigate replace>` ภายใต้ `PermissionRoute menuKey="marketing"`
ใช้รูปแบบเดียวกับ `/marketing` → `/campaigns` ที่มีอยู่แล้ว (`replace` เพื่อไม่ให้ปุ่มย้อนกลับวนมา redirect ซ้ำ) แอปใช้ HashRouter ปลายทางจึงเป็น `#/content-dashboard?section=campaign`

### D6: ชื่อที่แสดงเปลี่ยน ชื่อโค้ดคงเดิม
เปลี่ยนเฉพาะข้อความที่ผู้ใช้เห็น (เมนู, หัวข้อ, breadcrumb, `ContentGoalForm`, GlobalSearch) route และชื่อไฟล์/ component คงเดิม เพื่อไม่กระทบ import และ spec อื่นอีก ~10 ตัวที่ใช้คำว่า "แดชบอร์ดคอนเทนต์" แค่เรียกชื่อหน้า
breadcrumb ใหม่ = "การตลาด" (ลิงก์ `/campaigns`) › "แดชบอร์ด" (ตัด "คอนเทนต์โซเชียล" ออกเพราะหน้านี้ไม่ได้อยู่ใต้คอนเทนต์โซเชียลแล้ว)

### D7: ลิงก์ "ดูผลแคมเปญ" ในหน้า `/campaigns` วางข้างหัวข้อ ไม่อยู่ในแถวปุ่มหลัก
แถว `actions` มีปุ่มหลัก 3 ปุ่มแล้ว ปุ่มที่ 4 จะล้นบนมือถือและแย่งความเด่นของ "สร้างแคมเปญ" ใช้ `Button variant="ghost" size="sm"` + ไอคอน `BarChart3` เป็น `Link` ไปส่วนแคมเปญ วางในพื้นที่ที่ `PageShell` รองรับโดยไม่แก้ `PageShell` (เช่น ต่อท้ายคำอธิบาย หรือแถบเหนือเนื้อหาแท็บแคมเปญ)

**ตำแหน่งที่เลือกตอน implement** (ดูหน้าจริงทั้งจอใหญ่และมือถือแล้ว): แถวชิดขวาเหนือการ์ดสรุป all-time 4 ใบในแท็บ "แคมเปญ" ของหน้า `/campaigns` — ต่อจากตัวเลขสรุปเร็ว ๆ พอดี ไม่แตะแถวปุ่มหลักและไม่ต้องแก้ `PageShell` (บนมือถือปุ่มหลักเหลือแต่ไอคอน ลิงก์นี้ยังแสดงข้อความเต็ม)

## Risks / Trade-offs

- [ปุ่มสลับที่มุมขวาเด่นน้อยกว่าแถวแท็บ ผู้ใช้อาจไม่เห็นครั้งแรก] → มีทางเข้าส่วนแคมเปญตรง ๆ จาก GlobalSearch, ลิงก์ "ดูผลแคมเปญ" และ redirect ของ URL เดิม
- [ผู้ใช้ที่ bookmark `/campaign-analytics`] → redirect ยังพาไปถูกที่
- [ตัวกรองวันที่ของ 2 ส่วนต่างกัน (ช่วงวันที่ vs 30/90/12)] → ตั้งใจคงไว้ตาม Non-Goals การรวมตัวกรองเป็นงานของ change สรุปผู้บริหาร
- [แท็บเดิมของหน้าแคมเปญเคยมีหัวข้อหน้าของตัวเอง] → คำอธิบายใต้หัวข้อเปลี่ยนตามส่วนแทน ผู้ใช้ยังรู้ว่าอยู่ส่วนไหน

## Migration Plan

ไม่มี migration ของ database deploy เป็น frontend อย่างเดียว rollback = revert commit (ไฟล์ `CampaignAnalyticsPage.tsx` กลับมาจาก git)

## Open Questions

- ~~ตำแหน่งสุดท้ายของลิงก์ "ดูผลแคมเปญ" (D7)~~ ปิดแล้ว — ดู D7
