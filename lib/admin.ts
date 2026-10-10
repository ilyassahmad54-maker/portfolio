import 'server-only';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

export const cookieName = process.env.NODE_ENV === 'production' ? '__Host-admin-session' : 'admin-session';
const lifetime = 3600;
export const cookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict' as const, path: '/', maxAge: lifetime };
type RedisOperation = 'EVAL' | 'SET' | 'GET' | 'DEL';
type FailureCategory = 'configuration' | 'redis_http_auth' | 'redis_http_rate_limit' |
  'redis_http_error' | 'redis_auth' | 'redis_permission' | 'redis_response_error' |
  'redis_invalid_json' | 'redis_invalid_response' | 'redis_invalid_result' |
  'redis_timeout' | 'redis_network';
type ConfigurationReason = 'passcode_missing' | 'passcode_too_short' | 'url_missing' |
  'url_invalid' | 'token_missing' | 'token_format_invalid';
type FailureStage = 'rate_limit' | 'request_body' | 'credential_check' | 'session_revoke' |
  'session_create' | 'session_lookup' | 'cookie';

class AdminFailure extends Error {
  constructor(
    readonly category: FailureCategory,
    readonly operation?: RedisOperation,
    readonly httpStatus?: number,
    readonly configurationReason?: ConfigurationReason,
  ) {
    // Never retain upstream response text, URLs, command arguments, or causes.
    super(category);
  }
}

export function reportAdminFailure(error: unknown, route: 'login' | 'session' | 'logout', stage: FailureStage) {
  const known = error instanceof AdminFailure ? error : undefined;
  console.error(JSON.stringify({
    event: 'admin_auth_failure', route, stage,
    category: known?.category ?? 'unexpected',
    operation: known?.operation,
    upstreamHttpStatus: known?.httpStatus,
    configurationReason: known?.configurationReason,
    responseStatus: 503,
  }));
}

export function config() {
  const passcode = process.env.ADMIN_PASSCODE;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  const invalid = (reason: ConfigurationReason): never => {
    throw new AdminFailure('configuration', undefined, undefined, reason);
  };
  if (!passcode) invalid('passcode_missing');
  if (passcode!.length < 20) invalid('passcode_too_short');
  if (!url) invalid('url_missing');
  try {
    const parsed = new URL(url!);
    if (url !== url!.trim() || parsed.protocol !== 'https:' || parsed.username || parsed.password ||
        parsed.search || parsed.hash || parsed.pathname !== '/') invalid('url_invalid');
  } catch { invalid('url_invalid'); }
  if (!token) invalid('token_missing');
  // The variable must contain the raw REST token, not a pasted Authorization header.
  if (/\s|["']/.test(token!)) invalid('token_format_invalid');
  return { passcode: passcode!, url: url!, token: token! };
}

export async function redis(command: (string | number)[]) {
  const operation = command[0] as RedisOperation;
  const { url, token } = config();
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST', redirect: 'error',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(command), cache: 'no-store', signal: AbortSignal.timeout(5000),
    });
  } catch (error) {
    const name = (error as { name?: unknown } | null)?.name;
    throw new AdminFailure(name === 'TimeoutError' || name === 'AbortError' ? 'redis_timeout' : 'redis_network', operation);
  }
  if (!response.ok) {
    const category = response.status === 401 || response.status === 403 ? 'redis_http_auth' :
      response.status === 429 ? 'redis_http_rate_limit' : 'redis_http_error';
    throw new AdminFailure(category, operation, response.status);
  }
  let body: unknown;
  try { body = await response.json(); }
  catch (error) {
    const name = (error as { name?: unknown } | null)?.name;
    throw new AdminFailure(name === 'TimeoutError' || name === 'AbortError' ? 'redis_timeout' : 'redis_invalid_json', operation, response.status);
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new AdminFailure('redis_invalid_response', operation, response.status);
  }
  const envelope = body as Record<string, unknown>;
  if (Object.prototype.hasOwnProperty.call(envelope, 'error')) {
    // Inspect only known Redis error codes; never log or retain the raw message.
    const code = typeof envelope.error === 'string' ? envelope.error.split(/\s/, 1)[0] : '';
    const category = code === 'WRONGPASS' || code === 'NOAUTH' ? 'redis_auth' :
      code === 'NOPERM' || code === 'READONLY' ? 'redis_permission' : 'redis_response_error';
    throw new AdminFailure(category, operation, response.status);
  }
  if (!Object.prototype.hasOwnProperty.call(envelope, 'result')) {
    throw new AdminFailure('redis_invalid_response', operation, response.status);
  }
  const result = envelope.result;
  const valid = operation === 'EVAL' ? Number.isSafeInteger(result) && (result as number) >= 1 :
    operation === 'SET' ? result === 'OK' :
    operation === 'GET' ? result === null || typeof result === 'string' :
    operation === 'DEL' ? Number.isSafeInteger(result) && (result as number) >= 0 : false;
  if (!valid) throw new AdminFailure('redis_invalid_result', operation, response.status);
  return result;
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
  return (count as number) > 5;
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
