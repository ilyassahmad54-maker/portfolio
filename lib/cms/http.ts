import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import publishedFallback from '../../data.json';
import type { CmsOperation, CmsStore, WorkflowRequest } from './contracts';
import { CmsHttpError, CmsUnavailable } from './errors';
import { ContentValidationError, MAX_CONTENT_BYTES, validatePortfolio } from './validation';
import { requirePublishableAssets } from './assets';

export const MAX_REQUEST_BYTES = MAX_CONTENT_BYTES + 16 * 1024;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function response(body: unknown, status = 200, retry = false) {
  return NextResponse.json(body, { status, headers: {
    'Cache-Control': 'private, no-store, max-age=0', 'X-Robots-Tag': 'noindex, nofollow',
    'X-Content-Type-Options': 'nosniff', 'Vary': 'Cookie, Origin',
    ...(process.env.VERCEL_ENV === 'preview' ? { 'X-CMS-Environment': 'isolated-preview' } : {}),
    ...(retry ? { 'Retry-After': '60' } : {}),
  } });
}

export async function readJsonBody(request: NextRequest): Promise<unknown> {
  if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(request.headers.get('content-type') || '') ||
      !['identity', null].includes(request.headers.get('content-encoding'))) throw new CmsHttpError(415, 'Use uncompressed application/json.');
  const length = request.headers.get('content-length');
  if (length !== null && (!/^\d+$/.test(length) || !Number.isSafeInteger(Number(length)))) throw new CmsHttpError(400, 'Invalid request.');
  if (length !== null && Number(length) > MAX_REQUEST_BYTES) throw new CmsHttpError(413, 'Request body is too large.');
  const reader = request.body?.getReader();
  if (!reader) throw new CmsHttpError(400, 'JSON body required.');
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new CmsHttpError(408, 'Request body timed out.')), 5000); });
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const part = await Promise.race([reader.read(), deadline]);
      if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > MAX_REQUEST_BYTES) throw new CmsHttpError(413, 'Request body is too large.');
      chunks.push(part.value);
    }
    try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks))); }
    catch { throw new CmsHttpError(400, 'Malformed JSON.'); }
  } catch (error) {
    void reader.cancel().catch(() => {});
    throw error instanceof CmsHttpError ? error : new CmsHttpError(400, 'Invalid request body.');
  } finally { if (timer) clearTimeout(timer); }
}

export function parseWorkflowRequest(value: unknown, operation: 'save' | 'publish' | 'discard' | 'restore'): WorkflowRequest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new CmsHttpError(400, 'Invalid request.');
  const object = value as Record<string, unknown>;
  const fields = operation === 'save' ? ['content', 'expectedVersion', 'requestId'] :
    operation === 'restore' ? ['expectedVersion', 'targetRevisionId', 'requestId'] : operation === 'publish' ? ['expectedVersion', 'draftRevisionId', 'requestId'] : ['expectedVersion', 'draftRevisionId', 'requestId', 'confirmed'];
  if (Object.keys(object).length !== fields.length || fields.some(field => !Object.hasOwn(object, field)) || Object.keys(object).some(field => !fields.includes(field))) throw new CmsHttpError(400, 'Invalid request fields.');
  if (!Number.isSafeInteger(object.expectedVersion) || (object.expectedVersion as number) < 1 || (object.expectedVersion as number) > Number.MAX_SAFE_INTEGER - 1 ||
      typeof object.requestId !== 'string' || !uuid.test(object.requestId)) throw new CmsHttpError(400, 'Valid version and request ID required.');
  const result: WorkflowRequest = { expectedVersion: object.expectedVersion as number, requestId: object.requestId };
  if (operation === 'save') {
    validatePortfolio(object.content);
    requirePublishableAssets(object.content);
    result.content = object.content;
  } else if (operation === 'restore') {
    if (typeof object.targetRevisionId !== 'string' || !uuid.test(object.targetRevisionId)) throw new CmsHttpError(400, 'Valid target revision ID required.');
    result.targetRevisionId = object.targetRevisionId;
  } else {
    if (typeof object.draftRevisionId !== 'string' || !uuid.test(object.draftRevisionId)) throw new CmsHttpError(400, 'Valid draft revision ID required.');
    result.draftRevisionId = object.draftRevisionId;
    if (operation === 'discard') {
      if (object.confirmed !== true) throw new CmsHttpError(400, 'Explicit discard confirmation required.');
      result.confirmed = true;
    }
  }
  return result;
}

