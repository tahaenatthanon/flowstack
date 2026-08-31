## Context

`seo-checklist` API สามารถคืนระดับ `pending` ได้แล้วเพื่อแยกข้อมูลที่ยังไม่ได้กรอกออกจากข้อมูลที่ผิดเกณฑ์ แต่ frontend ยังประกาศชนิดข้อมูลและชุดไอคอนเพียง 4 ระดับ เมื่อเปิดแผง SEO/AEO จึงเกิดการเข้าถึง `meta.icon` จากค่าที่ไม่มีอยู่และทำให้ `ErrorBoundary` ของหน้าแสดงข้อผิดพลาด

## Goals / Non-Goals

**Goals:**

- รองรับ `pending` ตั้งแต่ type ถึงการ render
- แสดงสถานะ pending เป็นภาษาไทยและไม่ทำให้หน้า parent ล้ม
- มี fallback ป้องกันกรณี backend เพิ่มระดับใหม่ในอนาคต
- ทดสอบการเปิดแผงและการแสดงผลทุกระดับ

**Non-Goals:**

- ไม่เปลี่ยน API หรือ SEO gate
- ไม่เปลี่ยนคะแนนหรือกฎ SEO
- ไม่แก้ข้อมูลคอนเทนต์ในฐานข้อมูล

## Decisions

1. เพิ่ม `pending` ใน `SeoRuleLevel` และ `SEO_LEVEL_META` โดยใช้ไอคอน/สีที่สื่อว่า “ยังไม่ได้กำหนด” แยกจาก `warn` และ `fail`
2. ใช้ fallback metadata ในจุด render หากได้รับค่า level ที่ไม่รู้จัก เพื่อให้ข้อมูลจาก API ใหม่ไม่ทำให้ทั้งหน้า crash
3. ปรับข้อความสถานะให้สอดคล้องกับ backend และใช้รูปแบบภาษาไทยเดิมของหน้าจอ
4. เพิ่ม regression test ที่เปิด SEO/AEO Metadata และตรวจรายการ `pending` โดยไม่ต้องเรียก API จริง

## Risks / Trade-offs

- [fallback อาจซ่อนการเพิ่ม level ใหม่โดยไม่ตั้งใจ] → ใช้ fallback เฉพาะเพื่อป้องกันหน้า crash และให้ข้อความสถานะกลางที่ตรวจสอบได้
- [type กับ API อาจไม่ตรงกันอีกในอนาคต] → ให้ test ครอบคลุมระดับที่ backend รองรับในปัจจุบัน

## Migration Plan

ไม่มี migration ฐานข้อมูลและไม่มีการเปลี่ยน API deploy เฉพาะ frontend ได้ การ rollback คือคืนไฟล์ frontend เดิม

## Open Questions

ไม่มี
