## Why

Stat Card ในหน้าแดชบอร์ดคอนเทนต์ (`ContentDashboardPage.tsx`) ใช้รูปแบบ "ไอคอนในกล่องสีอยู่ซ้าย + จำนวน/ชื่ออยู่ขวา" (แนวนอน) ซึ่งต่างจาก Stat Card ในหน้ารายการอนุมัติ (`ContentApprovalTab.tsx`) ที่ใช้ KpiCard pattern (หัวข้อบนซ้าย + ไอคอนขวา, จำนวนล่าง) — ทำให้ Stat Card ที่สื่อความหมายเดียวกันมีหน้าตาไม่สอดคล้องกัน

## What Changes

- ปรับ Stat Card ทั้ง 6 ใบในแดชบอร์ดคอนเทนต์ (เนื้อหาทั้งหมด, เผยแพร่แล้ว, รออนุมัติ, ฉบับร่าง, ยอดวิวรวม, ยอดไลก์รวม) ให้ใช้รูปแบบเดียวกับ Stat Card ในหน้ารายการอนุมัติ
- จัดวางองค์ประกอบใหม่: หัวข้ออยู่ด้านบน (ซ้าย), ไอคอนอยู่ด้านขวา (แถวเดียวกับหัวข้อ), จำนวนอยู่ด้านล่าง
- ใช้ขนาด ระยะห่าง และ Layout ตาม KpiCard pattern: `<Card>` → `<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">` (หัวข้อ `text-sm font-medium` + ไอคอน `h-4 w-4 {color}`) → `<CardContent>` (จำนวน `text-2xl font-bold`)
- เปลี่ยน grid gap จาก `gap-4` เป็น `gap-3` ให้สอดคล้องกับหน้ารายการอนุมัติ
- คงจำนวน, label, ไอคอน และสีของแต่ละ card ไว้ (เฉพาะเปลี่ยนวิธีแสดงผลจากกล่องสีเป็นไอคอนสีล้วน)

## Capabilities

### New Capabilities

- `content-dashboard-stat-card-style`: กำหนดรูปแบบการแสดงผล (Visual Style) ของ Stat Cards ในหน้าแดชบอร์ดคอนเทนต์ ให้ใช้ KpiCard pattern เดียวกับหน้ารายการอนุมัติ (หัวข้อบน, ไอคอนขวา, จำนวนล่าง)

### Modified Capabilities

- `content-dashboard-stats`: เปลี่ยน requirement เกี่ยวกับสไตล์การ์ด (จาก "colored icon container + แนวนอน" เป็น KpiCard pattern เดียวกับหน้ารายการอนุมัติ)

## Impact

- `src/pages/ContentDashboardPage.tsx` — ปรับ `statCards` array (color เป็น text color ล้วน, ลบ border/bg) และ markup ของ grid + Card render
- ไม่กระทบการคำนวณ count, API, hooks, หรือ logic อื่น
