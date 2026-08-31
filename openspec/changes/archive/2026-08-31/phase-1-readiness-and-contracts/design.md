## Context

ระบบมี SEO checklist, SEO gate, approval และ publish flow อยู่แล้ว แต่กำลังจะเพิ่ม AI Research ที่ใช้ DataForSEO และเชื่อมกับ `generate-article` จึงต้องล็อกขอบเขตและรูปแบบข้อมูลก่อน เพื่อให้ phase ถัดไปทำงานบน contract เดียวกัน

Phase นี้เป็นเอกสารและการตรวจยืนยัน ไม่แก้ production code, ไม่แก้ schema และไม่เรียก external API

## Goals / Non-Goals

**Goals:**

- บันทึก baseline ของ behavior ที่แก้เสร็จแล้ว
- กำหนด contract กลางของ Research settings, job, keyword และ error response
- ระบุ tenant/security invariants และ ownership ของข้อมูล
- ระบุรายการตรวจรับก่อนเริ่ม Phase 2

**Non-Goals:**

- ไม่สร้าง endpoint, adapter, migration หรือ frontend
- ไม่เปลี่ยนกฎ SEO หรือ publish ที่มีอยู่
- ไม่เปิดใช้ DataForSEO หรือเปลี่ยนค่าในฐานข้อมูล

## Decisions

1. ใช้ `content_items` เดิม และเพิ่ม Research tables เท่านั้น
2. `content_research_jobs.content_item_id` เป็น nullable และใช้ `ON DELETE SET NULL` เพื่อเก็บ cache ที่จ่ายเงินไปแล้ว
3. Research เป็น optional ต่อ pipeline; กรณีไม่มี job ที่เสร็จแล้ว generation ต้องทำงานต่อได้
4. ทุก endpoint ใหม่ใช้ `requireAuth()` และ tenant id จาก authenticated user เท่านั้น ห้ามรับ tenant id จาก client เป็นแหล่งอ้างอิง
5. response จะไม่คืน encrypted key หรือ secret ใด ๆ; settings status ใช้ boolean `has_research_key`
6. provider ที่ implement ใน phase ถัดไปคือ DataForSEO แต่ endpoint จะเรียกผ่าน adapter shape กลาง
7. ค่า metric ที่ provider ไม่ส่งต้องคงเป็น `null`; ห้ามแปลงเป็น `0`

## Risks / Trade-offs

- [Contract ไม่ตรงกับโค้ดปัจจุบัน] → ตรวจไฟล์ SEO, publish, content update และ generation พร้อมบันทึกผลก่อนเริ่ม Phase 2
- [Research job ข้าม tenant] → ใช้ tenant predicate ในทุก read/update และตรวจ ownership ของ `content_item_id`
- [secret รั่วจาก settings response] → response contract อนุญาตเฉพาะ `has_research_key` และทดสอบด้วย fixture ที่มี encrypted value
- [แก้ซ้ำงาน SEO/Publish ที่เสร็จแล้ว] → phase นี้ห้ามแก้ production code และใช้รายการไฟล์ที่ตรวจยืนยันแล้วเป็น baseline
- [cache ทำให้ข้อมูลเก่าถูกใช้โดยไม่รู้ตัว] → response ต้องมี `cached` และ metadata provider/location/language/fetched time

## Migration Plan

ไม่มี migration ใน phase นี้ การเปลี่ยน schema เริ่มใน Phase 2 และต้องรัน/verify ตามกฎฐานข้อมูลของโครงการ

## Open Questions

ไม่มีสำหรับ phase นี้ การเลือก DataForSEO, location ไทย `2764`, language `th`, cache 168 ชั่วโมง และ `SET NULL` ถือว่ายืนยันแล้ว
