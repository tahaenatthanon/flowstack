<?php
// DataForSEO + AI adapters for Content Research. This file has no database side effects.
// AI adapter (research_fetch_ai / research_test_ai) reuses constants verified in
// openspec/specs/ai-research-web-search (see docs/ai-research-web-search-verification.md).

if (!defined('RESEARCH_AI_MODEL')) {
    define('RESEARCH_AI_MODEL', 'perplexity/sonar');
    define('RESEARCH_AI_BASE_URL', 'https://openrouter.ai/api/v1');
    define('RESEARCH_AI_PROVIDER_ID', 'provider-openrouter');
    define('RESEARCH_AI_ENV_KEY', 'OPENROUTER_API_KEY');
}

if (!function_exists('research_dataforseo_request')) {
    function research_dataforseo_request(string $path, string $login, string $password, array $payload = [], string $method = 'POST'): array {
        $url = 'https://api.dataforseo.com' . $path;
        $ch = curl_init($url);
        if ($ch === false) {
            throw new RuntimeException('ไม่สามารถเริ่มการเชื่อมต่อ DataForSEO ได้');
        }

        $headers = [
            'Authorization: Basic ' . base64_encode($login . ':' . $password),
            'Accept: application/json',
            'Content-Type: application/json',
        ];
        $options = [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CUSTOMREQUEST => $method,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_CONNECTTIMEOUT => 15,
            CURLOPT_TIMEOUT => 60,
            CURLOPT_SSL_VERIFYPEER => defined('AI_SSL_VERIFY') ? AI_SSL_VERIFY : true,
            CURLOPT_SSL_VERIFYHOST => (defined('AI_SSL_VERIFY') && AI_SSL_VERIFY) ? 2 : 0,
        ];
        if ($method !== 'GET') {
            $options[CURLOPT_POSTFIELDS] = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        }
        curl_setopt_array($ch, $options);
        $body = curl_exec($ch);
        $curlError = curl_error($ch);
        $httpCode = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($body === false || $curlError !== '') {
            throw new RuntimeException('DataForSEO ไม่ตอบสนอง: ' . ($curlError ?: 'ไม่ทราบสาเหตุ'));
        }
        $decoded = json_decode($body, true);
        if (!is_array($decoded)) {
            throw new RuntimeException('DataForSEO ส่งข้อมูลที่อ่านไม่ได้กลับมา');
        }
        $statusCode = (int)($decoded['status_code'] ?? 0);
        if ($httpCode < 200 || $httpCode >= 300 || ($statusCode !== 0 && $statusCode !== 20000)) {
            $message = (string)($decoded['status_message'] ?? 'คำขอ DataForSEO ไม่สำเร็จ');
            throw new RuntimeException($message);
        }
        return $decoded;
    }
}

if (!function_exists('research_task_results')) {
    function research_task_results(array $response): array {
        $tasks = $response['tasks'] ?? [];
        if (!is_array($tasks) || !$tasks) return [];
        $task = $tasks[0] ?? [];
        $taskStatus = (int)($task['status_code'] ?? 0);
        if ($taskStatus !== 0 && $taskStatus !== 20000) {
            throw new RuntimeException((string)($task['status_message'] ?? 'DataForSEO task ไม่สำเร็จ'));
        }
        $result = $task['result'] ?? [];
        return is_array($result) ? $result : [];
    }
}

if (!function_exists('research_task_cost')) {
    function research_task_cost(array $response): float {
        $cost = 0.0;
        foreach (($response['tasks'] ?? []) as $task) {
            if (isset($task['cost']) && is_numeric($task['cost'])) $cost += (float)$task['cost'];
        }
        return $cost;
    }
}

if (!function_exists('research_item_keyword')) {
    function research_item_keyword(array $item): string {
        return trim((string)($item['keyword'] ?? $item['title'] ?? ''));
    }
}

