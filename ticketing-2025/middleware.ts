// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const user = process.env.ADMIN_USER || 'admin';
  const pass = process.env.ADMIN_PASS || 'password';

  // Paths to protect
  const protectedPaths = [/^\/admin(\/.*)?$/, /^\/api\/admin(\/.*)?$/];
  const isProtected = protectedPaths.some((re) => re.test(req.nextUrl.pathname));
  if (!isProtected) return NextResponse.next();

  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Basic ')) {
    return new NextResponse('Auth required', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="Admin"' },
    });
  }

  const [u, p] = Buffer.from(auth.split(' ')[1], 'base64').toString().split(':');
  if (u !== user || p !== pass) {
    return new NextResponse('Unauthorized', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="Admin"' },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
};
