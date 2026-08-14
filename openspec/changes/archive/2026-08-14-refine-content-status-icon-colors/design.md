## Context

`STATUS_MAP` ใน `src/components/content/types.ts` เป็น single source of truth ของไอคอน/สีสถานะ:

```ts
export const STATUS_MAP: Record<string, { label: string; color: string; icon: React.ElementType; iconColor: string }> = {
  published:        { label: 'เผยแพร่แล้ว', color: 'bg-green-100 text-green-700 ...', icon: CheckCircle2, iconColor: 'text-green-600' },
  draft:            { label: 'ฉบับร่าง',    color: 'bg-gray-100 ...',              icon: Edit3,        iconColor: 'text-gray-600' },
  revision:         { label: 'รอแก้ไข',     color: 'bg-blue-100 ...',              icon: RotateCcw,    iconColor: 'text-blue-600' },
  pending_approval: { label: 'รออนุมัติ',   color: 'bg-amber-100 ...',             icon: Clock,        iconColor: 'text-amber-600' },
  approved:         { label: 'อนุมัติแล้ว', color: 'bg-green-100 ...',             icon: BadgeCheck,   iconColor: 'text-green-600' }, // ← เขียวซ้ำกับ published
  rejected:         { label: 'ปฏิเสธ',      color: 'bg-red-100 ...',               icon: XCircle,      iconColor: 'text-red-600' },
};
```

ปัญหาหลัก: `approved` (BadgeCheck) กับ `published` (CheckCircle2) เป็น "เครื่องหมายถูกสีเขียว" ทั้งคู่ มองแยกไม่ออก

ปัจจุบันหน้า Home (`HomePage.tsx`) ใช้รูปแบบ Progress Bar มาตรฐาน: `h-1.5` + แถบสีผ่าน `[&>div]:bg-{color}` + ตัวเลขเปอร์เซ็นต์ใช้สีสถานะ (เช่น `text-green-600` / `text-orange-500`) ส่วน Work Progress ในแดชบอร์ดคอนเทนต์ยังใช้ `<Progress className="h-2" />` สี default เดียวกันหมด

## Goals / Non-Goals

**Goals:**
- ทำให้ `approved` แยกจาก `published` ได้ชัดเจน (ไอคอน + สีต่างกัน)
- ปรับ Status Card ให้ใช้รูปแบบ `stat-card card-hover` เดียวกับ Status Card ในหน้าโปรเจกต์ และจัดวางหัวข้อซ้าย/ไอคอนขวา/จำนวนล่าง
- ทำให้ Work Progress ใช้สีประจำสถานะ (สีเดียวกับ Status Card หรือ Icon จากแหล่งเดียว) และใช้รูปแบบ Progress Bar มาตรฐานเดียวกับ Home

**Non-Goals:**
- ไม่เปลี่ยน label, จำนวน, หรือ logic การคำนวณ
- ไม่แตะ API / DB / hooks
- ไม่เปลี่ยนไอคอน/สีของสถานะอื่น (published, draft, revision, pending_approval, rejected)

## Decisions

**1. สีและไอคอนของ `approved` → `Stamp` + teal**
- ไอคอน: `BadgeCheck` → `Stamp` (ตราประทับ "อนุมัติ") — รูปร่างต่างจาก `CheckCircle2` (วงกลมถูก) อย่างชัดเจน
- สี: เขียว → teal (`iconColor: 'text-teal-600'`, badge `bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300`)
- เหตุผล: teal ต่างจากเขียว (published) และน้ำเงิน (revision) ไม่ชนกับ amber/gray/red เดิม
- ทางเลือกที่พิจารณา: น้ำเงิน (ตาม spec `content-approved-status` เดิม) → ปัดตก เพราะชนกับ `revision` ที่น้ำเงินอยู่แล้ว

