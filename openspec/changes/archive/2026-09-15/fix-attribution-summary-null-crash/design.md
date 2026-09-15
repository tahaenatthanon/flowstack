## Context

รีโปรดิวซ์บั๊กสำเร็จผ่านเบราว์เซอร์จริงและ query API โดยตรง — เมื่อเลือกช่วงเวลา "30 วัน" (ไม่มี `sales_opportunities` ที่ `created_at` อยู่ในช่วงนี้เลย) `GET /api/marketing-attribution.php?period=30` ตอบกลับ:
```json
"summary": { "total_leads": 0, "total_won": null, "total_lost": null, "total_won_value": null, "source_count": 0 }
```
`COUNT(*)` บนเซ็ตว่างคืน `0` ตามปกติ แต่ `SUM(...)` บนเซ็ตว่างคืน `NULL` เสมอ — เป็นพฤติกรรมมาตรฐานของ SQL ไม่ใช่บั๊กของ query เอง ปัญหาที่แท้จริงคือ `$totals` ถูกส่งเข้า `jsonResponse()` ตรงๆ โดยไม่มีการ cast ชนิดข้อมูล ต่างจาก `api/campaign-analytics.php` (endpoint พี่น้องในโมดูลเดียวกัน ที่ถูกแก้ไขไปในงานก่อนหน้านี้ของ session นี้เอง) ซึ่ง cast ทุก field ด้วย `(int)`/`(float)` ก่อนส่งเสมอ — `marketing-attribution.php` เป็น endpoint เดียวในกลุ่มนี้ที่หลุด pattern ป้องกันนี้ไป

ฝั่ง frontend, `AttributionTab.tsx:265` เรียก `s.total_won.toLocaleString()` ตรงๆ โดยไม่มี fallback เมื่อ `total_won` เป็น `null` จึง throw `TypeError: Cannot read properties of null (reading 'toLocaleString')` ซึ่งทั้ง component (`{data && s && (...)}` block) crash และถูก `ErrorBoundary` ดักจับ แสดงข้อความ "เกิดข้อผิดพลาดใน Page" — บรรทัดข้างเคียง (`thb(s.total_won_value)`) ไม่ crash เพราะ `thb()` มี `Number(v)` ห่ออยู่ข้างใน (`Number(null) === 0`)

## Goals / Non-Goals

**Goals:**
- แท็บ Attribution แสดงผลได้ปกติ (ไม่ crash) เมื่อเลือกช่วงเวลาที่ไม่มีข้อมูลเลย — การ์ด KPI แสดง "0" แทนที่จะ error
- แก้ที่ต้นตอ (backend) ให้ตรงกับ pattern ที่ใช้อยู่แล้วใน `campaign-analytics.php` เพื่อความสอดคล้องกันของโค้ดในโมดูลเดียวกัน
- เพิ่มการป้องกันชั้นที่สองฝั่ง frontend สำหรับจุดที่ crash จริง (ไม่ใช่การไล่แก้ทุกจุดที่เรียก field จาก summary)

**Non-Goals:**
- ไม่ไล่ตรวจ/แก้ endpoint อื่นทั้งระบบที่อาจมีความเสี่ยงคล้ายกัน (เช่น `content-analytics.php`, `benchmark.php`) — เป็นงานสำรวจแยกต่างหากตามที่คุยกันไว้ตอน explore
- ไม่เปลี่ยนพฤติกรรม query หรือช่วงเวลาที่รองรับ (`30d/90d/180d/365d`) — บั๊กนี้จะเกิดกับช่วงเวลาไหนก็ได้ถ้าไม่มีข้อมูลในช่วงนั้น ไม่ใช่เฉพาะ 30 วัน แก้ที่ต้นตอครอบคลุมทุกช่วงอัตโนมัติ
- ไม่เปลี่ยน UI/label ใดๆ ที่เพิ่งแก้ไปในงานก่อนหน้า (การแปลภาษาไทย, สูตรสัดส่วนรายได้)

## Decisions

**Decision 1 — แก้ backend เป็นหลัก ไม่ใช่แค่ frontend**
ทางเลือกที่พิจารณา: แก้แค่ frontend ด้วย `?? 0` ที่จุดเดียวที่ crash พบแล้ว — ตัดออกเพราะแก้ได้แค่จุดเดียวที่เจอ ในขณะที่ `total_lost` และ field อื่นในอนาคตที่อาจถูกนำไปใช้ก็จะพังแบบเดียวกันถ้าไม่มีการป้องกันที่ต้นตอ การ cast ที่ backend ให้ผลลัพธ์เป็น `0` เสมอสำหรับทุก field ในคราวเดียว ตรงกับที่ `campaign-analytics.php` ทำอยู่แล้ว — เลือกแก้ backend เป็นหลัก + frontend เป็นเกราะชั้นสอง

