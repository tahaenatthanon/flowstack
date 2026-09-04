<?php
/**
 * ชุด B — Regression จุดที่เคย FAIL (หลังแก้ bug AEO Checklist)
 * ใช้ฟังก์ชันจริง seo_evaluate() / aeo_evaluate() / seo_gate_status() / aeo_gate_status()
 */

require_once __DIR__ . '/../lib/seo-checklist.php';
require_once __DIR__ . '/../lib/aeo-checklist.php';

$RESULTS = [];
function record(string $tc, string $name, string $expected, string $actual, bool $pass): void {
    global $RESULTS;
    $RESULTS[] = [$tc, $name, $expected, $actual, $pass];
}
$PASS = 0; $FAIL = 0;
function tally(bool $pass): void { global $PASS, $FAIL; $pass ? $PASS++ : $FAIL++; }

function filler(int $repeat = 100): string {
    return implode(' ', array_fill(0, $repeat, 'content marketing strategy planning execution optimization growth research analysis'));
}

function makeGoodArticle(): array {
    $primary = 'วิธีทำคอนเทนต์';
    $html =
        '<p>' . $primary . ' คือกระบวนการวางแผนและสร้างสรรค์เนื้อหาอย่างเป็นระบบเพื่อให้เข้าถึงกลุ่มเป้าหมายได้ตรงจุด ' . filler() . '</p>' .
        '<h2>' . $primary . 'คืออะไร ทำไมสำคัญ</h2><p>' . $primary . ' คือการวางแผนเนื้อหาที่ตอบโจทย์ผู้ชม ขั้นตอนเริ่มจากวิเคราะห์กลุ่มเป้าหมาย ' . filler() . '</p>' .
        '<h2>วิธีวางแผนคอนเทนต์อย่างไร</h2><p>วิธีวางแผนเริ่มจาก ขั้นตอนการกำหนดเป้าหมายและช่องทางเผยแพร่ที่เหมาะสม ' . filler() . '</p>';
    $desc = mb_substr(str_repeat('วิธีทำคอนเทนต์ให้ประสบความสำเร็จอย่างยั่งยืน ', 8), 0, 140);
    return [
        'type' => 'article',
        'title' => 'วิธีทำคอนเทนต์ให้ปังในปี 2026',
        'seo_title' => 'วิธีทำคอนเทนต์ให้ปังในปี 2026',
        'slug' => 'how-to-create-great-content',
        'meta_description' => $desc,
        'meta_keywords' => $primary . ', การตลาด, คอนเทนต์',
        'structured_data' => json_encode(['@context' => 'https://schema.org', '@type' => 'Article']),
        'article_content' => json_encode(['title' => 'วิธีทำคอนเทนต์ให้ปังในปี 2026', 'html' => $html]),
    ];
}

function makeResearchBrief(): array {
    return [
        'primary_keyword' => 'วิธีทำคอนเทนต์',
        'secondary_keywords' => [['keyword' => 'วางแผนคอนเทนต์'], ['keyword' => 'การตลาดดิจิทัล']],
        'intent' => 'informational',
        'paa' => [['question' => 'วิธีทำคอนเทนต์เริ่มอย่างไร'], ['question' => 'คอนเทนต์แบบไหนประสบความสำเร็จ']],
        'content_gaps' => [['text' => 'งบประมาณสำหรับคอนเทนต์'], ['text' => 'เครื่องมือสร้างคอนเทนต์']],
        'outline' => [['heading' => 'ขั้นตอนแรก'], ['heading' => 'ขั้นตอนที่สอง']],
    ];
}

// ═══════════════════════════════════════════════════════════════════════════
// B-TC01 — Article + No Research + เนื้อหาผ่าน → SEO + AEO = passed
// ═══════════════════════════════════════════════════════════════════════════
{
    $item = makeGoodArticle();
    $seo = seo_evaluate($item);
    $aeo = aeo_evaluate($item);
    $seoGate = seo_gate_status($seo);
    $aeoGate = aeo_gate_status($aeo);
    $pass = $seoGate === 'passed' && $aeoGate === 'passed';
    record('B-TC01', 'Article + No Research + เนื้อหาผ่าน', 'SEO + AEO = passed',
        "SEO={$seo['score']}({$seoGate}), AEO={$aeo['score']}({$aeoGate})", $pass);
    tally($pass);
}

// ═══════════════════════════════════════════════════════════════════════════
// B-TC02 — Article + Research + เนื้อหาผ่าน → SEO + AEO = passed
// ═══════════════════════════════════════════════════════════════════════════
{
    $item = makeGoodArticle();
    $item['research_brief'] = makeResearchBrief();
    $html =
        '<p>วิธีทำคอนเทนต์ เริ่มจากวางแผนคอนเทนต์และการตลาดดิจิทัลอย่างเป็นระบบ ' . filler() . '</p>' .
        '<h2>วิธีทำคอนเทนต์เริ่มอย่างไร</h2><p>เริ่มจากวางแผนคอนเทนต์และงบประมาณสำหรับคอนเทนต์ เครื่องมือสร้างคอนเทนต์ ' . filler() . '</p>' .
        '<h2>คอนเทนต์แบบไหนประสบความสำเร็จ</h2><p>ขั้นตอนแรก ขั้นตอนที่สอง ' . filler() . '</p>';
    $item['article_content'] = json_encode(['title' => $item['title'], 'html' => $html]);
    $item['meta_keywords'] = 'วิธีทำคอนเทนต์, วางแผนคอนเทนต์, การตลาดดิจิทัล';

    $seo = seo_evaluate($item);
    $aeo = aeo_evaluate($item);
    $seoGate = seo_gate_status($seo);
    $aeoGate = aeo_gate_status($aeo);
    $pass = $seoGate === 'passed' && $aeoGate === 'passed';
    record('B-TC02', 'Article + Research + เนื้อหาผ่าน', 'SEO + AEO = passed',
        "SEO={$seo['score']}({$seoGate}), AEO={$aeo['score']}({$aeoGate})", $pass);
    tally($pass);
}

