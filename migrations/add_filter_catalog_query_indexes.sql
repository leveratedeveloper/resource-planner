-- Migration: Add filter catalog query indexes
-- Purpose: speed searchable brand/project filter reads used by the planner filter pickers.

CREATE INDEX IF NOT EXISTS idx_planner_brands_filter_search
  ON planner_brands (archived_at, name, company_name);

CREATE INDEX IF NOT EXISTS idx_planner_projects_filter_search
  ON planner_projects (archived_at, brand_id, status, source_type, name);
