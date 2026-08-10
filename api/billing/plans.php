<?php
// Public endpoint — returns plan pricing (no auth required for landing page use)
require_once __DIR__ . '/../config.php';
$db = getDB();
$stmt = $db->query("SELECT plan, max_users, price_thb, trial_days FROM plan_limits WHERE is_active = 1 ORDER BY FIELD(plan,'trial','starter','pro','enterprise')");
jsonResponse($stmt->fetchAll(PDO::FETCH_ASSOC));
