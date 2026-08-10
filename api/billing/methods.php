<?php
require_once __DIR__ . '/../auth.php';
requireAuth();
$db = getDB();
$stmt = $db->query('SELECT * FROM payment_methods_config WHERE is_active = 1 ORDER BY sort_order');
jsonResponse($stmt->fetchAll(PDO::FETCH_ASSOC));
