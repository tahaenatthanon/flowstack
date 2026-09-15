## Why

แท็บ "แอตทริบิวชัน" ในหน้าแคมเปญอีเมลพัง ("เกิดข้อผิดพลาดใน Page") ทันทีที่ผู้ใช้เลือกช่วงเวลา "30 วัน" — สาเหตุคือไม่มี `sales_opportunities` ที่สร้างในช่วง 30 วันล่าสุดเลย (ข้อมูลล่าสุดในระบบสร้างเมื่อกรกฎาคม 2026) ทำให้ SQL `SUM(...)` บนเซ็ตว่างคืนค่า `NULL` (ไม่ใช่ 0 ตามพฤติกรรมมาตรฐานของ SQL) แล้ว frontend เรียก `.toLocaleString()` บนค่า `null` ตรงๆ โดยไม่มีการป้องกัน ทำให้ทั้ง component ล่มและถูก ErrorBoundary ดักจับ — endpoint พี่น้อง (`campaign-analytics.php`) มี pattern ป้องกันเรื่องนี้อยู่แล้ว (cast ด้วย `(int)`/`(float)` ก่อนส่ง JSON) แต่ `marketing-attribution.php` หลุด pattern นี้ไป

## What Changes

- **Backend:** `api/marketing-attribution.php` — cast ค่าทั้งหมดใน `summary` (`total_leads`, `total_won`, `total_lost`, `total_won_value`, `source_count`) ด้วย `(int)`/`(float)` ก่อนส่ง `jsonResponse()` ตาม pattern เดียวกับ `campaign-analytics.php` — ทำให้ `SUM()` ที่คืน `NULL` จาก SQL กลายเป็น `0` เสมอ ไม่มีทาง `null` หลุดออกไปถึง frontend
- **Frontend:** `src/components/marketing/AttributionTab.tsx:265` — เปลี่ยน `s.total_won.toLocaleString()` เป็น `(s.total_won ?? 0).toLocaleString()` เป็นการป้องกันชั้นที่สอง (defense in depth) เผื่อ field อื่นในอนาคตที่ยังไม่เจอมีปัญหาเดียวกัน
- ไม่เปลี่ยนโครงสร้าง response, ไม่เปลี่ยน UI/label ใดๆ — เป็นการแก้บั๊กล้วนๆ ให้หน้าไม่ล่มเมื่อไม่มีข้อมูลในช่วงเวลาที่เลือก (ควรแสดง 0/— ตามปกติเหมือนตอนเลือกช่วงที่มีข้อมูลน้อย ไม่ใช่ error boundary)

## Capabilities

### New Capabilities
- `marketing-attribution-summary-null-safety`: กำหนดว่าการ์ดสรุป KPI ในแท็บ Attribution ต้องแสดงผลได้ปกติ (ไม่ crash) แม้ช่วงเวลาที่เลือกไม่มีข้อมูลเลย โดยค่าที่ไม่มีข้อมูลต้องแสดงเป็น 0 ไม่ใช่ error

### Modified Capabilities
(ไม่มี — ไม่กระทบ requirement การแปลภาษาที่มีอยู่แล้วใน `marketing-attribution-report-localization`)

## Impact

- **Backend:** `api/marketing-attribution.php` เฉพาะส่วนสร้าง `jsonResponse()` ท้ายไฟล์ — cast ชนิดข้อมูล ไม่เปลี่ยน query logic ใดๆ
- **Frontend:** `src/components/marketing/AttributionTab.tsx` บรรทัดเดียว (KPI card "ดีลที่ชนะ")
- **ไม่มีการเปลี่ยนแปลง database schema**
- **ไม่กระทบ endpoint อื่น** — `campaign-analytics.php` มี pattern นี้อยู่แล้ว ไม่ต้องแก้; endpoint อื่นที่อาจมีความเสี่ยงแบบเดียวกัน (ถ้ามี) ไม่อยู่ใน scope ของงานนี้ ต้องสำรวจแยกต่างหาก
