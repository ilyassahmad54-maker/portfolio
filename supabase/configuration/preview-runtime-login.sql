-- Isolated portfolio-cms-preview only; separately provision password securely.
BEGIN;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='portfolio_cms_preview_app') THEN
  RAISE EXCEPTION 'Runtime login exists; inspect instead of replacing';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='portfolio_cms_runtime'
  AND NOT(rolcanlogin OR rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls)) THEN
  RAISE EXCEPTION 'Runtime group missing or unsafe';
 END IF;
END $$;
CREATE ROLE portfolio_cms_preview_app LOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
GRANT portfolio_cms_runtime TO portfolio_cms_preview_app;
COMMIT;
