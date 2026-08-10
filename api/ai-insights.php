<?php
// GET /api/ai-insights.php - AI-driven business insights dashboard
// Uses ai_analyst_model_id for AI-generated insight cards when configured.

require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/config.php';

$tokenData = requireAuth();
$userId    = $tokenData['user_id'];
$tenantId  = $tokenData['tenant_id'];
$db        = getDB();
$method    = getMethod();

if ($method !== 'GET') {
    jsonError('Method not allowed', 405);
}

$isAdmin = isTenantAdmin($db, $userId, $tenantId);

// ── Scope helpers ──────────────────────────────────────────────────────
$tenantOnly = [$tenantId];

if ($isAdmin) {
    $taskScope    = 't.tenant_id = ?';
    $taskParams   = [$tenantId];
    $projScope    = 'tenant_id = ?';
    $projParams   = [$tenantId];
} else {
    $stmt = $db->prepare("SELECT id FROM projects WHERE tenant_id = ? AND manager_id = ? AND deleted_at IS NULL AND kind = 'project'");
    $stmt->execute([$tenantId, $userId]);
    $projectIds = array_column($stmt->fetchAll(PDO::FETCH_ASSOC), 'id');

    if (empty($projectIds)) {
        jsonResponse([
            'summary' => [
                'total_projects'       => 0,
                'overdue_tasks'        => 0,
                'open_tickets'         => 0,
                'pipeline_value'       => 0,
                'completed_this_month' => 0,
                'delayed_projects'     => 0,
                'expiring_contracts'   => 0,
                'leads_no_proposal'    => 0,
            ],
            'insights' => [],
        ]);
        exit;
    }

    $in        = implode(',', array_fill(0, count($projectIds), '?'));
    $taskScope = "t.tenant_id = ? AND t.project_id IN ($in)";
    $taskParams = array_merge([$tenantId], $projectIds);
    $projScope  = 'tenant_id = ? AND id IN (' . $in . ')';
    $projParams = array_merge([$tenantId], $projectIds);
}

// ── Summary queries ────────────────────────────────────────────────────

// Total active projects
$stmt = $db->prepare("SELECT COUNT(*) FROM projects WHERE $projScope AND deleted_at IS NULL AND kind = 'project'");
$stmt->execute($projParams);
$totalProjects = (int)$stmt->fetchColumn();

// Overdue tasks
$stmt = $db->prepare("SELECT COUNT(*) FROM tasks t WHERE $taskScope AND t.status NOT IN ('completed','cancelled') AND t.end_date < CURDATE()");
$stmt->execute($taskParams);
$overdueTasks = (int)$stmt->fetchColumn();

// Open support tickets
$stmt = $db->prepare("SELECT COUNT(*) FROM support_tickets WHERE tenant_id = ? AND status IN ('open','in-progress','pending')");
$stmt->execute($tenantOnly);
$openTickets = (int)$stmt->fetchColumn();

// Pipeline value
$stmt = $db->prepare("SELECT COALESCE(SUM(value), 0) FROM sales_opportunities WHERE tenant_id = ? AND stage NOT IN ('won','lost')");
$stmt->execute($tenantOnly);
$pipelineValue = (float)$stmt->fetchColumn();

// Completed tasks this month
$stmt = $db->prepare("SELECT COUNT(*) FROM tasks t WHERE $taskScope AND t.status = 'completed' AND t.completed_date >= DATE_FORMAT(CURDATE(), '%Y-%m-01')");
$stmt->execute($taskParams);
$completedThisMonth = (int)$stmt->fetchColumn();

// Delayed projects
$stmt = $db->prepare("SELECT COUNT(*) FROM projects WHERE $projScope AND deleted_at IS NULL AND kind = 'project' AND status = 'delayed'");
$stmt->execute($projParams);
$delayedProjects = (int)$stmt->fetchColumn();

// Expiring contracts (within 30 days)
$stmt = $db->prepare("SELECT COUNT(*) FROM support_contracts WHERE tenant_id = ? AND status IN ('active','expiring') AND end_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY)");
$stmt->execute($tenantOnly);
$expiringContracts = (int)$stmt->fetchColumn();

