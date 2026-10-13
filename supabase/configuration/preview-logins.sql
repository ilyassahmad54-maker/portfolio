-- REVIEW ONLY. Separate approval required. Dedicated isolated Preview project only.
-- Apply after migrations 001–007. Passwords must be set through secure provisioning,
-- never added to this file. Refuse existing identities rather than changing their grants.
BEGIN;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname IN ('portfolio_cms_preview_app','portfolio_cms_preview_seed')) THEN
  RAISE EXCEPTION 'Preview login already exists; review its attributes and memberships manually';
 END IF;
END $$;
CREATE ROLE portfolio_cms_preview_app LOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
CREATE ROLE portfolio_cms_preview_seed LOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
GRANT portfolio_cms_runtime TO portfolio_cms_preview_app;
GRANT portfolio_cms_seed TO portfolio_cms_preview_seed;
COMMIT;
