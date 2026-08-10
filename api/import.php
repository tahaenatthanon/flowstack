<?php
// POST /api/import.php
// Body: { "type": "companies|customers|projects|tasks|task_hours|opportunities", "rows": [...] }
require_once __DIR__ . '/auth.php';

$tokenData = requireAuth();
$db = getDB();
$method = getMethod();

function normalizeBool($value): int {
    if (is_bool($value)) return $value ? 1 : 0;
    $val = strtolower(trim((string)$value));
    return in_array($val, ['1', 'true', 'yes', 'y', 'ใช่'], true) ? 1 : 0;
}

function stripInvisible(string $value): string {
    // Strip BOM (U+FEFF) and other zero-width/invisible Unicode characters
    return preg_replace('/[\x{FEFF}\x{200B}\x{200C}\x{200D}\x{00A0}]/u', '', $value);
}

function parseDate($value): ?string {
    if ($value === null || $value === '') {
        return null;
    }

    // Strip BOM and invisible chars, then trim
    $value = stripInvisible(trim((string)$value));
    if ($value === '') {
        return null;
    }

    // Already YYYY-MM-DD
    if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $value)) {
        return $value;
    }

    // Excel serial date number
    if (is_numeric($value)) {
        $base = new DateTime('1899-12-30', new DateTimeZone('UTC'));
        $base->modify('+' . intval($value) . ' days');
        return $base->format('Y-m-d');
    }

    // Try date formats — m/d/Y (MM/DD/YYYY) before d/m/Y to match Excel US format
    $formats = ['Y-m-d', 'm/d/Y', 'd/m/Y', 'm-d-Y', 'd-m-Y', 'Y/m/d', 'd.m.Y', 'Ymd'];
    foreach ($formats as $format) {
        $date = DateTime::createFromFormat($format, $value);
        if ($date && $date->format($format) === $value) {
            return $date->format('Y-m-d');
        }
    }

    // Last resort
    $timestamp = strtotime($value);
    if ($timestamp !== false) {
        return date('Y-m-d', $timestamp);
    }

    return null;
}

