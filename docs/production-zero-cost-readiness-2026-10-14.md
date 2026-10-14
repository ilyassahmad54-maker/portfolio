# $0 CMS promotion readiness — 2026-10-14

**Recommendation: conditional GO for the approval-gated cutover procedure; NO-GO for immediate public promotion. Risk: moderate.** Preparation passes. Hosted credential revocation, platform SSL enforcement, modern Storage-key integration and staged Production Redis smoke testing remain execution gates. Nothing has been deployed, committed, pushed, merged or changed in hosted credentials/settings during this preparation.

This is the authoritative plan. It supersedes the separate paid Production-project proposal, all import/seed instructions, and the earlier production deployment checklist. Reuse `pocnnpfzjxjlyoisnjhp` in place. Do not create a project, buy a service, run migrations 001–008, register existing assets again, copy existing objects back into their bucket, or seed any content. Old private `seed-current-published.sql`, `register-published-assets.sql` and `RELEASE-STEPS.md` are historical and MUST NOT be executed for this promotion.

## Verified publication and deployment

Fresh read-only capture at 18:12 UTC confirms revision `9d1c6846-4d59-42ef-8d16-587dbad47cd7`, sequence **24**, state version **27**, **nine projects**, no saved draft. Full content canonical SHA256 is `134b502f8bce38446cebdb5710011e28d1ecafe50cddaab0b4bc4afa3e2f46b1`, identical to the prior tested publication. Climate Change is first, Unemployment second, RiskRadar third, Multimodal fourth; other project ordering and every profile/CV/education/experience/skills/certification/contact/link field are preserved.

- Climate Change image: `/api/assets/2998124e-9543-4a97-b48f-f756c8daeb14`, 1,610,994 bytes, SHA256 `f7d3cef4e845a4abe43e50a7f639d96c0d360f48f0621d53827202e7ae5bdbef`.
- Updated Multimodal: `/api/assets/0bfdbee9-bceb-46b7-885d-cb114195b849`, 2,405,410 bytes, SHA256 `61fb2820ee994d66ae82f2b4c1908b8489990c305b1f268749a4995f16744d61`.
- Corrected RiskRadar: `/assets/riskradar-6b4d1ab9f5bdadbcf9ae.jpg`; Unemployment legacy image, profile image and CV all rehashed successfully from current references.
- Entire private bucket: **14 objects / 4,018,108 bytes**, all downloaded and content hashes matched filenames. Private bucket, exact JPEG/PNG/WebP whitelist and 4 MiB limit are verified by the adapter; restrictive anon/authenticated policies on both Storage tables remain installed.
- Current database size: **11,925,171 bytes**. Application/seed groups and owners are restricted, with no superuser/BYPASSRLS; app and seed logins have separate group membership.
- Preview https://portfolio-isdejr326-ilyassahmad54-maker.vercel.app is READY at `5bb2c7deb3c6163e5db48eb208b5d2169c841f70`, feature branch. Protected HTTP returns 302; no bypass credentials were created. Recent 50-minute runtime query returned zero application log records, which is not a new traffic/lifecycle test.
- Local and remote feature HEAD remain `5bb2c7d`; main `ef4f651f26fb582e0ed24e0c16601b95dc48c342` is included in feature history. There is now one small uncommitted Storage compatibility fix plus its regression test. Final released commit must include it and be recorded after approval; current Preview does not contain that fix.

## Test evidence and code change

Current local checks: TypeScript, lint, production build and asset checks pass; **114 CMS + 11 authentication + 2 content + 3 browser tests = 130 passed** (auth/content ran before the Storage-only change; CMS/browser/build reran afterward). The new regression proves modern opaque `sb_secret_` keys are sent only as `apikey` on both bucket/object GET and upload POST; legacy JWT credentials retain Bearer compatibility. It follows current Supabase guidance and changes neither styling nor content. Actual modern-key hosted access requires the approved creation of that key and remains a staging gate, not a claimed completed check.

