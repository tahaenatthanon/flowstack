<?php
// api/brand-content.php
// AI Brand Content Automation โ€“ Knowledge Base, Skills, Triggers, Content Planner, Image Gen
set_time_limit(0); // AI calls can take several minutes
require_once 'config.php';
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/lib/seo-checklist.php';

/**
 * Whitelist-based sanitizer: keep ONLY printable ASCII + Thai script.
 * Strips everything else: Hebrew, Arabic, Cyrillic, Greek, CJK, Latin Extended,
 * fullwidth/halfwidth forms, and any other non-Thai non-ASCII Unicode.
 * Safe for HTML โ€” all HTML tag characters (<>/="') are plain ASCII.
 */
function sanitizeAIOutput(string $text): string {
    // Keep:
    //   \x09\x0A\x0D        โ€” tab, LF, CR
    //   \x20-\x7E           โ€” printable ASCII (English, digits, HTML chars, basic punctuation)
    //   \x{00A0}            โ€” non-breaking space
    //   \x{2013}\x{2014}    โ€” en-dash, em-dash
    //   \x{2018}-\x{201F}   โ€” smart/curly quotes
    //   \x{2026}            โ€” ellipsis
    //   \x{0E00}-\x{0E7F}   โ€” Thai script
    return preg_replace(
        '/[^\x09\x0A\x0D\x20-\x7E\x{00A0}-\x{00FF}\x{0150}-\x{024F}\x{2013}\x{2014}\x{2018}-\x{2026}\x{2030}-\x{205F}\x{20AC}\x{0E00}-\x{0E7F}]/u',
        '',
        $text
    );
}

$db       = getDB();
$auth     = requireAuth();
$userId   = $auth['user_id'];
$tenantId = $auth['tenant_id'];
$method   = getMethod();
$action   = $_GET['action'] ?? '';

// Handle CORS preflight
if ($method === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// ─── Table guard (DDL moved to migration) ──────────────────────────────────
// Tables are created via: database/migrations/2026_05_15_000004_brand_content_tables.sql
// Run that migration once before first use.
function bcMigrate(PDO $db): void {
    static $checked = false;
    if ($checked) return;
    $checked = true;

    $result = $db->query("SHOW TABLES LIKE 'brand_contexts'")->fetchColumn();
    if (!$result) {
        jsonError('Brand content tables not initialized. Run migration 2026_05_15_000004_brand_content_tables.sql first.', 500);
    }
}
bcMigrate($db);

// โ”€โ”€โ”€ Helpers โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
/**
 * Resolve AI credentials + model for brand-content actions.
 * @param string $modelColumn  Column on company_settings:
 *   'ai_content_text_model_id'  (article/brief/caption)
 *   'ai_content_image_model_id' (image)
 *   'ai_content_video_model_id' (video)
 */
function resolveAICreds(PDO $db, string $modelColumn = 'ai_content_text_model_id', string $tenantId = ''): array {
    $fallbackBase = 'https://api.kilo.ai/api/gateway';
    $allowed = ['ai_content_text_model_id', 'ai_content_image_model_id',
                'ai_content_video_model_id', 'ai_default_model_id'];
    if (!in_array($modelColumn, $allowed, true)) {
        $modelColumn = 'ai_default_model_id';
    }

    try {
        $whereClause = $tenantId ? 'cs.tenant_id = ' . $db->quote($tenantId) : 'cs.id = 1';
        $sql = "
            SELECT ap.api_base_url, ap.api_key_encrypted,
                   COALESCE(am_c.model_id, am_d.model_id) AS model_id,
                   cs.ai_content_timeout, cs.ai_content_max_tokens
            FROM company_settings cs
            LEFT JOIN ai_models am_c ON am_c.id = cs.`{$modelColumn}`
            LEFT JOIN ai_models am_d ON am_d.id = cs.ai_default_model_id
            JOIN ai_providers ap ON ap.id = COALESCE(am_c.provider_id, am_d.provider_id, cs.ai_active_provider_id)
            WHERE $whereClause
              AND ap.api_key_encrypted IS NOT NULL AND ap.api_key_encrypted != ''
            LIMIT 1
        ";
        $row = $db->query($sql)->fetch();
        if ($row && !empty($row['api_key_encrypted'])) {
            $plain = decryptApiKey($row['api_key_encrypted']);
            if (!empty(trim($plain))) {
                $baseUrl = rtrim($row['api_base_url'] ?: $fallbackBase, '/');
                $timeout = (int)($row['ai_content_timeout'] ?? 0);
                $maxTokens = (int)($row['ai_content_max_tokens'] ?? 0);
                return [
                    'api_key'    => trim($plain),
                    'base_url'   => $baseUrl,
                    'model'      => $row['model_id'] ?: 'openai/gpt-4o-mini',
                    'timeout'    => ($timeout >= 30) ? $timeout : 300,
                    'max_tokens' => ($maxTokens >= 256) ? $maxTokens : 8192,
                ];
            }
        }
    } catch (\Exception $e) {
        error_log('[resolveAICreds] ' . $e->getMessage());
    }

    if (!empty(KILO_API_TOKEN)) {
        $baseUrl = rtrim(KILO_API_BASE_URL ?: $fallbackBase, '/');
        return ['api_key' => KILO_API_TOKEN, 'base_url' => $baseUrl, 'model' => 'openai/gpt-4o-mini', 'timeout' => 300, 'max_tokens' => 8192];
    }
    return ['api_key' => '', 'base_url' => $fallbackBase, 'model' => 'openai/gpt-4o-mini', 'timeout' => 300, 'max_tokens' => 8192];
}

/**
 * Load AI content generation parameters (timeout, max_tokens) from company_settings.
 * Returns [timeout: int, max_tokens: int]. Safe defaults if DB row is missing.
 */
function getAIContentParams(PDO $db, string $tenantId = ''): array {
    $where = $tenantId ? 'tenant_id = ' . $db->quote($tenantId) : 'id = 1';
    $row = $db->query("SELECT ai_content_timeout, ai_content_max_tokens FROM company_settings WHERE $where LIMIT 1")->fetch();
    $timeout   = (int)($row['ai_content_timeout'] ?? 0);
    $maxTokens = (int)($row['ai_content_max_tokens'] ?? 0);
    return [
        'timeout'    => ($timeout >= 30) ? $timeout : 300,
        'max_tokens' => ($maxTokens >= 256) ? $maxTokens : 8192,
    ];
}

function encryptValue(string $value): string {
    $key = _getEncryptionKey();
    $iv  = random_bytes(16);
    $enc = openssl_encrypt($value, 'AES-256-CBC', $key, OPENSSL_RAW_DATA, $iv);
    return base64_encode($iv . $enc);
}

function decryptValue(string $encrypted): string {
    $key  = _getEncryptionKey();
    $data = base64_decode($encrypted);
    if (strlen($data) <= 16) return '';
    $iv   = substr($data, 0, 16);
    $plain = openssl_decrypt(substr($data, 16), 'AES-256-CBC', $key, OPENSSL_RAW_DATA, $iv);
    return $plain !== false ? trim($plain) : '';
}

function _saveImageUrl(string $imageUrl, string $itemId): string {
    // If it's already a regular URL, return as-is
    if (!str_starts_with($imageUrl, 'data:')) return $imageUrl;

    // Parse base64 data URL: data:image/png;base64,<data>
    if (!preg_match('/^data:image\/(\w+);base64,(.+)$/', $imageUrl, $m)) return $imageUrl;

    $data = base64_decode($m[2]);
    $dir  = __DIR__ . '/../uploads/content';
    if (!is_dir($dir)) mkdir($dir, 0777, true);

    // Always save as JPEG for smaller file size
    $filename = $itemId . '_' . date('YmdHis') . '.jpg';
    $filepath = $dir . '/' . $filename;

    // Compress and resize with GD (max 1200px wide, 85% JPEG quality)
    if (extension_loaded('gd')) {
        $src = imagecreatefromstring($data);
        if ($src !== false) {
            $origW = imagesx($src);
            $origH = imagesy($src);
            $maxW  = 1200;
            if ($origW > $maxW) {
                $newW = $maxW;
                $newH = (int)round($origH * $maxW / $origW);
                $dst  = imagecreatetruecolor($newW, $newH);
                imagecopyresampled($dst, $src, 0, 0, 0, 0, $newW, $newH, $origW, $origH);
                imagedestroy($src);
                $src = $dst;
            }
            imagejpeg($src, $filepath, 85);
            imagedestroy($src);
            return '/uploads/content/' . $filename;
        }
    }

    // Fallback: save raw data if GD fails
    file_put_contents($filepath, $data);
    return '/uploads/content/' . $filename;
}

function _resolveImageCreds(PDO $db, string $tenantId = ''): array {
    return resolveAICreds($db, 'ai_content_image_model_id', $tenantId);
}

function _loadImageAsBase64(string $url): ?string {
    // If already a data URL, return as-is
    if (str_starts_with($url, 'data:')) return $url;

    $host = parse_url($url, PHP_URL_HOST);
    $isLocal = !$host || in_array($host, ['localhost', '127.0.0.1', '::1']);

    // ── Try disk read first (works for local URLs and relative paths) ──────────
    // Project root is one level up from api/
    $projectRoot = realpath(__DIR__ . '/..') ?: (__DIR__ . '/..');

    $urlPath = $host ? (parse_url($url, PHP_URL_PATH) ?? '') : ('/' . ltrim($url, '/'));

    // Strip any leading webapp subfolder (e.g. /flowstack/) that doesn't exist on disk
    // by trying progressively stripped path segments until the file resolves.
    $candidates = [];
    $segments = array_values(array_filter(explode('/', ltrim($urlPath, '/'))));
    for ($skip = 0; $skip < min(3, count($segments)); $skip++) {
        $subPath = '/' . implode('/', array_slice($segments, $skip));
        $candidates[] = $projectRoot . $subPath;
    }

    foreach ($candidates as $candidate) {
        $resolved = realpath($candidate);
        if ($resolved && file_exists($resolved) && is_file($resolved)) {
            $data = @file_get_contents($resolved);
            if (!empty($data)) {
                $ext  = strtolower(pathinfo($resolved, PATHINFO_EXTENSION));
                $mime = match($ext) { 'webp' => 'image/webp', 'jpg', 'jpeg' => 'image/jpeg', 'gif' => 'image/gif', default => 'image/png' };
                return "data:$mime;base64," . base64_encode($data);
            }
        }
    }

    // ── Fallback: curl fetch from local Apache (port 80) ──────────────────────
    if ($isLocal) {
        $apacheUrl = 'http://127.0.0.1' . $urlPath;
        $ch = curl_init($apacheUrl);
        curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 10,
            CURLOPT_FOLLOWLOCATION => true, CURLOPT_SSL_VERIFYPEER => false]);
        $data = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $ctype = curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
        curl_close($ch);
        if ($code === 200 && !empty($data)) {
            $mime = explode(';', $ctype)[0] ?: 'image/jpeg';
            return "data:$mime;base64," . base64_encode($data);
        }
        // Do NOT return the localhost URL — the AI provider can't reach it
        return null;
    }

    // Remote public URL — return as-is so the provider can download it
    return $url;
}

function parseBrandMd(string $content): array {
    $parsed = ['brand_name' => '', 'target_audience' => '', 'tone_of_voice' => '', 'colors' => [], 'description' => ''];
    preg_match_all('/#[0-9A-Fa-f]{6}\b/', $content, $cm);
    $parsed['colors'] = array_values(array_unique($cm[0]));
    if (preg_match('/(?:brand name|brand|แบรนด์|ชื่อแบรนด์)[:\s]+([^\n]+)/i', $content, $m)) $parsed['brand_name'] = trim($m[1]);
    if (preg_match('/(?:tone of voice|tone|โทน|น้ำเสียง)[:\s]+([^\n]+)/i', $content, $m)) $parsed['tone_of_voice'] = trim($m[1]);
    if (preg_match('/(?:target audience|target|กลุ่มเป้าหมาย|ผู้รับสาร)[:\s]+([^\n]+)/i', $content, $m)) $parsed['target_audience'] = trim($m[1]);
    if (preg_match('/(?:description|คำอธิบาย)[:\s]+([^\n]+)/i', $content, $m)) $parsed['description'] = trim($m[1]);
    return $parsed;
}

// โ”€โ”€โ”€ CONTEXTS โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
if ($action === 'contexts') {
    if ($method === 'GET') {
        $stmt = $db->prepare('SELECT * FROM brand_contexts WHERE tenant_id=? ORDER BY file_type, created_at DESC');
        $stmt->execute([$tenantId]);
        jsonResponse($stmt->fetchAll());
    }
    if ($method === 'POST') {
        $body = getRequestBody();
        if (empty($body['name'])) jsonError('กรุณาระบุชื่อ Context');
        $id = generateUUID();
        $fileType = $body['file_type'] ?? 'brand_md';
        $content  = $body['content'] ?? '';
        $parsed   = ($fileType === 'brand_md' && $content) ? json_encode(parseBrandMd($content)) : null;
        $db->prepare('INSERT INTO brand_contexts (id,tenant_id,name,file_type,content,parsed_data,created_by) VALUES (?,?,?,?,?,?,?)')
           ->execute([$id, $tenantId, $body['name'], $fileType, $content, $parsed, $userId]);
        $stmt = $db->prepare('SELECT * FROM brand_contexts WHERE id=? AND tenant_id=?');
        $stmt->execute([$id, $tenantId]);
        jsonResponse($stmt->fetch(), 201);
    }
    if ($method === 'PUT') {
        $id = $_GET['id'] ?? null;
        if (!$id) jsonError('Missing id');
        $body = getRequestBody();
        $fileType = $body['file_type'] ?? 'brand_md';
        $content  = $body['content'] ?? '';
        $parsed   = ($fileType === 'brand_md' && $content) ? json_encode(parseBrandMd($content)) : null;
        $db->prepare('UPDATE brand_contexts SET name=?,file_type=?,content=?,parsed_data=?,updated_at=NOW() WHERE id=? AND tenant_id=?')
           ->execute([$body['name'] ?? '', $fileType, $content, $parsed, $id, $tenantId]);
        $stmt = $db->prepare('SELECT * FROM brand_contexts WHERE id=? AND tenant_id=?');
        $stmt->execute([$id, $tenantId]);
        jsonResponse($stmt->fetch());
    }
    if ($method === 'DELETE') {
        $id = $_GET['id'] ?? null;
        if (!$id) jsonError('Missing id');
        $db->prepare('DELETE FROM brand_contexts WHERE id=? AND tenant_id=?')->execute([$id, $tenantId]);
        jsonResponse(['deleted' => true]);
    }
}

// โ”€โ”€โ”€ GLOBAL SETTINGS โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
if ($action === 'global-settings') {
    if ($method === 'GET') {
        $stmt = $db->prepare('SELECT * FROM content_global_settings WHERE tenant_id=?');
        $stmt->execute([$tenantId]);
        $row = $stmt->fetch();
        if (!$row) {
            jsonResponse(['tenant_id' => $tenantId, 'global_instruction' => '', 'image_gen_provider' => 'none',
                          'image_gen_model' => '', 'image_gen_base_url' => '', 'product_ref_image_url' => '', 'has_image_gen_key' => false,
                          'research_provider' => 'none', 'research_api_login' => '', 'has_research_key' => false,
                          'research_location_code' => 2764, 'research_language_code' => 'th', 'research_cache_hours' => 168,
                          'weekly_posts_target' => 0]);
        }
        $row['has_image_gen_key'] = !empty($row['image_gen_api_key_encrypted']);
        $row['has_research_key'] = !empty($row['research_api_key_encrypted']);
        $row['weekly_posts_target'] = (int)($row['weekly_posts_target'] ?? 0);
        $row['research_location_code'] = (int)($row['research_location_code'] ?? 2764);
        $row['research_cache_hours'] = (int)($row['research_cache_hours'] ?? 168);
        unset($row['image_gen_api_key_encrypted']);
        unset($row['research_api_key_encrypted']);
        jsonResponse($row);
    }
    if ($method === 'POST') {
        $body = getRequestBody();
        $encKey = null;
        if (!empty($body['image_gen_api_key'])) {
            $encKey = encryptValue($body['image_gen_api_key']);
        }
        $researchEncKey = null;
        if (!empty($body['research_api_key'])) {
            $researchEncKey = encryptValue($body['research_api_key']);
        }
        $stmt = $db->prepare('SELECT tenant_id FROM content_global_settings WHERE tenant_id=?');
        $stmt->execute([$tenantId]);
        $exists = $stmt->fetch();
        if ($exists) {
            // Only update fields that are explicitly present in the body
            $sets = ['updated_at=NOW()'];
            $vals = [];
            if (array_key_exists('global_instruction', $body))  { $sets[] = 'global_instruction=?';  $vals[] = $body['global_instruction'] ?? ''; }
            if (array_key_exists('image_gen_provider', $body))  { $sets[] = 'image_gen_provider=?';  $vals[] = $body['image_gen_provider']  ?? 'none'; }
            if (array_key_exists('image_gen_model', $body))     { $sets[] = 'image_gen_model=?';     $vals[] = $body['image_gen_model']     ?? ''; }
            if (array_key_exists('image_gen_base_url', $body))  { $sets[] = 'image_gen_base_url=?';  $vals[] = $body['image_gen_base_url']  ?? ''; }
            if (array_key_exists('product_ref_image_url', $body)){ $sets[] = 'product_ref_image_url=?'; $vals[] = $body['product_ref_image_url'] ?? ''; }
            if (array_key_exists('product_refs', $body))          { $sets[] = 'product_refs=?';          $vals[] = $body['product_refs'] ?? '[]'; }
            if (array_key_exists('weekly_posts_target', $body))   { $sets[] = 'weekly_posts_target=?';   $vals[] = max(0, (int)($body['weekly_posts_target'] ?? 0)); }
            if ($encKey !== null) { $sets[] = 'image_gen_api_key_encrypted=?'; $vals[] = $encKey; }
            if (array_key_exists('research_provider', $body))      { $sets[] = 'research_provider=?';      $vals[] = $body['research_provider'] ?? 'none'; }
            if (array_key_exists('research_api_login', $body))     { $sets[] = 'research_api_login=?';     $vals[] = trim((string)($body['research_api_login'] ?? '')); }
            if (array_key_exists('research_location_code', $body)){ $sets[] = 'research_location_code=?'; $vals[] = max(1, (int)($body['research_location_code'] ?? 2764)); }
            if (array_key_exists('research_language_code', $body)){ $sets[] = 'research_language_code=?'; $vals[] = trim((string)($body['research_language_code'] ?? 'th')); }
            if (array_key_exists('research_cache_hours', $body))  { $sets[] = 'research_cache_hours=?';  $vals[] = min(8760, max(0, (int)($body['research_cache_hours'] ?? 168))); }
            if ($researchEncKey !== null) { $sets[] = 'research_api_key_encrypted=?'; $vals[] = $researchEncKey; }
            if (count($sets) > 1) {
                $vals[] = $tenantId;
                $db->prepare('UPDATE content_global_settings SET ' . implode(',', $sets) . ' WHERE tenant_id=?')->execute($vals);
            }
        } else {
            $db->prepare('INSERT INTO content_global_settings (tenant_id,global_instruction,image_gen_provider,image_gen_api_key_encrypted,image_gen_model,image_gen_base_url,product_ref_image_url,product_refs,weekly_posts_target,research_provider,research_api_login,research_api_key_encrypted,research_location_code,research_language_code,research_cache_hours) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
               ->execute([$tenantId, $body['global_instruction'] ?? '', $body['image_gen_provider'] ?? 'none', $encKey, $body['image_gen_model'] ?? '', $body['image_gen_base_url'] ?? '', $body['product_ref_image_url'] ?? '', $body['product_refs'] ?? '[]', max(0, (int)($body['weekly_posts_target'] ?? 0)), $body['research_provider'] ?? 'none', trim((string)($body['research_api_login'] ?? '')), $researchEncKey, max(1, (int)($body['research_location_code'] ?? 2764)), trim((string)($body['research_language_code'] ?? 'th')), min(8760, max(0, (int)($body['research_cache_hours'] ?? 168))) ]);
        }
        jsonResponse(['saved' => true]);
    }
}

// ─── SEO CHECKLIST (live evaluation for UI) ─────────────────────────────────
if ($action === 'seo-checklist') {
    if ($method !== 'GET') jsonError('Method not allowed', 405);
    $itemId = $_GET['item_id'] ?? '';
    if (!$itemId) jsonError('item_id required', 400);

    $stmt = $db->prepare('SELECT * FROM content_items WHERE id=? AND tenant_id=?');
    $stmt->execute([$itemId, $tenantId]);
    $item = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$item) jsonError('Content not found', 404);

    $eval = seo_evaluate($item);

    // สถานะเกตของ tenant (ให้ UI รู้ว่ากฎ fail จะบล็อกจริงหรือไม่)
    $cfgStmt = $db->prepare('SELECT seo_gate_enabled, seo_gate_min_score FROM content_global_settings WHERE tenant_id=?');
    $cfgStmt->execute([$tenantId]);
    $cfg = $cfgStmt->fetch(PDO::FETCH_ASSOC) ?: [];

    jsonResponse([
        'score'              => $eval['score'],
        'rules'              => $eval['rules'],
        'seo_gate_enabled'   => (int)($cfg['seo_gate_enabled'] ?? 0),
        'seo_gate_min_score' => (int)($cfg['seo_gate_min_score'] ?? 0),
    ]);
}

// โ”€โ”€โ”€ SKILLS โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
if ($action === 'skills') {
    if ($method === 'GET') {
        $stmt = $db->prepare('SELECT * FROM content_skills WHERE tenant_id=? ORDER BY created_at DESC');
        $stmt->execute([$tenantId]);
        $rows = $stmt->fetchAll();
        foreach ($rows as &$r) { $r['steps'] = $r['steps'] ? json_decode($r['steps'], true) : []; }
        jsonResponse($rows);
    }
    if ($method === 'POST') {
        $body = getRequestBody();
        if (empty($body['name'])) jsonError('กรุณาระบุชื่อ Skill');
        $id = generateUUID();
        $contentType = $body['content_type'] ?? 'article';
        $db->prepare('INSERT INTO content_skills (id,tenant_id,name,description,content_type,system_prompt,steps,created_by) VALUES (?,?,?,?,?,?,?,?)')
           ->execute([$id, $tenantId, $body['name'], $body['description'] ?? '', $contentType, $body['system_prompt'] ?? '', json_encode($body['steps'] ?? []), $userId]);
        $stmt = $db->prepare('SELECT * FROM content_skills WHERE id=? AND tenant_id=?');
        $stmt->execute([$id, $tenantId]);
        $row = $stmt->fetch();
        $row['steps'] = json_decode($row['steps'], true) ?? [];
        jsonResponse($row, 201);
    }
    if ($method === 'PUT') {
        $id = $_GET['id'] ?? null;
        if (!$id) jsonError('Missing id');
        $body = getRequestBody();
        $contentType = $body['content_type'] ?? 'article';
        $db->prepare('UPDATE content_skills SET name=?,description=?,content_type=?,system_prompt=?,steps=?,updated_at=NOW() WHERE id=? AND tenant_id=?')
           ->execute([$body['name'] ?? '', $body['description'] ?? '', $contentType, $body['system_prompt'] ?? '', json_encode($body['steps'] ?? []), $id, $tenantId]);
        $stmt = $db->prepare('SELECT * FROM content_skills WHERE id=? AND tenant_id=?');
        $stmt->execute([$id, $tenantId]);
        $row = $stmt->fetch();
        $row['steps'] = json_decode($row['steps'], true) ?? [];
        jsonResponse($row);
    }
    if ($method === 'DELETE') {
        $id = $_GET['id'] ?? null;
        if (!$id) jsonError('Missing id');
        $db->prepare('DELETE FROM content_skills WHERE id=? AND tenant_id=?')->execute([$id, $tenantId]);
        jsonResponse(['deleted' => true]);
    }
}

