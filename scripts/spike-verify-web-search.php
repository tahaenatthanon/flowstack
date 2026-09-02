<?php
/**
 * Spike: ยืนยันว่า gateway ให้ "real web search" ได้จริงก่อนเริ่ม Phase 2-3 ของ Content Research
 *
 * รัน: php scripts/spike-verify-web-search.php [section ...] [--provider=<id>]
 *   section = 1 (preflight) | 2 (model string) | 3 (real web search) | 4 (param matrix) | 5 (credential path) | all
 *
 *   ไม่ใส่ --provider  = ใช้ path เดิมของแอป resolveAICreds() (ai_providers ตาม company_settings)
 *   --provider=<id>   = อ่าน base_url จาก ai_providers แถวนั้นตรง ๆ + key จาก env
 *                       ใช้ทดสอบ gateway อื่นโดยไม่แตะ company_settings ของ production
 *
 *   env: SPIKE_MODEL      override model string (default perplexity/sonar)
 *        SPIKE_API_KEY    override api key (ใช้ได้กับทุก provider)
 *        OPENROUTER_API_KEY / KILO_API_TOKEN  key เฉพาะ provider นั้น
 *
 * ตัวอย่าง:
 *   php scripts/spike-verify-web-search.php 2 3
 *   OPENROUTER_API_KEY=sk-or-... php scripts/spike-verify-web-search.php all --provider=provider-openrouter
 *
 * สคริปต์นี้ "อ่านอย่างเดียว" — ไม่แก้ DB ไม่แตะ endpoint production
 * raw response ทุกรอบถูกเขียนลง <temp>/flowstack-spike-web-search/ เพื่อใช้อ้างอิงตอนสรุป
 *
 * openspec/changes/spike-verify-web-search — ข้อ 1.1, 1.2, 1.3
 */

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("CLI only\n");
}

require_once __DIR__ . '/../api/config.php';
require_once __DIR__ . '/../api/lib/ai-creds.php';

const SPIKE_TIMEOUT     = 60;   // design: timeout 60s ต่อ call
const SPIKE_CALL_DELAY  = 2;    // หน่วงระหว่าง call กัน rate limit
const SPIKE_MAX_TOKENS  = 1024;

$LOG_DIR = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'flowstack-spike-web-search';
if (!is_dir($LOG_DIR)) mkdir($LOG_DIR, 0777, true);

$CALL_SEQ = 0;

// ---------------------------------------------------------------------------
// 1.2 ยิง gateway /chat/completions แบบ OpenAI-compatible + บันทึก raw response
// ---------------------------------------------------------------------------

/**
 * @param array $extra params เพิ่มเติมที่ merge ลง payload (เช่น search_recency_filter)
 * @return array{http:int,err:string,raw:string,data:?array,content:string,elapsed:float,log:string}
 */
function gatewayCall(string $label, string $baseUrl, string $apiKey, string $model, array $messages, array $extra = []): array {
    global $LOG_DIR, $CALL_SEQ;
    $CALL_SEQ++;

    $payload = array_merge([
        'model'      => $model,
        'messages'   => $messages,
        'stream'     => false,
        'max_tokens' => SPIKE_MAX_TOKENS,
    ], $extra);

    $started = microtime(true);
    $ch = curl_init(rtrim($baseUrl, '/') . '/chat/completions');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => json_encode($payload, JSON_UNESCAPED_UNICODE),
        CURLOPT_HTTPHEADER     => [
            'Authorization: Bearer ' . $apiKey,
            'Content-Type: application/json',
        ],
        CURLOPT_SSL_VERIFYPEER => defined('AI_SSL_VERIFY') ? AI_SSL_VERIFY : true,
        CURLOPT_TIMEOUT        => SPIKE_TIMEOUT,
        CURLOPT_CONNECTTIMEOUT => 15,
    ]);
    $raw  = (string)curl_exec($ch);
    $http = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err  = curl_error($ch);
    curl_close($ch);
    $elapsed = microtime(true) - $started;

    $data    = json_decode($raw, true);
    $content = is_array($data) ? (string)($data['choices'][0]['message']['content'] ?? '') : '';

    $slug    = preg_replace('/[^a-z0-9]+/i', '-', $label);
    $logFile = sprintf('%s/%02d-%s.json', $LOG_DIR, $CALL_SEQ, strtolower(trim($slug, '-')));
    file_put_contents($logFile, json_encode([
        'label'    => $label,
        'request'  => $payload,
        'http'     => $http,
        'curl_err' => $err,
        'elapsed'  => round($elapsed, 2),
        'response' => $data ?? $raw,
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));

    sleep(SPIKE_CALL_DELAY);

    return compact('http', 'err', 'raw', 'data', 'content', 'elapsed') + ['log' => $logFile];
}

