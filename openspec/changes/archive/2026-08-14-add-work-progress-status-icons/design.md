## Context

ส่วน "ความคืบหน้าการผลิต" ใน `ContentDashboardPage.tsx` render แต่ละสถานะดังนี้:

```tsx
<div className="flex items-center justify-between mb-1.5">
  <span className="text-sm text-muted-foreground">{info.label}</span>
  <span className="text-sm font-medium">{count} ชิ้น ({percent}%)</span>
</div>
```

โดย `info = STATUS_MAP[statusKey]` ปัจจุบันมีแค่ `{ label, color }` (ยังไม่มี `icon`)

ไอคอนสถานะที่ใช้อยู่แล้วในระบบ:
- `ContentListTab.tsx` (status tabs): draft → `Edit3`, revision → `RotateCcw`, approved → `Clock`, published → `CheckCircle2`
- `ContentApprovalTab.tsx` (stat cards): approved → `CheckCircle2`, pending_approval → `Clock`, revision → `AlertTriangle`, rejected → `XCircle`

## Goals / Non-Goals

**Goals:**
- เพิ่มไอคอน semantic หน้า label ของแต่ละสถานะใน Work Progress (5 สถานะ)
- ใช้ไอคอน/สีที่สอดคล้องกับที่ใช้อยู่แล้วในระบบ

**Non-Goals:**
- ไม่เปลี่ยนการคำนวณ count/percent, progress bar, ยอดรวม
- ไม่เปลี่ยน label, สี progress bar, หรือ layout ของ widget
- ไม่แตะส่วนอื่นของหน้า

## Decisions

**1. เพิ่ม field `icon` ให้กับ `STATUS_MAP` (single source of truth)**
- เปลี่ยน type เป็น `Record<string, { label: string; color: string; icon: LucideIcon }>`
- เติม icon ให้ครบทุกสถานะใน STATUS_MAP เพื่อให้ใช้งานได้ทั่วไป (ไม่ใช่แค่ Work Progress)
- ทางเลือกที่พิจารณา: สร้าง local map ใน `ContentDashboardPage.tsx` → ปัดตก เพราะ STATUS_MAP เป็น single source of truth ของสถานะอยู่แล้ว และทำให้ icon ใช้ซ้ำได้ทั้งระบบ

**2. การเลือกไอคอน (คง semantic เดิมให้สอดคล้องกับ Status tabs / stat cards)**
| status | icon | สี (text) |
|---|---|---|
| published | `CheckCircle2` | text-green-600 |
| pending_approval | `Clock` | text-amber-600 |
| approved | `BadgeCheck` | text-green-600 |
| revision | `RotateCcw` | text-blue-600 |
| draft | `Edit3` | text-gray-600 |
| rejected | `XCircle` | text-red-600 |

- `approved` ใช้ `BadgeCheck` เพื่อแยกจาก `published` (`CheckCircle2`) เพราะทั้งคู่เป็นสีเขียว
- `revision` ใช้ `RotateCcw` ตาม Status tabs (แทน `AlertTriangle` ที่ใช้ใน stat cards) เพราะเป็นค่าเดียวกันกับ `STATUS_MAP.label` "รอแก้ไข"
- สี text ใช้ token `text-{color}-600` สอดคล้องกับ Stat Cards ที่ใช้ text color ล้วน

**3. การ render icon**
- เปลี่ยน span label เป็น flex container: `<span className="flex items-center gap-1.5 text-sm text-muted-foreground"><Icon className="h-3.5 w-3.5 {iconColor}" />{info.label}</span>`
- ขนาด icon `h-3.5 w-3.5` สอดคล้องกับ Status tabs (ซึ่งใช้ `h-3.5 w-3.5`)
- สี icon ใช้ text color ที่กำหนดแยกจาก `STATUS_MAP.color` (ซึ่งเป็น bg-badge color) — เพิ่ม field `iconColor` ให้ STATUS_MAP หรือใช้ map เล็ก ๆ ในหน้า