// โ”€โ”€โ”€ TRIGGERS โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
if ($action === 'triggers') {
    if ($method === 'GET') {
        $stmt = $db->prepare('SELECT t.*,s.name AS skill_name FROM content_triggers t LEFT JOIN content_skills s ON s.id=t.skill_id WHERE t.tenant_id=? ORDER BY t.created_at DESC');
        $stmt->execute([$tenantId]);
        jsonResponse($stmt->fetchAll());
    }
    if ($method === 'POST') {
        $body = getRequestBody();
        if (empty($body['command'])) jsonError('กรุณาระบุ Trigger Command');
        $id = generateUUID();
        $contentType = $body['content_type'] ?? 'article';
        $db->prepare('INSERT INTO content_triggers (id,tenant_id,command,skill_id,description,content_type,is_active,created_by) VALUES (?,?,?,?,?,?,1,?)')
           ->execute([$id, $tenantId, $body['command'], $body['skill_id'] ?: null, $body['description'] ?? '', $contentType, $userId]);
        jsonResponse(['id' => $id, 'command' => $body['command']], 201);
    }
    if ($method === 'PUT') {
        $id = $_GET['id'] ?? null;
        if (!$id) jsonError('Missing id');
        $body = getRequestBody();
        $contentType = $body['content_type'] ?? 'article';
        $db->prepare('UPDATE content_triggers SET command=?,skill_id=?,description=?,content_type=?,is_active=?,updated_at=NOW() WHERE id=? AND tenant_id=?')
           ->execute([$body['command'] ?? '', $body['skill_id'] ?: null, $body['description'] ?? '', $contentType, isset($body['is_active']) ? (int)$body['is_active'] : 1, $id, $tenantId]);
        jsonResponse(['updated' => true]);
    }
    if ($method === 'DELETE') {
        $id = $_GET['id'] ?? null;
        if (!$id) jsonError('Missing id');
        $db->prepare('DELETE FROM content_triggers WHERE id=? AND tenant_id=?')->execute([$id, $tenantId]);
        jsonResponse(['deleted' => true]);
    }
}

// โ”€โ”€โ”€ PLANS โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
if ($action === 'plans') {
    if ($method === 'GET') {
        $id = $_GET['id'] ?? null;
        if ($id) {
            $stmt = $db->prepare('SELECT * FROM content_plans WHERE id=? AND tenant_id=?');
            $stmt->execute([$id, $tenantId]);
            $plan = $stmt->fetch();
            if (!$plan) jsonError('Plan not found', 404);
            $stmt2 = $db->prepare("SELECT ci.id AS id, ci.plan_id, ci.title AS topic, ci.platform, ci.scheduled_date, ci.caption, ci.image_brief, ci.generated_image_url, COALESCE(ci.image_gen_status, 'none') AS image_gen_status, ci.article_content, ci.id AS content_item_id, ci.type AS content_type, ci.seo_title, ci.slug, ci.meta_description, ci.meta_keywords, ci.structured_data, ci.og_image, COALESCE(cpi.day_label, '') AS day_label, COALESCE(cpi.day_order, 0) AS day_order FROM content_items ci LEFT JOIN content_plan_items cpi ON cpi.id = ci.plan_item_id WHERE ci.plan_id = ? ORDER BY COALESCE(cpi.day_order, 0), ci.scheduled_date");
            $stmt2->execute([$id]);
            $plan['items'] = $stmt2->fetchAll();
            jsonResponse($plan);
        }
        $stmt = $db->prepare('SELECT * FROM content_plans WHERE tenant_id=? ORDER BY created_at DESC LIMIT 50');
        $stmt->execute([$tenantId]);
        $plans = $stmt->fetchAll();
        foreach ($plans as &$p) {
            $stmt2 = $db->prepare("SELECT ci.id AS id, ci.plan_id, ci.title AS topic, ci.platform, ci.scheduled_date, ci.caption, ci.image_brief, ci.generated_image_url, COALESCE(ci.image_gen_status, 'none') AS image_gen_status, ci.article_content, ci.id AS content_item_id, ci.type AS content_type, ci.seo_title, ci.slug, ci.meta_description, ci.meta_keywords, ci.structured_data, ci.og_image, COALESCE(cpi.day_label, '') AS day_label, COALESCE(cpi.day_order, 0) AS day_order FROM content_items ci LEFT JOIN content_plan_items cpi ON cpi.id = ci.plan_item_id WHERE ci.plan_id = ? ORDER BY COALESCE(cpi.day_order, 0), ci.scheduled_date");
            $stmt2->execute([$p['id']]);
            $p['items'] = $stmt2->fetchAll();
        }
        unset($p);
        jsonResponse($plans);
    }
    if ($method === 'PUT') {
        $id = $_GET['id'] ?? null;
        if (!$id) jsonError('Missing id');
        $body = getRequestBody();
        // Update plan-level fields
        $planFields = ['status', 'plan_start', 'plan_end'];
        $planSets = []; $planVals = [];
        foreach ($planFields as $f) {
            if (array_key_exists($f, $body)) { $planSets[] = "$f=?"; $planVals[] = $body[$f]; }
        }
        if ($planSets) {
            $planVals[] = $id; $planVals[] = $tenantId;
            $db->prepare('UPDATE content_plans SET ' . implode(',', $planSets) . ',updated_at=NOW() WHERE id=? AND tenant_id=?')->execute($planVals);
        }
        // Update a single item field
        if (!empty($body['item_id'])) {
            $itemId  = $body['item_id'];
            $allowed = ['caption', 'image_brief', 'topic', 'platform', 'day_label', 'day_order', 'scheduled_date'];
            // Map frontend field names to content_items column names
            $ciMap = ['topic'=>'title', 'caption'=>'caption', 'image_brief'=>'image_brief', 'platform'=>'platform', 'scheduled_date'=>'scheduled_date'];
            $ciSets = []; $ciVals = [];
            foreach ($allowed as $f) {
                if (array_key_exists($f, $body) && isset($ciMap[$f])) {
                    $ciSets[] = "{$ciMap[$f]}=?";
                    $ciVals[] = $body[$f];
                }
            }
            if ($ciSets) {
                $ciVals[] = $itemId;
                $ciVals[] = $tenantId;
                $db->prepare('UPDATE content_items SET ' . implode(',', $ciSets) . ',updated_at=NOW() WHERE id=? AND tenant_id=?')->execute($ciVals);
            }
            // Also update content_plan_items for day_label, day_order (backward compat)
            $cpiAllowed = ['caption', 'image_brief', 'topic', 'platform', 'day_label', 'day_order', 'scheduled_date'];
            $cpiSets = []; $cpiVals = [];
            foreach ($cpiAllowed as $f) {
                if (array_key_exists($f, $body)) { $cpiSets[] = "$f=?"; $cpiVals[] = $body[$f]; }
            }
            if ($cpiSets) {
                $db->prepare('UPDATE content_plan_items SET ' . implode(',', $cpiSets) . ',updated_at=NOW() WHERE id=(SELECT plan_item_id FROM content_items WHERE id=?)')->execute([...$cpiVals, $itemId]);
            }
        }
        jsonResponse(['updated' => true]);
    }
    if ($method === 'DELETE') {
        $id = $_GET['id'] ?? null;
        if (!$id) jsonError('Missing id');
        $db->prepare('DELETE FROM content_items WHERE plan_id=? AND tenant_id=?')->execute([$id, $tenantId]);
        $db->prepare('DELETE FROM content_plan_items WHERE plan_id=?')->execute([$id]);
        $db->prepare('DELETE FROM content_plans WHERE id=? AND tenant_id=?')->execute([$id, $tenantId]);
        jsonResponse(['deleted' => true]);
    }
}

