-- READ ONLY. Run only after separate approval, as the isolated migration identity.
-- No credentials, tokens, session rows or connection strings are selected.
SELECT current_setting('server_version_num')::integer >= 150000 AS supported_version,
  r.rolcreaterole AS can_create_roles,
  has_database_privilege(current_user,current_database(),'CREATE') AS can_create_schema,
  NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname IN
    ('portfolio_cms_owner','portfolio_cms_runtime','portfolio_cms_seed',
     'portfolio_preview_auth_owner','portfolio_cms_preview_app','portfolio_cms_preview_seed')) AS fresh_role_names,
  NOT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname IN ('cms','preview_auth')) AS fresh_schema_names,
  to_regprocedure('pg_catalog.sha256(bytea)') IS NOT NULL AS core_sha256,
  to_regprocedure('pg_catalog.gen_random_uuid()') IS NOT NULL AS core_uuid,
  EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') AND
  EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') AS storage_client_roles
FROM pg_roles r WHERE r.rolname=current_user;

-- Policy DDL requires ownership or ability to assume an owning role. False is a
-- blocker for this SQL identity, not authorization to alter managed ownership.
SELECT c.relname, pg_get_userbyid(c.relowner) AS owner,
  pg_has_role(current_user,c.relowner,'USAGE') AS inherits_owner_rights,
  pg_has_role(current_user,c.relowner,'MEMBER') AS owner_membership_review,
  c.relrowsecurity AS rls_enabled
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='storage' AND c.relname IN ('buckets','objects');

-- Must be empty before fresh policy installation. Existing policies require
-- definition review instead of DROP/recreation or blindly rerunning migrations.
SELECT tablename,policyname,permissive,roles,cmd,qual,with_check
FROM pg_policies WHERE schemaname='storage'
  AND policyname IN ('portfolio_images_no_client_access','portfolio_images_no_client_bucket_access');
