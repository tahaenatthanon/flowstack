<?php
/**
 * AEO checklist — deterministic Answer Engine Optimization quality gate.
 * No DB/network access. Evaluates the exact content object produced by generation.
 */

// Quality gate policy: 80+ is publishable when all required rules pass.
// 70–79 is needs_improvement; <70 is failed.
const AEO_GATE_PASS_SCORE = 80;
const AEO_GATE_WARN_SCORE = 70;
const AEO_MIN_ANSWER_CHARS = 40;
const AEO_MIN_QA = 2;

const AEO_WEIGHTS = [
    'direct_answer'       => ['weight' => 15, 'tier' => 'required'],
    'search_intent'       => ['weight' => 10, 'tier' => 'required'],
    'qa_structure'        => ['weight' => 12, 'tier' => 'required'],
    'heading_questions'   => ['weight' => 10, 'tier' => 'required'],
    'snippet_readiness'   => ['weight' => 12, 'tier' => 'required'],
    'paa_coverage'        => ['weight' => 10, 'tier' => 'required'],
    'entity_clarity'      => ['weight' => 10, 'tier' => 'required'],
    'structured_data'     => ['weight' => 11, 'tier' => 'required'],
];

function aeo_make_rule(string $key, string $status, string $message): array {
    $meta = AEO_WEIGHTS[$key] ?? ['weight' => 0, 'tier' => 'required'];
    $levelMap = ['passed' => 'pass', 'needs_improvement' => 'warn', 'failed' => 'fail', 'n/a' => 'skip', 'pending' => 'pending', 'skip' => 'skip'];
    return [
        'key' => $key,
        'level' => $levelMap[$status] ?? 'pending',
        'status' => $status,
        'tier' => $meta['tier'],
        'weight' => $meta['weight'],
        'score' => $status === 'passed' ? $meta['weight'] : ($status === 'needs_improvement' ? (int)round($meta['weight'] / 2) : 0),
        'critical' => false,
        'message' => $message,
    ];
}

function aeo_normalized_score(array $rules): int {
    $earned = 0;
    $possible = 0;
    foreach ($rules as $rule) {
        $status = $rule['status'] ?? 'skip';
        if (in_array($status, ['pending', 'n/a', 'skip'], true)) continue;
        $earned += (int)($rule['score'] ?? 0);
        $possible += (int)($rule['weight'] ?? 0);
    }
    return $possible > 0 ? (int)round(100 * $earned / $possible) : 0;
}

function aeo_gate_status(array $eval): string {
    foreach (($eval['rules'] ?? []) as $rule) {
        if (($rule['tier'] ?? 'required') === 'required' && ($rule['status'] ?? '') === 'failed') return 'failed';
    }
    $score = (int)($eval['score'] ?? 0);
    if ($score < AEO_GATE_WARN_SCORE) return 'failed';
    if ($score < AEO_GATE_PASS_SCORE) return 'needs_improvement';
    return 'passed';
}

function aeo_plain_text(string $html): string {
    $text = html_entity_decode(strip_tags($html), ENT_QUOTES | ENT_HTML5, 'UTF-8');
    return trim(preg_replace('/\s+/u', ' ', $text));
}

function aeo_contains(string $haystack, string $needle): bool {
    if ($needle === '' || $haystack === '') return false;
    return mb_stripos($haystack, $needle) !== false;
}

function aeo_first_paragraph(string $html): string {
    if (preg_match('/<p[^>]*>(.*?)<\/p>/is', $html, $m)) return trim(strip_tags($m[1]));
    return mb_substr(aeo_plain_text($html), 0, 400);
}

function aeo_headings(string $html): array {
    $out = [];
    if (preg_match_all('/<h[1-6][^>]*>(.*?)<\/h[1-6]>/is', $html, $m)) {
        foreach ($m[1] as $heading) {
            $heading = trim(strip_tags($heading));
            if ($heading !== '') $out[] = $heading;
        }
    }
    return $out;
}

