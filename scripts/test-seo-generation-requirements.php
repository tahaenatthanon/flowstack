<?php
require_once __DIR__ . '/../api/lib/seo-checklist.php';

function assertSameKeys(string $type, array $item): void {
    $required = array_column(seo_generation_requirements($type), 'key');
    $eval = seo_evaluate($item);
    $actual = array_column($eval['rules'], 'key');

    $missing = array_values(array_diff($required, $actual));
    if ($missing) {
        throw new RuntimeException("{$type}: missing evaluator rules: " . implode(', ', $missing));
    }
}

assertSameKeys('article', [
    'type' => 'article',
    'title' => 'Test article',
    'seo_title' => 'Test article',
    'slug' => 'test-article',
    'meta_description' => str_repeat('ก', 120),
    'meta_keywords' => 'test',
    'structured_data' => json_encode(['@context' => 'https://schema.org', '@type' => 'Article']),
    'article_content' => ['html' => '<h2>Test</h2><p>' . str_repeat('test ', 500) . '</p>'],
]);

assertSameKeys('video', [
    'type' => 'video',
    'title' => 'Test video',
    'seo_title' => 'Test video',
    'slug' => 'test-video',
    'meta_description' => str_repeat('ก', 120),
    'meta_keywords' => '',
    'structured_data' => json_encode(['@context' => 'https://schema.org', '@type' => 'VideoObject']),
    'article_content' => ['hashtags' => ['#test']],
]);

// Ensure video-only requirements do not accidentally include article-only rules.
$videoKeys = array_column(seo_generation_requirements('video'), 'key');
foreach (['has_h2', 'word_count', 'internal_link'] as $key) {
    if (in_array($key, $videoKeys, true)) {
        throw new RuntimeException("video requirements must skip {$key}");
    }
}

fwrite(STDOUT, "SEO generation requirements tests passed.\n");
