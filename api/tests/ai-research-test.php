<?php

require_once __DIR__ . '/../lib/ai-research.php';

function test_assert(bool $condition, string $message): void {
    if (!$condition) throw new RuntimeException($message);
}

$source = [
    ['keyword' => 'วิธีทำคอนเทนต์', 'search_volume' => 1200, 'difficulty' => 35, 'intent' => 'informational'],
    ['keyword' => 'วางแผนคอนเทนต์', 'search_volume' => null, 'difficulty' => null, 'intent' => null],
];

$brief = [
    'primary_keyword' => 'วิธีทำคอนเทนต์',
    'secondary_keywords' => [['keyword' => 'วางแผนคอนเทนต์', 'search_volume' => null, 'difficulty' => null]],
    'intent' => 'informational',
    'paa' => [],
    'content_gaps' => [],
    'competitor_angles' => [],
    'outline' => [],
    'target_word_count' => 500,
    'aeo_notes' => [],
];

$parsed = ai_research_parse_json("```json\n" . json_encode($brief, JSON_UNESCAPED_UNICODE) . "\n```");
test_assert($parsed['primary_keyword'] === $brief['primary_keyword'], 'JSON fence parser failed');

$validated = ai_research_validate_brief($parsed, $source);
test_assert($validated['secondary_keywords'][0]['search_volume'] === null, 'Missing metric must remain null');

$invalidPrimary = $brief;
$invalidPrimary['primary_keyword'] = 'keyword ที่ไม่มีใน source';
try {
    ai_research_validate_brief($invalidPrimary, $source);
    throw new RuntimeException('Unknown primary keyword was accepted');
} catch (RuntimeException $e) {
    test_assert(str_contains($e->getMessage(), 'ต้องมาจากข้อมูล Research'), 'Unknown primary error is unclear');
}

$invalidMetric = $brief;
$invalidMetric['secondary_keywords'][0]['search_volume'] = 99;
try {
    ai_research_validate_brief($invalidMetric, $source);
    throw new RuntimeException('Invented metric was accepted');
} catch (RuntimeException $e) {
    test_assert(str_contains($e->getMessage(), 'search_volume'), 'Metric validation error is unclear');
}

$missingField = $brief;
unset($missingField['aeo_notes']);
try {
    ai_research_validate_brief($missingField, $source);
    throw new RuntimeException('Missing required field was accepted');
} catch (RuntimeException $e) {
    test_assert(str_contains($e->getMessage(), 'aeo_notes'), 'Missing field error is unclear');
}

echo "ai-research tests passed\n";
