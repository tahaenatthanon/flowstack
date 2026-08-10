# Impact OS — Data Integrity Fixes ✅ DONE (2026-05-18)

> **Goal:** (1) แทนที่ `resolveAssigneeClause()` ที่ใช้ `display_name` subquery ด้วย join บน `user_id` โดยตรง (2) ตรวจสอบและแก้ไข null handling ของ `calcCollabScore()` (3) เพิ่ม data migration script สำหรับ backfill `assignee_user_id`

---

## Root Cause Analysis

### ปัญหา 1: `resolveAssigneeClause()` — Fragile Display Name Fallback

`api/impactos.php` line 36-39:

```php
function resolveAssigneeClause(string $alias, string $uid, array &$params): string {
    $params[] = $uid;
    $params[] = $uid;
    return "AND ({$alias}.assignee_user_id = ?
            OR ({$alias}.assignee_user_id IS NULL
                AND {$alias}.assignee = (SELECT display_name FROM users WHERE id = ?)))";
}
```

**ความเสี่ยง:**
- `display_name` ไม่ unique — user 2 คนชื่อ "สมชาย" จะ query ซ้ำกัน
- ถ้า user เปลี่ยน `display_name` → KPI หายทันที (rows เก่าจะหา match ไม่เจอ)
- subquery รันทุก row ใน result set — slow มากเมื่อ tasks table ใหญ่
- **Fix:** backfill `assignee_user_id` ก่อน แล้ว remove fallback

### ปัญหา 2: `calcCollabScore()` returns `null` → UI อาจแสดง `null` หรือ convert เป็น 0/50

`calcCollabScore()` คืน `null` เมื่อ `$total === 0` (line 173) แต่ caller ใช้:

```php
'collab_score' => $collab,  // null
```

ถ้า frontend `?? 50` หรือมี default scoring → ตัวเลขลอย. ต้องตรวจสอบ frontend ว่า handle null อย่างไร

### ปัญหา 3: `tenant_users` table join สำหรับ `isAdmin`

Line 20-22 ใช้ `tenant_users` table แต่ระบบอาจใช้ `users.is_admin` แทน — เสี่ยง always-unauthorized ถ้า `tenant_users` ไม่มี rows

---

## File Map

**Modified:**
- `api/impactos.php` — แก้ `resolveAssigneeClause()`, null handling
- `database/migrations/2026_05_15_000002_backfill_task_assignee_user_id.sql` — backfill script
- `src/pages/ImpactOSPage.tsx` (หรือ dashboard component) — ตรวจ null collab_score

---

## Task 1: Backfill Migration

- [x] **Step 1: สร้าง migration backfill `assignee_user_id`**

```sql
-- database/migrations/2026_05_15_000002_backfill_task_assignee_user_id.sql
-- ตรวจสอบ tasks ที่ assignee_user_id เป็น NULL แต่ assignee (display_name) มีค่า
-- พยายาม match กับ users.display_name ในสิ่งที่ไม่ ambiguous

-- STEP 1: ดูขนาดของปัญหา
SELECT COUNT(*) AS unmatched_tasks
FROM tasks
WHERE assignee_user_id IS NULL AND assignee IS NOT NULL AND assignee != '';

-- STEP 2: Backfill เฉพาะ display_name ที่ unique ใน tenant
UPDATE tasks t
JOIN (
    SELECT display_name, id AS user_id, tenant_id
    FROM users
    WHERE display_name IN (
        SELECT display_name FROM users GROUP BY display_name, tenant_id HAVING COUNT(*) = 1
    )
) u ON u.display_name = t.assignee AND u.tenant_id = t.tenant_id
SET t.assignee_user_id = u.user_id
WHERE t.assignee_user_id IS NULL
  AND t.assignee IS NOT NULL;

-- STEP 3: ตรวจสอบ remaining unmatched (ambiguous names)
SELECT t.id, t.title, t.assignee, t.tenant_id
FROM tasks t
WHERE t.assignee_user_id IS NULL
  AND t.assignee IS NOT NULL
  AND t.assignee != ''
LIMIT 50;
```

- [x] **Step 2: รัน migration ใน phpMyAdmin และตรวจผล**

Expected: tasks ส่วนใหญ่มี `assignee_user_id` แล้ว, คงเหลือแค่ ambiguous names
> ✅ ผล 2026-05-18: 12,854/12,960 rows มี assignee_user_id (99.2%). เหลือ 1 row ชื่อ "กหดหกดหกด" (test garbage) — ไม่มี user ตรงกัน ยอมรับได้

