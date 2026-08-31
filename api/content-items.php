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
                      COALESCE(ci.views, 0)             AS views,
                      COALESCE(ci.likes, 0)             AS likes,
                      COALESCE(ci.created_by, \'\')      AS created_by,
                      ci.plan_item_id,
                      COALESCE(NULLIF(ci.caption,\'\'), cpi.caption)         AS caption,
                      COALESCE(NULLIF(ci.image_brief,\'\'), cpi.image_brief) AS image_brief,
                      COALESCE(NULLIF(ci.generated_image_url,\'\'), cpi.generated_image_url) AS generated_image_url,
                      COALESCE(NULLIF(ci.article_content,\'\'), cpi.article_content) AS article_content,
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
    $db->prepare('INSERT INTO content_items (id, tenant_id, title, type, status, created_by, plan_item_id, platform, scheduled_date, caption, image_brief, plan_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
       ->execute([$id, $tenantId, $body['title'], $body['type'] ?? 'article', $body['status'] ?? 'draft', $userId, $planItemId, $platform, $body['scheduled_date'] ?? null, $body['caption'] ?? '', $body['image_brief'] ?? '', $body['plan_id'] ?? null]);
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
    $allowed = ['title', 'type', 'status', 'views', 'likes', 'caption', 'platform', 'scheduled_date', 'image_brief', 'article_content', 'reject_reason', 'seo_title', 'slug', 'meta_description', 'meta_keywords', 'structured_data', 'og_image'];
    $fields  = []; $values = [];
    foreach ($allowed as $f) {
        if (array_key_exists($f, $body)) {
            $fields[] = "`$f` = ?";
            if ($f === 'platform') {
                $values[] = strtolower(trim((string)$body[$f]));
            } elseif ($f === 'structured_data' && is_array($body[$f])) {
                $values[] = json_encode($body[$f], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            } else {
                $values[] = $body[$f];
            }
        }
    }
    // Record the moment a request for approval enters the queue
    if (($body['status'] ?? null) === 'pending_approval') {
        $fields[] = '`requested_at` = NOW()';
    }
    // Record the moment the content is approved (for lead-time metrics)
    if (($body['status'] ?? null) === 'approved') {
        $fields[] = '`approved_at` = NOW()';
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