// โ”€โ”€โ”€ GENERATE PLAN โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
if ($action === 'generate-plan' && $method === 'POST') {
    $body = getRequestBody();
    $triggerCommand  = trim($body['trigger_command'] ?? '');
    $skillId         = $body['skill_id'] ?? null;
    $brandContextIds = $body['brand_context_ids'] ?? [];
    $weekStart       = $body['week_start'] ?? date('Y-m-d');
    $planType        = $body['plan_type'] ?? 'weekly';
    $planStart       = $body['plan_start'] ?? null;
    $planEnd         = $body['plan_end'] ?? null;
    $platforms       = $body['platforms'] ?? []; // optional: force specific platforms
    // Backward compat: accept single platform string
    if (empty($platforms) && !empty($body['platform'])) $platforms = [$body['platform']];
    if (empty($triggerCommand)) jsonError('กรุณาระบุ Trigger Command');

    // Load global settings
    $stmt = $db->prepare('SELECT global_instruction FROM content_global_settings WHERE tenant_id=?');
    $stmt->execute([$tenantId]);
    $gs = $stmt->fetch();
    $globalInstruction = $gs['global_instruction'] ?? '';

    // Load brand contexts
    $contextTexts = [];
    if (!empty($brandContextIds)) {
        $ph = implode(',', array_fill(0, count($brandContextIds), '?'));
        $p  = array_merge($brandContextIds, [$tenantId]);
        $stmt = $db->prepare("SELECT name,file_type,content FROM brand_contexts WHERE id IN ($ph) AND tenant_id=?");
        $stmt->execute($p);
    } else {
        $stmt = $db->prepare('SELECT name,file_type,content FROM brand_contexts WHERE tenant_id=? ORDER BY file_type');
        $stmt->execute([$tenantId]);
    }
    foreach ($stmt->fetchAll() as $ctx) {
        $contextTexts[] = "=== {$ctx['name']} ({$ctx['file_type']}) ===\n{$ctx['content']}";
    }

    // Load skill
    $skillSystemPrompt = '';
    if ($skillId) {
        $stmt = $db->prepare('SELECT system_prompt FROM content_skills WHERE id=? AND tenant_id=?');
        $stmt->execute([$skillId, $tenantId]);
        $sk = $stmt->fetch();
        if ($sk) $skillSystemPrompt = $sk['system_prompt'] ?? '';
    }

    // Build shared system prompt (context + skill, no output-format section)
    $sysParts = [];
    if (in_array($planType, ['monthly', 'quarterly', 'yearly'])) {
        $sysParts[] = "## DATE INSTRUCTION\nAssign each post to a specific date within the plan range (start: {$planStart}, end: {$planEnd}). Use the \"scheduled_date\" field with format YYYY-MM-DD. Spread posts evenly across the plan period.";
    }
    if ($globalInstruction) $sysParts[] = "## Global Instruction\n{$globalInstruction}";
    if (!empty($contextTexts)) $sysParts[] = "## Brand Context\n" . implode("\n\n", $contextTexts);
    if ($skillSystemPrompt) $sysParts[] = "## Skill Instructions\n{$skillSystemPrompt}";
    if (!empty($platforms)) {
        $pList = implode(', ', $platforms);
        $sysParts[] = "## Platform Constraint\nYou MUST only use these platforms: {$pList}. Each post must pick one of these.";
    }
    $sysParts[] = <<<'PROMPT'
## CRITICAL LANGUAGE RULE
ตอบเป็นภาษาไทยเท่านั้น (Thai script only). ห้ามใช้ภาษาจีน เกาหลี ญี่ปุ่น (CJK) โดยเด็ดขาด. English is allowed ONLY for image_brief field and technical terms.

## OUTPUT RULE โ€” STRICTLY JSON ONLY
Your ENTIRE response must be ONE valid JSON object and nothing else.
- Do NOT write any explanation, reasoning, preamble, or commentary.
- Do NOT use markdown code fences (```json).
- Do NOT write sentences before or after the JSON.
- Start your response with { and end with }

Required JSON schema (all fields mandatory):
{"day_label":"วันจันทร์","day_order":1,"platform":"facebook","topic":"หัวข้อภาษาไทย","caption":"แคปชั่นภาษาไทย 3+ บรรทัด พร้อม #hashtag","image_brief":"Detailed English image prompt for DALL-E/Flux: scene, lighting, style, colors."}
PROMPT;

    $systemPrompt = implode("\n\n", $sysParts);

    // Determine AI model for content feature (text content โ’ fallback to legacy โ’ default)
    $stmt = $db->prepare('SELECT ai_content_text_model_id, ai_content_model_id, ai_default_model_id FROM company_settings WHERE tenant_id=?');
    $stmt->execute([$tenantId]);
    $ais = $stmt->fetch() ?: [];
    $modelName = 'kilo-auto/balanced';
    $modelId = $ais['ai_content_text_model_id'] ?? $ais['ai_content_model_id'] ?? $ais['ai_default_model_id'] ?? null;
    if ($modelId) {
        $stmt = $db->prepare('SELECT model_id FROM ai_models WHERE id=?');
        $stmt->execute([$modelId]);
        $mm = $stmt->fetch();
        if ($mm) $modelName = $mm['model_id'];
    }

    $creds = resolveAICreds($db, 'ai_content_text_model_id', $tenantId);
    if (empty($creds['api_key'])) jsonError('AI API key not configured — ตั้งค่า API Key ใน Admin > AI Settings ก่อน', 500);
    if (empty($creds['base_url'])) jsonError('AI API base URL not configured — ตั้งค่า Base URL ใน Admin > AI Settings', 500);

    // Test AI connection with a quick ping before starting generation
    $testApiUrl = rtrim($creds['base_url'], '/') . '/chat/completions';
    $testHeaders = ['Authorization: Bearer ' . $creds['api_key'], 'Content-Type: application/json'];
    $testCh = curl_init($testApiUrl);
    $testPayload = json_encode([
        'model' => $modelName,
        'messages' => [['role' => 'user', 'content' => 'test']],
        'max_tokens' => 1,
    ]);
    curl_setopt_array($testCh, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $testPayload,
        CURLOPT_HTTPHEADER => $testHeaders,
        CURLOPT_TIMEOUT => 5,  // Quick connectivity test
        CURLOPT_SSL_VERIFYPEER => !empty(AI_SSL_VERIFY),
    ]);
    $testResult = curl_exec($testCh);
    $testErr = curl_error($testCh);
    curl_close($testCh);

    if ($testResult === false) {
        jsonError("ไม่สามารถเชื่อมต่อ AI API: {$testErr} — กรุณาตรวจสอบการตั้งค่า API และอินเทอร์เน็ต", 500);
    }

    $testDecoded = json_decode($testResult, true);
    if (isset($testDecoded['error'])) {
        $errorMsg = $testDecoded['error']['message'] ?? 'Unknown API error';
        jsonError("AI API error: {$errorMsg} — กรุณาตรวจสอบ API Key และ Model Settings", 500);
    }

    $apiUrl  = $testApiUrl;
    $headers = $testHeaders;

    // Helper: call AI and return parsed JSON object (single item)
    $genParams = getAIContentParams($db, $tenantId);

    $callAI = function(string $userMsg) use ($apiUrl, $headers, $modelName, $systemPrompt, $genParams): array {
        $ch = curl_init($apiUrl);
        // max_tokens ต้องสูงพอสำหรับ reasoning models (StepFun/DeepSeek-R1) ที่ใช้ reasoning tokens ก่อน output
        // ไม่ set ค่าต่ำ (4096) เพราะ reasoning อาจกิน token หมดก่อน output JSON
        $payload = [
            'model'      => $modelName,
            'messages'   => [
                ['role' => 'system', 'content' => $systemPrompt],
                ['role' => 'user',   'content' => $userMsg],
            ],
            'max_tokens' => $genParams['max_tokens'],
            'stream'     => false,
        ];
        $sslVerify = !empty(AI_SSL_VERIFY);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => json_encode($payload),
            CURLOPT_HTTPHEADER     => $headers,
            CURLOPT_SSL_VERIFYPEER => $sslVerify,
            CURLOPT_SSL_VERIFYHOST => $sslVerify ? 2 : 0,
            CURLOPT_TIMEOUT        => $genParams['timeout'],
            CURLOPT_CONNECTTIMEOUT => 10,
        ]);
        $raw     = curl_exec($ch);
        $curlErr = curl_error($ch);
        $curlNo  = curl_errno($ch);
        curl_close($ch);
        if ($raw === false) {
            error_log("brand-content generate-plan curl error [$curlNo]: $curlErr");
            if ($curlNo === 35 && !$sslVerify) {
                return ['__error' => 'SSL revocation check failed (Windows schannel CRL). ลองปิดการตรวจสอบ CRL ใน Windows หรือใช้ OpenSSL backend'];
            }
            return ['__error' => 'curl: ' . $curlErr];
        }

        $dec = json_decode($raw, true);
        if (!empty($dec['error'])) return ['__error' => $dec['error']['message'] ?? json_encode($dec['error'])];

        $choice       = $dec['choices'][0] ?? null;
        $finishReason = $choice['finish_reason'] ?? '';
        $msg          = $choice['message'] ?? [];
        $content      = (string)($msg['content'] ?? '');
        if ($content === '') {
            // Reasoning/thinking models (e.g. StepFun, DeepSeek-R1) put output in reasoning field
            $content = (string)($msg['reasoning'] ?? $msg['reasoning_content'] ?? '');
        }
        if ($content === '') {
            return ['__error' => $finishReason === 'length' ? 'token_limit' : 'empty_content'];
        }

        // Strip code fences
        $j = trim(preg_replace(['/^```(?:json)?\s*/m', '/\s*```\s*$/m'], '', $content));
        // Sanitize CJK/unwanted chars from the raw JSON string BEFORE parsing
        $j = sanitizeAIOutput($j);

        // Helper: extract JSON objects from string using brace-depth counting
        $extractJsonObjects = function(string $s): array {
            $results = [];
            $len = strlen($s);
            $pos = 0;
            while (($pos = strpos($s, '{', $pos)) !== false) {
                $depth = 0; $inStr = false; $esc = false; $end = -1;
                for ($i = $pos; $i < $len; $i++) {
                    $c = $s[$i];
                    if ($esc)                              { $esc = false; continue; }
                    if ($c === '\\' && $inStr)             { $esc = true;  continue; }
                    if ($c === '"')                        { $inStr = !$inStr; continue; }
                    if ($inStr)                            { continue; }
                    if ($c === '{')                        { $depth++; }
                    elseif ($c === '}' && --$depth === 0)  { $end = $i; break; }
                }
                if ($end > $pos) {
                    $parsed = json_decode(substr($s, $pos, $end - $pos + 1), true);
                    if (is_array($parsed)) $results[] = $parsed;
                }
                $pos++;
            }
            return $results;
        };

        $obj = json_decode($j, true);
        if (!is_array($obj)) {
            // Model may have emitted thinking/preamble before the JSON.
            // Reasoning models put actual output LAST โ€” prefer the last valid JSON
            // that contains the expected plan-item keys.
            $candidates = $extractJsonObjects($j);
            $requiredKeys = ['topic', 'caption'];
            foreach (array_reverse($candidates) as $c) {
                if (count(array_intersect_key(array_flip($requiredKeys), $c)) === count($requiredKeys)) {
                    $obj = $c;
                    break;
                }
            }
            // Fallback: use any last valid JSON if required-keys match not found
            if (!is_array($obj) && !empty($candidates)) {
                $obj = end($candidates);
            }
        }
        if (!is_array($obj)) {
            if ($finishReason === 'length') return ['__error' => 'token_limit'];
            return ['__error' => 'parse_failed: ' . substr($content, 0, 200)];
        }
        // Sanitize: keep only ASCII + Thai โ€” strips Hebrew, Arabic, Cyrillic, CJK, etc.
        array_walk_recursive($obj, function (&$val) {
            if (is_string($val)) $val = sanitizeAIOutput($val);
        });
        return $obj;
    };

    // Loop N days (default 3, supports 1-7 via 'days' param for performance)
    // Reduced from 5 to 3 to prevent timeout issues with multiple AI calls
    $maxDays = min(7, max(1, (int)($body['days'] ?? 3)));

    // Validate total API calls won't exceed reasonable limits
    $platformCount = empty($platforms) ? 1 : count($platforms);
    $totalCalls = $maxDays * $platformCount;
    if ($totalCalls > 10) {
        jsonError("จำนวนการเรียก AI API มากเกินไป ({$totalCalls} calls) — กรุณาลดจำนวนวันหรือแพลตฟอร์ม (สูงสุด 10 calls รวม)", 400);
    }
    $allDayDefs = [
        ['จันทร์', 1], ['อังคาร', 2], ['พุธ', 3], ['พฤหัสบดี', 4], ['ศุกร์', 5],
        ['เสาร์', 6], ['อาทิตย์', 7],
    ];
    // For > 7 days, extend with Day N labels
    $days = [];
    for ($di = 0; $di < $maxDays; $di++) {
        if ($di < count($allDayDefs)) {
            $days[] = $allDayDefs[$di];
        } else {
            $days[] = ['วันที่ ' . ($di + 1), $di + 1];
        }
    }
    $planItems = [];
    $allRaw    = [];
    if (!empty($platforms)) {
        // Multi-platform mode: iterate day × platform, one article per pair
        foreach ($days as [$dayLabel, $dayOrder]) {
            $scheduledDate = date('Y-m-d', strtotime($weekStart . ' + ' . ($dayOrder - 1) . ' days'));
            foreach ($platforms as $plt) {
                $userMsg = "{$triggerCommand}\nสัปดาห์เริ่มต้น: {$weekStart}\nสร้างโพสต์สำหรับวัน{$dayLabel} (วันที่ {$dayOrder} ของสัปดาห์)\nPlatform ที่ต้องใช้: {$plt}\nREMINDER: Output ONLY the JSON object. Start with { and end with }. No other text.";
                $result  = $callAI($userMsg);
                if (isset($result['__error']) && str_starts_with($result['__error'], 'parse_failed')) {
                    $result = $callAI($userMsg . "\n[RETRY] Output ONLY JSON. Do not explain. Begin with {");
                }
                if (isset($result['__error'])) {
                    if ($result['__error'] === 'token_limit') {
                        jsonError("โมเดล {$modelName} ตอบถูกตัดสั้น (token limit) — กรุณาเปลี่ยนเป็นโมเดลที่มี output token สูงกว่าใน Admin > AI Settings", 500);
                    }
                    jsonError("AI error (�ѹ{$dayLabel} {$plt}): " . $result['__error'], 500);
                }
                $result['day_label']      = $dayLabel;
                $result['day_order']      = $dayOrder;
                $result['platform']       = $plt;
                $result['scheduled_date'] = $scheduledDate;
                $planItems[] = $result;
                $allRaw[]    = json_encode($result);
            }
        }
    } else {
        // No platform constraint: AI chooses platform per day
        foreach ($days as [$dayLabel, $dayOrder]) {
            $scheduledDate = date('Y-m-d', strtotime($weekStart . ' + ' . ($dayOrder - 1) . ' days'));
            $userMsg = "{$triggerCommand}\nสัปดาห์เริ่มต้น: {$weekStart}\nสร้างโพสต์สำหรับวัน{$dayLabel} (วันที่ {$dayOrder} ของสัปดาห์)\nREMINDER: Output ONLY the JSON object. Start with { and end with }. No other text.";
            $result  = $callAI($userMsg);
            if (isset($result['__error']) && str_starts_with($result['__error'], 'parse_failed')) {
                $result = $callAI($userMsg . "\n[RETRY] Output ONLY JSON. Do not explain. Begin with {");
            }
            if (isset($result['__error'])) {
                if ($result['__error'] === 'token_limit') {
                    jsonError("โมเดล {$modelName} ตอบถูกตัดสั้น (token limit) — กรุณาเปลี่ยนเป็นโมเดลที่มี output token สูงกว่าใน Admin > AI Settings", 500);
                }
                jsonError("AI error (�ѹ{$dayLabel}): " . $result['__error'], 500);
            }
            $result['day_label']      = $dayLabel;
            $result['day_order']      = $dayOrder;
            $result['scheduled_date'] = $scheduledDate;
            $planItems[] = $result;
            $allRaw[]    = json_encode($result);
        }
    }

    // Save plan + items
    $planId = generateUUID();
    $db->prepare('INSERT INTO content_plans (id,tenant_id,title,week_start,status,plan_type,plan_start,plan_end,trigger_command,skill_id,brand_context_ids,ai_raw_output,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)')
       ->execute([$planId, $tenantId, $triggerCommand, $weekStart, 'draft', $planType, $planStart, $planEnd, $triggerCommand, $skillId ?: null, json_encode($brandContextIds), implode("\n---\n", $allRaw), $userId]);

    foreach ($planItems as $item) {
        $itemId = generateUUID();
        $db->prepare('INSERT INTO content_plan_items (id,plan_id,day_label,day_order,scheduled_date,platform,topic,caption,image_brief) VALUES (?,?,?,?,?,?,?,?,?)')
           ->execute([$itemId, $planId, $item['day_label'] ?? '', (int)($item['day_order'] ?? 1), $item['scheduled_date'] ?? null, $item['platform'] ?? '', $item['topic'] ?? '', $item['caption'] ?? '', $item['image_brief'] ?? '']);

        // Also create content_items row as primary content store
        $ciId = generateUUID();
        $db->prepare('INSERT INTO content_items (id, tenant_id, title, type, status, created_by, plan_item_id, plan_id, platform, scheduled_date, caption, image_brief) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
           ->execute([$ciId, $tenantId, $item['topic'] ?? '', 'article', 'draft', $userId, $itemId, $planId, $item['platform'] ?? '', $item['scheduled_date'] ?? null, $item['caption'] ?? '', $item['image_brief'] ?? '']);
    }

    $stmt = $db->prepare('SELECT * FROM content_plans WHERE id=? AND tenant_id=?');
    $stmt->execute([$planId, $tenantId]);
    $plan = $stmt->fetch();
    $stmt2 = $db->prepare("SELECT ci.id AS id, ci.plan_id, ci.title AS topic, ci.platform, ci.scheduled_date, ci.caption, ci.image_brief, ci.generated_image_url, COALESCE(ci.image_gen_status, 'none') AS image_gen_status, ci.article_content, ci.id AS content_item_id, ci.type AS content_type, ci.seo_title, ci.slug, ci.meta_description, ci.meta_keywords, ci.structured_data, ci.og_image, COALESCE(cpi.day_label, '') AS day_label, COALESCE(cpi.day_order, 0) AS day_order FROM content_items ci LEFT JOIN content_plan_items cpi ON cpi.id = ci.plan_item_id WHERE ci.plan_id = ? ORDER BY COALESCE(cpi.day_order, 0), ci.scheduled_date");
    $stmt2->execute([$planId]);
    $plan['items'] = $stmt2->fetchAll();
    jsonResponse($plan, 201);
}

// โ”€โ”€โ”€ GENERATE IMAGE โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
if ($action === 'generate-image' && $method === 'POST') {
    $body      = getRequestBody();
    $itemId    = $body['item_id']  ?? null;
    $prompt    = $body['prompt']   ?? $body['image_brief'] ?? null;
    $refUrlsOverride = isset($body['ref_urls']) && is_array($body['ref_urls']) ? $body['ref_urls'] : null;
    if (!$itemId || !$prompt) jsonError('Missing item_id or prompt (or image_brief)');

    // ── Resolve image model ──────────────────────────────────────────────────
    // Primary: ai_content_image_model_id → ai_models → ai_providers
    // Fallback: legacy content_global_settings.image_gen_provider
    $provider  = 'kilo';
    $apiKey    = '';
    $modelName = 'dall-e-3';
    $baseUrl   = 'https://api.kilo.ai/api/gateway';

    $imgModelStmt = $db->prepare("
        SELECT ap.api_base_url, ap.api_key_encrypted, am.model_id
        FROM company_settings cs
        JOIN ai_models am ON am.id = cs.ai_content_image_model_id
        JOIN ai_providers ap ON ap.id = am.provider_id
        WHERE cs.tenant_id = ? AND ap.api_key_encrypted IS NOT NULL AND ap.api_key_encrypted != ''
    ");
    $imgModelStmt->execute([$tenantId]);
    $imgModelRow = $imgModelStmt->fetch();

    if ($imgModelRow && !empty($imgModelRow['api_key_encrypted'])) {
        $modelName = $imgModelRow['model_id'] ?: 'dall-e-3';
        $baseUrl   = rtrim($imgModelRow['api_base_url'] ?: 'https://api.kilo.ai/api/gateway', '/');
        $apiKey    = decryptValue($imgModelRow['api_key_encrypted']);
    } else {
        // Fallback: legacy content_global_settings
        $stmt = $db->prepare('SELECT * FROM content_global_settings WHERE tenant_id=?');
        $stmt->execute([$tenantId]);
        $legacy = $stmt->fetch() ?: [];
        $provider = $legacy['image_gen_provider'] ?? 'none';

        if ($provider === 'none') {
            $creds  = resolveAICreds($db, 'ai_content_image_model_id', $tenantId);
            $apiKey = $creds['api_key'] ?? '';
            if (!empty($apiKey)) {
                $provider = 'kilo';
                $baseUrl = rtrim($creds['base_url'] ?: 'https://api.kilo.ai/api/gateway', '/');
            } else {
                jsonError('ยังไม่ได้ตั้งค่า AI Provider กรุณาตั้งค่าที่ Admin > ตั้งค่า AI');
            }
        }

        if (!empty($legacy['image_gen_api_key_encrypted'])) {
            $apiKey = decryptValue($legacy['image_gen_api_key_encrypted']);
        }
        if ($provider === 'kilo' && empty($apiKey)) {
            $creds  = resolveAICreds($db, 'ai_content_image_model_id', $tenantId);
            $apiKey = $creds['api_key'] ?? '';
        }
        if (empty($apiKey)) jsonError('ยังไม่ได้ตั้งค่า API Key สำหรับ Image Generation');

        $baseUrl   = rtrim($legacy['image_gen_base_url'] ?: $baseUrl, '/');
        $modelName = $legacy['image_gen_model'] ?: $modelName;
    }

    // Enrich prompt with brand colors + product reference
    $fullPrompt = $prompt;
    $stmt2 = $db->prepare("SELECT parsed_data FROM brand_contexts WHERE tenant_id=? AND file_type='brand_md' LIMIT 1");
    $stmt2->execute([$tenantId]);
    $bc = $stmt2->fetch();
    if ($bc && !empty($bc['parsed_data'])) {
        $pd = json_decode($bc['parsed_data'], true);
        if (!empty($pd['colors'])) $fullPrompt .= ', brand colors: ' . implode(', ', $pd['colors']);
    }
    // Enrich with product reference images (named: {name, url} or legacy URL array)
    $refEntries = []; // [{name, url}]
    $gsStmt = $db->prepare("SELECT product_refs, product_ref_image_url FROM content_global_settings WHERE tenant_id=?");
    $gsStmt->execute([$tenantId]);
    $gsRow = $gsStmt->fetch();
    if ($gsRow) {
        // Primary: product_refs JSON with names
        if (!empty($gsRow['product_refs'])) {
            $parsed = json_decode($gsRow['product_refs'], true);
            if (is_array($parsed)) $refEntries = $parsed;
        }
        // Fallback: legacy product_ref_image_url
        if (empty($refEntries) && !empty($gsRow['product_ref_image_url'])) {
            $decoded = json_decode($gsRow['product_ref_image_url'], true);
            $urls = is_array($decoded) ? $decoded : [$gsRow['product_ref_image_url']];
            foreach ($urls as $i => $u) {
                if (filter_var($u, FILTER_VALIDATE_URL)) {
                    $refEntries[] = ['name' => "สินค้า #" . ($i + 1), 'url' => $u];
                }
            }
        }
    }
    // Normalize URLs: convert relative paths to absolute for API access
    $appUrl = rtrim((getenv('VITE_APP_URL') ?: ($_ENV['VITE_APP_URL'] ?? 'http://localhost:8080')), '/');
    // Apply user-selected ref_urls override (subset selection from UI)
    if ($refUrlsOverride !== null) {
        $allowedUrls = array_flip($refUrlsOverride);
        $refEntries = array_values(array_filter($refEntries, fn($e) => isset($allowedUrls[$e['url'] ?? ''])));
        // If override provided specific URLs not in saved refs, add them directly
        foreach ($refUrlsOverride as $ou) {
            $found = false;
            foreach ($refEntries as $re) { if ($re['url'] === $ou) { $found = true; break; } }
            if (!$found && filter_var($ou, FILTER_VALIDATE_URL)) {
                $refEntries[] = ['name' => 'สินค้าอ้างอิง', 'url' => $ou];
            }
        }
    }

    $refEntries = array_values(array_filter($refEntries, fn($e) => !empty($e['url'])));
    foreach ($refEntries as &$ref) {
        $u = $ref['url'];
        // Convert relative paths to absolute URLs
        if (!parse_url($u, PHP_URL_SCHEME)) {
            $ref['url'] = $appUrl . (str_starts_with($u, '/') ? $u : '/' . $u);
        }
        // Also keep original for display in prompt text
        $ref['display_url'] = $u;
    }
    unset($ref);
    if (!empty($refEntries)) {
        $refList = implode('; ', array_map(function($e) {
            $desc = $e['name'] ?? 'product';
            $meta = $e['metadata'] ?? null;
            if ($meta && is_array($meta)) {
                $parts = [];
                if (!empty($meta['product_type'])) $parts[] = 'type: ' . $meta['product_type'];
                if (!empty($meta['primary_color'])) $parts[] = 'primary color: ' . $meta['primary_color'];
                if (!empty($meta['shape_description'])) $parts[] = 'shape: ' . $meta['shape_description'];
                if (!empty($meta['texture_style'])) $parts[] = 'style: ' . $meta['texture_style'];
                if (!empty($meta['key_elements'])) $parts[] = 'features: ' . implode(', ', $meta['key_elements']);
                if (!empty($meta['mood'])) $parts[] = 'mood: ' . $meta['mood'];
                if (!empty($parts)) $desc .= ' [' . implode('; ', $parts) . ']';
            }
            return $desc . ': ' . ($e['display_url'] ?? $e['url']);
        }, $refEntries));
        $fullPrompt .= '. IMPORTANT: The product reference image(s) below are REAL product photos with metadata. Match the product appearance (colors, shape, features) EXACTLY. Available products: ' . $refList;
    }

    // Mark generating
    // Mark generating in both tables
    $db->prepare('UPDATE content_items SET image_gen_status=?,updated_at=NOW() WHERE id=? AND tenant_id=?')->execute(['generating', $itemId, $tenantId]);
    $db->prepare('UPDATE content_plan_items SET image_gen_status=?,updated_at=NOW() WHERE id=(SELECT plan_item_id FROM content_items WHERE id=?)')->execute(['generating', $itemId]);

    $imageUrl = null;
    $genError = null;

    // Helper: parse image URL from /images/generations response
    $parseImagesApiResponse = function(array $dec, string $raw) use (&$imageUrl, &$genError, $modelName): void {
        if (isset($dec['data'][0]['url'])) {
            $imageUrl = $dec['data'][0]['url'];
        } elseif (isset($dec['data'][0]['b64_json'])) {
            $imageUrl = 'data:image/png;base64,' . $dec['data'][0]['b64_json'];
        } else {
            $msg = is_array($dec['error'] ?? null) ? ($dec['error']['message'] ?? json_encode($dec['error'])) : ($dec['error'] ?? null);
            $genError = $msg ?: ('Image model returned no image: ' . substr($raw, 0, 300));
            error_log('[generate-image] images-api error | model=' . $modelName . ' | response=' . substr($raw, 0, 500));
        }
    };

    // Helper: parse image URL from /chat/completions response (vision models that output images)
    $parseChatImageResponse = function(array $dec, string $raw) use (&$imageUrl, &$genError, $modelName): void {
        // Format 1: choices[0].message.images[] (Kilo custom format)
        if (!empty($dec['choices'][0]['message']['images'])) {
            $imgData = $dec['choices'][0]['message']['images'][0];
            if (isset($imgData['image_url']['url'])) $imageUrl = $imgData['image_url']['url'];
        }
        // Format 2: content is array of blocks (standard OpenAI vision output)
        if (!$imageUrl && is_array($dec['choices'][0]['message']['content'] ?? null)) {
            foreach ($dec['choices'][0]['message']['content'] as $block) {
                if (($block['type'] ?? '') === 'image_url') {
                    $imageUrl = $block['image_url']['url'] ?? null;
                    if ($imageUrl) break;
                }
            }
        }
        // Format 3: content is string with markdown image or URL
        if (!$imageUrl && is_string($dec['choices'][0]['message']['content'] ?? null)) {
            $cnt = $dec['choices'][0]['message']['content'];
            if (preg_match('/!\[.*?\]\((.*?)\)/', $cnt, $m)) $imageUrl = $m[1];
            if (!$imageUrl && preg_match('/https?:\/\/\S+\.(?:png|jpg|jpeg|gif|webp)/i', $cnt, $m)) $imageUrl = $m[0];
        }
        if (!$imageUrl) {
            $msg = is_array($dec['error'] ?? null) ? ($dec['error']['message'] ?? json_encode($dec['error'])) : ($dec['error'] ?? null);
            $genError = $msg ?: ('Image model returned no image: ' . substr($raw, 0, 300));
            error_log('[generate-image] chat-image error | model=' . $modelName . ' | response=' . substr($raw, 0, 500));
        }
    };

    // Detect model capabilities
    $isImageGenModel  = (bool) preg_match('/gpt-image|gpt-\d+-image|dall-e|flux|imagen|ideogram|stable-diffusion/i', $modelName);
    // Any GPT image-generation model (gpt-image-1, gpt-5-image-mini, gpt-4o-image, etc.)
    // supports reference images via /images/generations `image` parameter
    $isGptImageModel  = (bool) preg_match('/gpt-image|gpt-\d+-image/i', $modelName);
    $isKilo           = (stripos($baseUrl, 'kilo') !== false);
    $hasProductRefs   = !empty($refEntries);

    // Helper: load product ref images as raw base64 strings (no data-URI prefix) for /images/generations
    $loadRefImagesBase64 = function(array $refs): array {
        $out = [];
        foreach ($refs as $ref) {
            if (empty($ref['url'])) continue;
            $b64uri = _loadImageAsBase64($ref['url']);
            if ($b64uri) {
                // Strip "data:image/...;base64," prefix — /images/generations wants raw base64
                if (preg_match('/^data:image\/[^;]+;base64,(.+)$/s', $b64uri, $m)) {
                    $out[] = $m[1];
                } else {
                    $out[] = $b64uri; // already raw (shouldn't happen)
                }
            }
        }
        return $out;
    };

    if ($isGptImageModel && $hasProductRefs && !$isKilo) {
        // Non-Kilo gpt-image models support reference images via /images/generations multipart.
        // Kilo only supports /chat/completions — handled in the Kilo block below.

        // Load first ref as the primary reference image binary
        $primaryRefData = null;
        $primaryRefMime = 'image/png';
        foreach ($refEntries as $ref) {
            $b64uri = _loadImageAsBase64($ref['url']);
            if ($b64uri && str_starts_with($b64uri, 'data:')) {
                if (preg_match('/^data:(image\/[^;]+);base64,(.+)$/s', $b64uri, $m)) {
                    $primaryRefData = base64_decode($m[2]);
                    $primaryRefMime = $m[1];
                    break;
                }
            }
        }

        if ($primaryRefData) {
            // Use /images/generations (multipart) with reference image(s).
            // gpt-image-1 / gpt-5-image-mini accept `image[]` as file inputs to guide generation.
            $ext = ($primaryRefMime === 'image/jpeg') ? 'jpg' : 'png';
            $boundary = '----FlowstackBoundary' . uniqid();
            $body  = "--$boundary\r\n";
            $body .= "Content-Disposition: form-data; name=\"model\"\r\n\r\n{$modelName}\r\n";
            $body .= "--$boundary\r\n";
            $body .= "Content-Disposition: form-data; name=\"prompt\"\r\n\r\n{$fullPrompt}\r\n";
            $body .= "--$boundary\r\n";
            $body .= "Content-Disposition: form-data; name=\"size\"\r\n\r\n1024x1024\r\n";
            $body .= "--$boundary\r\n";
            $body .= "Content-Disposition: form-data; name=\"n\"\r\n\r\n1\r\n";
            $body .= "--$boundary\r\n";
            $body .= "Content-Disposition: form-data; name=\"image[]\"; filename=\"ref.$ext\"\r\n";
            $body .= "Content-Type: $primaryRefMime\r\n\r\n" . $primaryRefData . "\r\n";
            // Add additional refs
            foreach (array_slice($refEntries, 1) as $ref) {
                $b64uri = _loadImageAsBase64($ref['url']);
                if ($b64uri && preg_match('/^data:(image\/[^;]+);base64,(.+)$/s', $b64uri, $m2)) {
                    $rData = base64_decode($m2[2]);
                    $rExt  = ($m2[1] === 'image/jpeg') ? 'jpg' : 'png';
                    $body .= "--$boundary\r\n";
                    $body .= "Content-Disposition: form-data; name=\"image[]\"; filename=\"ref.$rExt\"\r\n";
                    $body .= "Content-Type: {$m2[1]}\r\n\r\n" . $rData . "\r\n";
                }
            }
            $body .= "--$boundary--\r\n";

            $ch = curl_init($baseUrl . '/images/generations');
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_POST           => true,
                CURLOPT_POSTFIELDS     => $body,
                CURLOPT_HTTPHEADER     => [
                    'Authorization: Bearer ' . $apiKey,
                    'Content-Type: multipart/form-data; boundary=' . $boundary,
                ],
                CURLOPT_SSL_VERIFYPEER => !empty(AI_SSL_VERIFY),
                CURLOPT_SSL_VERIFYHOST => !empty(AI_SSL_VERIFY) ? 2 : 0,
                CURLOPT_TIMEOUT        => 180,
            ]);
            $res      = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);
            $dec = json_decode($res, true) ?: [];

            if ($httpCode < 400 && !empty($dec['data'][0])) {
                $parseImagesApiResponse($dec, $res);
            } else {
                error_log('[generate-image] /images/generations multipart failed (HTTP ' . $httpCode . ') | model=' . $modelName . ' | ' . substr($res, 0, 400));
                // Fallback: text-only /images/generations
                $fbPayload = ['model' => $modelName, 'prompt' => $fullPrompt, 'n' => 1, 'size' => '1024x1024', 'response_format' => 'b64_json'];
                $ch2 = curl_init($baseUrl . '/images/generations');
                curl_setopt_array($ch2, [CURLOPT_RETURNTRANSFER => true, CURLOPT_POST => true, CURLOPT_POSTFIELDS => json_encode($fbPayload),
                    CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $apiKey, 'Content-Type: application/json'],
                    CURLOPT_SSL_VERIFYPEER => !empty(AI_SSL_VERIFY), CURLOPT_SSL_VERIFYHOST => !empty(AI_SSL_VERIFY) ? 2 : 0, CURLOPT_TIMEOUT => 180]);
                $res2 = curl_exec($ch2); curl_close($ch2);
                $dec2 = json_decode($res2, true) ?: [];
                $parseImagesApiResponse($dec2, $res2);
            }
        } else {
            // No ref images could be loaded — fall through to text-only generation
            error_log('[generate-image] could not load any product ref images locally; falling back to text prompt | refs=' . json_encode(array_column($refEntries, 'url')));
            $fbPayload = ['model' => $modelName, 'prompt' => $fullPrompt, 'n' => 1, 'size' => '1024x1024', 'response_format' => 'b64_json'];
            $ch = curl_init($baseUrl . '/images/generations');
            curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_POST => true, CURLOPT_POSTFIELDS => json_encode($fbPayload),
                CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $apiKey, 'Content-Type: application/json'],
                CURLOPT_SSL_VERIFYPEER => !empty(AI_SSL_VERIFY), CURLOPT_SSL_VERIFYHOST => !empty(AI_SSL_VERIFY) ? 2 : 0, CURLOPT_TIMEOUT => 180]);
            $res = curl_exec($ch); curl_close($ch);
            $dec = json_decode($res, true) ?: [];
            $parseImagesApiResponse($dec, $res);
        }

    } elseif ($provider === 'dalle' && !$isKilo) {
        // Non-Kilo DALL-E: use /images/generations directly (text prompt only).
        $payload = ['model' => $modelName, 'prompt' => $fullPrompt, 'n' => 1, 'size' => '1024x1024'];
        $ch = curl_init($baseUrl . '/images/generations');
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => json_encode($payload),
            CURLOPT_HTTPHEADER     => ['Authorization: Bearer ' . $apiKey, 'Content-Type: application/json'],
            CURLOPT_SSL_VERIFYPEER => !empty(AI_SSL_VERIFY),
            CURLOPT_SSL_VERIFYHOST => !empty(AI_SSL_VERIFY) ? 2 : 0,
            CURLOPT_TIMEOUT        => 120,
        ]);
        $res = curl_exec($ch); curl_close($ch);
        $dec = json_decode($res, true) ?: [];
        $parseImagesApiResponse($dec, $res);

    } elseif ($provider === 'kilo' || $isKilo) {
        // Kilo gateway: only /chat/completions is available.
        // Image generation models (gpt-5-image-mini, etc.) only read the text prompt —
        // they IGNORE image_url blocks. So when product refs are provided, we use a
        // TWO-STEP approach: (1) vision model describes each ref in extreme detail,
        // (2) inject those descriptions into the generation prompt.

        if ($hasProductRefs) {
            // ── Step 1: Use vision model to describe each reference image ────────
            $textCreds  = resolveAICreds($db, 'ai_content_text_model_id', $tenantId);
            $visionModel = $textCreds['model'] ?? 'openai/gpt-4o-mini';
            $visionKey   = $textCreds['api_key'];
            $visionBase  = rtrim($textCreds['base_url'], '/');
            $refDescriptions = [];

            foreach ($refEntries as $refIdx => $ref) {
                $imgB64 = _loadImageAsBase64($ref['url']);
                if (!$imgB64) continue;

                $visionPayload = [
                    'model'      => $visionModel,
                    'messages'   => [[
                        'role'    => 'user',
                        'content' => [
                            ['type' => 'text', 'text' => 'Describe this reference image in extreme visual detail for an image generation AI. Focus on: exact physical appearance of any people (face shape, skin tone, hair color/style/length, eye color, facial features, body build, age), exact clothing (colors, style, fit, patterns, brand), exact product appearance (shape, color, texture, logo, packaging, materials), background and setting, lighting, mood, and composition. Be very specific and literal. Output a dense comma-separated description suitable as an image generation prompt, max 300 words.'],
                            ['type' => 'image_url', 'image_url' => ['url' => $imgB64, 'detail' => 'high']],
                        ],
                    ]],
                    'max_tokens' => 400,
                ];
                $vCh = curl_init($visionBase . '/chat/completions');
                curl_setopt_array($vCh, [
                    CURLOPT_RETURNTRANSFER => true, CURLOPT_POST => true,
                    CURLOPT_POSTFIELDS => json_encode($visionPayload),
                    CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $visionKey, 'Content-Type: application/json'],
                    CURLOPT_SSL_VERIFYPEER => !empty(AI_SSL_VERIFY), CURLOPT_SSL_VERIFYHOST => !empty(AI_SSL_VERIFY) ? 2 : 0,
                    CURLOPT_TIMEOUT => 30,
                ]);
                $vRes = curl_exec($vCh); curl_close($vCh);
                $vDec = json_decode($vRes, true) ?: [];
                $desc = trim($vDec['choices'][0]['message']['content'] ?? '');
                if ($desc) {
                    $label = $ref['name'] ? "Reference ({$ref['name']})" : "Reference " . ($refIdx + 1);
                    $refDescriptions[] = "$label: $desc";
                }
            }

            // ── Step 2: Inject descriptions into generation prompt ───────────────
            if (!empty($refDescriptions)) {
                $refBlock = implode("\n\n", $refDescriptions);
                $fullPrompt = "CRITICAL — reproduce the following reference subjects EXACTLY as described. " .
                    "Preserve every visual detail: faces, hair, skin, clothing, products.\n\n" .
                    $refBlock . "\n\nSCENE: " . $fullPrompt;
            }
        }

        // Build chat message for the image gen model (text-only now, refs in prompt)
        if ($isImageGenModel) {
            $msgContent = 'Generate an image based on this description. Output ONLY the image: ' . $fullPrompt;
        } else {
            // Vision/multimodal model — can also accept image_url blocks as additional context
            $parts = [['type' => 'text', 'text' => 'Generate an image based on this description: ' . $fullPrompt]];
            if ($hasProductRefs) {
                foreach ($refEntries as $ref) {
                    $imgB64 = _loadImageAsBase64($ref['url']);
                    if ($imgB64) $parts[] = ['type' => 'image_url', 'image_url' => ['url' => $imgB64, 'detail' => 'high']];
                }
            }
            $msgContent = $parts;
        }

        $payload = [
            'model'    => $modelName,
            'messages' => [['role' => 'user', 'content' => $msgContent]],
            'max_tokens' => 4096,
        ];
        $ch = curl_init($baseUrl . '/chat/completions');
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => json_encode($payload),
            CURLOPT_HTTPHEADER     => ['Authorization: Bearer ' . $apiKey, 'Content-Type: application/json'],
            CURLOPT_SSL_VERIFYPEER => !empty(AI_SSL_VERIFY),
            CURLOPT_SSL_VERIFYHOST => !empty(AI_SSL_VERIFY) ? 2 : 0,
            CURLOPT_TIMEOUT        => 180,
        ]);
        $res = curl_exec($ch); curl_close($ch);
        $dec = json_decode($res, true) ?: [];
        $parseChatImageResponse($dec, $res);

    } elseif ($provider === 'flux') {
        $model   = $modelName ?: 'black-forest-labs/flux-schnell';
        $payload = ['input' => ['prompt' => $fullPrompt, 'num_outputs' => 1]];
        $ch = curl_init($baseUrl . '/models/' . $model . '/predictions');
        curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_POST => true, CURLOPT_POSTFIELDS => json_encode($payload), CURLOPT_HTTPHEADER => ['Authorization: Token ' . $apiKey, 'Content-Type: application/json', 'Prefer: wait'], CURLOPT_SSL_VERIFYPEER => !empty(AI_SSL_VERIFY), CURLOPT_SSL_VERIFYHOST => !empty(AI_SSL_VERIFY) ? 2 : 0, CURLOPT_TIMEOUT => 120]);
        $res = curl_exec($ch); curl_close($ch);
        $dec = json_decode($res, true);
        if (isset($dec['output'][0])) {
            $imageUrl = $dec['output'][0];
        } elseif (isset($dec['urls']['get'])) {
            // Poll
            $pollUrl = $dec['urls']['get'];
            for ($i = 0; $i < 25; $i++) {
                sleep(3);
                $ch2 = curl_init($pollUrl);
                curl_setopt_array($ch2, [CURLOPT_RETURNTRANSFER => true, CURLOPT_HTTPHEADER => ['Authorization: Token ' . $apiKey], CURLOPT_SSL_VERIFYPEER => defined('AI_SSL_VERIFY') ? AI_SSL_VERIFY : true, CURLOPT_TIMEOUT => 30]);
                $p2 = curl_exec($ch2); curl_close($ch2);
                $pd = json_decode($p2, true);
                if (($pd['status'] ?? '') === 'succeeded') { $imageUrl = $pd['output'][0] ?? null; break; }
                if (($pd['status'] ?? '') === 'failed')    { $genError = $pd['error'] ?? 'Failed'; break; }
            }
        } else {
            $genError = $dec['detail'] ?? 'Failed to start prediction';
        }
    }

    if ($imageUrl) {
        // If base64 data URL, save to file to avoid max_allowed_packet issues
        $savedUrl = _saveImageUrl($imageUrl, $itemId);
        $db->prepare('UPDATE content_items SET generated_image_url=?,image_gen_status=?,updated_at=NOW() WHERE id=? AND tenant_id=?')
           ->execute([$savedUrl, 'done', $itemId, $tenantId]);
    $db->prepare('UPDATE content_plan_items SET generated_image_url=?,image_gen_status=?,updated_at=NOW() WHERE id=(SELECT plan_item_id FROM content_items WHERE id=?)')
           ->execute([$savedUrl, 'done', $itemId]);
        jsonResponse(['image_url' => $savedUrl, 'status' => 'done']);
    } else {
        $db->prepare('UPDATE content_items SET image_gen_status=?,updated_at=NOW() WHERE id=? AND tenant_id=?')
           ->execute(['failed', $itemId, $tenantId]);
    $db->prepare('UPDATE content_plan_items SET image_gen_status=?,updated_at=NOW() WHERE id=(SELECT plan_item_id FROM content_items WHERE id=?)')
           ->execute(['failed', $itemId]);
        jsonError('Image generation failed: ' . ($genError ?? 'Unknown error'), 500);
    }
}

// โ”€โ”€โ”€ CONVERT-BRIEF (multipart file โ’ AI โ’ full brand package) โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€

// ─── GENERATE-SCENE-IMAGES ─────────────────────────────────────────────────────
if ($action === 'generate-scene-images' && $method === 'POST') {
    $body   = getRequestBody();
    $itemId = $body['item_id'] ?? null;
    if (!$itemId) jsonError('Missing item_id');

    $itemStmt = $db->prepare('SELECT id, title, article_content FROM content_items WHERE id=? AND tenant_id=?');
    $itemStmt->execute([$itemId, $tenantId]);
    $item = $itemStmt->fetch();
    if (!$item) jsonError('��辺 content item', 404);

    $ac = json_decode($item['article_content'] ?? '{}', true);
    $scenes = $ac['scenes'] ?? [];

    // Fallback: convert visuals → scenes when no scenes array exists yet
    if (empty($scenes) && !empty($ac['visuals']) && is_array($ac['visuals'])) {
        $scenes = array_values(array_map(function($v) {
            $text = is_string($v) ? $v : ($v['visual_prompt'] ?? $v['content'] ?? '');
            $shot = '';
            $prompt = $text;
            if (preg_match('/^(?:Scene|Shot)\s*\d*\s*[:：-]\s*(.+)/i', $text, $m)) {
                $shot = trim(substr($text, 0, strpos($text, $m[1]) - 1));
                $prompt = trim($m[1]);
            }
            return ['visual_prompt' => $prompt, 'shot' => $shot];
        }, $ac['visuals']));
        $scenes = array_values(array_filter($scenes, fn($s) => !empty($s['visual_prompt'])));
    }

    if (empty($scenes)) jsonError('ไม่มี scenes หรือ visuals ใน article_content — กรุณาสร้างสคริปต์ก่อน');

    // Resolve image model
    $modelName = 'dall-e-3';
    $baseUrl   = 'https://api.kilo.ai/api/gateway';
    $apiKey    = '';

    $imgModelStmt = $db->prepare("
        SELECT ap.api_base_url, ap.api_key_encrypted, am.model_id
        FROM company_settings cs
        JOIN ai_models am ON am.id = cs.ai_content_image_model_id
        JOIN ai_providers ap ON ap.id = am.provider_id
        WHERE cs.tenant_id = ? AND ap.api_key_encrypted IS NOT NULL AND ap.api_key_encrypted != ''
    ");
    $imgModelStmt->execute([$tenantId]);
    $imgModelRow = $imgModelStmt->fetch();

    if ($imgModelRow && !empty($imgModelRow['api_key_encrypted'])) {
        $modelName = $imgModelRow['model_id'] ?: 'dall-e-3';
        $baseUrl   = rtrim($imgModelRow['api_base_url'] ?: 'https://api.kilo.ai/api/gateway', '/');
        $apiKey    = decryptValue($imgModelRow['api_key_encrypted']);
    } else {
        $creds  = resolveAICreds($db, 'ai_content_image_model_id', $tenantId);
        $apiKey = $creds['api_key'] ?? '';
        $baseUrl = rtrim($creds['base_url'] ?: 'https://api.kilo.ai/api/gateway', '/');
    }
    if (empty($apiKey)) jsonError('ยังไม่ได้ตั้งค่า AI Provider สำหรับ Image Generation');

    $db->prepare('UPDATE content_items SET image_gen_status=?, updated_at=NOW() WHERE id=? AND tenant_id=?')
       ->execute(['generating', $itemId, $tenantId]);

    // Enrichment suffix: brand colors + product references
    $enrichSuffix = '';
    $bcStmt = $db->prepare("SELECT parsed_data FROM brand_contexts WHERE tenant_id=? AND file_type='brand_md' LIMIT 1");
    $bcStmt->execute([$tenantId]);
    $bcRow = $bcStmt->fetch();
    if ($bcRow && !empty($bcRow['parsed_data'])) {
        $pd = json_decode($bcRow['parsed_data'], true);
        if (!empty($pd['colors'])) $enrichSuffix .= ', brand colors: ' . implode(', ', $pd['colors']);
    }
    $sceneRefUrls = [];
    $gsStmt2 = $db->prepare("SELECT product_refs, product_ref_image_url FROM content_global_settings WHERE tenant_id=?");
    $gsStmt2->execute([$tenantId]);
    $gsRow2 = $gsStmt2->fetch();
    if ($gsRow2) {
        $entries = [];
        if (!empty($gsRow2['product_refs'])) {
            $parsed = json_decode($gsRow2['product_refs'], true);
            if (is_array($parsed)) $entries = $parsed;
        }
        if (empty($entries) && !empty($gsRow2['product_ref_image_url'])) {
            $decoded = json_decode($gsRow2['product_ref_image_url'], true);
            $urls = is_array($decoded) ? $decoded : [$gsRow2['product_ref_image_url']];
            foreach ($urls as $i => $u) {
                if (!empty($u)) $entries[] = ['name' => "สินค้า #" . ($i + 1), 'url' => $u];
            }
        }
        // Normalize relative URLs to absolute
        $sceneRefUrls = array_values(array_filter($entries, fn($e) => !empty($e['url'])));
        foreach ($sceneRefUrls as &$sref) {
            $su = $sref['url'];
            if (!parse_url($su, PHP_URL_SCHEME)) {
                $sref['url'] = $appUrl . (str_starts_with($su, '/') ? $su : '/' . $su);
            }
        }
        unset($sref);
        if (!empty($sceneRefUrls)) {
            $refList = implode('; ', array_map(function($e) {
                $desc = $e['name'] ?? 'product';
                $meta = $e['metadata'] ?? null;
                if ($meta && is_array($meta)) {
                    $p = [];
                    if (!empty($meta['product_type'])) $p[] = $meta['product_type'];
                    if (!empty($meta['primary_color'])) $p[] = 'color: ' . $meta['primary_color'];
                    if (!empty($meta['key_elements'])) $p[] = implode(', ', $meta['key_elements']);
                    if (!empty($p)) $desc .= ' [' . implode('; ', $p) . ']';
                }
                return $desc . ': ' . $e['url'];
            }, $sceneRefUrls));
            $enrichSuffix .= '. Match product EXACTLY from this reference (colors, shape, features): ' . $refList;
        }
    }

    $results = [];

    foreach ($scenes as $idx => &$scene) {
        $vp = $scene['visual_prompt'] ?? '';
        if (empty($vp)) {
            $results[] = ['scene_index' => $idx, 'status' => 'skipped', 'reason' => 'no visual_prompt'];
            continue;
        }

        $fullPrompt = $vp . $enrichSuffix;
        if (!empty($scene['shot'])) $fullPrompt = $scene['shot'] . ' — ' . $fullPrompt;

        $isKiloScene = (stripos($baseUrl, 'kilo') !== false);
        $isImageGenModelScene = (bool) preg_match('/gpt-image|gpt-\d+-image|dall-e|flux|imagen|ideogram|stable-diffusion/i', $modelName);
        if (!$isKiloScene) {
            // Non-Kilo provider: use /images/generations
            $payload = ['model' => $modelName, 'prompt' => $fullPrompt, 'n' => 1, 'size' => '1024x1024'];
            $ch = curl_init($baseUrl . '/images/generations');
        } else {
            // Kilo gateway: only /chat/completions is accepted. Text-only for image-gen models.
            $sceneMsg = 'Generate an image based on this description. Return ONLY the image, no text explanation: ' . $fullPrompt;
            $payload = [
                'model' => $modelName,
                'messages' => [['role' => 'user', 'content' => $sceneMsg]],
                'max_tokens' => 4096,
            ];
            $ch = curl_init($baseUrl . '/chat/completions');
        }
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => json_encode($payload),
            CURLOPT_HTTPHEADER     => ['Authorization: Bearer ' . $apiKey, 'Content-Type: application/json'],
            CURLOPT_SSL_VERIFYPEER => !empty(AI_SSL_VERIFY),
            CURLOPT_TIMEOUT        => 120,
        ]);
        $res = curl_exec($ch);
        curl_close($ch);
        $dec = json_decode($res, true) ?: [];

        $imgUrl = null;
        if (!$isKiloScene) {
            // Parse /images/generations response
            if (isset($dec['data'][0]['url'])) $imgUrl = $dec['data'][0]['url'];
            elseif (isset($dec['data'][0]['b64_json'])) $imgUrl = 'data:image/png;base64,' . $dec['data'][0]['b64_json'];
        } else {
            // Parse /chat/completions image response (multiple formats)
            if (!empty($dec['choices'][0]['message']['images'])) {
                $imgData = $dec['choices'][0]['message']['images'][0];
                if (isset($imgData['image_url']['url'])) $imgUrl = $imgData['image_url']['url'];
            }
            if (!$imgUrl && is_array($dec['choices'][0]['message']['content'] ?? null)) {
                foreach ($dec['choices'][0]['message']['content'] as $block) {
                    if (($block['type'] ?? '') === 'image_url') { $imgUrl = $block['image_url']['url'] ?? null; if ($imgUrl) break; }
                }
            }
            if (!$imgUrl && is_string($dec['choices'][0]['message']['content'] ?? null)) {
                $cnt = $dec['choices'][0]['message']['content'];
                if (preg_match('/!\[.*?\]\((.*?)\)/', $cnt, $m)) $imgUrl = $m[1];
                if (!$imgUrl && preg_match('/https?:\/\/\S+\.(?:png|jpg|jpeg|gif|webp)/i', $cnt, $m)) $imgUrl = $m[0];
            }
        }

        if ($imgUrl) {
            $savedUrl = _saveImageUrl($imgUrl, $itemId . '_scene' . $idx);
            $scene['image_url'] = $savedUrl;
            $results[] = ['scene_index' => $idx, 'status' => 'done', 'image_url' => $savedUrl];
        } else {
            $errMsg = is_array($dec['error'] ?? null) ? ($dec['error']['message'] ?? json_encode($dec['error'])) : ($dec['error'] ?? null);
            $err = $errMsg ?: substr($res, 0, 200);
            error_log('[generate-scene-images] error | model=' . $modelName . ' | scene=' . $idx . ' | response=' . substr($res, 0, 300));
            $results[] = ['scene_index' => $idx, 'status' => 'failed', 'error' => $err];
        }
    }

    $ac['scenes'] = $scenes;
    $newJson = json_encode($ac, JSON_UNESCAPED_UNICODE);
    $db->prepare('UPDATE content_items SET article_content=?, image_gen_status=?, updated_at=NOW() WHERE id=? AND tenant_id=?')
       ->execute([$newJson, 'done', $itemId, $tenantId]);

    $doneCount = count(array_filter($results, fn($r) => ($r['status'] ?? '') === 'done'));
    jsonResponse([
        'status'       => 'done',
        'scenes'       => $results,
        'scenes_done'  => $doneCount,
        'scenes_total' => count($results),
    ]);
}

if ($action === 'convert-brief') {
    if ($method !== 'POST') jsonError('Method not allowed', 405);
    if (empty($_FILES['file'])) jsonError('กรุณาแนบไฟล์');

    $file = $_FILES['file'];
    if ($file['error'] !== UPLOAD_ERR_OK) jsonError('อัปโหลดล้มเหลว (error code ' . $file['error'] . ')');
    if ($file['size'] > 10 * 1024 * 1024) jsonError('ไฟล์ต้องมีขนาดไม่เกิน 10 MB');

    $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    if (!in_array($ext, ['pdf', 'docx', 'txt', 'md', 'doc'])) {
        jsonError('รองรับเฉพาะ .pdf .docx .txt .md เท่านั้น');
    }

    $tmpPath = $file['tmp_name'];
    $rawText = '';

    if ($ext === 'txt' || $ext === 'md') {
        $rawText = file_get_contents($tmpPath);

    } elseif ($ext === 'docx' || $ext === 'doc') {
        if (class_exists('ZipArchive')) {
            $zip = new ZipArchive();
            if ($zip->open($tmpPath) === true) {
                $xml = $zip->getFromName('word/document.xml');
                $zip->close();
                if ($xml) {
                    $t = preg_replace('/<w:br[^>]*\/>/', "\n", $xml);
                    $t = preg_replace('/<w:p[ >]/', "\n", $t);
                    $t = preg_replace('/<[^>]+>/', '', $t);
                    $rawText = html_entity_decode(trim($t), ENT_QUOTES | ENT_XML1, 'UTF-8');
                }
            }
        }
        if (!trim($rawText)) jsonError('ไม่สามารถอ่านไฟล์ .docx ได้ กรุณาบันทึกเป็น .txt แล้วลองใหม่');

    } elseif ($ext === 'pdf') {
        $escaped = escapeshellarg($tmpPath);
        $out = @shell_exec("pdftotext $escaped - 2>/dev/null");
        if ($out && strlen(trim($out)) > 30) {
            $rawText = $out;
        } else {
            $binary = file_get_contents($tmpPath);
            preg_match_all('/[\x20-\x7E\x0A\x0D]{6,}/', $binary, $m);
            $chunks  = array_filter($m[0] ?? [], fn($s) => strlen(trim($s)) >= 8);
            $rawText = implode("\n", array_slice(array_values($chunks), 0, 400));
        }
        if (!trim($rawText)) jsonError('ไม่พบข้อความใน PDF กรุณา copy แล้ว paste ในช่อง Markdown แทน');
    }

    $rawText    = mb_substr(trim($rawText), 0, 8000);
    $sourceName = pathinfo($file['name'], PATHINFO_FILENAME);
    if (mb_strlen($rawText) < 20) jsonError('ไม่พบข้อความในไฟล์ กรุณาตรวจสอบว่าไฟล์มีเนื้อหาที่อ่านได้');

    // โ”€โ”€ Default fallback package (no AI / AI fails) โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
    $fallbackPackage = [
        'brand_md' => "# Brand Identity\n\nBrand Name: {$sourceName}\nDescription: \nTone of Voice: \nTarget Audience: \n\n## Color Palette\n- Primary: #000000\n\n## Key Messages\n- \n\n## Brand Personality\n- \n\n---\n\n" . $rawText,
        'sop_md'   => "# SOP Rules\n\n## Do's\n- ยึดถือ Brand Identity อย่างสม่ำเสมอ\n- ใช้ภาษาที่เหมาะกับกลุ่มเป้าหมาย\n- ตรวจสอบความถูกต้องก่อนโพสต์ทุกครั้ง\n- ใช้สีและ Visual ที่สอดคล้องกับ Brand\n- มี Call-to-Action ที่ชัดเจนทุกโพสต์\n\n## Don'ts\n- ห้ามใช้ภาษาที่รุนแรงหรือไม่เหมาะสม\n- ห้ามโพสต์ข้อมูลที่ขัดแย้งกับ Brand Values\n- ห้ามลอกเลียนเนื้อหาของคู่แข่ง\n- ห้ามใช้สีนอกเหนือจาก Brand Color Palette\n\n## Forbidden Topics\n- เนื้อหาที่สร้างความเข้าใจผิดเกี่ยวกับสินค้า\n- การเปรียบเทียบแบบลบหลู่คู่แข่ง\n\n## Content Standards\n- ทุกโพสต์ต้องตรวจสอบ Grammar และ Spelling\n- ใช้ Tone ที่สม่ำเสมอตาม Brand Voice\n\n## Quality Checklist\n- [ ] ตรงกับ Brand Identity?\n- [ ] Tone of Voice ถูกต้อง?\n- [ ] มี Call-to-Action?\n- [ ] ภาพสอดคล้องกับ Brand Visual?\n- [ ] ตรวจสอบ Hashtag แล้ว?",
        'skills'   => [
            [
                'name'          => 'Social Media Caption Writer',
                'description'   => 'เขียนแคปชั่น Social Media ที่ตรงกับ Brand Voice',
                'system_prompt' => 'คุณเป็นนักเขียนแคปชั่น Social Media ผู้เชี่ยวชาญ เข้าใจ Brand Identity อย่างลึกซึ้ง เขียนเนื้อหาที่ดึงดูด สร้างสรรค์ และสอดคล้องกับ Tone of Voice ของแบรนด์เสมอ ใช้ภาษาที่เหมาะกับ Target Audience และแพลตฟอร์ม',
                'steps'         => [
                    ['instruction' => 'ศึกษา Brand Identity, Tone of Voice และ Target Audience', 'output_type' => 'analysis'],
                    ['instruction' => 'เขียนแคปชั่นที่ดึงดูดใจพร้อม Hashtag และ Call-to-Action', 'output_type' => 'caption'],
                ],
            ],
            [
                'name'          => 'Weekly Content Planner',
                'description'   => 'วางแผนคอนเทนต์รายสัปดาห์แบบครบวงจร',
                'system_prompt' => 'คุณเป็น Content Strategist ระดับมืออาชีพ วางแผนคอนเทนต์ 5 วัน (จันทร์–ศุกร์) โดยคำนึงถึง Brand Identity, Audience Journey และ Content Mix (Educate / Entertain / Inspire / Convert) อย่างสมดุล แต่ละวันต้องมี Topic, Caption และ Image Brief ที่ครบถ้วน',
                'steps'         => [
                    ['instruction' => 'กำหนด Theme และ Topic แต่ละวัน ให้ครอบคลุม Content Pillar', 'output_type' => 'plan'],
                    ['instruction' => 'เขียนแคปชั่นและ Call-to-Action แต่ละวันให้สอดคล้องกับ Brand Voice', 'output_type' => 'caption'],
                    ['instruction' => 'เขียน Image Brief สำหรับภาพแต่ละวันโดยอ้างอิง Brand Visual Identity', 'output_type' => 'image_brief'],
                ],
            ],
            [
                'name'          => 'AI Image Brief Generator',
                'description'   => 'สร้าง Prompt/Brief ภาพสำหรับ AI Image Generator',
                'system_prompt' => 'คุณเป็นผู้เชี่ยวชาญ Visual Storytelling และ Prompt Engineering สำหรับ AI Image Generation เขียน Image Brief ที่ละเอียด ชัดเจน สอดคล้องกับ Brand Visual Identity, สีแบรนด์ (#HEX), Mood & Tone และองค์ประกอบภาพที่ต้องการ',
                'steps'         => [
                    ['instruction' => 'วิเคราะห์ Brand Visual Identity, Color Palette และ Mood ของแบรนด์', 'output_type' => 'analysis'],
                    ['instruction' => 'เขียน Detailed Image Brief พร้อม Style, Mood, Lighting, Color Direction และ Composition', 'output_type' => 'image_brief'],
                ],
            ],
        ],
        'triggers' => [
            ['command' => 'Content Plan สัปดาห์หน้า', 'description' => 'สร้างแผนคอนเทนต์รายสัปดาห์', 'skill_index' => 1],
            ['command' => 'เขียนแคปชั่น Instagram',   'description' => 'สร้างแคปชั่นสำหรับ Instagram', 'skill_index' => 0],
            ['command' => 'เขียนแคปชั่น Facebook',    'description' => 'สร้างแคปชั่นสำหรับ Facebook',  'skill_index' => 0],
            ['command' => 'สร้าง Brief รูปโพสต์',     'description' => 'สร้าง Image Brief สำหรับ AI',   'skill_index' => 2],
            ['command' => 'วิเคราะห์ Brand Voice',    'description' => 'วิเคราะห์ความสม่ำเสมอของ Brand Voice', 'skill_index' => -1],
        ],
    ];

    $creds   = resolveAICreds($db, 'ai_content_text_model_id', $tenantId);
    $package = null;
    $aiUsed  = false;

    // Resolve text-content model from admin AI settings
    $briefModelName = 'claude-3-5-sonnet-20241022';
    $briefStmt = $db->prepare('SELECT ai_content_text_model_id, ai_content_model_id, ai_default_model_id FROM company_settings WHERE tenant_id=?');
    $briefStmt->execute([$tenantId]);
    $briefRow   = $briefStmt->fetch() ?: [];
    $briefModelId = $briefRow['ai_content_text_model_id'] ?? $briefRow['ai_content_model_id'] ?? $briefRow['ai_default_model_id'] ?? null;
    if ($briefModelId) {
        $mmStmt = $db->prepare('SELECT model_id FROM ai_models WHERE id=?');
        $mmStmt->execute([$briefModelId]);
        $mm = $mmStmt->fetch();
        if ($mm) $briefModelName = $mm['model_id'];
    }

    if (!empty($creds['api_key'])) {
        $systemPrompt = 'You are a senior brand content strategist. Analyze the brand brief and return ONLY a single valid JSON object (no markdown code fences, no extra text) with exactly these 4 keys:

"brand_md": Complete brand.md Markdown. Sections: # Brand Identity header, then key-value lines: Brand Name, Description, Tone of Voice, Target Audience; then ## Color Palette (extract #HEX from source or propose 3 fitting brand colors); then ## Key Messages (4-5 bullet points); then ## Brand Personality (6-8 adjectives). All content must be derived from the brand brief.

"sop_md": Complete claude.md / SOP Markdown. Sections: # SOP Rules; ## Do\'s (min 6 specific rules for THIS brand); ## Don\'ts (min 6 specific rules); ## Forbidden Topics (3-5 items relevant to this brand); ## Content Standards (3-4 items); ## Quality Checklist (5 checkbox items). All rules must reference actual brand values, not generic advice.

"skills": Array of exactly 3 skill objects. Each: {"name": string, "description": string (Thai OK), "system_prompt": string (3-5 sentences, mentions actual brand name and characteristics), "steps": [{"instruction": string, "output_type": "caption"|"image_brief"|"plan"|"analysis"}]}. Required skills: (0) brand-specific caption/copy writer, (1) weekly content planner, (2) AI image brief generator. System prompts must reference this specific brand.

"triggers": Array of exactly 5 trigger objects. Each: {"command": string (short Thai/English actionable phrase), "description": string, "skill_index": integer (0-2 mapping to skills, or -1)}. Commands should be brand-relevant and practical.

Use Thai language for brand_md and sop_md if the source is Thai. ตอบเป็นภาษาไทยเท่านั้น. Return ONLY valid JSON.';

        $payload = json_encode([
            'model'       => $briefModelName,
            'messages'    => [
                ['role' => 'system', 'content' => $systemPrompt],
                ['role' => 'user',   'content' => "Brand Brief Document:\n\n" . $rawText],
            ],
            'max_tokens'  => $creds['max_tokens'] ?? 8192,
            'temperature' => 0.25,
        ]);

        $ch = curl_init($creds['base_url'] . '/chat/completions');
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST           => true,
            CURLOPT_HTTPHEADER     => ['Content-Type: application/json', 'Authorization: Bearer ' . $creds['api_key']],
            CURLOPT_POSTFIELDS     => $payload,
            CURLOPT_TIMEOUT        => $creds['timeout'] ?? 300,
            CURLOPT_SSL_VERIFYPEER => defined('AI_SSL_VERIFY') ? AI_SSL_VERIFY : true,
        ]);
        $aiRaw   = curl_exec($ch);
        $curlErr = curl_error($ch);
        curl_close($ch);

        if (!$curlErr) {
            $dec     = json_decode($aiRaw, true);
            $msg     = $dec['choices'][0]['message'] ?? [];
            $content = trim((string)($msg['content'] ?? $msg['reasoning'] ?? $msg['reasoning_content'] ?? ''));
            // Strip markdown fences if model wrapped JSON
            $content = preg_replace('/^```(?:json)?\s*/i', '', $content);
            $content = preg_replace('/\s*```\s*$/', '', $content);
            $decoded = json_decode($content, true);
            if ($decoded && isset($decoded['brand_md'], $decoded['sop_md'], $decoded['skills'], $decoded['triggers'])) {
                $package = $decoded;
                $aiUsed  = true;
            }
        }
    }

    if (!$package) {
        $package = $fallbackPackage;
    }

    jsonResponse([
        'brand_md'    => $package['brand_md']  ?? $fallbackPackage['brand_md'],
        'sop_md'      => $package['sop_md']    ?? $fallbackPackage['sop_md'],
        'skills'      => $package['skills']    ?? $fallbackPackage['skills'],
        'triggers'    => $package['triggers']  ?? $fallbackPackage['triggers'],
        'ai_used'     => $aiUsed,
        'source_name' => $sourceName,
    ]);
}

