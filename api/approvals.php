<?php
// GET    /api/approvals.php                         — list my pending approvals (approver inbox)
// GET    /api/approvals.php?entity_type=&entity_id= — get approval chain for entity
// POST   /api/approvals.php                         — create approval request chain
// POST   /api/approvals.php?action=decide&id=<id>  — approve or reject
// DELETE /api/approvals.php?id=<id>                — cancel request (requester or admin)
require_once __DIR__ . '/auth.php';

$user     = requireAuth();
$db       = getDB();
$method   = getMethod();
$tenantId = $user['tenant_id'];
$userId   = $user['user_id'];

$id     = $_GET['id']     ?? null;
$action = $_GET['action'] ?? '';

// ── GET ───────────────────────────────────────────────────────────────────────
if ($method === 'GET') {
  // Approval chain for an entity
  if (isset($_GET['entity_type']) && isset($_GET['entity_id'])) {
    $stmt = $db->prepare(
      'SELECT ar.*,
              u_approver.display_name as approver_name,
              u_req.display_name as requester_name
       FROM approval_requests ar
       JOIN users u_approver ON u_approver.id = ar.approver_id
       JOIN users u_req      ON u_req.id      = ar.requested_by
       WHERE ar.tenant_id = ? AND ar.entity_type = ? AND ar.entity_id = ?
       ORDER BY ar.step_order ASC, ar.created_at ASC'
    );
    $stmt->execute([$tenantId, $_GET['entity_type'], $_GET['entity_id']]);
    jsonResponse($stmt->fetchAll(PDO::FETCH_ASSOC));
  }

  // My pending approvals inbox
  $mine = $_GET['mine'] ?? '0';
  if ($mine === '1') {
    $stmt = $db->prepare(
      'SELECT ar.*,
              u_approver.display_name as approver_name,
              u_req.display_name as requester_name
       FROM approval_requests ar
       JOIN users u_approver ON u_approver.id = ar.approver_id
       JOIN users u_req      ON u_req.id      = ar.requested_by
       WHERE ar.tenant_id = ? AND ar.approver_id = ? AND ar.status = \'pending\'
       ORDER BY ar.created_at ASC'
    );
    $stmt->execute([$tenantId, $userId]);
    jsonResponse($stmt->fetchAll(PDO::FETCH_ASSOC));
  }

  // All requests (admin view)
  $stmt = $db->prepare(
    'SELECT ar.*,
            u_approver.display_name as approver_name,
            u_req.display_name as requester_name
     FROM approval_requests ar
     JOIN users u_approver ON u_approver.id = ar.approver_id
     JOIN users u_req      ON u_req.id      = ar.requested_by
     WHERE ar.tenant_id = ?
     ORDER BY ar.created_at DESC
     LIMIT 200'
  );
  $stmt->execute([$tenantId]);
  jsonResponse($stmt->fetchAll(PDO::FETCH_ASSOC));
}

