/**
 * Shared constants used across the application.
 * Centralizes magic numbers for easier maintenance.
 */

/** Number of working days in a week (Mon-Fri) */
export const WORK_DAYS_PER_WEEK = 5;

/** Default page size for paginated API queries */
export const DEFAULT_PAGE_SIZE = 10;

/** Batch size for database insert operations */
export const DB_BATCH_SIZE = 100;

/** Debounce delay for search inputs (ms) */
export const SEARCH_DEBOUNCE_MS = 300;
