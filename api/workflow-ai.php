<?php
require_once __DIR__ . '/auth.php';

$user = requireAuth();
$tenantId = $user['tenant_id'];
$db = getDB();
if (getMethod() !== 'POST') jsonError('Method not allowed', 405);

$body          = json_decode(file_get_contents('php://input'), true);
$definition_id = $body['definition_id'] ?? null;
if (!$definition_id) jsonError('definition_id required', 400);

$defStmt = $db->prepare('SELECT name, entity_type, definition FROM workflow_definitions WHERE id = ? AND tenant_id = ?');
$defStmt->execute([$definition_id, $tenantId]);
$def = $defStmt->fetch(PDO::FETCH_ASSOC);
if (!$def) jsonError('Workflow not found', 404);

$stmt = $db->prepare('
    SELECT wsl.step_id, wsl.step_name,
        AVG(wsl.duration_minutes) avg_minutes,
        SUM(CASE WHEN wsl.status=\'in_progress\' THEN 1 ELSE 0 END) queue_depth
    FROM workflow_step_logs wsl
    JOIN workflow_instances wi ON wsl.instance_id = wi.id
    WHERE wi.workflow_definition_id = ? AND wsl.started_at >= DATE_SUB(NOW(), INTERVAL 90 DAY)
    GROUP BY wsl.step_id, wsl.step_name
');
$stmt->execute([$definition_id]);
$stepStats = $stmt->fetchAll(PDO::FETCH_ASSOC);

$defData = json_decode($def['definition'], true);
$nodeMap = [];
foreach ($defData['nodes'] as $n) { $nodeMap[$n['id']] = $n; }

$stepSummary = '';
foreach ($stepStats as $s) {
    $sla          = (int)($nodeMap[$s['step_id']]['data']['slaMinutes'] ?? 1440);
    $avg          = round((float)$s['avg_minutes'], 0);
    $stepSummary .= "- {$s['step_name']}: avg {$avg} min (SLA: {$sla} min), pending: {$s['queue_depth']}\n";
}

$aiProvider = $db->prepare("
    SELECT ap.api_base_url, ap.api_key_encrypted
    FROM ai_providers ap
    JOIN company_settings cs ON ap.id = cs.ai_active_provider_id
    WHERE cs.tenant_id = ?
");
$aiProvider->execute([$tenantId]);
$providerRow = $aiProvider->fetch(PDO::FETCH_ASSOC);

if (!$providerRow || empty($providerRow['api_key_encrypted'])) {
    jsonError('AI provider not configured', 503);
}

$providerRow['api_key']  = decryptApiKey($providerRow['api_key_encrypted']);
$providerRow['base_url'] = rtrim($providerRow['api_base_url'] ?: 'https://api.kilo.ai/api/gateway', '/');

$modelStmt = $db->prepare("
    SELECT m.model_id
    FROM ai_models m
    JOIN company_settings cs ON m.id = cs.ai_default_model_id
    WHERE cs.tenant_id = ?
");
$modelStmt->execute([$tenantId]);
$model = $modelStmt->fetchColumn() ?: 'kilo-auto/balanced';

$prompt = "You are a Business Process Expert. Analyze workflow \"{$def['name']}\" (entity: {$def['entity_type']}) from last 90 days data:\n\nStep performance:\n{$stepSummary}\n\nReply ONLY as a JSON array (no other text):\n[{\"type\":\"quick_fix\"|\"process_improvement\",\"step_id\":\"step id or null\",\"title\":\"Thai title\",\"description\":\"Thai description\",\"impact\":\"Thai expected impact\"}]";

$payload = ['model' => $model, 'messages' => [['role' => 'user', 'content' => $prompt]]];
$ch = curl_init($providerRow['base_url'] . '/chat/completions');
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST           => true,
    CURLOPT_POSTFIELDS     => json_encode($payload),
    CURLOPT_HTTPHEADER     => ['Content-Type: application/json', 'Authorization: Bearer ' . $providerRow['api_key']],
    CURLOPT_TIMEOUT        => 60,
]);
$resp = curl_exec($ch);
curl_close($ch);

$data            = json_decode($resp, true);
$content         = $data['choices'][0]['message']['content'] ?? '[]';
$recommendations = json_decode(trim($content), true) ?: [];

jsonResponse(['recommendations' => $recommendations]);
