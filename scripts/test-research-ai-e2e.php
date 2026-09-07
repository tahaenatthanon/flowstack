<?php
/**
 * E2E Runtime Verification — Research AI Web Search Citation
 *
 * รันบนเครื่อง XAMPP ที่มี FlowStack จริง:
 *   php scripts/test-research-ai-e2e.php <email> <content_item_id> [seed_keyword]
 *
 * Password รับจาก environment variable FLOWSTACK_TEST_PASSWORD เท่านั้น
 * เพื่อไม่ให้ password ไปอยู่ใน PowerShell history / command line arguments
 *
 * Optional:
 *   FLOWSTACK_API_BASE=http://localhost/flowstack/api
 *   FLOWSTACK_TEST_PASSWORD=...
 *
 * สิ่งที่ตรวจ:
 * 1) Login ผ่าน HTTP จริงและรับ JWT
 * 2) settings-status
 * 3) Research AI connection test
 * 4) fetch จริง → OpenRouter / perplexity/sonar → Web Search
 * 5) API response มี valid citation
 * 6) DB raw_serp มี citation และ provider annotations จริง
 * 7) job endpoint คืน citation เดิม
 *
 * ไม่พิมพ์ JWT / password / API key ออกหน้าจอ
 */

if (PHP_SAPI !== 'cli') {
    fwrite(STDERR, "CLI only\n");
    exit(2);
}

require_once __DIR__ . '/../api/config.php';

$pass = 0;
$fail = 0;

function check(string $name, bool $ok, string $detail = ''): void {
    global $pass, $fail;
    if ($ok) {
        $pass++;
        echo "PASS  {$name}\n";
    } else {
        $fail++;
        echo "FAIL  {$name}" . ($detail !== '' ? " — {$detail}" : '') . "\n";
    }
}

function failNow(string $message, int $code = 2): never {
    fwrite(STDERR, "ERROR  {$message}\n");
    exit($code);
}

function httpJson(string $method, string $url, ?array $body = null, ?string $token = null): array {
    $ch = curl_init($url);
    if ($ch === false) throw new RuntimeException('ไม่สามารถเริ่ม HTTP client ได้');

    $headers = ['Accept: application/json'];
    if ($body !== null) $headers[] = 'Content-Type: application/json';
    if ($token !== null && $token !== '') $headers[] = 'Authorization: Bearer ' . $token;

    $options = [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST => strtoupper($method),
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_TIMEOUT => 120,
        CURLOPT_SSL_VERIFYPEER => defined('AI_SSL_VERIFY') ? AI_SSL_VERIFY : true,
    ];
    if ($body !== null) {
        $options[CURLOPT_POSTFIELDS] = json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
    }
    curl_setopt_array($ch, $options);
    $responseBody = curl_exec($ch);
    $curlError = curl_error($ch);
    $httpCode = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($responseBody === false || $curlError !== '') {
        throw new RuntimeException('HTTP request ล้มเหลว: ' . ($curlError ?: 'unknown curl error'));
    }
    $json = json_decode($responseBody, true);
    return [
        'http_code' => $httpCode,
        'json' => is_array($json) ? $json : null,
        'raw' => $responseBody,
    ];
}

function apiData(array $response): mixed {
    $json = $response['json'] ?? null;
    if (!is_array($json)) return null;
    return array_key_exists('data', $json) ? $json['data'] : $json;
}

function validCitation(array $citation): bool {
    $url = trim((string)($citation['url'] ?? ''));
    return $url !== ''
        && preg_match('#^https?://#i', $url) === 1
        && filter_var($url, FILTER_VALIDATE_URL) !== false;
}

function hasProviderCitation(array $rawSerp): bool {
    $provider = $rawSerp['provider'] ?? null;
    $annotations = $provider['choices'][0]['message']['annotations'] ?? [];
    if (!is_array($annotations)) return false;
    foreach ($annotations as $annotation) {
        if (!is_array($annotation)) continue;
        $citation = $annotation['url_citation'] ?? null;
        if (is_array($citation) && validCitation($citation)) return true;
    }
    return false;
}

