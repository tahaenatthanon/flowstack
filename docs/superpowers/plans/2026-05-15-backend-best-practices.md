# Backend Best Practices — NO MAGIC Compliance ✅ DONE (2026-05-18)

> **Status:** All 4 issues resolved. DDL extracted to migration, GET audit clean, tests passing, encryption key handled in ai-content-model-routing plan.

> **Goal:** แก้ไขปัญหา anti-pattern 4 ข้อที่ขัดกับ development rules: (1) `CREATE TABLE IF NOT EXISTS` ฝังใน runtime endpoint (2) GET endpoints ที่ mutate DB (3) ไม่มี tests (4) encryption key ผูกกับ JWT_SECRET

---

## Root Cause Analysis

### ปัญหา 1: Runtime DDL ใน `brand-content.php`

Lines 39-160 ใน `brand-content.php` รัน `CREATE TABLE IF NOT EXISTS` 9 ตาราง ทุกครั้งที่มี HTTP request ใดๆ:

```php
// brand-content.php line ~39 (ใน initBrandContentTables())
$db->exec("CREATE TABLE IF NOT EXISTS brand_contexts (...");
$db->exec("CREATE TABLE IF NOT EXISTS content_global_settings (...");
// ... อีก 7 ตาราง
```

**ผลเสีย:**
- ทุก request ต้องรอ DDL check (9x) → latency เพิ่มขึ้น ~10-50ms
- ขัดกับ **NO MAGIC** rule — schema ต้องอยู่ใน migration files
- เกิด race condition ถ้า concurrent requests

### ปัญหา 2: GET Endpoints ที่ Mutate DB

Pattern ที่พบบ่อยในหลาย endpoints:
```php
if ($method === 'GET') {
    // ... fetch data
    // แต่บางจุดมี INSERT/UPDATE ซ่อนอยู่
    $db->exec("INSERT INTO audit_log ...");  // ❌ GET mutates
}
```

### ปัญหา 3: ไม่มี Tests

`pnpm test` รัน Vitest แต่ไม่มี test files สำหรับ:
- Business logic functions (scoring, KPI calculation)
- API response shapes
- Validation rules

### ปัญหา 4: Encryption Key = JWT_SECRET

ครอบคลุมใน plan `2026-05-15-ai-content-model-routing.md` Task 2 แล้ว — refer ไปที่นั่น

---

## File Map

**Create:**
- `database/migrations/2026_05_15_000004_brand_content_tables.sql` — extract DDL จาก brand-content.php
- `src/lib/__tests__/scoring.test.ts` — unit tests สำหรับ survey scoring
- `src/lib/__tests__/kpi.test.ts` — unit tests สำหรับ KPI helpers

**Modified:**
- `api/brand-content.php` — remove `initBrandContentTables()` + DDL, add guard

---

## Task 1: Extract Brand Content DDL ไปเป็น Migration

- [ ] **Step 1: สร้าง migration file**

สร้าง `database/migrations/2026_05_15_000004_brand_content_tables.sql` โดย:
1. เปิด `api/brand-content.php` หา `function initBrandContentTables()`
2. Copy ทุก `CREATE TABLE IF NOT EXISTS ...` statement ออกมา
3. วางใน migration file

```sql
-- database/migrations/2026_05_15_000004_brand_content_tables.sql
-- Extracted from api/brand-content.php initBrandContentTables()
-- Run once manually in phpMyAdmin or via migration runner

CREATE TABLE IF NOT EXISTS `brand_contexts` (
  -- [copy exact DDL from brand-content.php]
) ENGINE=InnoDB ...;

CREATE TABLE IF NOT EXISTS `content_global_settings` (
  -- [copy exact DDL]
) ENGINE=InnoDB ...;

-- ... อีก 7 ตาราง
```

- [ ] **Step 2: รัน migration และยืนยันตาราง**

```sql
-- ใน phpMyAdmin:
SOURCE C:/xampp/htdocs/flowstack/database/migrations/2026_05_15_000004_brand_content_tables.sql;

-- ตรวจ:
SHOW TABLES LIKE 'brand%';
SHOW TABLES LIKE 'content%';
SHOW TABLES LIKE 'publish%';
```

- [ ] **Step 3: แก้ไข `brand-content.php` — Remove DDL, Add Guard**

หา `initBrandContentTables()` (ประมาณ line 35-170) และแทนที่ด้วย:

```php
function initBrandContentTables(PDO $db): void {
    // Tables are now created via migration:
    // database/migrations/2026_05_15_000004_brand_content_tables.sql
    // If you see this error, run the migration first.
    static $checked = false;
    if ($checked) return;
    $checked = true;

    $result = $db->query("SHOW TABLES LIKE 'brand_contexts'")->fetchColumn();
    if (!$result) {
        jsonError('Brand content tables not initialized. Run migration 2026_05_15_000004_brand_content_tables.sql first.', 500);
    }
}
```

- [ ] **Step 4: PHP syntax check**

```bash
php -l api/brand-content.php
```

---

## Task 2: Audit GET Endpoints ที่ Mutate DB

