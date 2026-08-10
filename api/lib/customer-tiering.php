<?php
/**
 * Customer Tiering Engine
 *
 * Computes RFM-based tier classification for customers/companies.
 * Tiers: partner, high_value, high_potential, transactional, low_volume
 *
 * Used by api/customer-tiers.php (manual trigger) and cron.
 */

require_once __DIR__ . '/../config.php';

/**
 * Classify a single company and update its tier in the database.
 */
function classifyCompany(PDO $db, string $companyId, string $tenantId): array {
    // 1. Revenue: sum of won opportunities + accepted quotations (last 12 months)
    $revenue = _getRevenue($db, $companyId, $tenantId);

    // 2. Interaction: count and recency of customer_activities
    $interaction = _getInteraction($db, $companyId, $tenantId);

    // 3. Compute tier based on rules
    $result = _computeTier($revenue, $interaction);

    // 4. Update the companies row
    $db->prepare(
        "UPDATE companies SET tier = ?, tier_score = ?, tier_updated_at = NOW() WHERE id = ? AND tenant_id = ?"
    )->execute([$result['tier'], $result['score'], $companyId, $tenantId]);

    return $result;
}

/**
 * Classify all companies in a tenant.
 */
function classifyAllCompanies(PDO $db, string $tenantId): array {
    $stmt = $db->prepare("SELECT id, name FROM companies WHERE tenant_id = ? AND is_active = 1");
    $stmt->execute([$tenantId]);
    $companies = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $results = [];
    foreach ($companies as $c) {
        $results[$c['id']] = classifyCompany($db, $c['id'], $tenantId);
    }
    return [
        'classified' => count($results),
        'companies'  => $results,
    ];
}

// ── Revenue computation ─────────────────────────────────────────────────────────

function _getRevenue(PDO $db, string $companyId, string $tenantId): array {
    $twelveMonthsAgo = date('Y-m-d', strtotime('-12 months'));

    // Won opportunities
    $stmt = $db->prepare(
        "SELECT COALESCE(SUM(COALESCE(amount, 0)), 0) AS total,
                COUNT(*) AS deal_count,
                MAX(updated_at) AS last_deal_date
         FROM sales_opportunities
         WHERE company_id = ? AND tenant_id = ? AND status = 'won'
           AND updated_at >= ?"
    );
    $stmt->execute([$companyId, $tenantId, $twelveMonthsAgo]);
    $opp = $stmt->fetch(PDO::FETCH_ASSOC);

    // Accepted quotations
    $stmt = $db->prepare(
        "SELECT COALESCE(SUM(COALESCE(total, 0)), 0) AS total,
                COUNT(*) AS quote_count,
                MAX(updated_at) AS last_quote_date
         FROM quotations
         WHERE company_id = ? AND tenant_id = ? AND status IN ('accepted', 'approved')
           AND updated_at >= ?"
    );
    $stmt->execute([$companyId, $tenantId, $twelveMonthsAgo]);
    $quo = $stmt->fetch(PDO::FETCH_ASSOC);

    // Projects with payment status (proxy for revenue)
    $stmt = $db->prepare(
        "SELECT COALESCE(SUM(COALESCE(budget, 0)), 0) AS total,
                COUNT(*) AS project_count
         FROM projects
         WHERE company_id = ? AND tenant_id = ? AND created_at >= ?"
    );
    $stmt->execute([$companyId, $tenantId, $twelveMonthsAgo]);
    $proj = $stmt->fetch(PDO::FETCH_ASSOC);

    $totalRevenue = (float)$opp['total'] + (float)$quo['total'] + (float)$proj['total'];
    $totalOrders  = (int)$opp['deal_count'] + (int)$quo['quote_count'] + (int)$proj['project_count'];

    $lastOrderDate = max(
        $opp['last_deal_date']  ?? '1970-01-01',
        $quo['last_quote_date'] ?? '1970-01-01'
    );
    $daysSinceLastOrder = $lastOrderDate > '1970-01-01'
        ? (int)((time() - strtotime($lastOrderDate)) / 86400)
        : 999;

    return [
        'total_revenue'         => $totalRevenue,
        'order_count'           => $totalOrders,
        'days_since_last_order' => $daysSinceLastOrder,
    ];
}

