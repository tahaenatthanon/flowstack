## Context

**ระบบสิทธิ์ปัจจุบัน:** ใช้ menu key ต่อ role (`role_menu_permissions`) ทั้งหมด ไม่มีจุดไหนในโค้ดเช็คชื่อ role ตรงๆ
- `users.is_superadmin=1` และ `tenant_users.is_admin=1` ได้ทุก menu key (`getUserPermissions()` คืน `ALL_MENU_KEYS`, ฝั่ง frontend `hasPermission()` คืน `true`)
- ชื่อและ label ของ role เป็น free text ที่แอดมินแก้ได้ ส่วน `seed-defaults.php` สร้าง role `admin`/ผู้ดูแลระบบ, `manager`/ผู้จัดการ, `staff`/สมาชิกทีม ให้ tenant ใหม่
- menu key `content_approval` มีอยู่ใน `ALL_MENU_KEYS` (`api/auth.php:149`) แต่ไม่อยู่ใน `ALL_MENUS` ของ `AdminPage.tsx` และไม่มีที่ไหนเรียก `hasPermission('content_approval')`

**จุดตัดสินอนุมัติคอนเทนต์ที่มีอยู่:**

| จุด | ใช้โดย | เช็คสิทธิ์ตอนนี้ |
|---|---|---|
| `PUT content-items.php` `status=approved` | ปุ่ม อนุมัติ ในแท็บรายการอนุมัติ และ ContentDetailView | `requireAuth()` เท่านั้น |
| `PUT content-items.php` `status=revision` + `reject_reason` | ปุ่ม ขอแก้ไข | `requireAuth()` เท่านั้น |
| `PUT content-items.php` `status=rejected` + `reject_reason` | ปุ่ม ปฏิเสธ | `requireAuth()` เท่านั้น |
| `POST approvals.php?action=decide` | approval chain (ผู้อนุมัติที่ถูกระบุชื่อ) | `requireAuth()` + ต้องเป็น `approver_id` ของคำขอ |

**`status=revision` ที่ระบบตั้งเอง:** `content-items.php` เปลี่ยนเป็น `revision` อัตโนมัติเมื่อแก้เนื้อหาของคอนเทนต์ที่อนุมัติแล้ว ส่วนนี้ไม่ใช่การตัดสินของผู้อนุมัติ

## Goals / Non-Goals

**Goals:**
- แท็บ "รายการอนุมัติ" แสดงเฉพาะผู้มีสิทธิ์ `content_approval`
- API ตัดสินอนุมัติ (อนุมัติ/ตีกลับ/ปฏิเสธ) บล็อกผู้ที่ไม่มีสิทธิ์ด้วย 403
- role ผู้ดูแลระบบ, ผู้จัดการ และ `is_admin=1` ใช้งานได้ทันทีหลัง deploy
- แอดมินให้/ถอนสิทธิ์นี้กับ role ใดก็ได้ผ่านหน้าผู้ดูแลระบบ

**Non-Goals:**
- จำกัดการ "ขออนุมัติ" (`status=pending_approval`)
- จำกัดการเห็นรายการคอนเทนต์ (`GET content-items.php`) เพราะแท็บอื่นยังต้องใช้
- เปลี่ยน approval chain (`approval_requests`) หรือวิธีเลือกผู้อนุมัติ
- เติม menu key อื่นที่ขาดใน `seed-defaults.php` (เช่น `lead_generation`) — เป็นเรื่องแยก

## Decisions

### D1. ใช้ menu key `content_approval` ที่มีอยู่ ไม่เช็คชื่อ role
เพิ่มเข้า `ALL_MENUS` ของ `AdminPage.tsx` ด้วย label "อนุมัติคอนเทนต์" ต่อจาก `marketing`

- ทางเลือกที่ไม่เลือก: เช็ค `role.name === 'manager'` เพราะชื่อ role แก้ได้ ถ้าแอดมินเปลี่ยนชื่อหรือสร้าง role ใหม่ สิทธิ์จะหลุดโดยไม่มีใครรู้ และจะเป็นจุดแรกในระบบที่ผูกกับชื่อ role

### D1.5 `content_approval` ไม่ bypass ด้วย `is_admin`/`is_superadmin` — ต้องมี role assignment เสมอ
ทุกจุดตรวจสิทธิ์อื่นในระบบ (`getUserPermissions()`, `hasPermission()`) ให้ `is_admin=1` และ `is_superadmin=1` ผ่านทุกเมนูอัตโนมัติ (bypass) ซึ่งเป็นสมมติฐานหลักที่ทั้งระบบพึ่งพา (พบการอ้างอิงรูปแบบนี้ 76 จุดทั้ง backend/frontend) — เปลี่ยน bypass นี้ทั้งระบบเสี่ยงล็อกผู้ใช้ `is_admin=1` ที่ไม่มี `role_id` (พบ 3 คนใน DB local ข้ามทุก tenant) ออกจากทุกเมนูในแอปทันที ไม่ใช่แค่แท็บอนุมัติคอนเทนต์

