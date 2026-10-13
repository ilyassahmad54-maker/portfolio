# Phase 5 — frontend integration (local only)

No commits, pushes, deployments, hosted migrations, production configuration changes, draft deletions or asset deletions were performed. The existing eight-project data.json, public assets, CV and server authentication implementation remain unchanged.

## Data flow

The dynamic root layout reads the published database snapshot on the server. React request memoization supplies the same snapshot to metadata and the portfolio provider. Device, browser storage and admin session do not select public content. Canonical metadata uses https://portfolio-woad-nu-owt4y7t889.vercel.app and published profile fields only.

Successful database reads maintain a published-only durable Redis backup. A sequence-aware Lua comparison prevents an older in-flight read overwriting a newer backup. Database failure uses that validated backup; failure of both services uses the unchanged deployment data.json. A visible read-only degraded-state notice identifies fallback content. This backup can be stale, and deployment data is the emergency baseline rather than a guarantee of the latest publication. Redis backup writes are awaited and add latency; measure this in Preview. No draft is written into the public backup.

Public rendering is dynamic with revalidation disabled. Publication/restore invalidate the page and public API, and refresh the shared backup. Mounted clients refresh published content every 60 seconds and on focus/visibility; stale responses cannot replace newer client snapshots. Failed refreshes retain the current public snapshot and show degraded status. Public API rate limiting remains fail closed.

## Editor

The existing drawer uses an in-memory editor controller and existing server sessions. Opening the editor loads the saved database draft; public rendering stays published until explicit preview. Controls support save, saved/unsaved previews, publish confirmation, discard confirmation, project add/delete/reorder, uploads, history pagination, historical preview and published-version restore confirmation. Additional existing profile/project fields are editable without changing public styling.

Every mutation still goes through the protected Phase 2–4 APIs. Optimistic versions return conflicts without discarding work. Uncertain retries reuse their request identifier. An uncertain mutation blocks unrelated operations until resolved or explicitly reloaded. Success is reported only after the mutation response; a failed post-commit refresh reports completed-but-reload-required and retains local work. Expired sessions retain work in memory for backup/re-authentication. Navigation warnings protect unsaved or in-flight work, but closing the tab after dismissing a warning loses memory-only changes. Export JSON provides an explicit backup.

## Legacy drafts and images

Legacy portfolio_custom_data is read only after authentication. It is never removed, overwritten, auto-imported or auto-published. The administrator can export the exact original JSON, compare field-level differences, select changes (none selected by default), and import into editor memory. Comparison refuses stale base values. Embedded JPEG/PNG/WebP image imports use the protected upload endpoint before full document validation. Import failure does not replace working content; successful earlier uploads may remain unused, intentionally without cleanup.

New images retain /api/assets/<uuid> references in documents. Authenticated previews map these to /api/admin/assets/<uuid>. Managed delivery bypasses Next image optimization, preventing an optimizer cache from serving private draft bytes. Existing public images continue using their original paths. Uploading changes editor memory only; save/publish remain explicit. Image delivery fails closed with a neutral unavailable placeholder. During a database outage, managed image authorization can fail even when cached published JSON is available. Historical assets stay in storage but public delivery requires current publication membership.

## Files

- Server: app/layout.tsx; lib/cms/public-content.ts; lib/cms/metadata.ts; lib/cms/http.ts; lib/cms/routes.ts.
- Frontend: components/PortfolioContext.tsx; EditDrawer.tsx; CmsControls.tsx; LocalChangesBadge.tsx; AdminLockModal.tsx; Hero.tsx; Projects.tsx; PortfolioImage.tsx; lib/cms/editor.ts; lib/cms/legacy.ts.
- Verification: tests/cms-frontend.cjs; tests/browser/portfolio.cjs; package.json/package-lock.json; this runbook.

Other uncommitted CMS files belong to Phases 1–4. Phase 5 introduces no SQL migration, role grant or RLS change. Existing narrowly scoped function permissions remain in force.

## Local verification results

- CMS: 90 tests passed, including PostgreSQL permissions/RLS, atomic operations, images, frontend controller integration, conflicts, lost responses and post-commit refresh failures.
- Existing authentication: 10 tests passed. Existing content: 2 tests passed.
- Clean-profile production-browser checks: 2 tests passed at desktop 1440px and mobile 390px widths. All eight public project titles/order and canonical metadata matched despite conflicting browser-local drafts. Admin add/reorder/save/preview/delete controls worked without modifying the original browser draft.
- TypeScript, lint (no warnings), production build and git diff --check passed. No checked secret configuration identifiers appeared in generated client bundles.
- Migration dry-run and backup validation preserved all eight projects and canonical SHA-256 940d8b8e91c19bc0e252048f6049a34b1766d8989af9e2bde1ac36fce0900a00. No database was accessed by the dry-run.
- Screenshots were inspected locally; temporary browser artifacts are under /tmp/portfolio-cms-phase5. Browser admin APIs are mocked; database workflow tests separately exercise the actual APIs and SQL using isolated PGlite/mock infrastructure.

## Isolated integration prerequisites (separate approval required)

1. Provision a separate Supabase project and separate Upstash Redis database. Do not reuse production credentials, data or Redis keys. Review and apply migrations 001–007 in order using an isolated migration administration identity. Review private-images.sql separately before applying it to Storage.
2. Create the private portfolio-images bucket with JPEG/PNG/WebP only and 4 MiB size limit. Retain its restrictive anon/authenticated policies. Use a server-only service-role credential solely for this isolated project. Test direct anonymous/authenticated bucket access is denied.
3. Create a login identity with membership only in portfolio_cms_runtime for application SQL. It must not own CMS objects or possess superuser/BYPASSRLS/create privileges. Keep migration/seed privileges in separate identities; never use those credentials at runtime. Verify TLS and the chosen Supabase pooler with prepared statements disabled.
4. Run npm run cms:migration:dry-run and verify the resulting backup with npm run cms:backup:verify -- /path/to/backup. Import the reviewed canonical document through the restricted seed workflow described in cms-phase-1.md using its separate seed identity. Confirm eight projects, ordering, hashes and idempotent repeated seeding. Retain the source and backup outside ephemeral deployments.
5. Configure only local/Preview server variables securely: SUPABASE_DATABASE_URL (restricted runtime login), SUPABASE_URL (exact isolated HTTPS origin), SUPABASE_SERVICE_ROLE_KEY (isolated Storage key), CMS_CACHE_NAMESPACE (unique 1–64 alphanumeric/underscore/hyphen namespace). Existing authentication requires ADMIN_PASSCODE, UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN, using isolated Preview values. None belong in NEXT_PUBLIC variables or committed files. No new credentials should be pasted into chat.
6. After separate push/deployment approval, create a Vercel Preview from the feature branch, scope all variables to Preview, protect the Preview deployment and prevent indexing. Production canonical remains unchanged. Check bundled legacy assets and native Sharp compatibility.
7. Exercise real session login/logout/expiry, save/preview/publish/discard/history/restore, duplicate requests and concurrent independent database connections. Test real private Storage uploads, missing/corrupt objects, direct access denial, CSRF/409/rate-limit failures and service outages. Verify desktop, fresh Incognito and physical iPhone Safari see the same published revision; verify drafts remain private. Measure request latency, decoder memory, response/upload limits and the publication asset-proof window.

Automated local browser tests use a production build, temporary Chrome profiles and mocked admin transport. They do not establish real hosted Storage integration, multi-instance transaction contention, physical Safari behavior or Vercel runtime limits. Existing dependency audit findings from Phase 4 remain outside this phase. Stop for review before Phase 6.
