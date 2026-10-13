-- PREPARED ONLY. Run after separately approved 001–008, before login provisioning/seeding.
\set ON_ERROR_STOP on
\pset pager off
BEGIN READ ONLY;
SELECT current_database(), current_user, current_setting('server_version'),
  current_setting('transaction_read_only');
SELECT rolname,rolcanlogin,rolsuper,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls
FROM pg_roles WHERE rolname IN ('portfolio_cms_owner','portfolio_cms_runtime',
 'portfolio_cms_seed','portfolio_preview_auth_owner') ORDER BY rolname;
SELECT nspname,pg_get_userbyid(nspowner) AS owner FROM pg_namespace
WHERE nspname IN ('cms','preview_auth') ORDER BY nspname;
SELECT n.nspname,c.relname,pg_get_userbyid(c.relowner) AS owner,
 c.relrowsecurity,c.relforcerowsecurity,
 has_table_privilege('portfolio_cms_runtime',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE') AS runtime_any_table_access
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname IN ('cms','preview_auth') AND c.relkind='r' ORDER BY 1,2;
SELECT n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) AS signature,
 pg_get_userbyid(p.proowner) AS owner,p.prosecdef,p.proconfig,
 has_function_privilege('portfolio_cms_runtime',p.oid,'EXECUTE') AS runtime_execute,
 has_function_privilege('portfolio_cms_seed',p.oid,'EXECUTE') AS seed_execute,
 EXISTS(SELECT 1 FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
 WHERE a.grantee=0 AND a.privilege_type='EXECUTE') AS public_execute
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname IN ('cms','preview_auth') ORDER BY 1,2,3;
SELECT schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check
FROM pg_policies WHERE schemaname IN ('cms','preview_auth') ORDER BY 1,2,3;
SELECT 'cms.portfolio_revisions' AS table_name,count(*) AS rows FROM cms.portfolio_revisions
UNION ALL SELECT 'cms.portfolio_state',count(*) FROM cms.portfolio_state
UNION ALL SELECT 'cms.portfolio_assets',count(*) FROM cms.portfolio_assets
UNION ALL SELECT 'cms.migration_ledger',count(*) FROM cms.migration_ledger
UNION ALL SELECT 'cms.operation_receipts',count(*) FROM cms.operation_receipts
UNION ALL SELECT 'cms.asset_checks',count(*) FROM cms.asset_checks
UNION ALL SELECT 'cms.legacy_assets',count(*) FROM cms.legacy_assets
UNION ALL SELECT 'preview_auth.sessions',count(*) FROM preview_auth.sessions
UNION ALL SELECT 'preview_auth.rate_buckets',count(*) FROM preview_auth.rate_buckets;
SELECT path,sha256,byte_size FROM cms.legacy_assets ORDER BY path;
SELECT parent.rolname AS granted_role,child.rolname AS member,
 m.admin_option,m.inherit_option,m.set_option FROM pg_auth_members m
JOIN pg_roles parent ON parent.oid=m.roleid JOIN pg_roles child ON child.oid=m.member
WHERE parent.rolname LIKE 'portfolio_%' OR child.rolname LIKE 'portfolio_%' ORDER BY 1,2;
COMMIT;
