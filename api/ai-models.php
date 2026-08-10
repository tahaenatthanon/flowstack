<?php
// GET  /api/ai-models.php                 - List all AI models
// GET  /api/ai-models.php?provider={id}   - List models by provider
// POST /api/ai-models.php                 - Create AI model
// PUT  /api/ai-models.php?id={id}         - Update AI model
// DELETE /api/ai-models.php?id={id}       - Delete AI model

require_once __DIR__ . '/auth.php';

$db = getDB();
$method = getMethod();
$modelId = $_GET['id'] ?? null;
$providerId = $_GET['provider'] ?? null;

if ($method === 'GET') {
    $tokenData = requireAuth();

    if ($modelId) {
        // Get single model
        $stmt = $db->prepare('
            SELECT 
                am.*,
                ap.display_name as provider_name
            FROM ai_models am
            JOIN ai_providers ap ON ap.id = am.provider_id
            WHERE am.id = ? AND am.status != \'inactive\'
        ');
        $stmt->execute([$modelId]);
        $model = $stmt->fetch();

        if (!$model) {
            jsonError('Model not found', 404);
        }

        $model['features'] = $model['features'] ? json_decode($model['features'], true) : [];
        jsonResponse($model);
    } else if ($providerId) {
        // Get models by provider
        $stmt = $db->prepare('
            SELECT 
                am.*,
                ap.display_name as provider_name
            FROM ai_models am
            JOIN ai_providers ap ON ap.id = am.provider_id
            WHERE am.provider_id = ? AND am.status != \'inactive\'
            ORDER BY am.name ASC
        ');
        $stmt->execute([$providerId]);
        $models = $stmt->fetchAll();

        foreach ($models as &$model) {
            $model['features'] = $model['features'] ? json_decode($model['features'], true) : [];
        }

        jsonResponse(['models' => $models, 'total' => count($models)]);
    } else {
        // Get all active models
        $stmt = $db->prepare('
            SELECT 
                am.*,
                ap.display_name as provider_name,
                ap.icon as provider_icon
            FROM ai_models am
            JOIN ai_providers ap ON ap.id = am.provider_id
            WHERE am.status != \'inactive\' AND ap.is_active = 1
            ORDER BY ap.display_name ASC, am.name ASC
        ');
        $stmt->execute();
        $models = $stmt->fetchAll();

        foreach ($models as &$model) {
            $model['features'] = $model['features'] ? json_decode($model['features'], true) : [];
        }

        jsonResponse(['models' => $models, 'total' => count($models)]);
    }
}

if ($method === 'POST') {
    $tokenData = requireAuth();
    requireAdmin($db, $tokenData['user_id'], $tokenData['tenant_id']);

    $body = getRequestBody();

    $id = generateUUID();
    
    $stmt = $db->prepare('
        INSERT INTO ai_models (
            id, provider_id, model_id, name, description,
            context_window, max_output_tokens, input_price_per_1k, output_price_per_1k,
            supports_vision, supports_streaming, supports_function_calling, supports_tool_calling,
            status, features, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    ');

    $stmt->execute([
        $id,
        $body['provider_id'] ?? null,
        $body['model_id'] ?? '',
        $body['name'] ?? '',
        $body['description'] ?? '',
        $body['context_window'] ?? 4000,
        $body['max_output_tokens'] ?? 2000,
        $body['input_price_per_1k'] ?? 0,
        $body['output_price_per_1k'] ?? 0,
        $body['supports_vision'] ? 1 : 0,
        $body['supports_streaming'] ? 1 : 0,
        $body['supports_function_calling'] ? 1 : 0,
        $body['supports_tool_calling'] ? 1 : 0,
        'active',
        isset($body['features']) ? json_encode($body['features']) : json_encode([])
    ]);

    jsonResponse(['id' => $id, 'message' => 'Model created'], 201);
}

if ($method === 'PUT' && $modelId) {
    $tokenData = requireAuth();
    requireAdmin($db, $tokenData['user_id'], $tokenData['tenant_id']);

    $body = getRequestBody();

    $allowed = ['name', 'description', 'context_window', 'max_output_tokens', 
                'input_price_per_1k', 'output_price_per_1k', 'supports_vision', 
                'supports_streaming', 'supports_function_calling', 'supports_tool_calling', 'status', 'features'];
    $setParts = [];
    $params = [];

    foreach ($allowed as $field) {
        if (array_key_exists($field, $body)) {
            if ($field === 'features') {
                $setParts[] = "`$field` = ?";
                $params[] = is_array($body[$field]) ? json_encode($body[$field]) : $body[$field];
            } else if (in_array($field, ['supports_vision', 'supports_streaming', 'supports_function_calling', 'supports_tool_calling'])) {
                $setParts[] = "`$field` = ?";
                $params[] = $body[$field] ? 1 : 0;
            } else {
                $setParts[] = "`$field` = ?";
                $params[] = $body[$field];
            }
        }
    }

    if (empty($setParts)) {
        jsonError('No valid fields to update');
    }

    $params[] = $modelId;
    $sql = "UPDATE ai_models SET " . implode(', ', $setParts) . ", updated_at = NOW() WHERE id = ?";
    $stmt = $db->prepare($sql);
    $stmt->execute($params);

    jsonResponse(['message' => 'Model updated']);
}

if ($method === 'DELETE' && $modelId) {
    $tokenData = requireAuth();
    requireAdmin($db, $tokenData['user_id'], $tokenData['tenant_id']);

    $stmt = $db->prepare('UPDATE ai_models SET status = \'inactive\', updated_at = NOW() WHERE id = ?');
    $stmt->execute([$modelId]);

    jsonResponse(['message' => 'Model deleted']);
}

jsonError('Method not allowed', 405);
?>
