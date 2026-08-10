## Why

เมนู "การตลาด" ปัจจุบันมีรายการแบนราบ 5 รายการ โดย "คอนเทนต์โซเชียล" และ "ปฏิทินคอนเทนต์" ถูกแยกออกจากกันทั้งที่เกี่ยวข้องกันโดยตรง — ทำให้ผู้ใช้ต้องนำทางไปมาระหว่างหน้าเพื่อทำงานที่ต่อเนื่องกัน การจัดกลุ่มใหม่แบบมีลำดับชั้นจะทำให้ UX ดีขึ้น และเพิ่มหน้า "รายการอนุมัติ" ที่จำเป็นต่อ workflow การผลิตคอนเทนต์

## What Changes

- **Sidebar Menu**: ปรับโครงสร้างเมนู "การตลาด" ให้ "คอนเทนต์โซเชียล" เป็นกลุ่มย่อย (sub-group) ที่มี 4 รายการย่อยเรียงติดกัน:
  - "แดชบอร์ด" (หน้าใหม่ ออกแบบตาม mockup `mockup/pages/content/`)
  - "ผลงานคอนเทนต์" (ใช้หน้า ContentPage เดิม)
  - "รายการอนุมัติ" (หน้าใหม่ ออกแบบตาม mockup `mockup/pages/content/`)
  - "ปฏิทินคอนเทนต์" (ใช้หน้า ContentPlannerPage เดิม)
- **Sidebar Component**: เพิ่มความสามารถรองรับเมนู 3 ระดับ (group → sub-group → item) ใน `CollapsibleGroup`
- **หน้าใหม่**: `ContentDashboardPage` และ `ContentApprovalPage` — หน้าแดชบอร์ดและรายการอนุมัติคอนเทนต์ ออกแบบตาม mockup `mockup/pages/content/`
- **Routing**: เพิ่ม route `/content-approval` ใน `App.tsx`
- **Menu Key**: เพิ่ม `content_approval` ใน `ALL_MENU_KEYS` (auth.php)
- **การทำงานของระบบต้องเหมือนเดิมทุกอย่าง** — หน้าเดิมและ API เดิมไม่มีการเปลี่ยนแปลง logic

## Capabilities

### New Capabilities
- `content-approval-list`: หน้ารายการอนุมัติคอนเทนต์สำหรับดู อนุมัติ/ปฏิเสธ content items ตาม workflow
- `sidebar-nested-menu`: รองรับเมนู sidebar แบบ 3 ระดับ (กลุ่ม → กลุ่มย่อย → รายการ)

### Modified Capabilities
<!-- ไม่มี existing specs ที่ต้องแก้ requirement -->

## Impact

- **Frontend (`src/components/AppSidebar.tsx`)**: แก้ไข `NavItem` interface เพิ่ม `children?: NavItem[]`, ปรับ `CollapsibleGroup` ให้ render nested sub-groups
- **Frontend (`src/App.tsx`)**: เพิ่ม lazy import และ route สำหรับ `/content-approval`
- **Frontend (`src/pages/ContentApprovalPage.tsx`)**: หน้าใหม่ — รายการอนุมัติ ดีไซน์อิงจาก mockup
- **Backend (`api/auth.php`)**: เพิ่ม `content_approval` ใน `ALL_MENU_KEYS`
