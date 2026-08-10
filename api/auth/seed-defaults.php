<?php
function seedTenantDefaults(PDO $db, string $tenantId, string $companyName): void {
    // 1. company_settings
    $existing = $db->prepare('SELECT id FROM company_settings WHERE tenant_id = ? LIMIT 1');
    $existing->execute([$tenantId]);
    if (!$existing->fetch()) {
        $taskCatalog = json_encode([
            ['key'=>'task','label'=>'งานปกติ','color'=>'#10b981','active'=>1,'system'=>1],
            ['key'=>'meeting','label'=>'ประชุม','color'=>'#3b82f6','active'=>1,'system'=>1],
            ['key'=>'leave','label'=>'ลาหยุด','color'=>'#f59e0b','active'=>1,'system'=>1],
            ['key'=>'onsite','label'=>'งานลูกค้า (Onsite)','color'=>'#06b6d4','active'=>1,'system'=>0],
            ['key'=>'ot','label'=>'งานล่วงเวลา (OT)','color'=>'#f97316','active'=>1,'system'=>0],
            ['key'=>'weekend_work','label'=>'งานวันหยุด','color'=>'#14b8a6','active'=>1,'system'=>0],
            ['key'=>'research','label'=>'วิจัย','color'=>'#8b5cf6','active'=>1,'system'=>0],
            ['key'=>'interrupt','label'=>'งานแทรก','color'=>'#f43f5e','active'=>1,'system'=>0],
        ]);
        $calCatalog = json_encode([
            ['key'=>'holiday','label'=>'วันหยุดบริษัท','color'=>'#ef4444','active'=>1,'system'=>1],
            ['key'=>'other','label'=>'อื่นๆ','color'=>'#8b5cf6','active'=>1,'system'=>1],
        ]);
        $db->prepare("
            INSERT INTO company_settings
              (tenant_id, company_name, max_task_hours, task_type_catalog, calendar_event_type_catalog)
            VALUES (?, ?, 16, ?, ?)
        ")->execute([$tenantId, $companyName, $taskCatalog, $calCatalog]);
    }

    // 2. work_schedule (Mon-Fri 8h)
    $wsExist = $db->prepare('SELECT id FROM work_schedules WHERE tenant_id = ? LIMIT 1');
    $wsExist->execute([$tenantId]);
    if (!$wsExist->fetch()) {
        $wsId = generateUUID();
        $db->prepare("INSERT INTO work_schedules (id, tenant_id, name, is_default) VALUES (?, ?, 'ตารางงานมาตรฐาน (จ-ศ)', 1)")
           ->execute([$wsId, $tenantId]);
        $dayStmt = $db->prepare('INSERT INTO work_schedule_days (id, schedule_id, day_of_week, is_working, work_hours) VALUES (?,?,?,?,?)');
        foreach ([
            [1,1,8.00],[2,1,8.00],[3,1,8.00],[4,1,8.00],[5,1,8.00],[6,0,0.00],[7,0,0.00]
        ] as [$dow, $isWork, $hrs]) {
            $dayStmt->execute([generateUUID(), $wsId, $dow, $isWork, $hrs]);
        }
    }

    // 3. roles
    $rolesExist = $db->prepare('SELECT COUNT(*) FROM roles WHERE tenant_id = ?');
    $rolesExist->execute([$tenantId]);
    if ((int)$rolesExist->fetchColumn() === 0) {
        $allMenuKeys = [
            'home','projects','sales','quotations','companies','revenue','resources',
            'task_hours','reports','analytics','marketing','goals','automation',
            'budget','support','admin','inbox','calendar','workflow','task_intelligence'
        ];
        $roleStmt = $db->prepare('INSERT INTO roles (tenant_id, name, label) VALUES (?,?,?)');
        $permStmt = $db->prepare('INSERT INTO role_menu_permissions (role_id, menu_key) VALUES (?,?)');

        $roleStmt->execute([$tenantId, 'admin', 'ผู้ดูแลระบบ']);
        $adminRoleId = $db->lastInsertId();
        foreach ($allMenuKeys as $key) $permStmt->execute([$adminRoleId, $key]);

        $roleStmt->execute([$tenantId, 'manager', 'ผู้จัดการ']);
        $managerRoleId = $db->lastInsertId();
        foreach (array_diff($allMenuKeys, ['admin']) as $key) $permStmt->execute([$managerRoleId, $key]);

        $roleStmt->execute([$tenantId, 'staff', 'สมาชิกทีม']);
        $staffRoleId = $db->lastInsertId();
        foreach (['home','projects','sales','task_hours','support','inbox','calendar'] as $key) {
            $permStmt->execute([$staffRoleId, $key]);
        }
    }

    // 4. task_validation_rules
    $vrExist = $db->prepare('SELECT COUNT(*) FROM task_validation_rules WHERE tenant_id = ?');
    $vrExist->execute([$tenantId]);
    if ((int)$vrExist->fetchColumn() === 0) {
        $vrStmt = $db->prepare('
            INSERT INTO task_validation_rules
              (id, tenant_id, rule_type, condition_field, condition_operator, condition_value, message_th, is_active)
            VALUES (UUID(),?,?,?,?,?,?,1)
        ');
        foreach ([
            ['warn',  'title_duplicate',  'duplicate', null,  'พบ task ที่อาจซ้ำกัน กรุณาตรวจสอบ'],
            ['block', 'actual_hours',     'gt',        '40',  'ไม่สามารถบันทึกชั่วโมงเกิน 40 ชั่วโมงต่อ task'],
            ['block', 'daily_hours_sum',  'gt',        '24',  'ชั่วโมงรวมของวันนี้เกิน 24 ชั่วโมง'],
            ['warn',  'assignee_user_id', 'null',      null,  'task ยังไม่มีผู้รับผิดชอบ'],
            ['warn',  'estimated_hours',  'null',      null,  'task ยังไม่มีชั่วโมงประมาณ'],
            ['block', 'end_before_start', 'invalid',   null,  'วันสิ้นสุดต้องไม่น้อยกว่าวันเริ่มต้น'],
            ['warn',  'estimated_hours',  'gt',  'max_task_hours', 'ชั่วโมงประมาณเกินกำหนด แนะนำให้แตกเป็นงานย่อย'],
        ] as [$type, $field, $op, $val, $msg]) {
            $vrStmt->execute([$tenantId, $type, $field, $op, $val, $msg]);
        }
    }
}
