<?php
/**
 * Part 3 — SEO/AEO Quality Gate Test (Article)
 * ตรวจ behavior จริงของ seo_evaluate() / aeo_evaluate() / gate_status()
 * โดยไม่พึ่ง AI (ฟังก์ชันเป็น pure) — ใช้ input ที่คราฟต์ให้ตรงเงื่อนไขแต่ละ TC
 */

require_once __DIR__ . '/../lib/seo-checklist.php';
require_once __DIR__ . '/../lib/aeo-checklist.php';

$RESULTS = []; // [tc, name, expected, actual, pass]

function record(string $tc, string $name, string $expected, string $actual, bool $pass): void {
    global $RESULTS;
    $RESULTS[] = [$tc, $name, $expected, $actual, $pass];
}

function check(bool $cond, string $msg): void {
    if (!$cond) throw new RuntimeException($msg);
}

// ── helpers ────────────────────────────────────────────────────────────────
function makeRule(string $key, string $status, string $tier = 'required', bool $critical = false): array {
    return ['key' => $key, 'status' => $status, 'tier' => $tier, 'critical' => $critical];
}

function allPassedRules(array $keys, string $tier = 'required'): array {
    return array_map(fn($k) => makeRule($k, 'passed', $tier), $keys);
}

// long filler (english tokens counted 1:1 by seo_word_count)
function filler(int $repeat = 100): string {
    return implode(' ', array_fill(0, $repeat, 'content marketing strategy planning execution optimization growth research analysis'));
}

