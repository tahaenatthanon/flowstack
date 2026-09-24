## Why

แท็บ "รายการอนุมัติ" ในหน้าคอนเทนต์ (`/content`) ยังไม่มีการตรวจสิทธิ์ของตัวเอง ใครเข้าหน้าคอนเทนต์ได้ (สิทธิ์เมนู `marketing`) ก็เห็นแท็บนี้และกด อนุมัติ/ขอแก้ไข/ปฏิเสธ ได้ ใน DB local มีสมาชิกทีม 9 คนอยู่ในกลุ่มนี้

ฝั่ง API ยิ่งเปิดกว้างกว่านั้น `api/content-items.php` และ `api/approvals.php` เช็คแค่ว่าล็อกอินอยู่ (`requireAuth()`) ผู้ใช้ทุกคนที่ล็อกอินได้จึงเรียก API ตัดสินอนุมัติคอนเทนต์ได้โดยตรง

ในระบบมี menu key `content_approval` อยู่ใน `ALL_MENU_KEYS` แล้ว แต่ยังไม่มีที่ไหนใช้งาน

## What Changes

- **สิทธิ์ `content_approval` ใช้งานจริง:**
  - แสดงในตารางตั้งสิทธิ์ของ role (หน้าผู้ดูแลระบบ) ชื่อ "อนุมัติคอนเทนต์"
  - ผู้ใช้ `is_admin=1` และ superadmin ได้สิทธิ์นี้อัตโนมัติ (bypass เดิม)
- **แท็บ "รายการอนุมัติ":** แสดงเฉพาะผู้ที่มีสิทธิ์ `content_approval` ถ้าเข้า `?tab=approval` โดยไม่มีสิทธิ์ ให้เปิดแท็บ "ผลงานทั้งหมด" แทน
- **BREAKING (API) — การตัดสินอนุมัติต้องมีสิทธิ์ `content_approval`:**
  - `PUT api/content-items.php` ที่ตั้ง `status` เป็น `approved` หรือ `rejected`
  - `PUT api/content-items.php` ที่ตั้ง `status=revision` ขณะคอนเทนต์อยู่ในสถานะ `pending_approval` (การตีกลับของผู้อนุมัติ)
  - `POST api/approvals.php?action=decide` ของ `entity_type=content_item`
  - ไม่มีสิทธิ์ → ตอบ 403 พร้อมข้อความภาษาไทย
- **ไม่เปลี่ยน:**
  - "ขออนุมัติ" (`status=pending_approval`) ยังเปิดให้ทุกคนที่แก้คอนเทนต์ได้
  - การแก้คอนเทนต์ที่อนุมัติแล้วซึ่งระบบตั้ง `revision` ให้อัตโนมัติ ยังทำงานเหมือนเดิม
- **ข้อมูล:**
  - migration ให้สิทธิ์ `content_approval` กับ role `admin` (ผู้ดูแลระบบ) และ `manager` (ผู้จัดการ) ของทุก tenant ที่มีอยู่
  - `api/auth/seed-defaults.php` ให้ tenant ใหม่ได้สิทธิ์นี้กับ 2 role เดียวกัน

## Capabilities

### New Capabilities
- `content-approval-access`: สิทธิ์ `content_approval` ที่ควบคุมการเห็นแท็บ "รายการอนุมัติ" และการตัดสินอนุมัติคอนเทนต์ทั้งฝั่ง UI และ API, การตั้งค่าสิทธิ์ผ่านหน้าผู้ดูแลระบบ, และค่าเริ่มต้นของ role ผู้ดูแลระบบ/ผู้จัดการ

### Modified Capabilities
(ไม่มี — requirement ของ flow อนุมัติเดิมไม่เปลี่ยน เพิ่มแค่เงื่อนไขสิทธิ์ผ่าน capability ใหม่)

## Impact

- **Backend:** `api/content-items.php` (PUT), `api/approvals.php` (decide), `api/auth/seed-defaults.php`
- **Frontend:** `src/pages/ContentPage.tsx`, `src/pages/AdminPage.tsx` (`ALL_MENUS`)
- **DB:** migration ใหม่ `database/migrations/<timestamp>_grant_content_approval_to_admin_manager.sql` เพิ่มแถวใน `role_menu_permissions` (ไม่เปลี่ยน schema)
- **ผู้ใช้:** role สมาชิกทีม/staff และ role อื่นที่ไม่มีสิทธิ์จะไม่เห็นแท็บ และเรียก API ตัดสินอนุมัติไม่ได้ ส่วน `is_admin=1` ใช้งานได้เหมือนเดิม
- **Production:** ต้องรัน migration บน platform.ktnbs.com ตอน deploy มิฉะนั้น role ผู้จัดการที่ไม่ได้เป็น `is_admin` จะอนุมัติไม่ได้
