# Impact OS — ระบบวัดประสิทธิภาพและผลกระทบ

เอกสารนี้อธิบายการทำงานจริงของระบบ **Impact OS** ใน Flowstack

---

## ปัญหาที่ระบบแก้ไข

1. **งานเหมาเข่ง:** พนักงานสร้างงานเดียวครอบคลุมทั้งเดือน วัดผลจริงไม่ได้
2. **งานแทรกไม่มีหลักฐาน:** ใช้งานแทรกเป็นข้ออ้างความล่าช้าโดยไม่บันทึกผลกระทบ
3. **ผู้บริหารขาดข้อมูล:** ไม่เห็น bottleneck ข้ามโปรเจกต์และสัญญาณเตือนแบบ real-time

---

## Architecture

```
Frontend (ImpactOSPage.tsx)
  └─ 11 tabs
       ├─ CEO / Overview / Departments  →  api/impactos.php?view=ceo|overview|departments
       ├─ KPI Ranking / Dev             →  api/impactos.php?view=leaderboard|dev
       ├─ Sales / Support               →  api/impactos.php?view=sales|support
       ├─ Quality / Customer            →  api/impactos.php?view=quality|customer
       ├─ AI วิเคราะห์ (per-user)       →  api/impactos.php?view=ai_analysis  (ต้องตั้งค่า AI Provider)
       ├─ AI Insights (system-wide)     →  api/ai-insights.php
       └─ Benchmark                     →  api/benchmark.php
```

---

## KPI 4 แกนหลัก (P / Q / A / S)

KPI แต่ละคนคำนวณจาก 4 แกน น้ำหนักปรับได้รายแผนกผ่าน `kpi_weight_configs`:

| แกน | ชื่อ | วิธีวัด | สูตร |
|---|---|---|---|
| **P — Production** | ปริมาณงาน | Leaf task actual_hours ในเดือน | `min(hours / 160 × 100, 100)` |
| **Q — Quality/Speed** | ความตรงเวลา | % งาน completed ก่อนหรือตาม end_date | `(on_time / total_completed) × 100` |
| **A — AI Adoption** | การใช้ AI | จำนวน chat messages ต่อคน normalize ด้วย median ของ tenant | `min(count / median × 100, 100)` |
| **S — Synergy** | การทำงานร่วมกัน | % งานที่อยู่ใน project ที่มีสมาชิก > 1 | `(team_tasks / total_tasks) × 100` |

> **หมายเหตุ:** แกน A วัด AI adoption ไม่ใช่ Stagnation และแกน S วัด Collaboration ไม่ใช่ Proposed Solutions
> ทั้งสองตัวเลือกนั้นเหมาะสมกว่าในทางปฏิบัติเพราะวัดได้จริงจากข้อมูลในระบบ

### สูตรรวม KPI

```
KPI = P×p_weight + Q×q_weight + A×a_weight + S×s_weight
```

น้ำหนักดึงจาก `kpi_weight_configs` ตาม `users.position` — ถ้าไม่มี config ของแผนกนั้นจะใช้ค่า default 25/25/25/25

### เกรด

| คะแนน | เกรด |
|---|---|
| ≥ 90 | A+ |
| ≥ 80 | A |
| ≥ 70 | B+ |
| ≥ 60 | B |
| ≥ 50 | C |
| < 50 | D |

---

## กฎการนับชั่วโมง (Leaf Task Rule)

```
ถ้างานมี subtask  → นับชั่วโมงรวมจาก subtask เท่านั้น (ตัด parent ออก)
ถ้างานไม่มี subtask → นับ actual_hours ของงานนั้นโดยตรง
```

เหตุผล: ป้องกันนับซ้ำ parent + child ในกรณีที่ parent ยังมี `actual_hours` ค้าง

### Progress Calculation (Hours-Weighted, ตั้งแต่ June 2026)