$email = trim((string)($argv[1] ?? ''));
$contentItemId = trim((string)($argv[2] ?? ''));
$seed = trim((string)($argv[3] ?? 'youtube'));
$password = (string)(getenv('FLOWSTACK_TEST_PASSWORD') ?: ($_ENV['FLOWSTACK_TEST_PASSWORD'] ?? ''));
$apiBase = rtrim((string)(getenv('FLOWSTACK_API_BASE') ?: ($_ENV['FLOWSTACK_API_BASE'] ?? 'http://localhost/flowstack/api')), '/');

if ($email === '' || $contentItemId === '') {
    failNow("Usage: php scripts/test-research-ai-e2e.php <email> <content_item_id> [seed_keyword]\nSet FLOWSTACK_TEST_PASSWORD before running.");
}
if ($password === '') {
    failNow('ไม่พบ FLOWSTACK_TEST_PASSWORD');
}

$loginUrl = $apiBase . '/auth/login.php';
$researchUrl = $apiBase . '/content-research.php';

echo "== Research AI E2E Runtime Verification ==\n";
echo "API: {$apiBase}\n";
echo "Seed: {$seed}\n";
echo "Content Item: {$contentItemId}\n\n";

// 1. Real HTTP login
try {
    $login = httpJson('POST', $loginUrl, ['email' => $email, 'password' => $password]);
    $loginData = apiData($login);
    $token = is_array($loginData) ? (string)($loginData['token'] ?? '') : '';
    check('HTTP login succeeds', $login['http_code'] >= 200 && $login['http_code'] < 300 && $token !== '', 'HTTP ' . $login['http_code']);
    if ($token === '') failNow('Login ไม่ได้ JWT — หยุด E2E เพราะ endpoint อื่นต้องใช้ authentication');
} catch (Throwable $e) {
    failNow('Login runtime error: ' . $e->getMessage());
}

// 2. Settings status
try {
    $settings = httpJson('GET', $researchUrl . '?action=settings-status', null, $token);
    $data = apiData($settings);
    check('settings-status HTTP 200', $settings['http_code'] === 200, 'HTTP ' . $settings['http_code']);
    check('Research provider = ai', is_array($data) && ($data['provider'] ?? '') === 'ai');
    check('Research AI key is configured', is_array($data) && !empty($data['has_key']));
} catch (Throwable $e) {
    failNow('settings-status runtime error: ' . $e->getMessage());
}

// 3. Real provider connection test
try {
    $test = httpJson('POST', $researchUrl . '?action=test', ['provider' => 'ai'], $token);
    $data = apiData($test);
    check('Research AI connection test HTTP 200', $test['http_code'] === 200, 'HTTP ' . $test['http_code']);
    check('Research AI connection test returns ok=true', is_array($data) && ($data['ok'] ?? false) === true, is_array($data) ? (string)($data['message'] ?? '') : '');
} catch (Throwable $e) {
    failNow('Research AI test runtime error: ' . $e->getMessage());
}

// 4. Real fetch — this is the primary E2E proof of Web Search + Citation.
$fetchData = null;
$jobId = '';
try {
    $fetch = httpJson('POST', $researchUrl . '?action=fetch', [
        'seed_keyword' => $seed,
        'content_item_id' => $contentItemId,
        'force_refresh' => true,
    ], $token);
    $fetchData = apiData($fetch);
    $jobId = is_array($fetchData) ? (string)($fetchData['job_id'] ?? '') : '';

    check('Real fetch HTTP 200', $fetch['http_code'] === 200, 'HTTP ' . $fetch['http_code']);
    check('Fetch returns job_id', $jobId !== '');
    check('Fetch status = done', is_array($fetchData) && ($fetchData['status'] ?? '') === 'done');

    $citations = is_array($fetchData['citations'] ?? null) ? $fetchData['citations'] : [];
    $validCitations = array_values(array_filter($citations, 'validCitation'));
    check('API response has >= 1 valid Citation', count($validCitations) >= 1, 'citations=' . count($citations));

    if ($validCitations) {
        $firstUrl = (string)$validCitations[0]['url'];
        echo "  Citation URL: {$firstUrl}\n";
    }
} catch (Throwable $e) {
    check('Real fetch completed', false, $e->getMessage());
}

