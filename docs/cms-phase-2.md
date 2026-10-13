# CMS Phase 2: protected content APIs

Local implementation on `feature/supabase-portfolio-cms`. No hosted migrations,
environment edits, commits, pushes or deployments. Existing authentication,
portfolio components, SEO metadata and `data.json` remain unchanged.

## Scope boundary

This phase implements the backend APIs and transactions. The existing page and
Admin Edit Mode are **not connected to these APIs yet**: they retain their existing
JSON/localStorage behavior until the separately reviewed frontend integration.
Publishing through the new API updates the database/public API, not the current
JSON-backed page. Route revalidation hooks are ready for that integration but do
not make a statically imported JSON file become database-backed.

Revision history remains append-only. Listing history and restoring old published
versions, Storage uploads/delivery, and frontend controls are later phases.

## API contract

All routes use Node runtime, force dynamic execution and set revalidation to zero.
Every response is private/no-store, noindex/nofollow, nosniff, and varies by Cookie
and Origin. There is no CORS permission for other origins.

| Method and route | Protection | Result |
| --- | --- | --- |
| GET `/api/content/published` | Public, operation/IP rate limit | Only current published content, revision ID and sequence |
| GET `/api/admin/content/state` | Existing server-side session | Current version, draft/published pointers, semantic `hasDraft`, timestamp |
| GET `/api/admin/content/draft` | Existing server-side session | Saved draft, revision ID and state |
| GET `/api/admin/content/preview` | Existing server-side session | Current saved draft JSON with `preview: true`; not an HTML preview page |
| POST `/api/admin/content/draft` | Session + exact same Origin | Save a validated document as a new immutable draft |
| POST `/api/admin/content/publish` | Session + exact same Origin | Atomically publish the saved draft |
| POST `/api/admin/content/discard` | Session + exact same Origin + confirmation | Reset draft pointer to published revision |

Save body:

```json
{
  "expectedVersion": 1,
  "requestId": "<new UUID>",
  "content": "<complete PortfolioData object, not a string>"
}
```

Publish body:

```json
{
  "expectedVersion": 2,
  "draftRevisionId": "<UUID returned by saved draft>",
  "requestId": "<new UUID>"
}
```

Discard uses the same fields as publish plus `"confirmed": true`. Confirmation
must be obtained by the future UI before issuing the request. An API can verify
the explicit flag, not whether a human saw a dialog. No endpoint accepts a
browser-supplied content document as part of a publish/discard request.

Unknown envelope fields, missing fields, unsafe versions and malformed UUIDs are
rejected. Bodies must be uncompressed `application/json` (optional UTF-8 charset),
with valid UTF-8. Stream reading is bounded to 1 MiB + 16 KiB for the envelope and
five seconds total. The content validator separately enforces the Phase 1 limits.
`Content-Length` can reject early but cannot bypass the streamed byte limit.

## Authentication, rate limiting and errors

The existing `lib/admin.ts` and login/session/logout routes are byte-for-byte
unchanged. Each protected API invokes `sessionValid` independently; no browser
flag, localStorage value, cached session result or middleware-only check is trusted.
Every mutation also uses the existing exact-origin check. Redis outages fail
closed before database access.

New rate limits use separate `portfolio:cms:*` Redis keys, not login buckets:

| Operation | Requests per 60 seconds |
| --- | ---: |
| Public published read | 120 per infrastructure IP |
| Draft / preview / state read | 120 each, per IP and session |
| Save | 30 per IP and session |
| Publish | 5 per IP and session |
| Discard | 10 per IP and session |

Protected rate checks occur after authorization. Counters for IP and session are
incremented in one Lua call; the larger count controls admission. Rotating sessions
cannot bypass the IP bucket. Raw IPs/cookies are hashed before becoming Redis keys.
Untrusted forwarding headers are not used. Unknown/local infrastructure shares a
conservative bucket. Rate rejection returns 429 and `Retry-After: 60`.

Status codes: 400 malformed request/confirmation; 401 invalid session; 403 CSRF;
408 stalled body; 409 stale version/pointer or reused key with different input;
413 body limit; 415 encoding/type; 422 invalid document/asset; 429 limit;
503 unavailable Redis/database or unsafe database response/configuration.

Diagnostics contain only fixed event/operation/category/status fields. No raw
errors, connection strings, SQL, request content, cookies, Redis keys or environment
values are returned or logged. PostgreSQL errors are mapped using known SQLSTATE
codes only. Invalid content responses never echo submitted values.

## Transactions and concurrency

Apply new migrations 004 (reviewed legacy-asset baseline) and 005 (workflow) only
to an explicitly approved isolated database after the Phase 1 migrations/seed.
No existing numbered migration is rewritten to grant workflow access.

Each mutation is one PostgreSQL function call and therefore one atomic statement:

1. Validate input and fingerprint the complete operation.
2. Lock the singleton state row with `FOR UPDATE` (three-second lock timeout).
3. Re-check the idempotency receipt and expected state version under that lock.
4. For publish/discard, also require the expected saved draft revision ID.
5. Save/publish creates an immutable revision; publish changes both pointers;
   discard changes only the draft pointer. Advance the version once.
6. Insert an immutable receipt in the same transaction.

A failure in any step rolls everything back. No success response is sent before
the SQL call completes. Retries with the same UUID and identical input return the
original result with `replayed: true`; they do not advance state again. Reusing
that UUID for different input/another action returns 409. Successful receipts are
retained; no pruning job is introduced.