Existing successful evidence is reused without repeating hosted mutations: nine-project Preview draft/preview/publish/upload/history/restore/idempotency/conflict/logout lifecycle; actual isolated Upstash REST sessions, expiration, logout, concurrent rate limiting and CMS/cache Lua; physical iPhone login/upload/draft/preview/publish/cross-device/Climate publication attested by user. Preview session wall-clock one-hour expiry was not newly observed. Redis server TTL and shortened synthetic-session expiry passed. Production Redis was not mutated or load-tested.

Runtime dependency audit remains **zero advisories**. Seven related high dev/build-tool findings remain the documented exception (unpatched braces chain, absent from runtime traces); no suppressions or forced dependency upgrades. Recheck by 2026-10-28. Relevant evidence remains under `docs/production-readiness/evidence/`.

## Credential inventory and isolation

Read-only Vercel inventory is complete: **17 deployments: seven CMS Preview and ten historical Production**. Exact IDs/URLs/commits and current environment names/scopes are in [inventory](production-readiness/evidence/zero-cost-inventory.json). Treat all seven CMS Preview deployments as retaining the old credentials: immutable deployment secrets cannot be disproved through metadata alone.

Current branch-only Preview settings contain ten keys, including Preview app SQL URI, legacy Storage service-role JWT, Preview PostgreSQL auth flags and Preview passcode. Current Production has only its existing sensitive passcode and two Upstash variables; all remain unchanged and Production-only. Old seed credentials and migration administrator credentials also exist in the private operator store, outside Git. No seed/migration login belongs in Vercel.

SQL promotion plan: [zero-cost-cutover.sql](production-readiness/zero-cost-cutover.sql). It refuses execution without an explicit session approval flag, refuses replacing an existing Production login, revokes Preview runtime/seed memberships, sets both old logins NOLOGIN with passwords removed, removes all Preview-auth privileges from the shared runtime group, invalidates Preview SQL sessions, and creates a new restricted Production app role initially NOLOGIN. Provision its unique password privately, then enable LOGIN. No seed role is needed for promotion. Platform postgres remains an operator-only credential; do not rotate platform credentials unnecessarily or deploy them.

Password changes/NOLOGIN alone do not terminate pooled connections. Commit permission revocations, terminate only old app/seed role sessions with supported admin authority, confirm termination and no in-flight mutations, then recheck publication/hash. If authority is insufficient, STOP for the owner; never grant elevated rights to the app. Local rehearsal restores the fresh CMS archive with original owners/ACLs, executes the plan, proves the former Preview identity cannot read CMS, proves new Production identity has the exact twelve CMS functions and no Preview-auth authority, and verifies all nine content records unchanged. This is local PGlite evidence, not execution on hosted Supabase.

Storage requires separate revocation. Create one uniquely named Production `sb_secret_` key through **Supabase → Project Settings → API Keys**. Keep variable name `SUPABASE_SERVICE_ROLE_KEY` because the existing runbook/code expects it. Test new key's bucket metadata and protected object delivery, then disable legacy JWT-based `anon`/`service_role` API keys using the supported Dashboard control/Management API. Merely generating a new key does NOT revoke old keys. Inventory other consumers first; stop if unrelated applications depend on these keys. Do not guess a legacy-JWT-secret rotation endpoint: current Supabase docs recommend new keys plus explicit legacy-key disabling. Verify the OLD key is denied (no upload/delete attempt necessary), and the new key works. Never weaken bucket policies/RLS.

Remove all ten branch-specific Preview env entries after freeze/revocation; no hosted Preview may receive future Production secrets. Existing immutable Preview deployments can stay inaccessible/broken or be removed separately with approval; database + Storage revocation is the authoritative security boundary. Local privileged credentials remain privately managed, not in source or hosted runtime. Preserve Production Redis/passcode and existing Redis sessions; invalidate only obsolete PostgreSQL Preview sessions, never flush Redis.

## Production environment checklist (values never recorded)

Production scope ONLY; never All Environments or Preview:

