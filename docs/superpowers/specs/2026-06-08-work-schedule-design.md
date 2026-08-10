# Work Schedule System — Design Spec
**Date:** 2026-06-08
**Status:** Approved

---

## 1. Overview

เพิ่มระบบ Work Schedule เพื่อให้การคำนวณ `estimated_hours` และ `capacity` ของแต่ละคนถูกต้องตามวันทำงานจริง แทนที่ค่า hardcode Mon–Fri 8h/day ที่ใช้อยู่ในปัจจุบัน

ปัญหาปัจจุบัน:
- `countWorkingDays()` hardcode `day_of_week < 6` = วันทำงาน, 8h/day
- `buildDayCapacities()` hardcode `8.0` เป็นจำนวนชั่วโมงปกติ
- บริษัทมีหลายทีมที่ทำงาน schedule ต่างกัน (เช่น Support ทำ Mon–Sat)

---

## 2. สถาปัตยกรรม

### 2.1 ตารางใหม่ (3 ตาราง)

```sql
work_schedules
  id CHAR(36) PK
  tenant_id CHAR(36)
  name VARCHAR(255)          -- "ออฟฟิส จ–ศ", "Support จ–ส"
  description TEXT
  is_default TINYINT(1)      -- 1 = default ของ tenant
  hours_per_day DECIMAL(4,2) -- default hours ถ้า work_schedule_days ไม่ระบุ
  created_at, updated_at

work_schedule_days
  id CHAR(36) PK
  schedule_id CHAR(36) FK → work_schedules
  day_of_week TINYINT        -- 1=จันทร์ … 7=อาทิตย์
  is_working TINYINT(1)
  work_hours DECIMAL(4,2)    -- ชั่วโมงทำงานวันนั้น (อาจต่างกัน เช่น ศุกร์ 7h)

user_work_schedules
  user_id CHAR(36) FK → users  PK (1 user = 1 schedule)
  schedule_id CHAR(36) FK → work_schedules
  updated_at
```

### 2.2 ตารางที่ยังคงใช้ (ไม่เปลี่ยนโครงสร้าง)

| ตาราง | หน้าที่ |
|---|---|
| `calendar_events` event_type='holiday' | วันหยุดนักขัตฤกษ์ (primary) |
| `company_holidays` | วันหยุดบริษัท legacy fallback |
| `calendar_overrides` | override วันเฉพาะรายคน (work/off + hours) |

### 2.3 Priority การ resolve วัน (สูง → ต่ำ)

```
1. calendar_overrides รายคน     ← admin override สูงสุด
2. calendar_events holiday      ← วันหยุดนักขัตฤกษ์
3. company_holidays             ← วันหยุดบริษัท legacy
4. work_schedule_days ของ user  ← schedule ของ assignee
5. default schedule บริษัท      ← tenant fallback
6. Mon–Fri 8h hardcode          ← สุดท้าย ถ้าไม่มีข้อมูลใดเลย
```

---

## 3. Logic การคำนวณ

### 3.1 `resolveSchedule(PDO, tenantId, userId|null): array`

Function ใหม่ใน `task-hours-rollup.php` คืน array indexed by day_of_week:
```php
[1 => ['is_working'=>1,'work_hours'=>8.0],  // จันทร์
 2 => ['is_working'=>1,'work_hours'=>8.0],  // อังคาร
 ...
 6 => ['is_working'=>0,'work_hours'=>0.0],  // เสาร์
 7 => ['is_working'=>0,'work_hours'=>0.0]]  // อาทิตย์
```

### 3.2 `countWorkingDays(PDO, tenantId, start, end, userId|null): int`

แก้ให้ใช้ `resolveSchedule()` แทน `day_of_week < 6`

### 3.3 `countWorkingHours(PDO, tenantId, start, end, userId|null): float`

Function ใหม่ — คืน Σ work_hours ของแต่ละวันทำงาน (รวม holiday/override awareness)
ใช้ใน task estimated_hours calculation แทน `days * 8`

### 3.4 `buildDayCapacities()` ใน `capacity.php`

แก้ hardcode `8.0` → ดึงจาก `resolveSchedule()` ของ user นั้น

---

## 4. API

### `api/work-schedules.php`

```
GET    /api/work-schedules.php               — list schedules (tenant)
GET    /api/work-schedules.php?id=<id>       — single schedule + days
POST   /api/work-schedules.php               — create schedule
PUT    /api/work-schedules.php?id=<id>       — update name/description/is_default
DELETE /api/work-schedules.php?id=<id>       — delete (ห้ามลบ default ถ้ามี user ใช้)
POST   /api/work-schedules.php?action=assign — assign schedule ให้ user
                                               body: {user_id, schedule_id}
GET    /api/work-schedules.php?action=user_assignments — list user→schedule map
```

Response รวม `days` array เสมอเมื่อ GET single

---

## 5. Admin UI

Tab ใหม่ **"ตารางงาน"** ใน AdminPage (ต่อจาก work-types tab):

- **รายการ schedules** — card แต่ละ schedule แสดงชื่อ, วันทำงาน, badge "Default"
- **สร้าง/แก้ไข schedule** — dialog กรอกชื่อ + checkbox แต่ละวัน + input ชั่วโมง
- **User assignment** — ตาราง user → schedule พร้อม dropdown เปลี่ยน

---

## 6. Overtime

- ไม่มีใน estimated — `estimated_hours = countWorkingHours()` เท่านั้น
- OT เกิดจาก `actual_hours > schedule work_hours` ในวันนั้น
- ยังไม่ต้อง implement OT report ใน scope นี้ (YAGNI)

---

## 7. สิ่งที่ไม่รวมใน scope นี้

- Schedule ระดับ project
- Effective date range ของ user schedule (user มี 1 schedule ตลอดไป)
- OT rate คำนวณเงิน
- Time zone support
