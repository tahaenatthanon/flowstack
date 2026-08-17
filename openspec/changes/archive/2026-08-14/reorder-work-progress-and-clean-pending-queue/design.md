## Context

`ContentDashboardPage.tsx` มีสองส่วนที่เกี่ยวข้อง:

**1. Work Progress** — ลำดับสถานะปัจจุบัน:

```tsx
const workProgressStatuses = ['published', 'pending_approval', 'approved', 'revision', 'draft'] as const;
```

ต้องการสลับ `pending_approval` กับ `approved`:
```tsx
const workProgressStatuses = ['published', 'approved', 'pending_approval', 'revision', 'draft'] as const;
```

**2. Pending Queue** — ปัจจุบัน:

```tsx
{pendingItems.map(item => (
  <div key={item.id} className="flex items-center justify-between gap-3">
    <div className="min-w-0">
      <p className="text-sm font-medium truncate">{item.title}</p>
      <p className="text-xs text-muted-foreground">{formatDate(item.requested_at)}</p>
    </div>
    <Badge variant="outline" className={STATUS_MAP.pending_approval.color}>รออนุมัติ</Badge>
  </div>
))}
```

`pendingItems` ถูก filter ด้วย `status === 'pending_approval'` แล้ว (ทุกแถวเป็นสถานะเดียวกัน)

## Goals / Non-Goals

**Goals:**
- สลับลำดับ "อนุมัติแล้ว" ขึ้นก่อน "รออนุมัติ" ใน Work Progress
- แสดงวันที่สร้าง (`created_at`) ในคิวรออนุมัติ แทน `requested_at`
- ลบ badge สถานะ "รออนุมัติ" (ซ้ำ) ออกจากรายการคิวรออนุมัติ

**Non-Goals:**
- ไม่เปลี่ยนการ filter `pendingItems` (ยังคง `status === 'pending_approval'`)
- ไม่เปลี่ยนการ sort ของ `pendingItems` (ยังคงเรียงตาม `requested_at`)
- ไม่เปลี่ยน label, จำนวน, percent, หรือ logic การคำนวณ
- ไม่แตะ API / DB / hooks
- ไม่แตะ Stat Card หรือส่วนอื่นของหน้า

## Decisions

**1. สลับลำดับใน `workProgressStatuses` array**
- เปลี่ยนจาก `['published', 'pending_approval', 'approved', ...]` เป็น `['published', 'approved', 'pending_approval', ...]`
- แค่สลับตำแหน่งใน array — ไม่ต้องแก้ `statusCounts` (map ยังใช้ key เดิม)

**2. คิวรออนุมัติแสดง `created_at` แทน `requested_at`**
- เปลี่ยน `formatDate(item.requested_at)` → `formatDate(item.created_at)`
- เหตุผล: ตรงตาม requirement "แสดง วันที่สร้าง ของแต่ละรายการ"

**3. ลบ badge สถานะ "รออนุมัติ" ออกจากคิวรออนุมัติ**
- ลบ `<Badge variant="outline" className={STATUS_MAP.pending_approval.color}>รออนุมัติ</Badge>` ออกจากแต่ละแถว
- เหตุผล: ทุกแถวเป็นสถานะ "รออนุมัติ" อยู่แล้ว badge จึงซ้ำและไม่จำเป็น

## Risks / Trade-offs

- [วันที่แสดงเปลี่ยนจาก requested_at เป็น created_at] → ตรงตาม requirement; sort ยังใช้ requested_at (ไม่แตะ)
- [Badge ถูกลบแล้ว row ดูเรียบขึ้น] → ชื่อ + วันที่เพียงพอต่อการระบุรายการ

## Migration Plan

- เปลี่ยนเฉพาะ `src/pages/ContentDashboardPage.tsx` (frontend เท่านั้น) — ไม่มี DB/API migration
- Rollback: revert `workProgressStatuses` order และเพิ่ม badge + เปลี่ยนกลับเป็น `requested_at`