// ---------------------------------------------------------------------------
// 1.3 helper ตรวจ citation — นับ URL, host, และเช็ค HTTP HEAD ตัวอย่าง URL ต้นทาง
// ---------------------------------------------------------------------------

/** ดึง URL จากทุกที่ที่ gateway อาจใส่ citation ไว้ (field เฉพาะ + ในตัวเนื้อหา) */
function extractCitations(?array $data, string $content): array {
    $fromFields = [];

    // Perplexity-style: top-level citations / search_results
    foreach (['citations', 'search_results'] as $key) {
        foreach ((array)($data[$key] ?? []) as $item) {
            if (is_string($item)) $fromFields[] = $item;
            elseif (is_array($item) && !empty($item['url'])) $fromFields[] = (string)$item['url'];
        }
    }
    // OpenAI-style: message.annotations[].url_citation.url
    foreach ((array)($data['choices'][0]['message']['annotations'] ?? []) as $ann) {
        $url = $ann['url_citation']['url'] ?? ($ann['url'] ?? null);
        if (is_string($url) && $url !== '') $fromFields[] = $url;
    }

    // URL ที่โมเดลพิมพ์ในเนื้อหา
    preg_match_all('#https?://[^\s\)\]\>"\'،,]+#u', $content, $m);
    $fromContent = array_map(static fn($u) => rtrim($u, '.,;:'), $m[0] ?? []);

    $all   = array_values(array_unique(array_merge($fromFields, $fromContent)));
    $hosts = array_values(array_unique(array_filter(array_map(
        static fn($u) => parse_url($u, PHP_URL_HOST) ?: null, $all
    ))));

    return [
        'field_urls'   => array_values(array_unique($fromFields)),
        'content_urls' => array_values(array_unique($fromContent)),
        'all_urls'     => $all,
        'hosts'        => $hosts,
        'count'        => count($all),
        'host_count'   => count($hosts),
    ];
}

/** เช็คว่า URL ต้นทางเข้าถึงได้จริง (กัน hallucinated URL) — HEAD ก่อน ถ้าโดนบล็อกค่อย GET 1 byte */
function probeUrl(string $url): array {
    $run = function (bool $headOnly) use ($url) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_NOBODY         => $headOnly,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_MAXREDIRS      => 5,
            CURLOPT_TIMEOUT        => 20,
            CURLOPT_CONNECTTIMEOUT => 10,
            CURLOPT_SSL_VERIFYPEER => false,
            CURLOPT_USERAGENT      => 'Mozilla/5.0 (compatible; FlowstackSpike/1.0)',
        ]);
        if (!$headOnly) curl_setopt($ch, CURLOPT_RANGE, '0-1023');
        $body = curl_exec($ch);
        $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err  = curl_error($ch);
        curl_close($ch);
        return [$code, $err, (string)$body];
    };

    [$code, $err] = $run(true);
    $method = 'HEAD';
    if ($code === 0 || $code === 403 || $code === 405 || $code >= 500) {
        [$code2, $err2] = $run(false);
        if ($code2 > 0 && ($code2 < 400 || $code === 0)) { $code = $code2; $err = $err2; $method = 'GET'; }
    }

    return [
        'url'    => $url,
        'method' => $method,
        'http'   => $code,
        'err'    => $err,
        'ok'     => $code >= 200 && $code < 400,
    ];
}

