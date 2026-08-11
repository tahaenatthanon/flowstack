## Context

หน้ารายการอนุมัติ (`/content-approval`) ที่พึ่งปรับปรุงเสร็จมี Stat Card 4 ใบ แสดงจำนวนตามสถานะ และตารางรายการที่กรองตาม Tab, Type, Platform, Search, Sort ได้ แต่ผู้ใช้งานไม่สามารถเปิดดูรายละเอียดของ Content แต่ละรายการได้ — ต้องออกจากหน้าไปดูที่ "ผลงานคอนเทนต์ทั้งหมด"

ระบบมี `ContentDetailView` component อยู่แล้วที่ใช้ในหน้าผลงานคอนเทนต์ สำหรับแสดงบทความ/วีดีโอแบบอ่านอย่างเดียว (View-Only) — component นี้รับ `item: ContentItem` และ `onBack: () => void`

**Current Stat Card layout:**
```
┌──────────────────────┐
│ [Icon]                │
│ Count                 │
│ Label                 │
└──────────────────────┘
```

**Target Stat Card layout:**
```
┌──────────────────────┐
│ Title           Icon  │
│ Count                 │
└──────────────────────┘
```

**Stack:** React 18 + TypeScript + Vite, shadcn-ui components, TanStack React Query, PHP + MariaDB backend

## Goals / Non-Goals

**Goals:**
- ปรับรูปแบบ Stat Card ให้ Title + Icon อยู่ในแถวเดียวกัน โดย Count อยู่ด้านล่าง — ใช้ `Card` component จาก shadcn-ui (`CardHeader` + `CardContent`) สอดคล้องกับ Design System เดิม
- ทำให้แถวในตาราง Approval List สามารถกดเพื่อเปิดดูรายละเอียด Content ได้ โดยใช้ `ContentDetailView` ที่มีอยู่แล้วในระบบ
- การเปิดดูรายละเอียดต้องไม่เปลี่ยนแปลง Status ของ Content (View-Only)
- Action "อนุมัติ", "ขอแก้ไข" และ "ปฏิเสธ" ยังคงทำงานตาม Business Logic เดิม

**Non-Goals:**
- ไม่แก้ไข Business Logic การอนุมัติ
- ไม่แก้ไข Calculation หรือ Business Logic ของ Count ใน Stat Card
- ไม่เพิ่ม API ใหม่
- ไม่เปลี่ยน UI ของหน้าอื่น
- ไม่เพิ่ม Component ใหม่ (ใช้ `ContentDetailView` ที่มีอยู่แล้ว)

## Decisions

### 1. Stat Card restructure
**Decision:** เปลี่ยนจาก `stat-card card-hover` pattern (icon container → value → label) เป็น `Card` component จาก shadcn-ui ที่มี `CardHeader` (Title + Icon) และ `CardContent` (Count)

Layout:
```tsx
<Card>
  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
    <CardTitle className="text-sm font-medium">{label}</CardTitle>
    <Icon className="h-4 w-4" />
  </CardHeader>
  <CardContent>
    <div className="text-2xl font-bold">{value}</div>
  </CardContent>
</Card>
```

**Rationale:** Pattern เดียวกับ `KpiCard` ใน `HomePage.tsx` ที่ใช้ `CardHeader` + `CardContent` โดย Title และ Icon อยู่แถวเดียวกัน (`flex flex-row items-center justify-between`) — เป็น pattern ที่มีอยู่แล้วใน Design System

**Grid:** `grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3` (คง grid เดิม)

**Semantic colors (คงเดิม):**
- รออนุมัติ (`review`) → `text-warning`
- อนุมัติแล้ว (`published`) → `text-success`
- ขอแก้ไข (`revision`) → `text-info`
- ปฏิเสธ (`rejected`) → `text-destructive`

### 2. Content detail view on row click
**Decision:** ทำให้ `TableRow` แต่ละแถวมี `onClick` ที่ set state `detailItem` จากนั้นแสดง `ContentDetailView` ใน `Dialog` wrapper

```tsx
<TableRow
  key={item.id}
  className="cursor-pointer hover:bg-muted/30"
  onClick={() => setDetailItem(item)}
>
```

และที่ท้าย component:
```tsx
<Dialog open={!!detailItem} onOpenChange={(v) => { if (!v) setDetailItem(null); }}>
  <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
    {detailItem && <ContentDetailView item={detailItem} onBack={() => setDetailItem(null)} />}
  </DialogContent>
</Dialog>
```

**Rationale:**
- `ContentDetailView` component มีอยู่แล้วในระบบและใช้ในหน้าผลงานคอนเทนต์ — ไม่ต้องสร้างใหม่
- `ContentDetailView` แสดงบทความ/วีดีโอแบบ View-Only โดยไม่เปลี่ยน Status (แค่แสดง `ContentArticleView` หรือ `ContentVideoView` ตาม type)
- `onBack` callback ใช้ปิด dialog ได้
- Dialog wrapper ทำให้เปิดดูรายละเอียดโดยไม่ navigate ออกจากหน้า
- `stopPropagation` ในปุ่มอนุมัติ/ปฏิเสธที่มีอยู่แล้วจะป้องกันไม่ให้ row click ทำงานเมื่อกดปุ่ม action

**Alternative considered:** ใช้ `ContentCardDialog` — แต่เป็น fullscreen dialog สำหรับ **แก้ไข** content ไม่ใช่ view-only และมีปุ่ม save/delete ที่ไม่เหมาะสมกับหน้ารายการอนุมัติ

### 3. Keep approve/reject buttons functional
**Decision:** ไม่แก้ไข logic ของปุ่มอนุมัติ/ปฏิเสธ — แค่เพิ่ม `stopPropagation` ในกรณีที่ยังไม่มี

**Rationale:** ปุ่มอนุมัติ/ปฏิเสธที่มีอยู่แล้วใช้ `onClick` handler โดยตรง ไม่ต้องแก้ไขอะไรเพิ่ม เพราะ `stopPropagation` ไม่จำเป็น — React event handler จะไม่ propagate ไปยัง parent `onClick` ถ้าไม่เรียก `stopPropagation` โดยตรง (แต่ระวัง: ถ้าใช้ native DOM events อาจต้องเพิ่ม)

## Risks / Trade-offs

- **Dialog scroll performance** → `ContentDetailView` อาจมีเนื้อหาเยอะ (บทความ + รูปภาพ + SEO) — ใช้ `max-h-[90vh] overflow-y-auto` เพื่อให้ scroll ได้
- **Row click vs action button conflict** → ปุ่มอนุมัติ/ปฏิเสธอยู่ใน `TableCell` สุดท้าย — ใช้ `e.stopPropagation()` บนปุ่มเพื่อป้องกัน row click
- **ContentDetailView มีปุ่มแก้ไข (Edit)** → `ContentDetailView` มีปุ่ม "แก้ไข" ที่เปิด `ContentCardDialog` — อาจต้องซ่อนปุ่มแก้ไขเมื่อเปิดจากหน้ารายการอนุมัติ หรือปล่อยให้ผู้ใช้แก้ไขได้ตามความต้องการ (ต้องการ context เพิ่ม)

## Open Questions

1. ควรซ่อนปุ่ม "แก้ไข" ใน `ContentDetailView` เมื่อเปิดจากหน้ารายการอนุมัติหรือไม่? → เบื้องต้น: ไม่ต้องเปลี่ยน — ปล่อยให้ผู้ใช้กดแก้ไขได้หากต้องการ
