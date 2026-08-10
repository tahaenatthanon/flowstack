# SaaS Platform — Full Design Spec

**Date:** 2026-06-10  
**Status:** Approved  
**Scope:** Plan enforcement, Superadmin, Billing/Payment, Tenant onboarding, Landing page

---

## Overview

Flowstack เป็น multi-tenant SaaS ที่มี architecture อยู่แล้ว (tenants table, tenant_users, company_settings) แต่ขาด plan enforcement, billing, superadmin, tenant onboarding config, และ public landing page

---

## Section 1: Database Schema

### 1.1 plan_limits — กำหนด limit ต่อ plan (configurable)

```sql
CREATE TABLE plan_limits (
  plan         ENUM('trial','starter','pro','enterprise') PRIMARY KEY,
  max_users    INT NOT NULL DEFAULT 1,   -- 0 = unlimited
  price_thb    DECIMAL(10,2) NOT NULL DEFAULT 0,
  trial_days   INT NOT NULL DEFAULT 30,  -- used only for trial plan
  is_active    TINYINT(1) NOT NULL DEFAULT 1,
  updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Seed
INSERT INTO plan_limits VALUES
  ('trial',      1,     0.00,    30, 1),
  ('starter',    5,   990.00,     0, 1),
  ('pro',       20,  2990.00,     0, 1),
  ('enterprise', 0,     0.00,     0, 1);  -- 0 = unlimited, price = contact
```

### 1.2 users — เพิ่ม is_superadmin

```sql
ALTER TABLE users ADD COLUMN is_superadmin TINYINT(1) NOT NULL DEFAULT 0;
-- Seed: superadmin@ktnbs.com → is_superadmin = 1
UPDATE users SET is_superadmin = 1 WHERE email = 'superadmin@ktnbs.com';
```

### 1.3 subscriptions — ติดตาม plan ต่อ tenant

```sql
CREATE TABLE subscriptions (
  id          CHAR(36) PRIMARY KEY,
  tenant_id   CHAR(36) NOT NULL UNIQUE,
  plan        ENUM('trial','starter','pro','enterprise') NOT NULL DEFAULT 'trial',
  started_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at  DATETIME NULL,            -- NULL = ไม่มีวันหมด (enterprise)
  status      ENUM('active','expired','cancelled','suspended') NOT NULL DEFAULT 'active',
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);
```

### 1.4 invoices — ใบแจ้งชำระเงิน

```sql
CREATE TABLE invoices (
  id            CHAR(36) PRIMARY KEY,
  tenant_id     CHAR(36) NOT NULL,
  plan          ENUM('trial','starter','pro','enterprise') NOT NULL,
  amount        DECIMAL(10,2) NOT NULL,
  due_date      DATE NOT NULL,
  status        ENUM('pending','paid','overdue','cancelled') NOT NULL DEFAULT 'pending',
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);
```

### 1.5 payments — การชำระเงิน (slip upload)

```sql
CREATE TABLE payments (
  id            CHAR(36) PRIMARY KEY,
  invoice_id    CHAR(36) NOT NULL,
  method        ENUM('qr','bank_transfer') NOT NULL,
  amount        DECIMAL(10,2) NOT NULL,
  slip_url      VARCHAR(500) NULL,       -- path to uploaded slip
  note          TEXT NULL,
  status        ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  submitted_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  verified_at   DATETIME NULL,
  verified_by   CHAR(36) NULL,           -- superadmin user_id
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
);
```

### 1.6 payment_methods_config — ตั้งค่าวิธีรับเงิน

```sql
CREATE TABLE payment_methods_config (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  method        ENUM('qr','bank_transfer') NOT NULL,
  label         VARCHAR(100) NOT NULL,   -- e.g. "PromptPay", "กสิกรไทย"
  account_name  VARCHAR(255) NULL,
  account_number VARCHAR(50) NULL,
  qr_image_url  VARCHAR(500) NULL,       -- path to QR image
  is_active     TINYINT(1) NOT NULL DEFAULT 1,
  sort_order    INT NOT NULL DEFAULT 0
);
```

### 1.7 tenants_onboarding_template — config ที่ seed ให้ tenant ใหม่ทุกราย

```sql
CREATE TABLE tenant_onboarding_templates (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  key_name    VARCHAR(100) NOT NULL UNIQUE,  -- e.g. 'company_settings', 'roles'
  label       VARCHAR(255) NOT NULL,
  template    JSON NOT NULL,
  is_active   TINYINT(1) NOT NULL DEFAULT 1
);
```

---

## Section 2: Backend APIs

### 2.1 Auth helpers (`api/auth.php`)

