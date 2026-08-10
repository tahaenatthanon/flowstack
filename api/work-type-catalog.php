<?php

function defaultTaskTypeCatalog(): array {
    return [
        ['key' => 'task', 'label' => 'งานปกติ', 'color' => '#10b981', 'active' => 1, 'system' => 1],
        ['key' => 'meeting', 'label' => 'ประชุม', 'color' => '#3b82f6', 'active' => 1, 'system' => 1],
        ['key' => 'leave', 'label' => 'ลาหยุด', 'color' => '#f59e0b', 'active' => 1, 'system' => 1],
        ['key' => 'onsite', 'label' => 'งานลูกค้า (Onsite)', 'color' => '#06b6d4', 'active' => 1, 'system' => 0],
        ['key' => 'ot', 'label' => 'งานล่วงเวลา (OT)', 'color' => '#f97316', 'active' => 1, 'system' => 0],
        ['key' => 'weekend_work', 'label' => 'งานวันหยุด (Weekend)', 'color' => '#14b8a6', 'active' => 1, 'system' => 0],
        ['key' => 'research', 'label' => 'วิจัย', 'color' => '#8b5cf6', 'active' => 1, 'system' => 0],
        ['key' => 'interrupt', 'label' => 'งานแทรก', 'color' => '#f43f5e', 'active' => 1, 'system' => 0],
    ];
}

function defaultCalendarEventTypeCatalog(): array {
    return [
        ['key' => 'meeting', 'label' => 'ประชุม/นัดหมาย', 'color' => '#3b82f6', 'active' => 1, 'system' => 1],
        ['key' => 'leave',   'label' => 'วันลา',          'color' => '#f59e0b', 'active' => 1, 'system' => 1],
        ['key' => 'holiday', 'label' => 'วันหยุดบริษัท',  'color' => '#ef4444', 'active' => 1, 'system' => 1],
        ['key' => 'other',   'label' => 'อื่นๆ',           'color' => '#8b5cf6', 'active' => 1, 'system' => 1],
    ];
}

function normalizeTypeCatalog($raw, array $defaults): array {
    $byKey = [];
    foreach ($defaults as $row) {
        $byKey[$row['key']] = $row;
    }

    $rows = [];
    if (is_string($raw) && trim($raw) !== '') {
        $decoded = json_decode($raw, true);
        if (is_array($decoded)) {
            $rows = $decoded;
        }
    } elseif (is_array($raw)) {
        $rows = $raw;
    }

    $sanitized = [];
    foreach ($rows as $row) {
        if (!is_array($row)) {
            continue;
        }
        $key = strtolower(trim((string)($row['key'] ?? '')));
        if ($key === '' || !preg_match('/^[a-z0-9_]{2,50}$/', $key)) {
            continue;
        }
        $label = trim((string)($row['label'] ?? ''));
        if ($label === '') {
            $label = $byKey[$key]['label'] ?? $key;
        }
        $color = trim((string)($row['color'] ?? ''));
        if (!preg_match('/^#[0-9a-fA-F]{6}$/', $color)) {
            $color = $byKey[$key]['color'] ?? '#6b7280';
        }
        $active = !empty($row['active']) ? 1 : 0;
        $system = !empty($row['system']) ? 1 : (!empty($byKey[$key]['system']) ? 1 : 0);

        $sanitized[$key] = [
            'key' => $key,
            'label' => $label,
            'color' => $color,
            'active' => $active,
            'system' => $system,
        ];
    }

    foreach ($defaults as $row) {
        $key = $row['key'];
        if (!isset($sanitized[$key])) {
            $sanitized[$key] = $row;
            continue;
        }
        if (!empty($row['system'])) {
            $sanitized[$key]['system'] = 1;
        }
    }

    return array_values($sanitized);
}

function getWorkTypeCatalog(PDO $db, string $tenantId = ''): array {
    $where = $tenantId ? 'tenant_id = ?' : 'id = 1';
    $stmt = $db->prepare("SELECT task_type_catalog, calendar_event_type_catalog FROM company_settings WHERE $where");
    $stmt->execute($tenantId ? [$tenantId] : []);
    $row = $stmt->fetch(PDO::FETCH_ASSOC) ?: [];

    $taskTypes = normalizeTypeCatalog($row['task_type_catalog'] ?? null, defaultTaskTypeCatalog());
    $taskTypes = array_values(array_filter($taskTypes, fn(array $type) => $type['key'] !== 'holiday'));

    $calendarEventTypes = normalizeTypeCatalog($row['calendar_event_type_catalog'] ?? null, defaultCalendarEventTypeCatalog());

    return [
        'task_types' => $taskTypes,
        'calendar_event_types' => $calendarEventTypes,
    ];
}

function getAllowedTaskTypes(PDO $db, bool $includeInactive = false, string $tenantId = ''): array {
    $catalog = getWorkTypeCatalog($db, $tenantId)['task_types'];
    return array_values(array_map(
        fn(array $row) => $row['key'],
        array_filter($catalog, fn(array $row) => $includeInactive || !empty($row['active']))
    ));
}

function getAllowedCalendarEventTypes(PDO $db, bool $includeInactive = false, string $tenantId = ''): array {
    $catalog = getWorkTypeCatalog($db, $tenantId)['calendar_event_types'];
    return array_values(array_map(
        fn(array $row) => $row['key'],
        array_filter($catalog, fn(array $row) => $includeInactive || !empty($row['active']))
    ));
}

function defaultLeadSourceCatalog(): array {
    return [
        ['key' => 'seo', 'label' => 'SEO / Organic Search', 'active' => 1, 'system' => 0],
        ['key' => 'bni', 'label' => 'BNI / Network', 'active' => 1, 'system' => 0],
        ['key' => 'cold_call', 'label' => 'Cold Call', 'active' => 1, 'system' => 0],
        ['key' => 'referral', 'label' => 'Referral', 'active' => 1, 'system' => 0],
        ['key' => 'existing', 'label' => 'Existing Customer', 'active' => 1, 'system' => 0],
        ['key' => 'direct', 'label' => 'Direct Contact', 'active' => 1, 'system' => 0],
    ];
}

function normalizeLeadSourceCatalog($raw): array {
    $rows = [];
    if (is_string($raw) && trim($raw) !== '') {
        $decoded = json_decode($raw, true);
        if (is_array($decoded)) {
            $rows = $decoded;
        }
    } elseif (is_array($raw)) {
        $rows = $raw;
    }

    $defaults = defaultLeadSourceCatalog();
    $byKey = [];
    foreach ($defaults as $row) {
        $byKey[$row['key']] = $row;
    }

    $sanitized = [];
    foreach ($rows as $row) {
        if (!is_array($row)) continue;
        $key = strtolower(trim((string)($row['key'] ?? '')));
        if ($key === '' || !preg_match('/^[a-z0-9_]{2,50}$/', $key)) continue;
        $label = trim((string)($row['label'] ?? ''));
        if ($label === '') {
            $label = $byKey[$key]['label'] ?? $key;
        }
        $active = !empty($row['active']) ? 1 : 0;
        $sanitized[$key] = ['key' => $key, 'label' => $label, 'active' => $active, 'system' => 0];
    }

    foreach ($defaults as $row) {
        if (!isset($sanitized[$row['key']])) {
            $sanitized[$row['key']] = $row;
        }
    }

    return array_values($sanitized);
}

function normalizeTaskTypeInput(string $taskType): string {
    $taskType = strtolower(trim($taskType));
    if ($taskType === 'work') {
        return 'task';
    }
    return $taskType;
}
