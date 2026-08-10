-- Add 'cancelled' to projects.status enum so Project Managers can cancel a project,
-- which feeds the PM Goal Score (Impact OS axis B). See
-- docs/superpowers/specs/2026-06-26-pm-goal-score-design.md
ALTER TABLE projects
  MODIFY COLUMN status ENUM('on-track','at-risk','delayed','completed','cancelled')
  NOT NULL DEFAULT 'on-track';