// โ”€โ”€โ”€ SAVE-BRIEF-PACKAGE (save all brand brief outputs at once) โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
if ($action === 'save-brief-package') {
    if ($method !== 'POST') jsonError('Method not allowed', 405);
    $body  = getRequestBody();
    $saved = ['contexts' => 0, 'skills' => 0, 'triggers' => 0];

    // Save brand.md context
    if (!empty($body['brand_md'])) {
        $id      = generateUUID();
        $name    = trim($body['brand_md_name'] ?? 'brand.md') ?: 'brand.md';
        $content = $body['brand_md'];
        $parsed  = json_encode(parseBrandMd($content));
        $db->prepare('INSERT INTO brand_contexts (id,tenant_id,name,file_type,content,parsed_data,created_by) VALUES (?,?,?,?,?,?,?)')
           ->execute([$id, $tenantId, $name, 'brand_md', $content, $parsed, $userId]);
        $saved['contexts']++;
    }

    // Save sop/claude.md context
    if (!empty($body['sop_md'])) {
        $id      = generateUUID();
        $name    = trim($body['sop_md_name'] ?? 'claude.md') ?: 'claude.md';
        $content = $body['sop_md'];
        $db->prepare('INSERT INTO brand_contexts (id,tenant_id,name,file_type,content,parsed_data,created_by) VALUES (?,?,?,?,?,?,?)')
           ->execute([$id, $tenantId, $name, 'sop_md', $content, null, $userId]);
        $saved['contexts']++;
    }

    // Save skills and collect id map
    $skillIdMap = [];
    foreach (($body['skills'] ?? []) as $idx => $sk) {
        if (empty($sk['name'])) continue;
        $id = generateUUID();
        $db->prepare('INSERT INTO content_skills (id,tenant_id,name,description,system_prompt,steps,created_by) VALUES (?,?,?,?,?,?,?)')
           ->execute([$id, $tenantId, $sk['name'], $sk['description'] ?? '', $sk['system_prompt'] ?? '', json_encode($sk['steps'] ?? []), $userId]);
        $skillIdMap[(int)$idx] = $id;
        $saved['skills']++;
    }

    // Save triggers (map skill_index โ’ real skill_id)
    foreach (($body['triggers'] ?? []) as $tr) {
        if (empty($tr['command'])) continue;
        $skillId  = null;
        $skillIdx = isset($tr['skill_index']) ? (int)$tr['skill_index'] : -1;
        if ($skillIdx >= 0 && isset($skillIdMap[$skillIdx])) $skillId = $skillIdMap[$skillIdx];
        $id = generateUUID();
        $db->prepare('INSERT INTO content_triggers (id,tenant_id,command,skill_id,description,is_active,created_by) VALUES (?,?,?,?,?,1,?)')
           ->execute([$id, $tenantId, $tr['command'], $skillId, $tr['description'] ?? '', $userId]);
        $saved['triggers']++;
    }

    jsonResponse(['saved' => $saved]);
}

