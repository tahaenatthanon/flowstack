<?php
require_once __DIR__ . '/../api/lib/seo-checklist.php';

function check(bool $cond, string $msg): void {
    if (!$cond) throw new RuntimeException('FAIL: ' . $msg);
    echo "  ok - {$msg}\n";
}

echo "== 1. 15 rule keys + weight sum = 100 ==\n";
$weightSum = 0;
foreach (SEO_WEIGHTS as $key => $meta) {
    $weightSum += $meta['weight'];
}
check($weightSum === 100, 'weight sum = 100 (got ' . $weightSum . ')');
check(count(SEO_WEIGHTS) === 15, '15 rule keys in SEO_WEIGHTS');

$article = seo_evaluate([
    'type' => 'article',
    'title' => 'Test article',
    'seo_title' => 'Test article',
    'slug' => 'test-article',
    'meta_description' => str_repeat('ก', 120),
    'meta_keywords' => 'test',
    'structured_data' => json_encode(['@context' => 'https://schema.org', '@type' => 'Article']),
    'article_content' => ['html' => '<h2>Test</h2><p>' . str_repeat('test ', 500) . '</p>'],
]);
$articleKeys = array_column($article['rules'], 'key');
check(count($articleKeys) === 15, 'article emits 15 rules (got ' . count($articleKeys) . ')');
check(empty(array_diff(array_keys(SEO_WEIGHTS), $articleKeys)), 'all 15 keys present in article result');

echo "== 2. rule object shape ==\n";
$first = $article['rules'][0];
foreach (['key', 'level', 'status', 'weight', 'score', 'critical', 'message'] as $field) {
    check(array_key_exists($field, $first), "rule has field '{$field}'");
}

echo "== 3. normalized score ==\n";
check($article['score'] >= 0 && $article['score'] <= 100, 'score in 0..100 (got ' . $article['score'] . ')');

echo "== 4. research rules pending without brief ==\n";
$researchKeys = ['search_intent', 'related_keywords', 'topic_coverage', 'paa_questions', 'content_gap'];
foreach ($article['rules'] as $r) {
    if (in_array($r['key'], $researchKeys, true)) {
        check($r['status'] === 'pending', $r['key'] . ' is pending without brief (got ' . $r['status'] . ')');
    }
}

echo "== 5. gate status thresholds ==\n";
check(seo_gate_status(['score' => 95, 'rules' => []]) === 'pass', 'score 95 => pass');
check(seo_gate_status(['score' => 85, 'rules' => []]) === 'warning', 'score 85 => warning');
check(seo_gate_status(['score' => 70, 'rules' => []]) === 'failed', 'score 70 => failed');
check(seo_gate_status([
    'score' => 95,
    'rules' => [['key' => 'seo_title', 'status' => 'failed', 'critical' => true]],
]) === 'failed', 'critical failed => failed even at score 95');

echo "== 6. video skips article rules + hashtags critical ==\n";
$video = seo_evaluate([
    'type' => 'video',
    'title' => 'Test video',
    'seo_title' => 'Test video',
    'slug' => 'test-video',
    'meta_description' => str_repeat('ก', 120),
    'structured_data' => json_encode(['@context' => 'https://schema.org', '@type' => 'VideoObject']),
    'article_content' => ['hashtags' => []],
]);
$skipKeys = ['h1', 'heading_structure', 'content_length', 'search_intent', 'primary_keyword_placement', 'keyword_stuffing', 'related_keywords', 'topic_coverage', 'paa_questions', 'content_gap', 'internal_linking'];
foreach ($video['rules'] as $r) {
    if (in_array($r['key'], $skipKeys, true)) {
        check($r['status'] === 'skip', 'video ' . $r['key'] . ' is skip (got ' . $r['status'] . ')');
    }
}
$hashtag = null;
foreach ($video['rules'] as $r) if ($r['key'] === 'hashtags') $hashtag = $r;
check($hashtag !== null && $hashtag['status'] === 'failed', 'video empty hashtags => failed');
check($hashtag !== null && !empty($hashtag['critical']), 'hashtags is critical for video');
check($video['gate'] === 'failed', 'video empty hashtags => gate failed');

fwrite(STDOUT, "\nAll SEO quality gate tests passed.\n");
