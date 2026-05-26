import { cookies } from 'next/headers';
import { createHmac, timingSafeEqual } from 'crypto';

const SESSION_SECRET = process.env.SESSION_SECRET || 'change-me-in-production-env-var';
const HMAC_ALGO = 'sha256';

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
    level: 'admin' | 'full' | 'restricted';
    can_view_all: boolean;
    can_view_own_only: boolean;
  };
}

interface SignedSession {
  payload: string;
  signature: string;
}

function signPayload(payload: string): string {
  return createHmac(HMAC_ALGO, SESSION_SECRET).update(payload).digest('hex');
}

function verifySignature(payload: string, signature: string): boolean {
  const expected = signPayload(payload);
  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

/**
 * Get the current session from cookies (with signature verification)
 *
 * @returns Session data or null if not authenticated or tampered
 */
export async function getSession(): Promise<SessionData | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('session');

  if (!sessionCookie) {
    return null;
  }

  try {
    const signed = JSON.parse(sessionCookie.value) as SignedSession;
    if (!signed.payload || !signed.signature) return null;

    if (!verifySignature(signed.payload, signed.signature)) {
      return null;
    }

    return JSON.parse(signed.payload) as SessionData;
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
 * Create a signed session cookie
 *
 * @param sessionData - The session data to store
 */
export async function createSession(sessionData: SessionData): Promise<void> {
  const cookieStore = await cookies();
  const payload = JSON.stringify(sessionData);
  const signature = signPayload(payload);

  cookieStore.set('session', JSON.stringify({ payload, signature }), {
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