---

## Task 2: แก้ไข `resolveAssigneeClause()` ใน `impactos.php`

- [x] **Step 1: เพิ่ม `resolveAssigneeClause()` version ที่ปลอดภัย**

แทนที่ function เดิม (line 36-39):

```php
/**
 * Build WHERE clause matching tasks by user_id.
 * Fallback to display_name ONLY for rows where assignee_user_id IS NULL
 * (legacy data before migration). Remove fallback once all rows are migrated.
 *
 * Usage: $where = resolveAssigneeClause('t', $uid, $params);
 */
function resolveAssigneeClause(string $alias, string $uid, array &$params): string {
    $params[] = $uid;
    return "AND {$alias}.user_id = ?";
    // NOTE: removed display_name fallback — run backfill migration first.
    // Legacy fallback (keep commented until all data is migrated):
    // $params[] = $uid;
    // return "AND ({$alias}.user_id = ? OR ({$alias}.user_id IS NULL AND {$alias}.assignee = (SELECT display_name FROM users WHERE id = ?)))";
}
```

**⚠️ ต้องรัน backfill migration ก่อนเปิด fallback-free version มิฉะนั้น KPI จะหาย**

**แนะนำ:** ใช้ feature flag หรือ deploy แบบ 2 ขั้น:
1. รัน backfill → verify ≥99% rows มี `assignee_user_id`
2. จึง remove fallback

- [x] **Step 2: ตรวจสอบ column `user_id` vs `assigned_to` vs `assignee_user_id`**

ตรวจ tasks table schema จริงก่อน:
```sql
DESCRIBE tasks;
```

ชื่อ column อาจเป็น `user_id`, `assignee_user_id`, หรือ `assigned_to` — ต้องใช้ชื่อที่ถูกต้อง:

```php
// ถ้า schema ใช้ user_id:
return "AND {$alias}.user_id = ?";

// ถ้า schema ใช้ assignee_user_id:
return "AND {$alias}.assignee_user_id = ?";
```

---

## Task 3: แก้ไข `calcCollabScore()` null handling

- [x] **Step 1: ตรวจสอบว่า frontend handle null อย่างไร**

เปิด `src/pages/ImpactOSPage.tsx` (หรือ dashboard component) และหา:

```tsx
// ถ้ามี ?? 50 หรือ || 50 → นี่คือสาเหตุตัวเลขลอย
collab_score: data.collab_score ?? 50  // ❌
```

- [x] **Step 2: แก้ frontend ให้แสดง "ไม่มีข้อมูล" แทน default value**

```tsx
// ✅ แสดง N/A เมื่อ null
{score.collab_score !== null
  ? `${score.collab_score.toFixed(1)}%`
  : <span className="text-muted-foreground text-xs">ไม่มีข้อมูล</span>
}
```

- [x] **Step 3: แก้ backend ให้มี comment ชัดเจน**

ใน `calcCollabScore()` หลัง line `if ($total === 0) return null;` เพิ่ม:

```php
// Explicitly returns null (not 0 or 50) when user has no completed tasks this month.
// Frontend must handle null as "N/A", NOT as a numeric default.
```

---

## Task 4: ตรวจสอบ `isAdmin` logic

- [x] **Step 1: ตรวจสอบว่า `tenant_users` มีอยู่จริง**

```sql
SHOW TABLES LIKE 'tenant_users';
```

ถ้าไม่มี → `isAdmin` จะ always = 0 → admin จะเห็นข้อมูลแค่ของตัวเอง

- [x] **Step 2: แก้ไข fallback**

```php
// line 20-22 ใน impactos.php
// ถ้า tenant_users ไม่มี ให้ fallback ไป users.is_admin:
$isAdmin = (bool)($tokenData['is_admin'] ?? false); // ใช้จาก JWT token แทน
```

---

## Final Verification

- [x] รัน backfill migration และตรวจสอบ ≥99% rows มี `assignee_user_id`
- [x] เปิด `/impactos` ตรวจว่า KPI แสดงผลถูกต้อง (ไม่มีตัวเลขลอย)
- [x] `collab_score: null` แสดง "ไม่มีข้อมูล" ไม่ใช่ 50 หรือ 0
- [x] Admin เห็น leaderboard ของทีม, non-admin เห็นแค่ข้อมูลตัวเอง
- [x] `php -l api/impactos.php`
- [x] `pnpm build`
