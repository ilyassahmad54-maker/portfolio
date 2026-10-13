-- PREPARED ONLY. Requires separate restricted seed-login provisioning approval.
-- Target: portfolio-cms-preview / pocnnpfzjxjlyoisnjhp only.
-- Does not provision a runtime login or application session.
-- Provision a distinct random password securely after creation; never add it here.
BEGIN;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='portfolio_cms_seed'
   AND NOT (rolcanlogin OR rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls)) THEN
  RAISE EXCEPTION 'Restricted seed group is missing or unsafe';
 END IF;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='portfolio_cms_preview_seed') THEN
  RAISE EXCEPTION 'Seed login already exists; inspect instead of replacing';
 END IF;
END $$;
CREATE ROLE portfolio_cms_preview_seed LOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
GRANT portfolio_cms_seed TO portfolio_cms_preview_seed;
COMMIT;
