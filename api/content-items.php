<?php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth.php';

$db     = getDB();
$method = getMethod();
$auth   = requireAuth();
$userId = $auth['user_id'];
$tenantId = $auth['tenant_id'];

try {
    $db->exec("CREATE TABLE IF NOT EXISTS `content_publish_queue` (
      `id` CHAR(36) NOT NULL,
      `tenant_id` CHAR(36) NOT NULL,
      `content_id` CHAR(36) NOT NULL,
      `channel_id` CHAR(36) NOT NULL,
      `scheduled_at` DATETIME NOT NULL,
      `status` ENUM('pending','processing','sent','failed') NOT NULL DEFAULT 'pending',
      `sent_at` DATETIME DEFAULT NULL,
      `error_msg` VARCHAR(500) DEFAULT NULL,
      `retry_count` TINYINT UNSIGNED NOT NULL DEFAULT 0,
      `created_at` DATETIME NOT NULL DEFAULT current_timestamp(),
      `updated_at` DATETIME NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
      PRIMARY KEY (`id`),
      KEY `idx_tenant_status_scheduled` (`tenant_id`, `status`, `scheduled_at`),
      KEY `idx_content_id` (`content_id`),
      KEY `idx_channel_id` (`channel_id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
} catch (Exception $e) { error_log('[migration] ' . $e->getMessage()); }

if ($method === 'GET') {
    $search = $_GET['search'] ?? '';
    // Base query from content_items as primary content store
    $sql    = 'SELECT
                      ci.id,
                      ci.tenant_id,
                      ci.title,
                      ci.type,
                      ci.status,
                      ci.approved_at,
                      COALESCE(ci.views, 0)             AS views,
                      COALESCE(ci.likes, 0)             AS likes,
                      COALESCE(ci.created_by, \'\')      AS created_by,
                      ci.plan_item_id,
                      COALESCE(NULLIF(ci.caption,\'\'), cpi.caption)         AS caption,
                      COALESCE(NULLIF(ci.image_brief,\'\'), cpi.image_brief) AS image_brief,
                      COALESCE(NULLIF(ci.generated_image_url,\'\'), cpi.generated_image_url) AS generated_image_url,
                      COALESCE(NULLIF(ci.article_content,\'\'), cpi.article_content) AS article_content,
                      ci.seo_title,
                      ci.slug,
                      ci.meta_description,
                      ci.meta_keywords,
                      ci.structured_data,
                      ci.og_image,
                      COALESCE(NULLIF(ci.platforms,\'\'), JSON_ARRAY(COALESCE(NULLIF(ci.platform,\'\'), cpi.platform))) AS platforms,
                      COALESCE(NULLIF(ci.platform,\'\'), cpi.platform)       AS platform,
                      COALESCE(cpi.day_label, \'\')              AS day_label,
                      COALESCE(ci.scheduled_date, cpi.scheduled_date) AS scheduled_date,
                      cp.title                            AS plan_title,
                      cp.id                               AS plan_id,
                      cp.week_start,
                      ci.created_at,
                      ci.updated_at,
                      ci.requested_at,
                      ci.reject_reason
               FROM content_items ci
               LEFT JOIN content_plan_items cpi ON cpi.id = ci.plan_item_id
               LEFT JOIN content_plans cp ON cp.id = COALESCE(ci.plan_id, cpi.plan_id) AND cp.tenant_id = ?
               WHERE ci.tenant_id = ?';
    $params = [$tenantId, $tenantId];
    if ($search) { $sql .= ' AND (ci.title LIKE ? OR ci.caption LIKE ? OR ci.platform LIKE ?)'; $params[] = "%$search%"; $params[] = "%$search%"; $params[] = "%$search%"; }
    $sql .= ' ORDER BY ci.created_at DESC';
    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    jsonResponse($stmt->fetchAll());
}

if ($method === 'POST') {
    $body = getRequestBody();
    if (empty($body['title'])) jsonError('กรุณาระบุชื่อคอนเทนต์');
    $id = generateUUID();
    $planItemId = $body['plan_item_id'] ?? null;
    $platform = isset($body['platform']) ? strtolower(trim($body['platform'])) : null;
    $platforms = isset($body['platforms']) && is_array($body['platforms'])
        ? array_values(array_unique(array_filter(array_map(static fn($p) => strtolower(trim((string)$p)), $body['platforms']))))
        : ($platform ? [$platform] : []);
    // Validate type against the enum; fall back to 'article' for unknown values
    $type = strtolower(trim((string)($body['type'] ?? 'article')));
    if (!in_array($type, ['article', 'image', 'video'], true)) $type = 'article';
    $db->prepare('INSERT INTO content_items (id, tenant_id, title, type, status, created_by, plan_item_id, platform, platforms, scheduled_date, caption, image_brief, plan_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)')
       ->execute([$id, $tenantId, $body['title'], $type, $body['status'] ?? 'draft', $userId, $planItemId, $platform, json_encode($platforms), $body['scheduled_date'] ?? null, $body['caption'] ?? '', $body['image_brief'] ?? '', $body['plan_id'] ?? null]);
    $stmt = $db->prepare('SELECT ci.*, cpi.day_label, cp.title AS plan_title, cp.id AS plan_id, cp.week_start FROM content_items ci LEFT JOIN content_plan_items cpi ON cpi.id=ci.plan_item_id LEFT JOIN content_plans cp ON cp.id=COALESCE(ci.plan_id, cpi.plan_id) WHERE ci.id=?');
    $stmt->execute([$id]);
    jsonResponse($stmt->fetch(), 201);
}

if ($method === 'PUT') {
    $id = $_GET['id'] ?? null;
    if (!$id) jsonError('Missing id');
    $body    = getRequestBody();
    // Whitelist the status values the content workflow actually supports, so an
    // unrecognized value is rejected with a clear 400 instead of being silently
    // coerced to an empty string by MariaDB's non-strict ENUM handling.
    $validStatus = ['published', 'draft', 'revision', 'pending_approval', 'rejected', 'approved'];
    if (array_key_exists('status', $body) && !in_array($body['status'], $validStatus, true)) {
        jsonError('สถานะไม่ถูกต้อง', 400);
    }
    // เกตกันถอยสถานะ — คอนเทนต์ที่เผยแพร่แล้วห้ามกลับไปเป็นสถานะก่อนเผยแพร่
    //
    // ใช้ published_at เป็นหลักฐาน ไม่ใช่ status เพราะ status คือฟิลด์ที่ถูกเขียนทับไปแล้ว
    // (ก่อนมีเกตนี้ ทั้ง 4 แถวที่มี published_at ถูกตั้งกลับเป็น draft หมด ทำให้ published_at
    //  และ external_post_id ค้างอยู่กับแถวที่สถานะบอกว่า "ยังไม่เผยแพร่" จนหลุดจากทุก query
    //  ที่กรอง status='published' รวมถึงเกตของ analytics-recalculate)
    //
    // ตรวจเฉพาะเมื่อ body ส่ง status มาด้วย — การแก้ title/caption ของคอนเทนต์ที่เผยแพร่แล้ว
    // ยังทำได้ตามปกติ และการส่ง status='published' ซ้ำก็ผ่าน (ไม่อยู่ในเซตก่อนเผยแพร่)
    if (array_key_exists('status', $body)) {
        $preStatus = ['draft', 'pending_approval', 'approved', 'revision', 'rejected'];
        if (in_array($body['status'], $preStatus, true)) {
            $cur = $db->prepare('SELECT published_at FROM content_items WHERE id = ? AND tenant_id = ?');
            $cur->execute([$id, $tenantId]);
            $publishedAt = $cur->fetchColumn();
            if (!empty($publishedAt)) {
                jsonError(
                    'เปลี่ยนสถานะไม่ได้ — คอนเทนต์นี้เผยแพร่แล้วเมื่อ ' . $publishedAt
                    . ' หากต้องการแก้ไขเนื้อหา ให้สร้างคอนเทนต์ใหม่แทนการถอยสถานะ',
                    422
                );
            }
        }
    }

    // Approval belongs to the exact content version. Editing an approved content
    // item invalidates that approval and moves it back to revision so it must be
    // reviewed again before send/schedule. Read-only metric updates do not revoke it.
    $approvalSensitiveFields = [
        'title', 'type', 'caption', 'platform', 'platforms', 'scheduled_date',
        'image_brief', 'article_content', 'seo_title', 'slug', 'meta_description',
        'meta_keywords', 'structured_data', 'og_image',
    ];
    $changesContent = count(array_intersect($approvalSensitiveFields, array_keys($body))) > 0;
    $requestedStatus = $body['status'] ?? null;

    // Script Quality is version-specific. Any change to content fields that can
    // affect the script's Source of Truth invalidates the persisted quality result.
    // Do this even when the caller does not send a new article_content payload,
    // e.g. changing the topic/platform must not keep a score from the old version.
    if ($changesContent) {
        $currentArticleStmt = $db->prepare('SELECT article_content FROM content_items WHERE id=? AND tenant_id=?');
        $currentArticleStmt->execute([$id, $tenantId]);
        $currentArticleContent = (string)($currentArticleStmt->fetchColumn() ?: '');
        $qualityArticleContent = array_key_exists('article_content', $body)
            ? (string)($body['article_content'] ?? '')
            : $currentArticleContent;
        if ($qualityArticleContent !== '') {
            $qualityArticle = json_decode($qualityArticleContent, true);
            if (is_array($qualityArticle) && array_key_exists('script_quality', $qualityArticle)) {
                unset($qualityArticle['script_quality']);
                $body['article_content'] = json_encode($qualityArticle, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            }
        }
    }

    if ($changesContent && !in_array($requestedStatus, ['approved', 'published'], true)) {
        $approvalState = $db->prepare('SELECT approved_at FROM content_items WHERE id=? AND tenant_id=?');
        $approvalState->execute([$id, $tenantId]);
        if (!empty($approvalState->fetchColumn())) {
            $body['status'] = 'revision';
            $requestedStatus = 'revision';
        }
    }

    $allowed = ['title', 'type', 'status', 'views', 'likes', 'caption', 'platform', 'platforms', 'scheduled_date', 'image_brief', 'article_content', 'reject_reason', 'seo_title', 'slug', 'meta_description', 'meta_keywords', 'structured_data', 'og_image'];
    $fields  = []; $values = [];
    foreach ($allowed as $f) {
        if (array_key_exists($f, $body)) {
            $fields[] = "`$f` = ?";
            if ($f === 'platform') {
                $values[] = strtolower(trim((string)$body[$f]));
            } elseif ($f === 'platforms') {
                $platformValues = is_array($body[$f])
                    ? array_values(array_unique(array_filter(array_map(static fn($p) => strtolower(trim((string)$p)), $body[$f]))))
                    : [];
                $values[] = json_encode($platformValues);
            } elseif ($f === 'structured_data' && is_array($body[$f])) {
                $values[] = json_encode($body[$f], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            } else {
                $values[] = $body[$f];
            }
        }
    }
    // Publishing is only valid after an approval timestamp exists.
    if (($body['status'] ?? null) === 'published') {
        $approvalCheck = $db->prepare('SELECT approved_at FROM content_items WHERE id=? AND tenant_id=?');
        $approvalCheck->execute([$id, $tenantId]);
        if (empty($approvalCheck->fetchColumn())) {
            jsonError('เผยแพร่ไม่ได้ — คอนเทนต์นี้ยังไม่ผ่านการอนุมัติ กรุณาอนุมัติก่อนเผยแพร่', 422);
        }
    }

    // Record the moment a request for approval enters the queue
    if (($body['status'] ?? null) === 'pending_approval') {
        $fields[] = '`requested_at` = NOW()';
        $fields[] = '`approved_at` = NULL';
    }
    // Record the moment the content is approved (for lead-time metrics)
    if (($body['status'] ?? null) === 'approved') {
        $fields[] = '`approved_at` = NOW()';
    }
    // Reject/revision invalidate any previous approval.
    if (in_array(($body['status'] ?? null), ['revision', 'rejected'], true)) {
        $fields[] = '`approved_at` = NULL';
    }
    if (empty($fields)) jsonError('ไม่มีข้อมูลที่จะอัปเดต');
    $values[] = $id; $values[] = $tenantId;
    $db->prepare('UPDATE content_items SET ' . implode(', ', $fields) . ', updated_at=NOW() WHERE id = ? AND tenant_id = ?')->execute($values);
    $stmt = $db->prepare('SELECT ci.*, cpi.day_label, cp.title AS plan_title, cp.id AS plan_id, cp.week_start FROM content_items ci LEFT JOIN content_plan_items cpi ON cpi.id=ci.plan_item_id LEFT JOIN content_plans cp ON cp.id=COALESCE(ci.plan_id, cpi.plan_id) WHERE ci.id=? AND ci.tenant_id=?');
    $stmt->execute([$id, $tenantId]);
    jsonResponse($stmt->fetch());
}

if ($method === 'DELETE') {
    $id = $_GET['id'] ?? null;
    if (!$id) jsonError('Missing id');
    $db->prepare('DELETE FROM content_items WHERE id = ? AND tenant_id = ?')->execute([$id, $tenantId]);
    jsonResponse(['deleted' => true]);
}

jsonError('Method not allowed', 405);
