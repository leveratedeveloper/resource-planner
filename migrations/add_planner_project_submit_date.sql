-- Migration: Add submit_date column to planner_projects table
-- Date: 2026-06-08
-- Description: Preserve Timetrack pitch date_submit in the local planner directory

ALTER TABLE planner_projects
ADD COLUMN submit_date DATE DEFAULT NULL
COMMENT 'Pitch submission date from Timetrack date_submit';