if (!function_exists('research_normalize_serp')) {
    function research_normalize_serp(array $response): array {
        $organic = [];
        $paa = [];
        $related = [];
        foreach (research_task_results($response) as $result) {
            foreach (($result['items'] ?? []) as $item) {
                if (!is_array($item)) continue;
                $type = strtolower((string)($item['type'] ?? ''));
                if ($type === 'organic' || isset($item['url'])) {
                    $organic[] = [
                        'position' => isset($item['rank_absolute']) ? (int)$item['rank_absolute'] : null,
                        'title' => trim((string)($item['title'] ?? '')),
                        'description' => trim((string)($item['description'] ?? '')),
                        'url' => trim((string)($item['url'] ?? '')),
                    ];
                }
                if ($type === 'people_also_ask') {
                    foreach (($item['items'] ?? []) as $question) {
                        $questionText = trim((string)($question['title'] ?? $question['question'] ?? ''));
                        if ($questionText !== '') $paa[] = ['question' => $questionText, 'url' => trim((string)($question['url'] ?? ''))];
                    }
                }
                if ($type === 'related_searches') {
                    foreach (($item['items'] ?? []) as $search) {
                        $text = trim((string)($search['title'] ?? $search['keyword'] ?? $search));
                        if ($text !== '') $related[] = $text;
                    }
                }
            }
            foreach (($result['people_also_ask'] ?? []) as $question) {
                $text = trim((string)($question['question'] ?? $question['title'] ?? $question));
                if ($text !== '') $paa[] = ['question' => $text, 'url' => ''];
            }
            foreach (($result['related_searches'] ?? []) as $search) {
                $text = trim((string)($search['keyword'] ?? $search['title'] ?? $search));
                if ($text !== '') $related[] = $text;
            }
        }
        return [
            'organic' => array_slice($organic, 0, 20),
            'people_also_ask' => array_values(array_unique($paa, SORT_REGULAR)),
            'related_searches' => array_values(array_unique($related)),
        ];
    }
}

if (!function_exists('research_normalize_suggestions')) {
    function research_normalize_suggestions(array $response): array {
        $keywords = [];
        foreach (research_task_results($response) as $result) {
            foreach (($result['items'] ?? []) as $item) {
                if (!is_array($item)) continue;
                $keyword = research_item_keyword($item);
                if ($keyword === '') continue;
                $properties = is_array($item['keyword_properties'] ?? null) ? $item['keyword_properties'] : [];
                $intentInfo = is_array($item['search_intent_info'] ?? null) ? $item['search_intent_info'] : [];
                $keywords[] = [
                    'keyword' => $keyword,
                    'search_volume' => null,
                    'competition' => null,
                    'cpc' => null,
                    'difficulty' => isset($properties['keyword_difficulty']) && is_numeric($properties['keyword_difficulty']) ? (int)$properties['keyword_difficulty'] : null,
                    'intent' => trim((string)($intentInfo['main_intent'] ?? $intentInfo['foreign_intent'] ?? '')) ?: null,
                    'source' => 'suggestion',
                ];
            }
        }
        return $keywords;
    }
}

if (!function_exists('research_normalize_volume')) {
    function research_normalize_volume(array $response): array {
        $keywords = [];
        foreach (research_task_results($response) as $result) {
            foreach (($result['items'] ?? []) as $item) {
                if (!is_array($item)) continue;
                $keyword = research_item_keyword($item);
                if ($keyword === '') continue;
                $keywords[] = [
                    'keyword' => $keyword,
                    'search_volume' => isset($item['search_volume']) && is_numeric($item['search_volume']) ? (int)$item['search_volume'] : null,
                    'competition' => isset($item['competition']) && is_numeric($item['competition']) ? (float)$item['competition'] : null,
                    'cpc' => isset($item['cpc']) && is_numeric($item['cpc']) ? (float)$item['cpc'] : null,
                    'difficulty' => isset($item['keyword_difficulty']) && is_numeric($item['keyword_difficulty']) ? (int)$item['keyword_difficulty'] : null,
                    'intent' => null,
                    'source' => 'suggestion',
                ];
            }
        }
        return $keywords;
    }
}

