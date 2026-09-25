<?php
// ─── Content BI aggregations ───────────────────────────────────────
// Server-side aggregation for the content dashboard widgets. Kept out of
// content-items.php so the item list payload stays small: every number here is
// a COUNT/AVG over columns the list endpoint does not ship to the client
// (approved_at, published_at, image_gen_status, seo_*).
//
// Actions:
//   ?action=overview   → End-to-End Overview + BI Summary (spec content-overview-bi):
//                        KPI, production funnel, status, unpublished aging,
//                        publishing health (+ failed rows), today/tomorrow
//                        schedule, engagement trend, platform performance
//   ?action=analytics  → throughput trend, lead time, SEO, plan conversion,
//                        publish success by platform
//   ?action=page_insights → Facebook page metrics per day (facebook_page_insights_daily)
//                        for the analytics → social sub-tab, &from/&to like analytics
//
// ?action=analytics accepts &from=YYYY-MM-DD&to=YYYY-MM-DD. ?action=overview takes no date
// parameters: it summarizes all data the tenant has, with no period comparison
// (content-overview-bi).
//
// Page metrics come from facebook_page_insights_daily (filled daily by cron
// facebook-page-insights-sync); everything else reads existing content tables.
//
// "Engagement" of a social post means one thing everywhere in this file:
// Reaction + Comment + Share + Click (socialEngagement() below). Video plays are
// reported separately as views and are never part of it.

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth.php';

$db       = getDB();
$method   = getMethod();
$auth     = requireAuth();
$tenantId = $auth['tenant_id'];
$action   = $_GET['action'] ?? '';

if ($method !== 'GET') jsonError('Method not allowed', 405);

/**
 * Percentile over an ascending numeric list using nearest-rank.
 * Computed in PHP rather than SQL so this works on MariaDB builds without
 * PERCENTILE_CONT; sample sizes here are per-tenant content counts (small).
 */
function percentile(array $sorted, float $p): ?float {
    $n = count($sorted);
    if ($n === 0) return null;
    if ($n === 1) return (float)$sorted[0];
    $rank = (int)ceil($p * $n) - 1;
    if ($rank < 0) $rank = 0;
    if ($rank >= $n) $rank = $n - 1;
    return (float)$sorted[$rank];
}

/**
 * Read a YYYY-MM-DD query parameter.
 * Returns null when the param is absent/empty so the caller applies its own
 * default. A present-but-malformed value aborts with 400 — a bad date must never
 * reach SQL and must never surface as a 500.
 */
function dateParam(string $name): ?string {
    $raw = trim((string)($_GET[$name] ?? ''));
    if ($raw === '') return null;
    $d = DateTime::createFromFormat('Y-m-d', $raw);
    // createFromFormat rolls overflow dates forward (2026-02-31 → 2026-03-03),
    // so the round-trip comparison is what rejects impossible calendar dates.
    if ($d === false || $d->format('Y-m-d') !== $raw) {
        jsonError("พารามิเตอร์ $name ต้องเป็นวันที่รูปแบบ YYYY-MM-DD", 400);
    }
    return $raw;
}

/**
 * Latest-per-(content item, ช่องทาง) social engagement rows for a tenant.
 * Mirrors the dedup ?action=analytics uses for its `social` block below:
 * content_post_metrics keeps every sync round, so only the most recent row per
 * (content_item_id, ช่องทาง) is kept — falling back to platform_post_id as the
 * ช่องทาง key when channel_id is NULL (channel row deleted, FK SET NULL).
 * Pass $fromDt/$toDt as null for an all-time cohort (no date filter).
 *
 * @return array rows: content_item_id, platform, published_at, views, likes,
 *               clicks, comments, shares (the last three NULL = not reported)
 */
function fetchSocialSeriesRows(PDO $db, string $tenantId, ?string $fromDt, ?string $toDt): array {
    $cohortSql = '';
    $params = [$tenantId, $tenantId];
    if ($fromDt !== null && $toDt !== null) {
        $cohortSql = 'AND ci.published_at BETWEEN ? AND ?';
        $params[] = $fromDt;
        $params[] = $toDt;
    }
    $stmt = $db->prepare(
        "SELECT m.content_item_id,
                m.platform,
                ci.published_at,
                MAX(m.views) AS views,
                MAX(m.likes) AS likes,
                MAX(m.clicks)   AS clicks,
                MAX(m.comments) AS comments,
                MAX(m.shares)   AS shares
         FROM content_post_metrics m
         JOIN content_items ci ON ci.id = m.content_item_id
         JOIN (SELECT content_item_id,
                      COALESCE(channel_id, CONCAT('#', platform_post_id)) AS series_key,
                      MAX(fetched_at) AS mx
                 FROM content_post_metrics
                WHERE tenant_id = ?
                GROUP BY content_item_id, series_key) t
           ON t.content_item_id = m.content_item_id
          AND t.series_key = COALESCE(m.channel_id, CONCAT('#', m.platform_post_id))
          AND t.mx = m.fetched_at
        WHERE m.tenant_id = ?
          AND m.platform IN ('facebook', 'instagram')
          $cohortSql
        GROUP BY m.content_item_id,
                 COALESCE(m.channel_id, CONCAT('#', m.platform_post_id)),
                 m.platform, ci.published_at"
    );
    $stmt->execute($params);
    return $stmt->fetchAll(PDO::FETCH_ASSOC);
}

/**
 * Parts of post-level Engagement → the content_post_metrics column each comes from.
 * Save is not here on purpose: Facebook has no post-level save metric (post_saves
 * is rejected as invalid). Video plays (views) are not interactions and stay out.
 */
const ENGAGEMENT_PARTS = [
    'reactions' => 'likes',
    'comments'  => 'comments',
    'shares'    => 'shares',
    'clicks'    => 'clicks',
];

/**
 * Engagement breakdown of a set of deduped metrics rows. A NULL part (not reported
 * yet — rows synced before the column existed, or a platform without it) adds 0.
 *
 * @return array{reactions: int, comments: int, shares: int, clicks: int}
 */
function engagementBreakdown(array $rows): array {
    $out = array_fill_keys(array_keys(ENGAGEMENT_PARTS), 0);
    foreach ($rows as $r) {
        foreach (ENGAGEMENT_PARTS as $part => $col) {
            $out[$part] += (int)($r[$col] ?? 0);
        }
    }
    return $out;
}

/** Engagement of one metrics row = Reaction + Comment + Share + Click. */
function socialEngagement(array $row): int {
    return array_sum(engagementBreakdown([$row]));
}

