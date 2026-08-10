## Context

ปัจจุบัน `AppSidebar.tsx` รองรับเมนู 2 ระดับ (Group → Items) ผ่าน `NavGroup` และ `CollapsibleGroup` component การเปลี่ยนแปลงนี้ต้องการเพิ่ม level ที่ 3 (Group → SubGroup → Items) สำหรับเมนูการตลาดเท่านั้น โดยไม่กระทบโครงสร้างเมนูกลุ่มอื่น

Mockup (`mockup/pages/content/`) มีระบบจัดการเนื้อหาที่สมบูรณ์ด้วย PHP + Alpine.js — ประกอบด้วย:
- `list.php`: หน้ารายการเนื้อหาทั้งหมด พร้อมตาราง, filter, preview modal, version history, approval history
- `calendar.php`: ปฏิทินเนื้อหาแบบ drag-drop
- `editor.php`: โปรแกรมแก้ไขเนื้อหา (Summernote WYSIWYG)
- `approval_history_handler.php`: API ดึงประวัติการอนุมัติ

หน้า "รายการอนุมัติ" ใหม่จะอิงดีไซน์จาก mockup list.php (ตาราง + filter + modal) แต่ใช้ React + shadcn-ui ตามมาตรฐานของ Flowstack

## Goals / Non-Goals

**Goals:**
- รองรับเมนู sidebar แบบมี children (nested items) เฉพาะกลุ่มการตลาด โดยไม่กระทบกลุ่มอื่น
- สร้างหน้าใหม่ `ContentDashboardPage` (`/content-dashboard`) และ `ContentApprovalPage` (`/content-approval`) ออกแบบตาม mockup `mockup/pages/content/`
- จัดกลุ่ม "แดชบอร์ด", "ผลงานคอนเทนต์", "รายการอนุมัติ", "ปฏิทินคอนเทนต์" เป็น 4 รายการเรียงติดกันใต้ "คอนเทนต์โซเชียล"
- ใช้หน้าเดิม (`ContentPage`, `ContentPlannerPage`) สำหรับหน้าที่มีอยู่แล้ว ไม่สร้างใหม่
- การทำงานของระบบทั้งหมดต้องเหมือนเดิม — เปลี่ยนเฉพาะ sidebar structure และเพิ่มหน้าใหม่

**Non-Goals:**
- ไม่เปลี่ยน logic ของ `ContentPage` หรือ `ContentPlannerPage`
- ไม่เปลี่ยน API endpoints
- ไม่เปลี่ยน database schema
- ไม่เพิ่ม nested menu ในกลุ่มอื่น (projects, crm, support, impactos, admin)
- ไม่ redesign ระบบ approval workflow — ใช้ structure ที่มีในระบบเดิม

## Decisions

### 1. Sidebar: ใช้ `children` property บน `NavItem` สำหรับ nested items

**เลือก**: เพิ่ม `children?: NavItem[]` ให้ `NavItem` interface (recursive type) — `CollapsibleGroup` render `NavItem` ที่มี children เป็น sub-group แบบ collapsible ได้ โดย "คอนเทนต์โซเชียล" มี children แบน 4 รายการ

**เหตุผล**: 
- Minimal change — ไม่ต้องแก้ `NavGroup` structure หรือ logic กลุ่มอื่น
- ใช้ recursive component pattern ที่ React รองรับดีอยู่แล้ว
- ถ้าอนาคตต้องการ nested menu ในกลุ่มอื่นก็ใช้ pattern เดิมได้

**Alternative considered**: เพิ่ม `subGroups?: NavGroup[]` ใน `NavGroup` — ซับซ้อนเกินไปสำหรับ use case เดียว

### 2. หน้า "แดชบอร์ด" และ "รายการอนุมัติ": สร้างใหม่ตาม mockup

**เลือก**: สร้าง `ContentDashboardPage` (`/content-dashboard`) และ `ContentApprovalPage` (`/content-approval`) โดยใช้ `PageShell` + shadcn-ui components ตามมาตรฐาน project — ดีไซน์และโครงสร้างอิงจาก mockup `mockup/pages/content/` (list.php ตาราง+filter, calendar.php ปฏิทิน, approval_history_handler.php)

**เหตุผล**:
- แยก concern ชัดเจน — แดชบอร์ด, ผลงานคอนเทนต์, รายการอนุมัติ, ปฏิทิน แยกจากกัน
- mockup มี UI ที่ออกแบบไว้แล้ว — นำมาใช้เป็น reference สำหรับ layout, filter, ตาราง, และ workflow
- ใช้ API endpoints เดิม (`api/content-items.php`, `api/approvals.php`) ไม่ต้องสร้าง API ใหม่

### 3. Menu Key: ใช้ `content_approval` แยกจาก `marketing`

**เลือก**: เพิ่ม `content_approval` ใน `ALL_MENU_KEYS` และใช้ใน `PermissionRoute`

**เหตุผล**: ให้ granular permission control — admin สามารถให้สิทธิ์เข้าถึงรายการอนุมัติแยกจากเมนูการตลาดอื่นได้

## Risks / Trade-offs

- **[Risk] Sidebar children rendering อาจมี performance issue ถ้าข้อมูลเยอะ** → Mitigation: items รวมในกลุ่มการตลาดมีไม่เกิน 10 รายการ — negligible
- **[Risk] `content_approval` menuKey ใหม่ต้อง migrate ให้ role ที่มี `marketing` permission** → Mitigation: เพิ่ม `content_approval` ใน script migration และอัปเดต default permissions
- **[Risk] หน้า approval ใหม่ต้องใช้ API ที่มีอยู่ อาจมี field ไม่ตรง** → Mitigation: ตรวจสอบ response schema ก่อน implement; ถ้าข้อมูลไม่พอ ให้เพิ่ม endpoint parameter

## Migration Plan

1. Deploy พร้อมกันทั้งหมด (sidebar + route + หน้าใหม่)
2. ไม่ต้องมี database migration — ใช้ API และ tables เดิม
3. Rollback: revert commit — ไม่มี data change