- [ ] **Step 1: Scan endpoints สำหรับ mutation ใน GET**

```bash
grep -n "INSERT\|UPDATE\|DELETE" api/*.php \
  | grep -v "\.php:[0-9]*:.*//\|\.php:[0-9]*:.*\*" \
  | head -50
```

จากนั้นตรวจว่า mutation นั้นอยู่ใน GET handler หรือเปล่า

- [ ] **Step 2: สร้างรายการ violations**

| File | Line | Issue |
|------|------|-------|
| (จาก audit) | | |

- [ ] **Step 3: แก้ไข violations**

แนวทาง:
- ย้าย mutation ออกจาก GET → ให้ client call PUT/POST แยก
- ถ้าเป็น "lazy initialization" → ย้ายไป migration หรือ POST `?action=init`
- ถ้าเป็น audit log → OK (read-only effect) แต่ควรใส่ comment ชัดเจน

---

## Task 3: เพิ่ม Unit Tests

- [ ] **Step 1: สร้าง test สำหรับ Survey Scoring**

```typescript
// src/lib/__tests__/scoring.test.ts
import { describe, it, expect } from 'vitest';

// Mirror PHP scoring logic in TypeScript (for frontend validation)
function answerToNumeric(value: string, type: string): number {
  if (type === 'yes_no') return value === 'yes' ? 1.0 : 0.0;
  if (type === 'scale_1_5') {
    const n = parseFloat(value);
    return n >= 1 && n <= 5 ? n : 0.0;
  }
  return 0.0;
}

describe('Survey Scoring', () => {
  it('yes_no: yes → 1', () => {
    expect(answerToNumeric('yes', 'yes_no')).toBe(1);
  });
  it('yes_no: no → 0', () => {
    expect(answerToNumeric('no', 'yes_no')).toBe(0);
  });
  it('scale_1_5: valid range', () => {
    expect(answerToNumeric('3', 'scale_1_5')).toBe(3);
    expect(answerToNumeric('5', 'scale_1_5')).toBe(5);
  });
  it('scale_1_5: out of range → 0', () => {
    expect(answerToNumeric('6', 'scale_1_5')).toBe(0);
    expect(answerToNumeric('0', 'scale_1_5')).toBe(0);
  });
  it('text type → 0 (no score)', () => {
    expect(answerToNumeric('anything', 'text')).toBe(0);
  });
  it('multiple_choice → 0', () => {
    expect(answerToNumeric('option_a', 'multiple_choice')).toBe(0);
  });
});
```

- [ ] **Step 2: สร้าง test สำหรับ KPI Label mapping**

```typescript
// src/lib/__tests__/kpi.test.ts
import { describe, it, expect } from 'vitest';
import { PRIORITY_LABELS, TASK_STATUS_LABELS } from '@/lib/labels';

describe('Label mappings', () => {
  it('PRIORITY_LABELS covers all expected priorities', () => {
    const expected = ['low', 'medium', 'high', 'critical'];
    expected.forEach(p => expect(PRIORITY_LABELS[p]).toBeDefined());
  });

  it('TASK_STATUS_LABELS covers all expected statuses', () => {
    const expected = ['todo', 'in_progress', 'in_review', 'completed', 'cancelled'];
    expected.forEach(s => expect(TASK_STATUS_LABELS[s]).toBeDefined());
  });
});
```

- [ ] **Step 3: รัน tests**

```bash
pnpm test --run
```

Expected: ทุก test ผ่าน

---

## Task 4: สร้าง `database/run_migration.php` (ถ้ายังไม่มี)

Migration runner ช่วยให้รัน migration ผ่าน HTTP ได้ง่ายขึ้นในระหว่าง development:

- [ ] **Step 1: ตรวจสอบว่ามีอยู่แล้วไหม**

```bash
ls database/run_migration.php
```

- [ ] **Step 2: ถ้าไม่มี สร้าง migration runner**

```php
<?php
// database/run_migration.php
// DEV ONLY — disable in production
if (!defined('DEV_MODE') && getenv('APP_ENV') !== 'development') {
    http_response_code(403);
    echo json_encode(['error' => 'Only available in development']);
    exit;
}

$file = $_GET['file'] ?? '';
$allowed = preg_match('/^[\w\-]+\.sql$/', $file);
if (!$allowed) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid file name']);
    exit;
}

$path = __DIR__ . '/' . $file;
if (!file_exists($path)) {
    http_response_code(404);
    echo json_encode(['error' => "File not found: $file"]);
    exit;
}

require_once __DIR__ . '/../api/config.php';
$db  = getDB();
$sql = file_get_contents($path);

try {
    $db->exec($sql);
    echo json_encode(['success' => true, 'file' => $file]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
```

---

## Final Verification

- [ ] `brand-content.php` ไม่มี `CREATE TABLE` อีกต่อไป
- [ ] `pnpm test --run` — ทุก test ผ่าน
- [ ] `pnpm build` — TypeScript clean
- [ ] ไม่มี GET endpoints ที่ทำ INSERT/UPDATE โดยไม่มี comment อธิบาย
- [ ] `php -l api/brand-content.php`
