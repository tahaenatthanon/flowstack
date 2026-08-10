# SaaS Platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform Flowstack into a fully functional SaaS platform with plan enforcement (users per plan), superadmin console, billing/payment with slip upload, tenant onboarding auto-seed, and a public landing page with TH/EN toggle.

**Architecture:** Shared database multi-tenant (existing) + new `plan_limits`, `subscriptions`, `invoices`, `payments`, `payment_methods_config` tables; `is_superadmin` flag on users; `seedTenantDefaults()` called at signup; React routes for `/` (landing), `/billing`, `/superadmin`.

**Tech Stack:** PHP 8 + MariaDB + PDO, React 18 + TypeScript + Vite, TanStack React Query, shadcn-ui, Tailwind CSS, Vitest

---

## File Map

| Action | File |
|--------|------|
| Create | `database/migrations/2026_06_10_150000_saas_schema.sql` |
| Modify | `api/auth.php` — add `requireSuperAdmin()`, `checkUserLimit()` |
| Create | `api/auth/seed-defaults.php` — `seedTenantDefaults()` helper |
| Modify | `api/auth/signup.php` — company_name, subscription, seed |
| Modify | `api/users.php` — enforce user limit on POST |
| Create | `api/superadmin/tenants.php` |
| Create | `api/superadmin/plan-limits.php` |
| Create | `api/superadmin/payments.php` |
| Create | `api/superadmin/users.php` |
| Create | `api/superadmin/overview.php` |
| Create | `api/billing/status.php` |
| Create | `api/billing/invoices.php` |
| Create | `api/billing/pay.php` |
| Create | `api/billing/upload.php` |
| Create | `api/cron/billing-reminders.php` |
| Create | `src/pages/LandingPage.tsx` |
| Create | `src/hooks/useBilling.ts` |
| Create | `src/hooks/useSuperAdmin.ts` |
| Create | `src/pages/BillingPage.tsx` |
| Create | `src/pages/SuperAdminPage.tsx` |
| Modify | `src/App.tsx` — add `/`, `/billing`, `/superadmin` routes |
| Modify | `src/components/AppSidebar.tsx` — superadmin link + billing alert |
| Modify | `src/components/DashboardLayout.tsx` — expiry redirect |
| Modify | `src/hooks/useAuth.tsx` — expose `is_superadmin` |

---

## Task 1: Database Migrations

**Files:**
- Create: `database/migrations/2026_06_10_150000_saas_schema.sql`

- [ ] **Step 1.1 — Create migration file**

```sql
-- database/migrations/2026_06_10_150000_saas_schema.sql

-- 1. plan_limits
CREATE TABLE IF NOT EXISTS `plan_limits` (
  `plan`       ENUM('trial','starter','pro','enterprise') NOT NULL,
  `max_users`  INT NOT NULL DEFAULT 1 COMMENT '0 = unlimited',
  `price_thb`  DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `trial_days` INT NOT NULL DEFAULT 0,
  `is_active`  TINYINT(1) NOT NULL DEFAULT 1,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`plan`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `plan_limits` (`plan`,`max_users`,`price_thb`,`trial_days`,`is_active`) VALUES
  ('trial',      1,     0.00, 30, 1),
  ('starter',    5,   990.00,  0, 1),
  ('pro',       20,  2990.00,  0, 1),
  ('enterprise', 0,     0.00,  0, 1)
ON DUPLICATE KEY UPDATE `max_users`=VALUES(`max_users`);

-- 2. is_superadmin on users
ALTER TABLE `users`
  ADD COLUMN IF NOT EXISTS `is_superadmin` TINYINT(1) NOT NULL DEFAULT 0;

-- Seed superadmin
UPDATE `users` SET `is_superadmin` = 1 WHERE `email` = 'superadmin@ktnbs.com';

-- 3. subscriptions
CREATE TABLE IF NOT EXISTS `subscriptions` (
  `id`         CHAR(36) NOT NULL,
  `tenant_id`  CHAR(36) NOT NULL,
  `plan`       ENUM('trial','starter','pro','enterprise') NOT NULL DEFAULT 'trial',
  `started_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `expires_at` DATETIME NULL COMMENT 'NULL = no expiry',
  `status`     ENUM('active','expired','cancelled','suspended') NOT NULL DEFAULT 'active',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_sub_tenant` (`tenant_id`),
  CONSTRAINT `fk_sub_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seed existing tenants with active subscriptions
INSERT IGNORE INTO `subscriptions` (`id`,`tenant_id`,`plan`,`started_at`,`expires_at`,`status`)
SELECT UUID(), t.id, t.plan,
       t.created_at,
       CASE t.plan WHEN 'trial' THEN DATE_ADD(t.created_at, INTERVAL 30 DAY) ELSE NULL END,
       'active'
FROM tenants t;

