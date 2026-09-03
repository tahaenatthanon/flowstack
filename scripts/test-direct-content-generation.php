<?php
/**
 * ทดสอบ change fix-direct-content-week-context — prompt construction ของ generate-plan
 *
 * รัน: php scripts/test-direct-content-generation.php
 *
 * ครอบคลุม (tasks 3.1-3.5)
 *   3.1  Direct Article, Research OFF, topic `YouTube` → prompt ไม่มีบริบทวัน/สัปดาห์
 *   3.2  Direct + Research ON → seed คือ Original User Topic ไม่ใช่ trigger command ที่ถูกตกแต่ง
 *   3.3  Direct Video (มี/ไม่มี platform) → ไม่มีบริบทวัน/สัปดาห์เช่นเดียวกับ Article
 *   3.4  Weekly Content Plan → day/week behavior เดิมยังทำงานครบ (byte-identical)
 *   3.5  Monthly/Quarterly/Yearly → DATE INSTRUCTION เดิมยังถูกส่งตาม plan range
 *
 * pure function ทั้งหมด — ไม่ต่อ DB ไม่เรียก AI ไม่มี traffic ออกนอกเครื่อง
 */

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("CLI only\n");
}

require_once __DIR__ . '/../api/lib/content-plan-prompt.php';

$pass = 0;
$fail = 0;
function check(string $name, bool $ok, string $detail = ''): void {
    global $pass, $fail;
    if ($ok) { $pass++; echo "  PASS  {$name}\n"; }
    else     { $fail++; echo "  FAIL  {$name}" . ($detail !== '' ? " — {$detail}" : '') . "\n"; }
}

/**
 * บริบทวัน/สัปดาห์ที่ระบบเติมเอง — ห้ามปรากฏใน prompt ของ direct mode
 * (ตาม spec content-generation-single-item: `สัปดาห์เริ่มต้น`, `สร้างโพสต์สำหรับวัน...`, `วันจันทร์`)
 */
const BANNED_DIRECT_TOKENS = ['สัปดาห์เริ่มต้น', 'สร้างโพสต์สำหรับวัน', 'วันจันทร์', 'ของสัปดาห์'];

function checkNoDayWeekContext(string $label, string $text): void {
    foreach (BANNED_DIRECT_TOKENS as $token) {
        check("{$label} ไม่มี \"{$token}\"", !str_contains($text, $token), 'พบใน: ' . substr($text, 0, 300));
    }
}

/** ประกอบ system prompt แบบเดียวกับ brand-content.php?action=generate-plan */
function assembleSystemPrompt(bool $isDirect, string $planType, ?string $planStart, ?string $planEnd, array $platforms): string {
    $parts = [];
    $dateInstruction = content_plan_date_instruction($planType, $planStart, $planEnd);
    if ($dateInstruction !== '') $parts[] = $dateInstruction;
    if (!empty($platforms)) {
        $parts[] = "## Platform Constraint\nTarget publish platforms (list of channels for this content): " . implode(', ', $platforms) . '.';
    }
    $guard = content_plan_direct_guard($isDirect);
    if ($guard !== '') $parts[] = $guard;
    $parts[] = content_plan_output_rule($isDirect);
    return implode("\n\n", $parts);
}

// ─── 3.1 Direct Article, Research OFF, topic `YouTube` ───────────────────────
echo "== 3.1 Direct Article (Research OFF) topic `YouTube` ==\n";

check('generation_mode=direct → isDirect', content_plan_is_direct('direct'));
check('generation_mode=DIRECT (case-insensitive) → isDirect', content_plan_is_direct('DIRECT'));
check('generation_mode=plan → ไม่ใช่ direct', !content_plan_is_direct('plan'));
check('ไม่ส่ง generation_mode → ไม่ใช่ direct', !content_plan_is_direct(null));

check('direct + days=7 ยังได้ 1 item', content_plan_item_count(true, 7) === 1, 'got ' . content_plan_item_count(true, 7));
check('direct ไม่ส่ง days ก็ได้ 1 item', content_plan_item_count(true, 3) === 1);

$directDays = content_plan_day_defs(true, 1);
check('direct มี day def เดียว', count($directDays) === 1, 'got ' . count($directDays));
check("direct day_label เป็น string ว่าง", $directDays[0][0] === '', 'got "' . $directDays[0][0] . '"');
check('direct day_order เป็น 0', $directDays[0][1] === 0, 'got ' . $directDays[0][1]);
check('direct scheduled_date เป็น null', content_plan_scheduled_date(true, '2026-09-07', 0) === null);

$directArticleMsg = content_plan_user_message(true, [
    'source_topic'    => 'YouTube',
    'trigger_command' => 'YouTube [tone:กันเอง]',
    'week_start'      => '2026-09-07',
    'day_label'       => '',
    'day_order'       => 0,
    'platforms_str'   => 'facebook',
]);
check('direct user message เริ่มด้วย Original User Topic/Seed: YouTube',
    str_starts_with($directArticleMsg, 'Original User Topic/Seed: YouTube'), $directArticleMsg);
