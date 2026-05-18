import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { canAccessDashboard } from '@/lib/auth/access';
import type { AccessSession } from '@/lib/auth/access';

// Only protect these paths (API routes are generally public except for specific protected ones)
const PROTECTED_PATHS = ['/'];
const PUBLIC_PATHS = ['/login', '/api/auth'];

function parseSessionCookie(value: string | undefined): AccessSession | null {
  if (!value) return null;

  try {
    return JSON.parse(value) as AccessSession;
  } catch {
    return null;
  }
}

function isDashboardPath(pathname: string): boolean {
  return pathname === '/dashboard' || pathname.startsWith('/dashboard/');
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Debug logging
  console.log('[Middleware] Path:', pathname, 'Has session:', !!request.cookies.get('session'));

  // Skip middleware for API routes (except auth/me which needs session check)
  if (pathname.startsWith('/api/')) {
    // Allow all API routes except /api/auth/me
    if (pathname === '/api/auth/me') {
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