-- 4. invoices
CREATE TABLE IF NOT EXISTS `invoices` (
  `id`         CHAR(36) NOT NULL,
  `tenant_id`  CHAR(36) NOT NULL,
  `plan`       ENUM('trial','starter','pro','enterprise') NOT NULL,
  `amount`     DECIMAL(10,2) NOT NULL,
  `due_date`   DATE NOT NULL,
  `status`     ENUM('pending','paid','overdue','cancelled') NOT NULL DEFAULT 'pending',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_inv_tenant` (`tenant_id`),
  CONSTRAINT `fk_inv_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. payments
CREATE TABLE IF NOT EXISTS `payments` (
  `id`           CHAR(36) NOT NULL,
  `invoice_id`   CHAR(36) NOT NULL,
  `method`       ENUM('qr','bank_transfer') NOT NULL,
  `amount`       DECIMAL(10,2) NOT NULL,
  `slip_url`     VARCHAR(500) NULL,
  `note`         TEXT NULL,
  `status`       ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  `submitted_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `verified_at`  DATETIME NULL,
  `verified_by`  CHAR(36) NULL,
  PRIMARY KEY (`id`),
  KEY `idx_pay_invoice` (`invoice_id`),
  CONSTRAINT `fk_pay_invoice` FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 6. payment_methods_config
CREATE TABLE IF NOT EXISTS `payment_methods_config` (
  `id`             INT AUTO_INCREMENT PRIMARY KEY,
  `method`         ENUM('qr','bank_transfer') NOT NULL,
  `label`          VARCHAR(100) NOT NULL,
  `account_name`   VARCHAR(255) NULL,
  `account_number` VARCHAR(50) NULL,
  `qr_image_url`   VARCHAR(500) NULL,
  `is_active`      TINYINT(1) NOT NULL DEFAULT 1,
  `sort_order`     INT NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO `payment_methods_config` (`method`,`label`,`account_name`,`account_number`,`is_active`,`sort_order`) VALUES
  ('qr',           'PromptPay',    NULL,                 NULL,              1, 1),
  ('bank_transfer','กสิกรไทย',     'บริษัท KTN Business', '000-0-00000-0',   1, 2);
```

- [ ] **Step 1.2 — Apply migration**

```bash
mysql -u root flowstack < database/migrations/2026_06_10_150000_saas_schema.sql
```

- [ ] **Step 1.3 — Verify tables created**

```bash
mysql -u root flowstack -e "SHOW TABLES LIKE '%plan%'; SHOW TABLES LIKE '%subscript%'; SHOW TABLES LIKE '%invoice%'; SHOW TABLES LIKE '%payment%';"
```

Expected: `plan_limits`, `subscriptions`, `invoices`, `payments`, `payment_methods_config`

- [ ] **Step 1.4 — Verify superadmin seeded**

```bash
mysql -u root flowstack -e "SELECT email, is_superadmin FROM users WHERE email='superadmin@ktnbs.com';"
```

Expected: `is_superadmin = 1`

- [ ] **Step 1.5 — Verify plan_limits**

```bash
mysql -u root flowstack -e "SELECT * FROM plan_limits;"
```

Expected: 4 rows — trial(1), starter(5), pro(20), enterprise(0)

- [ ] **Step 1.6 — Commit**

```bash
git add database/migrations/2026_06_10_150000_saas_schema.sql
git commit -m "feat(saas): add plan_limits, subscriptions, invoices, payments schema"
```

---

## Task 2: Auth Helpers + Tenant Seed Function

**Files:**
- Modify: `api/auth.php`
- Create: `api/auth/seed-defaults.php`

- [ ] **Step 2.1 — Add `requireSuperAdmin()` and `checkUserLimit()` to `api/auth.php`**

Append at end of `api/auth.php` (before the last closing `?>` if any, otherwise just append):

```php
// ── Superadmin guard ──────────────────────────────────────────────────────
if (!function_exists('requireSuperAdmin')) {
    function requireSuperAdmin(): array {
        $user = requireAuth();
        if (empty($user['is_superadmin'])) {
            jsonError('Forbidden — superadmin only', 403);
        }
        return $user;
    }
}

// ── Plan enforcement ──────────────────────────────────────────────────────
if (!function_exists('checkUserLimit')) {
    function checkUserLimit(PDO $db, string $tenantId): void {
        $stmt = $db->prepare('
            SELECT pl.max_users
            FROM subscriptions s
            JOIN plan_limits pl ON pl.plan = s.plan
            WHERE s.tenant_id = ? AND s.status = "active"
        ');
        $stmt->execute([$tenantId]);
        $maxUsers = $stmt->fetchColumn();

        // No active subscription → treat as trial limit (1)
        if ($maxUsers === false) $maxUsers = 1;
        $maxUsers = (int)$maxUsers;
        if ($maxUsers === 0) return; // unlimited

        $countStmt = $db->prepare('SELECT COUNT(*) FROM tenant_users WHERE tenant_id = ?');
        $countStmt->execute([$tenantId]);
        $current = (int)$countStmt->fetchColumn();

        if ($current >= $maxUsers) {
            jsonError(
                "แผนปัจจุบันรองรับสูงสุด {$maxUsers} users กรุณาอัปเกรดแผน",
                402
            );
        }
    }
}
```

- [ ] **Step 2.2 — PHP syntax check**

```bash
php -l api/auth.php
```

Expected: `No syntax errors detected`

- [ ] **Step 2.3 — Create `api/auth/seed-defaults.php`**

```php
<?php
/**
 * seedTenantDefaults — called after new tenant is created.
 * Seeds: company_settings, work_schedules, work_schedule_days,
 *        roles, role_menu_permissions, task_validation_rules.
 */

function seedTenantDefaults(PDO $db, string $tenantId, string $companyName): void {
    // 1. company_settings
    $existing = $db->prepare('SELECT id FROM company_settings WHERE tenant_id = ? LIMIT 1');
    $existing->execute([$tenantId]);
    if (!$existing->fetch()) {
        $taskCatalog = json_encode([
            ['key'=>'task','label'=>'งานปกติ','color'=>'#10b981','active'=>1,'system'=>1],
            ['key'=>'meeting','label'=>'ประชุม','color'=>'#3b82f6','active'=>1,'system'=>1],
            ['key'=>'leave','label'=>'ลาหยุด','color'=>'#f59e0b','active'=>1,'system'=>1],
            ['key'=>'onsite','label'=>'งานลูกค้า (Onsite)','color'=>'#06b6d4','active'=>1,'system'=>0],
            ['key'=>'ot','label'=>'งานล่วงเวลา (OT)','color'=>'#f97316','active'=>1,'system'=>0],
            ['key'=>'weekend_work','label'=>'งานวันหยุด','color'=>'#14b8a6','active'=>1,'system'=>0],
            ['key'=>'research','label'=>'วิจัย','color'=>'#8b5cf6','active'=>1,'system'=>0],
            ['key'=>'interrupt','label'=>'งานแทรก','color'=>'#f43f5e','active'=>1,'system'=>0],
        ]);
        $calCatalog = json_encode([
            ['key'=>'holiday','label'=>'วันหยุดบริษัท','color'=>'#ef4444','active'=>1,'system'=>1],
            ['key'=>'other','label'=>'อื่นๆ','color'=>'#8b5cf6','active'=>1,'system'=>1],
        ]);
        $db->prepare("
            INSERT INTO company_settings
              (tenant_id, company_name, max_task_hours, task_type_catalog, calendar_event_type_catalog)
            VALUES (?, ?, 16, ?, ?)
        ")->execute([$tenantId, $companyName, $taskCatalog, $calCatalog]);
    }

    // 2. work_schedule (Mon-Fri 8h)
    $wsExist = $db->prepare('SELECT id FROM work_schedules WHERE tenant_id = ? LIMIT 1');
    $wsExist->execute([$tenantId]);
    if (!$wsExist->fetch()) {
        $wsId = generateUUID();
        $db->prepare("INSERT INTO work_schedules (id, tenant_id, name, is_default) VALUES (?, ?, 'ตารางงานมาตรฐาน (จ-ศ)', 1)")
           ->execute([$wsId, $tenantId]);
        $dayStmt = $db->prepare('INSERT INTO work_schedule_days (id, schedule_id, day_of_week, is_working, work_hours) VALUES (?,?,?,?,?)');
        foreach ([
            [1,1,8.00],[2,1,8.00],[3,1,8.00],[4,1,8.00],[5,1,8.00],[6,0,0.00],[7,0,0.00]
        ] as [$dow, $isWork, $hrs]) {
            $dayStmt->execute([generateUUID(), $wsId, $dow, $isWork, $hrs]);
        }
    }

    // 3. roles
    $rolesExist = $db->prepare('SELECT COUNT(*) FROM roles WHERE tenant_id = ?');
    $rolesExist->execute([$tenantId]);
    if ((int)$rolesExist->fetchColumn() === 0) {
        $allMenuKeys = [
            'home','projects','sales','quotations','companies','revenue','resources',
            'task_hours','reports','analytics','marketing','goals','automation',
            'budget','support','admin','inbox','calendar','workflow','task_intelligence'
        ];
        $roleStmt = $db->prepare('INSERT INTO roles (tenant_id, name, label) VALUES (?,?,?)');
        $permStmt = $db->prepare('INSERT INTO role_menu_permissions (role_id, menu_key) VALUES (?,?)');

        // Admin role — all permissions
        $roleStmt->execute([$tenantId, 'admin', 'ผู้ดูแลระบบ']);
        $adminRoleId = $db->lastInsertId();
        foreach ($allMenuKeys as $key) $permStmt->execute([$adminRoleId, $key]);

        // Manager role — no admin menu
        $roleStmt->execute([$tenantId, 'manager', 'ผู้จัดการ']);
        $managerRoleId = $db->lastInsertId();
        foreach (array_diff($allMenuKeys, ['admin']) as $key) $permStmt->execute([$managerRoleId, $key]);

        // Staff role — limited
        $roleStmt->execute([$tenantId, 'staff', 'สมาชิกทีม']);
        $staffRoleId = $db->lastInsertId();
        foreach (['home','projects','sales','task_hours','support','inbox','calendar'] as $key) {
            $permStmt->execute([$staffRoleId, $key]);
        }
    }

    // 4. task_validation_rules
    $vrExist = $db->prepare('SELECT COUNT(*) FROM task_validation_rules WHERE tenant_id = ?');
    $vrExist->execute([$tenantId]);
    if ((int)$vrExist->fetchColumn() === 0) {
        $vrStmt = $db->prepare('
            INSERT INTO task_validation_rules
              (id, tenant_id, rule_type, condition_field, condition_operator, condition_value, message_th, is_active)
            VALUES (UUID(),?,?,?,?,?,?,1)
        ');
        foreach ([
            ['warn',  'title_duplicate',  'duplicate', null,            'พบ task ที่อาจซ้ำกัน กรุณาตรวจสอบ'],
            ['block', 'actual_hours',     'gt',        '40',            'ไม่สามารถบันทึกชั่วโมงเกิน 40 ชั่วโมงต่อ task'],
            ['block', 'daily_hours_sum',  'gt',        '24',            'ชั่วโมงรวมของวันนี้เกิน 24 ชั่วโมง'],
            ['warn',  'assignee_user_id', 'null',      null,            'task ยังไม่มีผู้รับผิดชอบ'],
            ['warn',  'estimated_hours',  'null',      null,            'task ยังไม่มีชั่วโมงประมาณ'],
            ['block', 'end_before_start', 'invalid',   null,            'วันสิ้นสุดต้องไม่น้อยกว่าวันเริ่มต้น'],
            ['warn',  'estimated_hours',  'gt',        'max_task_hours','ชั่วโมงประมาณเกินกำหนด แนะนำให้แตกเป็นงานย่อย'],
        ] as [$type, $field, $op, $val, $msg]) {
            $vrStmt->execute([$tenantId, $type, $field, $op, $val, $msg]);
        }
    }
}
```

- [ ] **Step 2.4 — PHP syntax check**

```bash
php -l api/auth/seed-defaults.php
```

- [ ] **Step 2.5 — Commit**

```bash
git add api/auth.php api/auth/seed-defaults.php
git commit -m "feat(saas): add requireSuperAdmin, checkUserLimit, seedTenantDefaults"
```

---

## Task 3: Upgrade Signup + Plan Enforcement

**Files:**
- Modify: `api/auth/signup.php`
- Modify: `api/users.php`

- [ ] **Step 3.1 — Update `api/auth/signup.php`**

Replace the entire file with:

```php
<?php
// POST /api/auth/signup.php
// Body: { "email": "...", "password": "...", "display_name": "...", "company_name": "..." }
require_once __DIR__ . '/../auth.php';
require_once __DIR__ . '/seed-defaults.php';

if (getMethod() !== 'POST') jsonError('Method not allowed', 405);

$body        = getRequestBody();
$email       = trim($body['email']        ?? '');
$password    = $body['password']           ?? '';
$displayName = trim($body['display_name'] ?? '');
$companyName = trim($body['company_name'] ?? $displayName);

if (empty($email) || empty($password)) jsonError('กรุณากรอกอีเมลและรหัสผ่าน');
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) jsonError('รูปแบบอีเมลไม่ถูกต้อง');
if (strlen($password) < 6) jsonError('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');

$db = getDB();

$stmt = $db->prepare('SELECT id FROM users WHERE email = ?');
$stmt->execute([$email]);
if ($stmt->fetch()) jsonError('อีเมลนี้ถูกใช้งานแล้ว');

$aliasCheck = $db->prepare('SELECT id FROM user_email_aliases WHERE alias_email = ?');
$aliasCheck->execute([strtolower($email)]);
if ($aliasCheck->fetch()) jsonError('อีเมลนี้ถูกใช้เป็น Alias อยู่แล้ว');

$userId       = generateUUID();
$tenantId     = generateUUID();
$passwordHash = password_hash($password, PASSWORD_DEFAULT);

$tenantSlug = preg_replace('/[^a-z0-9]+/', '-', strtolower($companyName ?: explode('@', $email)[0]));
$tenantSlug = trim($tenantSlug, '-') ?: 'tenant';
$tenantSlug = $tenantSlug . '-' . substr($tenantId, 0, 8);

$db->beginTransaction();
try {
    $db->prepare('INSERT INTO users (id, email, password_hash, display_name) VALUES (?, ?, ?, ?)')
       ->execute([$userId, $email, $passwordHash, $displayName]);

    $db->prepare('INSERT INTO tenants (id, name, slug, plan, status) VALUES (?, ?, ?, ?, ?)')
       ->execute([$tenantId, $companyName ?: ($displayName ?: $email), $tenantSlug, 'trial', 'active']);

    $db->prepare('INSERT INTO tenant_users (tenant_id, user_id, is_admin) VALUES (?, ?, 1)')
       ->execute([$tenantId, $userId]);

    // Create trial subscription (30 days)
    $db->prepare("
        INSERT INTO subscriptions (id, tenant_id, plan, started_at, expires_at, status)
        VALUES (UUID(), ?, 'trial', NOW(), DATE_ADD(NOW(), INTERVAL 30 DAY), 'active')
    ")->execute([$tenantId]);

    // Seed default config
    seedTenantDefaults($db, $tenantId, $companyName ?: ($displayName ?: $email));

    $db->commit();
} catch (Exception $e) {
    $db->rollBack();
    error_log('signup error: ' . $e->getMessage());
    jsonError('ไม่สามารถสร้างบัญชีได้ กรุณาลองใหม่', 500);
}

$token = generateToken($userId, $email, $tenantId);
jsonResponse([
    'token' => $token,
    'user'  => [
        'id'           => $userId,
        'email'        => $email,
        'display_name' => $displayName,
        'position'     => '',
        'avatar_url'   => '',
        'is_admin'     => 1,
        'tenant_id'    => $tenantId,
        'permissions'  => ALL_MENU_KEYS,
    ],
]);
```

- [ ] **Step 3.2 — Add `checkUserLimit()` call in `api/users.php`**

Find the block starting at line 144 in `api/users.php`:
```php
if (!$id) {
    requireAdmin($db, $tokenData['user_id'], $tokenData['tenant_id']);
    ...
```

Add `checkUserLimit($db, $tenantId);` right after `requireAdmin(...)`:

```php
if (!$id) {
    requireAdmin($db, $tokenData['user_id'], $tokenData['tenant_id']);
    checkUserLimit($db, $tenantId);   // ← add this line
    ...
```

Also add `require_once` at top of users.php (after existing requires):
```php
require_once __DIR__ . '/auth/seed-defaults.php';
```

Wait — `checkUserLimit` is defined in `auth.php` which is already required. No extra require needed.

- [ ] **Step 3.3 — PHP syntax check both files**

```bash
php -l api/auth/signup.php && php -l api/users.php
```

- [ ] **Step 3.4 — Verify signup creates subscription + seeds config**

```bash
# Register a test tenant
curl -s -X POST http://localhost/flowstack/api/auth/signup.php \
  -H "Content-Type: application/json" \
  -d '{"email":"test_saas@test.com","password":"test1234","display_name":"Test User","company_name":"Test Co"}' | python -m json.tool

# Check subscription was created
mysql -u root flowstack -e "SELECT s.plan, s.expires_at, s.status FROM subscriptions s JOIN tenants t ON t.id=s.tenant_id WHERE t.slug LIKE 'test%' ORDER BY s.created_at DESC LIMIT 1;"

# Check seed ran
mysql -u root flowstack -e "SELECT tenant_id, company_name FROM company_settings WHERE company_name='Test Co';"

# Cleanup
mysql -u root flowstack -e "DELETE FROM users WHERE email='test_saas@test.com';"
```

- [ ] **Step 3.5 — Commit**

```bash
git add api/auth/signup.php api/users.php
git commit -m "feat(saas): upgrade signup with company_name, subscription, seedTenantDefaults; enforce user limit"
```

---

## Task 4: Superadmin API Endpoints

**Files:**
- Create: `api/superadmin/tenants.php`
- Create: `api/superadmin/plan-limits.php`
- Create: `api/superadmin/payments.php`
- Create: `api/superadmin/users.php`
- Create: `api/superadmin/overview.php`

- [ ] **Step 4.1 — Create `api/superadmin/tenants.php`**

```php
<?php
require_once __DIR__ . '/../auth.php';
requireSuperAdmin();
$db     = getDB();
$method = getMethod();
$id     = $_GET['id'] ?? null;

if ($method === 'GET') {
    $stmt = $db->query("
        SELECT t.id, t.name, t.slug, t.plan, t.status, t.created_at,
               s.expires_at, s.status AS sub_status,
               (SELECT COUNT(*) FROM tenant_users tu WHERE tu.tenant_id = t.id) AS user_count,
               pl.max_users
        FROM tenants t
        LEFT JOIN subscriptions s ON s.tenant_id = t.id
        LEFT JOIN plan_limits pl ON pl.plan = s.plan
        ORDER BY t.created_at DESC
    ");
    jsonResponse($stmt->fetchAll(PDO::FETCH_ASSOC));
}

if ($method === 'PUT' && $id) {
    $body = getRequestBody();
    $updates = []; $params = [];
    if (isset($body['plan'])) {
        $updates[] = 'plan = ?'; $params[] = $body['plan'];
    }
    if (isset($body['status'])) {
        $updates[] = 'status = ?'; $params[] = $body['status'];
    }
    if (!empty($updates)) {
        $params[] = $id;
        $db->prepare('UPDATE tenants SET ' . implode(', ', $updates) . ' WHERE id = ?')->execute($params);
    }
    // Update subscription plan too
    if (isset($body['plan'])) {
        $db->prepare("UPDATE subscriptions SET plan = ?, status = 'active' WHERE tenant_id = ?")
           ->execute([$body['plan'], $id]);
    }
    $stmt = $db->prepare('SELECT * FROM tenants WHERE id = ?');
    $stmt->execute([$id]);
    jsonResponse($stmt->fetch(PDO::FETCH_ASSOC));
}

jsonError('Method not allowed', 405);
```

- [ ] **Step 4.2 — Create `api/superadmin/plan-limits.php`**

```php
<?php
require_once __DIR__ . '/../auth.php';
requireSuperAdmin();
$db     = getDB();
$method = getMethod();

if ($method === 'GET') {
    $stmt = $db->query('SELECT * FROM plan_limits ORDER BY FIELD(plan,"trial","starter","pro","enterprise")');
    jsonResponse($stmt->fetchAll(PDO::FETCH_ASSOC));
}

if ($method === 'PUT') {
    $body = getRequestBody();
    $plan = $body['plan'] ?? null;
    if (!$plan) jsonError('plan required', 400);
    $updates = []; $params = [];
    if (isset($body['max_users']))  { $updates[] = 'max_users = ?';  $params[] = (int)$body['max_users']; }
    if (isset($body['price_thb']))  { $updates[] = 'price_thb = ?';  $params[] = (float)$body['price_thb']; }
    if (isset($body['trial_days'])) { $updates[] = 'trial_days = ?'; $params[] = (int)$body['trial_days']; }
    if (empty($updates)) jsonError('Nothing to update', 400);
    $params[] = $plan;
    $db->prepare('UPDATE plan_limits SET ' . implode(', ', $updates) . ' WHERE plan = ?')->execute($params);
    $stmt = $db->prepare('SELECT * FROM plan_limits WHERE plan = ?');
    $stmt->execute([$plan]);
    jsonResponse($stmt->fetch(PDO::FETCH_ASSOC));
}

jsonError('Method not allowed', 405);
```

- [ ] **Step 4.3 — Create `api/superadmin/payments.php`**

```php
<?php
require_once __DIR__ . '/../auth.php';
$superAdmin = requireSuperAdmin();
$db     = getDB();
$method = getMethod();
$action = $_GET['action'] ?? null;

if ($method === 'GET') {
    $status = $_GET['status'] ?? 'pending';
    $stmt = $db->prepare("
        SELECT p.*, i.amount AS invoice_amount, i.plan, i.due_date,
               t.name AS tenant_name
        FROM payments p
        JOIN invoices i ON i.id = p.invoice_id
        JOIN tenants t ON t.id = i.tenant_id
        WHERE p.status = ?
        ORDER BY p.submitted_at DESC
    ");
    $stmt->execute([$status]);
    jsonResponse($stmt->fetchAll(PDO::FETCH_ASSOC));
}

if ($method === 'POST' && $action === 'approve') {
    $body = getRequestBody();
    $paymentId = $body['payment_id'] ?? null;
    if (!$paymentId) jsonError('payment_id required', 400);

    $payStmt = $db->prepare('SELECT p.*, i.tenant_id, i.plan FROM payments p JOIN invoices i ON i.id = p.invoice_id WHERE p.id = ?');
    $payStmt->execute([$paymentId]);
    $payment = $payStmt->fetch(PDO::FETCH_ASSOC);
    if (!$payment) jsonError('Payment not found', 404);

    $db->beginTransaction();
    try {
        $db->prepare("UPDATE payments SET status='approved', verified_at=NOW(), verified_by=? WHERE id=?")
           ->execute([$superAdmin['user_id'], $paymentId]);
        $db->prepare("UPDATE invoices SET status='paid', updated_at=NOW() WHERE id=?")
           ->execute([$payment['invoice_id']]);
        // Extend subscription by 1 month
        $db->prepare("
            UPDATE subscriptions
            SET plan=?, status='active',
                expires_at = DATE_ADD(GREATEST(COALESCE(expires_at, NOW()), NOW()), INTERVAL 1 MONTH)
            WHERE tenant_id=?
        ")->execute([$payment['plan'], $payment['tenant_id']]);
        $db->commit();
    } catch (Exception $e) {
        $db->rollBack();
        jsonError('approve failed: ' . $e->getMessage(), 500);
    }
    jsonResponse(['ok' => true]);
}

if ($method === 'POST' && $action === 'reject') {
    $body = getRequestBody();
    $paymentId = $body['payment_id'] ?? null;
    $note      = $body['note'] ?? 'ปฏิเสธโดย superadmin';
    if (!$paymentId) jsonError('payment_id required', 400);
    $db->prepare("UPDATE payments SET status='rejected', verified_at=NOW(), verified_by=?, note=? WHERE id=?")
       ->execute([$superAdmin['user_id'], $note, $paymentId]);
    jsonResponse(['ok' => true]);
}

jsonError('Method not allowed', 405);
```

- [ ] **Step 4.4 — Create `api/superadmin/users.php`**

```php
<?php
require_once __DIR__ . '/../auth.php';
requireSuperAdmin();
$db     = getDB();
$method = getMethod();

if ($method === 'GET') {
    $search = trim($_GET['search'] ?? '');
    $sql = "
        SELECT u.id, u.email, u.display_name, u.is_active, u.created_at,
               t.name AS tenant_name, t.id AS tenant_id, s.plan, tu.is_admin
        FROM users u
        JOIN tenant_users tu ON tu.user_id = u.id
        JOIN tenants t ON t.id = tu.tenant_id
        LEFT JOIN subscriptions s ON s.tenant_id = t.id
    ";
    $params = [];
    if ($search !== '') {
        $sql .= ' WHERE u.email LIKE ? OR u.display_name LIKE ? OR t.name LIKE ?';
        $like = "%$search%";
        $params = [$like, $like, $like];
    }
    $sql .= ' ORDER BY u.created_at DESC LIMIT 200';
    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    jsonResponse($stmt->fetchAll(PDO::FETCH_ASSOC));
}

if ($method === 'PUT') {
    $id   = $_GET['id'] ?? null;
    $body = getRequestBody();
    if (!$id) jsonError('id required', 400);
    if (isset($body['is_active'])) {
        $db->prepare('UPDATE users SET is_active = ? WHERE id = ?')
           ->execute([(int)$body['is_active'], $id]);
    }
    jsonResponse(['ok' => true]);
}

jsonError('Method not allowed', 405);
```

- [ ] **Step 4.5 — Create `api/superadmin/overview.php`**

```php
<?php
require_once __DIR__ . '/../auth.php';
requireSuperAdmin();
$db = getDB();

$tenants     = (int)$db->query('SELECT COUNT(*) FROM tenants')->fetchColumn();
$active      = (int)$db->query("SELECT COUNT(*) FROM subscriptions WHERE status='active'")->fetchColumn();
$trial       = (int)$db->query("SELECT COUNT(*) FROM subscriptions WHERE plan='trial'")->fetchColumn();
$users       = (int)$db->query('SELECT COUNT(*) FROM users WHERE is_active=1')->fetchColumn();
$pendingPay  = (int)$db->query("SELECT COUNT(*) FROM payments WHERE status='pending'")->fetchColumn();
$mrr         = (float)$db->query("
    SELECT COALESCE(SUM(pl.price_thb),0)
    FROM subscriptions s
    JOIN plan_limits pl ON pl.plan = s.plan
    WHERE s.status='active' AND s.plan != 'trial'
")->fetchColumn();

// Signups last 6 months
$signups = $db->query("
    SELECT DATE_FORMAT(created_at,'%Y-%m') AS month, COUNT(*) AS count
    FROM tenants
    WHERE created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
    GROUP BY month ORDER BY month
")->fetchAll(PDO::FETCH_ASSOC);

jsonResponse([
    'tenants'         => $tenants,
    'active_subs'     => $active,
    'trial_count'     => $trial,
    'users'           => $users,
    'pending_payments'=> $pendingPay,
    'mrr_thb'         => $mrr,
    'signups_6m'      => $signups,
]);
```

- [ ] **Step 4.6 — PHP syntax check all 5 files**

```bash
for f in api/superadmin/tenants.php api/superadmin/plan-limits.php api/superadmin/payments.php api/superadmin/users.php api/superadmin/overview.php; do
  php -l "C:/xampp/htdocs/flowstack/$f"
done
```

- [ ] **Step 4.7 — Commit**

```bash
git add api/superadmin/
git commit -m "feat(saas): add superadmin API endpoints (tenants, plan-limits, payments, users, overview)"
```

---

## Task 5: Billing API Endpoints

**Files:**
- Create: `api/billing/status.php`
- Create: `api/billing/invoices.php`
- Create: `api/billing/pay.php`
- Create: `api/billing/upload.php`

- [ ] **Step 5.1 — Create `api/billing/status.php`**

```php
<?php
require_once __DIR__ . '/../auth.php';
$user     = requireAuth();
$db       = getDB();
$tenantId = $user['tenant_id'];

$stmt = $db->prepare("
    SELECT s.plan, s.started_at, s.expires_at, s.status,
           pl.max_users, pl.price_thb, pl.trial_days,
           (SELECT COUNT(*) FROM tenant_users tu WHERE tu.tenant_id = s.tenant_id) AS current_users
    FROM subscriptions s
    JOIN plan_limits pl ON pl.plan = s.plan
    WHERE s.tenant_id = ?
");
$stmt->execute([$tenantId]);
$sub = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$sub) {
    // No subscription — return trial defaults
    jsonResponse([
        'plan' => 'trial', 'status' => 'active',
        'max_users' => 1, 'current_users' => 1,
        'expires_at' => null, 'price_thb' => 0,
    ]);
}

// Check if expired and update status
if ($sub['expires_at'] && strtotime($sub['expires_at']) < time() && $sub['status'] === 'active') {
    $db->prepare("UPDATE subscriptions SET status='expired' WHERE tenant_id=?")
       ->execute([$tenantId]);
    $sub['status'] = 'expired';
}

jsonResponse($sub);
```

- [ ] **Step 5.2 — Create `api/billing/invoices.php`**

```php
<?php
require_once __DIR__ . '/../auth.php';
$user     = requireAuth();
$db       = getDB();
$method   = getMethod();
$tenantId = $user['tenant_id'];

if ($method === 'GET') {
    $stmt = $db->prepare("
        SELECT i.*,
               (SELECT p.status FROM payments p WHERE p.invoice_id = i.id ORDER BY p.submitted_at DESC LIMIT 1) AS last_payment_status,
               (SELECT p.id FROM payments p WHERE p.invoice_id = i.id AND p.status='pending' LIMIT 1) AS pending_payment_id
        FROM invoices i
        WHERE i.tenant_id = ?
        ORDER BY i.created_at DESC
    ");
    $stmt->execute([$tenantId]);
    jsonResponse($stmt->fetchAll(PDO::FETCH_ASSOC));
}

// POST: create invoice for plan upgrade
if ($method === 'POST') {
    $body      = getRequestBody();
    $plan      = $body['plan'] ?? null;
    $allowedPlans = ['starter', 'pro', 'enterprise'];
    if (!in_array($plan, $allowedPlans, true)) jsonError('plan ไม่ถูกต้อง', 400);

    $priceStmt = $db->prepare('SELECT price_thb FROM plan_limits WHERE plan = ?');
    $priceStmt->execute([$plan]);
    $price = (float)($priceStmt->fetchColumn() ?? 0);

    $invoiceId = generateUUID();
    $db->prepare("
        INSERT INTO invoices (id, tenant_id, plan, amount, due_date, status)
        VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 7 DAY), 'pending')
    ")->execute([$invoiceId, $tenantId, $plan, $price]);

    $stmt = $db->prepare('SELECT * FROM invoices WHERE id = ?');
    $stmt->execute([$invoiceId]);
    jsonResponse($stmt->fetch(PDO::FETCH_ASSOC), 201);
}

jsonError('Method not allowed', 405);
```

- [ ] **Step 5.3 — Create `api/billing/pay.php`**

```php
<?php
require_once __DIR__ . '/../auth.php';
$user     = requireAuth();
$db       = getDB();
$tenantId = $user['tenant_id'];

if (getMethod() !== 'POST') jsonError('Method not allowed', 405);

$body      = getRequestBody();
$invoiceId = $body['invoice_id'] ?? null;
$method    = $body['method']     ?? null;
$slipUrl   = $body['slip_url']   ?? null;
$note      = $body['note']       ?? null;

if (!$invoiceId || !$method) jsonError('invoice_id and method required', 400);
if (!in_array($method, ['qr', 'bank_transfer'], true)) jsonError('method ไม่ถูกต้อง', 400);

// Verify invoice belongs to this tenant
$invStmt = $db->prepare('SELECT id, amount FROM invoices WHERE id = ? AND tenant_id = ?');
$invStmt->execute([$invoiceId, $tenantId]);
$invoice = $invStmt->fetch(PDO::FETCH_ASSOC);
if (!$invoice) jsonError('ไม่พบ invoice', 404);

// Check no pending payment exists
$existStmt = $db->prepare("SELECT id FROM payments WHERE invoice_id = ? AND status = 'pending'");
$existStmt->execute([$invoiceId]);
if ($existStmt->fetch()) jsonError('มีการชำระเงินที่รอการยืนยันอยู่แล้ว', 400);

$payId = generateUUID();
$db->prepare("
    INSERT INTO payments (id, invoice_id, method, amount, slip_url, note, status, submitted_at)
    VALUES (?, ?, ?, ?, ?, ?, 'pending', NOW())
")->execute([$payId, $invoiceId, $method, $invoice['amount'], $slipUrl, $note]);

jsonResponse(['id' => $payId, 'status' => 'pending'], 201);
```

- [ ] **Step 5.4 — Create `api/billing/upload.php`**

```php
<?php
require_once __DIR__ . '/../auth.php';
requireAuth();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') jsonError('Method not allowed', 405);
if (!isset($_FILES['slip']) || $_FILES['slip']['error'] !== UPLOAD_ERR_OK) jsonError('ไม่พบไฟล์', 400);

$file    = $_FILES['slip'];
$allowed = ['image/jpeg','image/png','image/webp','image/gif','application/pdf'];
$mime    = mime_content_type($file['tmp_name']);
if (!in_array($mime, $allowed)) jsonError("ไฟล์ประเภท $mime ไม่รองรับ", 400);
if ($file['size'] > 5 * 1024 * 1024) jsonError('ไฟล์ต้องไม่เกิน 5MB', 400);

$ext    = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
$stored = uniqid('slip_') . '.' . $ext;
$dir    = __DIR__ . '/../../uploads/billing/';
if (!is_dir($dir)) mkdir($dir, 0777, true);

if (!move_uploaded_file($file['tmp_name'], $dir . $stored)) jsonError('บันทึกไฟล์ล้มเหลว', 500);

jsonResponse(['url' => '/uploads/billing/' . $stored]);
```

- [ ] **Step 5.5 — PHP syntax check**

```bash
for f in api/billing/status.php api/billing/invoices.php api/billing/pay.php api/billing/upload.php; do
  php -l "C:/xampp/htdocs/flowstack/$f"
done
```

- [ ] **Step 5.6 — Commit**

```bash
git add api/billing/
git commit -m "feat(saas): add billing API endpoints (status, invoices, pay, upload)"
```

---

## Task 6: Landing Page

**Files:**
- Create: `src/pages/LandingPage.tsx`
- Modify: `src/App.tsx`
- Modify: `src/hooks/useAuth.tsx`

- [ ] **Step 6.1 — Expose `is_superadmin` in `useAuth.tsx`**

In `src/hooks/useAuth.tsx`, find the `User` interface and add `is_superadmin`:

```tsx
export interface User {
  id: string;
  email: string;
  display_name: string;
  position: string;
  avatar_url?: string;
  is_admin?: number;
  is_active?: number;
  is_superadmin?: number;   // ← add this
  role_id?: number | null;
  role_label?: string | null;
  tenant_id?: string;
  permissions?: string[];
  aliases?: UserAlias[];
}
```

Also update `api/auth/me.php` to include `is_superadmin` in response — find the SELECT and add `u.is_superadmin`:

```sql
-- In api/auth/me.php, find the SELECT * FROM users or SELECT u.* 
-- Add: u.is_superadmin to the column list
```

Check `api/auth/me.php`:

```bash
grep -n "SELECT\|is_superadmin" api/auth/me.php | head -10
```

Add `is_superadmin` to the SELECT if missing.

- [ ] **Step 6.2 — Create `src/pages/LandingPage.tsx`**

```tsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Briefcase, TrendingUp, HeadphonesIcon, GitBranch,
  LayoutTemplate, BarChart3, Check, Globe
} from 'lucide-react';

type Lang = 'th' | 'en';

const T = {
  th: {
    nav_features: 'ฟีเจอร์', nav_pricing: 'ราคา', nav_contact: 'ติดต่อ',
    nav_login: 'เข้าสู่ระบบ', nav_start: 'เริ่มต้นฟรี',
    hero_title: 'ระบบจัดการธุรกิจครบวงจร',
    hero_sub: 'โปรเจกต์ · Sales Pipeline · Support Helpdesk · BPM · Content · Analytics',
    hero_cta: 'ทดลองใช้ฟรี 30 วัน — ไม่ต้องใส่บัตรเครดิต',
    hero_demo: 'ดูตัวอย่าง',
    feat_title: 'ทุกอย่างที่ธุรกิจต้องการ ในที่เดียว',
    features: [
      { icon: Briefcase,       title: 'Projects & Tasks',  desc: 'จัดการโปรเจกต์, งาน, WBS และบันทึกชั่วโมงการทำงาน' },
      { icon: TrendingUp,      title: 'Sales Pipeline',    desc: 'ติดตามโอกาสการขาย ใบเสนอราคา และปิดดีล' },
      { icon: HeadphonesIcon,  title: 'Support Helpdesk',  desc: 'จัดการ ticket ลูกค้าพร้อม SLA และ AI ช่วยวิเคราะห์' },
      { icon: GitBranch,       title: 'BPM Workflow',      desc: 'ออกแบบกระบวนการทำงาน ตรวจคอขวด วิเคราะห์ประสิทธิภาพ' },
      { icon: LayoutTemplate,  title: 'Content Planner',   desc: 'วางแผนคอนเทนต์หลายแพลตฟอร์ม ส่ง email campaign' },
      { icon: BarChart3,       title: 'Analytics & KPI',   desc: 'Dashboard ภาพรวม รายงาน KPI รายบุคคลและทีม' },
    ],
    price_title: 'ราคาที่เหมาะกับทุกขนาดธุรกิจ',
    plans: [
      { name: 'Trial',      price: 'ฟรี',         period: '30 วัน',   users: '1 user',    badge: null,     cta: 'เริ่มต้นเลย',   highlight: false },
      { name: 'Starter',    price: '990',          period: 'บาท/เดือน', users: '5 users',   badge: null,     cta: 'เลือกแผนนี้',   highlight: false },
      { name: 'Pro',        price: '2,990',        period: 'บาท/เดือน', users: '20 users',  badge: 'แนะนำ',  cta: 'เลือกแผนนี้',   highlight: true  },
      { name: 'Enterprise', price: 'ติดต่อ',       period: '',          users: 'ไม่จำกัด',  badge: null,     cta: 'ติดต่อทีม',     highlight: false },
    ],
    plan_features: ['โปรเจกต์และงาน', 'Sales Pipeline', 'Support Helpdesk', 'BPM Workflow', 'Content Planner', 'Analytics'],
    steps_title: 'เริ่มต้นได้ใน 3 ขั้นตอน',
    steps: [
      { n: '1', title: 'สมัครฟรี',          desc: 'สร้างบัญชีด้วยอีเมล ไม่ต้องใส่ข้อมูลบัตร' },
      { n: '2', title: 'ตั้งค่าบริษัท',      desc: 'ระบุชื่อบริษัท เพิ่มสมาชิกทีม ตั้งค่าใน 5 นาที' },
      { n: '3', title: 'เริ่มใช้งาน',        desc: 'สร้างโปรเจกต์แรก ติดตามงานและยอดขายได้เลย' },
    ],
    cta_title: 'พร้อมเริ่มต้นแล้วหรือยัง?',
    cta_sub:   'ทดลองใช้ฟรี 30 วัน ไม่ต้องใส่บัตรเครดิต ยกเลิกได้ทุกเมื่อ',
    cta_btn:   'เริ่มต้นฟรีวันนี้',
    footer_copy: '© 2026 Flowstack — ระบบจัดการธุรกิจครบวงจร',
  },
  en: {
    nav_features: 'Features', nav_pricing: 'Pricing', nav_contact: 'Contact',
    nav_login: 'Log in', nav_start: 'Start Free',
    hero_title: 'All-in-One Business Management Platform',
    hero_sub: 'Projects · Sales Pipeline · Support Helpdesk · BPM · Content · Analytics',
    hero_cta: 'Try free for 30 days — no credit card required',
    hero_demo: 'See demo',
    feat_title: 'Everything your business needs, in one place',
    features: [
      { icon: Briefcase,       title: 'Projects & Tasks',  desc: 'Manage projects, tasks, WBS and log work hours' },
      { icon: TrendingUp,      title: 'Sales Pipeline',    desc: 'Track opportunities, quotations and close deals' },
      { icon: HeadphonesIcon,  title: 'Support Helpdesk',  desc: 'Manage customer tickets with SLA and AI analysis' },
      { icon: GitBranch,       title: 'BPM Workflow',      desc: 'Design workflows, detect bottlenecks, analyze performance' },
      { icon: LayoutTemplate,  title: 'Content Planner',   desc: 'Plan multi-platform content and send email campaigns' },
      { icon: BarChart3,       title: 'Analytics & KPI',   desc: 'Overview dashboard, KPI reports for individuals and teams' },
    ],
    price_title: 'Pricing for every business size',
    plans: [
      { name: 'Trial',      price: 'Free',    period: '30 days',    users: '1 user',      badge: null,         cta: 'Start now',    highlight: false },
      { name: 'Starter',    price: '990',     period: 'THB/month',  users: '5 users',     badge: null,         cta: 'Choose plan',  highlight: false },
      { name: 'Pro',        price: '2,990',   period: 'THB/month',  users: '20 users',    badge: 'Popular',    cta: 'Choose plan',  highlight: true  },
      { name: 'Enterprise', price: 'Contact', period: '',            users: 'Unlimited',   badge: null,         cta: 'Contact us',   highlight: false },
    ],
    plan_features: ['Projects & Tasks', 'Sales Pipeline', 'Support Helpdesk', 'BPM Workflow', 'Content Planner', 'Analytics'],
    steps_title: 'Get started in 3 steps',
    steps: [
      { n: '1', title: 'Sign up free',    desc: 'Create an account with email. No card needed.' },
      { n: '2', title: 'Setup company',   desc: 'Add company name, invite team members in 5 minutes.' },
      { n: '3', title: 'Start working',   desc: 'Create your first project and track deals right away.' },
    ],
    cta_title: 'Ready to get started?',
    cta_sub:   'Free 30-day trial. No credit card. Cancel anytime.',
    cta_btn:   'Start free today',
    footer_copy: '© 2026 Flowstack — All-in-One Business Management',
  },
} as const;

export default function LandingPage() {
  const [lang, setLang] = useState<Lang>('th');
  const t = T[lang];

  return (
    <div className="min-h-screen bg-white text-slate-800 font-sans">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 border-b bg-white/95 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <span className="text-xl font-bold text-primary">Flowstack</span>
          <div className="hidden md:flex items-center gap-6 text-sm text-slate-600">
            <a href="#features" className="hover:text-primary transition-colors">{t.nav_features}</a>
            <a href="#pricing"  className="hover:text-primary transition-colors">{t.nav_pricing}</a>
            <a href="#contact"  className="hover:text-primary transition-colors">{t.nav_contact}</a>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setLang(l => l === 'th' ? 'en' : 'th')}
              className="flex items-center gap-1 text-xs border rounded-full px-2.5 py-1 hover:bg-slate-50 transition-colors"
            >
              <Globe className="h-3 w-3" />
              {lang === 'th' ? 'EN' : 'TH'}
            </button>
            <Link to="/auth"><Button variant="ghost" size="sm">{t.nav_login}</Button></Link>
            <Link to="/auth?mode=signup"><Button size="sm">{t.nav_start}</Button></Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="py-24 px-4 text-center bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-3xl mx-auto">
          <Badge className="mb-4 bg-primary/10 text-primary border-primary/20 hover:bg-primary/10">
            SaaS Platform
          </Badge>
          <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 leading-tight mb-4">
            {t.hero_title}
          </h1>
          <p className="text-lg text-slate-500 mb-8">{t.hero_sub}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/auth?mode=signup">
              <Button size="lg" className="gap-2 px-8">{t.hero_cta}</Button>
            </Link>
            <Button size="lg" variant="outline" className="gap-2 px-8">
              {t.hero_demo}
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 px-4 bg-white">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">{t.feat_title}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {t.features.map((f) => (
              <div key={f.title} className="rounded-xl border p-6 hover:shadow-md transition-shadow">
                <f.icon className="h-8 w-8 text-primary mb-3" />
                <h3 className="font-semibold text-lg mb-1">{f.title}</h3>
                <p className="text-slate-500 text-sm">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 px-4 bg-slate-50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">{t.price_title}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {t.plans.map((plan) => (
              <div key={plan.name} className={`rounded-xl border p-6 bg-white flex flex-col gap-4 ${plan.highlight ? 'border-primary ring-2 ring-primary/20 shadow-lg' : ''}`}>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold text-lg">{plan.name}</h3>
                    {plan.badge && <Badge className="text-xs">{plan.badge}</Badge>}
                  </div>
                  <div className="text-3xl font-bold text-slate-900">
                    {plan.price === 'ฟรี' || plan.price === 'Free' || plan.price === 'Contact' || plan.price === 'ติดต่อ'
                      ? plan.price
                      : `฿${plan.price}`}
                    {plan.period && <span className="text-sm font-normal text-slate-500 ml-1">/{plan.period}</span>}
                  </div>
                  <div className="text-sm text-slate-500 mt-1">{plan.users}</div>
                </div>
                <ul className="space-y-2 flex-1">
                  {t.plan_features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-green-500 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link to={plan.name === 'Enterprise' || plan.name === 'ติดต่อ' ? '#contact' : '/auth?mode=signup'}>
                  <Button className="w-full" variant={plan.highlight ? 'default' : 'outline'}>
                    {plan.cta}
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section className="py-20 px-4 bg-white">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-12">{t.steps_title}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {t.steps.map((step) => (
              <div key={step.n} className="flex flex-col items-center">
                <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xl font-bold mb-4">
                  {step.n}
                </div>
                <h3 className="font-semibold mb-1">{step.title}</h3>
                <p className="text-slate-500 text-sm">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section id="contact" className="py-16 px-4 bg-primary text-primary-foreground text-center">
        <h2 className="text-3xl font-bold mb-2">{t.cta_title}</h2>
        <p className="mb-6 opacity-90">{t.cta_sub}</p>
        <Link to="/auth?mode=signup">
          <Button size="lg" variant="secondary" className="px-10">{t.cta_btn}</Button>
        </Link>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t text-center text-sm text-slate-500">
        <p>{t.footer_copy}</p>
      </footer>
    </div>
  );
}
```

- [ ] **Step 6.3 — Update `src/App.tsx` to render LandingPage at `/` when unauthenticated**

In `src/App.tsx`, add the LandingPage import at the top:
```tsx
const LandingPage = lazy(() => import('./pages/LandingPage'));
```

Find the `ProtectedRoute` component and the `/auth` route. The `/` route currently uses `PermissionRoute`. Change the routing so that unauthenticated users see `LandingPage` at `/`. The simplest approach: add a new `PublicRoute` component:

```tsx
// Renders LandingPage for guests, redirects logged-in users to home dashboard
const RootRoute = () => {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (user) return <Navigate to="/" replace />;  // will hit PermissionRoute for home
  return <LandingPage />;
};
```

Wait — that creates a loop. Use a different path:

```tsx
// Add route: /landing renders LandingPage always
// Change / to: show LandingPage if !user, else show dashboard
```

Actual approach in App.tsx — replace the `/` route:
```tsx
// BEFORE
<Route path="/" element={<PermissionRoute menuKey="home"><HomePage /></PermissionRoute>} />

// AFTER
<Route path="/" element={
  <AuthGate
    guest={<LandingPage />}
    auth={<PermissionRoute menuKey="home"><HomePage /></PermissionRoute>}
  />
} />
```

Add `AuthGate` component above `ProtectedRoute`:
```tsx
const AuthGate = ({ guest, auth }: { guest: React.ReactNode; auth: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  return user ? <>{auth}</> : <>{guest}</>;
};
```

Also add `/billing` and `/superadmin` routes:
```tsx
const BillingPage    = lazy(() => import('./pages/BillingPage'));
const SuperAdminPage = lazy(() => import('./pages/SuperAdminPage'));

// Inside Routes:
<Route path="/billing"    element={<ProtectedRoute><BillingPage /></ProtectedRoute>} />
<Route path="/superadmin" element={<ProtectedRoute><SuperAdminPage /></ProtectedRoute>} />
```

- [ ] **Step 6.4 — TypeScript check**

```bash
cd "C:/xampp/htdocs/flowstack" && npx tsc --noEmit --skipLibCheck 2>&1 | head -20
```

- [ ] **Step 6.5 — Commit**

```bash
git add src/pages/LandingPage.tsx src/App.tsx src/hooks/useAuth.tsx
git commit -m "feat(saas): add public landing page with TH/EN toggle + routing"
```

---

## Task 7: React Hooks for Billing + Superadmin

**Files:**
- Create: `src/hooks/useBilling.ts`
- Create: `src/hooks/useSuperAdmin.ts`

- [ ] **Step 7.1 — Create `src/hooks/useBilling.ts`**

```ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, apiUpload } from '@/lib/api';

export interface BillingStatus {
  plan: 'trial' | 'starter' | 'pro' | 'enterprise';
  status: 'active' | 'expired' | 'cancelled' | 'suspended';
  started_at: string;
  expires_at: string | null;
  max_users: number;
  current_users: number;
  price_thb: number;
}

export interface Invoice {
  id: string;
  plan: string;
  amount: number;
  due_date: string;
  status: 'pending' | 'paid' | 'overdue' | 'cancelled';
  created_at: string;
  last_payment_status: string | null;
  pending_payment_id: string | null;
}

export function useBillingStatus() {
  return useQuery<BillingStatus>({
    queryKey: ['billing-status'],
    queryFn: () => apiFetch('/billing/status.php'),
    staleTime: 60_000,
  });
}

export function useInvoices() {
  return useQuery<Invoice[]>({
    queryKey: ['billing-invoices'],
    queryFn: () => apiFetch('/billing/invoices.php'),
    staleTime: 30_000,
  });
}

export function useCreateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (plan: string) => apiFetch('/billing/invoices.php', {
      method: 'POST',
      body: JSON.stringify({ plan }),
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['billing-invoices'] }),
  });
}

export function useSubmitPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { invoice_id: string; method: 'qr' | 'bank_transfer'; slip_url?: string; note?: string }) =>
      apiFetch('/billing/pay.php', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['billing-invoices'] });
      qc.invalidateQueries({ queryKey: ['billing-status'] });
    },
  });
}

export function useUploadSlip() {
  return useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append('slip', file);
      return apiUpload<{ url: string }>('/billing/upload.php', fd);
    },
  });
}

export function usePaymentMethods() {
  return useQuery<any[]>({
    queryKey: ['payment-methods'],
    queryFn: () => apiFetch('/billing/methods.php'),
    staleTime: 300_000,
  });
}
```

- [ ] **Step 7.2 — Create `src/hooks/useSuperAdmin.ts`**

```ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';

export function useSuperAdminOverview() {
  return useQuery<any>({
    queryKey: ['superadmin-overview'],
    queryFn: () => apiFetch('/superadmin/overview.php'),
    staleTime: 60_000,
  });
}

export function useSuperAdminTenants() {
  return useQuery<any[]>({
    queryKey: ['superadmin-tenants'],
    queryFn: () => apiFetch('/superadmin/tenants.php'),
    staleTime: 30_000,
  });
}

export function useUpdateTenant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; plan?: string; status?: string }) =>
      apiFetch(`/superadmin/tenants.php?id=${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['superadmin-tenants'] }),
  });
}

