import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  // Skip auth when Google OAuth credentials aren't configured (local dev)
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.AUTH_SECRET) {
    return NextResponse.next();
  }

  // Dynamic import to avoid crash when auth env vars are missing
  const { auth } = await import('./auth');
  const session = await auth();

  if (!session) {
    const signInUrl = new URL('/api/auth/signin', request.url);
    signInUrl.searchParams.set('callbackUrl', request.url);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api/auth|_next/static|_next/image|favicon.ico|auth/).*)',
  ],
};
