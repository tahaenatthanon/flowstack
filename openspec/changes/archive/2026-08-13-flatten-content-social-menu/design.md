## Context

`src/components/AppSidebar.tsx` กลุ่ม `marketing` ปัจจุบันใช้โครงสร้าง 3 ระดับ: item "คอนเทนต์โซเชียล" มี `children` (แดชบอร์ด, ผลงานคอนเทนต์, ปฏิทินคอนเทนต์) ซึ่ง `NestedNavItem`/`CollapsibleGroup` ใช้ render เป็น sub-group แบบยุบ-ขยายได้

เป้าหมายคือ flatten รายการคอนเทนต์ให้เป็นเมนูหลักแบบแบนราบ (2 ระดับ: Group → Items) เหมือนกลุ่มอื่น ๆ ใน sidebar โดยให้รายการ `/content` ใช้ชื่อเมนู "คอนเทนต์โซเชียล" มาอยู่ตำแหน่งเดิม (หลัง "แคมเปญอีเมล")

โครงสร้างปัจจุบัน (กลุ่ม marketing):
```
แคมเปญอีเมล (/marketing)
คอนเทนต์โซเชียล (children: แดชบอร์ด, ผลงานคอนเทนต์, ปฏิทินคอนเทนต์)
วิเคราะห์แคมเปญ (/campaign-analytics)
สตูดิโอสื่อ (/media-studio)
```

## Goals / Non-Goals

**Goals:**
- ย้ายรายการคอนเทนต์ (แดชบอร์ด, ผลงานคอนเทนต์, ปฏิทินคอนเทนต์) ออกมาเป็นเมนูหลักแบบแบนราบในกลุ่ม "การตลาด"
- ให้ "คอนเทนต์โซเชียล" (`/content`) อยู่ในตำแหน่งหลัง "แคมเปญอีเมล"
- ให้ "แดชบอร์ดคอนเทนต์" อยู่เป็นรายการแรกสุด (บนสุด) ของกลุ่มการตลาด เพื่อให้เข้าถึงภาพรวมได้ง่าย
- คง `menuKey` เดิม (`marketing` / `media_studio`) และรูปแบบ UI ตาม Design System เดิม

**Non-Goals:**
- ไม่ลบ `NestedNavItem` component หรือ `children?: NavItem[]` ใน `NavItem` (คงไว้ — อาจใช้ในอนาคต)
- ไม่เพิ่ม/แก้ไขเมนู "รายการอนุมัติ" (`/content-approval`) — นอกขอบเขตของ request นี้
- ไม่แก้ route, API, database, permission หรือ breadcrumb ของหน้า content ต่าง ๆ
- ไม่เปลี่ยนกลุ่มเมนูอื่น (จัดการโปรเจค, การขายและ CRM, สนับสนุน, ImpactOS, การจัดการระบบ)

## Decisions

### 1. ลำดับรายการ: "แดชบอร์ดคอนเทนต์" อยู่บนสุด ตามด้วยรายการอื่น

**เลือก**: จัดเรียงกลุ่ม marketing เป็น:
```
แดชบอร์ดคอนเทนต์ (/content-dashboard)
แคมเปญอีเมล (/marketing)
คอนเทนต์โซเชียล (/content)
ปฏิทินคอนเทนต์ (/content-planner)
วิเคราะห์แคมเปญ
สตูดิโอสื่อ
```

**เหตุผล**: ตรงตาม request "ปรับลำดับเมนูให้ Dashboard อยู่เหนือเมนูอื่นทั้งหมด" — แดชบอร์ดคอนเทนต์เป็นจุดเข้าภาพรวมของระบบ จึงวางบนสุด ส่วน "คอนเทนต์โซเชียล" (`/content`) ตามหลัง "แคมเปญอีเมล" และ "ปฏิทินคอนเทนต์" ตามหลัง

**Alternative considered**: วาง "ผลงานคอนเทนต์" ไว้บนสุด (ตามลำดับเดิมก่อนหน้า) — ขัดกับข้อกำหนดใหม่ที่ให้ Dashboard อยู่เหนือเมนูอื่นทั้งหมด

### 2. คง `menuKey: 'marketing'` สำหรับรายการคอนเทนต์

**เลือก**: คง `menuKey` เดิมทั้งหมด (รายการคอนเทนต์ใช้ `marketing`, สตูดิโอสื่อใช้ `media_studio`)

**เหตุผล**: ไม่มีการเปลี่ยน permission — เป็นเพียงการจัดเรียงเมนู ไม่ใช่การเปลี่ยนสิทธิ์การเข้าถึง

### 3. คง `children`/`NestedNavItem` ไว้ ไม่ลบ

**เลือก**: เก็บ `children?: NavItem[]` และ `NestedNavItem` ไว้ใน `AppSidebar.tsx` แม้จะไม่มีกลุ่มใดใช้งานแล้ว

**เหตุผล**: Minimal change — ลดความเสี่ยง และโครงสร้าง recursive อาจนำกลับมาใช้กับกลุ่มอื่นในอนาคต

**Alternative considered**: ลบ dead code (`NestedNavItem`, `children` field, import ที่ไม่ใช้) — นอกขอบเขต request และเสี่ยงกระทบส่วนอื่น

### 4. ไอคอนและ Design System คงเดิม

**เลือก**: ใช้ไอคอน lucide-react เดิม — คอนเทนต์โซเชียล `PenTool`, แดชบอร์ด `LayoutDashboard`, ปฏิทินคอนเทนต์ `CalendarDays` (นำเข้าอยู่แล้วในไฟล์)

**เหตุผล**: ตรงตาม theme-and-structure-guidelines — ไม่สร้าง UI ใหม่ ไม่เพิ่ม import ใหม่

## Risks / Trade-offs

- **[Risk] `NestedNavItem`/`children` กลายเป็น dead code** → Mitigation: คงไว้อย่างตั้งใจ (documented ใน Non-Goals); ถ้าต้องการลบให้ทำเป็น change แยก
- **[Risk] ผู้ใช้ที่คุ้นเคยกับการคลิก "คอนเทนต์โซเชียล" อาจต้องปรับตัว** → Mitigation: รายการคอนเทนต์ทั้งหมดเห็นทันทีเมื่อขยายกลุ่มการตลาด (เข้าถึงง่ายขึ้น 1 คลิก)
- **[Risk] ลำดับเมนูยาวขึ้น (6 รายการในกลุ่มเดียว)** → Mitigation: ยังอยู่ในเกณฑ์ปกติเทียบกับกลุ่ม "จัดการโปรเจค" (7 รายการ) และ "การขายและ CRM" (6 รายการ)

## Migration Plan

1. Deploy ไฟล์ `src/components/AppSidebar.tsx` เพียงไฟล์เดียว
2. ไม่ต้องมี database migration — ไม่แตะ API/permission
3. Rollback: revert commit — ไม่มี data change

## Open Questions

- _(ไม่มี — scope ชัดเจน)_
