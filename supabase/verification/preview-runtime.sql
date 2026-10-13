-- Read-only catalog audit executed as the actual restricted Preview runtime login.
SELECT jsonb_build_object(
 'runtimeMembershipOnly', NOT EXISTS(SELECT 1 FROM pg_roles r WHERE r.rolname<>current_user
   AND r.rolname<>'portfolio_cms_runtime' AND pg_has_role(current_user,r.oid,'MEMBER')),
 'noDatabaseOwnershipOrCreate', NOT has_database_privilege(current_user,current_database(),'CREATE')
   AND NOT EXISTS(SELECT 1 FROM pg_database WHERE datname=current_database() AND datdba=(SELECT oid FROM pg_roles WHERE rolname=current_user)),
 'tablesProtected', (SELECT count(*)=7 AND bool_and(c.relrowsecurity AND c.relforcerowsecurity)
   FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='cms' AND c.relkind='r'),
 'noDirectWrites', NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='cms' AND c.relkind='r' AND
   (has_table_privilege(current_user,c.oid,'SELECT') OR has_table_privilege(current_user,c.oid,'INSERT') OR has_table_privilege(current_user,c.oid,'UPDATE') OR has_table_privilege(current_user,c.oid,'DELETE') OR has_table_privilege(current_user,c.oid,'TRUNCATE'))),
 'noSequenceAccess', NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='cms' AND c.relkind='S' AND (has_sequence_privilege(current_user,c.oid,'USAGE') OR has_sequence_privilege(current_user,c.oid,'UPDATE'))),
 'noSchemaCreate', NOT has_schema_privilege(current_user,'cms','CREATE'),
 'noClientSchemaAccess', NOT has_schema_privilege('anon','cms','USAGE') AND NOT has_schema_privilege('authenticated','cms','USAGE'),
 'runtimeFunctionsExact', (SELECT count(*)=12 AND bool_and(p.oid=ANY(ARRAY[
   'cms.read_published()'::regprocedure,'cms.read_draft()'::regprocedure,'cms.read_state()'::regprocedure,
   'cms.save_draft(jsonb,bigint,uuid)'::regprocedure,'cms.publish_draft(bigint,uuid,uuid)'::regprocedure,
   'cms.discard_draft(bigint,uuid,boolean,uuid)'::regprocedure,'cms.list_revisions(integer,bigint)'::regprocedure,
   'cms.read_revision(uuid)'::regprocedure,'cms.restore_publication(uuid,bigint,uuid)'::regprocedure,
   'cms.register_asset(uuid,text,text,integer,integer,integer)'::regprocedure,
   'cms.read_asset(uuid,boolean)'::regprocedure,'cms.confirm_asset(uuid,text)'::regprocedure]))
   FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='cms' AND has_function_privilege(current_user,p.oid,'EXECUTE')),
 'definerOwnersRestricted', NOT EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_roles r ON r.oid=p.proowner
   WHERE n.nspname='cms' AND p.prosecdef AND (r.rolname<>'portfolio_cms_owner' OR r.rolsuper OR r.rolbypassrls OR NOT ('search_path=pg_catalog, pg_temp'=ANY(p.proconfig))))
) AS result;