/** รายงานผล citation ของ response หนึ่งครั้ง + probe URL ตัวอย่าง 1-2 ตัว */
function reportCitations(array $res, int $probeCount = 2): array {
    $cit = extractCitations($res['data'], $res['content']);
    printf("     citations: %d URL / %d host (field=%d, in-content=%d)\n",
        $cit['count'], $cit['host_count'], count($cit['field_urls']), count($cit['content_urls']));
    if ($cit['hosts']) echo "     hosts: " . implode(', ', array_slice($cit['hosts'], 0, 8)) . "\n";

    $probes = [];
    foreach (array_slice($cit['all_urls'], 0, $probeCount) as $u) {
        $p = probeUrl($u);
        $probes[] = $p;
        printf("     probe %s %s -> %s%s\n", $p['method'], mb_strimwidth($u, 0, 90, '...'),
            $p['http'] ?: 'ERR', $p['err'] ? " ({$p['err']})" : '');
    }
    return $cit + ['probes' => $probes];
}

function section(string $title): void {
    echo "\n" . str_repeat('=', 78) . "\n$title\n" . str_repeat('=', 78) . "\n";
}

function callSummary(string $label, array $res): void {
    printf("  [%s] HTTP %s in %.1fs%s\n", $label, $res['http'] ?: 'ERR', $res['elapsed'],
        $res['err'] ? " curl_error={$res['err']}" : '');
    if (!empty($res['data']['error'])) {
        $e = $res['data']['error'];
        echo "     error: " . (is_array($e) ? json_encode($e, JSON_UNESCAPED_UNICODE) : $e) . "\n";
    }
    if ($res['content'] !== '') {
        echo "     content: " . str_replace("\n", ' ', mb_strimwidth($res['content'], 0, 300, '...')) . "\n";
    }
    $u = $res['data']['usage'] ?? null;
    if ($u) printf("     usage: prompt=%s completion=%s total=%s\n",
        $u['prompt_tokens'] ?? '?', $u['completion_tokens'] ?? '?', $u['total_tokens'] ?? '?');
    echo "     echoed model: " . ($res['data']['model'] ?? '(none)') . "  | id: " . ($res['data']['id'] ?? '(none)') . "\n";
    echo "     raw log: {$res['log']}\n";
}

// ---------------------------------------------------------------------------
// bootstrap: resolve credentials
//   default = path เดิมของแอป (resolveAICreds -> ai_providers / KILO_API_TOKEN)
//   --provider=<id> = อ่าน base_url จาก ai_providers แถวนั้นตรง ๆ + key จาก env
//                     ใช้ทดสอบ gateway อื่นโดยไม่แตะ company_settings ของ production
// ---------------------------------------------------------------------------

$argsIn    = array_slice($argv, 1);
$providerId = '';
$sections   = [];
foreach ($argsIn as $a) {
    if (str_starts_with($a, '--provider=')) $providerId = substr($a, 11);
    else $sections[] = $a;
}
if (!$sections || in_array('all', $sections, true)) $sections = ['1', '2', '3', '4', '5'];

$db = getDB();

/** env ที่ยอมรับเป็น key override เรียงตามลำดับความจำเพาะ */
function envKeyFor(string $providerId): string {
    $names = ['SPIKE_API_KEY'];
    if ($providerId === 'provider-openrouter') $names[] = 'OPENROUTER_API_KEY';
    if ($providerId === 'provider-kilo')       $names[] = 'KILO_API_TOKEN';
    foreach ($names as $n) {
        $v = getenv($n) ?: ($_ENV[$n] ?? '');
        if (trim((string)$v) !== '') return trim((string)$v);
    }
    return '';
}

section('0. Credential + environment');

