-- PLAN ONLY. Requires final release approval. NOT a migration or a seed.
-- Operator must verify project pocnnpfzjxjlyoisnjhp, freeze editing, and back up first.
-- Set custom session setting cms.cutover_approved = 'yes' ONLY after approval.
BEGIN;
DO $$ BEGIN
 IF current_setting('cms.cutover_approved',true) IS DISTINCT FROM 'yes' THEN
  RAISE EXCEPTION 'Final cutover approval required';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='portfolio_cms_production_app' AND rolcanlogin AND NOT(rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls)) OR NOT pg_has_role('portfolio_cms_production_app','portfolio_cms_runtime','USAGE') THEN
  RAISE EXCEPTION 'Verified restricted Production login required before revocation';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='portfolio_cms_runtime'
  AND NOT(rolcanlogin OR rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls)) THEN
  RAISE EXCEPTION 'Runtime group missing or unsafe';
 END IF;
END $$;
-- Membership revocation also removes authority from already-connected Preview clients.
ALTER ROLE portfolio_cms_preview_app NOLOGIN PASSWORD NULL;
REVOKE portfolio_cms_runtime FROM portfolio_cms_preview_app;
ALTER ROLE portfolio_cms_preview_seed NOLOGIN PASSWORD NULL;
REVOKE portfolio_cms_seed FROM portfolio_cms_preview_seed;
-- Production uses Redis; no PostgreSQL Preview authentication privileges are needed.
SET LOCAL ROLE portfolio_preview_auth_owner;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA preview_auth FROM portfolio_cms_runtime;
REVOKE USAGE ON SCHEMA preview_auth FROM portfolio_cms_runtime;
DELETE FROM preview_auth.sessions;
RESET ROLE;
-- Production login already provisioned and verified; never recreate it here.
COMMIT;
-- After commit, use supported admin authority to terminate ONLY connections whose
-- pg_stat_activity.usename is portfolio_cms_preview_app or portfolio_cms_preview_seed.
-- Check termination success and recheck publication/hash after in-flight work ends.
-- Privately provision a new unique Production password, then enable LOGIN.
-- Never put that password in SQL files, shell arguments, command history or reports.
