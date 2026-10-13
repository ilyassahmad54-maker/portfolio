import 'server-only';
import { verifyContentAssets } from './asset-store';
import type { CmsState, CmsStore, DraftSnapshot, PublishedSnapshot, ChangeResult, RevisionSummary, RevisionHistory, HistoricalRevision } from './contracts';
import { queryCms } from './database';
import { CmsUnavailable } from './errors';
import { validatePortfolio } from './validation';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new CmsUnavailable('database_response');
  return value as Record<string, unknown>;
}
function id(value: unknown): string {
  if (typeof value !== 'string' || !uuid.test(value)) throw new CmsUnavailable('database_response');
  return value;
}
function integer(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) throw new CmsUnavailable('database_response');
  return value;
}
function content(value: unknown) {
  try { validatePortfolio(value); return value; } catch { throw new CmsUnavailable('database_response'); }
}
export function decodeState(value: unknown): CmsState {
  const object = record(value);
  if (typeof object.hasDraft !== 'boolean' || typeof object.updatedAt !== 'string' || !Number.isFinite(Date.parse(object.updatedAt))) throw new CmsUnavailable('database_response');
  return { version: integer(object.version), publishedRevisionId: id(object.publishedRevisionId), draftRevisionId: id(object.draftRevisionId), hasDraft: object.hasDraft, updatedAt: object.updatedAt };
}
export function decodePublished(value: unknown): PublishedSnapshot {
  const object = record(value);
  // Explicit projection: never forward draft pointers or arbitrary database fields.
  return { revisionId: id(object.revisionId), sequence: integer(object.sequence), content: content(object.content) };
}
export function decodeDraft(value: unknown): DraftSnapshot {
  const object = record(value);
  const result = { state: decodeState(object.state), revisionId: id(object.revisionId), content: content(object.content) };
  if (result.revisionId !== result.state.draftRevisionId) throw new CmsUnavailable('database_response');
  return result;
}
export function decodeChange(value: unknown): ChangeResult {
  const object = record(value);
  if (typeof object.replayed !== 'boolean') throw new CmsUnavailable('database_response');
  return { state: decodeState(object.state), revisionId: id(object.revisionId), replayed: object.replayed };
}

export function decodeRevisionSummary(value: unknown): RevisionSummary {
  const object = record(value);
  if (!['seed','draft','publish','restore'].includes(String(object.operation)) || typeof object.createdAt !== 'string' || !Number.isFinite(Date.parse(object.createdAt))) throw new CmsUnavailable('database_response');
  return { revisionId: id(object.revisionId), sequence: integer(object.sequence), createdAt: object.createdAt, operation: object.operation as RevisionSummary['operation'] };
}
export function decodeHistory(value: unknown): RevisionHistory {
  const object = record(value);
  if (!Array.isArray(object.items) || object.items.length > 50) throw new CmsUnavailable('database_response');
  const items = object.items.map(decodeRevisionSummary);
  if (items.some((item, i) => i > 0 && item.sequence >= items[i-1].sequence)) throw new CmsUnavailable('database_response');
  return { items, nextCursor: object.nextCursor === null ? null : integer(object.nextCursor), state: decodeState(object.state) };
}
export function decodeHistorical(value: unknown): HistoricalRevision {
  const object = record(value);
  return { ...decodeRevisionSummary(object), content: content(object.content), state: decodeState(object.state) };
}

export const cmsStore: CmsStore = {
  history: async (limit, before) => decodeHistory(await queryCms('SELECT cms.list_revisions($1::integer,$2::bigint) AS result', [limit, before])),
  revision: async revision => decodeHistorical(await queryCms('SELECT cms.read_revision($1::uuid) AS result', [revision])),
  restore: async request => { const state=await cmsStore.state(); if(state.version===request.expectedVersion) { const snapshot=await cmsStore.revision(request.targetRevisionId!); await verifyContentAssets(snapshot.content); } return decodeChange(await queryCms('SELECT cms.restore_publication($1::uuid,$2::bigint,$3::uuid) AS result', [request.targetRevisionId!, request.expectedVersion, request.requestId])); },
  published: async () => decodePublished(await queryCms('SELECT cms.read_published() AS result')),
  draft: async () => decodeDraft(await queryCms('SELECT cms.read_draft() AS result')),
  state: async () => decodeState(await queryCms('SELECT cms.read_state() AS result')),
  // Bind serialized JSON as text: Postgres.js JSONB serialization would encode
  // an already-stringified document again when the parameter itself is jsonb.
  save: async request => decodeChange(await queryCms('SELECT cms.save_draft($1::text::jsonb,$2::bigint,$3::uuid) AS result', [JSON.stringify(request.content), request.expectedVersion, request.requestId])),
  publish: async request => { const state=await cmsStore.state(); if(state.version===request.expectedVersion && state.draftRevisionId===request.draftRevisionId) { const snapshot=await cmsStore.revision(request.draftRevisionId!); await verifyContentAssets(snapshot.content); } return decodeChange(await queryCms('SELECT cms.publish_draft($1::bigint,$2::uuid,$3::uuid) AS result', [request.expectedVersion, request.draftRevisionId!, request.requestId])); },
  discard: async request => decodeChange(await queryCms('SELECT cms.discard_draft($1::bigint,$2::uuid,$3::boolean,$4::uuid) AS result', [request.expectedVersion, request.draftRevisionId!, request.confirmed!, request.requestId])),
};
