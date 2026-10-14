# $0 same-project Production deployment checklist

Current authority: [readiness report](production-zero-cost-readiness-2026-10-14.md) and [exact commands and owner actions](production-cutover-commands.md). This replaces the obsolete separate-project checklist. **NO-GO for public launch until the gates below pass. Nothing hosted has been changed.**

- [x] Existing project selected: `pocnnpfzjxjlyoisnjhp`; no new project, paid service, migration replay or seed required.
- [x] Current publication rechecked: revision 24, nine projects, Climate Change/current Multimodal/correct RiskRadar preserved; no draft overwritten.
- [x] Database + fourteen-object backups checksum-verified; CMS restore and credential-transition SQL rehearsed locally.
- [x] AES-256-GCM encrypted off-device package prepared; decrypt round-trip and wrong-key rejection verified; recovery key kept separately outside Git.
- [x] Owner confirmed encrypted package copied off Mac and recovery key stored separately; destination bytes not independently accessed.
- [x] Vercel Hobby confirmed; Production-only existing passcode and Upstash variable scopes preserved.
- [x] Owner checked Supabase/Upstash billing and confirmed no additional paid subscriptions required. No upgrades or paid usage authorized; stay within current quotas.
- [x] Storage-key fix security reviewed; relevant image/auth tests passed (26); prior full checks: 130 tests, TypeScript/lint/build passed.
- [x] Runtime advisory audit zero; seven build-tool findings documented as exception, no suppression.
- [x] Real isolated Redis session/TTL/logout/Lua/rate tests passed; Production read-only unknown-session check passed. No Production writes/load test.
- [ ] Separate final release approval obtained, including TLS restart, credential changes, env setup, Git/release actions and application rollback authority.
- [ ] Freeze editing, preserve newer content/drafts and capture final backup.
- [ ] Stop new Preview secret delivery before push; preserve original Production deployment/public domain until staged build passes.
- [ ] Enable SSL enforcement, wait healthy; exact endpoint verify-full and expected non-TLS denial verified; required internal-hop encryption checked.
- [ ] Guarded SQL plan executed: Preview app/seed membership/password/login revoked, obsolete Preview SQL sessions invalidated, old pooled connections terminated; publication unchanged.
- [ ] New Production app password privately provisioned; exact twelve-function runtime audit passes, no Preview-auth/direct-table/elevated privileges.
- [ ] New server Storage key verified; obsolete legacy keys disabled after consumer inventory; old-key denial/new-key success confirmed.
- [ ] All seven historical CMS Preview deployments' retained credentials unusable for SQL and Storage; no Preview Production secrets.
- [ ] Production-only variables set from readiness table; existing Production passcode/Upstash unchanged; strict database mode enabled; Preview/test/seed flags absent.
- [ ] Reviewed commit/push/merge completed only after approval; Production auto-domain assignment controlled; exact released SHA recorded.
- [ ] Exact Production-staged build READY; existing live site still on old deployment; actual Production Redis token/session/Lua permissions and new Storage key verified via bounded CMS smoke.
- [ ] Staged nine-project/image/CV/contact/security/lifecycle/mobile tests pass; test-owned edits restored exactly; no unrelated draft overwritten; fresh post-test backup verified.
- [ ] Rollback target and Hobby eligibility rechecked AFTER staging; no public promotion without viable rollback.
- [ ] Approved exact staged build promoted, public desktop/iPhone smoke and safe runtime-log review passed.
- [ ] Manual backup owner/frequency/retention accepted; Free pause/quota/no-PITR/no-independent-Preview risks accepted.

Rollback does not restore database/Storage/project env. Preserve nine-project data and credential revocations; old application may temporarily display its eight-project legacy content. No destructive data restore is included in release approval.
