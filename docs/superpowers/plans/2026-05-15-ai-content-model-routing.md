# AI Content — Model Routing Fix ✅ DONE (2026-05-18)

> **Goal:** ให้ `generate-article`, `generate-video`, และ generate actions อื่นๆ ใน `brand-content.php` ใช้โมเดลที่กำหนดใน AI Settings (`ai_content_text_model_id`, `ai_content_image_model_id`, `ai_content_video_model_id`) แทนการใช้ active provider ค่าเริ่มต้น

---

## Root Cause Analysis

### ปัญหาหลัก: `resolveAICreds()` ไม่ resolve model

`brand-content.php` lines 179-204 — `resolveAICreds()` query ดึงแค่ `api_key_encrypted` จาก `ai_active_provider_id`:

```php
SELECT ap.api_base_url, ap.api_key_encrypted
FROM company_settings cs
JOIN ai_providers ap ON ap.id = cs.ai_active_provider_id  -- ❌ ไม่ดึง model
```

ผลลัพธ์คือ `['api_key' => '...', 'base_url' => '...']` — **ไม่มี `model` key** ทำให้ทุก generate action ที่ใช้ `resolveAICreds()` ไม่รู้ว่าต้องใช้โมเดลอะไร และ fallback ไปใช้ hardcoded model ของ caller.

### เปรียบเทียบ: `supportResolveAi()` (support-tickets.php) ทำถูก

```php
SELECT ap.api_base_url, ap.api_key_encrypted,
       COALESCE(am_t.model_id, am_d.model_id) AS model_id
FROM company_settings cs
LEFT JOIN ai_models am_t ON am_t.id = cs.ai_content_text_model_id  -- ✅ ดึง model
LEFT JOIN ai_models am_d ON am_d.id = cs.ai_default_model_id
JOIN ai_providers ap ON ap.id = COALESCE(...)
```

### ปัญหารอง: encryption key ผูก JWT_SECRET

`encryptValue()` / `decryptValue()` ใช้ `hash('sha256', JWT_SECRET, true)` เป็น AES key — ถ้า rotate JWT_SECRET จะ decrypt api_key ไม่ได้เลย

---

## File Map

**Modified:**
- `api/brand-content.php` — update `resolveAICreds()` + add model routing per action
- `database/migrations/2026_05_15_000001_add_encryption_key_setting.sql` — แยก encryption key ออกจาก JWT_SECRET

---

## Task 1: Fix `resolveAICreds()` ให้ส่ง model กลับมาด้วย

**File:** `api/brand-content.php`

- [ ] **Step 1: แก้ไข `resolveAICreds()` function**

หาฟังก์ชัน `resolveAICreds` (line ~179) และแทนที่ด้วย:

```php
/**
 * Resolve AI credentials + model for brand-content actions.
 * @param PDO    $db
 * @param string $modelColumn  Column on company_settings to prefer:
 *                              'ai_content_text_model_id'  (article/brief/caption)
 *                              'ai_content_image_model_id' (image)
 *                              'ai_content_video_model_id' (video)
 * @return array ['api_key', 'base_url', 'model'] — api_key='' when not configured
 */
function resolveAICreds(PDO $db, string $modelColumn = 'ai_content_text_model_id'): array {
    $fallbackBase = 'https://api.kilo.ai/api/gateway';

    try {
        $allowed = ['ai_content_text_model_id', 'ai_content_image_model_id',
                    'ai_content_video_model_id', 'ai_default_model_id'];
        if (!in_array($modelColumn, $allowed, true)) {
            $modelColumn = 'ai_default_model_id';
        }

        $stmt = $db->query("
            SELECT ap.api_base_url, ap.api_key_encrypted,
                   COALESCE(am_c.model_id, am_d.model_id) AS model_id
            FROM company_settings cs
            LEFT JOIN ai_models am_c ON am_c.id = cs.`$modelColumn`
            LEFT JOIN ai_models am_d ON am_d.id = cs.ai_default_model_id
            JOIN ai_providers ap ON ap.id = COALESCE(am_c.provider_id, am_d.provider_id, cs.ai_active_provider_id)
            WHERE cs.id = 1
              AND ap.api_key_encrypted IS NOT NULL
              AND ap.api_key_encrypted != ''
            LIMIT 1
        ");
        $row = $stmt ? $stmt->fetch() : null;

        if ($row && !empty($row['api_key_encrypted'])) {
            $plain = decryptApiKey($row['api_key_encrypted']);
            if (!empty(trim($plain))) {
                $baseUrl = rtrim($row['api_base_url'] ?: $fallbackBase, '/');
                return [
                    'api_key'  => trim($plain),
                    'base_url' => $baseUrl,
                    'model'    => $row['model_id'] ?: 'openai/gpt-4o-mini',
                ];
            }
        }
    } catch (\Exception $e) {
        error_log('[resolveAICreds] ' . $e->getMessage());
    }

    // Fallback: built-in KILO_API_TOKEN constant
    if (!empty(KILO_API_TOKEN)) {
        $baseUrl = rtrim(KILO_API_BASE_URL ?: $fallbackBase, '/');
        return ['api_key' => KILO_API_TOKEN, 'base_url' => $baseUrl, 'model' => 'openai/gpt-4o-mini'];
    }
    return ['api_key' => '', 'base_url' => $fallbackBase, 'model' => 'openai/gpt-4o-mini'];
}
```

