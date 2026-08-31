<?php

function ai_research_required_fields(): array {
    return [
        'primary_keyword', 'secondary_keywords', 'intent', 'paa',
        'content_gaps', 'competitor_angles', 'outline', 'target_word_count', 'aeo_notes',
    ];
}

function ai_research_parse_json(string $raw): array {
    $clean = trim(preg_replace(['/^```(?:json)?\s*/m', '/\s*```\s*$/m'], '', $raw));
    $decoded = json_decode($clean, true);
    if (!is_array($decoded)) {
        if (preg_match('/\{.*\}/s', $clean, $match)) {
            $decoded = json_decode($match[0], true);
        }
    }
    if (!is_array($decoded)) {
        throw new RuntimeException('AI ส่ง Research brief ที่ไม่ใช่ JSON');
    }
    return $decoded;
}

function ai_research_validate_brief(array $brief, array $sourceKeywords): array {
    foreach (ai_research_required_fields() as $field) {
        if (!array_key_exists($field, $brief)) {
            throw new RuntimeException("Research brief ขาดฟิลด์ {$field}");
        }
    }
    if (!is_string($brief['primary_keyword']) || trim($brief['primary_keyword']) === '') {
        throw new RuntimeException('Research brief มี primary keyword ไม่ถูกต้อง');
    }
    foreach (['secondary_keywords', 'paa', 'content_gaps', 'competitor_angles', 'outline', 'aeo_notes'] as $field) {
        if (!is_array($brief[$field])) {
            throw new RuntimeException("Research brief ฟิลด์ {$field} ต้องเป็น array");
        }
    }
    if (!is_int($brief['target_word_count']) && !ctype_digit((string)$brief['target_word_count'])) {
        throw new RuntimeException('Research brief มี target word count ไม่ถูกต้อง');
    }

    $sourceMap = [];
    foreach ($sourceKeywords as $source) {
        $keyword = mb_strtolower(trim((string)($source['keyword'] ?? '')));
        if ($keyword !== '') $sourceMap[$keyword] = $source;
    }
    $primary = mb_strtolower(trim($brief['primary_keyword']));
    if (!isset($sourceMap[$primary])) {
        throw new RuntimeException('primary keyword ต้องมาจากข้อมูล Research');
    }

    $normalized = [];
    foreach ($brief['secondary_keywords'] as $entry) {
        if (is_string($entry)) $entry = ['keyword' => $entry];
        if (!is_array($entry) || trim((string)($entry['keyword'] ?? '')) === '') {
            throw new RuntimeException('secondary keyword มีรูปแบบไม่ถูกต้อง');
        }
        $keyword = mb_strtolower(trim((string)$entry['keyword']));
        if (!isset($sourceMap[$keyword])) {
            throw new RuntimeException('secondary keyword ต้องมาจากข้อมูล Research');
        }
        $source = $sourceMap[$keyword];
        foreach (['search_volume', 'difficulty'] as $metric) {
            if (array_key_exists($metric, $entry) && $entry[$metric] !== null &&
                (string)$entry[$metric] !== (string)($source[$metric] ?? null)) {
                throw new RuntimeException("ค่า {$metric} ของ keyword {$entry['keyword']} ไม่ตรงกับ Research");
            }
            $entry[$metric] = $source[$metric] ?? null;
        }
        $entry['keyword'] = trim((string)$entry['keyword']);
        $normalized[] = $entry;
    }
    $brief['primary_keyword'] = trim($brief['primary_keyword']);
    $brief['target_word_count'] = (int)$brief['target_word_count'];
    $brief['secondary_keywords'] = $normalized;
    return $brief;
}

function ai_research_chat(PDO $db, string $tenantId, string $systemPrompt, string $userPrompt): string {
    $creds = resolveAICreds($db, 'ai_content_text_model_id', $tenantId);
    if (empty($creds['api_key'])) {
        throw new RuntimeException('ไม่มี AI API Key — ตั้งค่า API Key ใน Admin > AI Settings ก่อน');
    }
    $payload = [
        'model' => $creds['model'],
        'messages' => [
            ['role' => 'system', 'content' => $systemPrompt],
            ['role' => 'user', 'content' => $userPrompt],
        ],
        'max_tokens' => $creds['max_tokens'],
        'stream' => false,
    ];
    $ch = curl_init(rtrim($creds['base_url'], '/') . '/chat/completions');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'Authorization: Bearer ' . $creds['api_key']],
        CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        CURLOPT_TIMEOUT => $creds['timeout'],
        CURLOPT_CONNECTTIMEOUT => 20,
        CURLOPT_SSL_VERIFYPEER => defined('AI_SSL_VERIFY') ? AI_SSL_VERIFY : true,
    ]);
    $raw = curl_exec($ch);
    $error = curl_error($ch);
    $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($raw === false) throw new RuntimeException('เรียก AI ไม่สำเร็จ: ' . $error);
    $response = json_decode($raw, true);
    if ($status >= 400 || !is_array($response) || !empty($response['error'])) {
        $message = is_array($response['error'] ?? null) ? ($response['error']['message'] ?? '') : ($response['error'] ?? '');
        throw new RuntimeException('AI provider error: ' . (string)$message);
    }
    $content = $response['choices'][0]['message']['content'] ?? $response['choices'][0]['message']['reasoning'] ?? '';
    if (!is_string($content) || trim($content) === '') throw new RuntimeException('AI ไม่คืน Research brief');
    return $content;
}