check('direct user message ยังระบุ platform', str_contains($directArticleMsg, 'Platform เป้าหมาย (ช่องทางเผยแพร่): facebook'));
checkNoDayWeekContext('direct article user message', $directArticleMsg);

$directRule = content_plan_output_rule(true);
check('direct output rule ใช้ day_label ว่าง/day_order 0',
    str_contains($directRule, '{"day_label":"","day_order":0,'), $directRule);
checkNoDayWeekContext('direct output rule', $directRule);
check('direct output rule ยังคง JSON-only rule', str_contains($directRule, 'Your ENTIRE response must be ONE valid JSON object'));
check('direct output rule ยังคง language rule', str_contains($directRule, 'ตอบเป็นภาษาไทยเท่านั้น'));

$directGuard = content_plan_direct_guard(true);
check('direct guard ถูกใส่', str_contains($directGuard, '## DIRECT CONTENT CREATION'));
check('plan mode ไม่มี direct guard', content_plan_direct_guard(false) === '');

$directArticleSys = assembleSystemPrompt(true, 'weekly', null, null, ['facebook']);
checkNoDayWeekContext('direct article system prompt', $directArticleSys);
check('direct article system prompt ไม่มี DATE INSTRUCTION', !str_contains($directArticleSys, '## DATE INSTRUCTION'));

// ─── 3.2 Direct + Research ON → seed คือ Original User Topic ─────────────────
echo "== 3.2 Direct + Research ON: seed = Original User Topic ==\n";

check('direct user message ไม่ใช้ trigger command ที่ถูกตกแต่ง',
    !str_contains($directArticleMsg, '[tone:กันเอง]'), $directArticleMsg);

// source_topic ว่าง → fallback เป็น trigger command (ทำใน brand-content.php ก่อนเรียก)
$fallbackTopic = '' !== '' ? '' : 'YouTube [VIDEO] [script:Hook-Story-CTA] [duration:60s]';
$directFallbackMsg = content_plan_user_message(true, [
    'source_topic'  => $fallbackTopic,
    'platforms_str' => 'tiktok',
]);
check('ไม่มี source_topic → ใช้ trigger command เป็น seed',
    str_starts_with($directFallbackMsg, 'Original User Topic/Seed: ' . $fallbackTopic));
checkNoDayWeekContext('direct fallback user message', $directFallbackMsg);

// ─── 3.3 Direct Video (มี/ไม่มี platform) ────────────────────────────────────
echo "== 3.3 Direct Video ==\n";

$directVideoMsg = content_plan_user_message(true, [
    'source_topic'  => 'YouTube',
    'platforms_str' => 'tiktok, youtube',
]);
check('direct video ระบุ platform ที่เลือก', str_contains($directVideoMsg, 'Platform เป้าหมาย (ช่องทางเผยแพร่): tiktok, youtube'));
checkNoDayWeekContext('direct video user message', $directVideoMsg);

$directNoPlatformMsg = content_plan_user_message(true, ['source_topic' => 'YouTube']);
check('direct ไม่มี platform → ไม่มีบรรทัด Platform', !str_contains($directNoPlatformMsg, 'Platform เป้าหมาย'));
check('direct ไม่มี platform → ยังมี seed', str_contains($directNoPlatformMsg, 'Original User Topic/Seed: YouTube'));
checkNoDayWeekContext('direct video (ไม่มี platform) user message', $directNoPlatformMsg);

checkNoDayWeekContext('direct video system prompt', assembleSystemPrompt(true, 'weekly', null, null, ['tiktok']));

// ─── 3.4 Weekly Content Plan — behavior เดิม ─────────────────────────────────
echo "== 3.4 Weekly Content Plan (legacy behavior) ==\n";

check('plan mode ไม่ส่ง days → 3 items (legacy default)', content_plan_item_count(false, 3) === 3);
check('plan mode days=5 → 5 items', content_plan_item_count(false, 5) === 5);
check('plan mode days=0 → clamp เป็น 1', content_plan_item_count(false, 0) === 1);
check('plan mode days=99 → clamp เป็น 7', content_plan_item_count(false, 99) === 7);

$weeklyDays = content_plan_day_defs(false, 3);
check('weekly 3 items', count($weeklyDays) === 3, 'got ' . count($weeklyDays));
check('weekly item 1 = จันทร์/1', $weeklyDays[0] === ['จันทร์', 1], json_encode($weeklyDays[0], JSON_UNESCAPED_UNICODE));
check('weekly item 2 = อังคาร/2', $weeklyDays[1] === ['อังคาร', 2]);
check('weekly item 3 = พุธ/3', $weeklyDays[2] === ['พุธ', 3]);

