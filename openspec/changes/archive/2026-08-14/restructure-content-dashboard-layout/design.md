## Context

`ContentDashboardPage.tsx` ปัจจุบันครอบทุก section ด้วย `<div className="space-y-6">` เรียงตามลำดับ:

1. Stat Cards — `grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3`
2. Overdue alert (conditional)
3. ความคืบหน้าการผลิต (Card เต็มความกว้าง)
4. เนื้อหายอดนิยม (lg:col-span-2) + คิวรออนุมัติ (lg:col-span-1) — `grid lg:grid-cols-3 gap-6`
5. กำหนดการโพสต์ถัดไป + สถานะช่องทาง — `grid lg:grid-cols-2 gap-6`
6. แพลตฟอร์ม (lg:col-span-1) + เนื้อหาล่าสุด (lg:col-span-2) — `grid lg:grid-cols-3 gap-6`

ทุก widget อิงจาก shadcn-ui primitives (`Card`, `Table`, `Badge`, `Progress`, `Tabs`) และคง data hooks (`useContentItems`, `useOverdueCount`, `useAllSchedules`, `usePublishChannels`) ไว้

## Goals / Non-Goals

**Goals:**
- ลดความยาวหน้าและลดการเลื่อน โดยใช้ master layout 2 คอลัมน์บนจอใหญ่
- ยกระดับ "คิวรออนุมัติ" (action item) ให้เห็นง่ายขึ้น
- รวมตาราง 2 อันที่มีคอลัมน์คล้ายกันเป็น Tabs
- คงข้อมูลและการคำนวณเดิมทั้งหมด

**Non-Goals:**
- ไม่เพิ่ม/ลด widget ใหม่ (คงครบทั้ง 8 ส่วนเดิม)
- ไม่เปลี่ยน hooks, API, DB, หรือ logic การคำนวณ
- ไม่แตะ Stat Card ในหน้าอื่น

## Decisions

**1. Master layout 2 คอลัมน์ด้วย `grid xl:grid-cols-3`**
- ฝั่งซ้าย `xl:col-span-2`: ความคืบหน้าการผลิต + Tabs (ยอดนิยม/ล่าสุด)
- ฝั่งขวา (default 1 col): คิวรออนุมัติ, กำหนดการโพสต์ถัดไป, สถานะช่องทาง, แพลตฟอร์ม
- ใช้ `xl:` breakpoint (ไม่ใช่ `lg:`) เพราะที่ 1024px ตาราง + widget ขวาจะแคบเกินไป
- ต่ำกว่า `xl` ทุก section กลับเป็น stacked column เดียว (space-y-6) เช่นเดิม

**2. รวมตารางเป็น Tabs (`@/components/ui/tabs`)**
- defaultValue `top` (เนื้อหายอดนิยม), แท็บที่สอง `recent` (เนื้อหาล่าสุด)
- `Tabs` ครอบที่ระดับ `<Card>` เพื่อให้ `TabsList` อยู่ใน `CardHeader` และ `TabsContent` อยู่ใน `CardContent` ได้อย่างถูกต้องตาม Radix/shadcn
- คงคอลัมน์ responsive `hidden sm:table-cell` / `hidden md:table-cell` เดิมในแต่ละตาราง

**3. Stat Cards: `xl:grid-cols-6` + `tabular-nums`**
- เปลี่ยน `lg:grid-cols-6` → `xl:grid-cols-6` เพื่อกัน 6 ใบแออัดที่ 1024px (ช่วง lg จะแสดง 3 ใบ/แถว)
- ค่า `value` ใช้ `card.value.toLocaleString()` และ className เพิ่ม `tabular-nums`

**4. Reorder คอลัมน์ขวา**
- ลำดับใหม่: คิวรออนุมัติ → กำหนดการโพสต์ถัดไป → สถานะช่องทาง → แพลตฟอร์ม

## Risks / Trade-offs

- [บนจอ lg (1024px) ตารางจะอยู่คอลัมน์เดียวเต็มความกว้าง] → ยอมรับได้ หน้าสั้นลงและไม่แออัด
- [ย้าย widget ออกจากตำแหน่งเดิมทำให้ผู้ใช้คุ้นเคยต้องปรับตัว] → ย้ายเฉพาะ action item (คิวรออนุมัติ) ขึ้นบน ส่วน widget วิเคราะห์ยังอยู่ซ้ายล่าง-กลางตามลำดับ
- [Tabs ซ่อนตารางหนึ่งในสอง] → ผู้ใช้คลิกสลับแท็บได้ เหมาะเพราะคอลัมน์คล้ายกัน และลดการเลื่อน

## Migration Plan

- เปลี่ยนเฉพาะ `src/pages/ContentDashboardPage.tsx` (frontend เท่านั้น) — ไม่มี DB/API migration
- Rollback: revert JSX กลับเป็น stacked `space-y-6` เดิม