// Leads without proposal
$stmt = $db->prepare("SELECT COUNT(*) FROM sales_opportunities WHERE tenant_id = ? AND stage IN ('lead','qualified')");
$stmt->execute($tenantOnly);
$leadsNoProposal = (int)$stmt->fetchColumn();

$summary = [
    'total_projects'       => $totalProjects,
    'overdue_tasks'        => $overdueTasks,
    'open_tickets'         => $openTickets,
    'pipeline_value'       => $pipelineValue,
    'completed_this_month' => $completedThisMonth,
    'delayed_projects'     => $delayedProjects,
    'expiring_contracts'   => $expiringContracts,
    'leads_no_proposal'    => $leadsNoProposal,
];

// ── AI-generated insight cards ─────────────────────────────────────────

$insights = [];

// Resolve AI analyst model
$aiOk   = false;
$aiKey  = '';
$aiBase = 'https://api.kilo.ai/api/gateway';
$aiModel = 'openai/gpt-4o-mini';

try {
    $stmt = $db->prepare("
        SELECT ap.api_base_url, ap.api_key_encrypted,
               COALESCE(am_a.model_id, am_d.model_id) AS model_id
        FROM company_settings cs
        LEFT JOIN ai_models am_a ON am_a.id = cs.ai_analyst_model_id
        LEFT JOIN ai_models am_d ON am_d.id = cs.ai_default_model_id
        JOIN ai_providers ap ON ap.id = COALESCE(am_a.provider_id, am_d.provider_id, cs.ai_active_provider_id)
        WHERE cs.tenant_id = ?
          AND ap.api_key_encrypted IS NOT NULL AND ap.api_key_encrypted != ''
        LIMIT 1
    ");
    $stmt->execute([$tenantId]);
    $row = $stmt->fetch();
    if ($row && !empty($row['api_key_encrypted'])) {
        $plain = decryptApiKey($row['api_key_encrypted']);
        if (!empty(trim($plain))) {
            $aiKey   = trim($plain);
            $aiBase  = rtrim($row['api_base_url'] ?: $aiBase, '/');
            $aiModel = $row['model_id'] ?: $aiModel;
            $aiOk    = true;
        }
    }
} catch (Exception $e) { /* fall through to rule-based */ }

if (!$aiOk && !empty(KILO_API_TOKEN)) {
    $aiKey  = KILO_API_TOKEN;
    $aiBase = rtrim(KILO_API_BASE_URL ?: 'https://api.kilo.ai/api/gateway', '/');
    $aiOk   = true;
}

if ($aiOk) {
    $prompt = "You are a Thai business analyst. ตอบเป็นภาษาไทยเท่านั้น. Based on the data below, provide 3-6 concise insight cards in JSON array format. Each card: title (Thai, short), desc (Thai, 1-sentence actionable recommendation), icon (one of: AlertTriangle, TrendingUp, TrendingDown, Lightbulb, BarChart3, Clock, FileText, Sparkles), color (one of: red, orange, amber, green, blue). Be specific with numbers. Return ONLY valid JSON array.\n\nData:\n- Active projects: $totalProjects\n- Overdue tasks: $overdueTasks\n- Open tickets: $openTickets\n- Pipeline value: " . number_format($pipelineValue, 2) . " THB\n- Completed this month: $completedThisMonth\n- Delayed projects: $delayedProjects\n- Contracts expiring in 30 days: $expiringContracts\n- Leads without proposal: $leadsNoProposal";

    $ch = curl_init($aiBase . '/chat/completions');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_SSL_VERIFYPEER => defined('AI_SSL_VERIFY') ? AI_SSL_VERIFY : true,
        CURLOPT_TIMEOUT        => 30,
        CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_HTTPHEADER     => [
            'Authorization: Bearer ' . $aiKey,
            'Content-Type: application/json',
        ],
        CURLOPT_POSTFIELDS => json_encode([
            'model'       => $aiModel,
            'messages'    => [['role' => 'user', 'content' => $prompt]],
            'temperature' => 0.7,
            'max_tokens'  => 2048,
        ]),
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode === 200 && $response) {
        $json    = json_decode($response, true);
        $content = $json['choices'][0]['message']['content'] ?? '';
        $content = trim(preg_replace('/^```(?:json)?\s*|\s*```$/i', '', $content));
        $parsed  = json_decode($content, true);
        if (is_array($parsed)) {
            foreach ($parsed as $item) {
                if (!empty($item['title']) && !empty($item['desc'])) {
                    $insights[] = [
                        'title' => $item['title'],
                        'desc'  => $item['desc'],
                        'icon'  => $item['icon'] ?? 'Sparkles',
                        'color' => $item['color'] ?? 'blue',
                    ];
                }
            }
        }
    }
}

