-- MySQL Assignments Database Schema
-- Run this SQL to create the separate assignments database

-- Buat database baru
CREATE DATABASE IF NOT EXISTS resource_planner_assignments;

USE resource_planner_assignments;

-- Buat tabel assignments
CREATE TABLE IF NOT EXISTS assignments (
  uuid VARCHAR(36) PRIMARY KEY,
  employee_uuid VARCHAR(36) NOT NULL,
  project_uuid VARCHAR(36),
  task_uuid VARCHAR(36),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  hours_per_day DECIMAL(4,2) DEFAULT 8.00,
  allocation_percentage DECIMAL(5,2),
  is_time_off BOOLEAN DEFAULT FALSE,
  time_off_type_uuid VARCHAR(36),
  category VARCHAR(100),
  is_billable BOOLEAN DEFAULT TRUE,
  status VARCHAR(20) DEFAULT 'confirmed',
  note TEXT,
  created_by_uuid VARCHAR(36),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_employee (employee_uuid),
  INDEX idx_project (project_uuid),
  INDEX idx_dates (start_date, end_date),
  INDEX idx_status (status),
  INDEX idx_employee_dates (employee_uuid, start_date, end_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Sample data (optional)
-- INSERT INTO assignments (uuid, employee_uuid, project_uuid, start_date, end_date, hours_per_day, category, is_billable, status)
-- VALUES
--   (UUID(), 'sample-employee-uuid', 'sample-project-uuid', '2025-01-01', '2025-01-05', 8.00, 'Development', TRUE, 'confirmed');
