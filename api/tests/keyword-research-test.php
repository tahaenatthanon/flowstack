<?php
require_once __DIR__ . '/../lib/keyword-research.php';

function test_assert(bool $condition, string $message): void {
    if (!$condition) throw new RuntimeException($message);
}

$serp = research_normalize_serp([
    'tasks' => [[
        'status_code' => 20000,
        'result' => [[
            'items' => [
                ['type' => 'organic', 'rank_absolute' => 1, 'title' => 'หัวข้อทดสอบ', 'description' => 'คำอธิบาย', 'url' => 'https://example.test'],
                ['type' => 'people_also_ask', 'items' => [['title' => 'คำถามที่พบบ่อย']]],
                ['type' => 'related_searches', 'items' => [['title' => 'คำค้นที่เกี่ยวข้อง']]],
            ],
        ]],
    ]],
]);
test_assert(count($serp['organic']) === 1, 'SERP organic normalization failed');
test_assert($serp['people_also_ask'][0]['question'] === 'คำถามที่พบบ่อย', 'PAA normalization failed');
test_assert($serp['related_searches'][0] === 'คำค้นที่เกี่ยวข้อง', 'Related search normalization failed');

$suggestions = research_normalize_suggestions([
    'tasks' => [[
        'status_code' => 20000,
        'result' => [[
            'items' => [[
                'keyword' => 'คำค้นหลัก',
                'keyword_properties' => ['keyword_difficulty' => 42],
                'search_intent_info' => ['main_intent' => 'informational'],
            ]],
        ]],
    ]],
]);
$volume = research_normalize_volume([
    'tasks' => [[
        'status_code' => 20000,
        'result' => [[
            'items' => [['keyword' => 'คำค้นหลัก', 'search_volume' => 1200, 'competition' => 0.25, 'cpc' => 1.5]],
        ]],
    ]],
]);
$merged = research_merge_keywords('เมล็ดตั้งต้น', $suggestions, $volume, $serp);
$main = array_values(array_filter($merged, static fn(array $row): bool => $row['keyword'] === 'คำค้นหลัก'))[0] ?? null;
test_assert($main !== null, 'Keyword merge omitted suggestion');
test_assert($main['search_volume'] === 1200 && $main['difficulty'] === 42, 'Keyword metrics were not merged');
test_assert($main['cpc'] === 1.5, 'CPC was not preserved');

$seed = array_values(array_filter($merged, static fn(array $row): bool => $row['keyword'] === 'เมล็ดตั้งต้น'))[0] ?? null;
test_assert($seed !== null && $seed['search_volume'] === null, 'Missing metric must remain null');

$failed = false;
try {
    research_task_results(['tasks' => [['status_code' => 40100, 'status_message' => 'unauthorized']]]);
} catch (RuntimeException $e) {
    $failed = true;
}
test_assert($failed, 'Provider task error was not surfaced');

echo "keyword-research tests passed\n";
