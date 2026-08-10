# PM Goal Score — Impact OS แกน B ใหม่สำหรับ Project Manager

**วันที่:** 2026-06-26
**สถานะ:** Design (รอ implement)
**ขอบเขต:** ปรับการประเมินเป้า (KPI) ของ role **Project Manager** ใน Impact OS

---

## 1. ปัญหา / เป้าหมาย

เป้าของ Project Manager ปัจจุบันไม่สะท้อนความรับผิดชอบจริง — แกน B (BD score = `won*30 + active*10`)
ตั้ง `b_weight = 0` สำหรับ department "Project Manager" จึงไม่มีผล และไม่นับ:

- งานขายที่ **win / loss** ของโปรเจกต์ที่ PM ดูแล
- โปรเจกต์ที่ **เสร็จทันเวลา**
- โปรเจกต์ที่ **ถูกยกเลิก**

ต้องการให้ "เมื่อเปลี่ยนสถานะ (ดีล/โปรเจกต์) คะแนนของ PM กระทบทันที"

## 2. แนวทางที่เลือก

**นิยามแกน B ใหม่เฉพาะ PM** (reuse โครงสร้างแกน B + `b_weight` + `calcKpi` ที่มีอยู่) แทนการสร้างระบบคะแนนแยก
เพิ่มฟังก์ชัน `calcPmGoalScore()` แยกจาก `calcBdScore()` เดิม (BD score เดิมยังใช้กับ Sales/Manager ตามเดิม)

## 3. Schema change

เพิ่มสถานะ `cancelled` ให้โปรเจกต์:

```sql
ALTER TABLE projects
  MODIFY COLUMN status ENUM('on-track','at-risk','delayed','completed','cancelled')
  NOT NULL DEFAULT 'on-track';
```

- Migration: `database/migrations/2026_06_26_HHMMSS_add_cancelled_to_projects_status.sql` (รันจริง + verify ตามกฎโปรเจกต์)
- ไม่มีคอลัมน์ใหม่ — ใช้ field เดิมทั้งหมด

## 4. Attribution (ผ่าน `projects.manager_id` ทั้งหมด)

| สิ่งที่นับ | เงื่อนไข |
|---|---|
| โปรเจกต์ของ PM | `projects.manager_id = :userId AND tenant_id = :tenantId` |
| ดีลของ PM | `sales_opportunities.project_id` ชี้ไปโปรเจกต์ที่ `manager_id = :userId` |

## 5. สูตรคะแนน `calcPmGoalScore(db, userId, tenantId, start, end) -> ?float`

```
on_time_project = status = 'completed'
                  AND (original_end_date IS NULL OR end_date <= original_end_date)

win_rate    = won / (won + lost)                 // ดีลที่ปิดในงวด (won|lost)
ontime_rate = on_time / (completed + cancelled)  // โปรเจกต์ที่จบในงวด (completed|cancelled)

score = round( win_rate*50 + ontime_rate*50 )    // 0..100
```

**Period scoping**
- ดีล: นับ `stage IN ('won','lost')` ที่ `COALESCE(actual_close_date, DATE(updated_at))` อยู่ใน `[start, end]`
- โปรเจกต์: นับ `status IN ('completed','cancelled')` ที่ `DATE(updated_at)` อยู่ใน `[start, end]`
  - (`updated_at` = เวลาเปลี่ยนสถานะล่าสุด ใช้เป็น proxy ของวันจบโปรเจกต์ เพราะ projects ไม่มี `completed_date`)

**Edge cases**
- denominator ฝั่งใดเป็น 0 → ตัดฝั่งนั้น แล้วให้ฝั่งที่เหลือเต็ม 100
  - มีแต่โปรเจกต์จบ ไม่มีดีลปิด → `score = ontime_rate * 100`
  - มีแต่ดีลปิด ไม่มีโปรเจกต์จบ → `score = win_rate * 100`
- ทั้งสองฝั่ง 0 (ไม่มีข้อมูลปิดในงวด) → **return `null`**

## 6. การรวมเข้า KPI + re-normalize

`calcKpi` ต้องรองรับกรณีแกน B = `null` (เฉพาะ PM):

- ถ้า `pmScore !== null`: คิดตามปกติ `... + wB * pmScore`
- ถ้า `pmScore === null`: **ตัดแกน B แล้ว rescale** น้ำหนัก P/Q/A/S ให้รวมเป็น 1
  - `factor = 1 / (1 - wB)` ; ใช้ `wP*factor, wQ*factor, wA*factor, wS*factor`, `wB = 0`
  - ผล: งวดที่ PM ไม่มีดีล/โปรเจกต์ปิด จะไม่ถูกลงโทษ (B25 เฉลี่ยกลับเข้าแกนอื่น)

ผูกเข้ากับ flow เดิม: เมื่อ `department = 'Project Manager'` ให้ใช้ `calcPmGoalScore` เป็นค่าแกน B แทน `calcBdScore`
(department อื่นที่ `b_weight > 0` เช่น Manager ยังใช้ `calcBdScore` เดิม)

## 7. Weight ของ department "Project Manager"

ปรับใน `kpi_weight_configs` (seed/migration ค่า default):

| | P | Q | A | S | B | รวม |
|---|:-:|:-:|:-:|:-:|:-:|:-:|
| เดิม | 20 | 30 | 20 | 30 | 0 | 100 |
| ใหม่ | **15** | **25** | **15** | **20** | **25** | 100 |

ปรับเพิ่มเติมได้ผ่าน Admin → KPI Weights (กฎ p+q+a+s+b = 100 เดิม)

## 8. "เปลี่ยนสถานะ → กระทบคะแนน"

คะแนน Impact OS คำนวณ **on-read** จาก state ปัจจุบันทุกครั้งที่โหลดหน้า → เปลี่ยน `stage` ของดีล หรือ
`status` ของโปรเจกต์ แล้วคะแนนงวดที่เกี่ยวข้องเปลี่ยนในการโหลดถัดไป ไม่ต้องมี event/recompute job

## 9. UI

- **EditProjectDialog / สถานะโปรเจกต์**: เพิ่มตัวเลือก "ยกเลิก" (`cancelled`)
- `getStatusLabel('cancelled') = 'ยกเลิก'`, `getProjectStatusColor('cancelled') = 'status-cancelled'` (มีรองรับใน `projectUtils` แล้ว — verify)
- Impact OS leaderboard: แกน B ของ PM แสดง label สื่อความ เช่น "เป้า PM" (จุดที่แสดงชื่อแกน B)

## 10. Testing

PHP repro script (`scripts/test-pm-goal-score.php`, รันด้วย `php`):
1. สร้าง PM + โปรเจกต์: completed on-time, completed late (end_date > original_end_date), cancelled
2. สร้างดีลผูกโปรเจกต์ PM: won, lost
3. ยืนยัน `calcPmGoalScore` = `round(win_rate*50 + ontime_rate*50)` ตามเคส
4. เคส no-data → คืน `null`; เคสฝั่งเดียว → อีกฝั่งเต็ม 100
5. ยืนยัน `calcKpi` re-normalize ถูกเมื่อ pmScore = null
(ลบข้อมูลทดสอบหลังรัน)

## 11. Out of scope

- ไม่ย้อนคำนวณ/เก็บประวัติคะแนนรายงวด (คงพฤติกรรม on-read เดิม)
- ไม่แตะ BD score ของ department อื่น
- ไม่เพิ่ม cancelled ให้ task (เฉพาะ projects)
