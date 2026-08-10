## Context

หน้ารายการอนุมัติ (`/content-approval`) ปัจจุบันเป็นหน้าเดียวที่แสดงเฉพาะ content items ที่มี `status = 'review'` (รออนุมัติ) พร้อมตัวกรองแพลตฟอร์มและช่องค้นหาพื้นฐาน ผู้ใช้ต้องการมุมมองที่ครอบคลุมทุกสถานะของคอนเทนต์ใน workflow อนุมัติ

**สถานะที่เกี่ยวข้อง:** `review` (รออนุมัติ), `published` (อนุมัติแล้ว), `revision` (ขอแก้ไข), `rejected` (ปฏิเสธ)

**Current state:** เมื่อปฏิเสธ content item สถานะจะถูกเปลี่ยนเป็น `draft` — ไม่มีสถานะ `rejected` แยก

**DB Schema:** `content_items.status` เป็น ENUM ปัจจุบันมีค่า `('published','draft','revision','review')` — ต้อง ALTER TABLE เพิ่ม `'rejected'`

**Stack:** React 18 + TypeScript + Vite, shadcn-ui components, TanStack React Query, PHP + MariaDB backend

## Goals / Non-Goals

**Goals:**
- แสดง Stat Cards 4 ช่องสรุปจำนวนตามสถานะ โดยใช้ Visual Style `stat-card card-hover` สอดคล้องกับ Stat Cards ของหน้า Projects (icon container แบบ `bg-{color}/10`, label อยู่ใต้ value)
- เพิ่ม Tab Navigation 5 Tab (ทั้งหมด, รออนุมัติ, อนุมัติแล้ว, ขอแก้ไข, ปฏิเสธ) พร้อมจำนวน — จัดวางกึ่งกลาง (Center Aligned) และมี Icon ประกอบแต่ละ Tab
- เพิ่ม Type Filter Dropdown สำหรับกรองตาม `content_type` (ทั้งหมด, บทความ, วีดีโอ) วางหลังช่องค้นหาและด้านหน้า Platform Filter
- เพิ่ม Sort Dropdown (ใหม่→เก่า, เก่า→ใหม่)
- จัดกลุ่ม toolbar (Tabs อยู่แถวบน, Search, Type Filter, Platform Filter, Sort อยู่แถวล่าง) ไว้ในบริเวณเดียวกัน
- เพิ่มสถานะ `rejected` ใน `STATUS_MAP` และเปลี่ยน logic ปฏิเสธจาก `draft` เป็น `rejected`
- ALTER TABLE content_items เพิ่ม `'rejected'` ใน ENUM column `status`
- UI สอดคล้องกับ design system เดิมของ project (PageShell, shadcn-ui, Tailwind, `stat-card card-hover` pattern)

**Non-Goals:**
- ไม่แก้ไข UI หรือ logic ของหน้าอื่น
- ไม่เปลี่ยน workflow การอนุมัติ (approve/reject dialog เดิมยังคงอยู่)
- ไม่เพิ่ม API endpoint ใหม่ (ใช้ client-side filtering เป็นหลัก)
- ไม่เปลี่ยน component library หรือ global styles

## Decisions

### 1. Client-side filtering vs Server-side filtering
**Decision:** ใช้ client-side filtering เป็นหลัก (filter ตาม tab, search, sort ทั้งหมดทำใน frontend)

**Rationale:** จำนวน content items ต่อ tenant ไม่มาก (≤ 200), ข้อมูลทั้งหมดถูก fetch มาแล้วผ่าน `useContentItems()`, และการกรอง client-side ให้ UX ที่ responsive ทันทีเมื่อสลับ tab ไม่ต้องรอโหลดใหม่

**Alternative considered:** เพิ่ม `?status=` และ `?sort=` query params ใน `api/content-items.php` — ยังสามารถเพิ่มภายหลังได้หากข้อมูลโตขึ้น แต่ไม่จำเป็นสำหรับ scope นี้

### 2. สถานะ rejected vs draft
**Decision:** เพิ่ม `rejected` เป็นสถานะใหม่ใน `STATUS_MAP` และเปลี่ยน `handleReject` ให้เปลี่ยน status เป็น `rejected` แทน `draft`

**Rationale:** ผู้ใช้ต้องการแยกความแตกต่างระหว่าง "ผู้สร้างบันทึกเป็นร่างเอง" (`draft`) กับ "ผู้อนุมัติปฏิเสธ" (`rejected`) เพื่อให้เห็นภาพรวมของ workflow อนุมัติได้ชัดเจน