interface Dependencies {
  store: CmsStore;
  published?: () => Promise<unknown>;
  authorize(request: NextRequest, mutation: boolean): Promise<void>;
  limit(request: NextRequest, operation: CmsOperation): Promise<void>;
  invalidate(): void | Promise<void>;
  log(operation: CmsOperation, category: string, status: number): void;
}

export function createCmsHandler(operation: CmsOperation, dependencies: Dependencies) {
  const mutation = ['save', 'publish', 'discard', 'restore'].includes(operation);
  return async (request: NextRequest) => {
    try {
      if (request.method !== (mutation ? 'POST' : 'GET')) return response({ error: 'Method not allowed' }, 405);
      if (operation !== 'published') await dependencies.authorize(request, mutation);
      await dependencies.limit(request, operation);
      if (operation === 'published') {
        if(dependencies.published)return response(await dependencies.published());
        try {
          const document = await dependencies.store.published();
          requirePublishableAssets(document.content);
          return response({ ...document, source: 'database', readOnly: false });
        } catch {
          dependencies.log(operation, 'published_fallback', 200);
          return response({ content: publishedFallback, revisionId: null, sequence: null, source: 'fallback', readOnly: true });
        }
      }
      if (operation === 'history' || operation === 'revision') {
        const params = new URL(request.url).searchParams;
        const allowed = operation === 'history' ? ['limit', 'before'] : ['id'];
        if ([...params.keys()].some(key => !allowed.includes(key) || params.getAll(key).length !== 1)) throw new CmsHttpError(400, 'Invalid query.');
        if (operation === 'revision') {
          const revision = params.get('id');
          if (!revision || !uuid.test(revision)) throw new CmsHttpError(400, 'Valid revision ID required.');
          return response(await dependencies.store.revision(revision));
        }
        const limit = params.get('limit') ?? '20', before = params.get('before');
        if (!/^[1-9][0-9]*$/.test(limit) || Number(limit) > 50 || (before !== null && (!/^[1-9][0-9]*$/.test(before) || !Number.isSafeInteger(Number(before))))) throw new CmsHttpError(400, 'Invalid pagination.');
        return response(await dependencies.store.history(Number(limit), before === null ? null : Number(before)));
      }
      if (operation === 'state') return response(await dependencies.store.state());
      if (operation === 'draft' || operation === 'preview') {
        const snapshot = await dependencies.store.draft();
        requirePublishableAssets(snapshot.content);
        return response({ ...snapshot, preview: operation === 'preview' });
      }
      const input = parseWorkflowRequest(await readJsonBody(request), operation as 'save' | 'publish' | 'discard' | 'restore');
      // Publish accepts no content from the browser: only the versioned saved draft.
      const result = await dependencies.store[operation as 'save' | 'publish' | 'discard' | 'restore'](input);
      let cacheRefreshPending = false;
      if (operation === 'publish' || operation === 'restore') {
        try { await dependencies.invalidate(); }
        catch { cacheRefreshPending = true; dependencies.log(operation, 'cache', 200); }
      }
      return response({ ...result, ...(cacheRefreshPending ? { cacheRefreshPending: true } : {}) });
    } catch (error) {
      if (error instanceof CmsHttpError) return response({ error: error.publicMessage }, error.status, error.status === 429);
      if (error instanceof ContentValidationError) return response({ error: 'Invalid portfolio document.' }, 422);
      const category = error instanceof CmsUnavailable ? error.category : 'unexpected';
      dependencies.log(operation, category, 503);
      return response({ error: 'Content service temporarily unavailable.' }, 503);
    }
  };
}
