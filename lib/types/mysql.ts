// MySQL REST API Types
// Based on API documentation from http://localhost/api/v1

// ============ ERROR TYPES ============

export type ErrorType = 'network' | 'timeout' | 'auth' | 'parse' | 'unknown';

export interface EnhancedApiError {
  message: string;
  type: ErrorType;
  originalError?: unknown;
}

// ============ API RESPONSE WRAPPER ============

export interface MySqlApiResponse<T> {
  status: number;
  success: boolean;
  message: string;
  data: T;
  meta?: MySqlPaginationMeta;
  error?: EnhancedApiError;
}

export interface MySqlPaginationMeta {
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
}

// ============ BRAND ENTITY ============

export interface MySqlBrand {
  uuid: string;
  company_name: string;
  client_code: string;
  brand_name: string;
  brand_address: string;
  pic_brand_name: string;
  pic_email: string;
  brand_website: string;
  pic_title: string;
  pic_brand_phone: string;
  pic_finance_name: string;
  pic_finance_phone: string;
  industry_category: string;
  description: string;
  logo: string;
  flag: 'active' | 'inactive';
  tax_account: string;
  top: string;
  created_at: string;
  updated_at: string;
}

// ============ CAMPAIGN ENTITY ============

export interface MySqlCampaign {
  uuid: string;
  io_number: string;
  campaign_name: string;
  brand_id: number;
  company_id: number;
  currency: string;
  budget: number;
  asf: number;
  grand_total: number;
  start_date: string;
  end_date: string;
  notes: string;
  io_file: string;
  state: 'draft' | 'publish' | 'archive';
  flag: 'active' | 'inactive';
  quotation_reference: string;
  created_at: string;
  updated_at: string;
  // Relations
  brand?: {
    uuid: string;
    brand_name: string;
    company_name: string;
  };
  company?: {
    id: number;
    company_name: string;
  };
  channels?: Array<{
    id: number;
    channel_name: string;
  }>;
}

// ============ PITCH ENTITY ============

export interface MySqlPitch {
  uuid: string;
  pitch_number: string;
  pitch_name: string;
  brand_id: number;
  region: 'ID' | 'SG' | null;
  date_submit: string | null;
  status: 'on_going' | 'win' | 'loss' | null;
  budget: number;
  value_total: number;
  currency: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Relations
  brand?: {
    uuid: string;
    brand_name: string;
    company_name: string;
  };
  author?: {
    uuid: string;
    full_name: string;
  };
  channels?: Array<{
    id: number;
    channel_id: number;
    deliverable_id: number;
    channel_class?: any;
    deliverable?: any;
  }>;
}

// ============ EMPLOYEE ENTITY ============

export interface MySqlEmployee {
  uuid: string;
  nik: string;
  full_name: string;
  nickname: string;
  position: string;
  dept_id: number;
  direct_supervisor: number;
  gender: 'MALE' | 'FEMALE';
  group_timeoff_category: number;
  work_start_date: string;
  dob: string;
  photo: string;
  flag: 'active' | 'inactive';
  status: 'visible' | 'invisible';
  created_at: string;
  updated_at: string;
  // Relations
  department?: {
    id: number;
    nik: string;
    department_name: string;
  };
  supervisor?: {
    uuid: string;
    full_name: string;
    position: string;
  };
  balance?: {
    annual_leave: number;
    sick_leave: number;
    total_balance: number;
  };
}

// ============ QUERY PARAMETERS ============

export interface MySqlQueryParams {
  page?: number;
  per_page?: number;
  search?: string;
  include?: string;
  brand_id?: string;
}

// ============ ERROR TYPES ============

export class MySqlApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'MySqlApiError';
  }
}

export class MySqlAuthError extends MySqlApiError {
  constructor(message: string = 'MySQL API authentication failed') {
    super(message, 401);
    this.name = 'MySqlAuthError';
  }
}
