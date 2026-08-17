## Context

แดชบอร์ดคอนเทนต์ (`src/pages/ContentDashboardPage.tsx`) ถูกแบ่งเป็น 2 แท็บ "ภาพรวม"/"วิเคราะห์" แล้ว (จาก change `content-dashboard-tabs`) โดยใช้ `Tabs` primitive ปัจจุบัน:

```tsx
<Tabs value={tab} onValueChange={handleTabChange} className="space-y-6">
  <TabsList>
    <TabsTrigger value="overview">ภาพรวม</TabsTrigger>
    <TabsTrigger value="analytics">วิเคราะห์</TabsTrigger>
  </TabsList>
  ...
```

หน้า "ผลงานคอนเทนต์" (`src/pages/ContentPage.tsx`) ใช้รูปแบบ tab bar ที่ต่างออกไป:

```tsx
<TabsList className="flex overflow-x-auto w-full text-xs sm:text-sm sm:grid sm:grid-cols-5">
  <TabsTrigger value="content" className="gap-1 sm:gap-2 px-2 sm:px-3 shrink-0">
    <PenTool className="h-3.5 w-3.5 shrink-0" />
    <span className="hidden sm:inline">ผลงานทั้งหมด</span>
  </TabsTrigger>
  ...
```

ความต่างหลัก: แดชบอร์ดใช้ `TabsList`/`TabsTrigger` default (ข้อความล้วน, จัดกลาง) ส่วน "ผลงานคอนเทนต์" มีไอคอน + label + responsive grid (`sm:grid-cols-5`) และซ่อน label บนจอมือถือ

## Goals / Non-Goals

**Goals:**
- ทำให้ tab bar "ภาพรวม"/"วิเคราะห์" ใช้รูปแบบ (visual style) เดียวกับ "ผลงานคอนเทนต์"
- เพิ่มไอคอนให้แต่ละแท็บ, ใช้ responsive grid (`sm:grid-cols-2`), และซ่อน label บนจอมือถือ
- คง behavior เดิมทั้งหมด (URL query, `handleTabChange`, เนื้อหาในแต่ละ `TabsContent`)

**Non-Goals:**
- ไม่เปลี่ยนเนื้อหา/เลย์เอาต์ภายใน `TabsContent` (Stat Cards, Work Progress, widget ต่าง ๆ)
- ไม่เพิ่ม count badge บน trigger (แท็บระดับบนสุดของ "ผลงานคอนเทนต์" ไม่มี count badge; count badge มีเฉพาะ sub-filter ของ `ContentListTab` เท่านั้น)
- ไม่แก้ logic การสลับแท็บหรือ URL query

## Decisions

### 1. Copy tab bar class structure จาก `ContentPage`
- ใช้ `TabsList className="flex overflow-x-auto w-full text-xs sm:text-sm sm:grid sm:grid-cols-2"`
- แต่ละ `TabsTrigger` ใช้ `className="gap-1 sm:gap-2 px-2 sm:px-3 shrink-0"`
- **Rationale**: รักษาความสอดคล้อง 1:1 กับหน้า "ผลงานคอนเทนต์" โดยปรับ `sm:grid-cols-5` เป็น `sm:grid-cols-2` เพราะมี 2 แท็บ
- **Alternative considered**: ใช้ `sm:grid-cols-5` เดิมกับ 2 แท็บ — ปฏิเสธ เพราะจะทำให้ trigger กว้างเกินไปเมื่อแบ่ง 5 คอลัมน์

### 2. ไอคอนแท็บ
- "ภาพรวม" → `LayoutDashboard` (เพิ่ม import จาก `lucide-react`)
- "วิเคราะห์" → `BarChart3` (import อยู่แล้ว)
- ไอคอนใช้ `className="h-3.5 w-3.5 shrink-0"` แสดงเสมอ (เหมือน `ContentPage`)
- **Rationale**: ไอคอนช่วยให้จำแท็บได้เร็วขึ้นเมื่อ label ถูกซ่อนบนจอมือถือ

### 3. Label ซ่อนบนจอมือถือ
- ห่อ label ด้วย `<span className="hidden sm:inline">` เช่นเดียวกับ `ContentPage`
- **Rationale**: บนจอแคบ `sm:grid` ไม่ทำงาน (เป็น flex scroll) และไอคอนอย่างเดียวเพียงพอ — สอดคล้องกับหน้า "ผลงานคอนเทนต์"

## Risks / Trade-offs

- [ไอคอน `LayoutDashboard`/`BarChart3` อาจสื่อความหมายไม่ชัดพอ] → ไอคอนทั้งสองใช้แล้วที่อื่นในระบบ (`LayoutDashboard` = แดชบอร์ดใน sidebar, `BarChart3` = วิเคราะห์) จึงสื่อความหมายตรง
- [การปรับ `TabsList` เป็น `sm:grid-cols-2` อาจต่างจาก default เล็กน้อยบนจอระหว่าง `sm`–`xl`] → ยอมรับได้ เพราะเป้าหมายคือ consistency กับ "ผลงานคอนเทนต์"
- [ไม่มีผลกระทบกับ URL query / tab state] → `handleTabChange` และ `TabsContent` ไม่ถูกแตะต้อง
