## 1. Backend สิทธิ์

- [x] 1.1 `api/auth.php`: เพิ่ม `userHasPermission($db, $userId, $tenantId, $menuKey): bool` (ใช้ `getUserPermissions()`, bypass ด้วย is_admin/superadmin — ยังใช้ที่อื่นทั่วไปได้ตามปกติ)
- [x] 1.2 `api/content-items.php` PUT: เก็บ `status` ที่ client ส่งมาก่อนบล็อก approval-sensitive
- [x] 1.3 `api/approvals.php` `action=decide`: บล็อกเมื่อ `entity_type = content_item`
- [x] 1.4 (D1.5 — เพิ่มทีหลัง) `api/auth.php`: เพิ่ม `userHasRolePermission($db, $userId, $tenantId, $menuKey): bool` แยกจาก 1.1 — อ่านเฉพาะ `tenant_users.role_id` → `role_menu_permissions` **ไม่เช็ค** `is_admin`/`is_superadmin`
- [x] 1.5 `api/content-items.php` และ `api/approvals.php`: เปลี่ยนจุดตรวจ `content_approval` ทั้งหมด (จากงาน 1.2/1.3) ให้เรียก `userHasRolePermission()` แทน `userHasPermission()`

## 2. ข้อมูลสิทธิ์

- [x] 2.1 migration `database/migrations/2026_09_24_090000_grant_content_approval_to_admin_manager.sql` รันบน DB local แล้ว — role admin/manager ทุก tenant ได้สิทธิ์ ส่วน staff/member ไม่ได้
- [x] 2.2 `api/auth/seed-defaults.php`: เพิ่ม `content_approval` ให้ role admin และ manager ของ tenant ใหม่

## 3. Frontend

- [x] 3.1 `src/pages/AdminPage.tsx`: เพิ่ม `{ key: 'content_approval', label: 'อนุมัติคอนเทนต์' }` ใน `ALL_MENUS`
- [x] 3.2 (แก้ทีหลังเป็น hasRolePermission — ดู 3.4) `src/pages/ContentPage.tsx`: ซ่อนแท็บ/ปรับ `validTabs`/ปรับ grid
- [x] 3.3 (D1.5) `api/auth/me.php`: เพิ่มฟิลด์ response `role_permissions: string[]` — menu key จาก `role_menu_permissions` ของ `role_id` ที่ผูกกับผู้ใช้ตรงๆ ไม่ bypass ด้วย `is_admin`/`is_superadmin` (กรณี superadmin impersonate ที่ `role_id=null` → `[]`)
- [x] 3.4 (D1.5) `src/hooks/useAuth.tsx`: เพิ่ม `role_permissions?: string[]` ใน `User` type และฟังก์ชันใหม่ `hasRolePermission(menuKey): boolean` (เช็คจาก `user.role_permissions` เท่านั้น ไม่ bypass) แล้วแก้ `src/pages/ContentPage.tsx` ให้ `canApprove = hasRolePermission('content_approval')` แทน `hasPermission(...)`

## 4. ทดสอบ

- [x] 4.1 PHP (DB local, `api/tests/content-approval-permission-test.php`) — ผลตอนที่ยังใช้ `userHasPermission()` (bypass):
  - member ส่ง `approved` → 403 และสถานะไม่เปลี่ยน
  - member ส่ง `revision` ให้คอนเทนต์ `pending_approval` → 403 และไม่มีแถวใหม่ใน `content_approval_rounds`
  - member ส่ง `pending_approval` → ไม่ได้ 403 เพราะสิทธิ์นี้
  - member แก้เนื้อหาคอนเทนต์ที่อนุมัติแล้วโดยไม่ส่ง status → บันทึกได้ และเป็น `revision`
  - manager (มีสิทธิ์) ส่ง `approved` → ผ่านด่านสิทธิ์
  - `approvals.php?action=decide` content_item โดย approver ที่ไม่มีสิทธิ์ → 403 และคำขอยัง `pending`
- [x] 4.6 (D1.5) แก้ `api/tests/content-approval-permission-test.php` ให้ตรงกับ `userHasRolePermission()`:
  - เคสเดิมทั้งหมดยังต้องผ่าน
  - เพิ่ม/แก้เคส `is_admin=1` ไม่มี `role_id` → ส่ง `approved` ต้องได้ **403** (เดิมทดสอบว่าไม่ถูกบล็อก — ตอนนี้ต้องกลับเป็นบล็อก)
  - เพิ่มเคส `is_admin=1` ที่มี `role_id` ชี้ role ซึ่งมี `content_approval` → ไม่ถูกบล็อก
  - `userHasRolePermission()` เทียบกับ `userHasPermission()`: ต่างกันเฉพาะกรณี is_admin/superadmin ที่ไม่มี role หรือ role ไม่มีสิทธิ์นี้
- [x] 4.2 Vitest `ContentPage` (ผลตอนที่ยัง mock `hasPermission`) — ไม่มีสิทธิ์ → ไม่มีแท็บ, `?tab=approval` เปิดแท็บผลงานทั้งหมด; มีสิทธิ์ → เห็นแท็บ
- [x] 4.7 (D1.5) แก้ `ContentPageApprovalTabAccess.test.tsx` ให้ mock `hasRolePermission` แทน `hasPermission` (เคสเดิมทั้งหมดต้องยังผ่าน)
- [x] 4.3 Vitest `AdminPage`/`ALL_MENUS`: มี "อนุมัติคอนเทนต์"
- [x] 4.8 รัน `pnpm test` ทั้งชุดอีกครั้งหลังแก้ 3.3/3.4/1.4/1.5 (เทียบกับ 8 ตัวที่พังเดิม), `pnpm lint` เฉพาะไฟล์ที่แก้, `pnpm build`
- [x] 4.9 ทดสอบจริงใน UI ด้วยวิธีเดิม (สร้าง user/role ชั่วคราว inject JWT ผ่าน localStorage ไม่แตะรหัสผ่านจริง แล้วลบทิ้ง):
  - role สมาชิกทีม → ไม่เห็นแท็บ (เหมือนเดิม)
  - role ผู้จัดการ → เห็นแท็บและอนุมัติได้ (เหมือนเดิม)
  - **ผู้ใช้ `is_admin=1` ที่ไม่มี role** → ไม่เห็นแท็บ "รายการอนุมัติ" แต่ยังเข้าเมนูอื่น (เช่นหน้าแรก, ผู้ดูแลระบบ) ได้ตามปกติ