if (!function_exists('research_merge_keywords')) {
    function research_merge_keywords(string $seed, array $suggestions, array $volume, array $serp): array {
        $merged = [];
        $add = static function (array $row) use (&$merged): void {
            $keyword = trim((string)($row['keyword'] ?? ''));
            if ($keyword === '') return;
            $key = function_exists('mb_strtolower') ? mb_strtolower($keyword, 'UTF-8') : strtolower($keyword);
            if (!isset($merged[$key])) {
                $merged[$key] = [
                    'keyword' => $keyword, 'search_volume' => null, 'competition' => null,
                    'cpc' => null, 'difficulty' => null, 'intent' => null,
                    'source' => $row['source'] ?? 'suggestion',
                ];
            }
            foreach (['search_volume','competition','cpc','difficulty','intent'] as $field) {
                if ($merged[$key][$field] === null && array_key_exists($field, $row) && $row[$field] !== null) $merged[$key][$field] = $row[$field];
            }
        };
        $add(['keyword' => $seed, 'source' => 'seed']);
        foreach ($suggestions as $row) $add($row);
        foreach ($volume as $row) $add($row);
        foreach (($serp['related_searches'] ?? []) as $row) $add(['keyword' => $row, 'source' => 'related']);
        foreach (($serp['people_also_ask'] ?? []) as $row) $add(['keyword' => $row['question'] ?? '', 'source' => 'paa']);
        return array_values($merged);
    }
}

if (!function_exists('research_test_dataforseo')) {
    function research_test_dataforseo(string $login, string $password): array {
        $response = research_dataforseo_request('/v3/appendix/user_data', $login, $password, [], 'GET');
        $result = research_task_results($response);
        $data = $result[0] ?? [];
        return [
            'ok' => true,
            'balance_usd' => isset($data['money']['balance']) && is_numeric($data['money']['balance']) ? (float)$data['money']['balance'] : null,
            'cost_usd' => research_task_cost($response),
        ];
    }
}

if (!function_exists('research_fetch_dataforseo')) {
    function research_fetch_dataforseo(string $login, string $password, string $seed, int $locationCode, string $languageCode): array {
        $baseTask = ['keyword' => $seed, 'location_code' => $locationCode, 'language_code' => $languageCode];
        $serpResponse = research_dataforseo_request('/v3/serp/google/organic/live/advanced', $login, $password, [[
            ...$baseTask, 'device' => 'desktop', 'os' => 'windows', 'depth' => 20,
        ]]);
        $suggestionResponse = research_dataforseo_request('/v3/dataforseo_labs/google/keyword_suggestions/live', $login, $password, [[
            ...$baseTask, 'limit' => 50,
        ]]);
        $serp = research_normalize_serp($serpResponse);
        $suggestions = research_normalize_suggestions($suggestionResponse);
        $candidateNames = [$seed];
        foreach ($suggestions as $row) $candidateNames[] = $row['keyword'];
        foreach ($serp['related_searches'] as $row) $candidateNames[] = $row;
        foreach ($serp['people_also_ask'] as $row) $candidateNames[] = $row['question'];
        $candidateNames = array_values(array_unique(array_filter(array_map('trim', $candidateNames))));
        $volumeResponse = research_dataforseo_request('/v3/keywords_data/google_ads/search_volume/live', $login, $password, [[
            'keywords' => array_slice($candidateNames, 0, 100), 'location_code' => $locationCode, 'language_code' => $languageCode,
        ]]);
        $volume = research_normalize_volume($volumeResponse);
        return [
            'ok' => true,
            'error' => null,
            'cost_usd' => research_task_cost($serpResponse) + research_task_cost($suggestionResponse) + research_task_cost($volumeResponse),
            'serp' => $serp,
            'keywords' => research_merge_keywords($seed, $suggestions, $volume, $serp),
            'raw' => ['serp' => $serpResponse, 'suggestions' => $suggestionResponse, 'volume' => $volumeResponse],
        ];
    }
}

