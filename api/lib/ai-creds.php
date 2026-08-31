<?php

/**
 * Resolve AI credentials and model settings for a tenant.
 * The returned array contains secrets for server-side use only.
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
    } catch (Throwable $e) {
        error_log('[resolveAICreds] ' . $e->getMessage());
    }

    if (!empty(KILO_API_TOKEN)) {
        $baseUrl = rtrim(KILO_API_BASE_URL ?: $fallbackBase, '/');
        return ['api_key' => KILO_API_TOKEN, 'base_url' => $baseUrl, 'model' => 'openai/gpt-4o-mini', 'timeout' => 300, 'max_tokens' => 8192];
    }
    return ['api_key' => '', 'base_url' => $fallbackBase, 'model' => 'openai/gpt-4o-mini', 'timeout' => 300, 'max_tokens' => 8192];
}

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

