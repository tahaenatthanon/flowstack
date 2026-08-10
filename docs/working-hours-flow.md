# Working Hours Calculation Flow

> อัปเดตล่าสุด: 2026-06-09 · อ้างอิงโค้ดจริงใน codebase

---

## ภาพรวมระบบ

```
┌─────────────────────────────────────────────────────────────────┐
│                    WORKING HOURS CALCULATION                    │
│                      (ลำดับชั้นของข้อมูล)                      │
└─────────────────────────────────────────────────────────────────┘

Frontend Dialog                    Backend API                    Database
──────────────                     ───────────                    ────────
CreateTaskDialog
CreateSubtaskDialog       ──GET──▶  capacity.php          ◀────  work_schedules
TaskDetailSheet                                            ◀────  work_schedule_days
                                         │                ◀────  user_work_schedules
                                         │                ◀────  calendar_events (holiday/leave)
                                         │                ◀────  calendar_overrides
                                         │                ◀────  company_settings (timezone)
                                         ▼
                                   CapacityCheckResult
                                   {
                                     total_capacity: float   ← ชมทำงานจริงทั้งช่วง
                                     working_days: int       ← จำนวนวันทำงาน
                                     over_capacity: bool     ← เกิน capacity ไหม
                                     day_capacities: {...}   ← รายวัน + reason
                                     daily_load: {...}       ← งานที่มีอยู่แล้ว
                                   }
```

---

## Flow 1: resolveSchedule — หาตารางการทำงานของ user

```
resolveSchedule(db, tenantId, userId?)
        │
        ├─── userId มีค่า?
        │         │
        │         ▼ YES
        │    query user_work_schedules
        │    JOIN  work_schedule_days
        │    WHERE user_id = ?
        │         │
        │         ├── มีผลลัพธ์? ──YES──▶ return user schedule
        │         │                         { dow 1-7: {is_working, work_hours} }
        │         │
        │         NO (ไม่มี schedule ส่วนตัว)
        │         │
        │         ▼
        │    query work_schedules
        │    JOIN  work_schedule_days
        │    WHERE tenant_id = ? AND is_default = 1
        │         │
        │         ├── มีผลลัพธ์? ──YES──▶ return tenant default schedule
        │         │
        │         NO
        │         │
        └──────── ▼
             return HARDCODE fallback
             { Mon-Fri: is_working=1, work_hours=8.0
               Sat-Sun: is_working=0, work_hours=0.0 }
```

**Priority:** User Schedule → Tenant Default → Mon-Fri 8h fallback

**ไฟล์:** `api/task-hours-rollup.php` → `resolveSchedule()`

---

## Flow 2: buildDayCapacities — คำนวณ capacity รายวัน

```
capacity.php อ่าน company_settings.timezone ก่อนทุกอย่าง
  → date_default_timezone_set($tenantTz)
  → new DateTimeZone($tenantTz) ส่งเข้า buildDayCapacities()
  (ป้องกัน UTC vs Asia/Bangkok คลาดเคลื่อน 7 ชม.)

buildDayCapacities(db, tenantId, userId, start, end, timezone)
        │
        ├── fetchHolidays(start, end)          → วันหยุดบริษัท
        │      ├─ calendar_events WHERE event_type='holiday'  [PRIMARY]
        │      ├─ company_holidays table (if exists)          [FALLBACK]
        │      └─ tasks WHERE task_type='holiday'             [LEGACY]
        │
        ├── fetchUserLeaves(userId, start, end) → การลาของ user
        │      ├─ calendar_events WHERE event_type='leave'    [PRIMARY]
        │      │    all_day=1 → 8h, else คำนวณจาก start_at–end_at
        │      ├─ user_leaves table (if exists)               [FALLBACK]
        │      └─ tasks WHERE task_type='leave'               [LEGACY]
        │
        ├── fetchOverrides(userId, start, end)  → กำหนดพิเศษ
        │      └─ calendar_overrides WHERE user_id=?
        │           override_type='work' → ทำงานวันนั้น N ชม.
        │           override_type='off'  → หยุดวันนั้น
        │
        └── resolveSchedule(tenantId, userId)   → ตารางปกติ
                (ดู Flow 1)

        ┌────────────────────────────────────────┐
        │  วนลูปทุกวันใน [start…end]             │
        └────────────────────────────────────────┘
                │
                ▼
        ┌─── มี calendar_override วันนี้? ─────────────────────┐
        │    YES: override_type = 'work'                        │
        │         leaveHours = leaves[date] ?? 0               │
        │         capacity = max(0, override.hours − leaveHours)│
        │         reason = 'override_work'                      │
        │              หรือ 'override_work_partial_leave'       │
        │              หรือ 'override_work_full_leave'          │
        │         ⚠️ override_work ไม่ bypass การลาอีกต่อไป    │
        │    YES: override_type = 'off'                         │
        │         capacity = 0.0                                │
        │         reason = 'override_off'                       │
        └───────────────────────────────────────────────────────┘
                │ NO override
                ▼
        ┌─── schedule[day_of_week].is_working = 0? ────────────┐
        │    YES: capacity = 0.0                                │
        │         reason = 'non_working'                        │
        │         (วันหยุดตาม schedule เช่น เสาร์-อาทิตย์)    │
        └───────────────────────────────────────────────────────┘
                │ is_working = 1
                ▼
        ┌─── มี holiday วันนี้? ────────────────────────────────┐
        │    YES: capacity = 0.0                                │
        │         reason = 'holiday'                            │
        └───────────────────────────────────────────────────────┘
                │ ไม่ใช่ holiday
                ▼
        ┌─── คำนวณ capacity ปกติ ──────────────────────────────┐
        │    dayHours   = schedule[dow].work_hours              │
        │    leaveHours = leaves[date] ?? 0                     │
        │    capacity   = max(0, dayHours − leaveHours)         │
        │                                                       │
        │    reason:                                            │
        │    leaveHours >= dayHours → 'full_leave'  (0h)       │
        │    leaveHours > 0         → 'partial_leave' (N h)    │
        │    else                   → 'working'                 │
        └───────────────────────────────────────────────────────┘

        ผลลัพธ์:
        total_capacity = SUM(day_capacities[*].capacity)
        working_days   = COUNT(days where capacity > 0)
```

