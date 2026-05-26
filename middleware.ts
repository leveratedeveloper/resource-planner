import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { canAccessDashboard } from '@/lib/auth/access';
import type { AccessSession } from '@/lib/auth/access';

const PROTECTED_PATHS = ['/'];
const PUBLIC_PATHS = ['/login'];

// API routes that do NOT require authentication
const PUBLIC_API_PREFIXES = ['/api/auth/login', '/api/auth/logout'];

// Parse session from signed cookie format: { payload: "...", signature: "..." }
function parseSessionCookie(value: string | undefined): AccessSession | null {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value);
    // Signed cookie format (new)
    if (parsed?.payload) {
      return JSON.parse(parsed.payload) as AccessSession;
    }
    // Legacy format fallback
    return parsed as AccessSession;
  } catch {
    return null;
  }
}

function isDashboardPath(pathname: string): boolean {
  return pathname === '/dashboard' || pathname.startsWith('/dashboard/');
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // API route protection: require session cookie for all /api/ routes
  // except whitelisted public endpoints (login, logout)
  if (pathname.startsWith('/api/')) {
    const isPublicApi = PUBLIC_API_PREFIXES.some(prefix => pathname.startsWith(prefix));
    if (!isPublicApi) {
      const sessionCookie = request.cookies.get('session');
      if (!sessionCookie) {
        return NextResponse.json(
          { error: 'Not authenticated' },
          { status: 401 }
        );
      }
    }
    return NextResponse.next();
  }

  // Allow public paths
  if (PUBLIC_PATHS.some(path => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Allow static files and Next.js internals
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname.includes('.') // favicon, images, etc.
  ) {
    return NextResponse.next();
  }

  // Check for session cookie for protected paths
  const sessionCookie = request.cookies.get('session');

  if (isDashboardPath(pathname)) {
    if (!sessionCookie) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    const session = parseSessionCookie(sessionCookie.value);

    if (!canAccessDashboard(session)) {
      return NextResponse.redirect(new URL('/', request.url));
    }

    return NextResponse.next();
  }

  if (!sessionCookie && PROTECTED_PATHS.some(path => pathname.startsWith(path))) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api/health|_next/static|_next/image|favicon.ico).*)'],
};
