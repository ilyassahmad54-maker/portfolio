import { NextRequest } from 'next/server';
import { sessionValid, reply, reportAdminFailure } from '@/lib/admin';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  try { return await sessionValid(request) ? reply({ authenticated: true }) : reply({ authenticated: false }, 401); }
  catch (error) {
    reportAdminFailure(error, 'session', 'session_lookup');
    return reply({ authenticated: false }, 503);
  }
}
