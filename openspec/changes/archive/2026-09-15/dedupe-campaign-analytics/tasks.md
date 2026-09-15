## 1. Backend: แก้ตัวกรองช่วงเวลาใน campaign-analytics.php

- [x] 1.1 ใน `api/campaign-analytics.php` แก้ query สรุปสถิติ จาก `WHERE ... AND created_at >= {$cutoff}` เป็น `AND sent_at >= {$cutoff}`
- [x] 1.2 ในไฟล์เดียวกัน แก้ query "5 แคมเปญยอดนิยม" จาก `WHERE ... AND created_at >= {$cutoff}` เป็น `AND sent_at >= {$cutoff}`
- [x] 1.3 ยืนยันว่า query กราฟแนวโน้ม (ที่ใช้ `et.sent_at >= {$cutoff}` อยู่แล้ว) และ query ตาราง "แคมเปญทั้งหมด" ที่ไม่กรองช่วงเวลา ไม่ถูกแก้ไข
- [x] 1.4 ทดสอบด้วยมือผ่าน `GET /api/campaign-analytics.php?range=30d` (ต้อง login) ว่าแคมเปญที่สร้างไว้เกิน 30 วัน แต่ส่งภายใน 30 วัน ปรากฏใน `summary` และ (ถ้าเข้าเกณฑ์) ใน `top_campaigns` — ยืนยันด้วย SQL ตรงกับข้อมูลจริงในเครื่อง (range 90d): query เดิมคืน 0 แคมเปญ, query ที่แก้แล้วคืน 1 แคมเปญถูกต้อง (campaign `43f2b633`)

## 2. Frontend: ตัดแท็บ "รายงาน" ที่ซ้ำซ้อนออกจาก MarketingPage.tsx

- [x] 2.1 grep หาการใช้งานตัวแปรแต่ละตัวใน `MarketingPage.tsx`: `sentCampaigns`, `totalSent`, `totalOpens`, `totalClicks`, `avgOpenRate`, `avgClickRate`, `bestCampaigns` — พบว่า `sentCampaigns`/`totalSent`/`totalOpens`/`totalClicks` ยังถูกใช้โดยการ์ดสรุปของแท็บ "แคมเปญ" ([:748-750](src/pages/MarketingPage.tsx:748)) ด้วย ไม่ใช่แค่แท็บ "รายงาน" — ส่วน `avgOpenRate`, `avgClickRate`, `bestCampaigns` ใช้เฉพาะในแท็บ "รายงาน" เท่านั้น
- [x] 2.2 ลบ `<TabsTrigger value="analytics">` ออกจาก TabsList
- [x] 2.3 ลบ `<TabsContent value="analytics">...</TabsContent>` ทั้งบล็อก (การ์ดสรุป, ตารางประสิทธิภาพแคมเปญ, ส่วนแคมเปญที่มีประสิทธิภาพดีที่สุด)
- [x] 2.4 ลบเฉพาะ `avgOpenRate`, `avgClickRate`, `bestCampaigns` (ใช้แค่ในแท็บที่ลบไป) — เก็บ `sentCampaigns`, `totalSent`, `totalOpens`, `totalClicks` ไว้ตามผลเช็คในข้อ 2.1 เพราะการ์ดสรุปแท็บ "แคมเปญ" ยังใช้อยู่ พร้อมลบ import ไอคอนที่ไม่ได้ใช้แล้ว (`BarChart3`, `TrendingUp`, `TrendingDown`)
- [x] 2.5 `sm:grid-cols-6` เดิม hardcode ตามจำนวนแท็บ (6 แท็บ) — แก้เป็น `sm:grid-cols-5` ให้ตรงกับจำนวนแท็บที่เหลือ

## 3. Frontend: แก้ breadcrumb ที่ค้างอยู่บน CampaignAnalyticsPage.tsx

- [x] 3.1 ใน `src/pages/CampaignAnalyticsPage.tsx` แก้ breadcrumb entry จาก `{ label: 'การตลาด', href: '/marketing' }` เป็น `{ label: 'แคมเปญอีเมล', href: '/marketing' }`

## 4. ตรวจสอบ

- [x] 4.1 รัน `pnpm lint` — ต้องไม่มี error ใหม่เพิ่มขึ้น — ผ่าน (0 error, 47 warning เดิมทั้งหมด ไม่เกี่ยวกับไฟล์ที่แก้)
- [x] 4.2 รัน `pnpm build` — ต้องผ่าน — ผ่าน (build สำเร็จใน ~16s)
- [x] 4.3 เปิด `/marketing` ด้วยมือ — ยืนยันว่ารายการแท็บไม่มี "รายงาน" อีกแล้ว, แท็บที่เหลือ (แคมเปญ, Templates, กลุ่มลูกค้า, ลูกค้า, Attribution) ยังทำงานปกติ และการ์ดสรุปในแท็บ "แคมเปญ" ยังแสดงผลถูกต้อง — ยืนยันผ่าน browser จริง: เหลือ 5 แท็บ, การ์ดสรุป (9 แคมเปญ/ส่ง 13/เปิด 5/คลิก 1) และแท็บ Attribution ทำงานปกติ
- [x] 4.4 เปิด `/campaign-analytics` ด้วยมือ — ยืนยันว่าตัวเลขสรุป/แคมเปญยอดนิยมเปลี่ยนแปลงถูกต้องเมื่อมีแคมเปญที่ "ส่งช้า/สร้างไว้ก่อนหน้านาน" อยู่ในข้อมูล — ยืนยันผ่าน browser จริง: สลับเป็น "90 วันล่าสุด" แล้วแคมเปญ "Duckkit AI Portal" (created 10 พ.ค., sent 26 มิ.ย.) ปรากฏขึ้นทันที (แคมเปญทั้งหมด 1, ส่งทั้งหมด 1, อัตราเปิด 100%, ขึ้นกราฟแนวโน้มและ 5 แคมเปญยอดนิยม) ตรงกับที่คาดไว้หลังแก้บั๊ก
  - ⚠️ **พบเพิ่มระหว่างตรวจ (นอก scope งานนี้):** ตรวจ breadcrumb label ไม่ได้ทางหน้าจอ เพราะพบว่า `PageShell.tsx` รับ prop `breadcrumbs` มาแต่ไม่เคย render เลย (destructure เป็น `_breadcrumbs` แล้วทิ้ง — `PageBreadcrumb.tsx` ที่ทำหน้าที่ render จริงมีอยู่แต่ไม่ถูกเรียกใช้จากที่ไหนเลยในทั้งโปรเจกต์) เป็น dead code ที่กระทบทุกหน้าที่ใช้ `PageShell` ไม่ใช่แค่หน้านี้ — การแก้ label ในข้อ 3.1 ถูกต้องที่ระดับซอร์สโค้ด (ข้อมูลพร้อมใช้ถ้า wiring ถูกเปิดในอนาคต) แต่ยังไม่มีผลให้เห็นบนหน้าจอจริงจนกว่าจะมีคนแก้ `PageShell.tsx` ให้ render breadcrumb จริง — ไม่ได้แก้ในงานนี้เพราะอยู่นอก scope (กระทบทั้งแอป ไม่ใช่แค่ 2 หน้านี้)
