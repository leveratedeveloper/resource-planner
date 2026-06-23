-- planner_assignments: one engagement per (employee, project).
-- Column types mirror the existing planner_* tables: the "uuid" columns are
-- varchar in this database, not native uuid (planner_employees.employee_uuid is
-- varchar(64), planner_projects.project_key is varchar(96)), so FKs must match.
CREATE TABLE IF NOT EXISTS planner_assignments (
  assignment_uuid varchar(64) PRIMARY KEY,
  employee_uuid   varchar(64) NOT NULL REFERENCES planner_employees(employee_uuid),
  project_key     varchar(96) NOT NULL REFERENCES planner_projects(project_key),
  start_date      date NOT NULL,
  end_date        date NOT NULL,
  status          varchar(20) NOT NULL DEFAULT 'draft',
  note            text,
  created_by      varchar(64) REFERENCES planner_employees(employee_uuid),
  updated_by      varchar(64) REFERENCES planner_employees(employee_uuid),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_uuid, project_key)
);
CREATE INDEX IF NOT EXISTS idx_planner_assignments_employee ON planner_assignments(employee_uuid);
CREATE INDEX IF NOT EXISTS idx_planner_assignments_project  ON planner_assignments(project_key);

-- planner_assignment_allocations: monthly planned hours (the planning grain).
CREATE TABLE IF NOT EXISTS planner_assignment_allocations (
  assignment_uuid varchar(64) NOT NULL REFERENCES planner_assignments(assignment_uuid) ON DELETE CASCADE,
  month           date NOT NULL,                 -- always the 1st of the month
  planned_hours   numeric(10,2) NOT NULL,
  kind            varchar(12) NOT NULL DEFAULT 'plan',  -- plan | adjustment
  PRIMARY KEY (assignment_uuid, month, kind)
);
CREATE INDEX IF NOT EXISTS idx_alloc_month ON planner_assignment_allocations(month);

-- Billability is a project attribute; leave empty for now.
ALTER TABLE planner_projects ADD COLUMN IF NOT EXISTS is_billable boolean;