function aeo_questionish(string $text): bool {
    $text = trim($text);
    if ($text === '') return false;
    if (preg_match('/[?？]/u', $text)) return true;

    // คำถามไทยที่ขึ้นต้นด้วยคำถาม (how-to / why / when / who / where style)
    $thaiPrefixes = ['วิธี', 'ทำไม', 'เมื่อไร', 'เท่าไร', 'ใคร', 'ที่ไหน'];
    foreach ($thaiPrefixes as $prefix) {
        if (mb_stripos($text, $prefix) === 0) return true;
    }

    // คำถามไทยที่ปรากฏกลาง/ท้ายประโยค เช่น "YouTube คืออะไร", "เลือกแพลตฟอร์มอย่างไร"
    // (เดิมใช้ \b ซึ่งใช้กับภาษาไทยไม่ได้ — ตรวจด้วย mb_stripos แบบ contains แทน)
    $thaiAnywhere = ['คืออะไร', 'อะไร', 'อย่างไร', 'ไหม', 'หรือไม่', 'หรือเปล่า'];
    foreach ($thaiAnywhere as $q) {
        if (mb_stripos($text, $q) !== false) return true;
    }

    return (bool)preg_match('/^(what|why|how|when|where|who|which|can|does|is|are)\b/i', $text);
}

function aeo_answer_blocks(string $html): int {
    $count = 0;
    if (preg_match_all('/<p[^>]*>(.*?)<\/p>/is', $html, $m)) {
        foreach ($m[1] as $p) {
            $text = trim(strip_tags($p));
            if (mb_strlen($text) < AEO_MIN_ANSWER_CHARS) continue;

            $thaiSignals = ['คือ', 'ได้แก่', 'หมายถึง', 'สามารถ', 'วิธี', 'ขั้นตอน', 'คำตอบ', 'โดยสรุป', 'สรุปคือ', 'เป็นการ'];
            $thaiMatch = false;
            foreach ($thaiSignals as $signal) {
                if (mb_stripos($text, $signal) !== false) {
                    $thaiMatch = true;
                    break;
                }
            }

            $englishMatch = (bool)preg_match('/(?:^|\s)(helps|means|is|are|can)\b/iu', $text);
            if ($thaiMatch || $englishMatch) $count++;
        }
    }
    return $count;
}

function aeo_structured_types(mixed $value): array {
    if (is_string($value)) $value = json_decode($value, true);
    if (!is_array($value)) return [];
    $types = [];
    $collect = static function(array $node) use (&$types): void {
        if (isset($node['@type'])) {
            foreach ((array)$node['@type'] as $type) if (is_string($type)) $types[] = trim($type);
        }
    };
    if (array_is_list($value)) {
        foreach ($value as $node) {
            if (is_array($node)) {
                $collect($node);
            }
        }
    } else {
        $collect($value);
    }

    foreach (($value['@graph'] ?? []) as $node) {
        if (is_array($node)) {
            $collect($node);
        }
    }
    return array_values(array_unique($types));
}

function aeo_brief_paa(array $brief): array {
    $out = [];
    foreach (($brief['paa'] ?? []) as $entry) {
        $q = is_string($entry) ? trim($entry) : trim((string)($entry['question'] ?? ''));
        if ($q !== '') $out[] = $q;
    }
    return $out;
}