**2. เพิ่ม field `progressColor` ใน `STATUS_MAP` (สีเดียวกับ Status Card/Icon)**
- เพิ่ม `progressColor` (solid fill) สำหรับแถบ Progress โดยเก็บ literal class เต็ม `[&>div]:bg-{color}-600` เดียวกับ `iconColor`: published=`[&>div]:bg-green-600`, draft=`[&>div]:bg-gray-600`, revision=`[&>div]:bg-blue-600`, pending_approval=`[&>div]:bg-amber-600`, approved=`[&>div]:bg-teal-600`, rejected=`[&>div]:bg-red-600`
- หลักการ: `progressColor` ใช้สีเดียวกับ Status Card ของสถานะนั้น; หากสถานะไม่มี Status Card (เช่น approved, revision) ให้ใช้สีเดียวกับ Icon (`iconColor`) — ทั้งคู่อิงจากแหล่งเดียวคือ `STATUS_MAP.iconColor`
- ต้องเป็น literal string ใน source (รวม child selector `[&>div]:`) เพื่อให้ Tailwind JIT ตรวจจับ class ได้ — ห้ามต่อ string แบบ dynamic (เช่น `[&>div]:${...}`) เพราะ Tailwind จะมองไม่เห็น class เต็มและไม่ generate CSS

**3. Status Card ใช้รูปแบบ `stat-card card-hover` เดียวกับหน้าโปรเจกต์ + จัดวางหัวข้อซ้าย/ไอคอนขวา/จำนวนล่าง**
- ใช้ `div.stat-card.card-hover` (ตกแต่ง `p-5 rounded-xl border bg-card` + hover shadow) pattern เดียวกับ `src/components/StatCards.tsx` ในหน้าโปรเจกต์
- จัดวางองค์ประกอบภายใน: หัวข้อ (label) อยู่ด้านซ้าย, ไอคอนอยู่ด้านขวา (แถวเดียวกัน), จำนวนอยู่ด้านล่าง — คง layout นี้เพื่อความสอดคล้องกับ UI ของระบบ
- สีกรอบ/ไอคอนของแต่ละ card ยังคงตรงกับสถานะ (สืบเนื่องจาก `border-{color}` เดิม)

**4. Work Progress ใช้รูปแบบมาตรฐาน Flowstack + สีเดียวกับ Status Card/Icon**
- เปลี่ยน `<Progress value={percent} className="h-2" />` เป็น `<Progress value={percent} className={`h-1.5 ${info.progressColor}`} />` (progressColor มี `[&>div]:` รวมอยู่แล้ว)
- ตัวเลข `{count} ชิ้น ({percent}%)` เปลี่ยนเป็นสีสถานะ `info.iconColor` (label ยังเป็น `text-muted-foreground` เหมือน Home)
- สีแถบ (`progressColor`) ใช้สีเดียวกับ Status Card ของสถานะนั้น; สถานะที่ไม่มี Status Card (approved, revision) ใช้สีเดียวกับ Icon (`iconColor`) — ทั้งหมดอิงจากแหล่งเดียวคือ `STATUS_MAP.iconColor`

**5. Hardcode `BadgeCheck` → `Stamp` ให้ตรง source of truth**
- `ContentApprovalTab.tsx` statCards: `icon: BadgeCheck, color: 'text-success'` → `icon: Stamp, color: 'text-teal-600'`
- `ContentListTab.tsx` filter tab: `<BadgeCheck .../>รอเผยแพร่` → `<Stamp .../>รอเผยแพร่`
- อัปเดต import: ลบ `BadgeCheck` (ถ้าไม่ใช้ที่อื่น) เพิ่ม `Stamp`

## Risks / Trade-offs

- [teal ต่างจาก convention `approved=blue` ใน `content-approved-status`] → เป็นการแก้ drift ที่ spec กับ code ไม่ตรงกันอยู่แล้ว และ teal ชัดกว่า blue (ไม่ชน revision); อัปเดต spec ตาม
- [กรอบ `-600` อาจดูเข้ม] → ยอมรับตาม requirement; ปรับ shade เป็นการ tweak เล็กในภายหลังได้
- [การเพิ่ม field ใน STATUS_MAP กระทบ type] → ต้องอัปเดต type declaration พร้อมกัน; ไม่มี consumer อื่นที่พังเพราะ field ใหม่เป็น additive

## Migration Plan

- เปลี่ยน frontend เท่านั้น ไม่มี DB/API migration
- Rollback: revert `STATUS_MAP` (approved กลับเป็น BadgeCheck/เขียว) และ revert markup ของ Stat Card / Work Progress