// โ”€โ”€โ”€ CHANNELS โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
if ($action === 'channels') {
    if ($method === 'GET') {
        // คอลัมน์ตระกูล token_* มาจาก pre-pass ของ api/cron/content-metrics-sync.php
        // ต้องระบุชื่อตรง ๆ เพราะ SELECT นี้เจาะจงคอลัมน์ (ไม่ใช่ *) คอลัมน์ใหม่จึงไม่ถึง frontend เอง
        // ไม่ส่ง credentials_encrypted ออกไปเหมือนเดิม
        $stmt = $db->prepare(
            "SELECT id,name,platform,endpoint_url,is_active,created_at,
                    token_expires_at,data_access_expires_at,token_checked_at,token_status,token_error
               FROM publish_channels WHERE tenant_id=? ORDER BY created_at ASC"
        );
        $stmt->execute([$tenantId]);
        jsonResponse($stmt->fetchAll());
    }
    if ($method === 'POST') {
        $body = getRequestBody();
        if (empty($body['name']) || empty($body['platform'])) jsonError('name and platform required', 400);
        $id   = generateUUID();
        $creds = !empty($body['credentials']) ? encryptValue(json_encode($body['credentials'])) : null;
        $db->prepare("INSERT INTO publish_channels (id,tenant_id,name,platform,endpoint_url,credentials_encrypted,is_active,created_by) VALUES (?,?,?,?,?,?,1,?)")
           ->execute([$id, $tenantId, $body['name'], $body['platform'], $body['endpoint_url'] ?? '', $creds, $userId]);
        jsonResponse(['id' => $id]);
    }
    if ($method === 'PUT') {
        $id   = $_GET['id'] ?? '';
        $body = getRequestBody();
        if (!$id) jsonError('id required', 400);
        $sets = []; $params = [];
        if (isset($body['name']))         { $sets[] = 'name=?';         $params[] = $body['name']; }
        if (isset($body['platform']))     { $sets[] = 'platform=?';     $params[] = $body['platform']; }
        if (isset($body['endpoint_url'])) { $sets[] = 'endpoint_url=?'; $params[] = $body['endpoint_url']; }
        if (isset($body['is_active']))    { $sets[] = 'is_active=?';    $params[] = (int)$body['is_active']; }
        // creds: merge ทับเฉพาะคีย์ที่ส่งค่ามาจริง — ตามที่ UI สัญญาไว้ว่า "(เว้นว่างเพื่อไม่เปลี่ยน)"
        // เดิมเขียนทับทั้งชุด ทำให้แก้แค่ชื่อช่องทาง (frontend ส่ง credentials: {} มาด้วยเสมอ)
        // ล้าง creds หายทั้งหมด และกรอกแค่ access_token ก็ทำให้ page_id หาย
        // ส่ง credentials_replace: true มาด้วยถ้าต้องการเขียนทับทั้งชุด (ใช้ลบคีย์ที่ไม่ใช้แล้ว)
        if (isset($body['credentials']) && is_array($body['credentials'])) {
            $current = [];
            if (empty($body['credentials_replace'])) {
                $curStmt = $db->prepare("SELECT credentials_encrypted FROM publish_channels WHERE id=? AND tenant_id=?");
                $curStmt->execute([$id, $tenantId]);
                $enc = (string)($curStmt->fetchColumn() ?: '');
                if ($enc !== '') {
                    $decoded = json_decode(decryptValue($enc), true);
                    if (is_array($decoded)) $current = $decoded;
                }
            }
            // trim: token ที่ copy มามัก ติด space/newline ท้ายค่า ซึ่งทำให้ปลายทางตอบ error
            // ที่อ่านไม่รู้สาเหตุ — ตัดทิ้งตรงนี้ที่เดียว และค่าว่าง = ไม่เปลี่ยนค่าเดิม
            $incoming = [];
            foreach ($body['credentials'] as $k => $v) {
                if (!is_scalar($v)) continue;
                $trimmed = trim((string)$v);
                if ($trimmed === '') continue;
                $incoming[$k] = $trimmed;
            }
            $merged = array_merge($current, $incoming);
            if ($merged !== $current) {
                $sets[] = 'credentials_encrypted=?';
                $params[] = encryptValue(json_encode($merged));
            }
        }
        if (empty($sets)) jsonError('nothing to update', 400);
        $params[] = $id; $params[] = $tenantId;
        $db->prepare("UPDATE publish_channels SET ".implode(',',$sets)." WHERE id=? AND tenant_id=?")->execute($params);
        jsonResponse(['ok' => true]);
    }
    if ($method === 'DELETE') {
        $id = $_GET['id'] ?? '';
        if (!$id) jsonError('id required', 400);
        $db->prepare("DELETE FROM publish_channels WHERE id=? AND tenant_id=?")->execute([$id, $tenantId]);
        jsonResponse(['ok' => true]);
    }
}

