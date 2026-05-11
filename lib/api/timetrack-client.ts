/**
 * timetrack API Client Wrapper
 * Handles all communication with the timetrack API for authentication and user data
 */

const TIMETRACK_API_URL = process.env.TIMETRACK_API_URL || 'http://127.0.0.1:8000/api/v1';

/**
 * Login response from timetrack API
 */
export interface LoginResponse {
  success: boolean;
  data: {
    access_token: string;
    user: {
      id: number;
      email: string;
    };
  } | null;
  message?: string;
}

/**
 * User profile response from timetrack API
 */
export interface UserProfileResponse {
  data?: {
    id: number;
    email: string;
    profile?: {
      id: number;
      uuid: string;
      nik: string;
      full_name: string;
      name: string;
      nickname: string;
      position: string;
      dept_id: number;
      photo: string;
    };
  };
  message?: string;
}

/**
 * Department response from timetrack API
 */
export interface DepartmentResponse {
  data?: {
    id: number;
    department_name: string;
  };
  message?: string;
}

/**
 * Authenticate user via timetrack API
 *
 * POST /api/v1/login
 *
 * @param email - User email
 * @param password - User password
 * @returns Login response with access token and user data
 */
export async function login(email: string, password: string): Promise<LoginResponse> {
  try {
    console.log('[timetrack-client] Attempting login for:', email);

    const response = await fetch(`${TIMETRACK_API_URL}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.log('[timetrack-client] Login failed:', data.message || 'Invalid credentials');
      return {
        success: false,
        data: null,
        message: data.message || 'Invalid email or password',
      };
    }

    // Handle response format: { data: { access_token, user } }
    if (!data.data || !data.data.access_token || !data.data.user) {
      console.log('[timetrack-client] Invalid response format from login API');
      return {
        success: false,
        data: null,
        message: 'Invalid response from authentication server',
      };
    }

    console.log('[timetrack-client] Login successful for:', email);

    return {
      success: true,
      data: {
        access_token: data.data.access_token,
        user: data.data.user,
      },
    };
  } catch (error) {
    console.error('[timetrack-client] Login error:', error);
    return {
      success: false,
      data: null,
      message: error instanceof Error ? error.message : 'Network error during login',
    };
  }
}

/**
 * Fetch user with employee profile from timetrack API
 *
 * GET /api/v1/users/{id}?include=profile
 *
 * @param token - Access token from login
 * @param userId - User ID from login response
 * @returns User profile with employee data
 */
export async function getUserWithProfile(
  token: string,
  userId: number
): Promise<UserProfileResponse> {
  try {
    console.log('[timetrack-client] Fetching user profile for user ID:', userId);

    const response = await fetch(
      `${TIMETRACK_API_URL}/users/${userId}?include=profile`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.log('[timetrack-client] Failed to fetch user profile:', data.message);
      return { message: data.message || 'Failed to fetch user profile' };
    }

    console.log('[timetrack-client] User profile fetched successfully');
    return data;
  } catch (error) {
    console.error('[timetrack-client] Error fetching user profile:', error);
    return {
      message: error instanceof Error ? error.message : 'Network error fetching user profile',
    };
  }
}

/**
 * Fetch department data from timetrack API
 *
 * GET /api/v1/departments/{id}
 *
 * @param token - Access token from login
 * @param deptId - Department ID
 * @returns Department data with department_name
 */
export async function getDepartment(
  token: string,
  deptId: number
): Promise<DepartmentResponse> {
  try {
    console.log('[timetrack-client] Fetching department for ID:', deptId);

    const response = await fetch(
      `${TIMETRACK_API_URL}/departments/${deptId}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.log('[timetrack-client] Failed to fetch department:', data.message);
      return { message: data.message || 'Failed to fetch department' };
    }

    console.log('[timetrack-client] Department fetched:', data.data?.department_name);
    return data;
  } catch (error) {
    console.error('[timetrack-client] Error fetching department:', error);
    return {
      message: error instanceof Error ? error.message : 'Network error fetching department',
    };
  }
}