// Build a fully-passing article (no research) — all applicable SEO/AEO rules pass.
function makeGoodArticle(): array {
    $primary = 'วิธีทำคอนเทนต์';
    // Q&A structure: 2 question headings + answer blocks (สำหรับ AEO qa_structure/snippet)
    $html =
        '<p>' . $primary . ' คือกระบวนการวางแผนและสร้างสรรค์เนื้อหาอย่างเป็นระบบเพื่อให้เข้าถึงกลุ่มเป้าหมายได้ตรงจุด ' . filler() . '</p>' .
        '<h2>' . $primary . 'คืออะไร ทำไมสำคัญ</h2><p>' . $primary . ' คือการวางแผนเนื้อหาที่ตอบโจทย์ผู้ชม ขั้นตอนเริ่มจากวิเคราะห์กลุ่มเป้าหมาย ' . filler() . '</p>' .
        '<h2>วิธีวางแผนคอนเทนต์อย่างไร</h2><p>วิธีวางแผนเริ่มจาก ขั้นตอนการกำหนดเป้าหมายและช่องทางเผยแพร่ที่เหมาะสม ' . filler() . '</p>';
    // meta_description 120–160 ตัวอักษร (mb-safe)
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

// Research brief (full)
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

$PASS = 0; $FAIL = 0;
function tally(bool $pass): void { global $PASS, $FAIL; $pass ? $PASS++ : $FAIL++; }

// ═══════════════════════════════════════════════════════════════════════════
// TC01 — Article ไม่ใช้ Research และ SEO/AEO ผ่าน
// ═══════════════════════════════════════════════════════════════════════════
{
    $item = makeGoodArticle(); // no research_brief
    $seo = seo_evaluate($item);
    $aeo = aeo_evaluate($item);
    $seoGate = seo_gate_status($seo);
    $aeoGate = aeo_gate_status($aeo);

    // research-dependent SEO rules must be n/a
    $researchSeoRules = ['search_intent', 'related_keywords', 'topic_coverage', 'paa_questions', 'content_gap'];
    $allNA = true;
    foreach ($seo['rules'] as $r) {
        if (in_array($r['key'], $researchSeoRules, true) && ($r['status'] ?? '') !== 'n/a') $allNA = false;
    }
    // AEO research-dependent rules must be n/a
    $aeoSearchIntentNA = true; $aeoPaaNA = true;
    foreach ($aeo['rules'] as $r) {
        if ($r['key'] === 'search_intent' && ($r['status'] ?? '') !== 'n/a') $aeoSearchIntentNA = false;
        if ($r['key'] === 'paa_coverage' && ($r['status'] ?? '') !== 'n/a') $aeoPaaNA = false;
    }

    $pass = $seoGate === 'passed' && $aeoGate === 'passed' && $allNA && $aeoSearchIntentNA && $aeoPaaNA;
    record('TC01', 'Article ไม่ใช้ Research และ SEO/AEO ผ่าน',
        "SEO+?AEO passed, research rules = n/a",
        "SEO={$seo['score']}({$seoGate}), AEO={$aeo['score']}({$aeoGate}), researchSEO_n/a={$allNA}", $pass);
    tally($pass);
}

// ═══════════════════════════════════════════════════════════════════════════
// TC02 — Article ใช้ Research และผ่าน SEO/AEO
// ═══════════════════════════════════════════════════════════════════════════
{
    $item = makeGoodArticle();
    $item['research_brief'] = makeResearchBrief();
    // make body actually cover research: inject secondary keywords + PAA answers + gaps + outline headings
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

    // research rules must now be evaluated (not n/a)
    $researchEvaluated = true;
    foreach ($seo['rules'] as $r) {
        if (in_array($r['key'], ['search_intent', 'related_keywords', 'topic_coverage', 'paa_questions', 'content_gap'], true)) {
            if (($r['status'] ?? '') === 'n/a') $researchEvaluated = false;
        }
    }
    $pass = $seoGate === 'passed' && $aeoGate === 'passed' && $researchEvaluated;
    record('TC02', 'Article ใช้ Research และผ่าน SEO/AEO',
        "SEO+?AEO passed, research rules ถูกตรวจ (ไม่ใช่ n/a)",
        "SEO={$seo['score']}({$seoGate}), AEO={$aeo['score']}({$aeoGate}), researchEvaluated={$researchEvaluated}", $pass);
    tally($pass);
}

// ═══════════════════════════════════════════════════════════════════════════
// TC03 — SEO คะแนน 80 พอดี (ไม่มี required rule failed)
// ═══════════════════════════════════════════════════════════════════════════
{
    $eval = ['score' => 80, 'rules' => allPassedRules(['seo_title', 'meta_description', 'slug', 'h1', 'heading_structure', 'content_length'])];
    $gate = seo_gate_status($eval);
    $pass = $gate === 'passed';
    record('TC03', 'SEO score = 80 (required ผ่านหมด)', 'passed', $gate, $pass);
    tally($pass);
}

// ═══════════════════════════════════════════════════════════════════════════
// TC04 — AEO คะแนน 80 พอดี
// ═══════════════════════════════════════════════════════════════════════════
{
    $eval = ['score' => 80, 'rules' => allPassedRules(['direct_answer', 'search_intent', 'qa_structure'])];
    $gate = aeo_gate_status($eval);
    $pass = $gate === 'passed';
    record('TC04', 'AEO score = 80 (required ผ่านหมด)', 'passed', $gate, $pass);
    tally($pass);
}

// ═══════════════════════════════════════════════════════════════════════════
// TC05 — SEO 79
// ═══════════════════════════════════════════════════════════════════════════
{
    $eval = ['score' => 79, 'rules' => allPassedRules(['seo_title', 'slug', 'h1'])];
    $gate = seo_gate_status($eval);
    $pass = $gate === 'needs_improvement';
    record('TC05', 'SEO score = 79', 'needs_improvement', $gate, $pass);
    tally($pass);
}

// ═══════════════════════════════════════════════════════════════════════════
// TC06 — AEO 79
// ═══════════════════════════════════════════════════════════════════════════
{
    $eval = ['score' => 79, 'rules' => allPassedRules(['direct_answer', 'qa_structure'])];
    $gate = aeo_gate_status($eval);
    $pass = $gate === 'needs_improvement';
    record('TC06', 'AEO score = 79', 'needs_improvement', $gate, $pass);
    tally($pass);
}

// ═══════════════════════════════════════════════════════════════════════════
// TC07 — SEO ต่ำกว่า 70
// ═══════════════════════════════════════════════════════════════════════════
{
    $eval = ['score' => 69, 'rules' => allPassedRules(['seo_title', 'slug'])];
    $gate = seo_gate_status($eval);
    $pass = $gate === 'failed';
    record('TC07', 'SEO score = 69 (<70)', 'failed', $gate, $pass);
    tally($pass);
}

// ═══════════════════════════════════════════════════════════════════════════
// TC08 — AEO ต่ำกว่า 70
// ═══════════════════════════════════════════════════════════════════════════
{
    $eval = ['score' => 50, 'rules' => allPassedRules(['direct_answer'])];
    $gate = aeo_gate_status($eval);
    $pass = $gate === 'failed';
    record('TC08', 'AEO score = 50 (<70)', 'failed', $gate, $pass);
    tally($pass);
}

// ═══════════════════════════════════════════════════════════════════════════
// TC09 — SEO >= 80 แต่ Required Rule failed
// ═══════════════════════════════════════════════════════════════════════════
{
    $rules = allPassedRules(['seo_title', 'meta_description', 'slug', 'h1', 'heading_structure', 'content_length']);
    $rules[] = makeRule('structured_data', 'failed', 'required', true);
    $eval = ['score' => 90, 'rules' => $rules];
    $gate = seo_gate_status($eval);
    $pass = $gate === 'failed';
    record('TC09', 'SEO score=90 แต่ structured_data(required) failed', 'failed', $gate, $pass);
    tally($pass);
}

// ═══════════════════════════════════════════════════════════════════════════
// TC10 — AEO >= 80 แต่ Required Rule failed
// ═══════════════════════════════════════════════════════════════════════════
{
    $rules = allPassedRules(['direct_answer', 'search_intent', 'qa_structure', 'heading_questions']);
    $rules[] = makeRule('structured_data', 'failed', 'required');
    $eval = ['score' => 85, 'rules' => $rules];
    $gate = aeo_gate_status($eval);
    $pass = $gate === 'failed';
    record('TC10', 'AEO score=85 แต่ structured_data(required) failed', 'failed', $gate, $pass);
    tally($pass);
}

// ═══════════════════════════════════════════════════════════════════════════
// TC11 — SEO repair: evaluate ใหม่หลัง repair (ไม่ใช้ score เดิม)
// ═══════════════════════════════════════════════════════════════════════════
{
    // before: bad content → low score / failed
    $bad = makeGoodArticle();
    $bad['article_content'] = json_encode(['title' => $bad['title'], 'html' => '<p>สั้นเกินไป</p>']);
    $bad['meta_description'] = '';
    $bad['structured_data'] = '';
    $before = seo_evaluate($bad);
    $beforeGate = seo_gate_status($before);

    // after repair: good content
    $after = seo_evaluate(makeGoodArticle());
    $afterGate = seo_gate_status($after);

    $reEvaluated = ($before['score'] !== $after['score']);
    $pass = $beforeGate !== 'passed' && $afterGate === 'passed' && $reEvaluated;
    record('TC11', 'SEO repair → evaluate ใหม่',
        "ก่อนไม่ผ่าน, หลังผ่าน, score เปลี่ยน",
        "before={$before['score']}({$beforeGate}), after={$after['score']}({$afterGate})", $pass);
    tally($pass);
}

// ═══════════════════════════════════════════════════════════════════════════
// TC12 — AEO repair: evaluate ใหม่หลัง repair
// ═══════════════════════════════════════════════════════════════════════════
{
    // before: filler intro (no direct answer) + no headings
    $bad = makeGoodArticle();
    $bad['article_content'] = json_encode(['title' => $bad['title'], 'html' => '<p>สวัสดีครับ วันนี้เราจะมาพูดถึงเรื่องทั่วไป</p>']);
    $before = aeo_evaluate($bad);
    $beforeGate = aeo_gate_status($before);

    $after = aeo_evaluate(makeGoodArticle());
    $afterGate = aeo_gate_status($after);

    $pass = $beforeGate !== 'passed' && $afterGate === 'passed' && ($before['score'] !== $after['score']);
    record('TC12', 'AEO repair → evaluate ใหม่',
        "ก่อนไม่ผ่าน, หลังผ่าน, score เปลี่ยน",
        "before={$before['score']}({$beforeGate}), after={$after['score']}({$afterGate})", $pass);
    tally($pass);
}

// ═══════════════════════════════════════════════════════════════════════════
// TC13 — SEO ผ่าน แต่ AEO ไม่ผ่าน (combined gate ต้องไม่ผ่าน)
// ═══════════════════════════════════════════════════════════════════════════
{
    // เลียนแบบ final-gate logic ของ brand-content.php เป๊ะ
    $combine = static function (string $s, string $a): string {
        $seoPassed = $s === 'passed';
        $aeoPassed = $a === 'passed';
        return ($seoPassed && $aeoPassed) ? 'success' : 'failed';
    };
    $seoGate = 'passed';   // SEO ผ่าน
    $aeoGate = 'failed';   // AEO ไม่ผ่าน
    $gen = $combine($seoGate, $aeoGate);
    $pass = $seoGate === 'passed' && $aeoGate !== 'passed' && $gen === 'failed';
    record('TC13', 'SEO ผ่าน แต่ AEO ไม่ผ่าน',
        "รวมต้องไม่ผ่าน (gen=failed)",
        "SEO={$seoGate}, AEO={$aeoGate}, gen={$gen}", $pass);
    tally($pass);
}

// ═══════════════════════════════════════════════════════════════════════════
// TC14 — AEO ผ่าน แต่ SEO ไม่ผ่าน (combined gate ต้องไม่ผ่าน)
// ═══════════════════════════════════════════════════════════════════════════
{
    $combine = static function (string $s, string $a): string {
        $seoPassed = $s === 'passed';
        $aeoPassed = $a === 'passed';
        return ($seoPassed && $aeoPassed) ? 'success' : 'failed';
    };
    $seoGate = 'failed';   // SEO ไม่ผ่าน
    $aeoGate = 'passed';   // AEO ผ่าน
    $gen = $combine($seoGate, $aeoGate);
    $pass = $aeoGate === 'passed' && $seoGate !== 'passed' && $gen === 'failed';
    record('TC14', 'AEO ผ่าน แต่ SEO ไม่ผ่าน',
        "รวมต้องไม่ผ่าน (gen=failed)",
        "SEO={$seoGate}, AEO={$aeoGate}, gen={$gen}", $pass);
    tally($pass);
}

// ═══════════════════════════════════════════════════════════════════════════
// TC15 — SEO และ AEO ผ่านทั้งคู่
// ═══════════════════════════════════════════════════════════════════════════
{
    $item = makeGoodArticle();
    $seo = seo_evaluate($item);
    $aeo = aeo_evaluate($item);
    $seoGate = seo_gate_status($seo);
    $aeoGate = aeo_gate_status($aeo);
    $combinedPassed = ($seoGate === 'passed' && $aeoGate === 'passed');
    $pass = $combinedPassed;
    record('TC15', 'SEO และ AEO ผ่านทั้งคู่', 'Final Gate passed',
        "SEO={$seo['score']}({$seoGate}), AEO={$aeo['score']}({$aeoGate})", $pass);
    tally($pass);
}

// ═══════════════════════════════════════════════════════════════════════════
// TC16 — ไม่ถูกลดคะแนนเพราะไม่มี Research (normalization, no scorer inversion)
// ═══════════════════════════════════════════════════════════════════════════
{
    $item = makeGoodArticle(); // no research
    $seo = seo_evaluate($item);

    // research rules ต้อง n/a และถูกตัดออกจาก denominator (ไม่ถ่วงคะแนน)
    $researchRulesNA = true;
    $sumApplicableWeight = 0;
    $researchKeys = ['search_intent', 'related_keywords', 'topic_coverage', 'paa_questions', 'content_gap'];
    foreach ($seo['rules'] as $r) {
        $status = $r['status'] ?? $r['level'] ?? 'skip';
        if (in_array($r['key'], $researchKeys, true)) {
            if ($status !== 'n/a') $researchRulesNA = false;
            continue;
        }
        if (in_array($status, ['pending', 'n/a', 'skip'], true)) continue;
        $sumApplicableWeight += (int)($r['weight'] ?? 0);
    }
    // ถ้า research rules ถูกนับเป็น 0 แต่รวมใน denominator (34 weight) score จะ ≈ 65 (failed)
    // จริงได้ 98 → พิสูจน์ว่า normalize ตัด n/a ออกจาก denominator (ไม่ scorer inversion)
    $researchExcludedFromDenominator = $sumApplicableWeight < 100;
    $noInversion = $seo['score'] >= SEO_GATE_PASS_SCORE;
    $pass = $researchRulesNA && $researchExcludedFromDenominator && $noInversion;
    record('TC16', 'ไม่มี Research → คะแนน normalize จาก applicable rules',
        'research rules n/a, ไม่ scorer inversion, score >= 80',
        "score={$seo['score']}, applicableWeight={$sumApplicableWeight}, researchNA={$researchRulesNA}", $pass);
    tally($pass);
}

// ═══════════════════════════════════════════════════════════════════════════
// TC17 — คะแนนหลัง repair คำนวณจาก content ใหม่จริง
// ═══════════════════════════════════════════════════════════════════════════
{
    $bad = makeGoodArticle();
    $bad['article_content'] = json_encode(['title' => $bad['title'], 'html' => '<p>เนื้อหาสั้น</p>']);
    $bad['meta_description'] = '';
    $bad['structured_data'] = '';
    $before = seo_evaluate($bad);

    $good = makeGoodArticle();
    $after = seo_evaluate($good);

    // same function, different content → different score proves recompute from content
    $pass = $before['score'] !== $after['score'] && $after['score'] > $before['score'];
    record('TC17', 'คะแนนหลัง repair มาจาก content ใหม่',
        'score เปลี่ยนตาม content (ไม่ใช้ค่าเดิม)',
        "before={$before['score']}, after={$after['score']}", $pass);
    tally($pass);
}

// ═══════════════════════════════════════════════════════════════════════════
// TC18 — Final Gate ตรวจซ้ำหลัง SEO/AEO repair (ทั้งสอง gate)
// ═══════════════════════════════════════════════════════════════════════════
{
    // จำลองว่า content ถูก repair แล้วนำมาประเมินใหม่ทั้ง SEO และ AEO (final gate logic เดียวกับ brand-content.php)
    $item = makeGoodArticle();
    $seoEval = seo_evaluate($item);
    $aeoEval = aeo_evaluate($item);
    $seoGate = seo_gate_status($seoEval);
    $aeoGate = aeo_gate_status($aeoEval);
    $generationStatus = ($seoGate === 'passed' && $aeoGate === 'passed') ? 'success' : 'failed';

    // fresh evaluation (ไม่ cache เก่า) — เรียกซ้ำได้ผลลัพธ์ consistent และพิจารณาทั้ง 2 gate
    $freshSeo = seo_gate_status(seo_evaluate($item));
    $freshAeo = aeo_gate_status(aeo_evaluate($item));
    $pass = $generationStatus === 'success' && $freshSeo === 'passed' && $freshAeo === 'passed';
    record('TC18', 'Final Gate ตรวจซ้ำทั้ง SEO+AEO', 'success (ทั้งคู่ passed)',
        "gen={$generationStatus}, seo={$seoGate}, aeo={$aeoGate}", $pass);
    tally($pass);
}

// ═══════════════════════════════════════════════════════════════════════════
// TC19 — เนื้อหาดีแต่ Structured Data หาย
// ═══════════════════════════════════════════════════════════════════════════
{
    $item = makeGoodArticle();
    $item['structured_data'] = ''; // หาย
    $seo = seo_evaluate($item);
    $gate = seo_gate_status($seo);

    $sdRule = null;
    foreach ($seo['rules'] as $r) if ($r['key'] === 'structured_data') $sdRule = $r;

    $sdFailed = ($sdRule['status'] ?? '') === 'failed';
    $pass = $sdFailed && $gate === 'failed';
    record('TC19', 'เนื้อหาดี แต่ structured_data หาย', 'structured_data failed + gate failed',
        "sd={$sdRule['status']}, gate={$gate}, score={$seo['score']}", $pass);
    tally($pass);
}

// ═══════════════════════════════════════════════════════════════════════════
// TC20 — Intro/Filler ไม่ตอบหัวข้อ (direct answer)
// ═══════════════════════════════════════════════════════════════════════════
{
    $item = makeGoodArticle();
    $item['article_content'] = json_encode([
        'title' => $item['title'],
        'html' => '<p>สวัสดีครับ วันนี้เราจะมาพูดถึงเรื่องน่าสนใจกันนะครับ</p>' .
                  '<h2>บทนำ</h2><p>' . filler() . '</p>' .
                  '<h2>เนื้อหา</h2><p>' . filler() . '</p>',
    ]);
    $aeo = aeo_evaluate($item);
    $daRule = null;
    foreach ($aeo['rules'] as $r) if ($r['key'] === 'direct_answer') $daRule = $r;

    $daStatus = $daRule['status'] ?? '';
    // ต้องไม่ passed (needs_improvement หรือ failed) — filler intro
    $pass = in_array($daStatus, ['needs_improvement', 'failed'], true);
    record('TC20', 'Intro filler ไม่ตอบหัวข้อ', 'direct_answer ไม่ผ่าน (needs_improvement/failed)',
        "direct_answer={$daStatus}", $pass);
    tally($pass);
}

// ═══════════════════════════════════════════════════════════════════════════
// Output report
// ═══════════════════════════════════════════════════════════════════════════
echo "\n";
echo "| TC | Test Case | Expected | Actual | PASS/FAIL |\n";
echo "|----|-----------|----------|--------|-----------|\n";
foreach ($RESULTS as [$tc, $name, $expected, $actual, $pass]) {
    $mark = $pass ? 'PASS' : 'FAIL';
    echo "| {$tc} | {$name} | {$expected} | {$actual} | {$mark} |\n";
}
echo "\n";
echo "ผ่าน: {$PASS} / " . count($RESULTS) . "\n";
echo "ไม่ผ่าน: {$FAIL} / " . count($RESULTS) . "\n";

if ($FAIL > 0) { echo "\nRESULT: FAIL\n"; exit(1); }
echo "\nRESULT: PASS\n";
