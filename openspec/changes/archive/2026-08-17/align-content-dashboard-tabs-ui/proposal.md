## Why

แท็บ "ภาพรวม" และ "วิเคราะห์" บนแดชบอร์ดคอนเทนต์ (`ContentDashboardPage`) ใช้ `TabsList`/`TabsTrigger` แบบ default ของ shadcn (ข้อความล้วน ไม่มีไอคอน ไม่มี responsive grid) ซึ่งต่างจากแท็บหลักในหน้า "ผลงานคอนเทนต์" (`ContentPage`) ที่ใช้ไอคอน + label แบบ responsive (`sm:grid`) ทำให้ UI ของสองหน้าในโมดูลคอนเทนต์ไม่สอดคล้องกัน

## What Changes

- ปรับ `TabsList` ของแดชบอร์ดคอนเทนต์ให้ใช้รูปแบบเดียวกับหน้า "ผลงานคอนเทนต์": `flex overflow-x-auto w-full text-xs sm:text-sm sm:grid sm:grid-cols-2`
- เพิ่มไอคอน `lucide-react` ให้ `TabsTrigger` แต่ละแท็บ: "ภาพรวม" → `LayoutDashboard`, "วิเคราะห์" → `BarChart3` (ไอคอนแสดงเสมอ ขนาด `h-3.5 w-3.5 shrink-0`)
- ปรับ label ของแต่ละแท็บให้ซ่อนบนจอมือถือ (`hidden sm:inline`) เพื่อให้เหลือเฉพาะไอคอนบนจอแคบ เช่นเดียวกับหน้า "ผลงานคอนเทนต์"
- ปรับระยะห่างภายใน trigger เป็น `gap-1 sm:gap-2 px-2 sm:px-3 shrink-0` ให้สอดคล้องกัน

## Capabilities

### New Capabilities

<!-- none -->

### Modified Capabilities

- `content-dashboard-tabs`: เพิ่ม requirement เรื่องรูปแบบการแสดงผล (visual style) ของ `TabsList`/`TabsTrigger` ให้สอดคล้องกับหน้า "ผลงานคอนเทนต์" (`ContentPage`) — ครอบคลุมไอคอน, responsive grid, และการซ่อน label บนจอมือถือ

## Impact

- `src/pages/ContentDashboardPage.tsx`: ไฟล์หลักที่ถูกแก้ (ปรับ `TabsList`/`TabsTrigger` className และเพิ่ม icon import `LayoutDashboard`)
- ไม่กระทบ API, database schema, dependency, หรือ logic การสลับแท็บ/URL query (คง `handleTabChange` เดิม)
- `BarChart3` ถูก import อยู่แล้วในไฟล์; เพิ่มเฉพาะ `LayoutDashboard` ใน import จาก `lucide-react`
