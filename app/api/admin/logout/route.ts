import { NextRequest } from 'next/server';
import { sameOrigin, revoke, reply, cookieName, cookieOptions } from '@/lib/admin';
export const runtime = 'nodejs';
export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return reply({ error: 'Forbidden' }, 403);
  try {
    await revoke(request);
    const response = reply({ authenticated: false });
    response.cookies.set(cookieName, '', { ...cookieOptions, maxAge: 0 }); return response;
  } catch { return reply({ error: 'Logout unavailable' }, 503); }
}