export function usePlanLimits() {
  return useQuery<any[]>({
    queryKey: ['plan-limits'],
    queryFn: () => apiFetch('/superadmin/plan-limits.php'),
    staleTime: 300_000,
  });
}

export function useUpdatePlanLimit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { plan: string; max_users?: number; price_thb?: number }) =>
      apiFetch('/superadmin/plan-limits.php', { method: 'PUT', body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plan-limits'] }),
  });
}

export function usePendingPayments() {
  return useQuery<any[]>({
    queryKey: ['superadmin-payments'],
    queryFn: () => apiFetch('/superadmin/payments.php?status=pending'),
    staleTime: 15_000,
  });
}

export function useApprovePayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (paymentId: string) =>
      apiFetch('/superadmin/payments.php?action=approve', {
        method: 'POST', body: JSON.stringify({ payment_id: paymentId }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['superadmin-payments'] });
      qc.invalidateQueries({ queryKey: ['superadmin-tenants'] });
    },
  });
}

export function useRejectPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ paymentId, note }: { paymentId: string; note: string }) =>
      apiFetch('/superadmin/payments.php?action=reject', {
        method: 'POST', body: JSON.stringify({ payment_id: paymentId, note }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['superadmin-payments'] }),
  });
}

export function useSuperAdminUsers(search = '') {
  return useQuery<any[]>({
    queryKey: ['superadmin-users', search],
    queryFn: () => apiFetch(`/superadmin/users.php${search ? `?search=${encodeURIComponent(search)}` : ''}`),
    staleTime: 30_000,
  });
}
```

- [ ] **Step 7.3 — TypeScript check**

```bash
npx tsc --noEmit --skipLibCheck 2>&1 | head -10
```

- [ ] **Step 7.4 — Commit**

```bash
git add src/hooks/useBilling.ts src/hooks/useSuperAdmin.ts
git commit -m "feat(saas): add useBilling and useSuperAdmin React Query hooks"
```

---

## Task 8: Billing Page UI + Expiry Lock

**Files:**
- Create: `src/pages/BillingPage.tsx`
- Modify: `src/components/DashboardLayout.tsx`

- [ ] **Step 8.1 — Create `src/pages/BillingPage.tsx`**

```tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Loader2, CreditCard, Upload, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import PageShell from '@/components/PageShell';
import { useToast } from '@/hooks/use-toast';
import { useBillingStatus, useInvoices, useCreateInvoice, useSubmitPayment, useUploadSlip } from '@/hooks/useBilling';
import { format, parseISO } from 'date-fns';

