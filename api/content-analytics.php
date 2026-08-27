<?php
// ─── Content BI aggregations ───────────────────────────────────────
// Server-side aggregation for the content dashboard widgets. Kept out of
// content-items.php so the item list payload stays small: every number here is
// a COUNT/AVG over columns the list endpoint does not ship to the client
// (approved_at, published_at, image_gen_status, seo_*).
//
// Two actions, one per dashboard tab:
//   ?action=overview   → queue health, reach funnel, aging, asset generation
//   ?action=analytics  → throughput trend, lead time, SEO, plan conversion,
//                        publish success by platform
//
// ?action=analytics also accepts &from=YYYY-MM-DD&to=YYYY-MM-DD. ?action=overview
// deliberately does not: it is a "right now" snapshot of the production queue.
//
// No migration: every column read here already exists.

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

// ─── OVERVIEW ──────────────────────────────────────────────────────
if ($action === 'overview') {

    // 1) Publish queue health — counts per status + overdue pending.
    // "overdue" uses the same definition as content-publish.php?action=overdue_count
    // so the two never disagree on screen.
    $qStmt = $db->prepare(
        "SELECT
            SUM(status = 'pending')                          AS pending,
            SUM(status = 'processing')                        AS processing,
            SUM(status = 'sent')                             AS sent,
            SUM(status = 'failed')                           AS failed,
            SUM(status = 'pending' AND scheduled_at < NOW()) AS overdue_pending,
            COUNT(*)                                         AS total
         FROM content_publish_queue WHERE tenant_id = ?"
    );
    $qStmt->execute([$tenantId]);
    $q = $qStmt->fetch(PDO::FETCH_ASSOC) ?: [];

    // Failed entries with the actionable error text, newest first.
    // channel_id is returned so the retry button can call send_now.
    $fStmt = $db->prepare(
        "SELECT q.id, q.content_id, q.channel_id, q.scheduled_at, q.error_msg, q.retry_count,
                ci.title,
                pc.name                 AS channel_name,
                NULLIF(pc.platform, '') AS platform
         FROM content_publish_queue q
         LEFT JOIN content_items    ci ON ci.id = q.content_id
         LEFT JOIN publish_channels pc ON pc.id = q.channel_id
         WHERE q.tenant_id = ? AND q.status = 'failed'
         ORDER BY q.scheduled_at DESC
         LIMIT 8"
    );
    $fStmt->execute([$tenantId]);
    $failures = $fStmt->fetchAll(PDO::FETCH_ASSOC);

    // 2) Reach funnel — how many items have *ever* reached each stage, derived
    // from the workflow timestamps rather than the current status snapshot, so an
    // item bounced back to draft after approval still counts as having reached it.
    $funStmt = $db->prepare(
        'SELECT
            COUNT(*)                      AS created,
            SUM(requested_at IS NOT NULL) AS requested,
            SUM(approved_at  IS NOT NULL) AS approved,
            SUM(published_at IS NOT NULL) AS published
         FROM content_items WHERE tenant_id = ?'
    );
    $funStmt->execute([$tenantId]);
    $fun = $funStmt->fetch(PDO::FETCH_ASSOC) ?: [];

    // 3) Aging — unpublished items bucketed by days since creation.
    $aStmt = $db->prepare(
        "SELECT
            SUM(DATEDIFF(NOW(), created_at) <= 7)                                       AS d0_7,
            SUM(DATEDIFF(NOW(), created_at) > 7  AND DATEDIFF(NOW(), created_at) <= 30) AS d8_30,
            SUM(DATEDIFF(NOW(), created_at) > 30 AND DATEDIFF(NOW(), created_at) <= 90) AS d31_90,
            SUM(DATEDIFF(NOW(), created_at) > 90)                                       AS d90_plus,
            COUNT(*)                                                                    AS total,
            MAX(DATEDIFF(NOW(), created_at))                                            AS oldest_days
         FROM content_items
         WHERE tenant_id = ? AND status <> 'published'"
    );
    $aStmt->execute([$tenantId]);
    $aging = $aStmt->fetch(PDO::FETCH_ASSOC) ?: [];

    // Oldest stale items, so the widget can name the actual offenders.
    $sStmt = $db->prepare(
        "SELECT id, title, status, NULLIF(platform, '') AS platform,
                DATEDIFF(NOW(), created_at) AS age_days
         FROM content_items
         WHERE tenant_id = ? AND status <> 'published'
         ORDER BY created_at ASC
         LIMIT 5"
    );
    $sStmt->execute([$tenantId]);
    $staleItems = $sStmt->fetchAll(PDO::FETCH_ASSOC);

    // 4) AI asset generation status.
    $gStmt = $db->prepare(
        "SELECT
            SUM(image_gen_status = 'none')       AS img_none,
            SUM(image_gen_status = 'generating') AS img_generating,
            SUM(image_gen_status = 'done')       AS img_done,
            SUM(image_gen_status = 'failed')     AS img_failed,
            SUM(video_gen_status = 'none')       AS vid_none,
            SUM(video_gen_status = 'generating') AS vid_generating,
            SUM(video_gen_status = 'done')       AS vid_done,
            SUM(video_gen_status = 'failed')     AS vid_failed
         FROM content_items WHERE tenant_id = ?"
    );
    $gStmt->execute([$tenantId]);
    $g = $gStmt->fetch(PDO::FETCH_ASSOC) ?: [];

    jsonResponse([
        'queue' => [
            'pending'         => (int)($q['pending'] ?? 0),
            'processing'      => (int)($q['processing'] ?? 0),
            'sent'            => (int)($q['sent'] ?? 0),
            'failed'          => (int)($q['failed'] ?? 0),
            'overdue_pending' => (int)($q['overdue_pending'] ?? 0),
            'total'           => (int)($q['total'] ?? 0),
            'failures'        => array_map(static fn($r) => [
                'id'           => $r['id'],
                'content_id'   => $r['content_id'],
                'channel_id'   => $r['channel_id'],
                'title'        => $r['title'] ?? '(ไม่พบคอนเทนต์)',
                'channel_name' => $r['channel_name'],
                'platform'     => $r['platform'],
                'error_msg'    => $r['error_msg'],
                'retry_count'  => (int)$r['retry_count'],
                'scheduled_at' => $r['scheduled_at'],
            ], $failures),
        ],
        'funnel' => [
            'created'   => (int)($fun['created'] ?? 0),
            'requested' => (int)($fun['requested'] ?? 0),
            'approved'  => (int)($fun['approved'] ?? 0),
            'published' => (int)($fun['published'] ?? 0),
        ],
        'aging' => [
            'd0_7'        => (int)($aging['d0_7'] ?? 0),
            'd8_30'       => (int)($aging['d8_30'] ?? 0),
            'd31_90'      => (int)($aging['d31_90'] ?? 0),
            'd90_plus'    => (int)($aging['d90_plus'] ?? 0),
            'total'       => (int)($aging['total'] ?? 0),
            // null only when there is nothing unpublished — "no stale items" is
            // not the same statement as "the oldest is 0 days old".
            'oldest_days' => isset($aging['oldest_days']) && $aging['oldest_days'] !== null
                ? (int)$aging['oldest_days'] : null,
            'items'       => array_map(static fn($r) => [
                'id'       => $r['id'],
                'title'    => $r['title'],
                'status'   => $r['status'],
                'platform' => $r['platform'],
                'age_days' => (int)$r['age_days'],
            ], $staleItems),
        ],
        'assets' => [
            'image' => [
                'none'       => (int)($g['img_none'] ?? 0),
                'generating' => (int)($g['img_generating'] ?? 0),
                'done'       => (int)($g['img_done'] ?? 0),
                'failed'     => (int)($g['img_failed'] ?? 0),
            ],
            'video' => [
                'none'       => (int)($g['vid_none'] ?? 0),
                'generating' => (int)($g['vid_generating'] ?? 0),
                'done'       => (int)($g['vid_done'] ?? 0),
                'failed'     => (int)($g['vid_failed'] ?? 0),
            ],
        ],
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
    $socialLikes       = 0;
    $socialLastFetched = null;
    $socialItems       = [];  // content_item_id => true  (distinct-post count)
    $socialPlatforms   = [];  // platform => true
    $byPlatform        = [];  // platform => ['views','likes','items']
    $monthlyRaw        = [];  // 'Y-m'    => ['views','likes','items']
    $topRaw            = [];  // content_item_id => aggregated post

    foreach ($socialSeries as $r) {
        $v    = (int)$r['views'];
        $l    = (int)$r['likes'];
        $cid  = $r['content_item_id'];
        $plat = $r['platform'];

        $socialViews += $v;
        $socialLikes += $l;
        $socialItems[$cid]     = true;
        $socialPlatforms[$plat] = true;
        if ($r['fetched_at'] !== null
            && ($socialLastFetched === null || $r['fetched_at'] > $socialLastFetched)) {
            $socialLastFetched = $r['fetched_at'];
        }

        if (!isset($byPlatform[$plat])) $byPlatform[$plat] = ['views' => 0, 'likes' => 0, 'items' => []];
        $byPlatform[$plat]['views'] += $v;
        $byPlatform[$plat]['likes'] += $l;
        $byPlatform[$plat]['items'][$cid] = true;

        // Grouped by the month the post was *published* (ci.published_at), matching
        // $throughput — not the round the metrics happened to be fetched in.
        $mk = substr((string)$r['published_at'], 0, 7);
        if (!isset($monthlyRaw[$mk])) $monthlyRaw[$mk] = ['views' => 0, 'likes' => 0, 'items' => []];
        $monthlyRaw[$mk]['views'] += $v;
        $monthlyRaw[$mk]['likes'] += $l;
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
                '_platforms'      => [],
            ];
        }
        $topRaw[$cid]['views'] += $v;
        $topRaw[$cid]['likes'] += $l;
        $topRaw[$cid]['_platforms'][$plat] = true;
    }
    $socialPosts = count($socialItems);

    // Platforms present in the cohort — derived, never hardcoded, so Instagram
    // appears only once it actually has synced data.
    $socialPlatformList = array_keys($socialPlatforms);
    sort($socialPlatformList);

    $socialByPlatform = [];
    foreach ($byPlatform as $plat => $agg) {
        $socialByPlatform[] = [
            'platform'   => $plat,
            'posts'      => count($agg['items']),
            'views'      => $agg['views'],
            'likes'      => $agg['likes'],
            'engagement' => $agg['views'] + $agg['likes'],
        ];
    }
    usort($socialByPlatform, static fn ($a, $b) => $b['engagement'] <=> $a['engagement']);

    // Dense monthly axis across the selected range — same shape as $throughput so
    // months with no measured posts plot as 0 instead of being skipped.
    $socialMonthly = [];
    for ($cursor = clone $fromMonth; $cursor <= $toMonth; $cursor->modify('+1 month')) {
        $mk  = $cursor->format('Y-m');
        $agg = $monthlyRaw[$mk] ?? null;
        $mv  = $agg ? $agg['views'] : 0;
        $ml  = $agg ? $agg['likes'] : 0;
        $socialMonthly[] = [
            'month'      => $mk,
            'posts'      => $agg ? count($agg['items']) : 0,
            'views'      => $mv,
            'likes'      => $ml,
            'engagement' => $mv + $ml,
        ];
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
            'engagement'      => $p['views'] + $p['likes'],
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
            'views'           => $socialViews,
            'likes'           => $socialLikes,
            'engagement'      => $socialViews + $socialLikes,
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

jsonError('Unknown action', 400);