// ── Interaction computation ─────────────────────────────────────────────────────

function _getInteraction(PDO $db, string $companyId, string $tenantId): array {
    // Count activities in the last 6 months
    $sixMonthsAgo = date('Y-m-d', strtotime('-6 months'));
    $stmt = $db->prepare(
        "SELECT COUNT(*) AS total,
                MAX(created_at) AS last_activity_date
         FROM customer_activities
         WHERE company_id = ? AND tenant_id = ? AND created_at >= ?"
    );
    $stmt->execute([$companyId, $tenantId, $sixMonthsAgo]);
    $activities = $stmt->fetch(PDO::FETCH_ASSOC);

    // Check for high-relationship activity types (Visit, Dinner, Meeting)
    $stmt = $db->prepare(
        "SELECT COUNT(*) AS high_touch
         FROM customer_activities
         WHERE company_id = ? AND tenant_id = ? AND created_at >= ?
           AND activity_type IN ('visit','dinner','meeting','call')"
    );
    $stmt->execute([$companyId, $tenantId, $sixMonthsAgo]);
    $highTouch = $stmt->fetch(PDO::FETCH_ASSOC);

    $lastActivityDate = $activities['last_activity_date'] ?? null;
    $daysSinceLastActivity = $lastActivityDate
        ? (int)((time() - strtotime($lastActivityDate)) / 86400)
        : 999;

    return [
        'activity_count'          => (int)$activities['total'],
        'high_touch_count'        => (int)$highTouch['high_touch'],
        'days_since_last_activity' => $daysSinceLastActivity,
    ];
}

// ── Tier classification rules ───────────────────────────────────────────────────

function _computeTier(array $revenue, array $interaction): array {
    $rev   = $revenue['total_revenue'];
    $count = $revenue['order_count'];
    $recency = $revenue['days_since_last_order'];
    $acts  = $interaction['activity_count'];
    $high  = $interaction['high_touch_count'];
    $iaRec = $interaction['days_since_last_activity'];

    // Score: revenue component (0-50)
    if ($rev >= 500000)       $rScore = 50;
    elseif ($rev >= 200000)   $rScore = 40;
    elseif ($rev >= 100000)   $rScore = 30;
    elseif ($rev >= 50000)    $rScore = 20;
    elseif ($rev >= 10000)    $rScore = 10;
    elseif ($rev > 0)         $rScore = 5;
    else                      $rScore = 0;

    // Score: frequency component (0-20)
    if ($count >= 20)         $fScore = 20;
    elseif ($count >= 10)     $fScore = 15;
    elseif ($count >= 5)      $fScore = 10;
    elseif ($count >= 2)      $fScore = 5;
    else                      $fScore = 0;

    // Score: recency component (0-15)
    if ($recency <= 30)       $recScore = 15;
    elseif ($recency <= 90)   $recScore = 10;
    elseif ($recency <= 180)  $recScore = 5;
    else                      $recScore = 0;

    // Score: relationship component (0-15)
    if ($high >= 10)          $relScore = 15;
    elseif ($high >= 5)       $relScore = 12;
    elseif ($high >= 2)       $relScore = 8;
    elseif ($acts >= 5)       $relScore = 5;
    elseif ($acts >= 1)       $relScore = 2;
    else                      $relScore = 0;

    $totalScore = $rScore + $fScore + $recScore + $relScore;

    // Classification thresholds
    if ($totalScore >= 80)      $tier = 'partner';
    elseif ($totalScore >= 55)  $tier = 'high_value';
    elseif ($totalScore >= 30)  $tier = 'high_potential';
    elseif ($totalScore >= 10)  $tier = 'transactional';
    else                        $tier = 'low_volume';

    return [
        'tier'        => $tier,
        'score'       => $totalScore,
        'breakdown'   => [
            'revenue'      => $rScore,
            'frequency'    => $fScore,
            'recency'      => $recScore,
            'relationship' => $relScore,
        ],
        'revenue'     => $revenue,
        'interaction' => $interaction,
    ];
}