`content_approval` จึงใช้เส้นทางตรวจสิทธิ์แยกต่างหากที่ไม่ผ่าน bypass นี้ — ต้องมี `tenant_users.role_id` ที่ชี้ไป role ซึ่งมีแถว `content_approval` ใน `role_menu_permissions` จริงเท่านั้น ไม่ว่าผู้ใช้จะเป็น `is_admin=1` หรือ `is_superadmin=1` หรือไม่ก็ตาม

- Backend: ฟังก์ชันใหม่ `userHasRolePermission($db, $userId, $tenantId, $menuKey): bool` (แยกจาก `userHasPermission()`) อ่านเฉพาะ `tenant_users.role_id` → `role_menu_permissions` ไม่เช็ค `is_admin`/`is_superadmin` เลย
- Frontend: `/auth/me.php` ส่งฟิลด์ใหม่ `role_permissions` (menu key จาก role ล้วนๆ ไม่ bypass) แยกจาก `permissions` เดิม (ที่ยัง bypass สำหรับเมนูอื่นตามปกติ) และ `useAuth()` มีฟังก์ชันใหม่ `hasRolePermission(menuKey)` ที่เช็คจาก `role_permissions` เท่านั้น
- ผลคือ `is_admin=1`/`is_superadmin=1` ยังเข้าเมนูอื่นทั้งหมดในแอปได้ตามปกติ (ไม่กระทบ 76 จุดที่เหลือ) กระทบเฉพาะแท็บ "รายการอนุมัติ" และ API ตัดสินอนุมัติเท่านั้น
- ทางเลือกที่ไม่เลือก: เปลี่ยน bypass ของ `is_admin`/`is_superadmin` ทั้งระบบ — ถูกปฏิเสธเพราะ blast radius ใหญ่เกินขอบเขตของ change นี้ และจะล็อกผู้ใช้ที่มีอยู่จริงออกจากระบบทันทีโดยไม่มี migration รองรับ

### D2. helper ฝั่ง backend คืนค่า bool แล้ว endpoint ตอบ 403 ภาษาไทยเอง
เพิ่มใน `api/auth.php`:
```php
// ใช้กับสิทธิ์ที่ต้องมี role assignment เสมอ (ดู D1.5) — ไม่ bypass ด้วย is_superadmin/is_admin
function userHasRolePermission(PDO $db, string $userId, string $tenantId, string $menuKey): bool {
    $stmt = $db->prepare('SELECT role_id FROM tenant_users WHERE user_id = ? AND tenant_id = ?');
    $stmt->execute([$userId, $tenantId]);
    $roleId = $stmt->fetchColumn();
    if (!$roleId) return false;
    $stmt = $db->prepare('SELECT 1 FROM role_menu_permissions WHERE role_id = ? AND menu_key = ?');
    $stmt->execute([$roleId, $menuKey]);
    return (bool)$stmt->fetch();
}
```
- ไม่ใช้ `getUserPermissions()`/`userHasPermission()` เดิม เพราะทั้งคู่ bypass ด้วย `is_superadmin`/`is_admin` (ดู D1.5)
- ไม่ใช้ `requireAdminOrPermission()` เพราะ bypass เหมือนกัน และตอบ `'Forbidden'` ภาษาอังกฤษ
- ข้อความ 403: `"ไม่มีสิทธิ์อนุมัติคอนเทนต์ — ต้องเป็นผู้ดูแลระบบหรือผู้จัดการ"`

### D3. จุดบล็อกใน `PUT content-items.php`
ตรวจก่อนบล็อก approval-sensitive ที่อาจเปลี่ยน `$body['status']` เป็น `revision` เอง โดยใช้ `status` ที่ client ส่งมาจริง:
```
requested = body.status (ก่อนระบบแก้)
ต้องมีสิทธิ์ content_approval เมื่อ:
  requested ∈ {approved, rejected}
  หรือ requested = revision และสถานะปัจจุบันใน DB = pending_approval
```
- `revision` จากสถานะอื่นไม่ถือเป็นการตัดสิน จึงไม่บล็อก ปุ่มในระบบไม่ได้ส่งค่านี้อยู่แล้ว แต่กันไม่ให้กระทบ flow อื่น
- `pending_approval` และ `published` ไม่ถูกบล็อกด้วยสิทธิ์นี้ (`published` มี approval gate เดิมอยู่แล้ว)
- การตั้ง `revision` อัตโนมัติตอนแก้คอนเทนต์ที่อนุมัติแล้วไม่ถูกบล็อก เพราะเช็คจาก `status` ที่ client ส่ง ไม่ใช่ค่าที่ระบบแก้