**Decision 2 — cast แบบ PHP (`(int)`/`(float)`) ไม่ใช้ `COALESCE` ใน SQL**
ทางเลือกที่พิจารณา: แก้ SQL เป็น `COALESCE(SUM(...), 0)` แทน — ทั้งสองทางให้ผลลัพธ์เหมือนกัน แต่เลือกใช้ PHP cast เพราะ (ก) ตรงกับ pattern ที่มีอยู่แล้วใน `campaign-analytics.php` ในโมดูลเดียวกันเป๊ะ ง่ายต่อการอ่าน/บำรุงรักษาสำหรับคนที่คุ้นกับ endpoint นี้อยู่แล้ว (ข) แก้ที่จุดเดียว (`jsonResponse()`) ครอบคลุมทุก field ในคราวเดียว ไม่ต้องแก้ SQL 3 จุดแยกกัน (`total_won`, `total_lost`, `total_won_value`)
```php
// เดิม
jsonResponse([
    'period'      => $period,
    'summary'     => $totals,
    ...
]);

// ใหม่
jsonResponse([
    'period'      => $period,
    'summary'     => [
        'total_leads'     => (int)($totals['total_leads'] ?? 0),
        'total_won'       => (int)($totals['total_won'] ?? 0),
        'total_lost'      => (int)($totals['total_lost'] ?? 0),
        'total_won_value' => (float)($totals['total_won_value'] ?? 0),
        'source_count'    => (int)($totals['source_count'] ?? 0),
    ],
    ...
]);
```
ใช้ `?? 0` คู่กับ `(int)`/`(float)` (ไม่ใช่ cast ตรงๆ) เพราะ `$totals` อาจเป็น `false` ทั้งก้อนถ้า `fetch()` ไม่เจอแถวเลย (แม้ในทางทฤษฎี aggregate query แบบไม่มี `GROUP BY` จะคืนแถวเดียวเสมอแม้ไม่มีข้อมูลตรงเงื่อนไขก็ตาม แต่ใส่ไว้เป็น defensive เพิ่มเติม)

**Decision 3 — frontend guard เฉพาะจุดที่ crash จริง ไม่ไล่แก้ทั้งไฟล์**
เพิ่ม `?? 0` ที่ `AttributionTab.tsx:265` (`s.total_won.toLocaleString()`) เท่านั้น — จุดอื่นที่ใช้ field จาก `summary` (`total_leads`, `total_won_value` ผ่าน `thb()`) ไม่ crash อยู่แล้วจากการตรวจสอบจริง ไม่จำเป็นต้องแก้เพิ่มเพราะจะเป็นการแก้ปัญหาที่ไม่มีอยู่จริง (เมื่อ backend cast แล้ว ทุก field จะไม่มีทางเป็น `null` อยู่ดี — frontend guard นี้เป็นแค่ safety net เผื่อ backend เปลี่ยนในอนาคตแล้วลืมคง cast ไว้)

## Risks / Trade-offs

- **[Risk] Regression ต่อ test ที่มีอยู่** → ตรวจแล้วไม่มี test ใน `src/__tests__/` อ้างอิง `AttributionTab`, `marketing-attribution`, หรือ mock response ของ endpoint นี้ จึงไม่คาดว่าจะพัง
- **[Risk] แก้แค่ endpoint นี้ ไม่ครอบคลุม endpoint อื่นที่อาจมีปัญหาเดียวกัน** → **Mitigation:** ระบุไว้ชัดเจนใน Non-Goals ว่าเป็นการสำรวจแยกต่างหาก ไม่ใช่ scope ของ change นี้ — ไม่ใช่การละเลย แต่เป็นการจำกัดขอบเขตให้ตรงกับบั๊กที่รายงานจริง
- **[Risk] การ cast `(float)` อาจเปลี่ยนรูปแบบทศนิยมที่ frontend ได้รับ** (เช่น จาก string "5100000.00" เป็น float 5100000.0) → **Mitigation:** ไม่กระทบ เพราะ frontend ใช้ `Number()`/`.toLocaleString()`/`thb()` ซึ่งรับได้ทั้ง string ตัวเลขและ float number เหมือนกัน (เคยยืนยันพฤติกรรมนี้แล้วตอนแก้บั๊ก `won_value` string ใน `SourceTable` ก่อนหน้านี้)

## Migration Plan

1. แก้ `api/marketing-attribution.php` ก่อน (backend, จุดเดียว) — ตรวจสอบด้วย `GET ?period=30` ตรงๆ ว่า `summary` ไม่มี `null` อีกต่อไป
2. แก้ `AttributionTab.tsx:265` (frontend guard)
3. ไม่ต้องใช้ feature flag — เป็นการแก้บั๊กในรีลีสเดียว ไม่มี DB migration ไม่มี breaking change ต่อ response shape (field ชื่อเดิม ประเภทข้อมูลเดิม แค่ไม่เป็น `null` อีกต่อไป)
4. Rollback: revert commit ที่เกี่ยวข้อง ไม่มีข้อมูลถูกทำลาย

## Open Questions

- ไม่มีคำถามค้างอยู่ — วิธีแก้ (Option C: backend + frontend) ตกลงกับผู้ร้องขอแล้วระหว่างช่วง explore ก่อนร่างเอกสารนี้
