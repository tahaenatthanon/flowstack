# KPI Framework Configuration (Impact OS)

โครงสร้าง KPI 4 แกนและการตั้งค่า weight รายแผนก

---

## แกนหลัก 4 แกน (P / Q / A / S)

| แกน | ชื่อ | วัดจาก | field ในระบบ |
|---|---|---|---|
| **P** | Production | ชั่วโมงงานจริงของ leaf tasks | `tasks.actual_hours` |
| **Q** | Quality/Speed | % งานที่ส่งตรงหรือก่อนกำหนด | `completed_date <= end_date` |
| **A** | AI Adoption | ความถี่การใช้ AI Chat (normalize ด้วย median) | `chat_messages` count |
| **S** | Synergy | % งานในโปรเจกต์ที่มีทีม > 1 คน | `project_members` count |

---

## Default Weights รายแผนก

| แผนก | P (Production) | Q (Quality) | A (AI) | S (Synergy) |
|---|:---:|:---:|:---:|:---:|
| **Development** | 40% | 30% | 10% | 20% |
| **Sales** | 20% | 40% | 20% | 20% |
| **Support** | 30% | 30% | 10% | 30% |
| **Management/Admin** | 20% | 20% | 30% | 30% |

เหตุผล:
- **Dev**: เน้น Production (ชั่วโมงงาน) และ Quality (ส่งตรงเวลา) — ผลลัพธ์วัดได้ชัด
- **Sales**: เน้น Quality เพราะ conversion rate และ deal velocity สำคัญกว่าปริมาณ
- **Support**: เน้น Synergy เพราะการแก้ ticket ซับซ้อนต้องอาศัยทีม
- **Management**: เน้น AI Adoption และ Synergy เพราะ leverage ทีมผ่าน tool

---

## การปรับแก้

เข้าหน้า **Admin → KPI Weights** หรือใช้ API:

```bash
# ดู config ปัจจุบัน
GET /api/kpi-weights.php

# Seed default 4 แผนก (ครั้งแรก)
POST /api/kpi-weights.php?action=seed

# แก้ไข weight ของแผนก
PUT /api/kpi-weights.php?id=<uuid>
Body: { "p_weight": 35, "q_weight": 35, "a_weight": 15, "s_weight": 15 }
```

**ข้อบังคับ:** p_weight + q_weight + a_weight + s_weight = 100 เสมอ

---

## Fallback

ถ้า `users.position` ของ user ไม่ตรงกับ department ใดใน `kpi_weight_configs` ระบบจะใช้ค่า default 25/25/25/25 (uniform weights)

---

## Revenue Contribution

คำนวณนอก KPI matrix — ไม่ใช่แกน KPI แต่แสดงร่วมใน Leaderboard:

```
สำหรับแต่ละโปรเจกต์ที่ user มีงาน completed:
  revenue_share = (user_tasks / project_total_tasks) × project_won_revenue
revenue_contribution = Σ revenue_share (all-time, ไม่กรองตาม period)
```

---

*Impact OS v3.0 | อัปเดต: 2026-05-23*
