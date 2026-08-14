## Why

ในแดชบอร์ดคอนเทนต์ (`ContentDashboardPage`) สถานะ "อนุมัติแล้ว" (`approved`) ใช้ไอคอน `BadgeCheck` และสีเขียว (`text-green-600`) เหมือนกับสถานะ "เผยแพร่แล้ว" (`published`) ซึ่งใช้ `CheckCircle2` สีเขียว — ทั้งสองเป็นเครื่องหมายถูกสีเขียว ทำให้ผู้ใช้แยกสถานะไม่ออก ทั้งที่ "อนุมัติแล้ว" (รอเผยแพร่) กับ "เผยแพร่แล้ว" เป็นคนละสถานะกัน นอกจากนี้ Status Card ยังไม่มีสีกรอบบ่งชี้สถานะ และ Work Progress ยังใช้แถบสี default เดียวกันหมด ไม่ได้ใช้สีประจำสถานะ และยังไม่สอดคล้องกับรูปแบบ Progress Bar มาตรฐานของ Dashboard Flowstack (หน้า Home)

## What Changes

- เปลี่ยนไอคอนสถานะ `approved` จาก `BadgeCheck` เป็น `Stamp` (ตราประทับอนุมัติ) และเปลี่ยนสีจากเขียวเป็น teal (`text-teal-600` + badge `bg-teal-100 ...`) เพื่อให้แยกจาก `published` (เขียว) และ `revision` (น้ำเงิน) ได้ชัดเจน
- ปรับ Status Card ในแดชบอร์ดคอนเทนต์ให้ใช้รูปแบบการตกแต่งเดียวกับ Status Card ในหน้าโปรเจกต์ (`stat-card card-hover`) โดยจัดวางองค์ประกอบเป็น: หัวข้อด้านซ้าย, ไอคอนด้านขวา, จำนวนด้านล่าง เพื่อให้ UI สอดคล้องกันทั้งระบบ
- ปรับ Work Progress ให้แถบความคืบหน้าใช้สีประจำสถานะ (ผ่าน `STATUS_MAP.progressColor`) และตัวเลขจำนวน/เปอร์เซ็นต์ใช้สีเดียวกับสถานะ
- ปรับ Progress Bar (`progressColor`) ให้ใช้สีเดียวกับ Status Card ของแต่ละสถานะ; หากสถานะใดไม่มี Status Card ให้ใช้สีเดียวกับ Icon ของสถานะนั้น
- กำหนดให้ใช้สีจากแหล่งเดียว (`STATUS_MAP.iconColor` เป็น single source of truth) เพื่อให้สีของ Status, Icon และ Progress Bar สอดคล้องกันทั้งระบบ
- `progressColor` เก็บ literal class เต็ม `[&>div]:bg-{color}-600` (รวม child selector) เพื่อให้ Tailwind JIT generate CSS ได้ (ห้ามต่อ string แบบ dynamic)
- ปรับรูปแบบแถบ Work Progress ให้ตรงกับมาตรฐาน Dashboard Flowstack: ความสูง `h-1.5`, แถบสีผ่าน `progressColor`, เปอร์เซ็นต์ใช้สีสถานะ
- เปลี่ยน hardcode ไอคอน `BadgeCheck` ใน `ContentApprovalTab` และ `ContentListTab` เป็น `Stamp` ให้สอดคล้องกับ `STATUS_MAP` (single source of truth)

## Capabilities

### New Capabilities

<!-- ไม่มี capability ใหม่ — ทั้งหมดเป็นการปรับ requirement เดิม -->

### Modified Capabilities

- `content-status-icon-consistency`: เปลี่ยน mapping ไอคอนและสีของสถานะ `approved` จาก `BadgeCheck`/เขียว เป็น `Stamp`/teal
- `content-approved-status`: เปลี่ยนสีของสถานะ `approved` ใน `STATUS_MAP` เป็น teal (แยกจาก published เขียว และ revision น้ำเงิน)
- `content-dashboard-stat-card-style`: ปรับ Status Card ให้ใช้รูปแบบการตกแต่งเดียวกับหน้าโปรเจกต์ และจัดวางหัวข้อซ้าย/ไอคอนขวา/จำนวนล่าง
- `content-dashboard-work-progress`: แถบความคืบหน้าใช้สีประจำสถานะ (สีเดียวกับ Status Card หรือ Icon จากแหล่งเดียว) และใช้รูปแบบ Progress Bar มาตรฐาน Flowstack (`h-1.5` + `progressColor` literal `[&>div]:bg-{color}-600`)

## Impact

- `src/components/content/types.ts` — `STATUS_MAP`: เปลี่ยน icon/color ของ `approved` และเพิ่ม field `progressColor` ให้ทุกสถานะ
- `src/pages/ContentDashboardPage.tsx` — Stat Card ใช้รูปแบบ `stat-card` เดียวกับหน้าโปรเจกต์, Work Progress ใช้สีเดียวกับ Status Card + รูปแบบมาตรฐาน
- `src/components/content/tabs/ContentApprovalTab.tsx` — hardcode `BadgeCheck` → `Stamp`
- `src/components/content/tabs/ContentListTab.tsx` — hardcode `BadgeCheck` → `Stamp`
- ไม่กระทบ API, DB, hooks, หรือ logic การคำนวณใดๆ