// โ”€โ”€โ”€ SCHEDULES โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
if ($action === 'schedules') {
    if ($method === 'GET') {
        $itemId = $_GET['item_id'] ?? '';
        if (!$itemId) jsonError('item_id required', 400);
        $stmt = $db->prepare("SELECT cs.*, pc.name as channel_name, pc.platform FROM content_schedules cs JOIN publish_channels pc ON pc.id=cs.channel_id WHERE cs.plan_item_id=? ORDER BY cs.scheduled_at ASC");
        $stmt->execute([$itemId]);
        jsonResponse($stmt->fetchAll());
    }
    if ($method === 'POST') {
        $body = getRequestBody();
        if (empty($body['plan_item_id']) || empty($body['channel_id']) || empty($body['scheduled_at'])) jsonError('plan_item_id, channel_id, scheduled_at required', 400);
        $id = generateUUID();
        $db->prepare("INSERT INTO content_schedules (id,plan_item_id,channel_id,scheduled_at,status,created_by) VALUES (?,?,?,?,?,?)")
           ->execute([$id, $body['plan_item_id'], $body['channel_id'], $body['scheduled_at'], 'pending', $userId]);
        jsonResponse(['id' => $id]);
    }
    if ($method === 'PUT') {
        $id   = $_GET['id'] ?? '';
        $body = getRequestBody();
        $newDt = $body['scheduled_at'] ?? '';
        if (!$id || !$newDt) jsonError('id and scheduled_at required', 400);
        $db->prepare("UPDATE content_schedules SET scheduled_at=?, status='pending', updated_at=NOW()
            WHERE id=? AND plan_item_id IN (
                SELECT cpi.id FROM content_plan_items cpi
                JOIN content_plans cp ON cp.id = cpi.plan_id
                WHERE cp.tenant_id = ?
            )")
           ->execute([$newDt, $id, $tenantId]);
        jsonResponse(['ok' => true]);
    }
    if ($method === 'DELETE') {
        $id = $_GET['id'] ?? '';
        if (!$id) jsonError('id required', 400);
        $db->prepare("DELETE FROM content_schedules WHERE id=? AND plan_item_id IN (
                SELECT cpi.id FROM content_plan_items cpi
                JOIN content_plans cp ON cp.id = cpi.plan_id
                WHERE cp.tenant_id = ?
            )")->execute([$id, $tenantId]);
        jsonResponse(['ok' => true]);
    }
}

// โ”€โ”€โ”€ GENERATE-ARTICLE โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
if ($action === 'generate-article') {
    // Wrap entire action in try/catch to surface real errors instead of Apache 500 page
    set_error_handler(function($errno, $errstr, $errfile, $errline) {
        throw new ErrorException($errstr, 0, $errno, $errfile, $errline);
    });
    try {
    if ($method !== 'POST') jsonError('Method not allowed', 405);
    $body        = getRequestBody();
    $itemId      = $body['item_id']      ?? '';
    $kbArticleId = $body['kb_article_id'] ?? '';
    if (!$itemId) jsonError('item_id required', 400);

    $item = $db->prepare("SELECT ci.*, ci.title AS topic, cp.trigger_command, cp.brand_context_ids, cpi.day_label, cpi.day_order FROM content_items ci LEFT JOIN content_plans cp ON cp.id = ci.plan_id LEFT JOIN content_plan_items cpi ON cpi.id = ci.plan_item_id WHERE ci.id = ? AND ci.tenant_id = ?");
    $item->execute([$itemId, $tenantId]);
    $item = $item->fetch();
    if (!$item) jsonError('Item not found', 404);

    // Load brand contexts
    $contextIds = json_decode($item['brand_context_ids'] ?? '[]', true);
    $brandText  = '';
    if (!empty($contextIds)) {
        $in    = implode(',', array_fill(0, count($contextIds), '?'));
        $cstmt = $db->prepare("SELECT name, content FROM brand_contexts WHERE id IN ($in) AND tenant_id=?");
        $cstmt->execute([...$contextIds, $tenantId]);
    } else {
        $cstmt = $db->prepare("SELECT name, content FROM brand_contexts WHERE tenant_id=? LIMIT 5");
        $cstmt->execute([$tenantId]);
    }
    foreach ($cstmt->fetchAll() as $ctx) {
        $brandText .= "\n\n### {$ctx['name']}\n{$ctx['content']}";
    }

    // Load Knowledge Base article as additional context if requested
    $kbContext = '';
    if ($kbArticleId) {
        $kbStmt = $db->prepare("SELECT title, content FROM knowledge_base WHERE id=? AND tenant_id=?");
        $kbStmt->execute([$kbArticleId, $tenantId]);
        $kbRow = $kbStmt->fetch();
        if ($kbRow) {
            $kbContext = "\n\n### แหล่งข้อมูลอ้างอิง (Knowledge Base): {$kbRow['title']}\n{$kbRow['content']}";
        }
    }

    // Load global instruction
    $gStmt = $db->prepare("SELECT global_instruction FROM content_global_settings WHERE tenant_id=?");
    $gStmt->execute([$tenantId]);
    $globalInstr = $gStmt->fetchColumn() ?: '';

    $creds = resolveAICreds($db, 'ai_content_text_model_id', $tenantId);
    if (empty($creds['api_key'])) jsonError('ไม่มี AI API Key — ตั้งค่า API Key ใน Admin > AI Settings ก่อน', 500);

    // Resolve model: text content โ’ legacy โ’ default
    $modelName = 'kilo-auto/balanced';
    $contentTimeout   = 300;
    $contentMaxTokens = 8192;
    $msStmt = $db->prepare('SELECT ai_content_text_model_id, ai_content_model_id, ai_default_model_id, ai_content_timeout, ai_content_max_tokens FROM company_settings WHERE tenant_id=?');
    $msStmt->execute([$tenantId]);
    $msRow = $msStmt->fetch() ?: [];
    $modelId = $msRow['ai_content_text_model_id'] ?? $msRow['ai_content_model_id'] ?? $msRow['ai_default_model_id'] ?? null;
    if ($modelId) {
        $mmStmt = $db->prepare('SELECT model_id FROM ai_models WHERE id=?');
        $mmStmt->execute([$modelId]);
        $mm = $mmStmt->fetch();
        if ($mm) $modelName = $mm['model_id'];
    }
    if (!empty($msRow['ai_content_timeout']) && (int)$msRow['ai_content_timeout'] >= 30) {
        $contentTimeout = (int)$msRow['ai_content_timeout'];
    }
    if (!empty($msRow['ai_content_max_tokens']) && (int)$msRow['ai_content_max_tokens'] >= 256) {
        $contentMaxTokens = (int)$msRow['ai_content_max_tokens'];
    }

    // โ”€โ”€ Helper: call AI, return raw text content (strips fences) โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
    $apiUrl  = rtrim($creds['base_url'], '/') . '/chat/completions';
    $headers = ['Content-Type: application/json', "Authorization: Bearer {$creds['api_key']}"];
    $baseCtx = ($globalInstr ? $globalInstr."\n\n" : '') . ($brandText ? "Brand Context:{$brandText}\n\n" : '') . ($kbContext ? "Knowledge Base Reference:{$kbContext}\n\n" : '');

    $aiCall = function(string $sysPart, string $userMsg) use ($apiUrl, $headers, $modelName, $baseCtx, $contentTimeout, $contentMaxTokens): string {
        $ch = curl_init($apiUrl);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST           => true,
            CURLOPT_HTTPHEADER     => $headers,
            CURLOPT_POSTFIELDS     => json_encode([
                'model'       => $modelName,
                'messages'    => [
                    ['role' => 'system', 'content' => $baseCtx . $sysPart],
                    ['role' => 'user',   'content' => $userMsg],
                ],
                'max_tokens'  => $contentMaxTokens,
                'stream'      => false,
            ]),
            CURLOPT_TIMEOUT        => $contentTimeout,
            CURLOPT_CONNECTTIMEOUT => 20,
            CURLOPT_SSL_VERIFYPEER => defined('AI_SSL_VERIFY') ? AI_SSL_VERIFY : true,
            CURLOPT_ENCODING       => '',
        ]);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $raw = curl_exec($ch);
        $err = curl_error($ch);
        $curlInfo = curl_getinfo($ch);
        curl_close($ch);
        if ($raw === false) {
            error_log('[brand-content aiCall] curl error: ' . $err . ' | model=' . $modelName . ' | url=' . $apiUrl . ' | timeout=' . $contentTimeout);
            throw new RuntimeException('curl: ' . $err);
        }
        if ($httpCode >= 400) {
            error_log('[brand-content aiCall] HTTP ' . $httpCode . ' | model=' . $modelName . ' | raw=' . substr($raw, 0, 800));
            throw new RuntimeException('Provider returned HTTP ' . $httpCode . ': ' . substr($raw, 0, 300));
        }
        $dec = json_decode($raw, true);
        if (!is_array($dec)) {
            error_log('[brand-content aiCall] Non-JSON response | model=' . $modelName . ' | raw=' . substr($raw, 0, 800));
            throw new RuntimeException('AI returned non-JSON response (HTTP ' . $httpCode . ', content-type: ' . ($curlInfo['content_type'] ?? 'unknown') . ')');
        }
        if (!empty($dec['error'])) {
            $errMsg = is_array($dec['error']) ? ($dec['error']['message'] ?? json_encode($dec['error'])) : $dec['error'];
            error_log('[brand-content aiCall] Provider error: ' . $errMsg . ' | model=' . $modelName . ' | raw=' . substr($raw, 0, 500));
            throw new RuntimeException((string)$errMsg);
        }
        $msg_    = $dec['choices'][0]['message'] ?? [];
        $content = (string)($msg_['content'] ?? '');
        if ($content === '') {
            // Reasoning/thinking models (e.g. StepFun, DeepSeek-R1) put output in reasoning field
            $content = (string)($msg_['reasoning'] ?? $msg_['reasoning_content'] ?? '');
        }
        if ($content === '') {
            $fr  = $dec['choices'][0]['finish_reason'] ?? 'unknown';
            $raw = substr(json_encode($dec, JSON_UNESCAPED_UNICODE), 0, 400);
            throw new RuntimeException("empty_content (finish_reason={$fr}) raw={$raw}");
        }
        // Strip markdown fences only โ€” do NOT sanitize here (would corrupt JSON)
        $cleaned = trim(preg_replace(['/^```(?:json)?\s*/m', '/\s*```\s*$/m'], '', $content));
        return $cleaned;
    };

    // Sanitize text values inside a decoded array recursively (after JSON parse)
    $sanitizeArr = function(mixed $v) use (&$sanitizeArr): mixed {
        if (is_string($v)) return sanitizeAIOutput($v);
        if (is_array($v))  return array_map($sanitizeArr, $v);
        return $v;
    };

    $itemPlatform = $item['platform'] ?? 'facebook';
    $isVideo = strtolower((string)($item['type'] ?? 'article')) === 'video';
    $itemCtx = "หัวข้อ: {$item['topic']}\nแพลตฟอร์ม: {$itemPlatform}\nแคปชั่น:\n{$item['caption']}";

    // โ”€โ”€ Step 1: Generate full structured content in one call โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
    if ($isVideo) {
        // Video-first prompt: detailed scene-by-scene script for TikTok/YouTube
        $mainSys = "CRITICAL: ตอบเป็นภาษาไทยเท่านั้น ห้ามใช้ภาษาจีน เกาหลี ญี่ปุ่น (CJK). English OK for technical terms only.\n" .
                   "คุณเป็น Video Content Creator ผู้เชี่ยวชาญ ตอบกลับเป็น JSON เท่านั้น ไม่มี markdown fence\n" .
                   "โครงสร้าง JSON สำหรับวิดีโอ:\n" .
                   '{"title":"ชื่อวิดีโอ","excerpt":"สรุปเนื้อหาวิดีโอ 1-2 ประโยค","seo_title":"SEO title สำหรับวิดีโอ","slug":"url-friendly-slug","meta_description":"คำอธิบายสำหรับการค้นหา 120-160 ตัวอักษร",' .
                   '"headlines":{"viral_clickbait":[{"title":"หัวข้อ hook","hook":"ประโยคเปิด"}],"storytelling":[{"title":"หัวข้อ","hook":"hook"}],"educational":[{"title":"หัวข้อ","hook":"hook"}]},' .
                   '"scripts":{"tiktok":"Hook 3 วิ: ...\nScene 1 (0:00-0:15): ...\nScene 2 (0:15-0:35): ...\nScene 3 (0:35-0:55): ...\nCTA: ...","youtube":"Intro (0:00-0:30): ...\nSection 1 (0:30-2:00): ...\nSection 2 (2:00-4:00): ...\nOutro (4:00-4:30): ...","facebook":"ประกาศวิดีโอ + caption สำหรับ Facebook","instagram":"caption สำหรับ Reels/Instagram"},' .
                   '"script_sections":{"opening":"Hook 3 วินาทีแรก","bridge":"เนื้อหาหลัก","twist":"จุดพลิกหรือข้อมูลสำคัญ","ending":"CTA + Subscribe/Follow"},' .
                   '"visuals":["Scene 1: คำอธิบายภาพ/การถ่าย","Scene 2: คำอธิบายภาพ/การถ่าย","Scene 3: คำอธิบายภาพ/การถ่าย"],' .
                   '"hashtags":["#hashtag1","#hashtag2","#hashtag3","#hashtag4","#hashtag5"]}';
    } else {
        // Article/social-first prompt with SEO/AEO optimization
        $jsonSchema = '{"title":"ชื่อบทความ (SEO optimized)","excerpt":"สรุป 1-2 ประโยค","seo_title":"SEO Title Tag","slug":"url-friendly-slug","meta_description":"Meta description ภาษาไทย 150-160 chars","meta_keywords":"keyword1, keyword2, ...","full_html":"<article>\\n<h2>heading</h2>\\n<p>content paragraph</p>\\n<h2>heading 2</h2>\\n<p>more content</p>\\n</article> (semantic HTML ใช้ h2,h3,p,ul,ol,blockquote,table ห้ามใช้ h1 เนื่องจากสงวนให้ title) เนื้อหาเข้มข้น >=500 คำ","structured_data":{"@context":"https://schema.org","@type":"Article","headline":"...","description":"..."},"structured_data_faq":{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":"คำถาม","acceptedAnswer":{"@type":"Answer","text":"คำตอบ"}}]} (ใส่เฉพาะเมื่อบทความมี Q&A จริง)","headlines":{"viral_clickbait":[{"title":"...","hook":"..."}],"storytelling":[{"title":"...","hook":"..."}],"educational":[{"title":"...","hook":"..."}]},"scripts":{"facebook":"post สั้น","instagram":"caption","tiktok":"script TikTok","youtube":"script YouTube"},"script_sections":{"opening":"hook","bridge":"เนื้อหา","twist":"จุดพลิก","ending":"CTA"},"visuals":["ภาพประกอบ 1","ภาพประกอบ 2"],"hashtags":["#tag1","#tag2","#tag3","#tag4","#tag5"]}';
        $mainSys = "CRITICAL: ตอบเป็นภาษาไทยเท่านั้น ห้ามใช้ภาษาจีน เกาหลี ญี่ปุ่น (CJK). English OK for technical terms only.\n" .
                   "คุณเป็นนักเขียน Content Marketing + SEO Specialist ตอบกลับเป็น JSON เท่านั้น ไม่มี markdown fence\n" .
                   "โครงสร้าง JSON ที่ต้องการ:\n{$jsonSchema}\n\n" .
                   "SEO/AEO Rules:\n" .
                   "- full_html: เขียนด้วย semantic HTML5 (h2, h3, p, ul, ol, blockquote, table) — ห้ามใช้ h1\n" .
                   "- ใส่ FAQ schema (structured_data_faq) เฉพาะเมื่อบทความมีรูปแบบคำถาม-คำตอบจริง\n" .
                   "- ใช้คำหลัก (keywords) ใน heading และ paragraph แรกอย่างเป็นธรรมชาติ\n" .
                   "- ความยาว article_content >=500 คำ\n" .
                   "- Answer Engine Optimization: ใช้โครงสร้างคำถาม-คำตอบชัดเจน ย่อหน้าแรกตอบคำถามหลักทันที\n" .
                   "- HTML ต้อง valid — ปิด tag ครบ, attributes ในเครื่องหมายคำพูดคู่";
    }
    try {
        $mainRaw = $aiCall($mainSys, "สร้าง content ครบทุกส่วนสำหรับ: $itemCtx");
    } catch (RuntimeException $e) {
        $msg = $e->getMessage();
        if (str_starts_with($msg, 'token_limit:')) jsonError("โมเดล {$modelName} ติด token limit — กรุณาเปลี่ยนโมเดลใน Admin > AI Settings", 500);
        jsonError('AI error (main) — กำลังใช้โมเดล: ' . $modelName . ' — ' . $msg . ' — เปลี่ยนโมเดลได้ที่ Admin > AI Settings', 500);
    }
    // Guard: ensure we have a non-empty string before any preg operations
    if (!is_string($mainRaw) || trim($mainRaw) === '') {
        jsonError('AI returned empty response — โมเดล: ' . $modelName . ' — try again or check API logs', 500);
    }

    // Attempt 1: decode as-is
    $mainData = json_decode($mainRaw, true);

    // Attempt 2: extract outermost {...} then decode
    if (!$mainData) {
        if (preg_match('/\{.*\}/s', $mainRaw, $mx)) $mainData = json_decode($mx[0], true);
    }

    // Attempt 3: repair common AI JSON issues then decode
    if (!$mainData) {
        $repaired = (string)$mainRaw;
        // Strip markdown fences that may remain
        $cleaned1 = preg_replace('/^```(?:json)?\s*/m', '', $repaired);
        if ($cleaned1 !== null) $repaired = $cleaned1;
        $cleaned2 = preg_replace('/\s*```\s*$/m', '', $repaired);
        if ($cleaned2 !== null) $repaired = $cleaned2;
        // Remove non-Thai/non-ASCII characters that break JSON (CJK, Arabic, Hebrew, etc.)
        $cleaned3 = preg_replace('/[^\x09\x0A\x0D\x20-\x7E\x{00A0}\x{2013}\x{2014}\x{2018}-\x{201F}\x{2026}\x{0E00}-\x{0E7F}]/u', '', $repaired);
        if ($cleaned3 !== null) $repaired = $cleaned3;
        // Replace unescaped literal control chars inside JSON strings with escaped versions
        // (actual newlines / tabs inside string values)
        $cleaned4 = preg_replace_callback(
            '/"(?:[^"\\\\]|\\\\.)*"/s',
            fn($m) => str_replace(["\n", "\r", "\t"], ['\n', '\r', '\t'], $m[0]),
            $repaired
        );
        if ($cleaned4 !== null) $repaired = $cleaned4;
        if (preg_match('/\{.*\}/s', $repaired, $mx)) $mainData = json_decode($mx[0], true);
        if (!$mainData) $mainData = json_decode($repaired, true);
    }

    // Safety filter / refusal detection
    $safetyPatterns = ['/user safety/i', '/content policy/i', '/safety policy/i', '/cannot fulfill/i',
        '/unable to generate/i', '/cannot generate/i', '/cannot comply/i', '/i cannot/i',
        '/violates/i', '/against.*policy/i', '/inappropriate/i', '/harmful/i'];
    foreach ($safetyPatterns as $pat) {
        if (preg_match($pat, $mainRaw)) {
            error_log('[brand-content] Safety filter triggered | model=' . $modelName . ' | response=' . substr($mainRaw, 0, 300));
            jsonError('AI ปฏิเสธคำขอนี้ — โมเดล ' . $modelName . ' ตอบกลับว่า: ' . substr($mainRaw, 0, 200) . ' — ลองเปลี่ยนโมเดลใน Admin > AI Settings หรือใช้คำค้นหาที่เป็นกลางขึ้น', 500);
        }
    }

    if (!$mainData) {
        $jsonErr = json_last_error_msg();
        $preview = substr($mainRaw, 0, 300);
        error_log('[brand-content] JSON decode failed | model=' . $modelName . ' | json_err=' . $jsonErr . ' | raw=' . $preview);
        jsonError('AI ไม่สามารถสร้าง content ได้ โมเดล: ' . $modelName . ' (' . $jsonErr . ') — Raw: ' . $preview, 500);
    }
    $mainData = $sanitizeArr($mainData);

    $artTitle   = $mainData['title']   ?? $item['topic'];
    $artExcerpt = $mainData['excerpt'] ?? '';

    // โ”€โ”€ Step 2: Build HTML article โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
    // Use AI-generated full_html if available (semantic HTML), otherwise build from facebook script
    $aiHtml = $mainData['full_html'] ?? '';
    if (!empty(trim(strip_tags($aiHtml)))) {
        // AI provided proper semantic HTML — sanitize and wrap
        $fullHtml = '<article class="prose prose-sm max-w-none">' .
                    '<h1>' . htmlspecialchars($artTitle) . '</h1>';
        if ($artExcerpt) {
            $fullHtml .= '<p class="lead text-muted-foreground italic">' . htmlspecialchars($artExcerpt) . '</p>';
        }
        $fullHtml .= $aiHtml . '</article>';
    } else {
        // Fallback: build from facebook script
        $fbScript = $mainData['scripts']['facebook'] ?? '';
        $fullHtml = '<article class="prose prose-sm max-w-none">' .
                    '<h1>' . htmlspecialchars($artTitle) . '</h1>';
        if ($artExcerpt) $fullHtml .= '<p class="lead text-muted-foreground italic">' . htmlspecialchars($artExcerpt) . '</p>';
        foreach (explode("\n\n", $fbScript) as $para) {
            $para = trim($para);
            if ($para !== '') $fullHtml .= '<p>' . nl2br(htmlspecialchars($para)) . '</p>';
        }
        $fullHtml .= '</article>';
    }

    // Build structured data JSON
    $structuredData = null;
    $sd = $mainData['structured_data'] ?? null;
    if ($sd && is_array($sd)) {
        // Merge Article schema + FAQ schema if both present
        $faq = $mainData['structured_data_faq'] ?? null;
        if ($faq && is_array($faq) && !empty($faq['mainEntity'])) {
            $structuredData = json_encode([$sd, $faq], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        } else {
            $structuredData = json_encode($sd, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        }
    }

    $art = [
        'title'           => $artTitle,
        'excerpt'         => $artExcerpt,
        'html'            => $fullHtml,
        'headlines'       => $mainData['headlines'] ?? [],
        'scripts'         => $mainData['scripts'] ?? [],
        'script_sections' => $mainData['script_sections'] ?? [],
        'visuals'         => $mainData['visuals'] ?? [],
        'hashtags'        => $mainData['hashtags'] ?? [],
        // SEO/AEO fields
        'seo_title'        => $mainData['seo_title'] ?? $artTitle,
        'slug'             => $mainData['slug'] ?? '',
        'meta_description' => $mainData['meta_description'] ?? $artExcerpt,
        // meta_keywords ต้องมาจาก Research เท่านั้น; รอบนี้ยังไม่มี research_job จึงปล่อยว่าง
        'meta_keywords'    => '',
        'structured_data'  => $structuredData,
        'og_image'         => $mainData['og_image'] ?? '',
    ];

    // Determine content type from the content item, independent of publish platform.
    $ciType = $isVideo ? 'video' : 'article';

    // Update content_items with article content + SEO columns
    $newCaption = $mainData['caption'] ?? null;
    if ($newCaption !== null) {
        $db->prepare("UPDATE content_items SET article_content=?, title=?, type=?, caption=?, seo_title=?, slug=?, meta_description=?, meta_keywords=?, structured_data=?, og_image=?, updated_at=NOW() WHERE id=? AND tenant_id=?")
           ->execute([json_encode($art), $artTitle, $ciType, $newCaption, $art['seo_title'], $art['slug'], $art['meta_description'], $art['meta_keywords'], $structuredData, $art['og_image'], $itemId, $tenantId]);
    } else {
        $db->prepare("UPDATE content_items SET article_content=?, title=?, type=?, seo_title=?, slug=?, meta_description=?, meta_keywords=?, structured_data=?, og_image=?, updated_at=NOW() WHERE id=? AND tenant_id=?")
           ->execute([json_encode($art), $artTitle, $ciType, $art['seo_title'], $art['slug'], $art['meta_description'], $art['meta_keywords'], $structuredData, $art['og_image'], $itemId, $tenantId]);
    }

    // Also update content_plan_items for backward compat
    $db->prepare("UPDATE content_plan_items SET article_content=? WHERE id=(SELECT plan_item_id FROM content_items WHERE id=?)")->execute([json_encode($art), $itemId]);

    jsonResponse(['article' => $art]);
    } catch (Throwable $e) {
        restore_error_handler();
        error_log('[brand-content generate-article] ' . get_class($e) . ': ' . $e->getMessage() . ' in ' . basename($e->getFile()) . ':' . $e->getLine());
        jsonError('generate-article error [' . get_class($e) . ']: ' . $e->getMessage() . ' in ' . basename($e->getFile()) . ':' . $e->getLine(), 500);
    }
    restore_error_handler();
}
if ($action === 'publish') {
    if ($method !== 'POST') jsonError('Method not allowed', 405);
    $body       = getRequestBody();
    $scheduleId = $body['schedule_id'] ?? '';
    $itemId     = $body['item_id']     ?? '';
    $channelId  = $body['channel_id']  ?? '';
    if (!$itemId || !$channelId) jsonError('item_id and channel_id required', 400);

    // Load item
    $item = $db->prepare("SELECT * FROM content_items WHERE id=? AND tenant_id=?");
    $item->execute([$itemId, $tenantId]);
    $item = $item->fetch();
    if (!$item) jsonError('Item not found', 404);

    // เกต SEO — บล็อกก่อน dispatch ถ้าเปิดเกตและมีกฎ fail/คะแนนต่ำ (ข้อความไทย)
    $gate = seo_gate_check($db, $tenantId, $item);
    if ($gate['blocked']) {
        jsonError('เผยแพร่ไม่ได้ — ไม่ผ่านเกณฑ์ SEO' . "\n" . $gate['reason'], 422);
    }

    // Load channel
    $ch = $db->prepare("SELECT * FROM publish_channels WHERE id=? AND tenant_id=?");
    $ch->execute([$channelId, $tenantId]);
    $channel = $ch->fetch();
    if (!$channel) jsonError('Channel not found', 404);

    // Decrypt credentials
    $creds = [];
    if (!empty($channel['credentials_encrypted'])) {
        $plain = decryptValue($channel['credentials_encrypted']);
        if ($plain) $creds = json_decode($plain, true) ?: [];
    }

    $platform = $channel['platform'];
    $artData  = !empty($item['article_content']) ? json_decode($item['article_content'], true) : null;
    $title    = $artData['title']   ?? $item['topic'];
    $content  = $artData['html']    ?? $item['caption'];
    $excerpt  = $artData['excerpt'] ?? '';
    $imageUrl = $item['generated_image_url'] ?? '';
    $publishCaption = $item['caption'] ?? '';
    $publishScripts = is_array($artData['scripts'] ?? null) ? $artData['scripts'] : [];
    if (in_array($platform, ['facebook', 'instagram', 'tiktok', 'lineoa', 'linkedin', 'twitter'], true)
        && !empty($publishScripts[$platform])) {
        $publishCaption = trim((string)$publishScripts[$platform]);
    }
    $result   = [];

    if ($platform === 'wordpress') {
        $wpUrl  = rtrim($channel['endpoint_url'] ?: '', '/');
        $wpUser = $creds['username'] ?? '';
        $wpPass = $creds['app_password'] ?? '';
        if (!$wpUrl || !$wpUser || !$wpPass) jsonError('WordPress credentials incomplete', 400);
        $postBody = ['title' => $title, 'content' => $content, 'excerpt' => $excerpt, 'status' => 'publish'];
        if ($imageUrl) $postBody['featured_media_url'] = $imageUrl;
        $curl = curl_init("$wpUrl/wp-json/wp/v2/posts");
        curl_setopt_array($curl, [
            CURLOPT_RETURNTRANSFER => true, CURLOPT_POST => true,
            CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'Authorization: Basic '.base64_encode("$wpUser:$wpPass")],
            CURLOPT_POSTFIELDS => json_encode($postBody), CURLOPT_TIMEOUT => 30,
        ]);
        $res    = curl_exec($curl); curl_close($curl);
        $result = json_decode($res, true) ?: ['raw' => $res];
        $ok     = !empty($result['id']);

    } elseif ($platform === 'facebook') {
        $pageId = $creds['page_id'] ?? '';
        $token  = $creds['access_token'] ?? '';
        if (!$pageId || !$token) jsonError('Facebook credentials incomplete', 400);
        $msg    = $title."\n\n".$publishCaption;
        $params = ['message' => $msg, 'access_token' => $token];
        if ($imageUrl) { $params['link'] = $imageUrl; }
        $curl   = curl_init("https://graph.facebook.com/v19.0/$pageId/feed");
        curl_setopt_array($curl, [
            CURLOPT_RETURNTRANSFER => true, CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => http_build_query($params), CURLOPT_TIMEOUT => 30,
        ]);
        $res    = curl_exec($curl); curl_close($curl);
        $result = json_decode($res, true) ?: ['raw' => $res];
        $ok     = !empty($result['id']);

    } elseif ($platform === 'lineoa') {
        $token = $creds['channel_access_token'] ?? '';
        if (!$token) jsonError('Line OA access token missing', 400);
        $msg  = $title."\n\n".$publishCaption;
        $body2 = ['messages' => [['type' => 'text', 'text' => substr($msg, 0, 5000)]]];
        $curl = curl_init('https://api.line.me/v2/bot/message/broadcast');
        curl_setopt_array($curl, [
            CURLOPT_RETURNTRANSFER => true, CURLOPT_POST => true,
            CURLOPT_HTTPHEADER => ['Content-Type: application/json', "Authorization: Bearer $token"],
            CURLOPT_POSTFIELDS => json_encode($body2), CURLOPT_TIMEOUT => 30,
        ]);
        $res    = curl_exec($curl); curl_close($curl);
        $result = json_decode($res, true) ?: ['raw' => $res];
        $ok     = isset($result['sentMessages']) || (empty($result['message']) && $res !== false);

    } elseif ($platform === 'wix') {
        $apiKey = $creds['api_key'] ?? '';
        $siteId = $creds['site_id'] ?? '';
        if (!$apiKey || !$siteId) jsonError('Wix credentials incomplete', 400);
        $postBody = ['post' => ['title' => $title, 'richContent' => ['nodes' => [['type' => 'PARAGRAPH', 'nodes' => [['type' => 'TEXT', 'textData' => ['text' => strip_tags($content)]]]]]]]];
        $curl = curl_init("https://www.wixapis.com/blog/v3/posts");
        curl_setopt_array($curl, [
            CURLOPT_RETURNTRANSFER => true, CURLOPT_POST => true,
            CURLOPT_HTTPHEADER => ['Content-Type: application/json', "Authorization: $apiKey", "wix-site-id: $siteId"],
            CURLOPT_POSTFIELDS => json_encode($postBody), CURLOPT_TIMEOUT => 30,
        ]);
        $res    = curl_exec($curl); curl_close($curl);
        $result = json_decode($res, true) ?: ['raw' => $res];
        $ok     = !empty($result['post']['id']);

    } elseif ($platform === 'custom') {
        $url     = $channel['endpoint_url'] ?? '';
        if (!$url) jsonError('Custom endpoint_url missing', 400);
        $headers = ['Content-Type: application/json'];
        foreach (($creds['headers'] ?? []) as $k => $v) { $headers[] = "$k: $v"; }
        $postBody = ['title' => $title, 'content' => $content, 'excerpt' => $excerpt, 'image_url' => $imageUrl, 'platform_hint' => 'custom'];
        $curl = curl_init($url);
        curl_setopt_array($curl, [
            CURLOPT_RETURNTRANSFER => true, CURLOPT_POST => true,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_POSTFIELDS => json_encode($postBody), CURLOPT_TIMEOUT => 30,
        ]);
        $res    = curl_exec($curl); curl_close($curl);
        $result = json_decode($res, true) ?: ['raw' => $res];
        $ok     = true; // custom: assume ok if no curl error

    } elseif ($platform === 'lotusdomino') {
        $url = $channel['endpoint_url'] ?? '';
        if (!$url) jsonError('Lotus Domino endpoint_url missing', 400);
        // Parse article JSON for SEO/AEO fields
        $slug           = $artData['slug']             ?? $item['slug']             ?? '';
        $seoTitle       = $artData['seo_title']        ?? $item['seo_title']        ?? $title;
        $metaDesc       = $artData['meta_description'] ?? $item['meta_description'] ?? $excerpt;
        $keywords       = $artData['meta_keywords']    ?? $item['meta_keywords']    ?? '';
        $tags           = is_array($artData['hashtags'] ?? null)
                            ? implode(',', array_map(fn($t) => ltrim($t,'#'), $artData['hashtags']))
                            : $keywords;
        // Date: เวลาที่ตั้งไว้มาก่อนเสมอ ถ้าไม่มีจึงใช้นาฬิกาฐานข้อมูล (dbNow ใน config.php)
        // ไม่ใช้ date() เพราะค่านี้กลายเป็นวันที่บทความบนเว็บไซต์ลูกค้าและเรียกคืนไม่ได้
        $publishDate    = !empty($item['scheduled_date']) ? $item['scheduled_date'] : dbNow($db);
        $postBody = [[
            'Date'            => $publishDate,
            'Title'           => $title,
            'Body'            => $content,
            'Excerpt'         => $excerpt,
            'Slug'            => $slug,
            'SEOTitle'        => $seoTitle,
            'MetaDescription' => $metaDesc,
            'Tags'            => $tags,
            'AttachPhoto'     => $imageUrl,
        ]];
        $curl = curl_init($url);
        curl_setopt_array($curl, [
            CURLOPT_RETURNTRANSFER => true, CURLOPT_POST => true,
            CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
            CURLOPT_POSTFIELDS => json_encode($postBody), CURLOPT_TIMEOUT => 30,
            CURLOPT_SSL_VERIFYPEER => false,
        ]);
        $res    = curl_exec($curl); curl_close($curl);
        $result = json_decode($res, true) ?: ['raw' => substr($res, 0, 500)];
        $ok     = true; // Domino agent: assume ok if no curl error

    } elseif ($platform === 'linkedin') {
        $token     = $creds['access_token'] ?? '';
        $authorUrn = $creds['author_urn'] ?? '';
        if (!$token || !$authorUrn) jsonError('LinkedIn credentials incomplete (access_token + author_urn required)', 400);
        $postBody = [
            'author' => $authorUrn,
            'lifecycleState' => 'PUBLISHED',
            'specificContent' => [
                'com.linkedin.ugc.ShareContent' => [
                    'shareCommentary' => ['text' => $title . "\n\n" . $publishCaption],
                    'shareMediaCategory' => 'NONE',
                ],
            ],
            'visibility' => ['com.linkedin.ugc.MemberNetworkVisibility' => 'PUBLIC'],
        ];
        $curl = curl_init('https://api.linkedin.com/v2/ugcPosts');
        curl_setopt_array($curl, [
            CURLOPT_RETURNTRANSFER => true, CURLOPT_POST => true,
            CURLOPT_HTTPHEADER => ['Content-Type: application/json', "Authorization: Bearer $token", 'X-Restli-Protocol-Version: 2.0.0'],
            CURLOPT_POSTFIELDS => json_encode($postBody), CURLOPT_SSL_VERIFYPEER => defined('AI_SSL_VERIFY') ? AI_SSL_VERIFY : true, CURLOPT_TIMEOUT => 30,
        ]);
        $res    = curl_exec($curl); $info = curl_getinfo($curl); curl_close($curl);
        $result = json_decode($res, true) ?: ['raw' => substr($res, 0, 500)];
        $ok     = ($info['http_code'] >= 200 && $info['http_code'] < 300);

    } elseif ($platform === 'instagram' || $platform === 'tiktok' || $platform === 'twitter') {
        // Webhook-based: POST payload to endpoint_url (user sets up n8n / Zapier / Make webhook)
        $url = $channel['endpoint_url'] ?? '';
        if (!$url) jsonError(ucfirst($platform) . ' channel requires an Endpoint/Webhook URL', 400);
        $headers = ['Content-Type: application/json'];
        foreach (($creds['headers'] ?? []) as $k => $v) { $headers[] = "$k: $v"; }
        $postBody = [
            'platform'  => $platform,
            'title'     => $title,
            'caption'   => $publishCaption,
            'content'   => $content,
            'image_url' => $imageUrl,
        ];
        $curl = curl_init($url);
        curl_setopt_array($curl, [
            CURLOPT_RETURNTRANSFER => true, CURLOPT_POST => true,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_POSTFIELDS => json_encode($postBody), CURLOPT_SSL_VERIFYPEER => defined('AI_SSL_VERIFY') ? AI_SSL_VERIFY : true, CURLOPT_TIMEOUT => 30,
        ]);
        $res    = curl_exec($curl); curl_close($curl);
        $result = json_decode($res, true) ?: ['raw' => substr($res, 0, 500)];
        $ok     = true; // assume ok โ€” webhook handles actual posting

    } else {
        jsonError('Unknown platform: ' . $platform, 400);
    }

    // สกัด post id / url จากผล inline curl แต่ละ platform (best-effort — platform ที่ response ไม่มี id คืน null)
    $postId       = null;
    $publishedUrl = null;
    if ($platform === 'wordpress') {
        $postId       = !empty($result['id'])   ? (string) $result['id']   : null;
        $publishedUrl = !empty($result['link']) ? (string) $result['link'] : null;
    } elseif ($platform === 'facebook') {
        $postId = !empty($result['id']) ? (string) $result['id'] : null;
    } elseif ($platform === 'wix') {
        $postId = !empty($result['post']['id']) ? (string) $result['post']['id'] : null;
    }

    // Record in content_schedules for history tracking
    if ($scheduleId) {
        $st = isset($ok) && $ok ? 'sent' : 'failed';
        $db->prepare("UPDATE content_schedules SET status=?, publish_result=?, platform_post_id=?, published_url=?, updated_at=NOW() WHERE id=?")->execute([$st, json_encode($result), $postId, $publishedUrl, $scheduleId]);
    } else {
        // Immediate publish without a schedule โ€” insert a history record
        $newId = generateUUID();
        $st    = isset($ok) && $ok ? 'sent' : 'failed';
        $db->prepare("INSERT INTO content_schedules (id,plan_item_id,channel_id,scheduled_at,status,publish_result,platform_post_id,published_url,created_by) VALUES (?,?,?,NOW(),?,?,?,?,?)")
           ->execute([$newId, $itemId, $channelId, $st, json_encode($result), $postId, $publishedUrl, $userId]);
    }

    // Sync linked content_item status to 'published' on success
    // แก้บั๊กคีย์: ใช้ WHERE id=? (คีย์เดียวกับที่โหลด $itemId มา) แทน plan_item_id ที่อาจไม่ตรง/เป็น NULL
    // platform: เขียนตาม channel ที่โพสต์จริง — analytics-recalculate group by คอลัมน์นี้
    if (isset($ok) && $ok) {
        $db->prepare("UPDATE content_items SET status='published', published_at=NOW(), published_url=?, external_post_id=?, updated_at=NOW() WHERE id=? AND tenant_id=?")
           ->execute([$publishedUrl, $postId, $itemId, $tenantId]);
    }

    jsonResponse(['ok' => isset($ok) ? $ok : true, 'result' => $result]);
}