```php
// ใหม่: check superadmin
function requireSuperAdmin(): array {
    $user = requireAuth();
    if (!$user['is_superadmin']) jsonError('Forbidden — superadmin only', 403);
    return $user;
}

// ใหม่: enforce user limit before adding member
function checkUserLimit(PDO $db, string $tenantId): void {
    $planStmt = $db->prepare('
        SELECT pl.max_users FROM subscriptions s
        JOIN plan_limits pl ON pl.plan = s.plan
        WHERE s.tenant_id = ? AND s.status = "active"
    ');
    $planStmt->execute([$tenantId]);
    $maxUsers = (int)($planStmt->fetchColumn() ?? 1);
    if ($maxUsers === 0) return; // unlimited

    $countStmt = $db->prepare('SELECT COUNT(*) FROM tenant_users WHERE tenant_id = ?');
    $countStmt->execute([$tenantId]);
    $current = (int)$countStmt->fetchColumn();
    if ($current >= $maxUsers) {
        jsonError("แผนปัจจุบันรองรับสูงสุด {$maxUsers} users กรุณาอัปเกรด", 402);
    }
}
```

**Enforcement points:** `checkUserLimit()` เรียกใน `api/users.php` (invite), `api/auth/signup.php` (add to tenant)

### 2.2 Signup (`api/auth/signup.php`) — เพิ่ม company_name + auto-seed

```
POST body เพิ่ม: company_name (optional, ใช้เป็น tenant name)

หลัง signup:
1. INSERT INTO subscriptions (tenant_id, plan='trial', expires_at=NOW()+30days)
2. seedTenantDefaults($db, $tenantId, $company_name)
```

### 2.3 Superadmin APIs

```
api/superadmin/tenants.php     GET: list all tenants + stats
                                PUT: change plan, status
api/superadmin/plan-limits.php GET: all plan limits
                                PUT: update max_users, price
api/superadmin/payments.php    GET: pending payments
                                POST ?action=approve|reject
api/superadmin/users.php       GET: all users cross-tenant
api/superadmin/overview.php    GET: platform stats
```

All endpoints call `requireSuperAdmin()` first.

### 2.4 Billing APIs (tenant-facing)

```
api/billing/status.php    GET: subscription, plan limits, usage
api/billing/invoices.php  GET: list invoices
api/billing/pay.php       POST: upload slip → create payment record
api/billing/upload.php    POST: multipart slip image upload
```

### 2.5 seedTenantDefaults() — auto-seed เมื่อ tenant ใหม่สมัคร

```php
function seedTenantDefaults(PDO $db, string $tenantId, string $companyName): void {
    // 1. company_settings — default task catalog, calendar types, max_task_hours=16
    // 2. work_schedules + work_schedule_days — Mon-Fri 8h
    // 3. roles — Admin, Manager, Staff
    // 4. role_menu_permissions — standard permissions per role
    // 5. task_validation_rules — end_before_start, max hours
    // Templates loaded from tenant_onboarding_templates table
}
```

---

## Section 3: Tenant Onboarding Defaults

เมื่อ tenant ใหม่สมัคร ระบบ seed อัตโนมัติ:

| ตาราง | ค่า default |
|-------|-------------|
| company_settings | task_type_catalog, calendar_event_type_catalog, max_task_hours=16, timezone=Asia/Bangkok |
| work_schedules | "Default Schedule" Mon-Fri is_working=1 work_hours=8 |
| roles | Admin (is_admin=1), Manager, Staff |
| role_menu_permissions | ตาม ALL_MENU_KEYS แต่ละ role |
| task_validation_rules | end_before_start=block, estimated_hours>max=warn |

**Superadmin Template Management:** `/superadmin` → tab "Onboarding Templates" — แก้ไข JSON template ก่อน seed; "Re-seed" ให้ tenant เก่าที่ขาด config

---

## Section 4: Superadmin UI (`/superadmin`)

**Route:** Protected ด้วย `user.is_superadmin === 1`  
**File:** `src/pages/SuperAdminPage.tsx`  
**Sidebar:** เพิ่ม link "⚡ Super Admin" ใน AppSidebar เฉพาะ `is_superadmin === 1`

### Tabs

**Overview**
- Stats: tenants (total/active/trial/expired), users, MRR (monthly recurring revenue)
- Charts: signups per month, revenue per month

**Tenants**
- Table: tenant name, plan badge, users/max, status, expires_at, created_at
- Actions: เปลี่ยน plan dropdown, Suspend/Activate button
- Filter: plan, status

**Plan Limits**
- Editable table: trial/starter/pro/enterprise → max_users, price_thb
- Save ทันที (PUT /superadmin/plan-limits.php)

**Payments (Pending)**
- List: tenant name, invoice amount, method, slip image preview
- Approve → subscription extends + invoice = paid
- Reject → with reason note

**Users (Cross-tenant)**
- Table: email, display_name, tenant, plan, joined_at
- Actions: suspend, reset password