An older receipt deliberately returns its original state snapshot. A client must
fetch fresh state after a replay before making another edit, not assume the old
response is the current version. Repeating publish with a **new** request ID and
an old version returns 409. Create one request ID per intended action and reuse it
when retrying uncertain network outcomes.

`hasDraft` compares content values, not just pointer inequality: saving identical
content creates history but does not imply semantic unpublished changes.

## SQL permissions

`portfolio_cms_runtime` has EXECUTE on exactly these six functions:

```sql
cms.read_published()
cms.read_draft()
cms.read_state()
cms.save_draft(jsonb, bigint, uuid)
cms.publish_draft(bigint, uuid, uuid)
cms.discard_draft(bigint, uuid, boolean, uuid)
```

No direct table/sequence privileges, seed permission, private-helper execution,
Storage metadata writes, DDL or owner membership. The wrappers are SECURITY
DEFINER owned by the non-login CMS owner and use a pinned search path. The private
implementation is not directly executable by runtime or PUBLIC.

All six CMS tables force RLS with owner-only policies. New `legacy_assets` and
`operation_receipts` tables reject UPDATE/DELETE/TRUNCATE, as do revisions and
the migration ledger. No anonymous/browser Data API grants are added. Keep `cms`
out of Supabase's exposed API schemas.

## Server-only database connection

Only `SUPABASE_DATABASE_URL` is used by this phase. No Storage secret/publishable
key is needed yet. Never configure or paste credentials in chat/terminal output.
The runtime login must inherit only `portfolio_cms_runtime`; never use postgres,
service_role, migration, owner or seed credentials. Provisioning remains an
out-of-band, separately approved setup step.

Accepted URI: PostgreSQL URI with explicit username/password, database name,
Supabase direct or pooler hostname, and no query parameters/hash. TLS certificate
verification is mandatory; disabling verification is not supported. Percent-encode
credential characters when configuring the URI in secret storage. No .env file
was added or modified by this work.

The Postgres.js adapter uses prepared statements off, at most two connections,
reserved sequential statements (avoiding driver pipelining), five-second connect
timeout, and an eight-second total reservation/query deadline. Before content
calls, catalog checks reject elevated roles or owner/seed membership and require
inherited runtime membership. It does not SET ROLE into an elevated identity.

On deadline the instance's pool is closed, including queued reservations. A late
reservation cannot start a timed-out write; later retries use a fresh pool. Closing
the pool can also interrupt another call on that instance. A network failure after
commit has an uncertain outcome to the caller; retry with the same request UUID.
Receipts resolve that uncertainty without duplicate writes.

## Images and fallback

The existing public images/CV are hashed into `lib/cms/legacy-assets.json` and SQL
migration 004. `cms:assets:check` runs before every production build and fails if
source references, bytes, or generated baselines drift. Future baseline changes
need review and a new migration; do not rewrite an applied migration.

Both application validation and SQL enforce the approved baseline references.
Managed `/api/assets/<uuid>` images remain blocked even if an asset metadata row
exists: metadata alone is not proof of a verified upload or safe public delivery.
External/base64/blob/file paths are rejected. Phase 3+ will add the approved private
Storage workflow and replace this conservative gate with verified asset checks.

The public endpoint projects published fields explicitly and never queries draft
functions. Database failures/invalid published responses produce the bundled
published `data.json` as `source: fallback`, `readOnly: true`, with null revision
metadata. This fallback can be older than the latest DB publication during an
outage. Admin reads/writes never silently fall back. If Redis rate limiting itself
fails, the public API also returns 503; the current JSON-backed page is unaffected.

Public/draft API responses are never persisted in HTTP/Next caches. Publish calls
route revalidation after commit. If revalidation fails, publication still returns
200 with `cacheRefreshPending: true` and a safe diagnostic; retries remain
idempotent. Fresh public API reads still load the committed database version.

## Local validation and remaining gates

```sh
npm run test:cms
npm run test:auth
npm run test:content
npm run typecheck
npm run lint
npm run cms:schema:check
npm run cms:migration:dry-run
npm run cms:backup:verify -- /path/reported/by/dry-run
npm run build
```

Tests use actual existing authentication code with synthetic credentials/Redis,
the real route handler/store code, and actual migrations/functions in isolated
PGlite PostgreSQL. Adapter/TLS/deadline tests inject a fake transport. No test reads
real credentials or changes process.env. Backup artifacts now also include the
legacy-asset manifest and both Phase 2 migrations.

Coverage includes session expiry/revocation/rotation, CSRF, rate buckets/expiry,
malformed JSON/UTF-8, missing/dishonest Content-Length, stalled streams, invalid
documents/assets, public/draft isolation, stale versions, idempotent retries,
simultaneous HTTP save/publication requests, SQL permissions/RLS, injected receipt
failures, Redis/database outages, decoder failures and post-commit cache errors.

PGlite serializes database work on one connection. Simultaneous HTTP requests are
tested, but true cross-connection lock contention, the live Supabase pooler/TLS
chain, Vercel runtime behavior and Storage need isolated integration testing before
rollout. Frontend hydration and desktop/iPhone consistency must be verified after
the page/editor integration, not inferred from these API tests. Existing seven
dependency-audit findings remain documented in Phase 1; no force-upgrades occurred.

Stop for Phase 2 review. Phase 3, hosted migrations/resources, environment setup,
commits, pushes and deployments each remain outside this approval.
