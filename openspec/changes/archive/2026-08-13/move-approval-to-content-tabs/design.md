## Context

หน้าผลงานคอนเทนต์ (`ContentPage`, route `/content`, menuKey `marketing`) มี Tab Menu 4 แท็บ: ผลงานทั้งหมด (`content`), กำหนดการโพสต์ (`schedule`), Skills & Triggers (`skills`), ตั้งค่า AI (`settings`) — TabsList ใช้ `sm:grid sm:grid-cols-4` รายการอนุมัติ (`ContentApprovalPage`, route `/content-approval`, menuKey `content_approval`) เป็นหน้าแยกที่ render ผ่าน `PageShell` ของตัวเอง (breadcrumb "การตลาด > คอนเทนต์โซเชียล > รายการอนุมัติ", title "รายการอนุมัติ") และมีรายการเมนูใน Sidebar ฝั่งการตลาด

## Goals / Non-Goals

**Goals:**
- ย้าย "รายการอนุมัติ" จาก Sidebar มาเป็น Tab ในหน้าผลงานคอนเทนต์
- วาง Tab "รายการอนุมัติ" ถัดจาก Tab "ผลงานทั้งหมด" ทันที
- แยกเนื้อหารายการอนุมัติเป็นคอมโพเนนต์ที่ใช้ร่วมกันได้ (ไม่ render PageShell ซ้ำ)

**Non-Goals:**
- ไม่เปลี่ยน logic การอนุมัติ/ปฏิเสธ/ขอแก้ไข
- ไม่เปลี่ยน sort/filter ภายในรายการอนุมัติ
- ไม่เปลี่ยน route `/content-approval` (คงไว้เพื่อ direct link; ใช้คอมโพเนนต์ร่วม)
- ไม่เปลี่ยน permission model ของ `content_approval` (ดู Open Questions)

## Decisions

### ข้อที่ 1: แยกเนื้อหาออกเป็น `ContentApprovalTab`

**เลือก**: สร้าง `src/components/content/tabs/ContentApprovalTab.tsx` ที่รวม stat cards + toolbar + ตาราง + dialogs (เนื้อหาทั้งหมดของ `ContentApprovalPage` ปัจจุบัน ยกเว้น `PageShell`)

**ทางเลือกที่พิจารณา:**
- ฝัง `ContentApprovalPage` ตรง ๆ ใน Tab — จะ render `PageShell` ซ้อนกัน (title/breadcrumb ซ้ำ) ไม่ถูกต้อง
- ใช้ prop `embedded` เพื่อ conditionally ข้าม PageShell — เพิ่มความซับซ้อนให้ component หน้าเดียว

**เหตุผล**: แยกเป็น tab component สอดคล้องกับ pattern ที่มีอยู่ (`ContentListTab`, `SkillsTriggerTab`, `AISettingsTab`, `ScheduleOverviewPanel`)

### ข้อที่ 2: คง route `/content-approval` ไว้

**เลือก**: `ContentApprovalPage` ยังคงเป็น route โดย render `<PageShell>...</PageShell>` ห่อ `<ContentApprovalTab />`

**ทางเลือกที่พิจารณา:**
- ลบ route `/content-approval` ทั้งหมด — กระทบ deep link/บุ๊กมาร์กและ `App.tsx`

**เหตุผล**: ลดผลกระทบ; route เดิมยังทำงานได้โดยใช้คอมโพเนนต์ร่วม

### ข้อที่ 3: ตำแหน่ง Tab "รายการอนุมัติ" อยู่ลำดับที่ 2

**เลือก**: ใส่ `<TabsTrigger value="approval">` หลัง `<TabsTrigger value="content">` (ผลงานทั้งหมด) ทันที และ `<TabsContent value="approval"><ContentApprovalTab /></TabsContent>` หลัง content

**เหตุผล**: ตรงตามข้อกำหนด "ถัดจาก Tab ผลงานทั้งหมด ทันที"

### ข้อที่ 4: ปรับ grid เป็น 5 คอลัมน์

**เลือก**: เปลี่ยน `sm:grid-cols-4` → `sm:grid-cols-5` และ icon สำหรับ tab ใหม่เป็น `ClipboardCheck`

**เหตุผล**: รองรับ tab ที่ 5

## Risks / Trade-offs

- **ความเสี่ยง**: Tab "รายการอนุมัติ" ปรากฏกับผู้ใช้ทุกคนที่มีสิทธิ์ `marketing` (เดิม sidebar item ถูกกรองด้วย `content_approval`) → **การลดความเสี่ยง**: ดู Open Questions; หากต้องรักษา gating ให้ใช้ `hasPermission('content_approval')` ในการ conditionally render tab
- **ความเสี่ยง**: `PageShell` ของ ContentPage ยังแสดง title "ผลงานคอนเทนต์" แม้อยู่ใน tab อนุมัติ → **การลดความเสี่ยง**: ยอมรับได้ (tab content มี header ตัวเอง); ไม่เพิ่ม title แยก
- **ความเสี่ยง**: ใช้ `ContentApprovalPage` ที่ route เดิมหลุด import → **การลดความเสี่ยง**: refactor ให้ route ใช้ `ContentApprovalTab`

## Migration Plan

1. สร้าง `ContentApprovalTab.tsx` (ย้ายเนื้อหาจาก `ContentApprovalPage`)
2. Refactor `ContentApprovalPage.tsx` ให้ใช้ `ContentApprovalTab`
3. เพิ่ม tab ใน `ContentPage.tsx` + ปรับ grid
4. ลบเมนู Sidebar
5. รัน `pnpm build` + `pnpm lint` + `pnpm test`

**Rollback**: git revert (ไม่มีการเปลี่ยน schema/API)

## Open Questions

- ควรกรอง Tab "รายการอนุมัติ" ให้เห็นเฉพาะผู้ใช้ที่มีสิทธิ์ `content_approval` หรือไม่? (ปัจจุบัน Sidebar item ถูกซ่อนสำหรับผู้ใช้ที่ไม่มีสิทธิ์นี้ — ถ้าย้ายเป็น tab ใน route `marketing` แล้วผู้ใช้ที่ไม่มีสิทธิ์จะเห็น tab)