/**
 * How each Facebook page metric may be combined across days. The single place
 * this rule lives — ?action=page_insights and overview's page_summary both read
 * it, so the two can never disagree. Anything not listed is 'sum' (NO MAGIC:
 * the default is stated here, not implied somewhere else).
 *   latest     = running total per day (a gauge) — summing it is wrong
 *                (page_follows 2,2,2… over 28 days is 2 followers, not 56)
 *   object_sum = value per day is an object by reaction type; sum each type
 *   daily_only = unique count per day; uniques cannot be added across days
 */
const PAGE_METRIC_AGG = [
    'page_follows'                      => 'latest',
    'page_actions_post_reactions_total' => 'object_sum',
    'page_total_media_view_unique'      => 'daily_only',
];

function pageMetricAgg(string $metric): string {
    return PAGE_METRIC_AGG[$metric] ?? 'sum';
}

/**
 * Facebook page insights for a tenant over [$from, $to] (YYYY-MM-DD, inclusive),
 * read from facebook_page_insights_daily (filled by cron facebook-page-insights-sync).
 *
 * @return array {
 *   has_data:        bool     false = no row ever synced for this tenant (not "all zero")
 *   last_fetched_at: ?string
 *   totals:          array<metric, ?int>  combined per PAGE_METRIC_AGG; daily_only → null
 *   breakdown:       array<metric, array<type, int>>  object_sum metrics, summed per type
 *   first:           array<metric, ?int>  value on the first day in range that has data
 *                                         (latest metrics only — for the "+N" change)
 *   daily:           list<array{date: string, ...metric: ?int}>  every day in range,
 *                                         null where no row exists for that day
 * }
 */
function pageInsightsRange(PDO $db, string $tenantId, string $from, string $to): array {
    $any = $db->prepare('SELECT MAX(fetched_at) FROM facebook_page_insights_daily WHERE tenant_id = ?');
    $any->execute([$tenantId]);
    $lastFetched = $any->fetchColumn() ?: null;

    $stmt = $db->prepare(
        "SELECT metric_date, metric, value, value_json
           FROM facebook_page_insights_daily
          WHERE tenant_id = ? AND metric_date BETWEEN ? AND ?
          ORDER BY metric_date"
    );
    $stmt->execute([$tenantId, $from, $to]);

    $byDate = []; $totals = []; $breakdown = []; $first = []; $latest = [];
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $r) {
        $m = $r['metric'];
        $v = $r['value'] === null ? null : (int)$r['value'];
        $byDate[$r['metric_date']][$m] = $v;
        if ($v === null) continue;

        switch (pageMetricAgg($m)) {
            case 'latest':
                // rows are ordered by date, so the last one seen is the latest
                if (!array_key_exists($m, $first)) $first[$m] = $v;
                $latest[$m] = $v;
                break;
            case 'daily_only':
                break;
            case 'object_sum':
                $totals[$m] = ($totals[$m] ?? 0) + $v;
                $obj = $r['value_json'] !== null ? json_decode($r['value_json'], true) : null;
                if (is_array($obj)) {
                    foreach ($obj as $type => $n) {
                        $breakdown[$m][$type] = ($breakdown[$m][$type] ?? 0) + (int)$n;
                    }
                }
                break;
            default:
                $totals[$m] = ($totals[$m] ?? 0) + $v;
        }
    }
    $totals = $latest + $totals;
    foreach (array_keys(PAGE_METRIC_AGG, 'daily_only', true) as $m) $totals[$m] = null;

    // Dense axis so charts show gaps as gaps, not as missing days.
    $metrics = [];
    foreach ($byDate as $row) $metrics += array_fill_keys(array_keys($row), true);
    $daily = [];
    for ($d = new DateTime($from), $end = new DateTime($to); $d <= $end; $d->modify('+1 day')) {
        $k = $d->format('Y-m-d');
        $point = ['date' => $k];
        foreach (array_keys($metrics) as $m) $point[$m] = $byDate[$k][$m] ?? null;
        $daily[] = $point;
    }

    return [
        'has_data'        => $lastFetched !== null,
        'last_fetched_at' => $lastFetched,
        'totals'          => $totals,
        'breakdown'       => (object)$breakdown,
        'first'           => (object)$first,
        'daily'           => $daily,
    ];
}

// ─── OVERVIEW ──────────────────────────────────────────────────────
// End-to-End Overview + BI Summary (spec content-overview-bi): การผลิต → การเผยแพร่
// → ผลลัพธ์ จาก "ข้อมูลทั้งหมดที่ระบบมี" — ไม่มีช่วงเวลาและไม่มีการเปรียบเทียบ
// (ผู้ใช้ตัดสินให้ไม่เทียบเดือนต่อเดือน) — ไม่มีส่วน "งานที่ต้องจัดการ" แล้ว (remove-overview-work-section)

/**
 * Engagement = Reaction + Comment + Share + Click (D2, engagementBreakdown()) of the
 * latest metrics row per (content item, ช่องทาง). Posts = distinct measured content
 * items — the same denominator as Avg/Post, so every widget built from these rows
 * adds up. engagement/avg/breakdown are null when nothing was measured ("—", not "0").
 *
 * @return array{engagement: ?int, breakdown: ?array, posts: int, avg_per_post: ?float, platforms: string[]}
 */
function overviewPostSummary(array $rows): array {
    $items     = [];
    $platforms = [];
    foreach ($rows as $r) {
        $items[$r['content_item_id']] = true;
        $platforms[$r['platform']]    = true;
    }
    $breakdown  = engagementBreakdown($rows);
    $engagement = array_sum($breakdown);
    $posts = count($items);
    $platformList = array_keys($platforms);
    sort($platformList);
    return [
        'engagement'   => $posts > 0 ? $engagement : null,
        'breakdown'    => $posts > 0 ? $breakdown : null,
        'posts'        => $posts,
        'avg_per_post' => $posts > 0 ? round($engagement / $posts, 1) : null,
        'platforms'    => $platformList,
    ];
}

