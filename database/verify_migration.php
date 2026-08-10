<?php
require_once __DIR__ . '/../api/config.php';
$db = getDB();
$tables = ['calendar_events','ai_personas','user_persona_preference','notification_settings','notification_log'];
$result = [];
foreach ($tables as $t) {
    $r = $db->query("SELECT COUNT(*) as cnt FROM `$t`")->fetch();
    $result[$t] = (int)$r['cnt'];
}
header('Content-Type: application/json');
echo json_encode($result, JSON_PRETTY_PRINT);
