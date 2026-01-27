/**
 * Timetrack API Type Definitions
 *
 * These types define the data structures for entities retrieved from the Timetrack system.
 * Timetrack is the source of truth for master data (employees, brands, business units, departments).
 */

// ============ ENUMS ============

export type SyncStatus = 'local' | 'synced' | 'pending' | 'conflict';
export type SourceSystem = 'timetrack' | 'resource_planner';
export type EmploymentStatus = 'active' | 'inactive' | 'contractor';
export type BrandStatus = 'active' | 'inactive' | 'prospect';

// ============ API RESPONSE WRAPPERS ============

export interface TimetrackApiResponse<T> {
  data: T;
  meta?: {
    total: number;
    page: number;
    limit: number;
    links?: {
      first: string | null;
      last: string | null;
      next: string | null;
      prev: string | null;
    };
  };
  errors?: TimetrackApiError[];
}

export interface TimetrackApiError {
  code: string;
  message: string;
  field?: string;
}

export interface TimetrackPaginationParams {
  page?: number;
  limit?: number;
}

// ============ MASTER DATA ENTITIES ============

/**
 * Employee entity from Timetrack
 * Represents a team member with their organizational details
 */
export interface TimetrackEmployee {
  id: number;
  name: string;
  email: string;
  position: string;
  employee_number?: string;
  nickname?: string;
  photo_url?: string;
  department_id: number;
  department?: TimetrackDepartment;
  business_unit_id: number;
  business_unit?: TimetrackBusinessUnit;
  direct_supervisor_id?: number;
  supervisor?: TimetrackEmployee;
  employment_status: EmploymentStatus;
  weekly_capacity_hours: number;
  work_start_date?: string; // ISO date string
  date_of_birth?: string; // ISO date string
  created_at: string; // ISO 8601 timestamp
  updated_at: string; // ISO 8601 timestamp
}

/**
 * Brand (Client) entity from Timetrack
 * Represents a client or brand that projects are associated with
 */
export interface TimetrackBrand {
  id: number;
  name: string;
  company_name?: string;
  client_code?: string;
  business_unit_id: number;
  business_unit?: TimetrackBusinessUnit;
  brand_address?: string;
  color?: string;
  logo?: string;
  website?: string;
  contact_name?: string;
  contact_title?: string;
  contact_email?: string;
  contact_phone?: string;
  pic_finance_name?: string;
  pic_finance_phone?: string;
  industry_category?: string;
  description?: string;
  status: BrandStatus;
  created_at: string;
  updated_at: string;
}

/**
 * Business Unit entity from Timetrack
 * Represents a company entity or division
 */
