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
check(seo_gate_status(['score' => 95, 'rules' => []]) === 'passed', 'score 95 => passed');
check(seo_gate_status(['score' => 85, 'rules' => []]) === 'needs_improvement', 'score 85 => needs_improvement');
check(seo_gate_status(['score' => 70, 'rules' => []]) === 'failed', 'score 70 => failed');
check(seo_gate_status([
    'score' => 95,
    'rules' => [['key' => 'seo_title', 'status' => 'failed', 'critical' => true]],
]) === 'failed', 'critical failed => failed even at score 95');

echo "== 6. video: no skip, 15 rules measured per-type + hashtags critical ==\n";
$video = seo_evaluate([
    'type' => 'video',
    'title' => 'Test video',
    'seo_title' => 'Test video',
    'slug' => 'test-video',
    'meta_description' => str_repeat('ก', 120),
    'structured_data' => json_encode(['@context' => 'https://schema.org', '@type' => 'VideoObject']),
    'article_content' => [
        'hashtags' => [],
        'scripts' => ['tiktok' => str_repeat('test ', 600)],
        'script_sections' => ['opening' => 'hook', 'bridge' => 'เนื้อหา', 'twist' => 'จุดพลิก', 'ending' => 'CTA'],
    ],
]);
// ครบ 15 key ไม่มี skip
check(count(array_intersect(array_keys(SEO_WEIGHTS), array_column($video['rules'], 'key'))) === 15, 'video has all 15 keys');
foreach ($video['rules'] as $r) {
    if (in_array($r['key'], array_keys(SEO_WEIGHTS), true)) {
        check($r['status'] !== 'skip', 'video ' . $r['key'] . ' is NOT skip (got ' . $r['status'] . ')');
    }
}
$hashtag = null;
foreach ($video['rules'] as $r) if ($r['key'] === 'hashtags') $hashtag = $r;
check($hashtag !== null && $hashtag['status'] === 'failed', 'video empty hashtags => failed');
check($hashtag !== null && !empty($hashtag['critical']), 'hashtags is critical for video');
check($video['gate'] === 'failed', 'video empty hashtags => gate failed');

echo "== 7. video per-type measurement ==\n";
$vContentLength = null; $vHeading = null; $vSd = null;
foreach ($video['rules'] as $r) {
    if ($r['key'] === 'content_length') $vContentLength = $r;
    if ($r['key'] === 'heading_structure') $vHeading = $r;
    if ($r['key'] === 'structured_data') $vSd = $r;
}
check($vContentLength !== null && $vContentLength['status'] === 'passed', 'video content_length measured from script => passed (got ' . ($vContentLength['status'] ?? '?') . ')');
check($vHeading !== null && $vHeading['status'] === 'passed', 'video heading_structure measured from sections => passed (got ' . ($vHeading['status'] ?? '?') . ')');
check($vSd !== null && $vSd['status'] === 'passed', 'video structured_data VideoObject => passed (got ' . ($vSd['status'] ?? '?') . ')');

fwrite(STDOUT, "\nAll SEO quality gate tests passed.\n");