| Name | Configuration |
| --- | --- |
| `ADMIN_PASSCODE` | Preserve existing Production value; confirm code's >=20-character requirement through staged login without displaying it |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Preserve existing Production values |
| `ADMIN_STATE_BACKEND` | `redis` |
| `SUPABASE_DATABASE_URL` | Same project, NEW `portfolio_cms_production_app` credential; correct pooler username includes project ref, encoded password, no query/fragment; no admin/seed identity |
| `SUPABASE_DATABASE_CA` | Trusted CA for actual endpoint; certificate and hostname verification remain required |
| `SUPABASE_URL` | `https://pocnnpfzjxjlyoisnjhp.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | NEW named Production server secret key; no legacy Preview JWT |
| `CMS_CACHE_NAMESPACE` | `production-portfolio-cms` |
| `CMS_REQUIRE_DATABASE` | `1` — mandatory to prevent old eight-project data.json fallback |
| Preview flags, seed/migration credentials, integration/bypass settings | ABSENT, including empty `CMS_PREVIEW_AUTH_ENABLED` |
| `VERCEL_ENV`, `NODE_ENV` | Vercel-managed Production; never spoof Preview |
| `NEXT_PUBLIC_*` | No credentials, database URI, passcode, Redis or Storage secret |

PostgreSQL Preview auth is deliberately unsupported in Production. Redis sessions, Lua-based distributed rate limiting and cache sequence behavior must be tested on the exact staged build with preserved Production variables. Do not disable the Preview integration harness's Production guard. New public namespace does not rename existing Redis auth keys.

## $0 feasibility and accepted limitations

No second project/service/subscription is required. Vercel currently reports **Hobby**. Supabase Free supports 500 MB database, 1 GB Storage and 5 GB uncached plus 5 GB cached egress; present DB and Storage sizes are comfortably below those limits. Current architecture is feasible at **$0 additional monthly infrastructure subscription cost**, within quotas. No billing-plan upgrade or add-on is authorized. Existing Supabase organization/Upstash account billing and current egress totals were not exposed by available credentials: owner must confirm existing Free plans/usage caps before claiming an unconditional $0 invoice. Existing PAYG Redis, if applicable, could charge more with extra traffic; stop rather than silently accept paid usage.

Free Supabase may pause after seven days of low activity, lacks automatic database backups/PITR and offers no paid availability guarantee. Quota exhaustion, shared compute latency, manual unpause/recovery, short log retention and loss of independent hosted Preview remain accepted risks. No artificial keepalive, paid IPv4, branching, PITR or paid monitoring is proposed. Strict DB mode protects content correctness but causes visible safe unavailability during a pause/outage rather than serving the old eight-project fixture.

Sources: [Supabase pricing](https://supabase.com/pricing), [Free pausing](https://supabase.com/docs/guides/platform/free-project-pausing), [Upstash pricing](https://upstash.com/pricing/redis), [API keys](https://supabase.com/docs/guides/getting-started/api-keys), [legacy key disabling](https://supabase.com/docs/reference/api/v1-update-project-legacy-api-keys).

## Backups and recovery

Fresh backup: `/Users/mac/Desktop/portfolio-cms-backups/portfolio-cms-plan-pD0ZW9/zero-cost-promotion-20261014-pKYnGG` (outside Git, directories 700/files 600). It preserves published JSON/canonical hash/asset metadata, all referenced local images/profile/CV, all fourteen bucket objects, CMS + Preview-auth custom archive, full database archive, checksum manifest and local restore/cutover evidence. No password or environment configuration file is bundled; authentication data in SQL archives is still sensitive. Earlier backups are retained unchanged.

Fresh CMS archive restored locally: nine tables, 161 rows, 24 revisions, fourteen assets, nine published projects; owners, ACLs, FORCE RLS and restricted runtime audit passed. The full platform archive is a supplementary capture, not a claim that managed Supabase schemas can safely be overwritten or locally restored. Custom role passwords and platform configuration require separate secure operator records. Object bytes are separately archived because database dumps do not contain them.

Recovery procedure: verify every file hash; rehearse the CMS archive locally with original roles/ACLs and compare exact publication/content hash; inventory missing/corrupt bucket objects against the fourteen-object manifest; restore only missing bytes via supported Storage API with no upsert and verify hashes. For content mistakes prefer CMS History/Restore, which creates a revision. Do not import old JSON or reset the CMS. For serious database damage freeze writes, preserve a new incident archive, review a transactional CMS-only restore against the local rehearsal, obtain separate destructive-restore approval and restore with supported administrator authority. Never blindly pg_restore --clean against the live database/managed schemas; an old archive must not reactivate Preview credentials or sessions.

Keep an encrypted off-device copy using existing owner-controlled storage (no purchase); this copy and an automated schedule are NOT yet established. Operating requirement: checksum-verified database + full object backup after important publications and before releases, at least weekly; retain latest + four weekly copies, test restores monthly, monitor backup egress within Free quota. RPO is last successful manual backup; RTO includes owner availability and provider unpause/restore. A local-only backup cannot survive loss of this Mac.

Application rollback: preserve existing Production `dpl_AwGUL8oQZSYUwFSDKy63L6fL4Fb2` and verify Hobby immediate-previous-production eligibility before promotion. Vercel rollback restores old application/build env, not database, Storage or project env settings. Old public site may show eight legacy projects while all nine CMS projects remain safe in Supabase. Keep Preview credentials revoked, Production app credentials private, and the database intact. Do not roll back by restoring old Preview access. [Vercel rollback](https://vercel.com/docs/instant-rollback).

## Exact final execution order — not executed

1. Obtain final approval covering the actions below and Free-tier/build-tool exceptions. Privately confirm current Supabase/Upstash Free billing/quotas; stop on any charge requirement. Record current domain/deployment/branch settings, original Production env metadata and rollback eligibility. Copy backup off-device.
2. Review/commit/push only approved Storage fix, regression and safe release docs to feature; record new SHA. Before any main merge, disable automatic Production domain assignment so the old Production site remains served while staging. Remove Preview database/Storage env delivery before any branch push that could create another credential-bearing deployment. Do not change Production Redis/passcode.
3. Agree a short CMS editing freeze; close Preview editor tabs without touching mobile localStorage. Re-read revision/state; if publication or draft changed, preserve it and refresh backups instead of overwriting it. Capture final DB + all objects and verify hashes. Never use current data.json as content source.
4. Verify project reference, supported admin authority and all key consumers. Enable platform SSL enforcement in Database Settings (brief restart), wait for health, test verified TLS with exact runtime endpoint and confirm non-TLS connections denied. Check internal pooler-to-database security separately; if not enforceable/verified, STOP rather than misrepresenting transport security or buying a service.
5. Run reviewed guarded role/session cutover plan with explicit approval setting; revoke old app/seed membership/password/login, remove Preview auth privileges/sessions, terminate old pooled connections. Recheck content hash after outstanding work stops. Privately provision unique Production app password and enable its login; confirm all runtime audit gates. Never execute migrations/seed.
6. Create new named server Storage secret; use supported read-only requests to verify new key and existing bucket limits/privacy. Disable legacy keys, verify old key is denied and new key still delivers current bytes. Remove remaining Preview settings and operator use of retired credentials; confirm all seven old Preview deployment paths cannot mutate SQL or Storage. Any failure is a stop gate. No objects are deleted or rewritten.
7. Add the Production-only CMS environment settings above, preserving existing passcode/Upstash; inspect scopes and browser bundle for secret exposure. Ensure runtime project/role and Storage origin match. Production remains on old static build.
8. Merge reviewed feature into main only with approval and controlled domain assignment. Build one Production/staged deployment using Production env (CLI --prod --skip-domain or supported Dashboard staging); record exact new commit/build. Do not promote yet; keep Vercel's existing public domain on old Production.
9. On exact staged build, user privately logs in with existing Production passcode. Verify Redis-backed sessions/logout/expiry/CSRF, all nine projects/images/CV/contact/SEO, protected upload and draft/history/restore. Because database is shared, publishing tests affect the future live content: freeze edits, use captured current nine-project snapshot, label test-owned changes, restore exact original content, recheck full hash and never overwrite an unrelated newer edit. No Production Redis load/outage simulation. Use local fault-injection evidence for outages. Confirm desktop/iPhone synchronization and new secret-key GET/POST behavior. No Production-guard bypass in old Preview harness.
10. Capture post-validation backup/checksums and runtime logs; confirm original content, no unrelated draft, retired credentials denied, quotas and rollback availability. Only then promote the exact staged deployment to the existing public domain. Smoke-test nine projects/images/admin/logout/CV/contact on both devices. If checks fail, rollback the application to recorded previous Production and retain DB/objects/credential revocations.
11. Record final release SHA/deployment/revision and establish manual backup owner/schedule. Future Preview must use local isolated services or explicitly separate resources later; never reconnect old Preview builds to this database.

## Approval gate

Minimum approval: **Approve the $0 same-project cutover, new restricted Production app credential and new Storage key, revocation of old Preview database/Storage credentials and PostgreSQL sessions, SSL enforcement restart, removal of Preview env access, Production-only CMS variable additions preserving Production Redis/passcode, reviewed commit/push/merge, staged deployment/testing and public promotion only after all gates pass; authorize application rollback if validation fails. No paid resources or destructive data restore.**

Remaining owner interaction: confirm existing billing is Free/capped, keep an encrypted off-device backup, and privately enter the existing Production admin passcode during staged smoke testing. If API-key controls require owner Dashboard authentication, use Project Settings → API Keys; never paste keys in chat. No final release action is authorized by this report alone.

## Final gate verification update

Read-only recheck at 18:25–18:26 UTC: revision 24 / nine projects / unchanged full content hash, no draft; current fourteen-object bucket exactly matches the encrypted backup's object paths, sizes and SHA256 values. Database/role/environment-scope inventory unchanged; Vercel remains Hobby. Image/authentication regression suite rerun: 26 passed. Source, docs and browser-output scans found none of the known database/passcode/Storage/Vercel/encryption-recovery secrets.

An AES-256-GCM encrypted ~11 MB off-device package is now prepared outside Git, with its 256-bit recovery key stored separately. Saved recovery utility was actually executed successfully; wrong-key rejection and checksum checks passed. Location and non-secret evidence: `production-readiness/evidence/encrypted-backup.json`. Off-device transfer itself remains owner action, not a completed claim.

The current checklist has been rewritten for same-project reuse, removing obsolete new-project/seed instructions. [Exact approval-gated commands and manual checks](production-cutover-commands.md) now cover reviewed Git changes, credential transition, supported SSL update, staging, bounded verification, promotion and rollback; installed Vercel CLI flags were checked locally.

**Decision remains NO-GO for public launch.** Preparation is complete within authorized scope. Billing cannot be independently confirmed because no authenticated billing dashboard is exposed; the exact owner checks are in the command sheet. Owner must confirm Free plans/usage and separate off-device archive/key copies. Production SSL enforcement, new credentials/old-key revocation, exact staged Production Redis/new-key smoke and rollback eligibility remain approval-gated execution checks. No hosted mutation, commit, push, merge or deployment occurred. Production Upstash compatibility is supported by real isolated REST evidence; existing Production token SET/DEL/EVAL permissions cannot be proved without authorized bounded writes and must not be represented as already tested.


## Owner confirmations and final approval checkpoint

Owner has checked Supabase and Upstash billing and confirmed no additional paid subscriptions are required; encrypted recovery backup is saved off Mac with key stored separately. These owner confirmations close the manual preparation blockers. Destination copy/billing dashboard were not independently accessed by the agent. The $0 objective remains subject to current usage quotas; no paid action is permitted.

Read-only final check at 18:34 UTC confirms exact public domain/project/original Production deployment, current nine-project revision 24 with no draft, current content equal to backup, all 34 backup-file checksums and encrypted archive checksum valid, and original Production env metadata unchanged. Vercel Production branch is main and automatic custom-domain assignment is enabled, which must be disabled under approval before merge. No new Production CMS credentials exist yet; seven old Preview deployments retain access until the reviewed revocations happen.

**Final recommendation: GO to the approval-gated execution procedure, risk moderate. Public promotion remains gated on actual hosted TLS, credential revocation/denial, new-key/Production Redis staged smoke and viable post-staging rollback.** Backup recovery and isolated Redis compatibility passed; destructive restore is not authorized. Existing Production rollback target is recorded and still serves the public domain, but Hobby eligibility must be checked after staging. Application rollback cannot reverse SQL/Storage/env/credential changes and may serve eight legacy projects while preserving all nine in the database.

No hosted credential, SSL, Production environment, Git commit/push/main or deployment changes were made. Final release approval is explicitly pending. See the current [command sheet](production-cutover-commands.md).
