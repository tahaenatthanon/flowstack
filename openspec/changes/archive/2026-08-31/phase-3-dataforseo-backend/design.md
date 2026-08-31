## Context

Phase 2 มีตาราง `content_research_jobs`, `content_research_keywords` และ settings สำหรับ DataForSEO แล้ว แต่ยังไม่มีโค้ดที่เรียก provider หรือ API ให้ frontend ใช้งาน ต้องเพิ่มชั้น adapter เพื่อไม่ให้ endpoint ผูกกับรูปแบบ response ของ DataForSEO โดยตรง

## Goals / Non-Goals

**Goals:**

- เรียก DataForSEO ผ่าน HTTPS/cURL และ normalize ผลเป็น shape เดียว
- เก็บ raw response, cost และ normalized keywords ลงฐานข้อมูล
- ให้ API รองรับ test, fetch, cache, job history และ keyword selection
- รักษา tenant isolation, secret handling และ error semantics ตาม Phase 1-2

**Non-Goals:**

- ไม่วิเคราะห์ Research ด้วย AI ใน phase นี้
- ไม่ป้อน Research เข้า `generate-article`
- ไม่สร้าง frontend wizard
- ไม่เพิ่ม provider อื่นนอกจากโครง adapter ที่รองรับการขยาย

## Decisions

### 1. Adapter แยกจาก endpoint

สร้าง `api/lib/keyword-research.php` ให้คืน normalized shape เดียว ส่วน `api/content-research.php` รับผิดชอบ auth, DB, state และ response

ทางเลือกที่ไม่เลือก: เรียก DataForSEO ใน endpoint โดยตรง เพราะจะทำให้ provider logic, DB และ HTTP contract พันกันและเปลี่ยน provider ยาก

### 2. ใช้สาม DataForSEO calls

ใช้ SERP Organic Advanced สำหรับผลค้นหา/PAA/related, Keyword Suggestions สำหรับ cluster/difficulty/intent และ Google Ads Search Volume สำหรับ volume/competition/CPC

ทางเลือกที่ไม่เลือก: ใช้เฉพาะ SERP เพราะไม่มี metric keyword ที่เพียงพอสำหรับการคัดเลือกคำ

### 3. เก็บ raw และ normalized data คู่กัน

เก็บ raw JSON ใน job เพื่อ audit และ normalized rows ใน keywords เพื่อ sort/filter/query โดยคง `NULL` เมื่อ provider ไม่ส่งค่า

### 4. Cache ก่อนยิง provider

ค้น job `done` ตาม tenant, provider, location, language, seed และอายุ cache ก่อนทุก fetch หากเจอให้คืนผลเดิมพร้อม `cached: true`; `force_refresh` เท่านั้นที่ bypass

### 5. Failure เป็นสถานะของ job

สร้าง job ก่อน fetch และเปลี่ยนเป็น `failed` พร้อมข้อความไทยเมื่อ provider timeout, response ผิดรูปแบบ หรือ credential ใช้ไม่ได้ เพื่อไม่ทิ้ง job ค้างเป็น `fetching`

## Risks / Trade-offs

- [DataForSEO response เปลี่ยนรูปแบบ] → ตรวจ required fields, normalize แบบ defensive และเก็บ raw response
- [เรียก provider มีค่าใช้จ่าย] → cache ตาม settings, จำกัดจำนวน keyword และแสดง cost
- [timeout ทำให้ job ค้าง] → ใช้ timeout 60 วินาทีและ catch ทุก exception เพื่อเขียน `failed`
- [ข้อมูลหลุดข้าม tenant] → ทุก job/content/settings query ใช้ tenant id จาก auth
- [credential หลุดใน log/response] → ห้ามรวม password หรือ encrypted key ใน payload/log และคืนเฉพาะ status

## Migration Plan

ไม่มี schema migration เพิ่ม ใช้ schema จาก Phase 2 ที่ต้องมีอยู่แล้วก่อน apply หากไม่พบตารางให้หยุดและแก้ dependency ก่อน

## Open Questions

ไม่มีสำหรับ phase นี้ Provider แรกคือ DataForSEO, location เริ่มต้น `2764`, language `th` และ cache default `168` ชั่วโมง
