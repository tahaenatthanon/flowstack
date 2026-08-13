## Context

หน้ารายการอนุมัติ (`ContentApprovalPage`) มี Stat Cards 4 ใบ ด้านบน และ Toolbar ที่มี 2 แถว: แถวบนเป็น Tab Menu 5 แท็บสำหรับกรองสถานะ (`TABS`) และแถวล่างเป็นช่องค้นหา + Dropdown ประเภท/แพลตฟอร์ม/sort ตัวกรองสถานะปัจจุบันผูกกับ `activeTab` state และ `tabCounts` สำหรับแสดงจำนวนในแต่ละแท็บ การเรียงรายการใช้ `requested_at` (fallback `updated_at`/`created_at`) ผ่าน sort `requested_desc`/`requested_asc`

## Goals / Non-Goals

**Goals:**
- ลบ Tab Menu 5 แท็บออกจากหน้ารายการอนุมัติ
- เพิ่ม Filter Status (Dropdown) กรองตามสถานะ ใน toolbar แถวเดียวกันกับตัวกรองอื่น
- เปลี่ยน label sort เป็น "ล่าสุด-เก่าสุด" / "เก่าสุด-ล่าสุด"

**Non-Goals:**
- ไม่เปลี่ยน Stat Cards (ยังคง 4 ใบ)
- ไม่เปลี่ยน logic การอนุมัติ/ปฏิเสธ/ขอแก้ไข
- ไม่เปลี่ยน sort key (`requested_desc`/`requested_asc`) — เปลี่ยนเฉพาะ label
- ไม่เปลี่ยน API/DB

## Decisions

### ข้อที่ 1: แทนที่ `activeTab` state ด้วย `statusFilter` state

**เลือก**: เปลี่ยน `activeTab: string` เป็น `statusFilter: 'all' | 'approved' | 'pending_approval' | 'revision' | 'rejected'` และใช้ Dropdown `<Select>` แทน `<Tabs>`

**ทางเลือกที่พิจารณา:**
- คง `activeTab` ไว้และเปลี่ยนเฉพาะ UI เป็น Dropdown — ชื่อตัวแปรไม่สื่อความหมาย และ tab count badge ถูกทิ้ง
- ใช้ปุ่มชิป (chip buttons) เหมือนหน้า ContentListTab — ไม่สอดคล้องกับ toolbar ที่ใช้ Dropdown ทั้งหมด

**เหตุผล**: Dropdown สอดคล้องกับตัวกรองประเภท/แพลตฟอร์มที่มีอยู่ และลดพื้นที่ UI

### ข้อที่ 2: ลบ `EMPTY_STATE` และ `tabCounts` ทั้งหมด

**เลือก**: ลบ `EMPTY_STATE` (per-tab copy) และ `tabCounts` — ใช้ empty state เดียว และ count badge แสดงที่ toolbar (`visibleItems.length รายการ` ซึ่งมีอยู่แล้ว)

**ทางเลือกที่พิจารณา:**
- เก็บ `EMPTY_STATE` เป็น key ตาม statusFilter — ซับซ้อนเกินสำหรับ empty state ที่เกือบเหมือนกัน

**เหตุผล**: empty state ไม่ต้องแยกตาม tab อีกต่อไป

### ข้อที่ 3: ตัวเลือก Filter Status ใช้สถานะ approval เท่านั้น

**เลือก**: ตัวเลือก Dropdown: ทั้งหมด (`all`), อนุมัติแล้ว (`approved`), รออนุมัติ (`pending_approval`), ขอแก้ไข (`revision`), ปฏิเสธ (`rejected`) — ไม่รวม `draft`/`published` (เหมือนเดิม)

**เหตุผล**: `draft`/`published` ไม่ใช่สถานะที่อยู่ใน workflow การอนุมัติ (ถูกกรองออกจาก `approvalItems` แล้ว)

### ข้อที่ 4: เปลี่ยนเฉพาะ label ของ sort (ไม่เปลี่ยน value)

**เลือก**: คง value `requested_desc`/`requested_asc` — เปลี่ยน label เป็น "ล่าสุด-เก่าสุด" / "เก่าสุด-ล่าสุด"

**เหตุผล**: value ผูกกับ logic sort ที่ใช้อยู่ ไม่จำเป็นต้องเปลี่ยน การเปลี่ยน label ไม่กระทบ state/test ที่ใช้ value

## Risks / Trade-offs

- **ความเสี่ยง**: ลบ `Tabs` แล้วเหลือ import ที่ไม่ใช้ → **การลดความเสี่ยง**: ลบ import `Tabs, TabsList, TabsTrigger` และ icon ที่เหลือใช้
- **ความเสี่ยง**: test เดิมอ้างอิง tab (เช่น `getByRole('tab')`) → **การลดความเสี่ยง**: อัปเดต test ให้ใช้ filter dropdown แทน
- **ความเสี่ยง**: `usedTypes`/`usedPlatforms` เดิมอิง `tabItems` → **การลดความเสี่ยง**: เปลี่ยนให้อิง `statusFiltered` (ตัวแปรใหม่) แทน

## Migration Plan

1. แก้ `ContentApprovalPage.tsx` (ลบ tabs, เพิ่ม status filter, เปลี่ยน sort labels)
2. อัปเดต test
3. รัน `pnpm build` + `pnpm lint` + `pnpm test`

**Rollback**: git revert (ไม่มีการเปลี่ยน schema/API)
