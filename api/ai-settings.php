<?php
// GET  /api/ai-settings.php  - Get active AI provider & default model + per-feature models
// PUT  /api/ai-settings.php  - Save AI settings (admin only)

require_once __DIR__ . '/auth.php';

$db = getDB();
$method = getMethod();

if ($method === 'GET') {
    $tokenData = requireAuth();
    $tenantId  = $tokenData['tenant_id'];

    $stmt = $db->prepare('
        SELECT
            cs.ai_active_provider_id,
            cs.ai_default_model_id,
            cs.ai_chat_model_id,
            cs.ai_chat_context_prompt,
            cs.ai_content_model_id,
            cs.ai_content_text_model_id,
            cs.ai_content_image_model_id,
            cs.ai_content_video_model_id,
            cs.ai_cardscan_model_id,
            cs.ai_analyst_model_id,
            cs.ai_lead_model_id,
            cs.ai_content_timeout,
            cs.ai_content_max_tokens,
            ap.name           AS provider_name,
            ap.display_name   AS provider_display_name,
            ap.api_base_url   AS provider_base_url,
            (ap.api_key_encrypted IS NOT NULL AND ap.api_key_encrypted != \'\') as provider_has_key,
            am.name           AS model_name,
            am.model_id       AS model_identifier,
            amch.name         AS chat_model_name,
            amct.name         AS content_text_model_name,
            amci.name         AS content_image_model_name,
            amcv.name         AS content_video_model_name
        FROM company_settings cs
        LEFT JOIN ai_providers ap ON ap.id = cs.ai_active_provider_id
        LEFT JOIN ai_models am   ON am.id  = cs.ai_default_model_id
        LEFT JOIN ai_models amch ON amch.id = cs.ai_chat_model_id
        LEFT JOIN ai_models amct ON amct.id = cs.ai_content_text_model_id
        LEFT JOIN ai_models amci ON amci.id = cs.ai_content_image_model_id
        LEFT JOIN ai_models amcv ON amcv.id = cs.ai_content_video_model_id
        WHERE cs.tenant_id = ?
    ');
    $stmt->execute([$tenantId]);
    $row = $stmt->fetch();

    jsonResponse($row ?: [
        'ai_active_provider_id'      => null,
        'ai_default_model_id'        => null,
        'ai_chat_model_id'           => null,
        'ai_chat_context_prompt'     => null,
        'ai_content_model_id'        => null,
        'ai_content_text_model_id'   => null,
        'ai_content_image_model_id'  => null,
        'ai_content_video_model_id'  => null,
        'ai_cardscan_model_id'       => null,
        'ai_analyst_model_id'        => null,
        'ai_lead_model_id'           => null,
        'ai_content_timeout'         => 300,
        'ai_content_max_tokens'      => 2048,
    ]);
}

if ($method === 'PUT') {
    $tokenData = requireAuth();
    $tenantId  = $tokenData['tenant_id'];
    requireAdmin($db, $tokenData['user_id'], $tenantId);

    $body = getRequestBody();

    $allowed = [
        'ai_active_provider_id',
        'ai_default_model_id',
        'ai_chat_model_id',
        'ai_chat_context_prompt',
        'ai_content_model_id',
        'ai_content_text_model_id',
        'ai_content_image_model_id',
        'ai_content_video_model_id',
        'ai_cardscan_model_id',
        'ai_analyst_model_id',
        'ai_lead_model_id',
        'ai_content_timeout',
        'ai_content_max_tokens',
    ];
    $setParts = [];
    $params = [];

    foreach ($allowed as $field) {
        if (array_key_exists($field, $body)) {
            $setParts[] = "`$field` = ?";
            $params[] = $body[$field] ?: null;
        }
    }

    if (empty($setParts)) {
        jsonError('No valid fields to update');
    }

    $sql = "UPDATE company_settings SET " . implode(', ', $setParts) . " WHERE tenant_id = ?";
    $params[] = $tenantId;
    $stmt = $db->prepare($sql);
    $stmt->execute($params);

    jsonResponse(['message' => 'AI settings saved']);
}

jsonError('Method not allowed', 405);
?>