// ---------------------------------------------------------------------------
// AI adapter (OpenRouter / perplexity-sonar) — คู่ขนานกับ DataForSEO adapter
// คืน shape กลางเดียวกัน { serp, keywords, raw, cost_usd } เพื่อให้ dispatch
// (content-research.php, Phase 3) ใช้ provider='ai' ได้โดยไม่รู้โครงสร้าง gateway
// ---------------------------------------------------------------------------

if (!function_exists('research_resolve_ai_creds')) {
    /**
     * Resolve Research AI credential จาก ai_providers[provider-openrouter] → env fallback
     * ไม่ใช้ resolveAICreds() เพราะตัวนั้นผูก company_settings (ยังชี้ provider-kilo / writing model)
     */
    function research_resolve_ai_creds(PDO $db): array {
        $apiKey = '';
        $baseUrl = RESEARCH_AI_BASE_URL;
        try {
            $stmt = $db->prepare('SELECT api_base_url, api_key_encrypted FROM ai_providers WHERE id = ?');
            $stmt->execute([RESEARCH_AI_PROVIDER_ID]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            if ($row && !empty($row['api_key_encrypted'])) {
                $plain = trim(decryptApiKey((string)$row['api_key_encrypted']));
                if ($plain !== '') {
                    $apiKey = $plain;
                    if (!empty($row['api_base_url'])) $baseUrl = rtrim((string)$row['api_base_url'], '/');
                }
            }
        } catch (Throwable $e) {
            error_log('[research_resolve_ai_creds] ' . $e->getMessage());
        }
        if ($apiKey === '') {
            $env = getenv(RESEARCH_AI_ENV_KEY) ?: ($_ENV[RESEARCH_AI_ENV_KEY] ?? '');
            if (trim((string)$env) !== '') $apiKey = trim((string)$env);
        }
        if ($apiKey === '') {
            throw new RuntimeException('ไม่มี API Key ของ Research AI — ตั้งค่า provider-openrouter หรือ ' . RESEARCH_AI_ENV_KEY . ' ก่อน');
        }
        return ['api_key' => $apiKey, 'base_url' => $baseUrl];
    }
}

if (!function_exists('research_ai_chat')) {
    /**
     * ยิง /chat/completions แบบ OpenAI-compatible ด้วย payload ขั้นต่ำ
     * {model, messages, stream:false, max_tokens} — ไม่มี param บังคับ search
     */
    function research_ai_chat(string $baseUrl, string $apiKey, string $model, array $messages, int $maxTokens): array {
        $payload = [
            'model' => $model,
            'messages' => $messages,
            'stream' => false,
            'max_tokens' => $maxTokens,
        ];
        $ch = curl_init(rtrim($baseUrl, '/') . '/chat/completions');
        if ($ch === false) throw new RuntimeException('ไม่สามารถเริ่มการเชื่อมต่อ Research AI ได้');
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'Authorization: Bearer ' . $apiKey],
            CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            CURLOPT_CONNECTTIMEOUT => 15,
            CURLOPT_TIMEOUT => 90,
            CURLOPT_SSL_VERIFYPEER => defined('AI_SSL_VERIFY') ? AI_SSL_VERIFY : true,
        ]);
        $body = curl_exec($ch);
        $curlError = curl_error($ch);
        $httpCode = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($body === false || $curlError !== '') {
            throw new RuntimeException('Research AI ไม่ตอบสนอง: ' . ($curlError ?: 'ไม่ทราบสาเหตุ'));
        }
        $decoded = json_decode($body, true);
        if (!is_array($decoded)) {
            throw new RuntimeException('Research AI ส่งข้อมูลที่อ่านไม่ได้กลับมา');
        }
        if ($httpCode >= 400 || !empty($decoded['error'])) {
            $message = is_array($decoded['error'] ?? null) ? (string)($decoded['error']['message'] ?? '') : (string)($decoded['error'] ?? '');
            throw new RuntimeException('Research AI ปฏิเสธคำขอ' . ($message !== '' ? ': ' . $message : ''));
        }
        return $decoded;
    }
}