$weekAll = content_plan_day_defs(false, 7);
check('weekly 7 items ครบ จันทร์-อาทิตย์', $weekAll[6] === ['อาทิตย์', 7], json_encode($weekAll[6], JSON_UNESCAPED_UNICODE));
$weekExtended = content_plan_day_defs(false, 9);
check('เกิน 7 → ต่อด้วย "วันที่ N"', $weekExtended[7] === ['วันที่ 8', 8], json_encode($weekExtended[7], JSON_UNESCAPED_UNICODE));

check('weekly scheduled_date วันแรก = week_start',
    content_plan_scheduled_date(false, '2026-09-07', 1) === '2026-09-07',
    (string)content_plan_scheduled_date(false, '2026-09-07', 1));
check('weekly scheduled_date วันที่ 3 = week_start + 2 วัน',
    content_plan_scheduled_date(false, '2026-09-07', 3) === '2026-09-09',
    (string)content_plan_scheduled_date(false, '2026-09-07', 3));

$expectedWeeklyMsg = "Content Plan สัปดาห์หน้า\nสัปดาห์เริ่มต้น: 2026-09-07\n"
    . "สร้างโพสต์สำหรับวันจันทร์ (วันที่ 1 ของสัปดาห์)\n"
    . "Platform เป้าหมาย (ช่องทางเผยแพร่): facebook, linkedin\n"
    . 'REMINDER: Output ONLY the JSON object. Start with { and end with }. No other text.';
$weeklyMsg = content_plan_user_message(false, [
    'trigger_command' => 'Content Plan สัปดาห์หน้า',
    'week_start'      => '2026-09-07',
    'day_label'       => 'จันทร์',
    'day_order'       => 1,
    'platforms_str'   => 'facebook, linkedin',
    'source_topic'    => 'ไม่ควรถูกใช้ใน plan mode',
]);
check('weekly user message ตรงกับรูปแบบเดิมทุกตัวอักษร', $weeklyMsg === $expectedWeeklyMsg, $weeklyMsg);
check('plan mode ไม่ใช้ source_topic', !str_contains($weeklyMsg, 'Original User Topic/Seed'));

$expectedWeeklyNoPlatform = "Content Plan สัปดาห์หน้า\nสัปดาห์เริ่มต้น: 2026-09-07\n"
    . "สร้างโพสต์สำหรับวันอังคาร (วันที่ 2 ของสัปดาห์)\n"
    . 'REMINDER: Output ONLY the JSON object. Start with { and end with }. No other text.';
$weeklyNoPlatform = content_plan_user_message(false, [
    'trigger_command' => 'Content Plan สัปดาห์หน้า',
    'week_start'      => '2026-09-07',
    'day_label'       => 'อังคาร',
    'day_order'       => 2,
]);
check('weekly ไม่มี platform → รูปแบบเดิม (ไม่มีบรรทัด Platform)',
    $weeklyNoPlatform === $expectedWeeklyNoPlatform, $weeklyNoPlatform);

$planRule = content_plan_output_rule(false);
check('plan output rule ยังใช้ตัวอย่าง วันจันทร์/1',
    str_contains($planRule, '{"day_label":"วันจันทร์","day_order":1,'), $planRule);

// ─── 3.5 Monthly / Quarterly / Yearly ────────────────────────────────────────
echo "== 3.5 Monthly / Quarterly / Yearly DATE INSTRUCTION ==\n";

foreach (['monthly', 'quarterly', 'yearly'] as $pt) {
    $instr = content_plan_date_instruction($pt, '2026-09-01', '2026-09-30');
    check("{$pt} มี DATE INSTRUCTION", str_contains($instr, '## DATE INSTRUCTION'), $instr);
    check("{$pt} ระบุ plan range", str_contains($instr, 'start: 2026-09-01, end: 2026-09-30'), $instr);
    check("{$pt} ระบุ scheduled_date format", str_contains($instr, 'format YYYY-MM-DD'));
}
check('weekly ไม่มี DATE INSTRUCTION', content_plan_date_instruction('weekly', null, null) === '');
check('plan_type ว่าง ไม่มี DATE INSTRUCTION', content_plan_date_instruction('', null, null) === '');

$monthlySys = assembleSystemPrompt(false, 'monthly', '2026-09-01', '2026-09-30', ['facebook']);
check('monthly system prompt มี DATE INSTRUCTION', str_contains($monthlySys, '## DATE INSTRUCTION'));
check('monthly system prompt ยังใช้ schema เดิม', str_contains($monthlySys, '{"day_label":"วันจันทร์","day_order":1,'));
check('monthly system prompt ไม่มี direct guard', !str_contains($monthlySys, '## DIRECT CONTENT CREATION'));

// ─── สรุป ───────────────────────────────────────────────────────────────────
echo "\n{$pass} passed, {$fail} failed\n";
exit($fail > 0 ? 1 : 0);
