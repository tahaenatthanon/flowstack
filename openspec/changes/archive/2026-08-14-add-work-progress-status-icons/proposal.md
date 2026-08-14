## Why

ในส่วน "ความคืบหน้าการผลิต" (Work Progress) ของแดชบอร์ดคอนเทนต์ ปัจจุบันแต่ละสถานะแสดงเฉพาะข้อความ label (เช่น "เผยแพร่แล้ว", "รออนุมัติ") โดยไม่มีไอคอน ทำให้ผู้ใช้แยกแยะสถานะต่าง ๆ ได้ช้าลง — ขณะที่ส่วนอื่นของระบบ (Status filter tabs, Stat Cards) ใช้ไอคอนร่วมกับสี semantic เพื่อช่วยให้เข้าใจสถานะได้ทันที

## What Changes

- เพิ่มไอคอนสำหรับแต่ละหัวข้อสถานะในส่วน "ความคืบหน้าการผลิต" ทั้ง 5 สถานะ: เผยแพร่แล้ว, รออนุมัติ, อนุมัติแล้ว, รอแก้ไข, ฉบับร่าง
- ใช้ไอคอนและสี semantic จาก `STATUS_MAP` (single source of truth) เป็นค่ามาตรฐานเดียวกันทั่วทั้งระบบ
- วางไอคอนไว้หน้า label (ซ้าย) ในแถวเดียวกัน ตามรูปแบบ `flex items-center gap-1.5` ที่ใช้ใน Status tabs
- คงการแสดงจำนวนชิ้น, เปอร์เซ็นต์, progress bar และยอดรวมเดิมไว้ทั้งหมด
- ปรับไอคอนของแต่ละสถานะในทั้ง 3 หน้า (แดชบอร์ดคอนเทนต์, ผลงานคอนเทนต์, รายการอนุมัติ) ให้ใช้ไอคอนเดียวกันสำหรับสถานะเดียวกัน โดยยึด `STATUS_MAP` เป็นมาตรฐาน

## Capabilities

### New Capabilities

- `content-status-icon-consistency`: กำหนดให้สถานะเดียวกันใช้ไอคอนเดียวกันในทุกหน้าที่เกี่ยวข้อง (แดชบอร์ดคอนเทนต์, ผลงานคอนเทนต์, รายการอนุมัติ) โดยยึด `STATUS_MAP` เป็น single source of truth

### Modified Capabilities

- `content-dashboard-work-progress`: เปลี่ยน requirement การแสดงผลของ widget "ความคืบหน้าการผลิต" ให้แต่ละสถานะมีไอคอน semantic หน้า label

## Impact

- `src/components/content/types.ts` — เพิ่ม field `icon`/`iconColor` ให้กับ `STATUS_MAP` (และปรับ type) เพื่อเป็น single source of truth ของไอคอนสถานะ
- `src/pages/ContentDashboardPage.tsx` — render ไอคอนหน้า label ในส่วน Work Progress และปรับไอคอน Stat Card "ฉบับร่าง" ให้ตรงกับ `STATUS_MAP`
- `src/components/content/tabs/ContentApprovalTab.tsx` — ปรับไอคอน Stat Card (revision, approved) ให้ตรงกับ `STATUS_MAP`
- `src/components/content/tabs/ContentListTab.tsx` — ปรับไอคอน status tab ที่ไม่ตรงกับ `STATUS_MAP`
- ไม่กระทบการคำนวณ count/percent, progress bar, API, hooks
