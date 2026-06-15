-- Migration: Add timeline query indexes
-- Purpose: speed date-overlap planner reads used by Timeline V2 and home bootstrap.

CREATE INDEX IF NOT EXISTS idx_assignments_timeline_overlap
  ON assignments (employee_uuid, end_date, start_date, status, category);

CREATE INDEX IF NOT EXISTS idx_assignments_project_timeline_overlap
  ON assignments (project_uuid, end_date, start_date)
  WHERE project_uuid IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_actual_timeline_overlap
  ON actual (employee_uuid, end_date, start_date, status, category);

CREATE INDEX IF NOT EXISTS idx_actual_project_timeline_overlap
  ON actual (project_uuid, end_date, start_date)
  WHERE project_uuid IS NOT NULL;