**ตัดสินใจเพิ่มเติม:** เพิ่มทั้ง `icon` และ `iconColor` ใน STATUS_MAP เพื่อให้ได้ทั้ง icon และสี text อย่างชัดเจน (color เดิมเป็น bg-badge ไม่เหมาะกับ icon)

**4. ปรับไอคอนให้สอดคล้องกันทั้ง 3 หน้า (ยึด STATUS_MAP เป็นมาตรฐาน)**

ตาราง canonical mapping (จาก STATUS_MAP) และจุดที่ต้องปรับ:

| สถานะ | icon (canonical) | แดชบอร์ด (Stat Card) | ผลงาน (Status tabs) | รายการอนุมัติ (Stat Cards) |
|---|---|---|---|---|
| published | `CheckCircle2` | ✓ ตรงแล้ว | ✓ ตรงแล้ว | — |
| draft | `Edit3` | ✗ `AlertTriangle` → `Edit3` | ✓ ตรงแล้ว | — |
| revision | `RotateCcw` | — | ✓ ตรงแล้ว | ✗ `AlertTriangle` → `RotateCcw` |
| pending_approval | `Clock` | ✓ ตรงแล้ว | — | ✓ ตรงแล้ว |
| approved | `BadgeCheck` | — | ✗ `Clock` (label "รอเผยแพร่") → `BadgeCheck` | ✗ `CheckCircle2` → `BadgeCheck` |
| rejected | `XCircle` | — | — | ✓ ตรงแล้ว |

- **แดชบอร์ดคอนเทนต์** (`ContentDashboardPage.tsx` Stat Cards): "ฉบับร่าง" ใช้ `AlertTriangle` → เปลี่ยนเป็น `Edit3`
- **รายการอนุมัติ** (`ContentApprovalTab.tsx` Stat Cards): `revision` ใช้ `AlertTriangle` → `RotateCcw`; `approved` ใช้ `CheckCircle2` → `BadgeCheck`
- **ผลงานคอนเทนต์** (`ContentListTab.tsx` Status tabs): `draft`/`revision`/`published` ตรงแล้ว; tab `approved` (label "รอเผยแพร่") ใช้ `Clock` → เปลี่ยนเป็น `BadgeCheck` ตามสถานะ `approved`
- ทางเลือกที่พิจารณา: คง hardcode ไอคอนแยกตามหน้าไว้ไม่แตะ → ปัดตก เพราะผู้ใช้ต้องการความสอดคล้องข้ามหน้า และ STATUS_MAP กลายเป็น single source of truth แล้ว

**Open Question:** label ของ tab `approved` ใน `ContentListTab` คือ "รอเผยแพร่" ต่างจาก `STATUS_MAP.approved.label` ("อนุมัติแล้ว") — นี่เป็น label inconsistency เดิมที่อยู่นอกขอบเขตงานนี้ (งานนี้ปรับแค่ไอคอน) ควรพิจารณาแก้ label แยกในภายหลัง

## Risks / Trade-offs

- [เพิ่ม field ใน STATUS_MAP กระทบจุดอื่นที่ใช้ STATUS_MAP] → field ใหม่เป็น optional เพิ่มเติม ไม่เปลี่ยน `label`/`color` เดิม จึงไม่กระทบ badge ที่ใช้ `color` อยู่
- [Icon `BadgeCheck`/`XCircle` อาจต้อง import เพิ่ม] → import จาก lucide-react ใน `types.ts`

## Migration Plan

- เปลี่ยนเฉพาะ `types.ts` (เพิ่ม field + import) และ render ไอคอนใน `ContentDashboardPage.tsx`, `ContentApprovalTab.tsx`, `ContentListTab.tsx` — frontend เท่านั้น ไม่มี DB/API migration
- Rollback: ลบ `icon`/`iconColor` ออกจาก STATUS_MAP และ revert ไอคอนแต่ละหน้าเป็นค่าเดิม
