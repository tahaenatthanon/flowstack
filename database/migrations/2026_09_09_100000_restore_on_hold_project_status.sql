-- Restore 'on-hold' to projects.status enum.
--
-- Root cause: 2026_06_16_054627_add_on_hold_cancelled_to_projects_status.sql added
-- both 'on-hold' and 'cancelled'. Ten days later, 2026_06_26_051748_add_cancelled_to_projects_status.sql
-- re-issued a MODIFY COLUMN for the same enum but its literal value list omitted
-- 'on-hold', silently dropping it even though 'cancelled' was already present.
-- The frontend (src/types/project.ts, TaskIntelligencePage.tsx, AllTasksTab.tsx,
-- ProjectReportSheet.tsx) never stopped treating 'on-hold' as a valid ProjectStatus.
--
-- Discovered during the 2026-09-09 DB-recovery migration audit: no migration file
-- ever removes 'on-hold' on purpose, so this restores the enum to include both
-- values the two migrations were each trying to add.

ALTER TABLE `projects`
  MODIFY COLUMN `status` ENUM('on-track','at-risk','delayed','completed','on-hold','cancelled')
  NOT NULL DEFAULT 'on-track' COMMENT 'Project status';
