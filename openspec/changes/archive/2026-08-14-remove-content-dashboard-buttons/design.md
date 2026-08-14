## Context

หน้าแดชบอร์ดคอนเทนต์ (`src/pages/ContentDashboardPage.tsx`) ส่ง `actions` prop ให้ `PageShell` ซึ่ง render ปุ่ม 2 ปุ่มบนส่วนหัว: "ดูเนื้อหาทั้งหมด" (ไป `/content`) และ "สร้างคอนเทนต์" (ไป `/content?create=1`) ผู้ใช้ต้องการลบทั้ง 2 ปุ่มออก เพราะซ้ำซ้อนกับการนำทางที่มีอยู่แล้ว

## Goals / Non-Goals

**Goals:**
- ลบ `actions` prop ทั้งหมดของ `PageShell` ในหน้าแดชบอร์ดคอนเทนต์
- ลบ import `Plus` ที่ไม่ถูกใช้งานแล้ว (จาก lucide-react)

**Non-Goals:**
- ไม่ลบปุ่มอื่น เช่น "ดูรายการอนุมัติทั้งหมด" หรือปุ่ม "เปิดตัววางแผน" (`/content-planner`)
- ไม่แก้ layout, widget, หรือข้อมูลใด ๆ

## Decisions

- **ลบ `actions` prop ทั้งหมด** — ปุ่มทั้ง 2 ปุ่มเป็นสมาชิกเดียวใน `actions` จึงลบ prop ทั้ง block แทนการลบทีละปุ่ม แล้วเหลือ `<>` ว่าง
- **ลบเฉพาะ import `Plus`** — `Eye` ยังคงถูกใช้ใน statCard "ยอดวิวรวม" และ `navigate` ยังถูกใช้ในปุ่ม "เปิดตัววางแผน" กับ "ดูรายการอนุมัติทั้งหมด" จึงไม่แตะ

## Risks / Trade-offs

- [ลบ prop ผิดจุดทำให้ปุ่มอื่นหาย] → อ้างอิง comment/โครงสร้าง `actions={` ... `}` ที่ชัดเจน และตรวจผลด้วย lint/build

## Migration Plan

ไม่มี — เป็นการลบ UI ล้วน ๆ หลัง deploy ส่วนหัวของแดชบอร์ดจะไม่มีปุ่ม action