**ไฟล์:** `api/capacity.php` → `buildDayCapacities()`

---

## Flow 3: Frontend → Auto-sync estimatedHours

```
ผู้ใช้เปิด CreateTaskDialog / CreateSubtaskDialog / TaskDetailSheet
        │
        ├── เลือก assignee → assigneeId (UUID)
        ├── เลือก startDate
        └── เลือก endDate
                │
                ▼
        ┌─── isMultiDay? (startDate ≠ endDate) ─────────────────┐
        │    NO:  ใช้ค่าที่ผู้ใช้กรอก (manual input)            │
        │         validate: ≤ maxTaskHours (default 16h)         │
        └───────────────────────────────────────────────────────-┘
                │ YES
                ▼
        useCapacityCheck(params) ← params ถูก debounce 400ms
          (กัน API spam จาก date-picker ที่เปลี่ยนรัวๆ)
                │
                ├── assigneeId มีค่า? ──NO──▶ workingHours() JS fallback
                │                              (skip Sat/Sun เท่านั้น ⚠️)
                │ YES
                ▼
        useDebounced({ assigneeId, startDate, endDate }, 400ms)
                │
                ▼
        GET /api/capacity.php
        ?user_id=...&start_date=...&end_date=...
                │
                ▼
        buildDayCapacities(...)    ← ดู Flow 2
                │
                ▼
        CapacityCheckResult.total_capacity
                │
                ▼
        useEffect: setEstimatedHoursInput(String(total_capacity))
        ─────────────────────────────────────────────────────────
        ผู้ใช้เห็น hint:
          "5 วันทำงาน · Capacity 40 ชม. (แก้ไขได้)"
          (ถ้ายังโหลด: "7 วันปฏิทิน (แก้ไขได้)")

        ผู้ใช้สามารถ override ค่านี้ได้เอง
```

**ไฟล์:**
- `src/components/CreateTaskDialog.tsx`
- `src/components/CreateSubtaskDialog.tsx`
- `src/components/TaskDetailSheet.tsx`
- `src/hooks/useCapacity.ts` → `useCapacityCheck()` + `useDebounced()`

---

## Flow 4: CapacityWarning — แสดงเตือนเมื่อเกิน capacity

```
CapacityWarning component
  props: { assigneeUserId, startDate, endDate, estimatedHours }
        │
        ▼
useCapacityCheck({
  assigneeUserId,
  startDate, endDate,
  estimatedHours,       ← ส่งพร้อมกัน เพื่อให้ backend คำนวณ effective_hours
  enabled: !!assigneeUserId && estimatedHours > 0
})
        │
        ▼
GET /api/capacity.php?...&estimated_hours=32
        │
        ├── effective_hours = min(raw_hours, total_capacity)
        │     raw=32, capacity=16 → effective=16
        │
        └── over_capacity = raw_hours > total_capacity
              raw=32 > capacity=16 → TRUE
        │
        ▼
getCapacityWarningMessage(data):
  over_capacity = true
    → "ชั่วโมงประมาณ (32 ชม.) เกิน Capacity จริง (16 ชม.) — เกินไป 16 ชม."

getOverloadedDays(data):
  daily_load[date].overloaded = true
    → รายวันที่ assigned งานเกิน capacity

        ▼
แสดง warning banner (สีส้ม)
แสดง per-day breakdown (ถ้า showDayBreakdown=true)
ไม่แสดงอะไรถ้าไม่มีปัญหา (return null)
```

