## Why

ในแดชบอร์ดคอนเทนต์ (`ContentDashboardPage`) มีจุดที่ลำดับ/ข้อมูลแสดงไม่ตรงกับความต้องการของผู้ใช้สองจุด: (1) ส่วน "ความคืบหน้าการผลิต" แสดงสถานะ "รออนุมัติ" ก่อน "อนุมัติแล้ว" ทำให้ลำดับไม่เรียงตาม flow ของงานที่ควรเป็น "อนุมัติแล้ว" ก่อน "รออนุมัติ"; (2) ส่วน "คิวรออนุมัติ" แสดง badge สถานะ "รออนุมัติ" ซ้ำ (เพราะทุกแถวเป็นสถานะเดียวกันอยู่แล้ว) และแสดงวันที่ "requested_at" แทนที่จะเป็น "วันที่สร้าง" ทำให้ผู้ใช้ไม่เห็นว่าเนื้อหาถูกสร้างเมื่อใด

## What Changes

- ในส่วน "ความคืบหน้าการผลิต" สลับตำแหน่งของสถานะ "รออนุมัติ" (`pending_approval`) กับ "อนุมัติแล้ว" (`approved`) — ลำดับใหม่: เผยแพร่แล้ว → อนุมัติแล้ว → รออนุมัติ → รอแก้ไข → ฉบับร่าง
- ในส่วน "คิวรออนุมัติ" แสดงเฉพาะรายการที่มีสถานะ "รออนุมัติ" (`pending_approval`) (คงเดิม)
- ในส่วน "คิวรออนุมัติ" แสดง "วันที่สร้าง" (`created_at`) ของแต่ละรายการ แทน `requested_at`
- ในส่วน "คิวรออนุมัติ" ไม่แสดง badge สถานะ "รออนุมัติ" ในแต่ละรายการ (ลบ badge)

## Capabilities

### New Capabilities

<!-- ไม่มี capability ใหม่ — ทั้งหมดเป็นการปรับ requirement เดิม -->

### Modified Capabilities

- `content-dashboard-work-progress`: สลับลำดับสถานะ `pending_approval` กับ `approved`
- `content-dashboard-pending-queue`: แสดง `created_at` แทน `requested_at` และไม่แสดง badge สถานะในรายการคิวรออนุมัติ

## Impact

- `src/pages/ContentDashboardPage.tsx` — เปลี่ยน `workProgressStatuses` array (สลับ `pending_approval`/`approved`), เปลี่ยน `formatDate(item.requested_at)` เป็น `formatDate(item.created_at)` ในคิวรออนุมัติ, ลบ `<Badge>` สถานะออกจากรายการคิวรออนุมัติ
- ไม่กระทบ API, DB, hooks, หรือ logic การคำนวณใดๆ
- ไม่กระทบ Stat Card หรือส่วนอื่นของหน้า
