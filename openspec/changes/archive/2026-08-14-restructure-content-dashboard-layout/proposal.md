## Why

หน้าแดชบอร์ดคอนเทนต์ (`src/pages/ContentDashboardPage.tsx`) ใช้ layout แบบ stacked column เรียงจากบนลงล่าง 6 ส่วน (Stat Cards → แจ้งเตือนเกินกำหนด → ความคืบหน้าการผลิต → เนื้อหายอดนิยม+คิวรออนุมัติ → กำหนดการโพสต์+ช่องทาง → แพลตฟอร์ม+เนื้อหาล่าสุด) ทำให้หน้าเพจยาว ต้องเลื่อนมากเพื่อเห็นข้อมูลสำคัญ เช่น "คิวรออนุมัติ" ซึ่งเป็น action item กลับอยู่กลางหน้า และมีตาราง 2 อัน ("เนื้อหายอดนิยม" กับ "เนื้อหาล่าสุด") ที่มีคอลัมน์ซ้ำกัน

## What Changes

- เปลี่ยนเป็น master layout 2 คอลัมน์ (บนจอ `xl` ขึ้นไป): คอลัมน์ซ้าย (2/3) = ข้อมูลเชิงวิเคราะห์ + ตาราง, คอลัมน์ขวา (1/3) = widget สถานะและงานที่ต้องทำ
- ย้าย "คิวรออนุมัติ" ขึ้นเป็นรายการแรกของคอลัมน์ขวา (เน้น action item)
- รวม "เนื้อหายอดนิยม" + "เนื้อหาล่าสุด" เป็น Card เดียวโดยใช้ `Tabs` (ลดความยาวหน้าและคอลัมน์ซ้ำ)
- ปรับ responsive grid ของ Stat Cards จาก `lg:grid-cols-6` เป็น `xl:grid-cols-6` (6 ใบไม่แออัดบนจอ 1024px)
- เพิ่ม `tabular-nums` + `toLocaleString()` ให้ตัวเลขยอดวิว/ยอดไลก์หลักแสนขึ้นไปอ่านง่ายและเรียงตรง
- คงการคำนวณ count, hooks, API และ widget ทั้งหมดไว้ — เปลี่ยนเฉพาะการจัดวาง

## Capabilities

### New Capabilities

- `content-dashboard-layout`: กำหนด master layout 2 คอลัมน์แบบ responsive และลำดับ section ของหน้าแดชบอร์ดคอนเทนต์

### Modified Capabilities

- `content-dashboard-stat-card-style`: เปลี่ยน responsive breakpoint จาก `lg:grid-cols-6` เป็น `xl:grid-cols-6` และเพิ่ม `tabular-nums` + `toLocaleString()` สำหรับตัวเลขขนาดใหญ่
- `content-dashboard-top-content`: เปลี่ยนจากการแสดง widget แยก เป็นนำเสนอ "เนื้อหายอดนิยม" ร่วมกับ "เนื้อหาล่าสุด" ผ่าน `Tabs` ใน Card เดียว

## Impact

- `src/pages/ContentDashboardPage.tsx` — จัดโครงสร้าง JSX ใหม่ (master grid 2 คอลัมน์, Tabs, reorder section)
- ไม่กระทบ API, DB, hooks, หรือ logic การคำนวณใดๆ
