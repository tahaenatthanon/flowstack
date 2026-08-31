<?php
// DataForSEO adapter for Content Research. This file has no database side effects.

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