### D4. `approvals.php?action=decide` ของ content_item
เมื่อ `entity_type = 'content_item'` ต้องมีสิทธิ์ `content_approval` ด้วย นอกเหนือจากการเป็น `approver_id` เดิม entity อื่นไม่เปลี่ยน

### D5. Frontend `ContentPage.tsx` และ `useAuth()`
- `/auth/me.php` เพิ่มฟิลด์ `role_permissions: string[]` — menu key จาก `role_menu_permissions` ของ `role_id` ที่ผูกกับผู้ใช้ล้วนๆ ไม่ bypass ด้วย `is_admin`/`is_superadmin` (ตอน superadmin impersonate ที่ `role_id = null` จะได้ `[]`)
- `useAuth()` เพิ่ม `hasRolePermission(menuKey): boolean` ที่เช็คจาก `user.role_permissions` เท่านั้น แยกจาก `hasPermission()` เดิมที่ยัง bypass สำหรับเมนูอื่น
- `canApprove = hasRolePermission('content_approval')`
- ไม่ render `TabsTrigger`/`TabsContent` ของ `approval` เมื่อไม่มีสิทธิ์
- `validTabs` ไม่รวม `approval` เมื่อไม่มีสิทธิ์ ดังนั้น `?tab=approval` จะเปิดแท็บ `content` แทน
- `TabsList` ใช้ `sm:grid-cols-5` ตายตัว → เปลี่ยนเป็นจำนวนคอลัมน์ตามแท็บที่แสดง (4 หรือ 5)

### D6. Migration ให้สิทธิ์ role ที่มีอยู่
```sql
INSERT INTO role_menu_permissions (role_id, menu_key)
SELECT r.id, 'content_approval' FROM roles r
WHERE r.name IN ('admin', 'manager')
  AND NOT EXISTS (SELECT 1 FROM role_menu_permissions p WHERE p.role_id = r.id AND p.menu_key = 'content_approval');
```
- ใช้ `name` (internal) ไม่ใช่ `label` และทำครั้งเดียวตอน migrate หลังจากนั้นแอดมินจัดการเองผ่าน UI
- รันซ้ำได้โดยไม่ซ้ำ (PK `role_id, menu_key` + `NOT EXISTS`)
- `seed-defaults.php` เพิ่ม `content_approval` ให้ role admin และ manager ของ tenant ใหม่

## Risks / Trade-offs

- **[role ผู้จัดการบน production ถูกเปลี่ยนชื่อไว้แล้ว]** migration จะไม่ให้สิทธิ์ → แจ้งใน deploy checklist ให้ตรวจ `SELECT` หลังรัน และแอดมินให้สิทธิ์ผ่าน UI ได้ทันที
- **[ผู้ใช้เปิดแท็บค้างไว้ก่อน deploy]** ยังเห็นแท็บจนกว่าจะรีโหลด แต่กดอนุมัติจะได้ 403 จาก API
- **[ผู้ใช้ที่ถูกระบุเป็น approver ใน approval chain แต่ไม่มีสิทธิ์]** จะตัดสินไม่ได้ → ถือว่าถูกต้องตามนโยบายใหม่ และแจ้งผลในสรุปของ change
- **[`permissions` ใน session ของ frontend มาจากตอนล็อกอิน]** แอดมินเปลี่ยนสิทธิ์แล้วผู้ใช้ต้องรีโหลด/ล็อกอินใหม่ — พฤติกรรมเดิมของทุก menu key
- **[`is_admin=1` ที่ไม่มี `role_id` จะไม่เห็นแท็บอนุมัติคอนเทนต์]** ตั้งใจตาม D1.5 — คนละพฤติกรรมกับเมนูอื่นทุกเมนูที่ยัง bypass ให้ `is_admin=1` ตามปกติ พบ 3 คนใน DB local ที่เข้าข่ายนี้ (`is_admin=1` + `role_id IS NULL`) ถ้าต้องการให้เห็นแท็บนี้ด้วย ต้อง assign role ที่มี `content_approval` ให้ผ่านหน้าผู้ดูแลระบบ
