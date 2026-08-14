## Why

ปุ่ม "ดูเนื้อหาทั้งหมด" และ "สร้างคอนเทนต์" บนส่วนหัวของแดชบอร์ดคอนเทนต์ซ้ำซ้อนกับการนำทางที่มีอยู่แล้วในเมนูหลัก (คอนเทนต์โซเชียล) และปุ่ม "สร้างคอนเทนต์" ของหน้ารายการคอนเทนต์ จึงลบออกเพื่อให้แดชบอร์ดแสดงเฉพาะข้อมูลสรุป ไม่มี CTA ที่ไม่จำเป็น

## What Changes

- ลบปุ่ม "ดูเนื้อหาทั้งหมด" (ไอคอน `Eye`) ออกจากส่วนหัว (`PageShell.actions`) ของหน้าแดชบอร์ดคอนเทนต์
- ลบปุ่ม "สร้างคอนเทนต์" (ไอคอน `Plus`) ออกจากส่วนหัว (`PageShell.actions`) ของหน้าแดชบอร์ดคอนเทนต์
- ลบ import `Plus` ที่ไม่ถูกใช้งานแล้วออกจาก `src/pages/ContentDashboardPage.tsx`

## Capabilities

### New Capabilities

_ไม่มี — ไม่ได้เพิ่ม capability ใหม่_

### Modified Capabilities

- `content-dashboard-layout`: ส่วนหัวของแดชบอร์ดคอนเทนต์ไม่มีปุ่ม action ("ดูเนื้อหาทั้งหมด" และ "สร้างคอนเทนต์") อีกต่อไป

## Impact

- `src/pages/ContentDashboardPage.tsx`: ลบ `actions` prop ทั้งหมดของ `PageShell` และลบ import `Plus`
- ไม่มีการแก้ API, database, หรือ dependency ใด ๆ — เป็นการลบ UI เท่านั้น
