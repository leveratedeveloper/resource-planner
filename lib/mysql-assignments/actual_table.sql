-- MySQL Actual Hours Database Schema
-- Run this SQL to create the actual table in resource_planner_assignments database

USE resource_planner_assignments;

-- Buat tabel actual untuk tracking jam kerja aktual
CREATE TABLE IF NOT EXISTS actual (
  uuid VARCHAR(36) PRIMARY KEY,
  employee_uuid VARCHAR(36) NOT NULL,
  project_uuid VARCHAR(36),
  assignment_uuid VARCHAR(36),
  work_date DATE NOT NULL,
  hours DECIMAL(5,2) NOT NULL,
  billable BOOLEAN DEFAULT TRUE,
  task_description TEXT,
  task_uuid VARCHAR(36),
  notes TEXT,
  created_by_uuid VARCHAR(36),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_employee (employee_uuid),
  INDEX idx_project (project_uuid),
  INDEX idx_assignment (assignment_uuid),
  INDEX idx_work_date (work_date),
  INDEX idx_employee_date (employee_uuid, work_date),
  INDEX idx_project_date (project_uuid, work_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Sample data (optional)
-- INSERT INTO actual (uuid, employee_uuid, project_uuid, work_date, hours, billable, task_description)
-- VALUES
--   (UUID(), 'sample-employee-uuid', 'sample-project-uuid', '2025-01-01', 8.00, TRUE, 'Development work');
