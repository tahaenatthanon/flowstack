<?php
// api/personas.php
// GET                             — list all personas for tenant + global seeds
// GET  ?action=my_preference      — get current user's active persona
// POST (body: {action:'set_preference', persona_id})  — save user preference
// POST (admin, body: persona data) — create new persona
// PUT  ?id=UUID (admin)           — update persona
// DELETE ?id=UUID (admin)         — delete tenant persona (seeds protected)

require_once __DIR__ . '/auth.php';

$tokenData = requireAuth();
$userId    = $tokenData['user_id'];
$tenantId  = $tokenData['tenant_id'];
$db        = getDB();

// Check if user is admin (tenant-scoped) — same pattern as tasks.php
$isAdmin = isTenantAdmin($db, $userId, $tenantId);
$method    = getMethod();
$action    = $_GET['action'] ?? null;

if ($method === 'GET') {
    if ($action === 'my_preference') {
        $stmt = $db->prepare(
            "SELECT p.* FROM ai_personas p
             JOIN user_persona_preference pp ON pp.persona_id = p.id
             WHERE pp.user_id = ?"
        );
        $stmt->execute([$userId]);
        $persona = $stmt->fetch();

        if (!$persona) {
            // Fall back to tenant default, then global default
            $stmt2 = $db->prepare(
                "SELECT * FROM ai_personas
                 WHERE (tenant_id = ? OR tenant_id = '00000000-0000-0000-0000-000000000000')
                   AND is_default = 1
                 ORDER BY CASE WHEN tenant_id = ? THEN 0 ELSE 1 END
                 LIMIT 1"
            );
            $stmt2->execute([$tenantId, $tenantId]);
            $persona = $stmt2->fetch();
        }
        jsonResponse($persona ?: null);
    }

    // List all personas: tenant-specific + global seeds
    $stmt = $db->prepare(
        "SELECT * FROM ai_personas
         WHERE tenant_id = ? OR tenant_id = '00000000-0000-0000-0000-000000000000'
         ORDER BY is_default DESC, name ASC"
    );
    $stmt->execute([$tenantId]);
    jsonResponse($stmt->fetchAll());
}

if ($method === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true) ?? [];
    $postAction = $data['action'] ?? $action;

    if ($postAction === 'set_preference') {
        $personaId = $data['persona_id'] ?? null;
        if (!$personaId) jsonError('Missing persona_id');

        $stmt = $db->prepare(
            "SELECT id FROM ai_personas
             WHERE id = ? AND (tenant_id = ? OR tenant_id = '00000000-0000-0000-0000-000000000000')"
        );
        $stmt->execute([$personaId, $tenantId]);
        if (!$stmt->fetch()) jsonError('Persona not found', 404);

        $db->prepare(
            "INSERT INTO user_persona_preference (user_id, persona_id) VALUES (?, ?)
             ON DUPLICATE KEY UPDATE persona_id = VALUES(persona_id)"
        )->execute([$userId, $personaId]);

        jsonResponse(['saved' => true]);
    }

    // Create persona — admin only
    if (!$isAdmin) jsonError('Forbidden', 403);
    foreach (['name', 'personality'] as $f) {
        if (empty($data[$f])) jsonError("Missing required field: $f");
    }

    $id = generateUUID();
    $db->prepare(
        "INSERT INTO ai_personas
         (id, tenant_id, created_by, name, avatar_emoji, description, personality, data_scope, is_default)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )->execute([
        $id, $tenantId, $userId,
        $data['name'],
        $data['avatar_emoji'] ?? '🤖',
        $data['description'] ?? null,
        $data['personality'],
        $data['data_scope'] ?? 'personal',
        (int)($data['is_default'] ?? 0),
    ]);

    $stmt = $db->prepare("SELECT * FROM ai_personas WHERE id = ?");
    $stmt->execute([$id]);
    jsonResponse($stmt->fetch(), 201);
}

if ($method === 'PUT') {
    if (!$isAdmin) jsonError('Forbidden', 403);
    $id = $_GET['id'] ?? null;
    if (!$id) jsonError('Missing id');

    $data = json_decode(file_get_contents('php://input'), true) ?? [];
    $fields = ['name', 'avatar_emoji', 'description', 'personality', 'data_scope', 'is_default'];
    $sets = [];
    $vals = [];
    foreach ($fields as $f) {
        if (array_key_exists($f, $data)) {
            $sets[] = "`$f` = ?";
            $vals[] = $data[$f];
        }
    }
    if (empty($sets)) jsonError('No fields to update');
    $vals[] = $id;
    $vals[] = $tenantId;
    $db->prepare("UPDATE ai_personas SET " . implode(', ', $sets) . " WHERE id = ? AND tenant_id = ?")->execute($vals);

    $stmt = $db->prepare("SELECT * FROM ai_personas WHERE id = ?");
    $stmt->execute([$id]);
    jsonResponse($stmt->fetch());
}

if ($method === 'DELETE') {
    if (!$isAdmin) jsonError('Forbidden', 403);
    $id = $_GET['id'] ?? null;
    if (!$id) jsonError('Missing id');

    $stmt = $db->prepare("SELECT tenant_id FROM ai_personas WHERE id = ?");
    $stmt->execute([$id]);
    $p = $stmt->fetch();
    if (!$p) jsonError('Not found', 404);
    if ($p['tenant_id'] === '00000000-0000-0000-0000-000000000000') {
        jsonError('Cannot delete default system personas', 403);
    }

    $db->prepare("DELETE FROM ai_personas WHERE id = ? AND tenant_id = ?")->execute([$id, $tenantId]);
    jsonResponse(['deleted' => true]);
}

jsonError('Method not allowed', 405);