```
progress_percentage = SUM(estimated_hours ของงาน completed)
                      ──────────────────────────────────────  × 100
                      SUM(estimated_hours ของงานทั้งหมด)

กฎ:
- ไม่นับ status='cancelled' ใน numerator หรือ denominator
- ถ้าไม่มี estimated_hours → fallback count-based
- ถ้าไม่มี subtask เลย (total=0) → progress = 0

ตัวอย่าง: Subtask A (1h, done) + Subtask B (40h, pending)
  Hours-weighted: 1/41 = 2%   ✓ สะท้อนความจริง
  Count-based:    1/2  = 50%  ✗ เกินจริง
```

---

## การจัดการงานแทรก (Ad-hoc)

เมื่อเพิ่มงานแทรกผ่าน `InsertAdHocTaskDialog`:
1. ระบบคำนวณ Impact Simulation ทันที — แสดงจำนวนงานและโปรเจกต์ที่ได้รับผลกระทบ
2. บันทึก `task_type = 'ad_hoc'` และ `task_dependencies` พร้อม reason code
3. รายงาน Ad-hoc Density ปรากฏใน Reports

---

## Quality Dashboard — Interrupted vs Rework

ตัวชี้วัด "Defect Rate" ใน Quality Dashboard วัดจาก **งานที่ถูก interrupt** (`paused_at IS NOT NULL`) ไม่ใช่ rework ในความหมายวิศวกรรม

| สิ่งที่วัดได้จริง | สิ่งที่วัดไม่ได้ |
|---|---|
| งานที่ถูก pause และ complete ในที่สุด | งานที่ถูก reject และส่งกลับมาแก้ |
| อัตราการถูก interrupt | defect ที่เกิดจาก QA |

ใช้ตัวเลขนี้เป็น **proxy ของการถูกขัดจังหวะ** ไม่ใช่ rework rate จริง

---

## Benchmark Dashboard

เปรียบเทียบข้อมูลจริงของ tenant กับ **ค่า reference อุตสาหกรรม** ที่ตั้งไว้ล่วงหน้า:

| Metric | ค่า reference | ที่มา |
|---|---|---|
| ส่งงานตรงเวลา | 75% | Industry standard (PM) |
| SLA Compliance | 85% | ITIL framework |
| ปิดโปรเจกต์สำเร็จ | 70% | PMI benchmark |
| เวลาแก้ Ticket เฉลี่ย | 12 ชม. | Help Desk Institute |
| Email Open Rate | 22% | Mailchimp industry report |
| Win Rate (Sales) | 30% | HubSpot B2B benchmark |

ค่า reference เหล่านี้เป็น **จุดอ้างอิงทั่วไป** ไม่ใช่ข้อมูลจาก external API — ปรับแก้ได้ใน `api/benchmark.php`

---

## AI Analysis (per-user)

ต้องการ:
- AI Provider ตั้งค่าแล้วใน Admin → AI Settings
- ใช้ model จาก `company_settings.ai_analyst_model_id` (fallback: `openai/gpt-4o-mini`)

รับ KPI ทั้ง 4 แกนของ user + งานเสร็จ + ชั่วโมง + revenue contribution แล้วส่งให้ AI วิเคราะห์และส่งกลับเป็น JSON:
```json
{ "summary": "...", "strengths": [...], "weaknesses": [...], "recommendations": [...] }
```

---

## การตั้งค่า KPI Weights รายแผนก

Admin สามารถตั้งค่า weight ผ่านหน้า **Admin → KPI Weights** หรือ API:

```
GET    /api/kpi-weights.php              — ดู config ทั้งหมด
POST   /api/kpi-weights.php?action=seed  — seed default 4 แผนก
PUT    /api/kpi-weights.php?id=xxx       — แก้ไข weight
```

ผลรวม p_weight + q_weight + a_weight + s_weight **ต้องเท่ากับ 100** เสมอ

ดู default weights รายแผนกใน [kpi-config.md](./kpi-config.md)

---

*Impact OS v3.0 | อัปเดต: 2026-05-23 | สะท้อนการทำงานจริงใน impactos.php*
