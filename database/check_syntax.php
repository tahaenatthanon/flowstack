<?php
// Quick syntax check for new API files
$files = [
    __DIR__ . '/../api/calendar.php',
    __DIR__ . '/../api/personas.php',
];
$results = [];
foreach ($files as $f) {
    $output = [];
    $code = 0;
    exec("php -l " . escapeshellarg($f) . " 2>&1", $output, $code);
    $results[basename($f)] = ['ok' => $code === 0, 'msg' => implode(' ', $output)];
}
header('Content-Type: application/json');
echo json_encode($results, JSON_PRETTY_PRINT);
