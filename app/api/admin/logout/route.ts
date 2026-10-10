import { NextRequest } from 'next/server';
import { sameOrigin, revoke, reply, cookieName, cookieOptions, reportAdminFailure } from '@/lib/admin';
export const runtime = 'nodejs';
export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return reply({ error: 'Forbidden' }, 403);
  let stage: Parameters<typeof reportAdminFailure>[2] = 'session_revoke';
  try {
    await revoke(request);
    const response = reply({ authenticated: false });
    stage = 'cookie';
    response.cookies.set(cookieName, '', { ...cookieOptions, maxAge: 0 }); return response;
  } catch (error) {
    reportAdminFailure(error, 'logout', stage);
    return reply({ error: 'Logout unavailable' }, 503);
  }
}
