# Controlled cutover execution — 2026-10-14

Status: paused for owner API-key action before any credential revocation. Public launch remains unapproved.

Approved target Supabase `pocnnpfzjxjlyoisnjhp`, Vercel `prj_8LYUIcb6Kk4uWMYf8AV7PbQUf2bc`; original public deployment `dpl_AwGUL8oQZSYUwFSDKy63L6fL4Fb2` preserved. Current publication remains nine projects at revision 24, no draft. Encrypted backup authenticated/decrypted with separate local key; all 34 source checksums and encrypted checksum passed. Owner confirmed off-device copy and billing; no paid operation performed.

Fresh pre-change CMS/auth archive captured outside Git. TypeScript/lint, 130 tests and production build passed. Chromium initially failed under macOS sandbox; approved external rerun passed all three browser tests. Runtime audit zero advisories; existing seven dev/build exceptions unchanged.

**Hosted change completed:** SSL enforcement enabled successfully. Actual restricted transaction-pooler probes passed verified client TLS, database-side TLS and explicit plaintext rejection. No downgrade, RLS change or migration/seed performed.

**Remaining blocker:** Supabase CLI's existing management credential could not be privately accessed through its specific Keychain store for API-key administration. Supported SSL command worked, but no usable management authority was obtained for creating/revoking API keys. Stop rather than bypass credential controls.

Owner next action: Supabase Dashboard → project portfolio-cms-preview → Project Settings → API Keys → create secret key named `portfolio-production-cms`; enter it privately as `SUPABASE_SERVICE_ROLE_KEY` in Vercel portfolio → Settings → Environment Variables → **Production only**. Leave old keys enabled until replacement access is verified. Do not send values in chat. This environment addition is authorized by the staging approval and does not redeploy the current live site. Confirm when done. Legacy-key disable will be coordinated only after new access passes.

No database credential, Storage key, Preview permission, Vercel env or routing change was performed by the agent. No commit/push/main merge/deployment/public promotion occurred. Existing Production passcode and Upstash unchanged. The staged URL is not available yet. Auto-domain assignment remains enabled; guard it before any Git push/merge/staged build. Do not merge or promote automatically.

Resume: inspect new Production env name/scope without values; provision and verify distinct SQL credentials BEFORE revoking old access (latest user requirement supersedes older revoke-first SQL order). Verify new Storage access through the exact staged server. Revoke obsolete Preview SQL/Storage/session access only after replacement and recovery authority verified. Complete staged tests and rollback gates, then request separate public launch approval.


## Resumed after owner installed Production Storage key

Supabase secret `portfolio-production-cms` entered by owner in Vercel Production only; scope/type independently checked, value is sealed. TLS reverified. New restricted SQL login successfully provisioned and audited; current nine-project publication unchanged. Automatic domain assignment disabled and original public alias verified. Production CMS variables added with new SQL credential and original passcode/Upstash untouched. New SQL credential privately preserved outside Git. Preview/legacy access not revoked yet. Staging creation and new-key/Redis authentication verification pending; no public promotion authorized.