if ($action === 'overview') {
    // ── Global KPI (ข้อมูลทั้งหมด) ────────────────────────────────
    // Only content marked as published counts ("คอนเทนต์ที่เผยแพร่แล้ว") — items that
    // have metrics but no published_at (sent, but the item's status never synced) are
    // left out, so Posts here equals the funnel's เผยแพร่ stage and the trend below
    // (which needs a publish month) adds up to the same totals.
    $allRows = array_values(array_filter(
        fetchSocialSeriesRows($db, $tenantId, null, null),
        static fn($r) => !empty($r['published_at'])
    ));
    $allSum  = overviewPostSummary($allRows);

    // ผู้ติดตามเพจ — page-level gauge: the latest synced value, never summed.
    $flStmtLatest = $db->prepare(
        "SELECT value FROM facebook_page_insights_daily
          WHERE tenant_id = ? AND metric = 'page_follows' AND value IS NOT NULL
          ORDER BY metric_date DESC LIMIT 1"
    );
    $flStmtLatest->execute([$tenantId]);
    $followersRaw = $flStmtLatest->fetchColumn();
    $followers    = $followersRaw === false ? null : (int)$followersRaw;

    $kpi = [
        'engagement'   => $allSum['engagement'],
        // reactions/comments/shares/clicks — sums to engagement
        'breakdown'    => $allSum['breakdown'],
        'posts'        => $allSum['posts'],
        'avg_per_post' => $allSum['avg_per_post'],
        'followers'    => [
            'current'   => $followers,
            // facebook_page_insights_daily is Facebook-only (one page per tenant).
            'platforms' => $followers !== null ? ['facebook'] : [],
        ],
        // Platforms whose posts have been measured.
        'platforms' => $allSum['platforms'],
    ];

    // ── การผลิต: funnel (D3) ──────────────────────────────────────
    // Cohort = all content of the tenant; every stage counts "reached this stage or
    // beyond", so the funnel can only narrow. approved_at is cleared when an approval
    // is revoked, so "อนุมัติ" means approved *as of now*.
    $fStmt = $db->prepare(
        "SELECT
            COUNT(*) AS created,
            SUM(requested_at IS NOT NULL OR approved_at IS NOT NULL OR published_at IS NOT NULL) AS requested,
            SUM(approved_at IS NOT NULL OR published_at IS NOT NULL)                             AS approved,
            SUM(published_at IS NOT NULL)                                                        AS published
         FROM content_items
         WHERE tenant_id = ?"
    );
    $fStmt->execute([$tenantId]);
    $f = $fStmt->fetch(PDO::FETCH_ASSOC) ?: [];
    $fCreated   = (int)($f['created']   ?? 0);
    $fRequested = (int)($f['requested'] ?? 0);
    $fApproved  = (int)($f['approved']  ?? 0);
    $fPublished = (int)($f['published'] ?? 0);
    $stagePct = static fn(int $n, int $prev): ?float => $prev > 0 ? round($n / $prev * 100, 1) : null;
    $funnel = [
        'stages' => [
            ['key' => 'created',   'count' => $fCreated,   'pct' => $fCreated > 0 ? 100.0 : null],
            ['key' => 'requested', 'count' => $fRequested, 'pct' => $stagePct($fRequested, $fCreated)],
            ['key' => 'approved',  'count' => $fApproved,  'pct' => $stagePct($fApproved,  $fRequested)],
            ['key' => 'published', 'count' => $fPublished, 'pct' => $stagePct($fPublished, $fApproved)],
        ],
        'in_progress' => $fCreated - $fPublished,
    ];

    // ── การผลิต: สถานะคอนเทนต์ (ณ ตอนนี้) ─────────────────────────
    $ssStmt = $db->prepare('SELECT status, COUNT(*) AS n FROM content_items WHERE tenant_id = ? GROUP BY status');
    $ssStmt->execute([$tenantId]);
    $statusSummary = ['total' => 0, 'by_status' => []];
    foreach ($ssStmt->fetchAll(PDO::FETCH_ASSOC) as $r) {
        $statusSummary['by_status'][(string)$r['status']] = (int)$r['n'];
        $statusSummary['total'] += (int)$r['n'];
    }

    // ── การเผยแพร่: Publishing Health (ข้อมูลทั้งหมด) ─────────────
    // Every queue row of the tenant. Email campaigns live elsewhere and are never
    // counted here.
    $hStmt = $db->prepare(
        "SELECT
            SUM(q.status IN ('pending', 'processing')) AS pending,
            SUM(q.status = 'sent')                      AS sent,
            SUM(q.status = 'failed')                    AS failed
         FROM content_publish_queue q
         WHERE q.tenant_id = ?"
    );
    $hStmt->execute([$tenantId]);
    $h = $hStmt->fetch(PDO::FETCH_ASSOC) ?: [];
    $hSent   = (int)($h['sent']   ?? 0);
    $hFailed = (int)($h['failed'] ?? 0);
    $hpStmt = $db->prepare(
        "SELECT DISTINCT NULLIF(pc.platform, '') AS platform
           FROM content_publish_queue q
           JOIN publish_channels pc ON pc.id = q.channel_id
          WHERE q.tenant_id = ?"
    );
    $hpStmt->execute([$tenantId]);
    $healthPlatforms = array_values(array_filter(array_column($hpStmt->fetchAll(PDO::FETCH_ASSOC), 'platform')));
    sort($healthPlatforms);

    // Failed rows listed under Success Rate so problems are visible at a glance
    // (remove-overview-work-section D4). View only — no retry button, so no
    // content_id/channel_id. The total count is `failed` above.
    $flStmt = $db->prepare(
        "SELECT q.id, q.scheduled_at, q.error_msg, q.retry_count,
                ci.title,
                pc.name                 AS channel_name,
                NULLIF(pc.platform, '') AS platform
         FROM content_publish_queue q
         LEFT JOIN content_items    ci ON ci.id = q.content_id
         LEFT JOIN publish_channels pc ON pc.id = q.channel_id
         WHERE q.tenant_id = ? AND q.status = 'failed'
         ORDER BY q.scheduled_at DESC
         LIMIT 10"
    );
    $flStmt->execute([$tenantId]);

    $publishingHealth = [
        'pending'      => (int)($h['pending'] ?? 0),
        'sent'         => $hSent,
        'failed'       => $hFailed,
        // null = nothing finished yet — a queue that never ran is not 0% or 100%.
        'success_rate' => ($hSent + $hFailed) > 0 ? round($hSent / ($hSent + $hFailed) * 100, 1) : null,
        'platforms'    => $healthPlatforms,
        'failures'     => array_map(static fn($r) => [
            'id'           => $r['id'],
            'title'        => $r['title'] ?? '(ไม่พบคอนเทนต์)',
            'channel_name' => $r['channel_name'],
            'platform'     => $r['platform'],
            'error_msg'    => $r['error_msg'],
            'retry_count'  => (int)$r['retry_count'],
            'scheduled_at' => $r['scheduled_at'],
        ], $flStmt->fetchAll(PDO::FETCH_ASSOC)),
    ];

    // ── การเผยแพร่: กำหนดการวันนี้ / พรุ่งนี้ (D4) ────────────────
    // Both scheduling sources, pending only. A content_schedules row gets its queue
    // row only when cron-publish actually sends it (publish_via_central_flow), so
    // pending rows never exist in both tables — no double count.
    $todayDate    = date('Y-m-d');
    $tomorrowDate = date('Y-m-d', strtotime('+1 day'));
    $schStmt = $db->prepare(
        "SELECT DATE(x.scheduled_at) AS d, DATE_FORMAT(x.scheduled_at, '%H:%i') AS t,
                x.platform, COUNT(*) AS n
           FROM (
                SELECT cs.scheduled_at, NULLIF(pc.platform, '') AS platform
                  FROM content_schedules cs
                  JOIN publish_channels  pc  ON pc.id  = cs.channel_id
                  JOIN content_plan_items cpi ON cpi.id = cs.plan_item_id
                  JOIN content_plans     cp  ON cp.id  = cpi.plan_id
                 WHERE cp.tenant_id = ? AND cs.status = 'pending'
                   AND cs.scheduled_at BETWEEN ? AND ?
                UNION ALL
                SELECT pq.scheduled_at, NULLIF(pc.platform, '') AS platform
                  FROM content_publish_queue pq
                  JOIN publish_channels pc ON pc.id = pq.channel_id
                 WHERE pq.tenant_id = ? AND pq.status = 'pending'
                   AND pq.scheduled_at BETWEEN ? AND ?
           ) x
          GROUP BY d, t, x.platform
          ORDER BY d, t, x.platform"
    );
    $schFrom = $todayDate . ' 00:00:00';
    $schTo   = $tomorrowDate . ' 23:59:59';
    $schStmt->execute([$tenantId, $schFrom, $schTo, $tenantId, $schFrom, $schTo]);
    $scheduleSummary = [
        'today'    => ['date' => $todayDate,    'rows' => []],
        'tomorrow' => ['date' => $tomorrowDate, 'rows' => []],
    ];
    foreach ($schStmt->fetchAll(PDO::FETCH_ASSOC) as $r) {
        $bucket = $r['d'] === $todayDate ? 'today' : 'tomorrow';
        $scheduleSummary[$bucket]['rows'][] = [
            'time'     => $r['t'],
            'platform' => $r['platform'],
            'count'    => (int)$r['n'],
        ];
    }

    // ── ผลลัพธ์: Engagement Trend รายเดือน ─────────────────────────
    // Every month from the first measured post's month to this month, by the month
    // the post was *published* (interactions are lifetime totals, so they cannot be split
    // by the day they happened). Months with no measured post → null (a gap, not 0).
    $trendAgg = [];
    foreach ($allRows as $r) {
        $mk = substr((string)$r['published_at'], 0, 7);
        if ($mk === '') continue;
        if (!isset($trendAgg[$mk])) $trendAgg[$mk] = ['engagement' => 0, 'items' => []];
        $trendAgg[$mk]['engagement'] += socialEngagement($r);
        $trendAgg[$mk]['items'][$r['content_item_id']] = true;
    }
    $engagementTrend = [];
    if ($trendAgg) {
        $firstMonth = min(array_keys($trendAgg));
        $thisMonth  = date('Y-m');
        for ($m = new DateTimeImmutable($firstMonth . '-01'); $m->format('Y-m') <= $thisMonth; $m = $m->modify('+1 month')) {
            $mk  = $m->format('Y-m');
            $agg = $trendAgg[$mk] ?? null;
            $engagementTrend[] = [
                'month'      => $mk,
                'engagement' => $agg ? $agg['engagement'] : null,
                'posts'      => $agg ? count($agg['items']) : 0,
            ];
        }
    }

    // ── ผลลัพธ์: Platform Performance ─────────────────────────────
    // Same rows as the KPI row, split by platform, so the table always adds up to it.
    $byPlatform = [];
    foreach ($allRows as $r) $byPlatform[$r['platform']][] = $r;
    if ($followers !== null && !isset($byPlatform['facebook'])) $byPlatform['facebook'] = [];
    $platformPerformance = [];
    foreach ($byPlatform as $plat => $rows) {
        $s = overviewPostSummary($rows);
        $platformPerformance[] = [
            'platform'     => $plat,
            'posts'        => $s['posts'],
            'engagement'   => $s['engagement'],
            'avg_per_post' => $s['avg_per_post'],
            // Only Facebook has follower data (page-level, one page per tenant).
            'followers'    => $plat === 'facebook' ? $followers : null,
        ];
    }
    usort($platformPerformance, static function ($a, $b) {
        if ($a['avg_per_post'] === null && $b['avg_per_post'] === null) return 0;
        if ($a['avg_per_post'] === null) return 1;
        if ($b['avg_per_post'] === null) return -1;
        return $b['avg_per_post'] <=> $a['avg_per_post'];
    });

    // ── การผลิต: คอนเทนต์ที่ยังไม่เผยแพร่ (ณ ตอนนี้) ─────────────────
    // Unpublished content bucketed by days since creation.
    $aStmt = $db->prepare(
        "SELECT
            SUM(DATEDIFF(NOW(), created_at) <= 7)                                       AS d0_7,
            SUM(DATEDIFF(NOW(), created_at) > 7  AND DATEDIFF(NOW(), created_at) <= 30) AS d8_30,
            SUM(DATEDIFF(NOW(), created_at) > 30 AND DATEDIFF(NOW(), created_at) <= 90) AS d31_90,
            SUM(DATEDIFF(NOW(), created_at) > 90)                                       AS d90_plus,
            COUNT(*)                                                                    AS total
         FROM content_items
         WHERE tenant_id = ? AND status <> 'published'"
    );
    $aStmt->execute([$tenantId]);
    $aging = $aStmt->fetch(PDO::FETCH_ASSOC) ?: [];

    jsonResponse([
        'kpi'                => $kpi,
        'funnel'             => $funnel,
        'status_summary'     => $statusSummary,
        'unpublished_aging'  => [
            'd0_7'     => (int)($aging['d0_7'] ?? 0),
            'd8_30'    => (int)($aging['d8_30'] ?? 0),
            'd31_90'   => (int)($aging['d31_90'] ?? 0),
            'd90_plus' => (int)($aging['d90_plus'] ?? 0),
            'total'    => (int)($aging['total'] ?? 0),
        ],
        'publishing_health'  => $publishingHealth,
        'schedule_summary'   => $scheduleSummary,
        'engagement_trend'   => $engagementTrend,
        'platform_performance' => $platformPerformance,
    ]);
}

