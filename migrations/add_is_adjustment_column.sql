-- Migration: Add is_adjustment column to assignments table
-- Date: 2026-04-16
-- Description: Add is_adjustment column for adjustment hours feature

-- Add is_adjustment column to assignments table
ALTER TABLE assignments ADD COLUMN is_adjustment BOOLEAN DEFAULT FALSE;

-- Create index for is_adjustment
CREATE INDEX IF NOT EXISTS idx_assignments_adjustment ON assignments(is_adjustment);
