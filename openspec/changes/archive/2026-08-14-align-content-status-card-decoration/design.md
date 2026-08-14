## Context

Status Card ในแดชบอร์ดคอนเทนต์ (`src/pages/ContentDashboardPage.tsx`) ปัจจุบัน:

```tsx
const statCards = [
  { label: 'เนื้อหาทั้งหมด', value: totalItems, icon: FileText, color: 'text-blue-600', border: 'border-blue-600' },
  // ... 6 ใบ แต่ละใบมี field border ตามสีไอคอน
];

<div className={`stat-card card-hover p-3 sm:p-5 ${card.border}`}>
  <div className="flex items-center justify-between mb-2">
    <span className="text-sm font-medium">{card.label}</span>
    <Icon className={`w-4 h-4 ${card.color}`} />
  </div>
  <p className="text-xl sm:text-2xl font-bold font-heading tabular-nums">{card.value.toLocaleString()}</p>
</div>
```

Status Card ในหน้าโปรเจกต์ (`src/components/StatCards.tsx`) ใช้:

```tsx
<div className="stat-card card-hover p-3 sm:p-5">
  {/* ... */}
</div>
```

class `stat-card` ใน `src/index.css`:
```css
.stat-card {
  @apply p-5 rounded-xl border bg-card;
}
.card-hover {
  @apply transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5;
}
```

ความต่าง: แดชบอร์ดคอนเทนต์เพิ่ม `border-{color}` (สีกรอบตามไอคอน) และมี `card-hover` (hover effect)

## Goals / Non-Goals

**Goals:**
- ทำให้ Status Card แดชบอร์ดคอนเทนต์ใช้ class `stat-card` เป็น base decoration เดียวกับหน้าโปรเจกต์ (`rounded-xl` + padding + default border + `bg-card`)
- เอา hover effect ออก (รูปแบบคงที่เมื่อ hover)
- คง layout ภายใน (หัวข้อซ้าย/ไอคอนขวา/จำนวนล่าง) ไว้

**Non-Goals:**
- ไม่เปลี่ยน layout ภายใน Status Card
- ไม่เปลี่ยน label, จำนวน, หรือ logic การคำนวณ
- ไม่แตะ API / DB / hooks
- ไม่แตะ Progress Bar (`progressColor`) หรือไอคอนสถานะ (`iconColor`)

## Decisions

**1. ใช้ class `stat-card` เป็น base decoration เดียวกับหน้าโปรเจกต์**
- ใช้ class `stat-card` (`p-5 rounded-xl border bg-card`) เป็น base — ตรงกับ decoration ของ Status Card ในหน้าโปรเจกต์
- คง `p-3 sm:p-5` (responsive padding) เดิม
- เหตุผล: ตรงตาม requirement "ใช้รูปแบบการตกแต่งและดีไซน์เดียวกับ Status Card หน้าโปรเจกต์" — ขอบ/พื้นหลังจะถูก override ด้วยสีตาม Status ใน Decision 4–5

**2. เอา hover effect ออก**
- ลบ `card-hover` ออกจาก className
- เหตุผล: `card-hover` เพิ่ม `hover:shadow-lg hover:-translate-y-0.5` ทำให้การ์ดขยับเมื่อ hover — ต้องการรูปแบบคงที่

**3. คง layout ภายในเดิม**
- คงโครงสร้าง: หัวข้อ (label) ด้านซ้าย + ไอคอนด้านขวาในแถวเดียวกัน, จำนวนด้านล่าง
- ไม่เปลี่ยนเป็น icon-on-top pattern ของหน้าโปรเจกต์ (requirement ระบุ "คง Layout เดิม")

**4. เพิ่มสีพื้นหลังตาม Status บนทั้งการ์ด**
- เพิ่ม field `bgColor` ใน `statCards` array ตามสีไอคอนของแต่ละ card: `bg-blue-500/10`, `bg-green-500/10`, `bg-amber-500/10`, `bg-gray-500/10`, `bg-cyan-500/10`, `bg-pink-500/10`
- ใส่ `bgColor` ลงบนตัวการ์ด (`className={`stat-card p-3 sm:p-5 ${card.bgColor}`}`) เพื่อให้ทั้งการ์ดมีสีพื้นหลังตาม Status — ไอคอนแสดงแบบ plain โดยไม่ห่อกล่องสีแยก
- เหตุผล: ตรงตาม requirement "มีสีพื้นหลังตาม Status" (พื้นหลังของตัวการ์ด) — คง layout หัวข้อซ้าย/ไอคอนขวา/จำนวนล่าง

**5. เพิ่มสีขอบ (border) ตาม Status**
- เพิ่ม field `border` ใน `statCards` array ตรงกับสีไอคอนของแต่ละ card: `border-blue-600`, `border-green-600`, `border-amber-600`, `border-gray-600`, `border-cyan-600`, `border-pink-600`
- ใส่ `border` ลงบนตัวการ์ด (`className={`stat-card p-3 sm:p-5 ${card.border} ${card.bgColor}`}`) เพื่อให้ขอบมีสีตาม Status — ตรงกับสีไอคอน (`color`) ของ card นั้น

**6. ปรับสีจำนวน (Count) เป็นเฉดเข้มเดียวกับพื้นหลัง**
- เพิ่ม field `countColor` ใน `statCards` array ตามสีพื้นหลังของแต่ละ card: `text-blue-700`, `text-green-700`, `text-amber-700`, `text-gray-700`, `text-cyan-700`, `text-pink-700`
- ใส่ `countColor` ลงบนจำนวน (`<p className={`text-xl sm:text-2xl font-bold font-heading tabular-nums ${card.countColor}`}>`)
- เหตุผล: ตรงตาม requirement "สีของจำนวน (Count) เป็นสีเดียวกับพื้นหลังของ Card แต่ใช้เฉดสีที่เข้มกว่า" เพื่อให้ข้อความเด่นชัดและอ่านง่าย

## Risks / Trade-offs

- [การ์ดมีทั้งขอบสีและพื้นหลังสีตาม Status] → สีสถานะสื่อผ่านพื้นหลัง (`bgColor`), ขอบ (`border`), ไอคอน (`color`) และ Progress Bar (`progressColor`) จึงแยกสถานะได้ชัดเจน
- [class `stat-card` มี `p-5` อยู่แล้ว แต่ component ยังระบุ `p-3 sm:p-5`] → คง `p-3 sm:p-5` เดิมตามหน้าโปรเจกต์ (responsive padding) ไม่แตะ
- [จำนวน (Count) ใช้เฉดเข้ม -700 บนพื้นหลังอ่อน /10] → contrast เพียงพอและอ่านง่าย ตรงตาม requirement

## Migration Plan

- เปลี่ยนเฉพาะ `src/pages/ContentDashboardPage.tsx` (frontend เท่านั้น) — ไม่มี DB/API migration
- Rollback: เพิ่ม `card-hover` และ `border-{color}` กลับตามเดิม
