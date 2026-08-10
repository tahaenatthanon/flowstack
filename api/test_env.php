<?php
header('Content-Type: application/json');
echo json_encode([
    'token_exists' => !empty(getenv('KILO_API_TOKEN')),
    'token_value_preview' => substr(getenv('KILO_API_TOKEN'), 0, 10) . '...'
]);