if (!function_exists('research_parse_ai_json')) {
    /** strip markdown fence + regex หา {...} block เหมือน ai_research_parse_json() */
    function research_parse_ai_json(string $raw): array {
        $clean = trim(preg_replace(['/^```(?:json)?\s*/m', '/\s*```\s*$/m'], '', $raw));
        $decoded = json_decode($clean, true);
        if (!is_array($decoded)) {
            if (preg_match('/\{[\s\S]*\}/', $clean, $match)) {
                $decoded = json_decode($match[0], true);
            }
        }
        if (!is_array($decoded)) {
            throw new RuntimeException('Research AI ไม่ได้คืน JSON ที่อ่านได้');
        }
        return $decoded;
    }
}

if (!function_exists('research_normalize_ai')) {
    /**
     * แปลง structured JSON จาก AI → shape กลาง { serp, keywords, raw }
     * metric ปริมาณ (search_volume/competition/cpc/difficulty) เป็น null เสมอ — AI ไม่ให้ตัวเลข
     */
    function research_normalize_ai(array $decoded, string $seed): array {
        $organic = [];
        foreach (($decoded['organic'] ?? []) as $i => $item) {
            if (is_string($item)) {
                if (trim($item) !== '') $organic[] = ['position' => $i + 1, 'title' => trim($item), 'description' => '', 'url' => ''];
                continue;
            }
            if (!is_array($item)) continue;
            $title = trim((string)($item['title'] ?? $item['name'] ?? ''));
            $url = trim((string)($item['url'] ?? $item['link'] ?? ''));
            if ($title === '' && $url === '') continue;
            $organic[] = [
                'position' => isset($item['position']) && is_numeric($item['position']) ? (int)$item['position'] : $i + 1,
                'title' => $title,
                'description' => trim((string)($item['description'] ?? $item['snippet'] ?? '')),
                'url' => $url,
            ];
        }

        $paa = [];
        foreach (($decoded['people_also_ask'] ?? []) as $item) {
            if (is_string($item)) {
                if (trim($item) !== '') $paa[] = ['question' => trim($item), 'url' => ''];
                continue;
            }
            if (!is_array($item)) continue;
            $q = trim((string)($item['question'] ?? $item['title'] ?? ''));
            if ($q === '') continue;
            $paa[] = ['question' => $q, 'url' => trim((string)($item['url'] ?? ''))];
        }

        $related = [];
        foreach (($decoded['related_searches'] ?? []) as $item) {
            if (is_string($item)) $text = trim($item);
            elseif (is_array($item)) $text = trim((string)($item['keyword'] ?? $item['title'] ?? $item['query'] ?? ''));
            else continue;
            if ($text !== '') $related[] = $text;
        }

        $keywords = [];
        foreach (($decoded['keywords'] ?? []) as $item) {
            if (is_string($item)) { $kw = trim($item); $intent = ''; }
            elseif (is_array($item)) {
                $kw = trim((string)($item['keyword'] ?? ''));
                $intent = trim((string)($item['intent'] ?? ''));
            } else continue;
            if ($kw === '') continue;
            $keywords[] = [
                'keyword' => $kw,
                'search_volume' => null,
                'competition' => null,
                'cpc' => null,
                'difficulty' => null,
                'intent' => $intent !== '' ? $intent : null,
                'source' => 'ai_search',
            ];
        }

        return [
            'serp' => [
                'organic' => array_slice($organic, 0, 20),
                'people_also_ask' => array_values(array_unique($paa, SORT_REGULAR)),
                'related_searches' => array_values(array_unique($related)),
            ],
            'keywords' => $keywords,
            'raw' => ['serp' => $decoded],
        ];
    }
}