**Alternative considered:** ใช้ `draft` เหมือนเดิมและไม่เพิ่ม `rejected` — แต่จะทำให้ Tab "ปฏิเสธ" แสดงรายการที่ถูกร่างเองปนกับที่ถูกปฏิเสธ ไม่ตรงตาม requirement

### 3. Database migration for rejected status
**Decision:** สร้าง migration file `database/migrations/YYYY_MM_DD_HHMMSS_add_rejected_status.sql` เพื่อ ALTER TABLE content_items เพิ่ม `'rejected'` ใน ENUM

**Rationale:** Column `status` เป็น ENUM ไม่ใช่ VARCHAR — ไม่สามารถ INSERT/UPDATE ค่า `'rejected'` ได้หากไม่เพิ่มเข้าไปใน ENUM ก่อน และโปรเจกต์มี convention ให้ทุก schema change ต้องทำผ่าน migration file (ตาม `CLAUDE.md: Database Migrations`)

**SQL:**
```sql
ALTER TABLE content_items
  MODIFY COLUMN status ENUM('published','draft','revision','review','rejected')
  NOT NULL DEFAULT 'draft';
```

### 4. Tab component
**Decision:** ใช้รูปแบบ Status Filter Tab เดียวกับ `ContentListTab.tsx` (หน้าผลงานคอนเทนต์): `TabsList` แบบ `h-auto p-1 flex flex-wrap gap-0.5`, `TabsTrigger` แบบ `gap-1.5 text-xs sm:text-sm` พร้อม Icon `h-3.5 w-3.5` จาก `lucide-react` วางก่อนข้อความ, และจำนวนรายการแสดงใน `<span>` badge ทรงกลมด้านหลังข้อความ

**Rationale:** ใช้ pattern เดียวกับ Status Filter ในหน้าผลงานคอนเทนต์เพื่อความสอดคล้องของ UI — TabsList ใช้ `flex-wrap` ให้ Tab เรียงต่อกันและ wrap ตามธรรมชาติเมื่อพื้นที่ไม่พอ, `h-auto` ให้ความสูงปรับตามเนื้อหา, count badge แบบ `rounded-full bg-muted` อ่านง่ายและเป็น pattern เดียวกับที่มีในระบบ

**TabsList className:** `h-auto p-1 flex flex-wrap gap-0.5`
**TabsTrigger className:** `gap-1.5 text-xs sm:text-sm`

**Count badge:** `<span className="ml-1 text-[10px] px-1.5 py-0 rounded-full bg-muted font-semibold">{count}</span>` วางหลังข้อความ label

**Tab Icons (lucide-react, `h-3.5 w-3.5`):**
- ทั้งหมด → `Layers`
- รออนุมัติ → `Clock`
- อนุมัติแล้ว → `CheckCircle2`
- ขอแก้ไข → `AlertTriangle`
- ปฏิเสธ → `XCircle`

### 5. Stat Cards layout
**Decision:** ใช้ `stat-card card-hover` CSS classes (จาก `src/index.css`) ซึ่งเป็น pattern เดียวกับ Stat Cards ในหน้า Projects (`src/components/StatCards.tsx`) — โครงสร้าง: icon container แบบ `p-1.5 sm:p-2 rounded-lg bg-{color}/10` อยู่ด้านบน, ค่าตัวเลขแสดงด้วย `text-xl sm:text-2xl font-bold font-heading`, และ label ใต้ค่าด้วย `text-xs sm:text-sm text-muted-foreground`

**Rationale:** Pattern เดียวกันกับที่ใช้ในหน้า ProjectDetail (`StatCards` component) และ SalesDetailPage — สร้างความสอดคล้องของ Visual Language ทั่วทั้งระบบ, ใช้ semantic color tokens (`text-warning`, `text-success`, `text-info`, `text-destructive`) แทน hardcoded colors

**Grid:** `grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4` สำหรับ 4 cards

**Semantic color mapping:**
- รออนุมัติ (`review`) → `text-warning` / `bg-warning/10`
- อนุมัติแล้ว (`published`) → `text-success` / `bg-success/10`
- ขอแก้ไข (`revision`) → `text-info` / `bg-info/10`
- ปฏิเสธ (`rejected`) → `text-destructive` / `bg-destructive/10`

### 6. Sort dropdown
**Decision:** ใช้ `Select` component (shadcn-ui) ที่มีอยู่แล้วใน project

