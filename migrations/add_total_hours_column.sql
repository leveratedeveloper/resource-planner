-- Migration: Add total_hours column to assignments table
-- Date: 2025-04-09
-- Description: Add total_hours column to track total hours for monthly allocation feature

-- Add total_hours column to assignments table
ALTER TABLE assignments
ADD COLUMN total_hours DECIMAL(10, 2) DEFAULT NULL
COMMENT 'Total hours for monthly allocation (calculated as hours_per_day * number_of_days)';

-- Add total_hours column to actual table
ALTER TABLE actual
ADD COLUMN total_hours DECIMAL(10, 2) DEFAULT NULL
COMMENT 'Total hours for monthly allocation (calculated as hours_per_day * number_of_days)';

-- Update existing records to calculate total_hours
UPDATE assignments
SET total_hours = (
  CAST(hours_per_day AS DECIMAL(10,2)) *
  DATEDIFF(end_date, start_date) + 1
)
WHERE total_hours IS NULL;

UPDATE actual
SET total_hours = (
  CAST(hours_per_day AS DECIMAL(10,2)) *
  DATEDIFF(end_date, start_date) + 1
)
WHERE total_hours IS NULL;