function findCompanyIdByName(PDO $db, string $name, string $tenantId, bool $createIfMissing = true): ?string {
    $stmt = $db->prepare('SELECT id FROM companies WHERE name = ? AND tenant_id = ?');
    $stmt->execute([$name, $tenantId]);
    $row = $stmt->fetch();
    if ($row) return $row['id'];
    if (!$createIfMissing) return null;

    $id = generateUUID();
    $stmt = $db->prepare('
        INSERT INTO companies (id, tenant_id, name, description, address, phone, email, website, tax_id, logo_url, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ');
    $stmt->execute([$id, $tenantId, $name, '', '', '', '', '', '', '', 1]);
    return $id;
}

function findUserIdByEmail(PDO $db, string $email): ?string {
    if ($email === '') return null;
    $stmt = $db->prepare('SELECT id FROM users WHERE email = ?');
    $stmt->execute([$email]);
    $row = $stmt->fetch();
    return $row ? $row['id'] : null;
}

function findCustomerIdByEmail(PDO $db, string $email, string $tenantId): ?string {
    if ($email === '') return null;
    $stmt = $db->prepare('SELECT id FROM customers WHERE email = ? AND tenant_id = ?');
    $stmt->execute([$email, $tenantId]);
    $row = $stmt->fetch();
    return $row ? $row['id'] : null;
}

function findProjectId(PDO $db, string $projectName, ?string $companyId, string $tenantId): ?string {
    if ($projectName === '' || !$companyId) return null;
    $stmt = $db->prepare('SELECT id FROM projects WHERE name = ? AND company_id = ? AND tenant_id = ? LIMIT 1');
    $stmt->execute([$projectName, $companyId, $tenantId]);
    $row = $stmt->fetch();
    return $row ? $row['id'] : null;
}

// Find project by name (with optional company_id), no opportunity-link constraint
function findProjectByName(PDO $db, string $projectName, ?string $companyId, string $tenantId): ?string {
    if ($projectName === '') return null;
    if ($companyId) {
        $stmt = $db->prepare('SELECT id FROM projects WHERE name = ? AND company_id = ? AND tenant_id = ? LIMIT 1');
        $stmt->execute([$projectName, $companyId, $tenantId]);
        $row = $stmt->fetch();
        if ($row) return $row['id'];
    }
    $stmt = $db->prepare('SELECT id FROM projects WHERE name = ? AND tenant_id = ? LIMIT 1');
    $stmt->execute([$projectName, $tenantId]);
    $row = $stmt->fetch();
    return $row ? $row['id'] : null;
}

function findTaskId(PDO $db, string $title, string $projectId, string $tenantId, ?string $startDate = null): ?string {
    if ($title === '' || $projectId === '') return null;
    if ($startDate !== null) {
        $stmt = $db->prepare('SELECT id FROM tasks WHERE title = ? AND project_id = ? AND tenant_id = ? AND start_date = ? AND deleted_at IS NULL LIMIT 1');
        $stmt->execute([$title, $projectId, $tenantId, $startDate]);
    } else {
        $stmt = $db->prepare('SELECT id FROM tasks WHERE title = ? AND project_id = ? AND tenant_id = ? AND deleted_at IS NULL LIMIT 1');
        $stmt->execute([$title, $projectId, $tenantId]);
    }
    $row = $stmt->fetch();
    return $row ? $row['id'] : null;
}

if ($method !== 'POST') {
    jsonError('Method not allowed', 405);
}

requireAdminOrPermission($db, $tokenData['user_id'], $tokenData['tenant_id'], 'admin');

$body = getRequestBody();
$type = trim($body['type'] ?? '');
$rows = $body['rows'] ?? [];
$tenantId = $tokenData['tenant_id'];

if ($type === '' || !is_array($rows)) {
    jsonError('Invalid import payload');
}

$inserted = 0;
$updated = 0;
$skipped = 0;
$errors = [];

foreach ($rows as $index => $row) {
    try {
        if ($type === 'companies') {
            $name = trim($row['name'] ?? '');
            if ($name === '') {
                $skipped++;
                continue;
            }

            $stmt = $db->prepare('SELECT id FROM companies WHERE name = ? AND tenant_id = ?');
            $stmt->execute([$name, $tenantId]);
            $existing = $stmt->fetch();

            $description = trim($row['description'] ?? '');
            $address = trim($row['address'] ?? '');
            $phone = trim($row['phone'] ?? '');
            $email = trim($row['email'] ?? '');
            $website = trim($row['website'] ?? '');
            $taxId = trim($row['tax_id'] ?? '');
            $logoUrl = trim($row['logo_url'] ?? '');
            $isActive = normalizeBool($row['is_active'] ?? 1);

            if ($existing) {
                $stmt = $db->prepare('UPDATE companies SET description = ?, address = ?, phone = ?, email = ?, website = ?, tax_id = ?, logo_url = ?, is_active = ? WHERE id = ?');
                $stmt->execute([$description, $address, $phone, $email, $website, $taxId, $logoUrl, $isActive, $existing['id']]);
                $updated++;
            } else {
                $id = generateUUID();
                $stmt = $db->prepare('INSERT INTO companies (id, tenant_id, name, description, address, phone, email, website, tax_id, logo_url, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
                $stmt->execute([$id, $tenantId, $name, $description, $address, $phone, $email, $website, $taxId, $logoUrl, $isActive]);
                $inserted++;
            }
            continue;
        }

        if ($type === 'customers') {
            $email = trim($row['email'] ?? '');
            $companyName = trim($row['company_name'] ?? '');
            if ($email === '' || $companyName === '') {
                $skipped++;
                continue;
            }
            $companyId = findCompanyIdByName($db, $companyName, $tenantId, true);
            $firstName = trim($row['first_name'] ?? '');
            $lastName = trim($row['last_name'] ?? '');
            $phone = trim($row['phone'] ?? '');
            $position = trim($row['position'] ?? '');
            $isPrimary = normalizeBool($row['is_primary_contact'] ?? 0);
            $isActive = normalizeBool($row['is_active'] ?? 1);
            $notes = trim($row['notes'] ?? '');

            $stmt = $db->prepare('SELECT id FROM customers WHERE email = ? AND tenant_id = ?');
            $stmt->execute([$email, $tenantId]);
            $existing = $stmt->fetch();

            if ($existing) {
                $stmt = $db->prepare('UPDATE customers SET company_id = ?, first_name = ?, last_name = ?, phone = ?, position = ?, is_primary_contact = ?, is_active = ?, notes = ? WHERE id = ?');
                $stmt->execute([$companyId, $firstName, $lastName, $phone, $position, $isPrimary, $isActive, $notes, $existing['id']]);
                $updated++;
            } else {
                $id = generateUUID();
                $stmt = $db->prepare('INSERT INTO customers (id, tenant_id, company_id, first_name, last_name, email, phone, position, is_primary_contact, is_active, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
                $stmt->execute([$id, $tenantId, $companyId, $firstName, $lastName, $email, $phone, $position, $isPrimary, $isActive, $notes]);
                $inserted++;
            }
            continue;
        }

        if ($type === 'projects') {
            $projectName = trim($row['name'] ?? '');
            $companyName = trim($row['company_name'] ?? '');
            if ($projectName === '' || $companyName === '') {
                $skipped++;
                continue;
            }
            $companyId = findCompanyIdByName($db, $companyName, $tenantId, true);
            $customerEmail = trim($row['customer_email'] ?? '');
            $customerId = findCustomerIdByEmail($db, $customerEmail, $tenantId);
            $description = trim($row['description'] ?? '');
            $rawStatus = trim($row['status'] ?? '');
            $validProjectStatuses = ['on-track', 'at-risk', 'delayed', 'completed'];
            $status = in_array($rawStatus, $validProjectStatuses, true) ? $rawStatus : 'on-track';
            $startDate = parseDate($row['start_date'] ?? null);
            $endDate = parseDate($row['end_date'] ?? null);
            $projectValue = ($row['project_value'] !== '' && $row['project_value'] !== null) ? $row['project_value'] : null;
            $rawPaymentStatus = trim($row['payment_status'] ?? '');
            $validPaymentStatuses = ['pending', 'partial', 'paid', 'overdue'];
            $paymentStatus = in_array($rawPaymentStatus, $validPaymentStatuses, true) ? $rawPaymentStatus : 'pending';
            $paymentTerms = trim($row['payment_terms'] ?? '');

            $stmt = $db->prepare('SELECT id, start_date, end_date FROM projects WHERE name = ? AND company_id = ? AND tenant_id = ?');
            $stmt->execute([$projectName, $companyId, $tenantId]);
            $existing = $stmt->fetch();

            if ($existing) {
                // Only update start_date and end_date if explicitly provided in Excel
                // Also ensure we never save null dates
                if ($startDate !== null) {
                    $updateStartDate = $startDate;
                } elseif ($existing['start_date'] !== null) {
                    $updateStartDate = $existing['start_date'];
                } else {
                    $updateStartDate = date('Y-m-d'); // fallback if existing is null
                }
                
                if ($endDate !== null) {
                    $updateEndDate = $endDate;
                } elseif ($existing['end_date'] !== null) {
                    $updateEndDate = $existing['end_date'];
                } else {
                    $updateEndDate = date('Y-m-d', strtotime('+30 days')); // fallback if existing is null
                }
                
                $stmt = $db->prepare('UPDATE projects SET customer_id = ?, description = ?, status = ?, start_date = ?, end_date = ?, project_value = ?, payment_status = ?, payment_terms = ? WHERE id = ?');
                $stmt->execute([$customerId, $description, $status, $updateStartDate, $updateEndDate, $projectValue, $paymentStatus, $paymentTerms, $existing['id']]);
                $updated++;
            } else {
                // For new projects, use dates from Excel if provided, otherwise use defaults
                if ($startDate === null) {
                    $startDate = date('Y-m-d');
                }
                if ($endDate === null) {
                    $endDate = date('Y-m-d', strtotime('+30 days'));
                }
                $id = generateUUID();
                $stmt = $db->prepare('INSERT INTO projects (id, tenant_id, user_id, company_id, customer_id, name, description, status, start_date, end_date, project_value, payment_status, payment_terms) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
                $stmt->execute([$id, $tenantId, $tokenData['user_id'], $companyId, $customerId, $projectName, $description, $status, $startDate, $endDate, $projectValue, $paymentStatus, $paymentTerms]);
                $inserted++;
            }
            continue;
        }

        if ($type === 'tasks') {
            $title = trim($row['title'] ?? '');
            $projectName = trim($row['project_name'] ?? '');
            $companyName = trim($row['company_name'] ?? '');
            if ($title === '' || $projectName === '') {
                $skipped++;
                continue;
            }
            $companyId = $companyName !== '' ? findCompanyIdByName($db, $companyName, $tenantId, true) : null;

            // Parse task dates early so they can be used for auto-created project dates
            $description = trim($row['description'] ?? '');
            $rawStatus = trim($row['status'] ?? '');
            $validTaskStatuses = ['pending', 'in-progress', 'completed', 'overdue', 'cancelled'];
            $status = in_array($rawStatus, $validTaskStatuses, true) ? $rawStatus : 'pending';
            $rawPriority = trim($row['priority'] ?? '');
            $validPriorities = ['high', 'medium', 'low'];
            $priority = in_array($rawPriority, $validPriorities, true) ? $rawPriority : 'medium';
            $assigneeEmail = trim($row['assignee_email'] ?? '');
            $startDate = parseDate($row['start_date'] ?? null) ?? date('Y-m-d');
            $endDate = parseDate($row['end_date'] ?? null) ?? date('Y-m-d', strtotime('+7 days'));

            // Find project by name (with or without company), no opportunity constraint
            $projectId = findProjectByName($db, $projectName, $companyId, $tenantId);

            // If project still not found and we have company, auto-create using task's own dates
            if (!$projectId && $companyId) {
                $projectId = generateUUID();
                $stmt = $db->prepare('INSERT INTO projects (id, tenant_id, user_id, company_id, customer_id, name, description, status, start_date, end_date, project_value, payment_status, payment_terms) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
                $stmt->execute([
                    $projectId, $tenantId,
                    $tokenData['user_id'],
                    $companyId,
                    null,
                    $projectName,
                    '',
                    'on-track',
                    $startDate,
                    $endDate,
                    null,
                    'pending',
                    ''
                ]);
            }

            // If still no project ID, allow NULL (tasks.project_id is now nullable)
            if (!$projectId) {
                $errors[] = ['row' => $index + 1, 'message' => 'ไม่พบโปรเจกต์สำหรับงานนี้: ' . $projectName . ' - จะนำเข้าข้อมูลโดยไม่มีโปรเจกต์'];
            }
            $estimatedDays = max(1, (int)($row['estimated_days'] ?? 1));
            $daysSpent = (float)($row['days_spent'] ?? 0);
            $isAdHoc = normalizeBool($row['is_ad_hoc'] ?? 0);
            $rawTaskType = trim($row['task_type'] ?? 'task');
            $validTaskTypes = ['task', 'meeting', 'holiday', 'leave', 'onsite', 'ot'];
            $taskType = in_array($rawTaskType, $validTaskTypes, true) ? $rawTaskType : 'task';

            $existingId = findTaskId($db, $title, $projectId, $tenantId, $startDate);
            if ($existingId) {
                $stmt = $db->prepare('UPDATE tasks SET description = ?, status = ?, priority = ?, assignee = ?, start_date = ?, end_date = ?, estimated_days = ?, days_spent = ?, is_ad_hoc = ?, task_type = ? WHERE id = ?');
                $stmt->execute([$description, $status, $priority, $assigneeEmail, $startDate, $endDate, $estimatedDays, $daysSpent, $isAdHoc, $taskType, $existingId]);
                $updated++;
            } else {
                $id = generateUUID();
                $stmt = $db->prepare('INSERT INTO tasks (id, tenant_id, project_id, user_id, title, description, status, priority, assignee, start_date, end_date, estimated_days, days_spent, is_ad_hoc, task_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
                $stmt->execute([$id, $tenantId, $projectId, $tokenData['user_id'], $title, $description, $status, $priority, $assigneeEmail, $startDate, $endDate, $estimatedDays, $daysSpent, $isAdHoc, $taskType]);
                $inserted++;
            }
            continue;
        }

        if ($type === 'subtasks') {
            $title = trim($row['title'] ?? '');
            $parentTaskTitle = trim($row['parent_task_title'] ?? '');
            $projectName = trim($row['project_name'] ?? '');
            $companyName = trim($row['company_name'] ?? '');

            if ($title === '' || $parentTaskTitle === '' || $projectName === '') {
                $skipped++;
                continue;
            }

            $companyId = $companyName !== '' ? findCompanyIdByName($db, $companyName, $tenantId, true) : null;
            $projectId = findProjectByName($db, $projectName, $companyId, $tenantId);

            if (!$projectId) {
                $errors[] = ['row' => $index + 1, 'message' => 'ไม่พบโปรเจกต์: ' . $projectName];
                $skipped++;
                continue;
            }

            // Find parent task
            $parentTaskId = findTaskId($db, $parentTaskTitle, $projectId, $tenantId, null);
            if (!$parentTaskId) {
                $errors[] = ['row' => $index + 1, 'message' => 'ไม่พบงานหลัก: ' . $parentTaskTitle];
                $skipped++;
                continue;
            }

            $description = trim($row['description'] ?? '');
            $rawStatus = trim($row['status'] ?? '');
            $validTaskStatuses = ['pending', 'in-progress', 'completed', 'overdue', 'cancelled'];
            $status = in_array($rawStatus, $validTaskStatuses, true) ? $rawStatus : 'pending';
            $rawPriority = trim($row['priority'] ?? '');
            $validPriorities = ['high', 'medium', 'low'];
            $priority = in_array($rawPriority, $validPriorities, true) ? $rawPriority : 'medium';
            $assigneeEmail = trim($row['assignee_email'] ?? '');
            $startDate = parseDate($row['start_date'] ?? null) ?? date('Y-m-d');
            $endDate = parseDate($row['end_date'] ?? null) ?? date('Y-m-d', strtotime('+7 days'));
            $estimatedDays = max(1, (int)($row['estimated_days'] ?? 1));
            $daysSpent = (float)($row['days_spent'] ?? 0);
            $rawTaskType = trim($row['task_type'] ?? 'task');
            $validTaskTypes = ['task', 'meeting', 'holiday', 'leave', 'onsite', 'ot'];
            $taskType = in_array($rawTaskType, $validTaskTypes, true) ? $rawTaskType : 'task';

            $stmt = $db->prepare('SELECT id FROM tasks WHERE title = ? AND project_id = ? AND parent_task_id = ? AND is_subtask = 0 AND tenant_id = ? AND deleted_at IS NULL LIMIT 1');
            $stmt->execute([$title, $projectId, $parentTaskId, $tenantId]);
            $existing = $stmt->fetch();

            if ($existing) {
                $stmt = $db->prepare('UPDATE tasks SET description = ?, status = ?, priority = ?, assignee = ?, start_date = ?, end_date = ?, estimated_days = ?, days_spent = ?, task_type = ? WHERE id = ?');
                $stmt->execute([$description, $status, $priority, $assigneeEmail, $startDate, $endDate, $estimatedDays, $daysSpent, $taskType, $existing['id']]);
                $updated++;
            } else {
                $id = generateUUID();
                $stmt = $db->prepare('INSERT INTO tasks (id, tenant_id, project_id, user_id, parent_task_id, title, description, status, priority, assignee, start_date, end_date, estimated_days, days_spent, is_subtask, task_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)');
                $stmt->execute([$id, $tenantId, $projectId, $tokenData['user_id'], $parentTaskId, $title, $description, $status, $priority, $assigneeEmail, $startDate, $endDate, $estimatedDays, $daysSpent, $taskType]);
                $inserted++;
            }
            continue;
        }

        if ($type === 'task_hours') {
            $taskTitle = trim($row['task_title'] ?? '');
            $projectName = trim($row['project_name'] ?? '');
            $companyName = trim($row['company_name'] ?? '');
            $userEmail = trim($row['user_email'] ?? '');
            $date = parseDate($row['date'] ?? null);
            $hoursWorked = $row['hours_worked'] ?? null;
            $description = trim($row['description'] ?? '');
            $rawWorkType = trim($row['work_type'] ?? 'work');
            $validWorkTypes = ['work', 'meeting', 'ot', 'leave', 'holiday', 'onsite'];
            $workType = in_array($rawWorkType, $validWorkTypes, true) ? $rawWorkType : 'work';
            // Map work_type → task_type enum
            $workTypeToTaskType = ['work' => 'task', 'meeting' => 'meeting', 'ot' => 'ot', 'leave' => 'leave', 'holiday' => 'holiday', 'onsite' => 'onsite'];
            $taskType = $workTypeToTaskType[$workType] ?? 'task';
            
            if ($projectName === '' || $userEmail === '' || $date === null || $date === '' || $hoursWorked === null) {
                $skipped++;
                continue;
            }

            // Use description as task title if task_title is empty (truncated to 200 chars)
            $effectiveTaskTitle = $taskTitle !== '' ? $taskTitle : ($description !== '' ? mb_substr($description, 0, 200) : 'Timesheet Entry');

            $companyId = $companyName !== '' ? findCompanyIdByName($db, $companyName, $tenantId, true) : null;

            // Find project by name (with or without company), no opportunity constraint to avoid duplicates
            $projectId = findProjectByName($db, $projectName, $companyId, $tenantId);

            // Auto-create project only if it genuinely doesn't exist
            if (!$projectId && $projectName !== '') {
                $projectId = generateUUID();
                $stmt = $db->prepare('INSERT INTO projects (id, tenant_id, user_id, company_id, customer_id, name, description, status, start_date, end_date, project_value, payment_status, payment_terms) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
                $stmt->execute([
                    $projectId, $tenantId,
                    $tokenData['user_id'],
                    $companyId,
                    null,
                    $projectName,
                    '',
                    'on-track',
                    $date,
                    $date,
                    null,
                    'pending',
                    ''
                ]);
            }
            $taskId = null;
            if ($effectiveTaskTitle !== '') {
                $taskId = findTaskId($db, $effectiveTaskTitle, $projectId, $tenantId, $date);
                if (!$taskId) {
                    $daysSpentNew = round(floatval($hoursWorked) / 8, 2);
                    $taskId = generateUUID();
                    $stmt = $db->prepare('INSERT INTO tasks (id, tenant_id, project_id, user_id, title, description, status, priority, assignee, start_date, end_date, estimated_days, days_spent, is_ad_hoc, task_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
                    $stmt->execute([
                        $taskId, $tenantId, $projectId, $tokenData['user_id'],
                        $effectiveTaskTitle, $description,
                        'completed', 'medium', $userEmail,
                        $date, $date,
                        $daysSpentNew, $daysSpentNew,
                        1, $taskType,
                    ]);
                }
            }
            
            // If no task_id, we cannot create task hours entry
            if (!$taskId) {
                $skipped++;
                continue;
            }
            $userId = findUserIdByEmail($db, $userEmail);
            if (!$userId) {
                // Use current admin user as fallback if user not found
                $userId = $tokenData['user_id'];
            }

            // Update the task's days_spent (hours / 8) and task_type
            $daysSpent = round(floatval($hoursWorked) / 8, 2);
            $stmt = $db->prepare('UPDATE tasks SET days_spent = ?, description = ?, task_type = ?, status = "completed", is_ad_hoc = 1, updated_at = NOW() WHERE id = ?');
            $stmt->execute([$daysSpent, $description, $taskType, $taskId]);
            $inserted++;
            continue;
        }

        if ($type === 'opportunities') {
            // Strip BOM from company_name before lookup (some rows have U+FEFF prefix)
            $companyName = stripInvisible(trim($row['company_name'] ?? ''));
            $name = trim($row['name'] ?? '');
            $assignedEmail = trim($row['assigned_user_email'] ?? '');
            if ($companyName === '' || $name === '' || $assignedEmail === '') {
                $skipped++;
                continue;
            }
            $companyId = findCompanyIdByName($db, $companyName, $tenantId, true);
            $assignedTo = findUserIdByEmail($db, $assignedEmail);
            if (!$assignedTo) {
                $errors[] = ['row' => $index + 1, 'message' => 'ไม่พบผู้รับผิดชอบจากอีเมล'];
                continue;
            }

            // Parse expected_close_date early so it can be used for auto-created project dates
            $expectedClose = parseDate($row['expected_close_date'] ?? null);

            $projectName = trim($row['project_name'] ?? '');
            // Find existing project (by name+company, then name only)
            $projectId = $projectName !== '' ? findProjectByName($db, $projectName, $companyId, $tenantId) : null;

            // Auto-create project if not found, using close_date as the end_date (preserves historical year)
            if (!$projectId && $projectName !== '' && $companyId) {
                $projectId = generateUUID();
                // Use close_date as end_date; start_date = close_date - 90 days (reasonable estimate)
                $projEndDate = $expectedClose ?: date('Y-m-d');
                $projStartDate = date('Y-m-d', strtotime($projEndDate . ' -90 days'));
                $stmt = $db->prepare('INSERT INTO projects (id, tenant_id, user_id, company_id, customer_id, name, description, status, start_date, end_date, project_value, payment_status, payment_terms) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
                $stmt->execute([
                    $projectId, $tenantId,
                    $tokenData['user_id'],
                    $companyId,
                    null,
                    $projectName,
                    '',
                    'completed',
                    $projStartDate,
                    $projEndDate,
                    null,
                    'pending',
                    ''
                ]);
            }
            // If still no projectId, it will be NULL - which is allowed for opportunities
            $description = trim($row['description'] ?? '');
            $stage = trim($row['stage'] ?? 'lead');
            $value = $row['value'] ?? 0.00;
            $probability = $row['probability'] ?? 0;
            $leadSource = trim($row['lead_source'] ?? '');
            $notes = trim($row['notes'] ?? '');

            $stmt = $db->prepare('SELECT id FROM sales_opportunities WHERE name = ? AND company_id = ? AND tenant_id = ?');
            $stmt->execute([$name, $companyId, $tenantId]);
            $existing = $stmt->fetch();

            if ($existing) {
                $stmt = $db->prepare('UPDATE sales_opportunities SET project_id = ?, description = ?, stage = ?, value = ?, probability = ?, expected_close_date = ?, assigned_to = ?, lead_source = ?, notes = ? WHERE id = ?');
                $stmt->execute([$projectId, $description, $stage, $value, $probability, $expectedClose, $assignedTo, $leadSource, $notes, $existing['id']]);
                $updated++;
            } else {
                $id = generateUUID();
                $stmt = $db->prepare('INSERT INTO sales_opportunities (id, tenant_id, company_id, project_id, name, description, stage, value, probability, expected_close_date, assigned_to, lead_source, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
                $stmt->execute([$id, $tenantId, $companyId, $projectId, $name, $description, $stage, $value, $probability, $expectedClose, $assignedTo, $leadSource, $notes]);
                $inserted++;
            }
            continue;
        }

        $errors[] = ['row' => $index + 1, 'message' => 'ไม่รองรับประเภทนี้'];
    } catch (Exception $e) {
        $errors[] = ['row' => $index + 1, 'message' => $e->getMessage()];
    }
}

jsonResponse([
    'type' => $type,
    'inserted' => $inserted,
    'updated' => $updated,
    'skipped' => $skipped,
    'errors' => $errors,
]);