if ($providerId !== '') {
    $stmt = $db->prepare("SELECT id, name, api_base_url, api_key_encrypted FROM ai_providers WHERE id = ?");
    $stmt->execute([$providerId]);
    $prow = $stmt->fetch();
    if (!$prow) exit("ไม่พบ provider '$providerId' ใน ai_providers\n");

    $BASE    = rtrim($prow['api_base_url'], '/');
    $envKey  = envKeyFor($providerId);
    $dbKey   = trim(decryptApiKey((string)$prow['api_key_encrypted']));
    $KEY     = $envKey !== '' ? $envKey : $dbKey;
    $keySrc  = $envKey !== '' ? 'env override' : ($dbKey !== '' ? 'ai_providers (decrypted)' : 'NONE');

    echo "  mode            : --provider={$prow['id']} ({$prow['name']})\n";
    echo "  base_url        : $BASE\n";
    echo "  key source      : $keySrc\n";
    echo "  api_key         : " . ($KEY !== '' ? 'present (len=' . strlen($KEY) . ', prefix=' . substr($KEY, 0, 10) . '...)' : 'MISSING') . "\n";
    if ($envKey === '' && $dbKey === '') {
        echo "  hint            : key ใน DB ถอดรหัสไม่ออก — ส่งผ่าน env แทน เช่น\n";
        echo "                    OPENROUTER_API_KEY=sk-or-... php scripts/spike-verify-web-search.php --provider=$providerId\n";
    }
} else {
    $creds = resolveAICreds($db, 'ai_content_text_model_id', 'tenant-default');
    $BASE  = $creds['base_url'];
    $KEY   = $creds['api_key'];
    echo "  mode            : resolveAICreds() (path เดิมของแอป)\n";
    echo "  base_url        : {$creds['base_url']}\n";
    echo "  api_key         : " . ($KEY !== '' ? 'present (len=' . strlen($KEY) . ', prefix=' . substr($KEY, 0, 10) . '...)' : 'MISSING') . "\n";
    echo "  default model   : {$creds['model']}  (ไม่ใช่ search model — spike จะ override)\n";
    echo "  KILO_API_TOKEN  : " . (KILO_API_TOKEN !== '' ? 'set (len=' . strlen(KILO_API_TOKEN) . ')' : 'not set in env') . "\n";
}

echo "  AI_SSL_VERIFY   : " . (AI_SSL_VERIFY ? 'true' : 'false') . "\n";
echo "  today (app tz)  : " . date('Y-m-d H:i') . " (" . date_default_timezone_get() . ")\n";
echo "  raw log dir     : $LOG_DIR\n";

if ($KEY === '') {
    exit("\nไม่มี API key — หยุด spike\n");
}

$TODAY = date('Y-m-d');
$IS_OPENROUTER = str_contains($BASE, 'openrouter.ai');

// ---------------------------------------------------------------------------
// 1. Preflight — แยก "key พัง" ออกจาก "เครดิตหมด" ก่อนยิงโมเดลเสียเงิน
// ---------------------------------------------------------------------------
if (in_array('1', $sections, true)) {
    section('1. Preflight — credential + credit');

    if ($IS_OPENROUTER) {
        // OpenRouter มี /key ที่คืน balance/limit โดยไม่คิดเงิน — เช็คก่อนกัน 402 ซ้ำรอย kilo
        $ch = curl_init(rtrim($BASE, '/') . '/key');
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER     => ['Authorization: Bearer ' . $KEY],
            CURLOPT_TIMEOUT        => 30,
            CURLOPT_SSL_VERIFYPEER => AI_SSL_VERIFY,
        ]);
        $out  = (string)curl_exec($ch);
        $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        echo "  GET /key -> HTTP $code\n";
        $j = json_decode($out, true)['data'] ?? null;
        if ($j) {
            printf("     label=%s usage=%s limit=%s limit_remaining=%s is_free_tier=%s\n",
                $j['label'] ?? '?', $j['usage'] ?? '?',
                $j['limit'] ?? 'unlimited', $j['limit_remaining'] ?? 'n/a',
                isset($j['is_free_tier']) ? var_export($j['is_free_tier'], true) : '?');
            echo "     => key ใช้ได้ ยิง sonar ต่อได้\n";
        } else {
            echo "     " . mb_strimwidth($out, 0, 400, '...') . "\n";
            echo "     => key ไม่ผ่าน ตรวจ key ก่อนยิงต่อ\n";
        }
    } else {
        $res = gatewayCall('preflight-free', $BASE, $KEY, 'kilo-auto/free',
            [['role' => 'user', 'content' => 'ตอบคำเดียว: ok']]);
        callSummary('kilo-auto/free', $res);
        echo $res['http'] === 200
            ? "     => key + base_url ใช้ได้จริง ปัญหาอยู่ที่เครดิตของโมเดลแบบเสียเงินเท่านั้น\n"
            : "     => free model ก็ไม่ผ่าน ต้องตรวจ key/base_url ก่อน\n";
    }
}