- [ ] **Step 2: อัปเดต call sites ให้ส่ง modelColumn ที่ถูกต้อง**

Search for `resolveAICreds($db)` และแก้แต่ละจุด:

| Action | เปลี่ยนเป็น |
|--------|-----------|
| `generate-article`, briefing, caption, trigger_command | `resolveAICreds($db, 'ai_content_text_model_id')` |
| `generate-image`, cover image | `resolveAICreds($db, 'ai_content_image_model_id')` |
| `generate-video` | `resolveAICreds($db, 'ai_content_video_model_id')` |

- [ ] **Step 3: อัปเดต chat/completions calls ให้ใช้ `$creds['model']`**

หาทุกจุดที่มี `$creds = resolveAICreds(...)` แล้วส่ง `"model"` ไปใน request body แต่ใช้ค่า hardcoded หรือไม่ส่งเลย เปลี่ยนให้ใช้ `$creds['model']`:

```php
// ❌ เดิม
'model' => 'openai/gpt-4o-mini',

// ✅ ใหม่
'model' => $creds['model'],
```

- [ ] **Step 4: Build check**

```bash
pnpm build 2>&1 | head -20
```

Expected: ไม่มี errors (เป็น PHP เลยตรวจ syntax แทน)

```bash
php -l api/brand-content.php
```

---

## Task 2: แยก Encryption Key ออกจาก JWT_SECRET

**Problem:** `encryptValue()` / `decryptApiKey()` ใช้ `JWT_SECRET` เป็น AES key — ถ้า rotate JWT ทำให้ decrypt api_key เก่าไม่ได้

**Files:**
- `database/migrations/2026_05_15_000001_add_encryption_key_setting.sql`
- `api/config.php` (หรือที่กำหนด constants)
- `api/brand-content.php` — update `encryptValue()`/`decryptApiKey()`

- [ ] **Step 1: สร้าง migration เพิ่ม `encryption_key` ใน `company_settings`**

```sql
-- database/migrations/2026_05_15_000001_add_encryption_key_setting.sql
ALTER TABLE `company_settings`
  ADD COLUMN IF NOT EXISTS `encryption_key` VARCHAR(255) DEFAULT NULL
  COMMENT 'AES-256 key for encrypting API keys — base64(random_bytes(32)). Separate from JWT_SECRET.';
```

- [ ] **Step 2: อัปเดต `decryptApiKey()` และ `encryptValue()` ใน `brand-content.php`**

```php
/**
 * Get AES encryption key — prefer company_settings.encryption_key,
 * fallback to JWT_SECRET for backward compat (but log deprecation warning).
 */
function getEncryptionKey(PDO $db): string {
    static $cached = null;
    if ($cached !== null) return $cached;
    try {
        $row = $db->query("SELECT encryption_key FROM company_settings WHERE id = 1 LIMIT 1")->fetch();
        if (!empty($row['encryption_key'])) {
            $cached = hash('sha256', base64_decode($row['encryption_key']), true);
            return $cached;
        }
    } catch (\Throwable $e) {}
    // Backward compat — must migrate to per-tenant key
    error_log('[SECURITY] Using JWT_SECRET as encryption key — run encryption migration');
    $cached = hash('sha256', JWT_SECRET, true);
    return $cached;
}

function encryptValue(string $value, PDO $db): string {
    $key = getEncryptionKey($db);
    $iv  = random_bytes(16);
    $enc = openssl_encrypt($value, 'AES-256-CBC', $key, OPENSSL_RAW_DATA, $iv);
    return base64_encode($iv . $enc);
}

function decryptApiKey(string $encrypted, PDO $db): string {
    $key  = getEncryptionKey($db);
    $data = base64_decode($encrypted);
    if (strlen($data) <= 16) return '';
    $iv    = substr($data, 0, 16);
    $plain = openssl_decrypt(substr($data, 16), 'AES-256-CBC', $key, OPENSSL_RAW_DATA, $iv);
    return $plain !== false ? trim($plain) : '';
}
```

- [ ] **Step 3: Seed encryption key ในระบบที่มีอยู่**

ถ้า `encryption_key` IS NULL → admin ต้อง generate ผ่าน Admin UI หรือรัน:
```sql
UPDATE company_settings
SET encryption_key = TO_BASE64(RANDOM_BYTES(32))
WHERE id = 1 AND encryption_key IS NULL;
```

**⚠️ หลังเปลี่ยน key ทุก api_key_encrypted ในระบบต้อง re-encrypt — สร้าง migration script สำหรับ re-encrypt ด้วย**

- [ ] **Step 4: ทดสอบ**

1. ลอง generate article ใน Marketing > Content → ตรวจว่าใช้โมเดลที่ตั้งไว้
2. เปิด DevTools Network → request body ต้องมี `"model": "<ai_content_text_model_id.model_id>"`
3. ลอง generate image → ตรวจว่าใช้ `ai_content_image_model_id`

---

## Final Verification

- [ ] `php -l api/brand-content.php` — ไม่มี syntax errors
- [ ] `pnpm build` — TypeScript clean
- [ ] ทดสอบ generate-article เลือกโมเดลถูกต้อง
- [ ] Encryption key ไม่ใช่ JWT_SECRET อีกต่อไป
