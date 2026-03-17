import { cookies } from 'next/headers';

/**
 * Session data structure
 */
export interface SessionData {
  access_token: string;
  user: {
    id: number;
    email: string;
  };
  employee: {
    id: number;
    uuid: string;
    nik: string;
    full_name: string;
    nickname: string;
    position: string;
    dept_id: number;
    department_name: string;
    photo: string;
  };
  access: {
    level: 'full' | 'restricted';
    can_view_all: boolean;
    can_view_own_only: boolean;
  };
}

/**
 * Get the current session from cookies
 *
 * @returns Session data or null if not authenticated
 */
export async function getSession(): Promise<SessionData | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('session');

  if (!sessionCookie) {
    return null;
  }

  try {
    return JSON.parse(sessionCookie.value) as SessionData;
  } catch {
    return null;
  }
}

/**
 * Destroy the current session
 */
export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete('session');
}

/**
 * Create a session cookie
 *
 * @param sessionData - The session data to store
 */
export async function createSession(sessionData: SessionData): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set('session', JSON.stringify(sessionData), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/'
  });
}

/**
 * Check if user is authenticated
 *
 * @returns true if user has a valid session
 */
export async function isAuthenticated(): Promise<boolean> {
  const session = await getSession();
  return session !== null;
}

/**
 * Get the current employee ID from session
 *
 * @returns Employee ID or null if not authenticated
 */
export async function getCurrentEmployeeId(): Promise<number | null> {
  const session = await getSession();
  return session?.employee?.id || null;
}