**Onboarding Templates**
- JSON editor per template key
- Re-seed button per tenant

**Payment Methods**
- Configure QR image upload, bank account details
- Toggle active/inactive per method

---

## Section 5: Billing Page (Tenant-facing)

**Route:** `/billing`  
**File:** `src/pages/BillingPage.tsx`  
**Access:** ProtectedRoute ทุก user (แต่แสดง limited info ถ้าไม่ใช่ admin)

### Layout

```
Current Plan Card
├── Plan badge (Trial/Starter/Pro/Enterprise)
├── Expires: DD MMM YYYY (หรือ "ไม่มีกำหนด")
├── Users: X/Y คน
└── [อัปเกรดแผน] button → plan selection modal

Invoice Section
└── Table: invoice no., date, amount, status, [ชำระเงิน] button

Payment Modal (เมื่อกด [ชำระเงิน])
├── Tab: QR Code — แสดง QR image + amount + [อัปโหลดสลิป]
└── Tab: โอนเงิน — แสดง bank info + [อัปโหลดสลิป]
→ Submit → แจ้งเตือน "รอ superadmin ยืนยัน"

Payment History
└── Table: วันที่, วิธี, ยอด, status badge
```

### Expiry Lock

เมื่อ `subscription.status === 'expired'`:
- `ProtectedRoute` → redirect ไป `/billing?expired=1`
- BillingPage แสดง banner แดง "แผนของคุณหมดอายุแล้ว กรุณาชำระเงินเพื่อใช้งานต่อ"
- ยกเว้น `/billing`, `/profile`, `/auth` ยังเข้าได้

---

## Section 6: Email Notifications

ใช้ SMTP ที่มีอยู่ + cron job (`api/cron/billing-reminders.php`):

| Event | เมื่อไหร่ | ผู้รับ |
|-------|----------|--------|
| Trial about to expire | 7 วันก่อนหมด | tenant admin |
| Trial about to expire | 1 วันก่อนหมด | tenant admin |
| Trial expired | วันหมด | tenant admin |
| Payment submitted | ทันที | superadmin + tenant admin |
| Payment approved | ทันที | tenant admin |
| Payment rejected | ทันที | tenant admin |

---

## Section 7: Landing Page (`/`)

**Route:** `/` — render `<LandingPage />` แทน redirect เมื่อ `!user`  
**File:** `src/pages/LandingPage.tsx`

### Sections

**Navbar**
- Logo + เมนู Features / Pricing / ติดต่อ
- [TH | EN] toggle (useState lang)
- [เข้าสู่ระบบ] [เริ่มต้นฟรี]

**Hero**
- Headline TH: "ระบบจัดการธุรกิจครบวงจร" / EN: "All-in-One Business Management"
- Sub: "โปรเจกต์ • Sales • Support • BPM • Content • Analytics"
- [ทดลองใช้ฟรี 30 วัน — ไม่ต้องใส่บัตรเครดิต]
- Product screenshot (ใช้ dashboard screenshot)

**Features (6 cards)**
- Projects & Tasks, Sales Pipeline, Support Helpdesk, BPM Workflow, Content Planner, Analytics

**Pricing (3 columns + trial)**

| | Trial | Starter | Pro | Enterprise |
|-|-------|---------|-----|-----------|
| Users | 1 | 5 | 20 | ไม่จำกัด |
| ราคา | ฟรี 30 วัน | 990฿/เดือน | 2,990฿/เดือน | ติดต่อ |
| CTA | เริ่มต้นเลย | เลือกแผนนี้ | เลือกแผนนี้ | ติดต่อ |

**How it Works (3 ขั้นตอน)**  
สมัครฟรี → ตั้งค่าบริษัท → เริ่มใช้งาน

**CTA Banner**  
"ทดลองใช้ฟรี 30 วัน ไม่ต้องใส่บัตรเครดิต"

**Footer**  
© Flowstack | Features | Pricing | Contact | Privacy Policy

### i18n

```ts
const TEXTS = {
  th: { hero_title: 'ระบบจัดการธุรกิจครบวงจร', ... },
  en: { hero_title: 'All-in-One Business Management', ... },
};
const [lang, setLang] = useState<'th'|'en'>('th');
```

---

## Architecture Summary

```
Public (unauthenticated)
  /                → LandingPage.tsx
  /auth            → Auth.tsx (login/register)

Tenant (authenticated)
  /billing         → BillingPage.tsx  [lock if expired]
  /*               → existing pages   [lock if expired]

Platform (superadmin only)
  /superadmin      → SuperAdminPage.tsx
```

---

## Out of Scope

- Payment gateway integration (Omise, Stripe) — manual slip only for now
- Subdomain routing per tenant
- Coupon/discount codes
- Usage-based billing (beyond user count)
- Mobile app
