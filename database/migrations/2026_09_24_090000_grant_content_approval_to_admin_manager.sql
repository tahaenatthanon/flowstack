-- Grant content approval permission to the default admin/manager roles
-- for all existing tenants. Safe to run more than once.
INSERT INTO role_menu_permissions (role_id, menu_key)
SELECT r.id, 'content_approval'
FROM roles r
WHERE r.name IN ('admin', 'manager')
  AND NOT EXISTS (
    SELECT 1
    FROM role_menu_permissions p
    WHERE p.role_id = r.id
      AND p.menu_key = 'content_approval'
  );