// ---------------------------------------------------------------------------
// 2. Verify model string
// ---------------------------------------------------------------------------
$modelResults = [];
if (in_array('2', $sections, true)) {
    section('2. Verify model string (perplexity/sonar vs perplexity/sonar-pro-search)');
    $probe = [['role' => 'user', 'content' => 'ตอบสั้น ๆ หนึ่งประโยค: วันนี้วันที่เท่าไหร่ตามแหล่งข้อมูลบนเว็บ']];

    foreach (['perplexity/sonar', 'perplexity/sonar-pro-search'] as $model) {
        $res = gatewayCall("model-$model", $BASE, $KEY, $model, $probe);
        $modelResults[$model] = $res;
        callSummary($model, $res);
    }

    // 2.3 alias หรือคนละโมเดล — ดูจาก model ที่ gateway echo กลับ + usage
    echo "\n  -- 2.3 เปรียบเทียบ --\n";
    foreach ($modelResults as $m => $r) {
        printf("     %-30s http=%-3s echoed=%-30s total_tokens=%s\n", $m, $r['http'] ?: 'ERR',
            $r['data']['model'] ?? '(none)', $r['data']['usage']['total_tokens'] ?? '?');
    }
}

// ---------------------------------------------------------------------------
// 3. Verify real web search
// ---------------------------------------------------------------------------
if (in_array('3', $sections, true)) {
    section('3. Verify real web search (time-bound query vs control query)');
    $model = getenv('SPIKE_MODEL') ?: 'perplexity/sonar';
    echo "  ใช้ model: $model (override ได้ด้วย env SPIKE_MODEL)\n\n";

    // 3.1 query ผูกเวลาปัจจุบัน
    $live = gatewayCall('live-news', $BASE, $KEY, $model, [[
        'role' => 'user',
        'content' => "วันนี้คือ $TODAY ขอข่าวเทคโนโลยีของไทย 3 ข่าวที่เผยแพร่ภายใน 24 ชั่วโมงล่าสุด "
                   . "ระบุหัวข้อข่าว วันที่เผยแพร่ และ URL ต้นทางของแต่ละข่าวให้ครบ",
    ]]);
    callSummary('3.1 live query', $live);
    reportCitations($live);          // 3.2

    // 3.3 control: ตอบได้จาก knowledge ไม่ต้อง search
    echo "\n";
    $control = gatewayCall('control-knowledge', $BASE, $KEY, $model, [[
        'role' => 'user',
        'content' => 'ตอบสั้น ๆ หนึ่งประโยค: น้ำบริสุทธิ์เดือดที่กี่องศาเซลเซียสที่ระดับน้ำทะเล',
    ]]);
    callSummary('3.3 control query', $control);
    reportCitations($control, 0);
}