if ($jobId === '') {
    echo "\n{$pass} passed, {$fail} failed\n";
    exit($fail > 0 ? 1 : 0);
}

// 5. Direct DB audit: persisted citation + original provider annotations.
try {
    $db = getDB();
    $stmt = $db->prepare('SELECT id, status, raw_serp, error_msg FROM content_research_jobs WHERE id=? LIMIT 1');
    $stmt->execute([$jobId]);
    $job = $stmt->fetch(PDO::FETCH_ASSOC);
    check('DB contains fetched Research Job', is_array($job));
    check('DB job status = done', is_array($job) && $job['status'] === 'done');

    $rawSerp = is_array($job) ? json_decode((string)$job['raw_serp'], true) : null;
    $dbCitations = is_array($rawSerp['citations'] ?? null) ? $rawSerp['citations'] : [];
    $validDbCitations = array_values(array_filter($dbCitations, 'validCitation'));
    check('DB raw_serp.citations has >= 1 valid Citation', count($validDbCitations) >= 1, 'citations=' . count($dbCitations));
    check('DB preserves provider annotations[].url_citation', is_array($rawSerp) && hasProviderCitation($rawSerp));

    if ($fetchData !== null) {
        $apiUrls = array_values(array_map(static fn(array $c): string => strtolower((string)$c['url']), $validCitations));
        $dbUrls = array_values(array_map(static fn(array $c): string => strtolower((string)$c['url']), $validDbCitations));
        sort($apiUrls);
        sort($dbUrls);
        check('API Citation URLs match DB Citation URLs', $apiUrls === $dbUrls);
    }
} catch (Throwable $e) {
    check('DB audit completed', false, $e->getMessage());
}

// 6. Job endpoint must return the same persisted citations.
try {
    $jobResponse = httpJson('GET', $researchUrl . '?action=job&id=' . rawurlencode($jobId), null, $token);
    $jobData = apiData($jobResponse);
    check('job endpoint HTTP 200', $jobResponse['http_code'] === 200, 'HTTP ' . $jobResponse['http_code']);
    $jobCitations = is_array($jobData['citations'] ?? null) ? $jobData['citations'] : [];
    $validJobCitations = array_values(array_filter($jobCitations, 'validCitation'));
    check('job endpoint returns >= 1 valid Citation', count($validJobCitations) >= 1, 'citations=' . count($jobCitations));
} catch (Throwable $e) {
    check('job endpoint runtime verification', false, $e->getMessage());
}

// 7. Security smoke check: no obvious credential material in HTTP responses.
$responsesToInspect = [$login ?? null, $settings ?? null, $test ?? null, $fetch ?? null, $jobResponse ?? null];
$secretLeak = false;
foreach ($responsesToInspect as $response) {
    if (!is_array($response)) continue;
    $raw = (string)($response['raw'] ?? '');
    if ($password !== '' && str_contains($raw, $password)) $secretLeak = true;
    if (preg_match('/(?:api[_-]?key|authorization)\s*[:=]\s*(?:bearer\s+)?[A-Za-z0-9_\-.]{20,}/i', $raw)) $secretLeak = true;
}
check('HTTP responses do not expose credentials', !$secretLeak);

echo "\n{$pass} passed, {$fail} failed\n";
exit($fail > 0 ? 1 : 0);
