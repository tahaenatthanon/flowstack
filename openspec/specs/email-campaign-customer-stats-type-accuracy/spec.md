# email-campaign-customer-stats-type-accuracy Specification

## Purpose

กำหนดให้ TypeScript type `CustomerStats` (ใน `src/hooks/useMarketing.ts`) ของ field `customers[]` ตรงกับ response จริงของ `GET /api/customer-email-stats.php` ทุก field ทั้งชื่อและความเป็นไปได้ที่จะเป็น `null` เพื่อป้องกัน type ที่ไม่ตรงความจริงหลุดไปใช้งานต่อในหน้า Marketing และทำให้ typecheck ไม่จับ error ที่ควรจับได้

## Requirements

### Requirement: Type ของสถิติอีเมลลูกค้าต้องตรงกับ API จริง
`CustomerStats` interface ใน `useMarketing.ts` SHALL ประกาศ field ของ `customers[]` ให้ตรงกับ response จริงของ `GET /api/customer-email-stats.php` ทุก field ทั้งชื่อและความเป็นไปได้ที่จะเป็น `null`

#### Scenario: Field ที่ API ส่งจริงต้องมีอยู่ใน type ครบ
- **WHEN** ตรวจสอบ field ของ `customers[]` ใน `CustomerStats`
- **THEN** type SHALL มี `total_emails`, `delivered`, `opened`, `clicked`, `bounced`, `open_rate`, `click_rate`, `last_sent`, `last_opened`, `last_clicked` ครบทุกตัว ตรงชื่อกับที่ `api/customer-email-stats.php` ส่งจริง

#### Scenario: Field ที่ไม่มีอยู่จริงต้องไม่ปรากฏใน type
- **WHEN** ตรวจสอบ field ของ `customers[]` ใน `CustomerStats`
- **THEN** type SHALL NOT มี `total_delivered`, `total_opens`, `total_clicks`, `last_open_at`, `last_click_at` (field เดิมที่ไม่ตรงกับ API จริง)

#### Scenario: Field ที่มาจาก MAX() บน LEFT JOIN ต้องรองรับ null
- **WHEN** ลูกค้ารายหนึ่งไม่เคยถูกส่งอีเมลเลย (ไม่มีแถวใน `email_tracking`)
- **THEN** `last_sent`, `last_opened`, `last_clicked` ของลูกค้ารายนั้น SHALL มี type เป็น `string | null` (ไม่ใช่ `string` เพียวๆ) เพราะ API จะส่งค่า `null` มาจริงในกรณีนี้

#### Scenario: โค้ดที่ใช้ type นี้ต้อง typecheck ผ่านโดยไม่มี error ใหม่
- **WHEN** รัน `npx tsc --noEmit` บนไฟล์ที่ใช้ `CustomerStats` (เช่น `MarketingPage.tsx`)
- **THEN** SHALL ไม่มี TS2339 (property does not exist) error ที่เกี่ยวกับ field ของ `CustomerStats.customers[]` อีกต่อไป