export interface TimetrackBusinessUnit {
  id: number;
  name: string;
  code: string;
  color?: string;
  logo?: string;
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Department entity from Timetrack
 * Represents a department within a business unit
 */
export interface TimetrackDepartment {
  id: number;
  name: string;
  code: string;
  business_unit_id: number;
  business_unit?: TimetrackBusinessUnit;
  color?: string;
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ============ PROJECT SYNC ENTITIES ============

/**
 * Campaign entity from Timetrack (execution phase)
 * Linked to Resource Planner projects via rp_project_id
 */
export interface TimetrackCampaign {
  id: number;
  rp_project_id?: string; // Resource Planner project UUID
  project_number?: string;
  name: string;
  brand_id: number;
  brand?: TimetrackBrand;
  business_unit_id: number;
  business_unit?: TimetrackBusinessUnit;
  start_date?: string; // ISO date string
  end_date?: string; // ISO date string
  budget?: number;
  currency: string;
  status: 'active' | 'on_hold' | 'completed' | 'cancelled';
  description?: string;
  sync_status: SyncStatus;
  last_synced_at?: string;
  source_system: SourceSystem;
  created_at: string;
  updated_at: string;
}

/**
 * Pitch entity from Timetrack (planning phase)
 * Can be converted to Campaign when won
 */
export interface TimetrackPitch {
  id: number;
  rp_project_id?: string;
  name: string;
  brand_id: number;
  brand?: TimetrackBrand;
  business_unit_id: number;
  business_unit?: TimetrackBusinessUnit;
  region?: string;
  submit_date?: string;
  pitch_status: 'introduction' | 'waiting_for_brief' | 'proposal_development' |
                'submit_or_presentation' | 'waiting_for_feedback' | 'negotiation' |
                'won' | 'lost' | 'cancelled' | 'missing' | 'withdraw';
  value_total_estimate?: number;
  currency: string;
  description?: string;
  sync_status: SyncStatus;
  last_synced_at?: string;
  source_system: SourceSystem;
  created_at: string;
  updated_at: string;
}

// ============ ACTUAL HOURS ENTITIES ============

/**
 * Timesheet entry from Timetrack
 * Represents actual hours logged by an employee for a project/task
 */
export interface TimetrackTimesheet {
  id: number;
  employee_id: number;
  employee?: TimetrackEmployee;
  project_id: number;
  task_id?: number;
  task?: TimetrackTask;
  date: string; // ISO date string
  hours: number;
  billable: boolean;
  description?: string;
  approved: boolean;
  approved_by_id?: number;
  created_at: string;
  updated_at: string;
}

/**
 * Aggregated timesheet summary
 * Used for variance analysis (planned vs actual)
 */
export interface TimetrackTimesheetSummary {
  employee_id: number;
  employee_name?: string;
  project_id: number;
  project_name?: string;
  total_hours: number;
  billable_hours: number;
  non_billable_hours: number;
  period_start: string; // ISO date string
  period_end: string; // ISO date string
}

/**
 * Task entity from Timetrack
 * Represents a specific task within a project that time is logged against
 */
export interface TimetrackTask {
  id: number;
  project_id: number;
  name: string;
  description?: string;
  status: 'not_started' | 'in_progress' | 'completed' | 'on_hold';
  assigned_to_id?: number;
  assigned_to?: TimetrackEmployee;
  estimated_hours?: number;
  actual_hours?: number;
  start_date?: string;
  due_date?: string;
  created_at: string;
  updated_at: string;
}

// ============ QUERY PARAMETERS ============

export interface TimetrackEmployeeQueryParams extends TimetrackPaginationParams {
  business_unit_id?: number;
  department_id?: number;
  employment_status?: EmploymentStatus;
  include?: string; // Comma-separated: 'department,business_unit,supervisor'
}

export interface TimetrackBrandQueryParams extends TimetrackPaginationParams {
  business_unit_id?: number;
  status?: BrandStatus;
  include?: string; // 'business_unit'
}

export interface TimetrackDepartmentQueryParams extends TimetrackPaginationParams {
  business_unit_id?: number;
  include?: string; // 'business_unit'
}

export interface TimetrackCampaignQueryParams extends TimetrackPaginationParams {
  brand_id?: number;
  business_unit_id?: number;
  status?: string;
  rp_project_id?: string;
  include?: string; // 'brand,business_unit'
}

export interface TimetrackTimesheetQueryParams extends TimetrackPaginationParams {
  employee_id?: number;
  project_id?: number;
  date_from?: string; // ISO date string
  date_to?: string; // ISO date string
  updated_since?: string; // ISO timestamp for incremental sync
  include?: string; // 'employee,task'
}

export interface TimetrackTimesheetSummaryQueryParams {
  employee_id?: number;
  project_id?: number;
  date_from: string; // Required for summary
  date_to: string; // Required for summary
  group_by: 'employee' | 'project' | 'employee,project';
}

// ============ SYNC AUDIT ============

/**
 * Sync audit log entry
 * Tracks all synchronization operations between systems
 */
export interface SyncAuditLog {
  id: string;
  entity_type: 'employee' | 'brand' | 'business_unit' | 'department' | 'project' | 'timesheet';
  entity_id: string;
  operation: 'create' | 'update' | 'delete' | 'sync';
  source_system: SourceSystem;
  target_system: SourceSystem;
  status: 'pending' | 'success' | 'failed' | 'conflict';
  error_message?: string;
  payload?: Record<string, any>;
  created_at: string;
}

// ============ WEBHOOK PAYLOADS ============

/**
 * Webhook payload from Timetrack for project updates
 */
export interface TimetrackProjectWebhook {
  event: 'project.created' | 'project.updated' | 'project.deleted';
  timestamp: string;
  data: {
    id: number;
    rp_project_id?: string;
    entity_type: 'campaign' | 'pitch';
    changes?: Record<string, { old: any; new: any }>;
  };
  signature: string; // HMAC-SHA256 signature for verification
}

// ============ ERROR TYPES ============

export class TimetrackApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public errors?: TimetrackApiError[],
    public requestId?: string
  ) {
    super(message);
    this.name = 'TimetrackApiError';
  }
}

export class TimetrackAuthError extends TimetrackApiError {
  constructor(message: string = 'Authentication failed') {
    super(message, 401);
    this.name = 'TimetrackAuthError';
  }
}

export class TimetrackRateLimitError extends TimetrackApiError {
  constructor(
    message: string = 'Rate limit exceeded',
    public retryAfter?: number
  ) {
    super(message, 429);
    this.name = 'TimetrackRateLimitError';
  }
}

export class TimetrackNotFoundError extends TimetrackApiError {
  constructor(message: string = 'Resource not found') {
    super(message, 404);
    this.name = 'TimetrackNotFoundError';
  }
}

export class TimetrackConflictError extends TimetrackApiError {
  constructor(
    message: string = 'Sync conflict detected',
    public conflictData?: {
      local: any;
      remote: any;
      timestamp_local: string;
      timestamp_remote: string;
    }
  ) {
    super(message, 409);
    this.name = 'TimetrackConflictError';
  }
}
