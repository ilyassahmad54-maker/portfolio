-- ISOLATED PREVIEW ONLY. Apply only after separate hosted approval, after CMS 001–007.
-- Deliberately outside the Production/CMS migration directory. One-time DDL.
BEGIN;
CREATE ROLE portfolio_preview_auth_owner NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
DO $$ BEGIN EXECUTE format('GRANT portfolio_preview_auth_owner TO %I',current_user); END $$;
CREATE SCHEMA preview_auth AUTHORIZATION portfolio_preview_auth_owner;
REVOKE ALL ON SCHEMA preview_auth FROM PUBLIC;
SET LOCAL ROLE portfolio_preview_auth_owner;
ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
CREATE TABLE preview_auth.sessions(
 token_sha256 text PRIMARY KEY CHECK(token_sha256 ~ '^[0-9a-f]{64}$'),
 credential_sha256 text NOT NULL CHECK(credential_sha256 ~ '^[0-9a-f]{64}$'),
 expires_at timestamptz NOT NULL
);
CREATE INDEX sessions_expiry ON preview_auth.sessions(expires_at);
CREATE TABLE preview_auth.rate_buckets(
 operation text NOT NULL, scope text NOT NULL CHECK(scope IN ('ip','session')),
 subject_sha256 text NOT NULL CHECK(subject_sha256 ~ '^[0-9a-f]{64}$'),
 attempts integer NOT NULL CHECK(attempts>0), expires_at timestamptz NOT NULL,
 PRIMARY KEY(operation,scope,subject_sha256)
);
CREATE INDEX rate_expiry ON preview_auth.rate_buckets(expires_at);
ALTER TABLE preview_auth.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE preview_auth.sessions FORCE ROW LEVEL SECURITY;
ALTER TABLE preview_auth.rate_buckets ENABLE ROW LEVEL SECURITY;
ALTER TABLE preview_auth.rate_buckets FORCE ROW LEVEL SECURITY;
CREATE POLICY owner_only ON preview_auth.sessions TO portfolio_preview_auth_owner USING(true) WITH CHECK(true);
CREATE POLICY owner_only ON preview_auth.rate_buckets TO portfolio_preview_auth_owner USING(true) WITH CHECK(true);

CREATE FUNCTION preview_auth.create_session(token_hash text,credential_hash text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
BEGIN
 INSERT INTO preview_auth.sessions VALUES(token_hash,credential_hash,clock_timestamp()+interval '1 hour');
 RETURN 'true'::jsonb;
END $$;
CREATE FUNCTION preview_auth.read_session(token_hash text) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
 SELECT to_jsonb(credential_sha256) FROM preview_auth.sessions WHERE token_sha256=token_hash AND expires_at>statement_timestamp();
$$;
CREATE FUNCTION preview_auth.revoke_session(token_hash text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE affected integer;
BEGIN
 DELETE FROM preview_auth.sessions WHERE token_sha256=token_hash;
 GET DIAGNOSTICS affected=ROW_COUNT; RETURN to_jsonb(affected);
END $$;
CREATE FUNCTION preview_auth.consume_rate(action text,ip_hash text,session_hash text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET lock_timeout='3s' AS $$
DECLARE maximum integer; seconds integer:=60; result integer; second_count integer;
BEGIN
 maximum:=CASE action WHEN 'login' THEN 5 WHEN 'published' THEN 120 WHEN 'draft' THEN 120
 WHEN 'preview' THEN 120 WHEN 'state' THEN 120 WHEN 'save' THEN 30 WHEN 'publish' THEN 5
 WHEN 'discard' THEN 10 WHEN 'history' THEN 60 WHEN 'revision' THEN 60 WHEN 'restore' THEN 5
 WHEN 'upload' THEN 10 WHEN 'asset' THEN 240 WHEN 'assetPreview' THEN 120 END;
 IF maximum IS NULL OR ip_hash IS NULL OR ip_hash !~ '^[0-9a-f]{64}$' OR
  (action IN ('login','published','asset') AND session_hash IS NOT NULL) OR
  (action NOT IN ('login','published','asset') AND (session_hash IS NULL OR session_hash !~ '^[0-9a-f]{64}$')) THEN
  RAISE EXCEPTION 'Invalid rate request' USING ERRCODE='22023';
 END IF;
 IF action='login' THEN seconds:=900; END IF;
 -- Lock IP before session for every operation; one function call is one transaction.
 INSERT INTO preview_auth.rate_buckets AS b VALUES(action,'ip',ip_hash,1,clock_timestamp()+make_interval(secs=>seconds))
 ON CONFLICT(operation,scope,subject_sha256) DO UPDATE SET
  attempts=CASE WHEN b.expires_at<=clock_timestamp() THEN 1 ELSE least(b.attempts+1,maximum+1) END,
  expires_at=CASE WHEN b.expires_at<=clock_timestamp() THEN clock_timestamp()+make_interval(secs=>seconds) ELSE b.expires_at END
 RETURNING attempts INTO result;
 IF session_hash IS NOT NULL THEN
  INSERT INTO preview_auth.rate_buckets AS b VALUES(action,'session',session_hash,1,clock_timestamp()+make_interval(secs=>seconds))
  ON CONFLICT(operation,scope,subject_sha256) DO UPDATE SET
   attempts=CASE WHEN b.expires_at<=clock_timestamp() THEN 1 ELSE least(b.attempts+1,maximum+1) END,
   expires_at=CASE WHEN b.expires_at<=clock_timestamp() THEN clock_timestamp()+make_interval(secs=>seconds) ELSE b.expires_at END
  RETURNING attempts INTO second_count;
  result:=greatest(result,second_count);
 END IF;
 RETURN to_jsonb(result);
END $$;
-- Owner-only maintenance. Expiry correctness never depends on running cleanup.
CREATE FUNCTION preview_auth.purge_expired(batch_size integer) RETURNS void
LANGUAGE plpgsql SET search_path=pg_catalog,pg_temp AS $$
BEGIN
 IF batch_size IS NULL OR batch_size<1 OR batch_size>5000 THEN RAISE EXCEPTION 'Invalid batch' USING ERRCODE='22023'; END IF;
 DELETE FROM preview_auth.sessions WHERE token_sha256 IN(SELECT token_sha256 FROM preview_auth.sessions WHERE expires_at<=clock_timestamp() LIMIT batch_size);
 DELETE FROM preview_auth.rate_buckets WHERE (operation,scope,subject_sha256) IN(SELECT operation,scope,subject_sha256 FROM preview_auth.rate_buckets WHERE expires_at<=clock_timestamp() LIMIT batch_size);
END $$;
REVOKE ALL ON ALL TABLES IN SCHEMA preview_auth FROM PUBLIC,portfolio_cms_runtime,portfolio_cms_seed;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA preview_auth FROM PUBLIC,portfolio_cms_runtime,portfolio_cms_seed;
GRANT USAGE ON SCHEMA preview_auth TO portfolio_cms_runtime;
GRANT EXECUTE ON FUNCTION preview_auth.create_session(text,text),preview_auth.read_session(text),
 preview_auth.revoke_session(text),preview_auth.consume_rate(text,text,text) TO portfolio_cms_runtime;
COMMIT;