// ─── ANALYTICS ─────────────────────────────────────────────────────
if ($action === 'analytics') {

    // Date range. Every block below except the SEO snapshot (3) is scoped to it.
    // Default = a 12-month window (first day of the month 11 months back → today),
    // which is exactly the window this endpoint used before the filter existed, so
    // callers that send no params see no change.
    $from = dateParam('from') ?? date('Y-m-01', strtotime('-11 month'));
    $to   = dateParam('to')   ?? date('Y-m-d');
    if ($from > $to) jsonError('ช่วงวันที่ไม่ถูกต้อง — from ต้องไม่เกิน to', 400);

    $fromMonth = new DateTime(substr($from, 0, 7) . '-01');
    $toMonth   = new DateTime(substr($to,   0, 7) . '-01');
    $monthDiff = $fromMonth->diff($toMonth);
    // The throughput axis emits one point per month in range, so a 200-year range
    // would mean a 2,400-point payload. Reject rather than silently truncate.
    if ($monthDiff->y * 12 + $monthDiff->m > 120) {
        jsonError('ช่วงวันที่กว้างเกินไป — รองรับสูงสุด 10 ปี', 400);
    }

    // Bound values for the queries below. `to` covers the whole end day because
    // the columns being compared are DATETIME, not DATE.
    $fromDt = $from . ' 00:00:00';
    $toDt   = $to   . ' 23:59:59';

    // 1) Throughput trend — created / requested / approved / published per month.
    // Each metric is counted in the month of its own timestamp, so one item can
    // land in different months across the four series.
    $series = [
        'created'   => 'created_at',
        'requested' => 'requested_at',
        'approved'  => 'approved_at',
        'published' => 'published_at',
    ];
    $throughputRaw = [];
    foreach ($series as $key => $col) {
        // $col comes from the hardcoded whitelist above, never from user input.
        // from/to are bound parameters.
        $st = $db->prepare(
            "SELECT DATE_FORMAT(`$col`, '%Y-%m') AS period, COUNT(*) AS n
             FROM content_items
             WHERE tenant_id = ?
               AND `$col` IS NOT NULL
               AND `$col` BETWEEN ? AND ?
             GROUP BY period"
        );
        $st->execute([$tenantId, $fromDt, $toDt]);
        foreach ($st->fetchAll(PDO::FETCH_ASSOC) as $r) {
            $throughputRaw[$r['period']][$key] = (int)$r['n'];
        }
    }
    // Emit a dense axis across the selected range so months with no activity
    // still plot as 0 instead of being skipped.
    $throughput = [];
    for ($cursor = clone $fromMonth; $cursor <= $toMonth; $cursor->modify('+1 month')) {
        $p = $cursor->format('Y-m');
        $throughput[] = [
            'period'    => $p,
            'created'   => (int)($throughputRaw[$p]['created']   ?? 0),
            'requested' => (int)($throughputRaw[$p]['requested'] ?? 0),
            'approved'  => (int)($throughputRaw[$p]['approved']  ?? 0),
            'published' => (int)($throughputRaw[$p]['published'] ?? 0),
        ];
    }

    // 2) Lead time per stage — avg / p50 / p90 in hours. Raw per-item durations
    // are pulled and reduced in PHP (see percentile()).
    $stageDefs = [
        ['key' => 'create_to_request',  'label' => 'สร้าง → ขออนุมัติ',     'from' => 'created_at',   'to' => 'requested_at'],
        ['key' => 'request_to_approve', 'label' => 'ขออนุมัติ → อนุมัติ',    'from' => 'requested_at', 'to' => 'approved_at'],
        ['key' => 'approve_to_publish', 'label' => 'อนุมัติ → เผยแพร่',      'from' => 'approved_at',  'to' => 'published_at'],
        ['key' => 'create_to_publish',  'label' => 'สร้าง → เผยแพร่ (รวม)', 'from' => 'created_at',   'to' => 'published_at'],
    ];
    $leadTime = [];
    foreach ($stageDefs as $s) {
        // Column names come from the hardcoded $stageDefs table above.
        // Scoped by the stage's *end* timestamp: the range answers "stages that
        // finished in this window", so a stage still in flight never counts.
        $st = $db->prepare(
            "SELECT TIMESTAMPDIFF(MINUTE, `{$s['from']}`, `{$s['to']}`) AS mins
             FROM content_items
             WHERE tenant_id = ?
               AND `{$s['from']}` IS NOT NULL
               AND `{$s['to']}`   IS NOT NULL
               AND `{$s['to']}` >= `{$s['from']}`
               AND `{$s['to']}` BETWEEN ? AND ?
             ORDER BY mins ASC"
        );
        $st->execute([$tenantId, $fromDt, $toDt]);
        $mins = array_map('intval', $st->fetchAll(PDO::FETCH_COLUMN));
        $n = count($mins);
        $leadTime[] = [
            'key'         => $s['key'],
            'label'       => $s['label'],
            'sample_size' => $n,
            // null (not 0) when no item has both timestamps — an unmeasured stage
            // is not a zero-duration stage.
            'avg_hours'   => $n > 0 ? round(array_sum($mins) / $n / 60, 1) : null,
            'p50_hours'   => $n > 0 ? round(percentile($mins, 0.50) / 60, 1) : null,
            'p90_hours'   => $n > 0 ? round(percentile($mins, 0.90) / 60, 1) : null,
        ];
    }

    // 3) SEO / content completeness across articles.
    // Deliberately NOT date-scoped: this is a snapshot of how complete the article
    // library is *right now*, not of work done inside the selected window.
    $seoStmt = $db->prepare(
        "SELECT
            COUNT(*)                                                     AS total,
            SUM(article_content  IS NOT NULL AND article_content  <> '') AS article_content,
            SUM(seo_title        IS NOT NULL AND seo_title        <> '') AS seo_title,
            SUM(slug             IS NOT NULL AND slug             <> '') AS slug,
            SUM(meta_description IS NOT NULL AND meta_description <> '') AS meta_description,
            SUM(meta_keywords    IS NOT NULL AND meta_keywords    <> '') AS meta_keywords,
            SUM(og_image         IS NOT NULL AND og_image         <> '') AS og_image
         FROM content_items
         WHERE tenant_id = ? AND type = 'article'"
    );
    $seoStmt->execute([$tenantId]);
    $seo = $seoStmt->fetch(PDO::FETCH_ASSOC) ?: [];
    $seoTotal = (int)($seo['total'] ?? 0);

    $seoFieldDefs = [
        'article_content'  => 'เนื้อหาบทความ',
        'seo_title'        => 'SEO Title',
        'slug'             => 'Slug',
        'meta_description' => 'Meta Description',
        'meta_keywords'    => 'Meta Keywords',
        'og_image'         => 'OG Image',
    ];
    $seoFields = [];
    foreach ($seoFieldDefs as $k => $label) {
        $filled = (int)($seo[$k] ?? 0);
        $seoFields[] = [
            'key'    => $k,
            'label'  => $label,
            'filled' => $filled,
            'total'  => $seoTotal,
            'pct'    => $seoTotal > 0 ? (int)round($filled / $seoTotal * 100) : 0,
        ];
    }

    // SEO gate configuration, so the widget can show the threshold in force.
    $gateStmt = $db->prepare(
        'SELECT seo_gate_enabled, seo_gate_min_score FROM content_global_settings WHERE tenant_id = ?'
    );
    $gateStmt->execute([$tenantId]);
    $gate = $gateStmt->fetch(PDO::FETCH_ASSOC) ?: [];

    // 4) Plan → content conversion, grouped by plan type.
    // Scoped by plan creation date. The content_items join stays unscoped on
    // purpose: filtering it too would count a plan item in the denominator while
    // dropping the content it produced from the numerator, understating conversion.
    $pcStmt = $db->prepare(
        "SELECT cp.plan_type,
                COUNT(DISTINCT cp.id)            AS plans,
                COUNT(cpi.id)                    AS plan_items,
                COUNT(ci.id)                     AS converted,
                SUM(ci.published_at IS NOT NULL) AS published
         FROM content_plans cp
         LEFT JOIN content_plan_items cpi ON cpi.plan_id = cp.id
         LEFT JOIN content_items      ci  ON ci.plan_item_id = cpi.id AND ci.tenant_id = cp.tenant_id
         WHERE cp.tenant_id = ? AND cp.created_at BETWEEN ? AND ?
         GROUP BY cp.plan_type
         ORDER BY plan_items DESC"
    );
    $pcStmt->execute([$tenantId, $fromDt, $toDt]);
    $planRows = $pcStmt->fetchAll(PDO::FETCH_ASSOC);

    $planTypeLabels = [
        'weekly'    => 'รายสัปดาห์',
        'monthly'   => 'รายเดือน',
        'quarterly' => 'รายไตรมาส',
        'yearly'    => 'รายปี',
    ];
    $planConversion = array_map(static function ($r) use ($planTypeLabels) {
        $planItems = (int)$r['plan_items'];
        $converted = (int)$r['converted'];
        return [
            'plan_type'   => $r['plan_type'],
            'label'       => $planTypeLabels[$r['plan_type']] ?? $r['plan_type'],
            'plans'       => (int)$r['plans'],
            'plan_items'  => $planItems,
            'converted'   => $converted,
            'published'   => (int)($r['published'] ?? 0),
            'convert_pct' => $planItems > 0 ? (int)round($converted / $planItems * 100) : 0,
        ];
    }, $planRows);

    // Items created outside any plan — the remainder plan conversion cannot see.
    $adhocStmt = $db->prepare(
        'SELECT COUNT(*) FROM content_items
         WHERE tenant_id = ? AND plan_item_id IS NULL AND created_at BETWEEN ? AND ?'
    );
    $adhocStmt->execute([$tenantId, $fromDt, $toDt]);
    $adhocCount = (int)$adhocStmt->fetchColumn();

    // 5) Publish success rate per platform, with the most frequent error.
    // Scoped by scheduled_at — the only timestamp every queue row has (sent_at is
    // NULL until a row actually goes out).
    // NULLIF guards against publish_channels rows whose platform is an empty
    // string, which would otherwise form their own unlabelled group.
    $psStmt = $db->prepare(
        "SELECT COALESCE(NULLIF(pc.platform, ''), '__unknown__') AS platform,
                SUM(q.status = 'sent')       AS sent,
                SUM(q.status = 'failed')     AS failed,
                SUM(q.status = 'pending')    AS pending,
                SUM(q.status = 'processing') AS processing,
                COUNT(*)                     AS total
         FROM content_publish_queue q
         LEFT JOIN publish_channels pc ON pc.id = q.channel_id
         WHERE q.tenant_id = ? AND q.scheduled_at BETWEEN ? AND ?
         GROUP BY platform
         ORDER BY total DESC"
    );
    $psStmt->execute([$tenantId, $fromDt, $toDt]);
    $psRows = $psStmt->fetchAll(PDO::FETCH_ASSOC);

    // Most common error text per platform.
    $errStmt = $db->prepare(
        "SELECT COALESCE(NULLIF(pc.platform, ''), '__unknown__') AS platform,
                q.error_msg, COUNT(*) AS n
         FROM content_publish_queue q
         LEFT JOIN publish_channels pc ON pc.id = q.channel_id
         WHERE q.tenant_id = ? AND q.status = 'failed'
           AND q.scheduled_at BETWEEN ? AND ?
           AND q.error_msg IS NOT NULL AND q.error_msg <> ''
         GROUP BY platform, q.error_msg
         ORDER BY n DESC"
    );
    $errStmt->execute([$tenantId, $fromDt, $toDt]);
    $topError = [];
    foreach ($errStmt->fetchAll(PDO::FETCH_ASSOC) as $r) {
        if (!isset($topError[$r['platform']])) $topError[$r['platform']] = $r['error_msg'];
    }

    $publishSuccess = array_map(static function ($r) use ($topError) {
        $sent   = (int)$r['sent'];
        $failed = (int)$r['failed'];
        $done   = $sent + $failed;
        return [
            'platform'    => $r['platform'],
            'sent'        => $sent,
            'failed'      => $failed,
            'pending'     => (int)$r['pending'],
            'processing'  => (int)$r['processing'],
            'total'       => (int)$r['total'],
            // null when nothing has finished yet — a queue that has never been
            // attempted is not a 0% success rate.
            'success_pct' => $done > 0 ? (int)round($sent / $done * 100) : null,
            'top_error'   => $topError[$r['platform']] ?? null,
        ];
    }, $psRows);

    // 6) Stat-card totals for the "เนื้อหา" sub-tab. One cohort — items *created*
    // in the window — so total / published / engagement all describe the same set
    // and the published rate can never exceed 100%.
    // Aggregated here rather than client-side because published_at is not part of
    // the content-items.php list payload.
    $statStmt = $db->prepare(
        'SELECT COUNT(*)                      AS total,
                SUM(published_at IS NOT NULL) AS published,
                COALESCE(SUM(views), 0)       AS views,
                COALESCE(SUM(likes), 0)       AS likes
         FROM content_items
         WHERE tenant_id = ? AND created_at BETWEEN ? AND ?'
    );
    $statStmt->execute([$tenantId, $fromDt, $toDt]);
    $stat = $statStmt->fetch(PDO::FETCH_ASSOC) ?: [];
    $statTotal     = (int)($stat['total'] ?? 0);
    $statPublished = (int)($stat['published'] ?? 0);
    $statViews     = (int)($stat['views'] ?? 0);
    $statLikes     = (int)($stat['likes'] ?? 0);

    // 7) Social engagement — Facebook/Instagram only, from the phase-2 time-series
    // table. Deliberately NOT read from content_items.views/likes: that column holds
    // the sum across *all* channels (including hand-entered numbers), so it cannot
    // answer "how much engagement came from FB/IG".
    // One row per (content, ช่องทาง) is used — the latest fetched_at — because
    // content_post_metrics keeps every sync round. The inner GROUP BY collapses
    // same-second ties (fetched_at is DATETIME, second precision) to one value per
    // ช่องทาง so two rounds landing in the same second cannot double-count.
    // ช่องทาง = channel_id, falling back to platform_post_id when the channel row
    // was deleted (FK sets channel_id to NULL): grouping orphaned rows by a NULL
    // channel_id would merge two different posts into one and under-count them.
    // Cohort = posts *published* inside the window (ci.published_at), not the round
    // the metrics were fetched in.
    // Fetch the deduped per-(content, ช่องทาง) rows once, carrying the platform
    // and item metadata, then reduce them in PHP. Every social widget below
    // (stat-card totals, per-platform, monthly, top posts) is derived from this
    // one base, so the totals can never disagree with the breakdowns.
    $socialStmt = $db->prepare(
        "SELECT m.content_item_id,
                m.platform,
                ci.title,
                ci.published_at,
                ci.published_url,
                MAX(m.views)      AS views,
                MAX(m.likes)      AS likes,
                -- NULL stays NULL (MAX over NULLs) = the platform did not report it
                MAX(m.clicks)             AS clicks,
                MAX(m.comments)           AS comments,
                MAX(m.shares)             AS shares,
                MAX(m.video_avg_watch_ms) AS video_avg_watch_ms,
                MAX(m.fetched_at) AS fetched_at
         FROM content_post_metrics m
         JOIN content_items ci ON ci.id = m.content_item_id
         JOIN (SELECT content_item_id,
                      COALESCE(channel_id, CONCAT('#', platform_post_id)) AS series_key,
                      MAX(fetched_at) AS mx
                 FROM content_post_metrics
                WHERE tenant_id = ?
                GROUP BY content_item_id, series_key) t
           ON t.content_item_id = m.content_item_id
          AND t.series_key = COALESCE(m.channel_id, CONCAT('#', m.platform_post_id))
          AND t.mx = m.fetched_at
        WHERE m.tenant_id = ?
          AND m.platform IN ('facebook', 'instagram')
          AND ci.published_at BETWEEN ? AND ?
        GROUP BY m.content_item_id,
                 COALESCE(m.channel_id, CONCAT('#', m.platform_post_id)),
                 m.platform, ci.title, ci.published_at, ci.published_url"
    );
    $socialStmt->execute([$tenantId, $tenantId, $fromDt, $toDt]);
    $socialSeries = $socialStmt->fetchAll(PDO::FETCH_ASSOC);

    $socialViews       = 0;
    $socialLastFetched = null;
    $socialItems       = [];  // content_item_id => true  (distinct-post count)
    $socialPlatforms   = [];  // platform => true
    $byPlatform        = [];  // platform => ['rows','items']
    $monthlyRaw        = [];  // 'Y-m'    => ['rows','items']
    $topRaw            = [];  // content_item_id => aggregated post

    // Sum of a nullable part across ช่องทาง: stays null until some ช่องทาง reports it
    // ("—" in the UI, not 0).
    $addNullable = static fn (?int $acc, $v): ?int => $v === null ? $acc : ($acc ?? 0) + (int)$v;

    foreach ($socialSeries as $r) {
        $cid  = $r['content_item_id'];
        $plat = $r['platform'];

        $socialViews += (int)$r['views'];
        $socialItems[$cid]      = true;
        $socialPlatforms[$plat] = true;
        if ($r['fetched_at'] !== null
            && ($socialLastFetched === null || $r['fetched_at'] > $socialLastFetched)) {
            $socialLastFetched = $r['fetched_at'];
        }

        $byPlatform[$plat]['rows'][]      = $r;
        $byPlatform[$plat]['items'][$cid] = true;

        // Grouped by the month the post was *published* (ci.published_at), matching
        // $throughput — not the round the metrics happened to be fetched in.
        $mk = substr((string)$r['published_at'], 0, 7);
        $monthlyRaw[$mk]['rows'][]      = $r;
        $monthlyRaw[$mk]['items'][$cid] = true;

        // One entry per content item, summed across its ช่องทาง.
        if (!isset($topRaw[$cid])) {
            $topRaw[$cid] = [
                'content_item_id' => $cid,
                'title'           => $r['title'],
                'published_at'    => $r['published_at'],
                'published_url'   => $r['published_url'],
                'views'           => 0,
                'likes'           => 0,
                'comments'        => null,
                'shares'          => null,
                'clicks'          => null,
                'engagement'      => 0,
                'video_avg_watch_ms' => null,
                '_platforms'      => [],
            ];
        }
        $topRaw[$cid]['views']      += (int)$r['views'];
        $topRaw[$cid]['likes']      += (int)$r['likes'];
        $topRaw[$cid]['comments']    = $addNullable($topRaw[$cid]['comments'], $r['comments']);
        $topRaw[$cid]['shares']      = $addNullable($topRaw[$cid]['shares'], $r['shares']);
        $topRaw[$cid]['clicks']      = $addNullable($topRaw[$cid]['clicks'], $r['clicks']);
        $topRaw[$cid]['engagement'] += socialEngagement($r);
        if ($r['video_avg_watch_ms'] !== null) {
            // An average cannot be summed across ช่องทาง; keep the highest one reported.
            $topRaw[$cid]['video_avg_watch_ms'] = max($topRaw[$cid]['video_avg_watch_ms'] ?? 0, (int)$r['video_avg_watch_ms']);
        }
        $topRaw[$cid]['_platforms'][$plat] = true;
    }
    $socialPosts     = count($socialItems);
    $socialBreakdown = engagementBreakdown($socialSeries);

    // Platforms present in the cohort — derived, never hardcoded, so Instagram
    // appears only once it actually has synced data.
    $socialPlatformList = array_keys($socialPlatforms);
    sort($socialPlatformList);

    // views + the four engagement parts + their sum, for one group of rows
    $socialTotals = static function (array $rows): array {
        $b = engagementBreakdown($rows);
        return [
            'views'      => array_sum(array_map(static fn ($r) => (int)$r['views'], $rows)),
            'likes'      => $b['reactions'],
            'comments'   => $b['comments'],
            'shares'     => $b['shares'],
            'clicks'     => $b['clicks'],
            'engagement' => array_sum($b),
        ];
    };

    $socialByPlatform = [];
    foreach ($byPlatform as $plat => $agg) {
        $socialByPlatform[] = ['platform' => $plat, 'posts' => count($agg['items'])]
                            + $socialTotals($agg['rows']);
    }
    usort($socialByPlatform, static fn ($a, $b) => $b['engagement'] <=> $a['engagement']);

    // Dense monthly axis across the selected range — same shape as $throughput so
    // months with no measured posts plot as 0 instead of being skipped.
    $socialMonthly = [];
    for ($cursor = clone $fromMonth; $cursor <= $toMonth; $cursor->modify('+1 month')) {
        $mk  = $cursor->format('Y-m');
        $agg = $monthlyRaw[$mk] ?? null;
        $socialMonthly[] = ['month' => $mk, 'posts' => $agg ? count($agg['items']) : 0]
                         + $socialTotals($agg['rows'] ?? []);
    }

    // Top posts by engagement, capped at 10.
    $socialTopPosts = array_map(static function ($p) {
        $plats = array_keys($p['_platforms']);
        sort($plats);
        return [
            'content_item_id' => $p['content_item_id'],
            'title'           => $p['title'],
            // A content item almost always maps to one platform; join only in the
            // rare cross-posted case so the UI badge stays honest.
            'platform'        => implode('/', $plats),
            'published_at'    => $p['published_at'],
            'views'           => $p['views'],
            'likes'           => $p['likes'],
            'comments'        => $p['comments'],
            'shares'          => $p['shares'],
            'clicks'          => $p['clicks'],
            'engagement'      => $p['engagement'],
            'video_avg_watch_ms' => $p['video_avg_watch_ms'],
            'published_url'   => $p['published_url'],
        ];
    }, array_values($topRaw));
    usort($socialTopPosts, static fn ($a, $b) => $b['engagement'] <=> $a['engagement']);
    $socialTopPosts = array_slice($socialTopPosts, 0, 10);

    jsonResponse([
        // Echo the window actually applied, so the client can tell a default apart
        // from what it asked for.
        'range'      => ['from' => $from, 'to' => $to],
        'social'     => [
            // Derived from the cohort, never hardcoded — Instagram (or any platform)
            // appears only once it actually has synced data inside the window.
            'platforms'       => $socialPlatformList,
            'posts'           => $socialPosts,
            // Video plays — reported on their own, not part of engagement.
            'views'           => $socialViews,
            'likes'           => $socialBreakdown['reactions'],
            'comments'        => $socialBreakdown['comments'],
            'shares'          => $socialBreakdown['shares'],
            'clicks'          => $socialBreakdown['clicks'],
            'engagement'      => array_sum($socialBreakdown),
            'last_fetched_at' => $socialLastFetched,
            // false when no FB/IG post has ever been synced — the client must show
            // "—" then, not 0, because 0 would read as "no engagement" instead of
            // "not measured yet".
            'has_data'        => $socialPosts > 0,
            // Derived widgets, all reduced from the same deduped base above so the
            // totals can never disagree with the breakdowns.
            'by_platform'     => $socialByPlatform,
            'monthly'         => $socialMonthly,
            'top_posts'       => $socialTopPosts,
        ],
        'stats'      => [
            'total'     => $statTotal,
            'published' => $statPublished,
            'views'     => $statViews,
            'likes'     => $statLikes,
            // 0 is a real value here — engagement is entered by hand until platform
            // ingestion exists, so it must not be reported as "no data".
            'engagement' => $statViews + $statLikes,
            // null (not 0) when nothing was created in the window — an empty cohort
            // has no publish rate to report.
            'performance_pct' => $statTotal > 0
                ? (int)round($statPublished / $statTotal * 100)
                : null,
        ],
        'throughput' => $throughput,
        'lead_time'  => $leadTime,
        'seo'        => [
            'total_articles' => $seoTotal,
            'fields'         => $seoFields,
            'gate_enabled'   => (int)($gate['seo_gate_enabled'] ?? 0) === 1,
            'gate_min_score' => (int)($gate['seo_gate_min_score'] ?? 0),
        ],
        'plan_conversion' => [
            'by_type'     => $planConversion,
            'adhoc_items' => $adhocCount,
        ],
        'publish_success' => $publishSuccess,
    ]);
}

// ─── PAGE INSIGHTS ─────────────────────────────────────────────────
// Facebook page-level metrics for the analytics → social sub-tab. Separate from
// ?action=analytics so the other sub-tabs do not pay for this payload.
if ($action === 'page_insights') {
    // Same default window as ?action=analytics so the sub-tab lines up with it.
    $from = dateParam('from') ?? date('Y-m-01', strtotime('-11 month'));
    $to   = dateParam('to')   ?? date('Y-m-d');
    if ($from > $to) jsonError('ช่วงวันที่ไม่ถูกต้อง — from ต้องไม่เกิน to', 400);
    // `daily` has one point per day — cap the axis rather than silently truncate.
    if ((new DateTime($from))->diff(new DateTime($to))->days > 1100) {
        jsonError('ช่วงวันที่กว้างเกินไป — รองรับสูงสุด 3 ปี', 400);
    }

    jsonResponse(['range' => ['from' => $from, 'to' => $to]] + pageInsightsRange($db, $tenantId, $from, $to));
}

jsonError('Unknown action', 400);
