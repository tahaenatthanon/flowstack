## Context

Stat Card ในหน้าแดชบอร์ดคอนเทนต์ (`src/pages/ContentDashboardPage.tsx`) ใช้รูปแบบแนวนอน:

```tsx
<Card className={`border ${card.border} shadow-sm`}>
  <CardContent className="p-4 flex items-center gap-3">
    <div className={`p-2.5 rounded-lg ${card.color}`}>  {/* colored icon container */}
      <Icon className="h-5 w-5" />
    </div>
    <div>
      <p className="text-2xl font-bold">{card.value}</p>
      <p className="text-xs text-muted-foreground">{card.label}</p>
    </div>
  </CardContent>
</Card>
```

Stat Card ในหน้ารายการอนุมัติ (`ContentApprovalTab.tsx`) ใช้ KpiCard pattern:

```tsx
<Card key={card.key}>
  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
    <CardTitle className="text-sm font-medium">{card.label}</CardTitle>
    <Icon className={`h-4 w-4 ${card.color}`} />
  </CardHeader>
  <CardContent>
    <div className="text-2xl font-bold">{card.value}</div>
  </CardContent>
</Card>
```

## Goals / Non-Goals

**Goals:**
- ทำให้ Stat Card ทั้ง 6 ใบในแดชบอร์ดคอนเทนต์ใช้ KpiCard pattern เดียวกับหน้ารายการอนุมัติ (หัวข้อบนซ้าย, ไอคอนขวา, จำนวนล่าง)
- คง label, จำนวน, ไอคอน และสีของแต่ละ card ไว้

**Non-Goals:**
- ไม่เปลี่ยนการคำนวณ count (views/likes/draft/published/pending)
- ไม่เปลี่ยน logic, hooks, API
- ไม่แตะ Stat Card ในหน้าอื่น (รายการอนุมัติ, Home, SuperAdmin ฯลฯ)

## Decisions

**1. ใช้ KpiCard pattern ตรงจาก `ContentApprovalTab.tsx`**
- `<Card>` (ไม่เพิ่ม border/shadow override) → `<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">` (หัวข้อ `text-sm font-medium` ซ้าย + ไอคอน `h-4 w-4 {color}` ขวา) → `<CardContent>` (จำนวน `text-2xl font-bold`)
- ทางเลือกที่พิจารณา: คงแนวนอนแล้วปรับเล็กน้อย → ปัดตก เพราะต้องการความสอดคล้องเต็มรูปแบบ

**2. ไอคอน: เปลี่ยนจากกล่องสีเป็น text-color ล้วน**
- `color` field เปลี่ยนจาก `text-{c} bg-{c} dark:bg-...` + `border` เป็น `text-{c}` ล้วน (เช่น `text-blue-600`, `text-green-600`, `text-amber-600`, `text-gray-600`, `text-cyan-600`, `text-pink-600`)
- ลบ field `border` ออกจาก `statCards` array

**3. Grid: เปลี่ยน `gap-4` → `gap-3`**
- สอดคล้องกับหน้ารายการอนุมัติที่ใช้ `gap-3`
- คงจำนวน column responsive `grid-cols-2 sm:grid-cols-3 lg:grid-cols-6` (6 ใบ) ไว้ — ต่างจาก approval ที่ `lg:grid-cols-4` (4 ใบ) เพราะจำนวน card ต่างกัน

## Risks / Trade-offs

- [การ์ดแนวนอนเดิมให้ "กล่องสี" ที่เด่นกว่า] → KpiCard pattern เน้นตัวเลขและหัวข้อชัดเจนขึ้นและสอดคล้องกับ approval; ยอมรับการเปลี่ยน visual
- [จำนวน 6 ใบในแถวเดียวบนจอแคบ] → `sm:grid-cols-3` + `grid-cols-2` รองรับจอเล็กแล้ว ไม่ overflow

## Migration Plan

- เปลี่ยนเฉพาะ `ContentDashboardPage.tsx` (frontend เท่านั้น) — ไม่มี DB/API migration
- Rollback: revert markup และ `statCards` array กลับเป็นแนวนอน + กล่องสีเดิม