**ไฟล์:** `src/components/CapacityWarning.tsx`

---

## Flow 5: Task Save — ชมที่บันทึกลง DB + Transaction Guard

```
ผู้ใช้กด "สร้างงาน" / "บันทึก"
        │
        ▼
computedHours = parseFloat(estimatedHoursInput)
  ← ค่านี้ถูก sync จาก capacity.php แล้ว (ดู Flow 3)
  ← ผู้ใช้อาจ override ก่อนกด save
        │
        ▼
POST /api/tasks.php  (สร้างใหม่)
PUT  /api/tasks.php  (แก้ไข)
{ estimated_hours: computedHours,
  assignee_user_id: assigneeId,
  start_date, end_date, ... }
        │
        ▼ ┌─────────────────────────────────────────────┐
          │  $db->beginTransaction()                    │
          │  (ป้องกัน race condition: หลาย user         │
          │   กด save งานใน project เดียวกันพร้อมกัน)  │
          │                                             │
          │  recalcTaskHoursFromChildrenUnified()       │
          │    ├── resolveSchedule() → hoursPerDay      │
          │    ├── SUM(children.estimated_hours)        │
          │    ├── estimated_days = round(Σ/hoursPerDay)│
          │    └── UPDATE projects.actual_hours         │
          │         = SUM(root tasks.actual_hours)      │
          │                                             │
          │  $db->commit()                              │
          │  หาก error → $db->rollBack() + throw       │
          └─────────────────────────────────────────────┘
```

**ไฟล์:** `api/tasks.php`, `api/task-hours-rollup.php`

---

## Flow 6: recalcTaskProgress — คำนวณ % ความคืบหน้า (Hours-Weighted)

```
PUT /api/tasks.php (update any field on subtask)
        │
        ▼
recalcTaskProgress(db, taskId)

  SELECT
    COUNT(*)                                               AS total,
    COALESCE(SUM(estimated_hours), 0)                     AS total_hours,
    SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END)   AS completed_count,
    SUM(CASE WHEN status='completed'
             THEN COALESCE(estimated_hours, 0) ELSE 0 END) AS completed_hours
  FROM tasks
  WHERE parent_task_id = taskId
    AND deleted_at IS NULL
    AND is_subtask = 0
    AND status != 'cancelled'     ← ไม่นับงานยกเลิกใน total
        │
        ▼
  ┌─── total = 0? ────────────────────────────────────────┐
  │    YES: progress = 0  (ไม่มี subtask / ทั้งหมด cancel)│
  └───────────────────────────────────────────────────────┘
        │ total > 0
        ▼
  ┌─── total_hours > 0? ──────────────────────────────────┐
  │    YES: progress = round(completed_hours              │
  │                          / total_hours × 100)         │
  │    Hours-weighted ✓ — งาน 40h สำคัญกว่างาน 1h       │
  │                                                       │
  │    NO (ยังไม่มีใครกรอก estimated_hours):             │
  │    fallback: progress = round(completed_count         │
  │                               / total × 100)          │
  └───────────────────────────────────────────────────────┘
        │
        ▼
  UPDATE tasks SET progress_percentage = progress
  WHERE id = taskId

  recurse → SELECT parent_task_id → recalcTaskProgress(grandParent)
```

**ตัวอย่าง:**
```
Subtask A: estimated_hours=1,  completed → contributes 1/41 = 2.4%
Subtask B: estimated_hours=40, pending   → contributes 0/41
Progress = round(1/41 × 100) = 2%   ← สะท้อนความเป็นจริง

(แบบเดิม count-based: 1/2 = 50% ← ผิด)
```

**ไฟล์:** `api/tasks.php` → `recalcTaskProgress()`

---

## สรุป: ลำดับ Priority การคำนวณ (สูง → ต่ำ)