// โ”€โ”€โ”€ ALL-SCHEDULES (overview across all plans for tenant) โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
if ($action === 'all-schedules') {
    if ($method !== 'GET') jsonError('Method not allowed', 405);
    $stmt = $db->prepare("
        SELECT cs.id, cs.scheduled_at, cs.status, cs.created_at,
               pc.name   AS channel_name,
               pc.platform,
               cpi.topic, cpi.day_label, cpi.platform AS item_platform,
               cp.title  AS plan_title,
               cp.week_start
        FROM content_schedules cs
        JOIN publish_channels pc  ON pc.id  = cs.channel_id
        JOIN content_plan_items cpi ON cpi.id = cs.plan_item_id
        JOIN content_plans cp    ON cp.id   = cpi.plan_id
        WHERE cp.tenant_id = ?

        UNION ALL

        SELECT pq.id, pq.scheduled_at, pq.status, pq.created_at,
               pc.name   AS channel_name,
               pc.platform,
               ci.title  AS topic,
               NULL      AS day_label,
               ci.platform AS item_platform,
               NULL      AS plan_title,
               NULL      AS week_start
        FROM content_publish_queue pq
        JOIN publish_channels pc ON pc.id = pq.channel_id
        JOIN content_items ci ON ci.id = pq.content_id
        WHERE pq.tenant_id = ?

        ORDER BY scheduled_at ASC
    ");
    $stmt->execute([$tenantId, $tenantId]);
    jsonResponse($stmt->fetchAll());
}

// โ”€โ”€โ”€ CRON-PUBLISH (process due pending schedules) โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
if ($action === 'cron-publish') {
    if ($method !== 'POST') jsonError('Method not allowed', 405);

    // Find all pending schedules due now
    $stmt = $db->prepare("
        SELECT cs.*, pc.platform, pc.endpoint_url, pc.credentials_encrypted,
               cpi.topic, cpi.caption, cpi.generated_image_url, cpi.article_content
        FROM content_schedules cs
        JOIN publish_channels pc    ON pc.id  = cs.channel_id
        JOIN content_plan_items cpi ON cpi.id = cs.plan_item_id
        JOIN content_plans cp       ON cp.id  = cpi.plan_id
        WHERE cp.tenant_id = ?
          AND cs.status    = 'pending'
          AND cs.scheduled_at <= NOW()
        LIMIT 20
    ");
    $stmt->execute([$tenantId]);
    $due = $stmt->fetchAll();

    $processed = [];
    foreach ($due as $sc) {
        // Mark as publishing to prevent duplicate runs
        $db->prepare("UPDATE content_schedules SET status='publishing' WHERE id=? AND status='pending'")
           ->execute([$sc['id']]);

        $creds = [];
        if (!empty($sc['credentials_encrypted'])) {
            $plain = decryptValue($sc['credentials_encrypted']);
            if ($plain) $creds = json_decode($plain, true) ?: [];
        }

        $artData = !empty($sc['article_content']) ? json_decode($sc['article_content'], true) : null;
        $title   = $artData['title']   ?? $sc['topic'];
        $content = $artData['html']    ?? $sc['caption'];
        $excerpt = $artData['excerpt'] ?? '';
        $imgUrl  = $sc['generated_image_url'] ?? '';

        // เกต SEO — โหลด content_items (canonical SEO) ผ่าน plan_item_id; fallback จาก article_content JSON
        $gStmt = $db->prepare("SELECT * FROM content_items WHERE plan_item_id=? AND tenant_id=? LIMIT 1");
        $gStmt->execute([$sc['plan_item_id'], $tenantId]);
        $gateItem = $gStmt->fetch(PDO::FETCH_ASSOC);
        if (!$gateItem) {
            $gateItem = [
                'seo_title'        => $artData['seo_title']        ?? '',
                'slug'             => $artData['slug']             ?? '',
                'meta_description' => $artData['meta_description'] ?? '',
                'meta_keywords'    => $artData['meta_keywords']    ?? '',
                'structured_data'  => $artData['structured_data']  ?? '',
                'og_image'         => $imgUrl,
                'article_content'  => $sc['article_content'],
                'title'            => $title,
            ];
        }
        $gate = seo_gate_check($db, $tenantId, $gateItem);
        if ($gate['blocked']) {
            // ไม่ dispatch — ตั้ง schedule เป็น failed พร้อมเหตุผล (ไม่ silent)
            $db->prepare("UPDATE content_schedules SET status='failed', publish_result=?, updated_at=NOW() WHERE id=?")
               ->execute([json_encode(['seo_gate_blocked' => true, 'reason' => $gate['reason']], JSON_UNESCAPED_UNICODE), $sc['id']]);
            $processed[] = ['id' => $sc['id'], 'status' => 'failed', 'topic' => $sc['topic'], 'reason' => 'SEO gate: ' . $gate['reason']];
            continue;
        }

        $ok     = false;
        $result = [];


        try {
            if ($sc['platform'] === 'wordpress') {
                $wpUrl  = rtrim($sc['endpoint_url'] ?? '', '/');
                $wpUser = $creds['username'] ?? '';
                $wpPass = $creds['app_password'] ?? '';
                $ch = curl_init("$wpUrl/wp-json/wp/v2/posts");
                curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_POST => true, CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'Authorization: Basic '.base64_encode("$wpUser:$wpPass")], CURLOPT_POSTFIELDS => json_encode(['title' => $title, 'content' => $content, 'excerpt' => $excerpt, 'status' => 'publish']), CURLOPT_TIMEOUT => 30]);
                $res    = curl_exec($ch); curl_close($ch);
                $result = json_decode($res, true) ?: ['raw' => substr($res, 0, 500)];
                $ok     = !empty($result['id']);

            } elseif ($sc['platform'] === 'facebook') {
                $pageId = $creds['page_id'] ?? '';
                $token  = $creds['access_token'] ?? '';
                $msg    = $title . "\n\n" . $sc['caption'];
                $params = ['message' => $msg, 'access_token' => $token];
                $ch     = curl_init("https://graph.facebook.com/v19.0/$pageId/feed");
                curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_POST => true, CURLOPT_POSTFIELDS => http_build_query($params), CURLOPT_TIMEOUT => 30]);
                $res    = curl_exec($ch); curl_close($ch);
                $result = json_decode($res, true) ?: ['raw' => substr($res, 0, 500)];
                $ok     = !empty($result['id']);

            } elseif ($sc['platform'] === 'lineoa') {
                $token  = $creds['channel_access_token'] ?? '';
                $msg    = $title . "\n\n" . substr($sc['caption'], 0, 4900);
                $ch     = curl_init('https://api.line.me/v2/bot/message/broadcast');
                curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_POST => true, CURLOPT_HTTPHEADER => ['Content-Type: application/json', "Authorization: Bearer $token"], CURLOPT_POSTFIELDS => json_encode(['messages' => [['type' => 'text', 'text' => $msg]]]), CURLOPT_TIMEOUT => 30]);
                $res    = curl_exec($ch); curl_close($ch);
                $result = json_decode($res, true) ?: ['raw' => substr($res, 0, 500)];
                $ok     = empty($result['message']);

            } elseif ($sc['platform'] === 'wix') {
                $apiKey = $creds['api_key'] ?? '';
                $siteId = $creds['site_id'] ?? '';
                $ch     = curl_init('https://www.wixapis.com/blog/v3/posts');
                curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_POST => true, CURLOPT_HTTPHEADER => ['Content-Type: application/json', "Authorization: $apiKey", "wix-site-id: $siteId"], CURLOPT_POSTFIELDS => json_encode(['post' => ['title' => $title, 'richContent' => ['nodes' => [['type' => 'PARAGRAPH', 'nodes' => [['type' => 'TEXT', 'textData' => ['text' => strip_tags($content)]]]]]]]]), CURLOPT_TIMEOUT => 30]);
                $res    = curl_exec($ch); curl_close($ch);
                $result = json_decode($res, true) ?: ['raw' => substr($res, 0, 500)];
                $ok     = !empty($result['post']['id']);

            } elseif ($sc['platform'] === 'custom') {
                $url     = $sc['endpoint_url'] ?? '';
                $headers = ['Content-Type: application/json'];
                foreach (($creds['headers'] ?? []) as $k => $v) { $headers[] = "$k: $v"; }
                $ch = curl_init($url);
                curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_POST => true, CURLOPT_HTTPHEADER => $headers, CURLOPT_POSTFIELDS => json_encode(['title' => $title, 'content' => $content, 'excerpt' => $excerpt, 'image_url' => $imgUrl]), CURLOPT_TIMEOUT => 30]);
                $res    = curl_exec($ch); curl_close($ch);
                $result = json_decode($res, true) ?: ['raw' => substr($res, 0, 500)];
                $ok     = true;

            } elseif ($sc['platform'] === 'lotusdomino') {
                $url = $sc['endpoint_url'] ?? '';
                if ($url) {
                    $scSlug    = $artData['slug']             ?? $sc['slug']             ?? '';
                    $scSeoT    = $artData['seo_title']        ?? $sc['seo_title']        ?? $title;
                    $scMeta    = $artData['meta_description'] ?? $sc['meta_description'] ?? $excerpt;
                    $scKw      = $artData['meta_keywords']    ?? $sc['meta_keywords']    ?? '';
                    $scTags    = is_array($artData['hashtags'] ?? null)
                                   ? implode(',', array_map(fn($t) => ltrim($t,'#'), $artData['hashtags']))
                                   : $scKw;
                    // Date: เวลาที่ตั้งไว้มาก่อนเสมอ ถ้าไม่มีจึงใช้นาฬิกาฐานข้อมูล
                    // (เหตุผลเดียวกับจุดเผยแพร่เดี่ยวด้านบน — ค่านี้ออกไปอยู่บนเว็บลูกค้า)
                    $scDate    = !empty($sc['scheduled_at']) ? $sc['scheduled_at'] : dbNow($db);
                    $domBody   = [[
                        'Date'            => $scDate,
                        'Title'           => $title,
                        'Body'            => $content,
                        'Excerpt'         => $excerpt,
                        'Slug'            => $scSlug,
                        'SEOTitle'        => $scSeoT,
                        'MetaDescription' => $scMeta,
                        'Tags'            => $scTags,
                        'AttachPhoto'     => $imgUrl,
                    ]];
                    $ch = curl_init($url);
                    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_POST => true, CURLOPT_HTTPHEADER => ['Content-Type: application/json'], CURLOPT_POSTFIELDS => json_encode($domBody), CURLOPT_SSL_VERIFYPEER => false, CURLOPT_TIMEOUT => 30]);
                    $res    = curl_exec($ch); curl_close($ch);
                    $result = json_decode($res, true) ?: ['raw' => substr($res, 0, 500)];
                }
                $ok = true;

            } elseif ($sc['platform'] === 'linkedin') {
                $token     = $creds['access_token'] ?? '';
                $authorUrn = $creds['author_urn'] ?? '';
                $postBody  = ['author' => $authorUrn, 'lifecycleState' => 'PUBLISHED', 'specificContent' => ['com.linkedin.ugc.ShareContent' => ['shareCommentary' => ['text' => $title . "\n\n" . $sc['caption']], 'shareMediaCategory' => 'NONE']], 'visibility' => ['com.linkedin.ugc.MemberNetworkVisibility' => 'PUBLIC']];
                $ch = curl_init('https://api.linkedin.com/v2/ugcPosts');
                curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_POST => true, CURLOPT_HTTPHEADER => ['Content-Type: application/json', "Authorization: Bearer $token", 'X-Restli-Protocol-Version: 2.0.0'], CURLOPT_POSTFIELDS => json_encode($postBody), CURLOPT_SSL_VERIFYPEER => defined('AI_SSL_VERIFY') ? AI_SSL_VERIFY : true, CURLOPT_TIMEOUT => 30]);
                $res    = curl_exec($ch); $info = curl_getinfo($ch); curl_close($ch);
                $result = json_decode($res, true) ?: ['raw' => substr($res, 0, 500)];
                $ok     = ($info['http_code'] >= 200 && $info['http_code'] < 300);

            } elseif ($sc['platform'] === 'instagram' || $sc['platform'] === 'tiktok' || $sc['platform'] === 'twitter') {
                $url     = $sc['endpoint_url'] ?? '';
                $headers = ['Content-Type: application/json'];
                foreach (($creds['headers'] ?? []) as $k => $v) { $headers[] = "$k: $v"; }
                $ch = curl_init($url);
                curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_POST => true, CURLOPT_HTTPHEADER => $headers, CURLOPT_POSTFIELDS => json_encode(['platform' => $sc['platform'], 'title' => $title, 'caption' => $sc['caption'], 'content' => $content, 'image_url' => $imgUrl]), CURLOPT_SSL_VERIFYPEER => defined('AI_SSL_VERIFY') ? AI_SSL_VERIFY : true, CURLOPT_TIMEOUT => 30]);
                $res    = curl_exec($ch); curl_close($ch);
                $result = json_decode($res, true) ?: ['raw' => substr($res, 0, 500)];
                $ok     = true;
            }
        } catch (Exception $e) {
            $result = ['error' => $e->getMessage()];
        }

        // สกัด post id / url จากผล inline curl แต่ละ platform (best-effort — platform ที่ response ไม่มี id คืน null)
        $postId       = null;
        $publishedUrl = null;
        if ($sc['platform'] === 'wordpress') {
            $postId       = !empty($result['id'])   ? (string) $result['id']   : null;
            $publishedUrl = !empty($result['link']) ? (string) $result['link'] : null;
        } elseif ($sc['platform'] === 'facebook') {
            $postId = !empty($result['id']) ? (string) $result['id'] : null;
        } elseif ($sc['platform'] === 'wix') {
            $postId = !empty($result['post']['id']) ? (string) $result['post']['id'] : null;
        }

        $status = $ok ? 'sent' : 'failed';
        $db->prepare("UPDATE content_schedules SET status=?, publish_result=?, platform_post_id=?, published_url=?, updated_at=NOW() WHERE id=?")
           ->execute([$status, json_encode($result), $postId, $publishedUrl, $sc['id']]);

        // บันทึกผลเผยแพร่กลับ content_items เมื่อสำเร็จ — resolve id จาก plan_item_id
        // (derived table ครอบ subquery เพื่อเลี่ยง MariaDB error 1093 จากการอ้าง target table ใน subquery)
        // platform: เขียนตาม channel ของ schedule ที่โพสต์จริง — analytics-recalculate group by คอลัมน์นี้
        if ($ok) {
            $db->prepare(
                "UPDATE content_items SET status='published', published_at=NOW(), updated_at=NOW()
                 WHERE id=(SELECT id FROM (SELECT id FROM content_items WHERE plan_item_id=? AND tenant_id=? LIMIT 1) AS ci_match)"
            )->execute([$sc['plan_item_id'], $tenantId]);
        }

        $processed[] = ['id' => $sc['id'], 'status' => $status, 'topic' => $sc['topic']];
    }

    jsonResponse(['processed' => count($processed), 'items' => $processed]);
}

