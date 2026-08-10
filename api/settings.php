<?php
// GET  /api/settings.php       - Read company settings
// PUT  /api/settings.php       - Update company settings (admin only)
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/work-type-catalog.php';

$db = getDB();
$method = getMethod();

if ($method === 'GET') {
    $tokenData = requireAuth();
    $tenantId  = $tokenData['tenant_id'];

    $stmt = $db->prepare('SELECT * FROM company_settings WHERE tenant_id = ?');
    $stmt->execute([$tenantId]);
    $settings = $stmt->fetch();

    if (!$settings) {
        jsonResponse([]);
    }

    $settings['task_type_catalog'] = normalizeTypeCatalog(
        $settings['task_type_catalog'] ?? null,
        defaultTaskTypeCatalog()
    );
    $settings['calendar_event_type_catalog'] = normalizeTypeCatalog(
        $settings['calendar_event_type_catalog'] ?? null,
        defaultCalendarEventTypeCatalog()
    );
    $settings['lead_source_catalog'] = normalizeLeadSourceCatalog(
        $settings['lead_source_catalog'] ?? null
    );

    jsonResponse($settings);
}

if ($method === 'PUT') {
    $tokenData = requireAuth();
    $tenantId  = $tokenData['tenant_id'];
    requireAdmin($db, $tokenData['user_id'], $tenantId);

    $body = getRequestBody();

    // Allowed fields
    $allowedFields = [
        'company_name', 'company_name_en', 'address', 'phone', 'fax',
        'email', 'website', 'tax_id', 'logo_url',
        'app_base_url',
        'quotation_prefix', 'quotation_running_number', 'quotation_number_format',
        'default_validity_days', 'default_payment_terms', 'default_tax_rate',
        'currency', 'currency_symbol',
        'bank_name', 'bank_account_name', 'bank_account_number', 'bank_branch',
        'ai_active_provider_id', 'ai_default_model_id',
        'task_type_catalog', 'calendar_event_type_catalog', 'lead_source_catalog',
        'max_task_hours',
    ];

    $setParts = [];
    $params = [];

    foreach ($allowedFields as $field) {
        if (array_key_exists($field, $body)) {
            $setParts[] = "`$field` = ?";
            if ($field === 'task_type_catalog') {
                $params[] = json_encode(
                    normalizeTypeCatalog($body[$field], defaultTaskTypeCatalog()),
                    JSON_UNESCAPED_UNICODE
                );
            } elseif ($field === 'calendar_event_type_catalog') {
                $params[] = json_encode(
                    normalizeTypeCatalog($body[$field], defaultCalendarEventTypeCatalog()),
                    JSON_UNESCAPED_UNICODE
                );
            } elseif ($field === 'lead_source_catalog') {
                $params[] = json_encode(
                    normalizeLeadSourceCatalog($body[$field]),
                    JSON_UNESCAPED_UNICODE
                );
            } else {
                $params[] = $body[$field];
            }
        }
    }

    if (empty($setParts)) {
        jsonError('No valid fields to update');
    }

    $sql = "UPDATE company_settings SET " . implode(', ', $setParts) . " WHERE tenant_id = ?";
    $params[] = $tenantId;
    $stmt = $db->prepare($sql);
    $stmt->execute($params);

    // Return updated settings
    $stmt = $db->prepare('SELECT * FROM company_settings WHERE tenant_id = ?');
    $stmt->execute([$tenantId]);
    $settings = $stmt->fetch();

    $settings['task_type_catalog'] = normalizeTypeCatalog(
        $settings['task_type_catalog'] ?? null,
        defaultTaskTypeCatalog()
    );
    $settings['calendar_event_type_catalog'] = normalizeTypeCatalog(
        $settings['calendar_event_type_catalog'] ?? null,
        defaultCalendarEventTypeCatalog()
    );
    $settings['lead_source_catalog'] = normalizeLeadSourceCatalog(
        $settings['lead_source_catalog'] ?? null
    );

    jsonResponse($settings);
}

jsonError('Method not allowed', 405);
