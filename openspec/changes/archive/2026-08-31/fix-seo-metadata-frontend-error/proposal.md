## Why

หลัง backend เพิ่มสถานะ SEO `pending` สำหรับข้อมูลที่ยังไม่ได้กรอก หน้า SEO/AEO Metadata ยังรองรับเฉพาะ `pass`, `warn`, `fail` และ `skip` เมื่อกดเปิดส่วนนี้จึงเกิด runtime error ใน `Page` ขณะที่ส่วนอื่นของหน้ายังทำงานได้ตามปกติ

## What Changes

- เพิ่ม `pending` ในชนิดข้อมูลสถานะ SEO ของ frontend
- เพิ่มไอคอน สี และข้อความภาษาไทยสำหรับสถานะ `pending`
- ป้องกันการ render พังเมื่อ API ส่งสถานะใหม่หรือสถานะที่ไม่รู้จัก
- ปรับการแสดงผล SEO/AEO ให้สอดคล้องกับสถานะจาก backend โดยไม่เปลี่ยนกฎ SEO gate
- เพิ่มการทดสอบกรณี metadata ว่างและกรณีผลตรวจมี `pending`

## Capabilities

### New Capabilities

ไม่มี

### Modified Capabilities

- `content-seo-checklist`: หน้า SEO/AEO ต้องแสดงสถานะ `pending` ได้โดยไม่ทำให้หน้า Page ล้ม

## Impact

- Frontend: `src/components/content/types.ts`, `src/components/content/ArticleEditor.tsx` และชุดทดสอบ SEO/AEO ที่เกี่ยวข้อง
- API: ไม่แก้ไข
- Database: ไม่แก้ไข
- พฤติกรรมที่เปลี่ยน: ข้อมูล SEO ที่ยังว่างจะแสดงเป็นสถานะรอดำเนินการแทนการทำให้หน้าเกิดข้อผิดพลาด
