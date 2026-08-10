-- Bug fix: task_type was a hardcoded ENUM, blocking any custom types added via admin settings.
-- Changing to VARCHAR(50) lets the application-layer catalog (work-type-catalog.php) be
-- the single source of truth for allowed values.
ALTER TABLE tasks
  MODIFY COLUMN task_type VARCHAR(50) NOT NULL DEFAULT 'task';

-- Fix 2 rows with empty task_type left over from before the column existed
UPDATE tasks SET task_type = 'task' WHERE task_type = '' OR task_type IS NULL;