function aeo_evaluate(array $item): array {
    $rules = [];
    $title = trim((string)($item['title'] ?? ''));
    $seoTitle = trim((string)($item['seo_title'] ?? ''));
    $type = strtolower(trim((string)($item['type'] ?? 'article')));
    $keywords = array_values(array_filter(array_map('trim', explode(',', (string)($item['meta_keywords'] ?? '')))));
    $primary = $keywords[0] ?? '';
    $html = '';
    $article = $item['article_content'] ?? null;
    if (is_array($article)) $html = trim((string)($article['html'] ?? ''));
    elseif (is_string($article)) {
        $decoded = json_decode($article, true);
        $html = is_array($decoded) ? trim((string)($decoded['html'] ?? '')) : trim($article);
    }
    $text = aeo_plain_text($html);
    $first = aeo_first_paragraph($html);
    $headings = aeo_headings($html);
    if ($type === 'video') {
        $parts = [];
        $scriptData = is_array($article) ? $article : [];
        foreach (($scriptData['scripts'] ?? []) as $script) if (is_string($script) && trim($script) !== '') $parts[] = trim($script);
        foreach (($scriptData['script_sections'] ?? []) as $label => $script) if (is_string($script) && trim($script) !== '') $parts[] = trim((string)$label) . ': ' . trim($script);
        $text = trim(implode("\n\n", $parts));
        $first = $text !== '' ? mb_substr($text, 0, 400) : $first;
        $headings = array_values(array_filter(array_map('trim', array_keys($scriptData['script_sections'] ?? []))));
    }
    $brief = is_array($item['research_brief'] ?? null) ? $item['research_brief'] : null;
    $intent = $brief ? trim((string)($brief['intent'] ?? '')) : '';
    $paa = $brief ? aeo_brief_paa($brief) : [];

    // 1. Direct answer: the beginning must answer the main topic, not start with filler.
    $directOk = mb_strlen($first) >= AEO_MIN_ANSWER_CHARS &&
        ($primary === '' || aeo_contains($first, $primary) || aeo_contains($first, $title) || aeo_contains($first, $seoTitle));
    if ($directOk) $rules[] = aeo_make_rule('direct_answer', 'passed', 'ย่อหน้าแรกตอบประเด็นหลักทันทีและมีบริบทเพียงพอ');
    elseif (mb_strlen($first) >= AEO_MIN_ANSWER_CHARS) $rules[] = aeo_make_rule('direct_answer', 'needs_improvement', 'ย่อหน้าแรกมีคำตอบแล้ว แต่ควรผูกกับหัวข้อ/คีย์เวิร์ดหลักให้ชัดขึ้น');
    else $rules[] = aeo_make_rule('direct_answer', 'failed', 'ย่อหน้าแรกสั้นหรือไม่มีคำตอบโดยตรงของหัวข้อหลัก');

    // 2. Search intent: deterministic best-effort using intent signals already used by SEO.
    if (!$intent) {
        $rules[] = aeo_make_rule('search_intent', 'n/a', 'ไม่มี Research intent ให้ตรวจ');
    } else {
        $signals = function(string $i): array {
            return match (strtolower(trim($i))) {
                'commercial' => ['เปรียบเทียบ','รีวิว','ดีที่สุด','คุ้มค่า','best','review','vs','เทียบ','แนะนำ'],
                'transactional' => ['ซื้อ','สมัคร','ราคา','สั่งซื้อ','โปรโมชั่น','ส่วนลด','buy','price','order','จอง'],
                'navigational' => ['เว็บไซต์','ล็อกอิน','login','official','เข้าสู่ระบบ','download','ดาวน์โหลด'],
                default => ['คือ','วิธี','ทำไม','อย่างไร','ขั้นตอน','how','what','why','guide','แนวทาง'],
            };
        };
        $own = 0; $other = 0;
        foreach (['commercial','transactional','navigational','informational'] as $i) {
            foreach ($signals($i) as $term) {
                $hits = substr_count(mb_strtolower($text), mb_strtolower($term));
                if (strtolower($intent) === $i) $own += $hits; else $other += $hits;
            }
        }
        if ($own >= 1 && $own >= $other) $rules[] = aeo_make_rule('search_intent', 'passed', "เนื้อหามีสัญญาณสอดคล้องกับ intent {$intent}");
        elseif ($other > $own) $rules[] = aeo_make_rule('search_intent', 'failed', "เนื้อหามีสัญญาณของ intent อื่นมากกว่า intent {$intent}");
        else $rules[] = aeo_make_rule('search_intent', 'needs_improvement', "เพิ่มส่วนที่ตอบโจทย์ search intent {$intent} ให้ชัดเจนขึ้น");
    }

    // 3. Q&A structure: at least two question-answer opportunities in article.
    $questionHeadings = 0;
    foreach ($headings as $heading) if (aeo_questionish($heading)) $questionHeadings++;
    $answerBlocks = aeo_answer_blocks($html);
    if ($questionHeadings >= AEO_MIN_QA && $answerBlocks >= AEO_MIN_QA) $rules[] = aeo_make_rule('qa_structure', 'passed', "มีโครงสร้างคำถาม-คำตอบ {$questionHeadings} จุด และ answer blocks {$answerBlocks} จุด");
    elseif ($questionHeadings >= 1 && $answerBlocks >= 1) $rules[] = aeo_make_rule('qa_structure', 'needs_improvement', 'มี Q&A แล้ว แต่ควรเพิ่มคำถามและคำตอบที่ชัดเจนอีก');
    else $rules[] = aeo_make_rule('qa_structure', 'failed', 'ไม่พบโครงสร้างคำถาม-คำตอบที่ชัดเจนเพียงพอ');

    // 4. Heading structure aligned with questions/intent.
    if (count($headings) >= 2 && ($questionHeadings >= 1 || $primary === '' || count($headings) >= 3)) $rules[] = aeo_make_rule('heading_questions', 'passed', 'หัวข้อแบ่งประเด็นชัดเจนและรองรับคำถามของผู้ค้นหา');
    elseif (count($headings) >= 1) $rules[] = aeo_make_rule('heading_questions', 'needs_improvement', 'ควรใช้ H2/H3 เป็นคำถามหรือประเด็นที่ผู้ค้นหาต้องการคำตอบ');
    else $rules[] = aeo_make_rule('heading_questions', 'failed', 'ไม่มี heading structure สำหรับให้ Answer Engine แยกประเด็น');

    // 5. Featured snippet readiness: concise answer paragraph/list/table blocks.
    $lists = preg_match_all('/<(?:ul|ol|table)\b/i', $html);
    $snippetReady = $answerBlocks >= 2 || $lists >= 1;
    if ($snippetReady) $rules[] = aeo_make_rule('snippet_readiness', 'passed', 'มี answer blocks และ/หรือ list/table ที่เหมาะสำหรับการดึงคำตอบ');
    elseif ($answerBlocks >= 1) $rules[] = aeo_make_rule('snippet_readiness', 'needs_improvement', 'มี answer block แต่ควรเพิ่มคำตอบแบบสั้น/list/table สำหรับ snippet');
    else $rules[] = aeo_make_rule('snippet_readiness', 'failed', 'ไม่พบ answer block ที่เหมาะสำหรับ Featured Snippet');

    // 6. PAA coverage. Exact match is intentionally normalized to a few significant tokens, not whole sentence.
    if (!$brief || !$paa) {
        $rules[] = aeo_make_rule('paa_coverage', 'n/a', 'ไม่มี PAA จาก Research ให้ตรวจ');
    } else {
        $covered = 0;
        foreach ($paa as $q) {
            $tokens = array_values(array_filter(preg_split('/\s+/u', mb_strtolower(preg_replace('/[^\p{L}\p{N}\s]/u', ' ', $q))), fn($t) => mb_strlen($t) >= 4));
            $matched = 0;
            foreach (array_slice($tokens, 0, 8) as $token) if (aeo_contains(mb_strtolower($text), $token)) $matched++;
            if ($matched >= min(2, count(array_slice($tokens, 0, 8)))) $covered++;
        }
        $ratio = count($paa) > 0 ? $covered / count($paa) : 0;
        if ($ratio >= 0.5) $rules[] = aeo_make_rule('paa_coverage', 'passed', "ครอบคลุม PAA {$covered}/" . count($paa) . ' ข้อ');
        elseif ($covered > 0) $rules[] = aeo_make_rule('paa_coverage', 'needs_improvement', "ครอบคลุม PAA {$covered}/" . count($paa) . ' ข้อ ควรตอบเพิ่ม');
        else $rules[] = aeo_make_rule('paa_coverage', 'failed', 'ไม่พบเนื้อหาที่ตอบคำถาม PAA จาก Research');
    }

    // 7. Entity/topic clarity.
    $entityOk = $title !== '' && mb_strlen($text) >= 200 && ($primary === '' || aeo_contains($text, $primary));
    if ($entityOk) $rules[] = aeo_make_rule('entity_clarity', 'passed', 'หัวข้อหลักและคีย์เวิร์ด/เอนทิตีสำคัญปรากฏชัดในเนื้อหา');
    elseif ($title !== '' && mb_strlen($text) >= 100) $rules[] = aeo_make_rule('entity_clarity', 'needs_improvement', 'ควรระบุชื่อหัวข้อหลักและเอนทิตีสำคัญให้ชัดเจนขึ้น');
    else $rules[] = aeo_make_rule('entity_clarity', 'failed', 'เนื้อหาไม่ชัดเจนพอที่จะระบุหัวข้อหลัก');

    // 8. Structured data must describe the actual content type.
    $sd = $item['structured_data'] ?? '';
    $types = aeo_structured_types($sd);
    if ($type === 'video') {
        $hasVideo = in_array('VideoObject', $types, true);
        if (!$sd || !$hasVideo) $rules[] = aeo_make_rule('structured_data', 'failed', 'วิดีโอต้องมี VideoObject structured data ที่สอดคล้องกับเนื้อหา');
        else $rules[] = aeo_make_rule('structured_data', 'passed', 'structured data มี VideoObject และสอดคล้องกับวิดีโอ');
    } else {
        $hasArticle = in_array('Article', $types, true) || in_array('BlogPosting', $types, true);
        $hasFaq = in_array('FAQPage', $types, true);
        if (!$sd || !$hasArticle) $rules[] = aeo_make_rule('structured_data', 'failed', 'ต้องมี structured data แบบ Article/BlogPosting ที่สอดคล้องกับบทความ');
        elseif ($questionHeadings >= 2 && !$hasFaq) $rules[] = aeo_make_rule('structured_data', 'needs_improvement', 'บทความมี Q&A หลายจุด แต่ยังไม่มี FAQPage schema ที่สอดคล้อง');
        else $rules[] = aeo_make_rule('structured_data', 'passed', 'structured data มี Article/BlogPosting และสอดคล้องกับรูปแบบเนื้อหา');
    }

    $score = aeo_normalized_score($rules);
    return ['score' => $score, 'gate' => aeo_gate_status(['score' => $score, 'rules' => $rules]), 'rules' => $rules];
}

