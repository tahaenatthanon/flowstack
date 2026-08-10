<?php
header('Content-Type: application/json');
echo json_encode([
    'success' => true, 
    'message' => 'PHP is working',
    'request_uri' => $_SERVER['REQUEST_URI'] ?? 'not set',
    'script_name' => $_SERVER['SCRIPT_NAME'] ?? 'not set'
]);