// ── Rule-based fallback ────────────────────────────────────────────────
if (empty($insights)) {
    if ($overdueTasks > 0) {
        $insights[] = ['title'=>"งานเกินกำหนด $overdueTasks รายการ", 'desc'=>'ควรจัดลำดับความสำคัญใหม่หรือเจรจาขยายเวลาเพื่อป้องกันงานค้างสะสม', 'icon'=>'AlertTriangle', 'color'=>'red'];
    }
    if ($delayedProjects > 0) {
        $insights[] = ['title'=>"โปรเจกต์ล่าช้า $delayedProjects รายการ", 'desc'=>'ประชุมทีมเพื่อระบุสาเหตุความล่าช้าและวางแผนแก้ไขโดยเร็ว', 'icon'=>'Clock', 'color'=>'orange'];
    }
    if ($leadsNoProposal > 0) {
        $insights[] = ['title'=>"$leadsNoProposal leads รอ Proposal", 'desc'=>'เร่งออกใบเสนอราคาเพื่อเพิ่มโอกาสปิดดีล — leads ที่ไม่ได้รับ proposal มีโอกาสหลุดสูง', 'icon'=>'FileText', 'color'=>'blue'];
    }
    if ($expiringContracts > 0) {
        $insights[] = ['title'=>"สัญญาใกล้หมดอายุ $expiringContracts ฉบับ", 'desc'=>'ติดต่อลูกค้าเพื่อเสนอต่ออายุสัญญาล่วงหน้า ป้องกันรายได้ขาดช่วง', 'icon'=>'Lightbulb', 'color'=>'amber'];
    }
    if ($openTickets > 0) {
        $insights[] = ['title'=>"Ticket ค้าง $openTickets รายการ", 'desc'=>'ตรวจสอบ SLA และมอบหมายทีมจัดการ — ticket ที่ค้างนานกระทบความพึงพอใจลูกค้า', 'icon'=>'AlertTriangle', 'color'=>'amber'];
    }
    if ($pipelineValue > 0.01) {
        $valM = number_format($pipelineValue / 1000000, 1);
        $insights[] = ['title'=>"Pipeline มูลค่า {$valM}M บาท", 'desc'=>'โอกาสขายใน pipeline ยังปิดได้ — ติดตามผลอย่างใกล้ชิดเพื่อเร่งปิดดีล', 'icon'=>'TrendingUp', 'color'=>'green'];
    }
    if ($completedThisMonth > 0) {
        $insights[] = ['title'=>"เสร็จสิ้น $completedThisMonth งานในเดือนนี้", 'desc'=>'ทีมทำงานได้ดี — พิจารณาให้รางวัลหรือชื่นชมเพื่อรักษาขวัญกำลังใจ', 'icon'=>'Sparkles', 'color'=>'green'];
    }
    if (empty($insights)) {
        $insights[] = ['title'=>'ระบบทำงานได้ดีปกติ', 'desc'=>'ไม่พบประเด็นที่ต้องให้ความสนใจเป็นพิเศษ — ยอดเยี่ยม', 'icon'=>'Sparkles', 'color'=>'green'];
    }
}

jsonResponse([
    'summary'  => $summary,
    'insights' => $insights,
]);