```
┌────────────┬─────────────────────────────┬──────────────────────┐
│  PRIORITY  │  ที่มา                      │  ตาราง               │
├────────────┼─────────────────────────────┼──────────────────────┤
│  1 (สูงสุด)│ Calendar Override (work)    │ calendar_overrides   │
│            │ + หักลบการลาด้วยเสมอ        │                      │
├────────────┼─────────────────────────────┼──────────────────────┤
│  1 (สูงสุด)│ Calendar Override (off)     │ calendar_overrides   │
│            │ หยุดทันที ไม่มีข้อยกเว้น   │                      │
├────────────┼─────────────────────────────┼──────────────────────┤
│  2         │ Schedule non-working day    │ work_schedule_days   │
│            │ วันที่ schedule บอกว่าหยุด  │ user_work_schedules  │
├────────────┼─────────────────────────────┼──────────────────────┤
│  3         │ Company Holiday             │ calendar_events      │
│            │ วันหยุดบริษัท              │ (event_type=holiday) │
├────────────┼─────────────────────────────┼──────────────────────┤
│  4         │ User Leave                  │ calendar_events      │
│            │ การลา (ลดชมที่เหลือ)        │ (event_type=leave)   │
├────────────┼─────────────────────────────┼──────────────────────┤
│  5 (ต่ำสุด)│ Work Schedule Hours         │ work_schedule_days   │
│            │ ชม.ปกติตาม schedule         │                      │
└────────────┴─────────────────────────────┴──────────────────────┘
```

---

## ไฟล์หลักที่เกี่ยวข้อง

| ไฟล์ | หน้าที่ |
|---|---|
| `api/capacity.php` | API หลัก: รับ user_id+dates → คืน total_capacity, per-day breakdown + timezone guard |
| `api/task-hours-rollup.php` | `resolveSchedule()`, `countWorkingHours()`, `recalcTaskHoursFromChildrenUnified()` |
| `api/tasks.php` | CRUD tasks, เรียก recalcProgress + rollup ในชุด transaction หลัง save |
| `src/hooks/useCapacity.ts` | `useCapacityCheck()` + `useDebounced()` 400ms |
| `src/components/CapacityWarning.tsx` | Warning banner component |
| `src/components/CreateTaskDialog.tsx` | Dialog สร้างงาน (sync hours จาก capacity API) |
| `src/components/CreateSubtaskDialog.tsx` | Dialog สร้างงานย่อย (lookup userId จาก displayName) |
| `src/components/TaskDetailSheet.tsx` | Sheet แก้งาน (sync + CapacityWarning) |

---

## Issues ที่แก้แล้วทั้งหมด

| ปัญหา | สาเหตุ | แก้ด้วย | ไฟล์ |
|---|---|---|---|
| 32h แทน 16h (4 วันคร่อม Sat-Sun) | JS `days * 8` นับวันปฏิทิน | `workingHours()` skip Sat/Sun | CreateTaskDialog |
| ยังผิดถ้า schedule ไม่ใช่ Mon-Fri | JS hardcode Sat/Sun เท่านั้น | `useCapacityCheck` → `capacity.php` | useCapacity.ts |
| วันหยุดบริษัทไม่ถูกหัก | JS ไม่รู้จัก `calendar_events` | `buildDayCapacities` → `fetchHolidays` | capacity.php |
| ลาครึ่งวันไม่ถูกคำนวณ | JS ไม่รู้จัก `user_leaves` | `buildDayCapacities` → `fetchUserLeaves` | capacity.php |
| override_work ไม่หักวันลา | leave deduction ถูก skip | `capacity = max(0, override.hours − leaveHours)` | capacity.php |
| progress ไม่ถ่วงน้ำหนักชั่วโมง | count-based (1 task = 1 หน่วย) | hours-weighted: `SUM(completed_hours) / SUM(total_hours)` | tasks.php |
| Divide by zero ใน progress | `total=0` เมื่อไม่มี subtask | `IF total > 0 THEN ... ELSE 0` + fallback | tasks.php |
| Race condition บน concurrent PUT | rollup ไม่มี transaction | `beginTransaction / commit / rollBack` | tasks.php |
| API spam จาก date-picker | params เปลี่ยนทุก render | `useDebounced(value, 400ms)` | useCapacity.ts |
| วันที่คลาดเคลื่อนข้าม timezone | PHP ใช้ server TZ (UTC) | อ่าน `company_settings.timezone` → `date_default_timezone_set()` | capacity.php |
| uq_task_dedup crash บน PUT | UNIQUE constraint ยิงตอน UPDATE | DROP INDEX `uq_task_dedup` | DB migration |
| progress นับงาน cancelled ด้วย | `COUNT(*)` รวมทุกสถานะ | `AND status != 'cancelled'` | tasks.php |
| days_spent หาร 8 เสมอ | hardcode `/8` | หาร `hoursPerDay` จาก `resolveSchedule()` | task-hours-rollup.php |
| project.actual_hours stale | ไม่ sync อัตโนมัติ | `UPDATE projects` หลัง rollup ทุกครั้ง | task-hours-rollup.php |