**Rationale:** Pattern เดียวกับ platform filter เดิม และใช้ component ที่มีอยู่แล้ว

### 7. Type filter
**Decision:** เพิ่ม Type Filter Dropdown ใช้ `Select` component (shadcn-ui) สำหรับกรองตาม `content_type` โดยมีตัวเลือก: ทั้งหมด, บทความ (`article`), วีดีโอ (`video`) — อ้างอิงจาก `TYPE_MAP` ใน `src/components/content/types.ts` และวางไว้หลังช่องค้นหาและด้านหน้าของ Platform Filter ใน toolbar

**Rationale:** ผู้ใช้ต้องการกรองตามประเภทคอนเทนต์เพื่อจัดการรายการอนุมัติได้มีประสิทธิภาพมากขึ้น โดยเฉพาะเมื่อมีทั้งบทความและวีดีโอปะปนกันในรายการเดียวกัน — ลำดับ toolbar: Search → Type → Platform → Sort (ช่องค้นหาอยู่หน้าสุดเพื่อให้เข้าถึงได้เร็วที่สุด)

**Options source:** ใช้ `TYPE_MAP` keys ที่มีข้อมูลจริงในรายการ (คล้ายวิธี `usedPlatforms` ของ Platform Filter) เพื่อแสดงเฉพาะประเภทที่มีรายการอยู่จริง

### 8. Search input icon
**Decision:** ใช้ไอคอน `Search` (แว่นขยาย) จาก `lucide-react` สำหรับช่องค้นหาใน toolbar แทน `FileText` เดิม เพื่อสื่อความหมายของการค้นหาได้ชัดเจนขึ้น

**Rationale:** `Search` เป็นไอคอนมาตรฐานสากลสำหรับการค้นหา (magnifying glass) — ผู้ใช้เข้าใจได้ทันทีว่าเป็นช่องค้นหาโดยไม่ต้องอ่าน label, สอดคล้องกับ pattern ทั่วไปของ web applications

**Icon specs:** `Search` จาก lucide-react, ขนาด `h-4 w-4 text-muted-foreground`, ตำแหน่ง `absolute left-2.5 top-1/2 -translate-y-1/2` ภายใน `Input` ที่มี `pl-8`

## Risks / Trade-offs

- **Client-side filtering อาจช้าถ้าข้อมูลโตมาก** → ปัจจุบันข้อมูลต่อ tenant < 200 items; เพิ่ม server-side filtering ภายหลังได้ง่ายโดยเพิ่ม query params ใน API
- **การเพิ่ม status `rejected` ต้อง sync กับ logic อื่นที่อาจอ้างอิง `draft`** → ตรวจสอบว่าไม่มี code อื่นใน project ที่ assume ว่าการ reject เปลี่ยนเป็น `draft` เสมอ
- **ต้องเพิ่ม `rejected` ใน `STATUS_MAP`** → แก้ไขไฟล์ `types.ts` ซึ่งเป็น shared types — ตรวจสอบว่าไม่กระทบหน้า `ContentDashboardPage` หรือ component อื่นที่ใช้ `STATUS_MAP`
- **Migration ต้องรันกับฐานข้อมูลจริง** → MariaDB ENUM ALTER จะ lock table ชั่วคราว; ควรทำนอก peak hours สำหรับ production
- **Type Filter ใช้ `content_type` field** → ต้องตรวจสอบว่าข้อมูล `content_type` มีความถูกต้องและสอดคล้องกับ `TYPE_MAP` ทั้งหมด; items ที่ไม่มี `content_type` จะถูกนับเป็น "ทั้งหมด" และไม่ปรากฏเมื่อเลือก filter เฉพาะประเภท
- **Stat Cards เปลี่ยน Visual Style** → ต้องตรวจสอบว่า `stat-card` และ `card-hover` CSS classes พร้อมใช้งานจาก `src/index.css`; ใช้ semantic tokens (`text-warning`, `text-success`, `text-info`, `text-destructive`) ที่มีใน theme

## Migration Plan

1. สร้าง migration file และ execute กับ local DB
2. Verify ด้วย `SHOW COLUMNS FROM content_items`
3. Deploy code change พร้อม migration
4. Rollback: ถ้าต้อง rollback code, ENUM ที่เพิ่มไว้ไม่มีผลเสีย — ค่า `'rejected'` จะไม่ถูกใช้ถ้า code เก่าไม่ insert