function aeo_generation_requirements(): string {
    return implode("\n", [
        '- [direct_answer] ย่อหน้าแรกต้องตอบคำถาม/หัวข้อหลักทันที ไม่ใช้บทนำลอย ๆ และควรมีคำตอบอย่างน้อย 40 ตัวอักษร',
        '- [search_intent] เมื่อมี Research ต้องเขียนให้ตรงกับ search intent ของ Research',
        '- [qa_structure] ต้องมี Q&A ที่ชัดเจนอย่างน้อย 2 ชุด พร้อมคำตอบที่มีสาระ',
        '- [heading_questions] ใช้ H2/H3 เป็นคำถามหรือประเด็นที่ผู้ค้นหาต้องการคำตอบ',
        '- [snippet_readiness] สร้าง answer paragraph สั้น กระชับ และใช้ list/table เมื่อเหมาะสม',
        '- [paa_coverage] เมื่อมี PAA จาก Research ต้องตอบ PAA อย่างน้อย 50% ของคำถามที่ให้มา',
        '- [entity_clarity] ระบุหัวข้อหลัก ชื่อผลิตภัณฑ์/บริการ และเอนทิตีสำคัญอย่างชัดเจน ไม่ใช้คำกำกวม',
        '- [structured_data] บทความต้องมี Article/BlogPosting schema และวิดีโอต้องมี VideoObject; ถ้ามี Q&A จริงให้ FAQPage schema สอดคล้องกับคำถามและคำตอบจริง',
        '- ห้ามสร้างข้อเท็จจริง แหล่งอ้างอิง หรือคำตอบที่ไม่มีข้อมูลรองรับจาก Topic, Brand Context, Knowledge Base หรือ Research ที่ให้มา',
    ]);
}
