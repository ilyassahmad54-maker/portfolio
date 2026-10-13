# Phase 4: private image storage (local implementation)

No hosted resource was created or changed. No frontend integration, content changes, deletes, commits, push or deployment in this phase.

## Storage and endpoints

Private Supabase bucket: `portfolio-images`. The server streams raw uploaded JPEG/PNG/WebP bytes into a bounded buffer (no multipart/base64 parsing). Client filenames and paths are ignored. Objects use `<random UUID>/<SHA-256>.<jpg|png|webp>` and `x-upsert:false`. Identical input images deliberately create separate immutable objects; there is no deduplication oracle or overwrite. The original accepted bytes are retained exactly.

- POST `/api/admin/assets/upload`: existing admin session + same-origin CSRF, 10 requests/minute per IP and session. Raw body `Content-Type: image/jpeg`, `image/png` or `image/webp`. Returns 201 with `id`, persistent `image: /api/assets/<id>`, authenticated `preview: /api/admin/assets/<id>`, dimensions/MIME/size. No object key or secret returned.
- GET `/api/admin/assets/<id>`: server-validated session, 120/minute. Preview verified uploaded images, including historical/orphaned inventory entries. An uploaded object that failed inventory registration is not accessible here.
- GET `/api/assets/<id>`: 240/minute per infrastructure IP. Inventory lookup requires the asset to appear in the **current** published revision's profile/project image fields. Draft-only, historical-only and unknown IDs all return 404. No signed URL or bucket key is sent to the browser.

All three routes are dynamic Node.js routes. Delivery checks stored size/SHA-256 and returns exact bytes, MIME, nosniff, sandbox CSP, and private/no-store. Query strings, invalid identifiers and crafted paths are rejected. Unsupported methods return 405. No upload, overwrite or delete route exists for unauthenticated users; no delete operation exists at all.

## Validation and failure handling

Server verifies signature, decoder format, declared MIME agreement, dimensions and a full Sharp pixel decode with failOn=warning. Accepted image formats: JPEG, PNG, WebP. Reject SVG/GIF/other formats and animated/multipage images. Limits: 4 MiB, 8192 per side, 40 million pixels, four decoded channels, native decoding timeout five seconds. Only one image decoder runs per application instance at a time (busy=429), bounding concurrent native allocations. Rate limiting remains shared in Redis across instances. Request stream timeout five seconds; Content-Length is checked early, but stream byte counts independently enforce the limit when the header is absent/dishonest. Decoder input safety features stay enabled. A bounded raw decode can still require up to roughly 160 MB for a maximal RGBA image, plus decoder overhead; profile Vercel memory before rollout.

Storage requests use fixed validated Supabase HTTPS origin and inventory-derived keys, refuse redirects, have eight-second timeouts, cap download bytes and metadata size, and never log upstream bodies or credentials. Every operation checks the actual bucket is private and has exactly the approved MIME and size settings. Misconfiguration fails closed.

Upload sequence: validate input -> insert immutable object -> read back and verify hash/length -> register inventory. Storage and PostgreSQL cannot share a transaction. Failed/ambiguous operations can leave unregistered objects; no cleanup or automatic deletion occurs. Retrying creates a new immutable object. Inventory rows are immutable; historical references are retained indefinitely.

## Publication and restore

Managed references are only `/api/assets/<uuid>`; draft saves independently require inventory membership in SQL. CV remains restricted to verified legacy public files, never a managed image URL. Public/preview API reads accept managed references, but delivery independently enforces current publication scope.

Before a matching-version publish or restore, server reads the specific immutable target revision and downloads/hashes each referenced managed asset. Legacy assets and CV are read from the local public directory and checked against the baseline manifest hash/size, with realpath containment. Next output-file tracing explicitly bundles those baseline files for publish/restore routes. Build still validates the manifest.

Verified managed assets receive a timestamp through `confirm_asset`. A database trigger rejects publish/restore revision insertion unless every managed reference has a verification younger than 30 seconds. Existing schema, version locks, atomic pointer/revision/receipt transactions and idempotency remain intact. Already-applied retries/stale requests use the database receipt/conflict path without requiring object downloads again. Missing/corrupt files stop publication; no public pointer advances. Cache invalidation is unchanged.

This is availability checking immediately before the PostgreSQL transaction, **not a distributed transaction** with Storage. An external operator/service-role caller could remove/change an object after checking. This application supplies no overwrite/delete capability; restrict server keys and operator access. Delivery verifies hashes again and fails closed if external changes occur. A long preflight can exceed the 30-second proof window and safely reject; test realistic content sizes and latency in Preview. No automatic deletion means history remains restorable while the backing bucket is preserved.

## SQL permissions

Migration 007 adds FORCE-RLS owner-only `cms.asset_checks`, an immutable inventory trigger, and publication verification trigger. Existing roles, history and state protections are preserved. Runtime gets only:

```sql
GRANT EXECUTE ON FUNCTION cms.register_asset(uuid,text,text,integer,integer,integer),
  cms.read_asset(uuid,boolean), cms.confirm_asset(uuid,text)
  TO portfolio_cms_runtime;
```

No direct table/sequence writes or elevated schema access. The trusted server runtime invokes registration only after decoded-byte and stored-object validation; the database cannot itself decode or fetch Storage bytes. Verification functions do not replace HTTP authentication.

`supabase/configuration/private-images.sql` is separate review-only Supabase configuration, not applied by local migration tooling. It creates the private bucket only if absent, refuses incompatible existing settings, and adds restrictive policies denying all bucket/object access for `anon` and `authenticated` specifically for this bucket, including in the presence of broad permissive policies. It leaves other buckets alone. Apply once with an approved Storage administration identity after reviewing existing policies; do not run blindly twice. It is tested against an isolated simulated Storage schema, not the hosted Storage service.

## Environment and approved setup still required

Do not put these in NEXT_PUBLIC variables or commit environment files:

- Existing `SUPABASE_DATABASE_URL`: restricted CMS runtime PostgreSQL connection.
- `SUPABASE_URL`: exact `https://<project-ref>.supabase.co`, no trailing slash.
- `SUPABASE_SERVICE_ROLE_KEY`: server-only Storage service-role API credential for the same isolated Supabase project. Never use it as the database login. Supabase service keys bypass RLS and must remain secret; see [official Storage access-control documentation](https://supabase.com/docs/guides/storage/security/access-control).

After separate approval, provision isolated Supabase resources, apply reviewed CMS migrations and Storage configuration, set only local/Preview environment values through a secure mechanism, verify private access, object immutability and pooler/TLS connectivity, and test a Vercel Preview. No current production settings were touched. The fallback database-independent website remains unchanged.

## Remaining frontend/integration work

Frontend still reads data.json. Future draft UI must use authenticated preview URLs for managed images. Use unoptimized managed image delivery (especially preview), since the Next image optimizer does not carry the admin browser session and can retain previously public bytes in its own cache. API no-store cannot revoke copies already downloaded while a revision was public. Do not introduce optimizer/signed-URL caching that leaks draft images. Desktop/mobile browser rendering is not yet wired or validated against hosted Storage.

Tests use real Sharp decoding, actual CMS PostgreSQL functions under PGlite restricted roles, existing session code with mock Redis, and mock Storage transport. Hosted native multi-connection behavior, real Storage REST/RLS integration and Vercel response limits/memory/latency still require isolated validation. Seven pre-existing high audit findings were reported unchanged by dependency installation; no force upgrades were applied.
