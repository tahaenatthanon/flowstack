<?php
// Content Research API: DataForSEO fetch, cache and keyword selection.
set_time_limit(0);
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/lib/keyword-research.php';

$db = getDB();
$auth = requireAuth();
$userId = (string)$auth['user_id'];
$tenantId = (string)$auth['tenant_id'];
$method = getMethod();
$action = (string)($_GET['action'] ?? '');

function research_settings(PDO $db, string $tenantId): array {
    $stmt = $db->prepare('SELECT research_provider, research_api_login, research_api_key_encrypted, research_location_code, research_language_code, research_cache_hours FROM content_global_settings WHERE tenant_id=?');
    $stmt->execute([$tenantId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC) ?: [];
    return [
        'provider' => (string)($row['research_provider'] ?? 'none'),
        'login' => (string)($row['research_api_login'] ?? ''),
        'password' => !empty($row['research_api_key_encrypted']) ? decryptApiKey((string)$row['research_api_key_encrypted']) : '',
        'has_key' => !empty($row['research_api_key_encrypted']),
        'location_code' => (int)($row['research_location_code'] ?? 2764),
        'language_code' => (string)($row['research_language_code'] ?? 'th'),
        'cache_hours' => (int)($row['research_cache_hours'] ?? 168),
    ];
}

function research_keyword_rows(PDO $db, string $jobId, string $tenantId): array {
    $stmt = $db->prepare('SELECT id, job_id, tenant_id, keyword, search_volume, competition, cpc, difficulty, intent, source, is_selected, created_at FROM content_research_keywords WHERE job_id=? AND tenant_id=? ORDER BY is_selected DESC, search_volume DESC, keyword ASC');
    $stmt->execute([$jobId, $tenantId]);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    foreach ($rows as &$row) {
        $row['search_volume'] = $row['search_volume'] === null ? null : (int)$row['search_volume'];
        $row['competition'] = $row['competition'] === null ? null : (float)$row['competition'];
        $row['cpc'] = $row['cpc'] === null ? null : (float)$row['cpc'];
        $row['difficulty'] = $row['difficulty'] === null ? null : (int)$row['difficulty'];
        $row['is_selected'] = (int)$row['is_selected'];
    }
    unset($row);
    return $rows;
}

function research_job_response(PDO $db, array $job, string $tenantId, bool $cached = false): array {
    $rawSerp = json_decode((string)($job['raw_serp'] ?? ''), true);
    $serp = is_array($rawSerp['normalized'] ?? null) ? $rawSerp['normalized'] : ['organic' => [], 'people_also_ask' => [], 'related_searches' => []];
    return [
        'job_id' => $job['id'],
        'status' => $job['status'],
        'seed_keyword' => $job['seed_keyword'],
        'provider' => $job['provider'],
        'location_code' => (int)$job['location_code'],
        'language_code' => $job['language_code'],
        'fetched_at' => $job['fetched_at'],
        'cached' => $cached,
        'cost_usd' => $job['cost_usd'] === null ? null : (float)$job['cost_usd'],
        'serp' => $serp,
        'keywords' => research_keyword_rows($db, (string)$job['id'], $tenantId),
    ];
}

if ($action === 'settings-status') {
    if ($method !== 'GET') jsonError('วิธีการเรียกไม่ถูกต้อง', 405);
    $settings = research_settings($db, $tenantId);
    jsonResponse([
        'provider' => $settings['provider'],
        'has_key' => $settings['has_key'],
        'location_code' => $settings['location_code'],
        'language_code' => $settings['language_code'],
        'cache_hours' => $settings['cache_hours'],
    ]);
}

if ($action === 'test') {
    if ($method !== 'POST') jsonError('วิธีการเรียกไม่ถูกต้อง', 405);
    $settings = research_settings($db, $tenantId);
    if ($settings['provider'] !== 'dataforseo') jsonError('ยังไม่ได้ตั้งค่า DataForSEO', 400);
    if ($settings['login'] === '' || $settings['password'] === '') jsonError('กรุณาตั้งค่า DataForSEO login และ password', 400);
    try {
        $result = research_test_dataforseo($settings['login'], $settings['password']);
        jsonResponse(['ok' => true, 'message' => 'เชื่อมต่อ DataForSEO สำเร็จ', 'balance_usd' => $result['balance_usd']]);
    } catch (Throwable $e) {
        jsonResponse(['ok' => false, 'message' => 'เชื่อมต่อ DataForSEO ไม่สำเร็จ'], 502);
    }
}

if ($action === 'fetch') {
    if ($method !== 'POST') jsonError('วิธีการเรียกไม่ถูกต้อง', 405);
    $body = getRequestBody();
    $seed = trim((string)($body['seed_keyword'] ?? ''));
    if ($seed === '' || strlen($seed) > 255) jsonError('seed keyword ต้องมีความยาว 1-255 ตัวอักษร', 422);
    $settings = research_settings($db, $tenantId);
    if ($settings['provider'] !== 'dataforseo') jsonError('ยังไม่ได้ตั้งค่า DataForSEO', 400);
    if ($settings['login'] === '' || $settings['password'] === '') jsonError('กรุณาตั้งค่า DataForSEO login และ password', 400);
    $contentItemId = trim((string)($body['content_item_id'] ?? '')) ?: null;
    if ($contentItemId !== null) {
        $itemStmt = $db->prepare('SELECT id FROM content_items WHERE id=? AND tenant_id=?');
        $itemStmt->execute([$contentItemId, $tenantId]);
        if (!$itemStmt->fetchColumn()) jsonError('ไม่พบ content item ใน tenant นี้', 404);
    }
    $forceRefresh = !empty($body['force_refresh']);
    if (!$forceRefresh && $settings['cache_hours'] > 0) {
        $hours = min(8760, max(1, $settings['cache_hours']));
        $cacheSql = "SELECT * FROM content_research_jobs WHERE tenant_id=? AND provider=? AND location_code=? AND language_code=? AND seed_keyword=? AND status='done' AND fetched_at >= DATE_SUB(NOW(), INTERVAL {$hours} HOUR) ORDER BY fetched_at DESC LIMIT 1";
        $cacheStmt = $db->prepare($cacheSql);
        $cacheStmt->execute([$tenantId, $settings['provider'], $settings['location_code'], $settings['language_code'], $seed]);
        $cachedJob = $cacheStmt->fetch(PDO::FETCH_ASSOC);
        if ($cachedJob) jsonResponse(research_job_response($db, $cachedJob, $tenantId, true));
    }
    $jobId = generateUUID();
    $insert = $db->prepare("INSERT INTO content_research_jobs (id, tenant_id, content_item_id, seed_keyword, provider, location_code, language_code, status, created_by) VALUES (?,?,?,?,?,?,?,'fetching',?)");
    $insert->execute([$jobId, $tenantId, $contentItemId, $seed, $settings['provider'], $settings['location_code'], $settings['language_code'], $userId]);
    try {
        $result = research_fetch_dataforseo($settings['login'], $settings['password'], $seed, $settings['location_code'], $settings['language_code']);
        $rawSerp = json_encode(['normalized' => $result['serp'], 'provider' => $result['raw']['serp']], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        $rawKeywords = json_encode(['provider' => ['suggestions' => $result['raw']['suggestions'], 'volume' => $result['raw']['volume']]], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        $db->beginTransaction();
        $update = $db->prepare("UPDATE content_research_jobs SET status='done', raw_serp=?, raw_keywords=?, cost_usd=?, fetched_at=NOW(), updated_at=NOW() WHERE id=? AND tenant_id=?");
        $update->execute([$rawSerp, $rawKeywords, $result['cost_usd'], $jobId, $tenantId]);
        $keywordInsert = $db->prepare('INSERT INTO content_research_keywords (id, job_id, tenant_id, keyword, search_volume, competition, cpc, difficulty, intent, source, is_selected) VALUES (?,?,?,?,?,?,?,?,?,?,0)');
        foreach (array_slice($result['keywords'], 0, 150) as $keyword) {
            $keywordInsert->execute([generateUUID(), $jobId, $tenantId, $keyword['keyword'], $keyword['search_volume'], $keyword['competition'], $keyword['cpc'], $keyword['difficulty'], $keyword['intent'], $keyword['source']]);
        }
        $db->commit();
        $jobStmt = $db->prepare('SELECT * FROM content_research_jobs WHERE id=? AND tenant_id=?');
        $jobStmt->execute([$jobId, $tenantId]);
        jsonResponse(research_job_response($db, $jobStmt->fetch(PDO::FETCH_ASSOC), $tenantId));
    } catch (Throwable $e) {
        if ($db->inTransaction()) $db->rollBack();
        $message = mb_substr($e->getMessage(), 0, 500);
        $db->prepare('UPDATE content_research_jobs SET status=\'failed\', error_msg=?, updated_at=NOW() WHERE id=? AND tenant_id=?')->execute([$message, $jobId, $tenantId]);
        jsonError('ดึงข้อมูล Research ไม่สำเร็จ: ' . $message, 502);
    }
}

if ($action === 'job') {
    if ($method !== 'GET') jsonError('วิธีการเรียกไม่ถูกต้อง', 405);
    $id = trim((string)($_GET['id'] ?? ''));
    if ($id === '') jsonError('ต้องระบุ job id', 422);
    $stmt = $db->prepare('SELECT * FROM content_research_jobs WHERE id=? AND tenant_id=?');
    $stmt->execute([$id, $tenantId]);
    $job = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$job) jsonError('ไม่พบ Research job', 404);
    jsonResponse(research_job_response($db, $job, $tenantId));
}

if ($action === 'jobs') {
    if ($method !== 'GET') jsonError('วิธีการเรียกไม่ถูกต้อง', 405);
    $limit = min(100, max(1, (int)($_GET['limit'] ?? 20)));
    $contentItemId = trim((string)($_GET['content_item_id'] ?? ''));
    if ($contentItemId !== '') {
        $stmt = $db->prepare("SELECT * FROM content_research_jobs WHERE tenant_id=? AND content_item_id=? ORDER BY created_at DESC LIMIT {$limit}");
        $stmt->execute([$tenantId, $contentItemId]);
    } else {
        $stmt = $db->prepare("SELECT * FROM content_research_jobs WHERE tenant_id=? ORDER BY created_at DESC LIMIT {$limit}");
        $stmt->execute([$tenantId]);
    }
    $jobs = [];
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $job) $jobs[] = research_job_response($db, $job, $tenantId);
    jsonResponse($jobs);
}

if ($action === 'keyword-select') {
    if ($method !== 'PUT') jsonError('วิธีการเรียกไม่ถูกต้อง', 405);
    $body = getRequestBody();
    $jobId = trim((string)($body['job_id'] ?? ''));
    $keywords = $body['keywords'] ?? [];
    if ($jobId === '' || !is_array($keywords)) jsonError('ข้อมูลการเลือก keyword ไม่ถูกต้อง', 422);
    $jobStmt = $db->prepare("SELECT id FROM content_research_jobs WHERE id=? AND tenant_id=? AND status='done'");
    $jobStmt->execute([$jobId, $tenantId]);
    if (!$jobStmt->fetchColumn()) jsonError('ไม่พบ Research job หรือ job ยังไม่พร้อมใช้งาน', 404);
    $db->beginTransaction();
    try {
        $db->prepare('UPDATE content_research_keywords SET is_selected=0 WHERE job_id=? AND tenant_id=?')->execute([$jobId, $tenantId]);
        $update = $db->prepare('UPDATE content_research_keywords SET is_selected=1 WHERE job_id=? AND tenant_id=? AND keyword=?');
        foreach (array_slice($keywords, 0, 10) as $keyword) {
            $value = trim((string)$keyword);
            if ($value !== '') $update->execute([$jobId, $tenantId, $value]);
        }
        $db->commit();
        jsonResponse(['job_id' => $jobId, 'keywords' => research_keyword_rows($db, $jobId, $tenantId)]);
    } catch (Throwable $e) {
        if ($db->inTransaction()) $db->rollBack();
        jsonError('บันทึกการเลือก keyword ไม่สำเร็จ', 500);
    }
}

jsonError('ไม่พบ action ของ Research', 404);
