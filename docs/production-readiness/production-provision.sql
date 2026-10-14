-- Approved staging provisioning only. No migrations, seed or content changes.
BEGIN;
DO $$ BEGIN
 IF current_setting('cms.cutover_approved',true) IS DISTINCT FROM 'yes' THEN RAISE EXCEPTION 'Cutover approval required'; END IF;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='portfolio_cms_production_app') THEN RAISE EXCEPTION 'Existing Production role; inspect rather than replace'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='portfolio_cms_runtime' AND NOT(rolcanlogin OR rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls)) THEN RAISE EXCEPTION 'Unsafe runtime group'; END IF;
END $$;
CREATE ROLE portfolio_cms_production_app NOLOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
GRANT portfolio_cms_runtime TO portfolio_cms_production_app;
COMMIT;
-- Password privately provisioned and login verified BEFORE Preview revocation.