// ─── PLANS POST (manual plan creation without AI) ─────────────────
if ($action === 'plans' && $method === 'POST') {
    $body = getRequestBody();
    $title     = $body['title'] ?? 'Untitled Plan';
    $planType  = $body['plan_type'] ?? 'monthly';
    $planStart = $body['plan_start'] ?? null;
    $planEnd   = $body['plan_end'] ?? null;
    $trigger   = $body['trigger_command'] ?? '';
    $id = generateUUID();
    $weekStart = $planStart ?? date('Y-m-d');
    $db->prepare('INSERT INTO content_plans (id, tenant_id, title, week_start, status, plan_type, plan_start, plan_end, trigger_command, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
       ->execute([$id, $tenantId, $title, $weekStart, 'draft', $planType, $planStart, $planEnd, $trigger, $userId]);
    jsonResponse(['id' => $id, 'created' => true], 201);
}

// ─── PLAN-ITEMS CRUD (manual card creation) ────────────────────────
if ($action === 'plan-items') {
    if ($method === 'POST') {
        $body = getRequestBody();
        $planId = $body['plan_id'] ?? '';
        $topic  = $body['topic'] ?? '';
        if (!$planId || !$topic) jsonError('plan_id and topic required', 400);

        $scheduledDate = $body['scheduled_date'] ?? date('Y-m-d');
        $ts = strtotime($scheduledDate);
        $dayLabels = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
        $dayOrders = [7, 1, 2, 3, 4, 5, 6];
        $id = generateUUID();
        $platform = isset($body['platform']) ? strtolower(trim($body['platform'])) : 'facebook';
        $db->prepare('INSERT INTO content_plan_items (id, plan_id, day_label, day_order, scheduled_date, platform, topic, caption) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
           ->execute([$id, $planId, $dayLabels[(int)date('w', $ts)], $dayOrders[(int)date('w', $ts)], $scheduledDate, $platform, $topic, $body['caption'] ?? '']);
        // Also create content_items row as primary store
        $ciId = generateUUID();
        $db->prepare('INSERT INTO content_items (id, tenant_id, title, type, status, created_by, plan_item_id, plan_id, platform, scheduled_date, caption) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
           ->execute([$ciId, $tenantId, $topic, 'article', 'draft', $userId, $id, $planId, $platform, $scheduledDate, $body['caption'] ?? '']);
        jsonResponse(['id' => $ciId, 'plan_item_id' => $id, 'created' => true], 201);
    }
    if ($method === 'DELETE') {
        $id = $_GET['id'] ?? '';
        if (!$id) jsonError('id required', 400);
        $db->prepare('DELETE FROM content_items WHERE id=? AND tenant_id=?')->execute([$id, $tenantId]);
        $db->prepare('DELETE FROM content_plan_items WHERE id=(SELECT plan_item_id FROM content_items WHERE id=?)')->execute([$id]);
        jsonResponse(['deleted' => true]);
    }
}

// ─── PLAN-ITEM-DATE (Drag & Drop) ──────────────────────────────────
if ($action === 'plan-item-date' && $method === 'PUT') {
    $body   = getRequestBody();
    $itemId = $body['item_id'] ?? '';
    $scheduledDate = $body['scheduled_date'] ?? '';
    if (!$itemId || !$scheduledDate) jsonError('item_id and scheduled_date required', 400);

    $ts = strtotime($scheduledDate);
    $dayOfWeek = (int)date('w', $ts);
    $dayLabels = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
    $dayOrders = [7, 1, 2, 3, 4, 5, 6];
    $dayLabel = $dayLabels[$dayOfWeek];
    $dayOrder = $dayOrders[$dayOfWeek];

    $db->prepare('UPDATE content_items SET scheduled_date=?, updated_at=NOW() WHERE id=? AND tenant_id=?')
       ->execute([$scheduledDate, $itemId, $tenantId]);
    // Also update content_plan_items if a linked row exists
    $db->prepare('UPDATE content_plan_items SET scheduled_date=?, day_label=?, day_order=?, updated_at=NOW() WHERE id=(SELECT plan_item_id FROM content_items WHERE id=?)')
       ->execute([$scheduledDate, $dayLabel, $dayOrder, $itemId]);

    jsonResponse(['updated' => true, 'scheduled_date' => $scheduledDate, 'day_label' => $dayLabel, 'day_order' => $dayOrder]);
}

// ─── ANALYTICS POSTING TIMES ───────────────────────────────────────
if ($action === 'analytics-posting-times') {
    $stmt = $db->prepare(
        'SELECT platform, day_of_week, hour_of_day, avg_engagement, total_posts, sample_size
         FROM content_posting_analytics
         WHERE tenant_id=? ORDER BY platform, day_of_week, hour_of_day'
    );
    $stmt->execute([$tenantId]);
    $rows = $stmt->fetchAll();

    $hasData = count($rows) > 0;

    $byDay  = [];
    $byHour = [];
    $recommendations = [];

    foreach ($rows as $r) {
        $p = $r['platform'];
        if (!isset($byDay[$p])) $byDay[$p] = [];
        if (!isset($byHour[$p])) $byHour[$p] = [];
        $byDay[$p][(int)$r['day_of_week']] = (float)$r['avg_engagement'];
        $byHour[$p][(int)$r['hour_of_day']] = (float)$r['avg_engagement'];
    }

    usort($rows, fn($a, $b) => (float)$b['avg_engagement'] <=> (float)$a['avg_engagement']);
    foreach (array_slice($rows, 0, 5) as $r) {
        $recommendations[] = [
            'platform'       => $r['platform'],
            'day_of_week'    => (int)$r['day_of_week'],
            'hour_of_day'    => (int)$r['hour_of_day'],
            'avg_engagement' => (float)$r['avg_engagement'],
        ];
    }

    jsonResponse([
        'has_data'       => $hasData,
        'by_day'         => $byDay,
        'by_hour'        => $byHour,
        'recommendations' => $recommendations,
    ]);
}

// ─── RESULT METRICS (lead time + posting frequency vs target) ──────
if ($action === 'result-metrics') {
    if ($method !== 'GET') jsonError('Method not allowed', 405);

    // ช่วงวันที่ from/to (YYYY-MM-DD) — validate ก่อนใช้ และ bind เป็น parameter
    // เท่านั้น ค่าที่ผิดรูปแบบต้องตอบ 400 ไม่ใช่ 500
    $parseDate = static function (string $name): ?string {
        $raw = trim((string)($_GET[$name] ?? ''));
        if ($raw === '') return null;
        $d = DateTime::createFromFormat('Y-m-d', $raw);
        // createFromFormat ทดวันที่เกินจริงไปข้างหน้า (2026-02-31 → 2026-03-03)
        // จึงต้องเทียบ round-trip เพื่อปฏิเสธวันที่ที่ไม่มีอยู่จริง
        if ($d === false || $d->format('Y-m-d') !== $raw) {
            jsonError("พารามิเตอร์ $name ต้องเป็นวันที่รูปแบบ YYYY-MM-DD", 400);
        }
        return $raw;
    };
    // default = 12 เดือนย้อนหลัง ให้ตรงกับ content-analytics.php?action=analytics
    // เพื่อไม่ให้ตัวเลขบนหน้าจอเดียวกันอ้างช่วงเวลาต่างกัน
    $rmFrom = $parseDate('from') ?? date('Y-m-01', strtotime('-11 month'));
    $rmTo   = $parseDate('to')   ?? date('Y-m-d');
    if ($rmFrom > $rmTo) jsonError('ช่วงวันที่ไม่ถูกต้อง — from ต้องไม่เกิน to', 400);
    $rmFromDt = $rmFrom . ' 00:00:00';
    $rmToDt   = $rmTo   . ' 23:59:59'; // ครอบคลุมทั้งวันสุดท้าย (คอลัมน์เป็น DATETIME)

    // เวลาผลิตเฉลี่ย (lead time) — เฉพาะรายการที่อนุมัติแล้ว
    // ผูกช่วงวันที่ด้วย approved_at คือ "อนุมัติในช่วงนี้" ตามความหมายของเมตริก
    $leadStmt = $db->prepare(
        'SELECT AVG(TIMESTAMPDIFF(HOUR, created_at, approved_at)) AS avg_hours,
                COUNT(*) AS approved_count
         FROM content_items
         WHERE tenant_id=? AND approved_at IS NOT NULL
           AND approved_at BETWEEN ? AND ?'
    );
    $leadStmt->execute([$tenantId, $rmFromDt, $rmToDt]);
    $lead = $leadStmt->fetch(PDO::FETCH_ASSOC) ?: [];

    // ความถี่การเผยแพร่ — นับ 7 วันล่าสุด และยอดรวมที่เผยแพร่แล้ว
    // เป็น snapshot โดยเจตนา: ไม่ผูก from/to เพราะนิยามคือ "7 วันล่าสุด" เสมอ
    $pubStmt = $db->prepare(
        'SELECT SUM(published_at >= NOW() - INTERVAL 7 DAY) AS posts_last_7_days,
                COUNT(*) AS published_count
         FROM content_items
         WHERE tenant_id=? AND published_at IS NOT NULL'
    );
    $pubStmt->execute([$tenantId]);
    $pub = $pubStmt->fetch(PDO::FETCH_ASSOC) ?: [];

    // เป้าหมายความถี่รายสัปดาห์ (0 = ยังไม่ได้ตั้งเป้าหมาย) — snapshot เช่นกัน
    $tgtStmt = $db->prepare('SELECT weekly_posts_target FROM content_global_settings WHERE tenant_id=?');
    $tgtStmt->execute([$tenantId]);
    $target = (int)($tgtStmt->fetchColumn() ?: 0);

    $approvedCount  = (int)($lead['approved_count'] ?? 0);
    $publishedCount = (int)($pub['published_count'] ?? 0);
    $avgHours       = ($approvedCount > 0 && $lead['avg_hours'] !== null)
        ? round((float)$lead['avg_hours'], 1)
        : null;

    jsonResponse([
        // ช่วงที่ใช้จริง เพื่อให้ client แยกออกว่าเป็น default หรือค่าที่ส่งมา
        'range'                => ['from' => $rmFrom, 'to' => $rmTo],
        'avg_production_hours' => $avgHours,
        'approved_count'       => $approvedCount,
        'posts_last_7_days'    => (int)($pub['posts_last_7_days'] ?? 0),
        'published_count'      => $publishedCount,
        'weekly_posts_target'  => $target,
        'has_data'             => ($approvedCount > 0 || $publishedCount > 0),
    ]);
}

// ─── ANALYTICS RECALCULATE ────────────────────────────────────────
if ($action === 'analytics-recalculate' && $method === 'POST') {
    // นับ cohort เดียวกับที่ INSERT ด้านล่างใช้จริง — ถ้านับกว้างกว่านั้น เกตจะผ่าน
    // แต่ข้อมูลที่จัดกลุ่มได้จะน้อยกว่า 10 (published_at NULL หรือไม่ระบุ platform ถูกตัดออก)
    $cnt = $db->prepare(
        "SELECT COUNT(*) FROM content_items
         WHERE tenant_id=? AND status='published'
           AND published_at IS NOT NULL
           AND platform IS NOT NULL AND platform != ''"
    );
    $cnt->execute([$tenantId]);
    $eligible = (int)$cnt->fetchColumn();
    if ($eligible < 10) {
        $missing = 10 - $eligible;
        jsonError(
            "ต้องมีคอนเทนต์ที่เผยแพร่แล้ว (มีเวลาเผยแพร่และระบุแพลตฟอร์ม) อย่างน้อย 10 รายการ "
            . "จึงจะคำนวณเวลาโพสต์ที่ดีที่สุดได้ — ปัจจุบันมี {$eligible} รายการ ขาดอีก {$missing} รายการ",
            400
        );
    }

    $db->prepare('DELETE FROM content_posting_analytics WHERE tenant_id=?')->execute([$tenantId]);

    // จัดกลุ่มด้วย published_at (เวลาที่เผยแพร่จริง) ไม่ใช่ created_at (เวลาที่สร้างดราฟต์)
    // — คำถามของ widget คือ "ควรโพสต์เวลาไหน" ไม่ใช่ "ควรเขียนดราฟต์เวลาไหน"
    // published_at IS NOT NULL: กันแถวเก่าที่ status='published' แต่ไม่มีเวลาเผยแพร่
    // ทำให้ day_of_week/hour_of_day เป็น NULL
    //
    // น้ำหนัก likes × 2: ยกมาตามแผนเดิม docs/superpowers/plans/2026-05-10-content-calendar-planner.md:490
    // ซึ่งไม่ได้ระบุเหตุผลของตัวเลข 2 ไว้ และค่าเดียวกันถูกคัดลอกไปใช้ที่
    // src/components/content/AnalyticsContentTab.tsx:141 ("เนื้อหายอดนิยม") ด้วย
    // คงค่าเดิมไว้เพื่อไม่ให้อันดับเปลี่ยนไปจากที่ผู้ใช้เห็นอยู่ — ถ้าจะปรับต้องแก้ทั้งสองที่พร้อมกัน
    $sql = "
        INSERT INTO content_posting_analytics (id, tenant_id, platform, day_of_week, hour_of_day, avg_engagement, total_posts, sample_size)
        SELECT UUID(), ?, platform,
               (DAYOFWEEK(published_at) - 1) AS day_of_week,
               HOUR(published_at) AS hour_of_day,
               AVG(COALESCE(views, 0) + COALESCE(likes, 0) * 2) AS avg_engagement,
               COUNT(*) AS total_posts,
               COUNT(*) AS sample_size
        FROM content_items
        WHERE tenant_id=? AND status='published'
          AND published_at IS NOT NULL
          AND platform IS NOT NULL AND platform != ''
        GROUP BY platform, DAYOFWEEK(published_at), HOUR(published_at)
    ";
    $db->prepare($sql)->execute([$tenantId, $tenantId]);

    jsonResponse(['recalculated' => true]);
}

// ─── GENERATE-VIDEO ────────────────────────────────────────────────────────
if ($action === 'generate-video' && $method === 'POST') {
    $body   = getRequestBody();
    $itemId = $body['item_id'] ?? null;
    if (!$itemId) jsonError('Missing item_id');

    $itemStmt = $db->prepare('SELECT id, title, article_content FROM content_items WHERE id=? AND tenant_id=?');
    $itemStmt->execute([$itemId, $tenantId]);
    $item = $itemStmt->fetch();
    if (!$item) jsonError('��辺 content item', 404);

    $ac = json_decode($item['article_content'] ?? '{}', true);
    $scenes = $ac['scenes'] ?? [];

    // Fallback: convert visuals → scenes when no scenes array exists yet
    if (empty($scenes) && !empty($ac['visuals']) && is_array($ac['visuals'])) {
        $scenes = array_values(array_map(function($v) {
            $text = is_string($v) ? $v : ($v['visual_prompt'] ?? $v['content'] ?? '');
            $shot = '';
            $prompt = $text;
            if (preg_match('/^(?:Scene|Shot)\s*\d*\s*[:：-]\s*(.+)/i', $text, $m)) {
                $shot = trim(substr($text, 0, strpos($text, $m[1]) - 1));
                $prompt = trim($m[1]);
            }
            return ['visual_prompt' => $prompt, 'shot' => $shot];
        }, $ac['visuals']));
        $scenes = array_values(array_filter($scenes, fn($s) => !empty($s['visual_prompt'])));
    }

    if (empty($scenes)) jsonError('ไม่มี scenes หรือ visuals ใน article_content — กรุณาสร้างสคริปต์ก่อน');

    $scenesWithImages = array_values(array_filter($scenes, fn($s) => !empty($s['image_url'])));
    if (empty($scenesWithImages)) jsonError('ไม่มี scene ที่มี image_url — กรุณากด "สร้างภาพทุกฉาก" ก่อน');

    // Resolve video model from ai_content_video_model_id → ai_models → ai_providers
    $videoModelName = 'veo-3';
    $videoBaseUrl   = 'https://api.kilo.ai/api/gateway';
    $videoApiKey    = '';

    $vidModelStmt1 = $db->prepare("
        SELECT ap.api_base_url, ap.api_key_encrypted, am.model_id
        FROM company_settings cs
        JOIN ai_models am ON am.id = cs.ai_content_video_model_id
        JOIN ai_providers ap ON ap.id = am.provider_id
        WHERE cs.tenant_id = ? AND ap.api_key_encrypted IS NOT NULL AND ap.api_key_encrypted != ''
    ");
    $vidModelStmt1->execute([$tenantId]);
    $vidModelRow = $vidModelStmt1->fetch();

    if ($vidModelRow && !empty($vidModelRow['api_key_encrypted'])) {
        $videoModelName = $vidModelRow['model_id'] ?: 'veo-3';
        $videoBaseUrl   = rtrim($vidModelRow['api_base_url'] ?: 'https://api.kilo.ai/api/gateway', '/');
        $videoApiKey    = decryptValue($vidModelRow['api_key_encrypted']);
    } else {
        $creds = resolveAICreds($db, 'ai_content_video_model_id', $tenantId);
        $videoApiKey = $creds['api_key'] ?? '';
        $videoBaseUrl = rtrim($creds['base_url'] ?: 'https://api.kilo.ai/api/gateway', '/');
    }
    if (empty($videoApiKey)) jsonError('ยังไม่ได้ตั้งค่า AI Provider สำหรับ Video Generation');

    // Build scene list for video API
    $sceneList = [];
    foreach ($scenes as $idx => $scene) {
        $img = $scene['image_url'] ?? null;
        if ($img) {
            $sceneList[] = [
                'image_url'    => $img,
                'prompt'       => $scene['visual_prompt'] ?? '',
                'narration'    => $scene['narration'] ?? '',
                'shot'         => $scene['shot'] ?? '',
                'duration_sec' => $scene['duration_sec'] ?? 5,
            ];
        }
    }

    $payload = [
        'model'  => $videoModelName,
        'scenes' => $sceneList,
        'title'  => $item['title'] ?? '',
    ];

    $ch = curl_init($videoBaseUrl . '/video/generations');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => json_encode($payload),
        CURLOPT_HTTPHEADER     => ['Authorization: Bearer ' . $videoApiKey, 'Content-Type: application/json'],
        CURLOPT_SSL_VERIFYPEER => !empty(AI_SSL_VERIFY),
        CURLOPT_TIMEOUT        => 60,
    ]);
    $res = curl_exec($ch);
    curl_close($ch);

    if ($res === false) jsonError('���¡ Video API ��������', 500);

    $dec = json_decode($res, true);
    $jobId = $dec['job_id'] ?? $dec['id'] ?? null;

    // Handle synchronous response (direct URL returned)
    if (!$jobId) {
        $directUrl = $dec['video_url'] ?? $dec['url'] ?? $dec['output'] ?? null;
        if ($directUrl) {
            $db->prepare('UPDATE content_items SET video_gen_status=?, video_url=?, video_job_id=NULL, updated_at=NOW() WHERE id=? AND tenant_id=?')
               ->execute(['done', $directUrl, $itemId, $tenantId]);
            jsonResponse(['status' => 'done', 'video_url' => $directUrl]);
        }
        $err = $dec['error']['message'] ?? substr($res, 0, 300);
        jsonError('Video API ������� job_id ��Ѻ��: ' . $err, 500);
    }

    $db->prepare('UPDATE content_items SET video_gen_status=?, video_job_id=?, updated_at=NOW() WHERE id=? AND tenant_id=?')
       ->execute(['generating', $jobId, $itemId, $tenantId]);

    jsonResponse(['status' => 'generating', 'video_job_id' => $jobId]);
}

// ─── VIDEO-STATUS ──────────────────────────────────────────────────────────
if ($action === 'video-status' && $method === 'GET') {
    $itemId = $_GET['item_id'] ?? null;
    if (!$itemId) jsonError('Missing item_id');

    $itemStmt = $db->prepare('SELECT id, video_gen_status, video_job_id, video_url FROM content_items WHERE id=? AND tenant_id=?');
    $itemStmt->execute([$itemId, $tenantId]);
    $item = $itemStmt->fetch();
    if (!$item) jsonError('��辺 content item', 404);

    if (empty($item['video_job_id'])) {
        jsonResponse(['status' => $item['video_gen_status'] ?? 'none', 'video_url' => $item['video_url']]);
    }

    // Resolve video model for API credentials
    $videoBaseUrl = 'https://api.kilo.ai/api/gateway';
    $videoApiKey  = '';

    $vidModelStmt2 = $db->prepare("
        SELECT ap.api_base_url, ap.api_key_encrypted
        FROM company_settings cs
        JOIN ai_models am ON am.id = cs.ai_content_video_model_id
        JOIN ai_providers ap ON ap.id = am.provider_id
        WHERE cs.tenant_id = ? AND ap.api_key_encrypted IS NOT NULL AND ap.api_key_encrypted != ''
    ");
    $vidModelStmt2->execute([$tenantId]);
    $vidModelRow = $vidModelStmt2->fetch();

    if ($vidModelRow && !empty($vidModelRow['api_key_encrypted'])) {
        $videoBaseUrl = rtrim($vidModelRow['api_base_url'] ?: 'https://api.kilo.ai/api/gateway', '/');
        $videoApiKey  = decryptValue($vidModelRow['api_key_encrypted']);
    } else {
        $creds = resolveAICreds($db, 'ai_content_video_model_id', $tenantId);
        $videoApiKey = $creds['api_key'] ?? '';
        $videoBaseUrl = rtrim($creds['base_url'] ?: 'https://api.kilo.ai/api/gateway', '/');
    }

    if (empty($videoApiKey)) {
        jsonResponse(['status' => $item['video_gen_status'] ?? 'generating', 'video_job_id' => $item['video_job_id'], 'note' => 'no API key configured']);
    }

    $ch = curl_init($videoBaseUrl . '/video/generations/' . urlencode($item['video_job_id']));
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER     => ['Authorization: Bearer ' . $videoApiKey, 'Content-Type: application/json'],
        CURLOPT_SSL_VERIFYPEER => !empty(AI_SSL_VERIFY),
        CURLOPT_TIMEOUT        => 30,
    ]);
    $res = curl_exec($ch);
    curl_close($ch);

    if ($res === false) {
        jsonResponse(['status' => 'generating', 'video_job_id' => $item['video_job_id'], 'note' => 'poll failed, retry']);
    }

    $dec = json_decode($res, true);
    $jobStatus = $dec['status'] ?? 'generating';

    if ($jobStatus === 'completed' || $jobStatus === 'done' || $jobStatus === 'succeeded') {
        $videoUrl = $dec['video_url'] ?? $dec['url'] ?? $dec['output'] ?? '';
        $db->prepare('UPDATE content_items SET video_gen_status=?, video_url=?, updated_at=NOW() WHERE id=? AND tenant_id=?')
           ->execute(['done', $videoUrl, $itemId, $tenantId]);
        jsonResponse(['status' => 'done', 'video_url' => $videoUrl]);
    }

    if ($jobStatus === 'failed' || $jobStatus === 'error') {
        $errMsg = $dec['error']['message'] ?? $dec['error'] ?? 'Unknown';
        $db->prepare('UPDATE content_items SET video_gen_status=?, updated_at=NOW() WHERE id=? AND tenant_id=?')
           ->execute(['failed', $itemId, $tenantId]);
        jsonResponse(['status' => 'failed', 'error' => $errMsg]);
    }

    jsonResponse(['status' => 'generating', 'video_job_id' => $item['video_job_id']]);
}

// ─── ANALYZE-PRODUCT-IMAGE ────────────────────────────────────────────────────
// Uses AI Vision to extract structured metadata (colors, shape, style, etc.)
if ($action === 'analyze-product-image' && $method === 'POST') {
    $body    = getRequestBody();
    $imageUrl = $body['image_url'] ?? '';
    if (!$imageUrl) jsonError('Missing image_url', 400);

    // Convert local/relative URL to absolute or base64 for AI vision
    $imageB64 = _loadImageAsBase64($imageUrl);
    if (!$imageB64) jsonError('Cannot load image: ' . $imageUrl, 400);

    // Get AI credentials — prefer image model (multimodal, supports vision input)
    $creds = _resolveImageCreds($db, $tenantId);
    if (empty($creds['api_key'])) jsonError('No AI API key configured', 500);

    $prompt = <<<'EOD'
Analyze this product image in extreme detail. Return ONLY a JSON object (no markdown, no explanation) with these exact keys:
{
  "product_type": "What is this product? (e.g., software dashboard, physical device, packaging, etc.)",
  "primary_color": "#HEX — dominant color",
  "secondary_colors": ["#HEX1", "#HEX2"] — 2-3 supporting colors,
  "shape_description": "Overall shape and form of the product/interface (1 sentence)",
  "texture_style": "Visual style and texture (e.g., flat vector, 3D render, photorealistic, matte, glossy)",
  "key_elements": ["element1", "element2", "element3"] — 3-5 key visual elements visible in the image,
  "composition": "Layout and arrangement of elements (1 sentence)",
  "mood": "Overall mood/feeling (1-2 words like professional, playful, luxury, minimal)",
  "category": "Product category for matching with content topics (keywords like: AI, dashboard, factory, automation, CRM, ecommerce)"
}
ALL values must be in English. Keep descriptions concise and specific. Focus on visual appearance only.
EOD;

    $payload = [
        'model' => $creds['model'],
        'messages' => [[
            'role' => 'user',
            'content' => [
                ['type' => 'text', 'text' => $prompt],
                ['type' => 'image_url', 'image_url' => ['url' => $imageB64]],
            ],
        ]],
        'max_tokens' => 1024,
    ];

    $ch = curl_init($creds['base_url'] . '/chat/completions');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true, CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode($payload),
        CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $creds['api_key'], 'Content-Type: application/json'],
        CURLOPT_SSL_VERIFYPEER => !empty(AI_SSL_VERIFY),
        CURLOPT_SSL_VERIFYHOST => !empty(AI_SSL_VERIFY) ? 2 : 0,
        CURLOPT_TIMEOUT => 60,
    ]);
    $res = curl_exec($ch); curl_close($ch);
    $dec = json_decode($res, true);

    $content = $dec['choices'][0]['message']['content'] ?? '';
    // Strip markdown fences if present
    $content = trim(preg_replace('/^```(?:json)?\s*|\s*```$/m', '', $content));

    $metadata = json_decode($content, true);
    if (!$metadata || !is_array($metadata)) {
        // Fallback: extract what we can
        $metadata = ['raw_analysis' => $content ?: 'AI analysis failed'];
    }

    jsonResponse(['metadata' => $metadata]);
}
// ── test-channel: verify platform credentials ────────────────────────────────
// Helper: test a single channel's real connection. Returns ['ok' => bool, 'message' => string].
function testChannelConnection(array $ch): array {
    $creds = [];
    if (!empty($ch['credentials_encrypted'])) {
        $plain = decryptApiKey($ch['credentials_encrypted']);
        if ($plain) {
            $decoded = json_decode($plain, true);
            $creds = is_array($decoded) ? $decoded : ['token' => $plain];
        }
    }

    // Disabled channel is always "not connected".
    if ((int)($ch['is_active'] ?? 0) !== 1) {
        return ['ok' => false, 'message' => 'ช่องทางถูกปิดใช้งาน (is_active = 0)'];
    }

    $platform = $ch['platform'];
    $ok  = false;
    $msg = '';

    if ($platform === 'wordpress') {
        $url  = rtrim($ch['endpoint_url'] ?: '', '/') . '/wp-json/wp/v2/users/me';
        $user = $creds['username'] ?? '';
        $pass = $creds['app_password'] ?? '';
        if (!$url || !$user || !$pass) { return ['ok' => false, 'message' => 'ข้อมูลไม่ครบ (endpoint_url, username, app_password)']; }
        $hCh = curl_init($url);
        curl_setopt_array($hCh, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 15,
            CURLOPT_USERPWD => "$user:$pass", CURLOPT_SSL_VERIFYPEER => false]);
        $res  = curl_exec($hCh);
        $code = curl_getinfo($hCh, CURLINFO_HTTP_CODE);
        $err  = curl_error($hCh);
        curl_close($hCh);
        if ($err) { $ok = false; $msg = "cURL error: $err"; }
        elseif ($code === 200) { $dec = json_decode($res, true); $ok = true; $msg = 'เชื่อมต่อสำเร็จ — ผู้ใช้: ' . ($dec['name'] ?? '?'); }
        else { $ok = false; $msg = "HTTP $code — ตรวจสอบ URL และ credentials"; }

    } elseif ($platform === 'facebook') {
        $pageId = $creds['page_id'] ?? '';
        $token  = $creds['access_token'] ?? '';
        if (!$pageId || !$token) { return ['ok' => false, 'message' => 'ข้อมูลไม่ครบ (page_id, access_token)']; }
        $hCh = curl_init("https://graph.facebook.com/v19.0/$pageId?fields=name&access_token=$token");
        curl_setopt_array($hCh, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 15]);
        $res  = curl_exec($hCh);
        $code = curl_getinfo($hCh, CURLINFO_HTTP_CODE);
        curl_close($hCh);
        $dec = json_decode($res, true) ?: [];
        if ($code === 200 && !empty($dec['name'])) { $ok = true; $msg = 'เชื่อมต่อสำเร็จ — Page: ' . $dec['name']; }
        else { $ok = false; $msg = $dec['error']['message'] ?? "HTTP $code"; }

    } elseif ($platform === 'lineoa') {
        $token = $creds['channel_access_token'] ?? '';
        if (!$token) { return ['ok' => false, 'message' => 'ข้อมูลไม่ครบ (channel_access_token)']; }
        $hCh = curl_init('https://api.line.me/v2/bot/info');
        curl_setopt_array($hCh, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 15,
            CURLOPT_HTTPHEADER => ["Authorization: Bearer $token"]]);
        $res  = curl_exec($hCh);
        $code = curl_getinfo($hCh, CURLINFO_HTTP_CODE);
        curl_close($hCh);
        $dec = json_decode($res, true) ?: [];
        if ($code === 200 && !empty($dec['displayName'])) { $ok = true; $msg = 'เชื่อมต่อสำเร็จ — Bot: ' . $dec['displayName']; }
        else { $ok = false; $msg = $dec['message'] ?? "HTTP $code"; }

    } elseif ($platform === 'linkedin') {
        $token = $creds['access_token'] ?? '';
        if (!$token) { return ['ok' => false, 'message' => 'ข้อมูลไม่ครบ (access_token)']; }
        $hCh = curl_init('https://api.linkedin.com/v2/userinfo');
        curl_setopt_array($hCh, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 15,
            CURLOPT_HTTPHEADER => ["Authorization: Bearer $token"]]);
        $res  = curl_exec($hCh);
        $code = curl_getinfo($hCh, CURLINFO_HTTP_CODE);
        curl_close($hCh);
        $dec = json_decode($res, true) ?: [];
        if ($code === 200) { $ok = true; $msg = 'เชื่อมต่อสำเร็จ — ' . ($dec['name'] ?? $dec['sub'] ?? 'OK'); }
        else { $ok = false; $msg = $dec['message'] ?? "HTTP $code"; }

    } elseif (in_array($platform, ['custom', 'wix', 'website', 'lotusdomino'])) {
        $url = $ch['endpoint_url'] ?? '';
        if (!$url) { return ['ok' => false, 'message' => 'ยังไม่ได้ตั้ง Endpoint URL']; }
        $hCh = curl_init($url);
        curl_setopt_array($hCh, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 10,
            CURLOPT_NOBODY => true, CURLOPT_SSL_VERIFYPEER => false]);
        curl_exec($hCh);
        $code = curl_getinfo($hCh, CURLINFO_HTTP_CODE);
        $err  = curl_error($hCh);
        curl_close($hCh);
        if ($err) { $ok = false; $msg = "ไม่สามารถเชื่อมต่อ: $err"; }
        elseif ($code > 0 && $code < 500) { $ok = true; $msg = "เชื่อมต่อ endpoint ได้ (HTTP $code)"; }
        else { $ok = false; $msg = "HTTP $code — ตรวจสอบ URL"; }

    } else {
        // Platforms without a simple verify API
        $ok  = false;
        $msg = "ไม่รองรับการทดสอบ {$platform} โดยตรง — กรุณาส่ง test content เพื่อตรวจสอบ";
    }

    return ['ok' => $ok, 'message' => $msg];
}

if ($action === 'test-channel' && $method === 'POST') {
    $body      = getRequestBody();
    $channelId = $body['channel_id'] ?? '';
    if (!$channelId) jsonError('channel_id required', 400);

    require_once __DIR__ . '/lib/publish-dispatch.php';

    $chStmt = $db->prepare("SELECT * FROM publish_channels WHERE id=? AND tenant_id=?");
    $chStmt->execute([$channelId, $tenantId]);
    $ch = $chStmt->fetch(PDO::FETCH_ASSOC);
    if (!$ch) jsonError('Channel not found', 404);

    jsonResponse(testChannelConnection($ch));
}

// ── channels-connection-status: real connection status for all tenant channels ─
if ($action === 'channels-connection-status' && $method === 'GET') {
    require_once __DIR__ . '/lib/publish-dispatch.php';

    $stmt = $db->prepare("SELECT * FROM publish_channels WHERE tenant_id=? ORDER BY created_at ASC");
    $stmt->execute([$tenantId]);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $out = [];
    foreach ($rows as $ch) {
        $result = testChannelConnection($ch);
        $out[] = [
            'id'      => $ch['id'],
            'name'    => $ch['name'],
            'platform'=> $ch['platform'],
            'ok'      => (bool)$result['ok'],
            'message' => $result['message'],
        ];
    }
    jsonResponse($out);
}

if ($action === 'list-items' && $method === 'GET') {
    $type  = $_GET['type'] ?? '';
    $where = $type ? 'WHERE ci.tenant_id = ? AND ci.type = ?' : 'WHERE ci.tenant_id = ?';
    $params = $type ? [$tenantId, $type] : [$tenantId];
    $stmt = $db->prepare("SELECT ci.id, ci.title, ci.type, ci.article_content, ci.scheduled_date, ci.platform, ci.created_at FROM content_items ci $where ORDER BY ci.created_at DESC LIMIT 200");
    $stmt->execute($params);
    jsonResponse($stmt->fetchAll(PDO::FETCH_ASSOC));
}

jsonError('Invalid action', 400);
