import 'server-only';
import { createHash } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { sessionValid, sameOrigin, redis, cookieName, configuredAdminBackend, postgresRate } from '../admin';
import type { CmsOperation } from './contracts';
import { CmsHttpError, CmsUnavailable } from './errors';

export const CMS_LIMITS: Record<CmsOperation, number> = { published: 120, draft: 120, preview: 120, state: 120, save: 30, publish: 5, discard: 10, history: 60, revision: 60, restore: 5, upload: 10, asset: 240, assetPreview: 120 };
const script = "local maximum=0; for _,key in ipairs(KEYS) do local n=redis.call('INCR',key); if n==1 then redis.call('EXPIRE',key,60) end; if n>maximum then maximum=n end; end; return maximum";
function stateFailureCategory(){
  try{return configuredAdminBackend()==='postgres'?'authentication' as const:'redis' as const;}
  catch{return 'configuration' as const;}
}

export async function authorizeCms(request: NextRequest, mutation: boolean): Promise<void> {
  if (mutation && !sameOrigin(request)) throw new CmsHttpError(403, 'Forbidden');
  try { if (!(await sessionValid(request))) throw new CmsHttpError(401, 'Authentication required'); }
  catch (error) { if (error instanceof CmsHttpError) throw error; throw new CmsUnavailable(stateFailureCategory()); }
}

export async function limitCms(request: NextRequest, operation: CmsOperation): Promise<void> {
  const ip = process.env.VERCEL ? request.headers.get('x-vercel-forwarded-for') || 'unknown' : 'local';
  // Only trusted infrastructure IP header; never retain raw IPs or cookies in Redis keys.
  // The IP bucket prevents bypass by logging out and creating another admin session.
  const hash = (value: string) => createHash('sha256').update(value).digest('hex');
  const keys = [`portfolio:cms:${operation}:ip:${hash(ip)}`];
  // Public image readers have no admin session. A shared "none" session bucket
  // would incorrectly impose one global limit across unrelated visitors.
  if (operation !== 'published' && operation !== 'asset') keys.push(`portfolio:cms:${operation}:session:${hash(request.cookies.get(cookieName)?.value || 'none')}`);
  try {
    const count = configuredAdminBackend()==='postgres' ? await postgresRate(operation,hash(ip),operation==='published'||operation==='asset'?null:hash(request.cookies.get(cookieName)?.value || 'none')) : await redis(['EVAL', script, keys.length, ...keys]);
    if ((count as number) > CMS_LIMITS[operation]) throw new CmsHttpError(429, 'Too many requests. Try again shortly.');
  } catch (error) { if (error instanceof CmsHttpError) throw error; throw new CmsUnavailable(stateFailureCategory()); }
}
