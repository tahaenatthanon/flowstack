## 1. เตรียมการและยืนยันขอบเขต

- [x] 1.1 ยืนยันขอบเขตบรรทัดปัจจุบันอีกครั้งก่อนแก้ (โครงสร้างไฟล์อาจเปลี่ยนถ้ามี commit อื่นแทรกระหว่างนี้) ด้วย `grep -n "^    if (\$action ===" api/content-publish.php` และ `grep -n "^if (\$action ===" api/brand-content.php`
- [x] 1.2 ยืนยันอีกครั้งว่าไม่มี caller เรียก `send_now-legacy`, `publish-legacy`, `cron-publish-legacy` (`grep -rn "send_now-legacy\|publish-legacy\|cron-publish-legacy" src/ api/`)

## 2. ลบ send_now-legacy ใน content-publish.php

- [x] 2.1 ลบทั้งช่วง `if ($action === 'send_now-legacy') { ... }` ยกเว้นบรรทัด `jsonError('Legacy send_now flow disabled — use the central publish flow', 410);` ที่คงไว้ (ปิด block ทันทีหลังบรรทัดนี้)
- [x] 2.2 รัน `php -l api/content-publish.php` ยืนยัน syntax ถูกต้อง

## 3. ลบ publish-legacy ใน brand-content.php

- [x] 3.1 ลบทั้งช่วง `if ($action === 'publish-legacy') { ... }` ยกเว้นบรรทัด `jsonError('Legacy publish flow disabled — use the central publish flow', 410);` ที่คงไว้
- [x] 3.2 รัน `php -l api/brand-content.php` ยืนยัน syntax ถูกต้อง

## 4. ลบ cron-publish-legacy ใน brand-content.php

- [x] 4.1 ลบทั้งช่วง `if ($action === 'cron-publish-legacy') { ... }` ยกเว้นบรรทัด `jsonError('Legacy scheduler flow disabled — use the central publish flow', 410);` ที่คงไว้
- [x] 4.2 รัน `php -l api/brand-content.php` อีกครั้งยืนยัน syntax ถูกต้อง (มี 2 การแก้ไขในไฟล์เดียวกัน)

## 5. ทดสอบ

- [x] 5.1 Smoke test ด้วย curl (พร้อม JWT จริงที่ mint ด้วย `generateToken()` ของระบบเอง): ยิง `send_now-legacy`, `publish-legacy`, `cron-publish-legacy` แล้วยืนยันยังได้ HTTP 410 พร้อมข้อความเดิมทุกตัวอักษร
- [x] 5.2 Smoke test action ข้างเคียงที่ยังทำงานจริง เพื่อยืนยัน dispatcher ไม่พัง: `cancel` (content-publish.php → 200 ok:true), `all-schedules` (brand-content.php → 200), `cron-publish` (brand-content.php → 200 processed:0) — ทั้งหมดทำงานปกติ
- [x] 5.3 รัน `pnpm lint` และ `pnpm build` (frontend ไม่ถูกกระทบ แต่ยืนยันไม่มี regression)

## 6. ปิดงาน

- [x] 6.1 ตรวจนับบรรทัดที่ลบได้จริง เทียบกับที่ประเมินไว้ — ลบได้จริง 723 บรรทัด (`content-publish.php` -179, `brand-content.php` -544) เทียบกับที่ประเมินไว้ ~738 บรรทัด ต่างกันเล็กน้อยเพราะรวมบรรทัด comment/whitespace ที่นับต่างกันเท่านั้น ไม่กระทบขอบเขต
- [x] 6.2 Commit แยกเฉพาะการลบ dead code นี้ (ไม่ปนกับงานอื่น) พร้อมข้อความอธิบายอ้างอิง commit `41baacf` ที่ทำให้ action เหล่านี้กลายเป็น dead code
