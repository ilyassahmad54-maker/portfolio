import { NextRequest } from 'next/server';
import { sessionValid, reply } from '@/lib/admin';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  try { return await sessionValid(request) ? reply({ authenticated: true }) : reply({ authenticated: false }, 401); }
  catch { return reply({ authenticated: false }, 503); }
}