const PLAN_LABELS: Record<string, string> = {
  trial: 'ทดลองใช้', starter: 'Starter', pro: 'Pro', enterprise: 'Enterprise',
};
const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  active:    { label: 'ใช้งาน',      color: 'bg-green-100 text-green-700' },
  expired:   { label: 'หมดอายุ',     color: 'bg-red-100 text-red-700' },
  suspended: { label: 'ระงับ',       color: 'bg-orange-100 text-orange-700' },
  cancelled: { label: 'ยกเลิกแล้ว', color: 'bg-slate-100 text-slate-700' },
};

export default function BillingPage() {
  const { toast } = useToast();
  const { data: status, isLoading: statusLoading } = useBillingStatus();
  const { data: invoices = [], isLoading: invoicesLoading } = useInvoices();
  const createInvoice = useCreateInvoice();
  const submitPayment = useSubmitPayment();
  const uploadSlip    = useUploadSlip();

  const [payDialog, setPayDialog] = useState<{ invoiceId: string; amount: number } | null>(null);
  const [payMethod, setPayMethod] = useState<'qr' | 'bank_transfer'>('qr');
  const [slipFile, setSlipFile]   = useState<File | null>(null);
  const [note, setNote]           = useState('');
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const handlePay = async () => {
    if (!payDialog) return;
    try {
      let slipUrl: string | undefined;
      if (slipFile) {
        const res = await uploadSlip.mutateAsync(slipFile);
        slipUrl = res.url;
      }
      await submitPayment.mutateAsync({
        invoice_id: payDialog.invoiceId,
        method: payMethod,
        slip_url: slipUrl,
        note,
      });
      toast({ title: 'ส่งหลักฐานการชำระเงินแล้ว รอ superadmin ยืนยัน' });
      setPayDialog(null);
    } catch (e: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: e.message, variant: 'destructive' });
    }
  };

  const handleUpgrade = async (plan: string) => {
    try {
      await createInvoice.mutateAsync(plan);
      toast({ title: 'สร้าง invoice สำเร็จ กรุณาชำระเงิน' });
      setUpgradeOpen(false);
    } catch (e: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: e.message, variant: 'destructive' });
    }
  };

  if (statusLoading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );

  const isExpired = status?.status === 'expired';

  return (
    <PageShell title="การสมัครสมาชิก" description="จัดการแผนและการชำระเงิน">
      {isExpired && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
          <div>
            <p className="font-semibold text-red-700">แผนของคุณหมดอายุแล้ว</p>
            <p className="text-sm text-red-600">กรุณาชำระเงินเพื่อใช้งานต่อ</p>
          </div>
        </div>
      )}

      {/* Current Plan */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            แผนปัจจุบัน
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">แผน</p>
            <p className="font-bold text-lg">{PLAN_LABELS[status?.plan ?? 'trial']}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">สถานะ</p>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_LABELS[status?.status ?? 'active']?.color}`}>
              {STATUS_LABELS[status?.status ?? 'active']?.label}
            </span>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Users</p>
            <p className="font-medium">{status?.current_users ?? 0} / {status?.max_users === 0 ? '∞' : status?.max_users ?? 1}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">หมดอายุ</p>
            <p className="font-medium text-sm">
              {status?.expires_at ? format(parseISO(status.expires_at), 'dd MMM yyyy') : 'ไม่มีกำหนด'}
            </p>
          </div>
        </CardContent>
        {status?.plan !== 'enterprise' && (
          <div className="px-6 pb-6">
            <Button variant="outline" onClick={() => setUpgradeOpen(true)}>
              อัปเกรดแผน
            </Button>
          </div>
        )}
      </Card>

      {/* Invoices */}
      <Card>
        <CardHeader><CardTitle>ประวัติ Invoice</CardTitle></CardHeader>
        <CardContent>
          {invoicesLoading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : invoices.length === 0 ? (
            <p className="text-center text-muted-foreground py-6 text-sm">ยังไม่มี invoice</p>
          ) : (
            <div className="space-y-2">
              {invoices.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <p className="font-medium text-sm">Invoice #{inv.id.slice(0, 8).toUpperCase()}</p>
                    <p className="text-xs text-muted-foreground">
                      {PLAN_LABELS[inv.plan]} · ครบกำหนด {format(parseISO(inv.due_date), 'dd MMM yyyy')}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold">฿{Number(inv.amount).toLocaleString()}</span>
                    {inv.status === 'paid' && <Badge className="bg-green-100 text-green-700 text-xs">ชำระแล้ว</Badge>}
                    {inv.status === 'pending' && inv.last_payment_status === 'pending' && (
                      <Badge className="bg-amber-100 text-amber-700 text-xs flex items-center gap-1">
                        <Clock className="h-3 w-3" /> รอยืนยัน
                      </Badge>
                    )}
                    {inv.status === 'pending' && inv.last_payment_status !== 'pending' && (
                      <Button size="sm" onClick={() => setPayDialog({ invoiceId: inv.id, amount: inv.amount })}>
                        ชำระเงิน
                      </Button>
                    )}
                    {inv.status === 'overdue' && (
                      <Badge variant="destructive" className="text-xs">เกินกำหนด</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment Dialog */}
      <Dialog open={!!payDialog} onOpenChange={(o) => { if (!o) setPayDialog(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>ชำระเงิน ฿{payDialog?.amount?.toLocaleString()}</DialogTitle></DialogHeader>
          <Tabs value={payMethod} onValueChange={(v) => setPayMethod(v as any)}>
            <TabsList className="w-full">
              <TabsTrigger value="qr" className="flex-1">QR Code</TabsTrigger>
              <TabsTrigger value="bank_transfer" className="flex-1">โอนเงิน</TabsTrigger>
            </TabsList>
            <TabsContent value="qr" className="space-y-3 pt-2">
              <div className="rounded-lg bg-slate-50 p-6 text-center">
                <p className="text-sm text-muted-foreground">สแกน QR PromptPay</p>
                <div className="w-40 h-40 bg-slate-200 rounded-lg mx-auto mt-3 flex items-center justify-center text-xs text-slate-400">
                  QR Image
                </div>
                <p className="font-bold mt-2">฿{payDialog?.amount?.toLocaleString()}</p>
              </div>
            </TabsContent>
            <TabsContent value="bank_transfer" className="space-y-2 pt-2">
              <div className="rounded-lg bg-slate-50 p-4 text-sm space-y-1">
                <p><span className="text-muted-foreground">ธนาคาร:</span> กสิกรไทย</p>
                <p><span className="text-muted-foreground">ชื่อบัญชี:</span> บริษัท KTN Business</p>
                <p><span className="text-muted-foreground">เลขบัญชี:</span> 000-0-00000-0</p>
                <p className="font-bold text-primary">ยอดโอน: ฿{payDialog?.amount?.toLocaleString()}</p>
              </div>
            </TabsContent>
          </Tabs>
          <div className="space-y-3">
            <div>
              <Label>แนบสลิป *</Label>
              <Input type="file" accept="image/*,application/pdf" className="mt-1"
                onChange={(e) => setSlipFile(e.target.files?.[0] ?? null)} />
            </div>
            <div>
              <Label>หมายเหตุ (ถ้ามี)</Label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} className="mt-1" placeholder="เช่น โอนวันที่..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayDialog(null)}>ยกเลิก</Button>
            <Button disabled={!slipFile || submitPayment.isPending || uploadSlip.isPending} onClick={handlePay}>
              {(submitPayment.isPending || uploadSlip.isPending) && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              ส่งหลักฐาน
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upgrade Dialog */}
      <Dialog open={upgradeOpen} onOpenChange={setUpgradeOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>อัปเกรดแผน</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {[
              { plan: 'starter', label: 'Starter', price: '990', users: '5 users' },
              { plan: 'pro',     label: 'Pro',     price: '2,990', users: '20 users' },
            ].map((p) => (
              <div key={p.plan} className="flex items-center justify-between p-3 rounded-lg border">
                <div>
                  <p className="font-semibold">{p.label}</p>
                  <p className="text-xs text-muted-foreground">{p.users} · ฿{p.price}/เดือน</p>
                </div>
                <Button size="sm" disabled={createInvoice.isPending}
                  onClick={() => handleUpgrade(p.plan)}>
                  {createInvoice.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'เลือก'}
                </Button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
```

- [ ] **Step 8.2 — Add expiry check in `src/components/DashboardLayout.tsx`**

Find `DashboardLayout` component and add expiry redirect:

```tsx
// Add import at top
import { useBillingStatus } from '@/hooks/useBilling';
import { useNavigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';

// Inside DashboardLayout component body, add:
const { data: billingStatus } = useBillingStatus();
const navigate = useNavigate();
const location = useLocation();

useEffect(() => {
  if (
    billingStatus?.status === 'expired' &&
    !location.pathname.startsWith('/billing') &&
    !location.pathname.startsWith('/profile') &&
    !location.pathname.startsWith('/auth')
  ) {
    navigate('/billing?expired=1', { replace: true });
  }
}, [billingStatus, location.pathname, navigate]);
```

- [ ] **Step 8.3 — TypeScript check**

```bash
npx tsc --noEmit --skipLibCheck 2>&1 | head -20
```

- [ ] **Step 8.4 — Commit**

```bash
git add src/pages/BillingPage.tsx src/components/DashboardLayout.tsx
git commit -m "feat(saas): add BillingPage UI and expiry lock in DashboardLayout"
```

---

## Task 9: Superadmin UI

**Files:**
- Create: `src/pages/SuperAdminPage.tsx`
- Modify: `src/components/AppSidebar.tsx`

- [ ] **Step 9.1 — Create `src/pages/SuperAdminPage.tsx`**

```tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Building2, Users, CreditCard, BarChart3, Check, X, AlertCircle } from 'lucide-react';
import PageShell from '@/components/PageShell';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import {
  useSuperAdminOverview, useSuperAdminTenants, useUpdateTenant,
  usePlanLimits, useUpdatePlanLimit,
  usePendingPayments, useApprovePayment, useRejectPayment,
  useSuperAdminUsers,
} from '@/hooks/useSuperAdmin';
import { format, parseISO } from 'date-fns';

const PLAN_OPTIONS = ['trial','starter','pro','enterprise'];
const STATUS_OPTIONS = ['active','suspended','cancelled'];

export default function SuperAdminPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Guard: must be superadmin
  if (!user?.is_superadmin) {
    navigate('/');
    return null;
  }

  return (
    <PageShell title="⚡ Super Admin" description="จัดการ platform ทั้งหมด">
      <Tabs defaultValue="overview">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="overview"  className="gap-1.5"><BarChart3 size={14} /> Overview</TabsTrigger>
          <TabsTrigger value="tenants"   className="gap-1.5"><Building2 size={14} /> Tenants</TabsTrigger>
          <TabsTrigger value="limits"    className="gap-1.5"><CreditCard size={14} /> Plan Limits</TabsTrigger>
          <TabsTrigger value="payments"  className="gap-1.5"><Check size={14} /> Payments</TabsTrigger>
          <TabsTrigger value="users"     className="gap-1.5"><Users size={14} /> Users</TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview"><OverviewTab /></TabsContent>

        {/* Tenants */}
        <TabsContent value="tenants"><TenantsTab /></TabsContent>

        {/* Plan Limits */}
        <TabsContent value="limits"><PlanLimitsTab /></TabsContent>

        {/* Payments */}
        <TabsContent value="payments"><PaymentsTab /></TabsContent>

        {/* Users */}
        <TabsContent value="users"><UsersTab /></TabsContent>
      </Tabs>
    </PageShell>
  );
}

function OverviewTab() {
  const { data: ov, isLoading } = useSuperAdminOverview();
  if (isLoading) return <div className="py-8 text-center"><Loader2 className="h-6 w-6 animate-spin inline" /></div>;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Tenants',          val: ov?.tenants },
          { label: 'Active',           val: ov?.active_subs },
          { label: 'Trial',            val: ov?.trial_count },
          { label: 'Users',            val: ov?.users },
          { label: 'Pending Pay',      val: ov?.pending_payments },
          { label: 'MRR',              val: `฿${Number(ov?.mrr_thb || 0).toLocaleString()}` },
        ].map(x => (
          <Card key={x.label}>
            <CardContent className="p-4">
              <div className="text-2xl font-bold">{x.val ?? '—'}</div>
              <div className="text-xs text-muted-foreground">{x.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function TenantsTab() {
  const { data: tenants = [], isLoading } = useSuperAdminTenants();
  const updateTenant = useUpdateTenant();
  const { toast } = useToast();

  if (isLoading) return <div className="py-8 text-center"><Loader2 className="h-6 w-6 animate-spin inline" /></div>;
  return (
    <div className="space-y-2">
      {tenants.map((t: any) => (
        <div key={t.id} className="flex flex-wrap items-center gap-3 p-3 rounded-lg border bg-card">
          <div className="flex-1 min-w-40">
            <p className="font-medium text-sm">{t.name}</p>
            <p className="text-xs text-muted-foreground">{t.slug} · {t.user_count}/{t.max_users ?? '∞'} users</p>
            <p className="text-xs text-muted-foreground">
              {t.expires_at ? `หมด ${format(parseISO(t.expires_at), 'dd MMM yy')}` : 'ไม่มีกำหนด'}
            </p>
          </div>
          <Select defaultValue={t.plan} onValueChange={(v) => {
            updateTenant.mutate({ id: t.id, plan: v });
            toast({ title: `อัปเดตแผน ${t.name} → ${v}` });
          }}>
            <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PLAN_OPTIONS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select defaultValue={t.status} onValueChange={(v) => {
            updateTenant.mutate({ id: t.id, status: v });
            toast({ title: `อัปเดตสถานะ ${t.name} → ${v}` });
          }}>
            <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      ))}
    </div>
  );
}

function PlanLimitsTab() {
  const { data: limits = [], isLoading } = usePlanLimits();
  const updateLimit = useUpdatePlanLimit();
  const { toast } = useToast();
  const [editing, setEditing] = useState<Record<string, any>>({});

  if (isLoading) return <div className="py-8 text-center"><Loader2 className="h-6 w-6 animate-spin inline" /></div>;
  return (
    <div className="space-y-3">
      {limits.map((pl: any) => {
        const ed = editing[pl.plan] ?? {};
        return (
          <div key={pl.plan} className="p-4 rounded-lg border bg-card flex flex-wrap items-center gap-4">
            <span className="font-semibold w-24 text-sm capitalize">{pl.plan}</span>
            <div>
              <label className="text-xs text-muted-foreground">Max Users (0=ไม่จำกัด)</label>
              <Input type="number" defaultValue={pl.max_users} className="w-24 h-8 text-sm mt-0.5"
                onChange={e => setEditing(x => ({ ...x, [pl.plan]: { ...ed, max_users: +e.target.value } }))} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">ราคา (฿/เดือน)</label>
              <Input type="number" defaultValue={pl.price_thb} className="w-28 h-8 text-sm mt-0.5"
                onChange={e => setEditing(x => ({ ...x, [pl.plan]: { ...ed, price_thb: +e.target.value } }))} />
            </div>
            <Button size="sm" className="h-8 mt-4" onClick={() => {
              if (!editing[pl.plan]) return;
              updateLimit.mutate({ plan: pl.plan, ...editing[pl.plan] });
              toast({ title: `บันทึก ${pl.plan} สำเร็จ` });
              setEditing(x => { const n = {...x}; delete n[pl.plan]; return n; });
            }} disabled={!editing[pl.plan]}>
              บันทึก
            </Button>
          </div>
        );
      })}
    </div>
  );
}

function PaymentsTab() {
  const { data: payments = [], isLoading } = usePendingPayments();
  const approve = useApprovePayment();
  const reject  = useRejectPayment();
  const { toast } = useToast();

  if (isLoading) return <div className="py-8 text-center"><Loader2 className="h-6 w-6 animate-spin inline" /></div>;
  if (payments.length === 0) return <p className="text-center py-8 text-muted-foreground">ไม่มีรายการรอยืนยัน</p>;

  return (
    <div className="space-y-3">
      {payments.map((p: any) => (
        <div key={p.id} className="p-4 rounded-lg border bg-card flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-40">
            <p className="font-medium text-sm">{p.tenant_name}</p>
            <p className="text-xs text-muted-foreground">
              {p.plan} · ฿{Number(p.amount).toLocaleString()} · {p.method}
            </p>
            {p.slip_url && (
              <a href={p.slip_url} target="_blank" rel="noopener noreferrer"
                className="text-xs text-blue-600 underline">ดูสลิป</a>
            )}
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="gap-1" disabled={approve.isPending} onClick={() => {
              approve.mutate(p.id);
              toast({ title: 'Approve สำเร็จ subscription ขยาย 1 เดือน' });
            }}>
              <Check className="h-3 w-3" /> Approve
            </Button>
            <Button size="sm" variant="destructive" className="gap-1" disabled={reject.isPending} onClick={() => {
              reject.mutate({ paymentId: p.id, note: 'ปฏิเสธโดย superadmin' });
              toast({ title: 'Reject แล้ว' });
            }}>
              <X className="h-3 w-3" /> Reject
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

function UsersTab() {
  const [search, setSearch] = useState('');
  const { data: users = [], isLoading } = useSuperAdminUsers(search);
  return (
    <div className="space-y-3">
      <Input placeholder="ค้นหา email, ชื่อ, บริษัท..." value={search}
        onChange={e => setSearch(e.target.value)} className="max-w-sm" />
      {isLoading && <div className="py-6 text-center"><Loader2 className="h-5 w-5 animate-spin inline" /></div>}
      <div className="space-y-1.5">
        {users.map((u: any) => (
          <div key={`${u.id}-${u.tenant_id}`} className="flex items-center gap-3 p-2.5 rounded-lg border text-sm">
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{u.display_name || u.email}</p>
              <p className="text-xs text-muted-foreground truncate">{u.email} · {u.tenant_name}</p>
            </div>
            <Badge className="text-xs shrink-0">{u.plan}</Badge>
            {u.is_admin ? <Badge variant="secondary" className="text-xs shrink-0">Admin</Badge> : null}
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 9.2 — Add superadmin + billing links to `src/components/AppSidebar.tsx`**

In `AppSidebar.tsx`, find the `NAV_GROUPS` array or the section where navigation items are rendered. Add:

```tsx
// After existing nav groups, add billing link for all authenticated users
// And superadmin link for is_superadmin users

// Find where the sidebar renders the nav items and add at the bottom:
{user && (
  <SidebarMenuItem>
    <SidebarMenuButton asChild>
      <Link to="/billing" className="flex items-center gap-2">
        <CreditCard className="h-4 w-4" />
        <span>การสมัครสมาชิก</span>
        {billingStatus?.status === 'expired' && (
          <Badge variant="destructive" className="text-[10px] ml-auto">หมดอายุ</Badge>
        )}
      </Link>
    </SidebarMenuButton>
  </SidebarMenuItem>
)}
{Number(user?.is_superadmin) === 1 && (
  <SidebarMenuItem>
    <SidebarMenuButton asChild>
      <Link to="/superadmin" className="flex items-center gap-2 text-violet-600">
        <Zap className="h-4 w-4" />
        <span>Super Admin</span>
      </Link>
    </SidebarMenuButton>
  </SidebarMenuItem>
)}
```

Also import `useBillingStatus` and add the hook call to get billing status in the sidebar:
```tsx
import { useBillingStatus } from '@/hooks/useBilling';
// Inside component:
const { data: billingStatus } = useBillingStatus();
```

- [ ] **Step 9.3 — TypeScript check**

```bash
npx tsc --noEmit --skipLibCheck 2>&1 | head -20
```

- [ ] **Step 9.4 — Commit**

```bash
git add src/pages/SuperAdminPage.tsx src/components/AppSidebar.tsx
git commit -m "feat(saas): add SuperAdminPage and billing link in sidebar"
```

---

## Task 10: Email Notifications (Cron)

**Files:**
- Create: `api/cron/billing-reminders.php`

- [ ] **Step 10.1 — Create `api/cron/billing-reminders.php`**

```php
<?php
/**
 * Cron: php api/cron/billing-reminders.php
 * Schedule: daily — checks expiring subscriptions and sends reminders.
 * Also creates overdue invoices for expired subscriptions.
 */
require_once __DIR__ . '/../auth.php';
require_once __DIR__ . '/../config.php';

// Must run from CLI or with CRON_SECRET header
if (PHP_SAPI !== 'cli') {
    $secret = $_SERVER['HTTP_X_CRON_SECRET'] ?? $_GET['secret'] ?? '';
    if (!defined('CRON_SECRET') || $secret !== CRON_SECRET) {
        http_response_code(403); die('Forbidden');
    }
}

$db  = getDB();
$now = date('Y-m-d H:i:s');

// 1. Mark subscriptions as expired if expires_at < NOW()
$db->query("
    UPDATE subscriptions SET status='expired', updated_at=NOW()
    WHERE expires_at IS NOT NULL AND expires_at < NOW() AND status='active'
");
echo "Expired subscriptions updated\n";

// 2. Send reminders: 7 days before + 1 day before
foreach ([7, 1] as $days) {
    $stmt = $db->prepare("
        SELECT s.tenant_id, s.plan, s.expires_at,
               t.name AS tenant_name,
               u.email, u.display_name
        FROM subscriptions s
        JOIN tenants t ON t.id = s.tenant_id
        JOIN tenant_users tu ON tu.tenant_id = t.id AND tu.is_admin = 1
        JOIN users u ON u.id = tu.user_id
        WHERE s.status = 'active'
          AND s.expires_at IS NOT NULL
          AND DATE(s.expires_at) = DATE_ADD(CURDATE(), INTERVAL ? DAY)
    ");
    $stmt->execute([$days]);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    foreach ($rows as $row) {
        $subject = "Flowstack — แผนของคุณจะหมดอายุใน {$days} วัน";
        $body    = "สวัสดีคุณ {$row['display_name']},\n\n"
                 . "แผน {$row['plan']} ของ {$row['tenant_name']} จะหมดอายุในวันที่ "
                 . date('d/m/Y', strtotime($row['expires_at'])) . "\n\n"
                 . "กรุณาเข้าสู่ระบบและชำระเงินที่ /billing\n\n"
                 . "ขอบคุณที่ใช้บริการ Flowstack";

        sendReminderEmail($row['email'], $subject, $body);
        echo "Sent {$days}-day reminder to {$row['email']}\n";
    }
}

// 3. Notify expired tenants (run once on expiry day)
$expiredToday = $db->query("
    SELECT s.tenant_id, s.plan, t.name AS tenant_name,
           u.email, u.display_name
    FROM subscriptions s
    JOIN tenants t ON t.id = s.tenant_id
    JOIN tenant_users tu ON tu.tenant_id = t.id AND tu.is_admin = 1
    JOIN users u ON u.id = tu.user_id
    WHERE s.status = 'expired' AND DATE(s.expires_at) = CURDATE()
")->fetchAll(PDO::FETCH_ASSOC);

foreach ($expiredToday as $row) {
    $subject = "Flowstack — แผนของคุณหมดอายุแล้ว";
    $body    = "สวัสดีคุณ {$row['display_name']},\n\n"
             . "แผน {$row['plan']} ของ {$row['tenant_name']} หมดอายุแล้ว\n\n"
             . "กรุณาชำระเงินที่ /billing เพื่อใช้งานต่อ\n\n"
             . "ขอบคุณที่ใช้บริการ Flowstack";
    sendReminderEmail($row['email'], $subject, $body);
    echo "Sent expiry notice to {$row['email']}\n";
}

echo "Done\n";

function sendReminderEmail(string $to, string $subject, string $body): void {
    // Load SMTP from settings table (same as email-campaigns.php)
    global $db;
    $smtp = $db->query("SELECT `key`, `value` FROM settings WHERE `key` LIKE 'mail_%'")->fetchAll(PDO::FETCH_KEY_PAIR);
    $from = $smtp['mail_from_address'] ?? MAIL_FROM_ADDRESS ?? '';
    if (empty($from)) { echo "  [skip] SMTP not configured\n"; return; }

    // Use PHPMailer
    require_once __DIR__ . '/../../vendor/autoload.php';
    $mail = new \PHPMailer\PHPMailer\PHPMailer(true);
    try {
        $mail->isSMTP();
        $mail->Host       = $smtp['mail_host'] ?? MAIL_HOST;
        $mail->Port       = (int)($smtp['mail_port'] ?? MAIL_PORT);
        $mail->SMTPAuth   = true;
        $mail->Username   = $smtp['mail_username'] ?? MAIL_USERNAME;
        $mail->Password   = $smtp['mail_password'] ?? MAIL_PASSWORD;
        $mail->CharSet    = 'UTF-8';
        $mail->setFrom($from, $smtp['mail_from_name'] ?? 'Flowstack');
        $mail->addAddress($to);
        $mail->Subject    = $subject;
        $mail->Body       = nl2br(htmlspecialchars($body));
        $mail->AltBody    = $body;
        $mail->send();
    } catch (\Exception $e) {
        echo "  [error] Email to $to failed: " . $e->getMessage() . "\n";
    }
}
```

- [ ] **Step 10.2 — PHP syntax check**

```bash
php -l api/cron/billing-reminders.php
```

- [ ] **Step 10.3 — Test dry run (no emails if SMTP not set)**

```bash
php api/cron/billing-reminders.php
```

Expected: `Expired subscriptions updated` + any reminders + `Done`

- [ ] **Step 10.4 — Add cron schedule note**

Add comment to `README` or `docs/`:

```
# Cron jobs
# Daily billing reminders (add to Windows Task Scheduler or crontab):
# 0 8 * * * php /path/to/flowstack/api/cron/billing-reminders.php >> /logs/billing.log 2>&1
```

- [ ] **Step 10.5 — Commit**

```bash
git add api/cron/billing-reminders.php
git commit -m "feat(saas): add billing reminder cron job (7-day, 1-day, expiry)"
```

---

## Task 11: Final TypeScript Check + Smoke Test

- [ ] **Step 11.1 — Full TypeScript check**

```bash
cd "C:/xampp/htdocs/flowstack" && npx tsc --noEmit --skipLibCheck 2>&1
```

Expected: no errors

- [ ] **Step 11.2 — Smoke test: register new tenant**

```bash
curl -s -X POST http://localhost/flowstack/api/auth/signup.php \
  -H "Content-Type: application/json" \
  -d '{"email":"smoke@test.com","password":"test1234","display_name":"Smoke Test","company_name":"Smoke Co"}' \
  | python -m json.tool | grep -E "token|email|is_admin"
```

Expected: JWT token in response

- [ ] **Step 11.3 — Verify subscription + seed created**

```bash
mysql -u root flowstack -e "
SELECT s.plan, s.status, s.expires_at, 
       (SELECT COUNT(*) FROM company_settings WHERE tenant_id=s.tenant_id) as has_settings,
       (SELECT COUNT(*) FROM roles WHERE tenant_id=s.tenant_id) as role_count
FROM subscriptions s JOIN tenants t ON t.id=s.tenant_id WHERE t.name='Smoke Co';"
```

Expected: plan=trial, status=active, expires_at = 30 days from now, has_settings=1, role_count=3

- [ ] **Step 11.4 — Verify user limit enforcement**

```bash
# Get token for smoke user
TOKEN=$(curl -s -X POST http://localhost/flowstack/api/auth/login.php \
  -H "Content-Type: application/json" \
  -d '{"email":"smoke@test.com","password":"test1234"}' | python -m json.tool | grep '"token"' | cut -d'"' -f4)

# Try to add second user (should fail: trial max_users=1)
curl -s -X POST http://localhost/flowstack/api/users.php \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"email":"extra@test.com","password":"test1234","display_name":"Extra"}'
```

Expected: HTTP 402 with message "แผนปัจจุบันรองรับสูงสุด 1 users กรุณาอัปเกรดแผน"

- [ ] **Step 11.5 — Cleanup test data**

```bash
mysql -u root flowstack -e "
DELETE FROM users WHERE email IN ('smoke@test.com','extra@test.com');"
```

- [ ] **Step 11.6 — Final commit**

```bash
git add .
git commit -m "chore: final saas platform smoke test verified"
```