// ═══════════════════════════════════════════════════════════════════════════
// B-TC12 — AEO repair → evaluate ใหม่ คะแนนเปลี่ยนตามเนื้อหาใหม่ และผ่านได้
// ═══════════════════════════════════════════════════════════════════════════
{
    // ก่อน repair: filler intro ไม่ตอบหัวข้อ + ไม่มี Q&A
    $bad = makeGoodArticle();
    $bad['article_content'] = json_encode([
        'title' => $bad['title'],
        'html' => '<p>สวัสดีครับ วันนี้เราจะมาพูดถึงเรื่องทั่วไป</p>',
    ]);
    $before = aeo_evaluate($bad);
    $beforeGate = aeo_gate_status($before);

    // หลัง repair: เนื้อหาดี
    $after = aeo_evaluate(makeGoodArticle());
    $afterGate = aeo_gate_status($after);

    $scoreChanged = $before['score'] !== $after['score'];
    $pass = $beforeGate !== 'passed' && $afterGate === 'passed' && $scoreChanged;
    record('B-TC12', 'AEO repair → evaluate ใหม่', 'คะแนนเปลี่ยนและผ่านได้',
        "before={$before['score']}({$beforeGate}), after={$after['score']}({$afterGate})", $pass);
    tally($pass);
}

// ═══════════════════════════════════════════════════════════════════════════
// B-TC15 — SEO ผ่าน + AEO ผ่าน → Final gate = passed
// ═══════════════════════════════════════════════════════════════════════════
{
    $item = makeGoodArticle();
    $seo = seo_evaluate($item);
    $aeo = aeo_evaluate($item);
    $seoGate = seo_gate_status($seo);
    $aeoGate = aeo_gate_status($aeo);
    $seoPassed = $seoGate === 'passed';
    $aeoPassed = $aeoGate === 'passed';
    $gen = ($seoPassed && $aeoPassed) ? 'success' : 'failed';
    $pass = $gen === 'success';
    record('B-TC15', 'SEO ผ่าน + AEO ผ่าน', 'Final gate = passed',
        "SEO={$seo['score']}({$seoGate}), AEO={$aeo['score']}({$aeoGate}), gen={$gen}", $pass);
    tally($pass);
}

// ═══════════════════════════════════════════════════════════════════════════
// B-TC18 — Final gate recheck SEO + AEO (ใช้ผล evaluate ล่าสุด)
// ═══════════════════════════════════════════════════════════════════════════
{
    // จำลอง content ที่ผ่าน repair แล้ว → final recheck ใช้ evaluate ใหม่ (ไม่ใช่ค่าเดิม)
    $item = makeGoodArticle();
    $seoEval = seo_evaluate($item);
    $aeoEval = aeo_evaluate($item);
    $seoGate = seo_gate_status($seoEval);
    $aeoGate = aeo_gate_status($aeoEval);

    // re-evaluate ใหม่ทั้งสอง gate (fresh) → ต้อง consistent และทั้งคู่ passed
    $freshSeo = seo_gate_status(seo_evaluate($item));
    $freshAeo = aeo_gate_status(aeo_evaluate($item));
    $gen = ($seoGate === 'passed' && $aeoGate === 'passed') ? 'success' : 'failed';

    $pass = $gen === 'success' && $freshSeo === 'passed' && $freshAeo === 'passed';
    record('B-TC18', 'Final gate recheck SEO + AEO', 'ทั้งคู่ผ่าน → passed',
        "gen={$gen}, seo={$seoGate}, aeo={$aeoGate}, fresh={$freshSeo}/{$freshAeo}", $pass);
    tally($pass);
}

// ═══════════════════════════════════════════════════════════════════════════
// Output
// ═══════════════════════════════════════════════════════════════════════════
echo "\n";
echo "| TC | Test Case | Expected | Actual | PASS/FAIL |\n";
echo "|----|-----------|----------|--------|-----------|\n";
foreach ($RESULTS as [$tc, $name, $expected, $actual, $pass]) {
    $mark = $pass ? 'PASS' : 'FAIL';
    echo "| {$tc} | {$name} | {$expected} | {$actual} | {$mark} |\n";
}
echo "\nผ่าน: {$PASS} / " . count($RESULTS) . "\n";
echo "ไม่ผ่าน: {$FAIL} / " . count($RESULTS) . "\n";
if ($FAIL > 0) { echo "\nRESULT: FAIL\n"; exit(1); }
echo "\nRESULT: PASS\n";
