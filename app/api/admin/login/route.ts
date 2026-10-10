import { NextRequest } from 'next/server';
import { sameOrigin, reply, limited, validPasscode, newSession, revoke, cookieName, cookieOptions } from '@/lib/admin';
export const runtime = 'nodejs';
export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return reply({ error: 'Forbidden' }, 403);
  try {
    if (await limited(request)) {
      const response = reply({ error: 'Too many attempts. Try again in 15 minutes.' }, 429);
      response.headers.set('Retry-After', '900'); return response;
    }
    if (!request.headers.get('content-type')?.startsWith('application/json')) return reply({ error: 'Invalid request' }, 400);
    // Bound the stream before buffering; Content-Length alone is client-controlled.
    const reader = request.body?.getReader();
    if (!reader) return reply({ error: 'Invalid request' }, 400);
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 2048) {
        await reader.cancel();
        return reply({ error: 'Invalid request' }, 413);
      }
      chunks.push(value);
    }
    const text = Buffer.concat(chunks).toString('utf8');
    let body;
    try { body = JSON.parse(text); } catch { return reply({ error: 'Invalid request' }, 400); }
    if (typeof body?.passcode !== 'string' || body.passcode.length > 1024 || !validPasscode(body.passcode)) return reply({ error: 'Invalid credentials' }, 401);
    await revoke(request);
    const token = await newSession();
    const response = reply({ authenticated: true });
    response.cookies.set(cookieName, token, cookieOptions); return response;
  } catch { return reply({ error: 'Admin login unavailable' }, 503); }
}
