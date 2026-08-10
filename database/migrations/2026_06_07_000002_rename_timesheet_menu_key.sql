-- Rename menuKey 'timesheet' -> 'task_hours' in role_menu_permissions
UPDATE role_menu_permissions SET menu_key = 'task_hours' WHERE menu_key = 'timesheet';
