## 1. Backend — cast summary fields ให้ไม่มีทางเป็น null

- [x] 1.1 ใน `api/marketing-attribution.php` แก้ `jsonResponse()` ท้ายไฟล์ ให้ `summary` เป็น object ที่ cast ทุก field: `total_leads`/`total_won`/`total_lost`/`source_count` ด้วย `(int)($totals['...'] ?? 0)`, `total_won_value` ด้วย `(float)($totals['...'] ?? 0)`
- [x] 1.2 ยืนยันว่าไม่แตะ query (`$totStmt`), `by_source`, `by_campaign`, `trend` — เปลี่ยนแค่ตอนประกอบ `summary` ก่อนส่ง response

## 2. Frontend — เพิ่ม guard ที่จุด crash

- [x] 2.1 ใน `src/components/marketing/AttributionTab.tsx:265` เปลี่ยน `s.total_won.toLocaleString()` เป็น `(s.total_won ?? 0).toLocaleString()`

## 3. ตรวจสอบ

- [x] 3.1 รัน `pnpm lint` — ผ่าน (0 error, 47 warning เดิมทั้งหมด ไม่เกี่ยวกับไฟล์ที่แก้)
- [x] 3.2 รัน `pnpm build` — ผ่าน + เช็ค `php -l` เพิ่มเติมกับ `marketing-attribution.php` (ไม่อยู่ใน pnpm build) — ไม่มี syntax error
- [x] 3.3 รัน `pnpm test` — ผ่านทั้งหมด (38 test files, 254 tests passed)
- [x] 3.4 เรียก `GET /api/marketing-attribution.php?period=30` ตรงๆ ผ่าน fetch ใน browser console — ยืนยันแล้ว: `summary` = `{"total_leads":0,"total_won":0,"total_lost":0,"total_won_value":0,"source_count":0}` ไม่มี `null` เหลือเลย
- [x] 3.5 เปิดแท็บ "แอตทริบิวชัน" ผ่านเมนูจริง เลือก "30 วัน" — ยืนยันแล้ว: ไม่ขึ้น "เกิดข้อผิดพลาดใน Page" อีกต่อไป การ์ด KPI แสดง "ลีดทั้งหมด 0", "ดีลที่ชนะ 0", "อัตราชนะ —", "รายได้ (ชนะ) ฿0" ตามปกติ ตารางแสดง "ไม่มีข้อมูล"/"ยังไม่มีแคมเปญที่ลิงก์กับดีล..." ถูกต้อง (หมายเหตุ: ต้อง full page reload ก่อนทดสอบ เพราะ ErrorBoundary ที่เคย trigger ค้างอยู่จาก session ก่อนหน้า ไม่ auto-recover เองแค่เพราะโค้ดเปลี่ยน)
- [x] 3.6 สลับกลับไป "1 ปี" — ยืนยันแล้ว: ตัวเลขถูกต้องตรงกับที่เคยตรวจไว้ทุกประการ (ลีดทั้งหมด 325, ดีลที่ชนะ 11, อัตราชนะ 3%, รายได้ ฿5,806,000, seo=87.8% ฯลฯ) ไม่ได้รับผลกระทบจากการ cast เป็น `(int)`/`(float)` เลย