// ── POST ──────────────────────────────────────────────────────────────────────
if ($method === 'POST') {
  // Decide (approve/reject)
  if ($action === 'decide' && $id) {
    $body    = json_decode(file_get_contents('php://input'), true) ?? [];
    $decision = $body['status'] ?? ''; // 'approved' or 'rejected'
    if (!in_array($decision, ['approved','rejected'])) jsonError('status must be approved or rejected', 422);

    $stmt = $db->prepare('SELECT * FROM approval_requests WHERE id = ? AND tenant_id = ? AND approver_id = ?');
    $stmt->execute([$id, $tenantId, $userId]);
    $req = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$req) jsonError('Approval request not found or not yours', 404);
    if ($req['status'] !== 'pending') jsonError('Already decided', 409);

    $db->prepare(
      'UPDATE approval_requests SET status=?, decided_at=NOW(), comment=?, updated_at=NOW() WHERE id=?'
    )->execute([$decision, $body['comment'] ?? null, $id]);

    // Keep content_items approval state in sync with the approval chain.
    if ($req['entity_type'] === 'content_item') {
      if ($decision === 'rejected') {
        $db->prepare('UPDATE content_items SET status=\'rejected\', approved_at=NULL, updated_at=NOW() WHERE id=? AND tenant_id=?')
          ->execute([$req['entity_id'], $tenantId]);
      } else {
        $pendingStmt = $db->prepare(
          'SELECT COUNT(*) FROM approval_requests
           WHERE tenant_id=? AND entity_type=? AND entity_id=? AND status=\'pending\''
        );
        $pendingStmt->execute([$tenantId, $req['entity_type'], $req['entity_id']]);
        if ((int)$pendingStmt->fetchColumn() === 0) {
          $db->prepare('UPDATE content_items SET status=\'approved\', approved_at=NOW(), updated_at=NOW() WHERE id=? AND tenant_id=?')
            ->execute([$req['entity_id'], $tenantId]);
        } else {
          $db->prepare('UPDATE content_items SET status=\'pending_approval\', approved_at=NULL, updated_at=NOW() WHERE id=? AND tenant_id=?')
            ->execute([$req['entity_id'], $tenantId]);
        }
      }
    }

    // If rejected, cancel remaining steps in chain for this entity
    if ($decision === 'rejected') {
      $db->prepare(
        'UPDATE approval_requests SET status=\'cancelled\', updated_at=NOW()
         WHERE tenant_id=? AND entity_type=? AND entity_id=? AND status=\'pending\' AND step_order > ?'
      )->execute([$tenantId, $req['entity_type'], $req['entity_id'], $req['step_order']]);
    }

    jsonResponse(['success' => true, 'status' => $decision]);
  }

  // Create approval chain
  $body = json_decode(file_get_contents('php://input'), true) ?? [];
  $entityType = $body['entity_type'] ?? '';
  $entityId   = $body['entity_id']   ?? '';
  $approvers  = $body['approvers']   ?? []; // array of user_id (in order)

  if (!$entityType || !$entityId)  jsonError('entity_type and entity_id required', 422);
  if (empty($approvers))           jsonError('approvers array required', 422);

  // A new approval request invalidates any previous approval for this content version.
  if ($entityType === 'content_item') {
    $db->prepare('UPDATE content_items SET status=\'pending_approval\', approved_at=NULL, updated_at=NOW() WHERE id=? AND tenant_id=?')
      ->execute([$entityId, $tenantId]);
  }

  // Cancel any existing pending chain for this entity
  $db->prepare(
    'UPDATE approval_requests SET status=\'cancelled\', updated_at=NOW()
     WHERE tenant_id=? AND entity_type=? AND entity_id=? AND status=\'pending\''
  )->execute([$tenantId, $entityType, $entityId]);

  $created = [];
  foreach ($approvers as $step => $approverId) {
    $reqId = generateUUID();
    $db->prepare(
      'INSERT INTO approval_requests (id, tenant_id, entity_type, entity_id, step_order, approver_id, status, requested_by)
       VALUES (?,?,?,?,?,?,\'pending\',?)'
    )->execute([$reqId, $tenantId, $entityType, $entityId, $step + 1, $approverId, $userId]);
    $created[] = $reqId;
  }

  jsonResponse(['success' => true, 'created' => count($created)], 201);
}

// ── DELETE ────────────────────────────────────────────────────────────────────
if ($method === 'DELETE') {
  if (!$id) jsonError('id required', 400);
  $stmt = $db->prepare('SELECT * FROM approval_requests WHERE id = ? AND tenant_id = ?');
  $stmt->execute([$id, $tenantId]);
  $req = $stmt->fetch(PDO::FETCH_ASSOC);
  if (!$req) jsonError('Not found', 404);

  // Only requester or admin can cancel
  $isAdmin = isTenantAdmin($db, $userId, $tenantId);

  if ($req['requested_by'] !== $userId && !$isAdmin) {
    jsonError('Forbidden', 403);
  }

  // Cancel all steps in the chain
  $db->prepare(
    'UPDATE approval_requests SET status=\'cancelled\', updated_at=NOW()
     WHERE tenant_id=? AND entity_type=? AND entity_id=? AND status=\'pending\''
  )->execute([$tenantId, $req['entity_type'], $req['entity_id']]);

  jsonResponse(['success' => true]);
}

jsonError('Method not allowed', 405);
