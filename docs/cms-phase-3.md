# Phase 3: authenticated revision history and restore

Local only; no hosted migration or deployment performed. Apply migration 006 only through the separately approved migration procedure. Earlier migrations remain unchanged.

## API contracts

All endpoints use existing server-validated Upstash sessions, private/no-store responses and noindex. No history is exposed through the public endpoint or SEO.

- GET `/api/admin/content/history?limit=20&before=123`: descending sequence keyset pagination, limit 1–50. Returns `items`, `nextCursor` (null when exhausted), and current `state`. Each item contains only `revisionId`, `sequence`, `createdAt`, and `operation`.
- GET `/api/admin/content/revision?id=<uuid>`: selected revision metadata, validated content and current state. Operation values: `seed` (migration), `draft`, `publish`, `restore`.
- POST `/api/admin/content/restore`: exact JSON fields `targetRevisionId`, `expectedVersion`, `requestId`. Same-origin CSRF required. This operation itself is the explicit restore action; there is no automatic restore or draft publication. Missing revision: 404; malformed envelope: 400; invalid content/assets or draft target: 422; stale version/reused key with different arguments: 409.

Rate limits per minute: history 60, revision 60, restore 5. IP and session buckets both apply. Existing auth behavior and other CMS limits remain unchanged.

## Transaction and draft policy

Restore locks the singleton state row with a three-second lock timeout, checks the idempotency receipt and version, then accepts only `seed`, `publish`, or `restore` targets. It validates the document against the current SQL schema and the verified deployable asset allowlist. A new immutable `restore` revision references the selected source revision. Revision insertion, pointer updates, version increment and receipt insertion are one transaction. Failed operations leave all rows unchanged (sequence allocation may have gaps).

An independent saved draft is preserved, including its pointer, so unpublished work is not lost. If the saved draft pointer equals the published pointer, both advance to the restored publication. `hasDraft` continues to compare document content. Future publish/save must use the newly fetched state/version. Identical retries return the original result with `replayed=true`, even if later state has changed; fetch state before starting another operation. Successful restore invokes the same cache invalidation as publish, including replay. A post-commit cache error is reported as `cacheRefreshPending`, not a failed transaction.

## Permissions

Only three additional runtime EXECUTE grants:

```sql
GRANT EXECUTE ON FUNCTION cms.list_revisions(integer,bigint),
  cms.read_revision(uuid), cms.restore_publication(uuid,bigint,uuid)
  TO portfolio_cms_runtime;
```

No table, sequence, schema CREATE or helper grants. All existing RLS/FORCE RLS and immutable-history protections remain. Functions have pinned search_path and SECURITY DEFINER under the restricted non-login CMS owner. Responses deliberately omit actor labels, request identifiers, receipt fingerprints and arbitrary database fields. Secrets and session identifiers are never stored in content revisions by these operations.

## Validation and remaining integration work

Automated tests exercise SQL under restricted roles using isolated PGlite and actual API handlers with mock Redis sessions. These cover pagination, auth, CSRF, rate limits, target lookup, draft rejection/isolation, immutable history, retry/conflict behavior, missing assets and injected transactional failure. Real simultaneous PostgreSQL connections, Supabase TLS/pooler and Vercel Preview still require isolated integration testing before rollout.

Asset availability currently means a baseline asset in the verified manifest: build checks actual file presence and hashes. SQL cannot inspect deployed filesystem availability; removal from a deployment outside this verified build process remains an operational risk. New managed/storage assets remain blocked until uploads and delivery verification are implemented. No old images are deleted.

History is a per-request database snapshot; pagination does not include newer revisions inserted above the first page. Refresh to see new revisions. Retention is append-only without pruning in this phase.

The frontend and SEO still use the unchanged data.json. Admin UI integration, storage uploads, and database-backed public rendering are future phases; these APIs do not change the production portfolio by themselves.