if (!function_exists('research_fetch_ai')) {
    /**
     * AI fetch: 1 chat call → structured JSON → normalize เป็น shape เดียวกับ DataForSEO
     * cost_usd เป็น null (AI fetch ไม่มี cost จาก provider ใน shape นี้)
     */
    function research_fetch_ai(PDO $db, string $seed, int $locationCode, string $languageCode): array {
        $creds = research_resolve_ai_creds($db);

        $systemPrompt = 'คุณเป็นนักวิเคราะห์ SEO/AEO ภาษาไทย ตอบเป็น JSON object เท่านั้น ไม่มี markdown fence ' .
            'ค้นข้อมูลจากเว็บจริง (real web search) และอ้าง URL ต้นทางจริง ห้ามเดาหรือใช้ความรู้เก่าแทนการค้น ' .
            'ห้ามใส่ค่าตัวเลข metric เช่น search_volume, competition, cpc, difficulty โดยเด็ดขาด';
        $userPrompt = 'ค้นข้อมูลจากเว็บจริงสำหรับ keyword: ' . $seed . "\n" .
            "คืน JSON object เท่านั้น มี field เหล่านี้:\n" .
            "organic: [{title, url, description}] รายการผลค้นจริงพร้อม URL ต้นทาง\n" .
            "people_also_ask: [{question, url}] คำถามที่คนถามบ่อย\n" .
            "related_searches: [string] คำค้นที่เกี่ยวข้อง\n" .
            "keywords: [{keyword, intent}] โดยรวม keyword หลักเป็นรายการแรก intent เป็น informational/commercial/transactional/navigational (ไม่มั่นใจใช้ null)\n" .
            "ห้ามใส่ search_volume, competition, cpc, difficulty";
        $messages = [
            ['role' => 'system', 'content' => $systemPrompt],
            ['role' => 'user', 'content' => $userPrompt],
        ];

        $response = research_ai_chat($creds['base_url'], $creds['api_key'], RESEARCH_AI_MODEL, $messages, 2048);
        $content = $response['choices'][0]['message']['content'] ?? '';
        if (!is_string($content) || trim($content) === '') {
            throw new RuntimeException('Research AI ไม่ได้คืนเนื้อหาการค้นหา');
        }
        $decoded = research_parse_ai_json($content);
        $normalized = research_normalize_ai($decoded, $seed);

        return [
            'ok' => true,
            'error' => null,
            'cost_usd' => null,
            'serp' => $normalized['serp'],
            'keywords' => research_merge_keywords($seed, $normalized['keywords'], [], $normalized['serp']),
            'raw' => $normalized['raw'],
        ];
    }
}

if (!function_exists('research_test_ai')) {
    /**
     * Probe สั้นด้วย credential + model ที่ยืนยันแล้ว — ไม่เปิดเผย credential
     * ไม่จำเป็นต้องคืน balance แบบ DataForSEO
     */
    function research_test_ai(PDO $db): array {
        try {
            $creds = research_resolve_ai_creds($db);
            $response = research_ai_chat($creds['base_url'], $creds['api_key'], RESEARCH_AI_MODEL, [
                ['role' => 'user', 'content' => 'ตอบสั้น ๆ ว่า OK เท่านั้น'],
            ], 16);
            $content = $response['choices'][0]['message']['content'] ?? '';
            if (!is_string($content) || trim($content) === '') {
                return ['ok' => false, 'message' => 'Research AI ไม่ตอบกลับ'];
            }
            return ['ok' => true];
        } catch (Throwable $e) {
            return ['ok' => false, 'message' => $e->getMessage()];
        }
    }
}