// ---------------------------------------------------------------------------
// 4. Verify mandatory search params
// ---------------------------------------------------------------------------
if (in_array('4', $sections, true)) {
    section('4. Param matrix — อะไรเป็นตัวเปิด web search');
    $model  = getenv('SPIKE_MODEL') ?: 'perplexity/sonar';
    $prompt = "วันนี้คือ $TODAY ข่าวเทคโนโลยีไทย 2 ข่าวล่าสุดพร้อม URL ต้นทางและวันที่เผยแพร่";

    $matrix = [
        'A-no-param'            => ['msgs' => [['role' => 'user', 'content' => $prompt]], 'extra' => []],
        'B-web_search_options'  => ['msgs' => [['role' => 'user', 'content' => $prompt]], 'extra' => ['web_search_options' => ['search_context_size' => 'medium']]],
        'C-search_recency'      => ['msgs' => [['role' => 'user', 'content' => $prompt]], 'extra' => ['search_recency_filter' => 'day']],
        'D-prompt-only'         => ['msgs' => [
            ['role' => 'system', 'content' => 'You MUST search the web before answering and cite every source URL you used.'],
            ['role' => 'user',   'content' => $prompt],
        ], 'extra' => []],
    ];

    foreach ($matrix as $name => $cfg) {
        $res = gatewayCall("param-$name", $BASE, $KEY, $model, $cfg['msgs'], $cfg['extra']);
        callSummary($name, $res);
        reportCitations($res, 1);
        echo "\n";
    }
}

// ---------------------------------------------------------------------------
// 5. Verify credential path (DB ai_providers -> env fallback)
// ---------------------------------------------------------------------------
if (in_array('5', $sections, true)) {
    section('5. Credential path');
    $model    = getenv('SPIKE_MODEL') ?: 'perplexity/sonar';
    $ping     = [['role' => 'user', 'content' => 'ตอบคำเดียว: ok']];
    $targetId = $providerId !== '' ? $providerId : 'provider-kilo';

    // 5.1 key จาก ai_providers ของ provider ที่ Research AI จะใช้จริง
    $stmt = $db->prepare("SELECT id, api_base_url, LENGTH(api_key_encrypted) AS klen, api_key_encrypted
                          FROM ai_providers WHERE id = ?");
    $stmt->execute([$targetId]);
    $row = $stmt->fetch();
    $dbKey = $row ? trim(decryptApiKey((string)$row['api_key_encrypted'])) : '';
    echo "  ai_providers[$targetId]: base={$row['api_base_url']} encrypted_key_len={$row['klen']}"
       . " decrypt=" . ($dbKey !== '' ? 'OK (len=' . strlen($dbKey) . ')' : 'FAILED/empty') . "\n";

    if ($dbKey !== '') {
        $viaDb = gatewayCall('cred-db', rtrim($row['api_base_url'], '/'), $dbKey, $model, $ping);
        callSummary('5.1 DB provider key', $viaDb);
    } else {
        echo "     ข้าม 5.1 — key ใน DB ถอดรหัสไม่ออก ต้องบันทึกคีย์ใหม่ผ่านหน้า Admin ก่อน\n";
        echo "     (รอบนี้ spike ใช้ key จาก env แทน จึงยังไม่พิสูจน์ path DB)\n";
    }

    // 5.2 env fallback — path นี้ผูกกับ provider: kilo ใช้ KILO_API_TOKEN, provider อื่นใช้ SPIKE_API_KEY/…
    echo "\n  -- 5.2 env fallback --\n";
    $envKey = envKeyFor($targetId);
    echo "     env key สำหรับ $targetId: " . ($envKey !== '' ? 'present (len=' . strlen($envKey) . ')' : 'ไม่ได้ตั้ง') . "\n";
    if ($envKey !== '') {
        $viaEnv = gatewayCall('cred-env', $BASE, $envKey, $model, $ping);
        callSummary('5.2 env fallback key', $viaEnv);
    } else {
        echo "     ทดสอบ path นี้ได้ด้วย: SPIKE_API_KEY=<key> php scripts/spike-verify-web-search.php 5 --provider=$targetId\n";
    }

    // เฉพาะสาย kilo: resolveAICreds() มี fallback ไป KILO_API_TOKEN ในตัว
    if ($targetId === 'provider-kilo') {
        $fallback = resolveAICreds($db, 'ai_content_text_model_id', '__spike_no_such_tenant__');
        echo "\n     resolveAICreds(tenant ที่ไม่มี provider) -> base={$fallback['base_url']} key="
           . ($fallback['api_key'] !== '' ? 'present (len=' . strlen($fallback['api_key']) . ')' : 'EMPTY') . "\n";
    }
}

echo "\nเสร็จ — raw response ทั้งหมดอยู่ที่ $LOG_DIR\n";
