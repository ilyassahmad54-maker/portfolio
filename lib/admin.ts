import 'server-only';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

export const cookieName = process.env.NODE_ENV === 'production' ? '__Host-admin-session' : 'admin-session';
const lifetime = 3600;
export const cookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict' as const, path: '/', maxAge: lifetime };
export function config() {
  const passcode = process.env.ADMIN_PASSCODE;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!passcode || passcode.length < 20 || !url?.startsWith('https://') || !token) throw new Error('Admin configuration unavailable');
  return { passcode, url, token };
}
export async function redis(command: (string | number)[]) {
  const { url, token } = config();
  const response = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(command), cache: 'no-store', signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error('Session store unavailable');
  const body = await response.json();
  if (body.error) throw new Error('Session store unavailable');
  return body.result;
}
function digest(value: string) { return createHash('sha256').update(value).digest(); }
function sessionKey(token: string) { return `portfolio:session:${digest(token).toString('hex')}`; }
export function sameOrigin(request: NextRequest) {
  return request.headers.get('origin') === request.nextUrl.origin;
}
export function reply(body: object, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}
export async function limited(request: NextRequest) {
  // Vercel supplies x-vercel-forwarded-for; unrecognized hosts share a conservative bucket.
  const ip = process.env.VERCEL ? request.headers.get('x-vercel-forwarded-for') || 'unknown' : 'local';
  const bucket = digest(ip).toString('hex');
  const script = "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],900) end; return n";
  const count = await redis(['EVAL', script, 1, `portfolio:login:${bucket}`]);
  return typeof count !== 'number' || count > 5;
}
export function validPasscode(value: string) {
  return timingSafeEqual(digest(value), digest(config().passcode));
}
export async function newSession() {
  const token = randomBytes(32).toString('hex');
  // Bind sessions to current credentials so rotating the passcode invalidates them.
  await redis(['SET', sessionKey(token), digest(config().passcode).toString('hex'), 'EX', lifetime]);
  return token;
}
export async function sessionValid(request: NextRequest) {
  const token = request.cookies.get(cookieName)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return false;
  return await redis(['GET', sessionKey(token)]) === digest(config().passcode).toString('hex');
}
export async function revoke(request: NextRequest) {
  const token = request.cookies.get(cookieName)?.value;
  if (token && /^[a-f0-9]{64}$/.test(token)) await redis(['DEL', sessionKey(token)]);
}
