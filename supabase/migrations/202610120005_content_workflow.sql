BEGIN;
SET LOCAL ROLE portfolio_cms_owner;

-- Receipts make saves, publications and discards retry-safe without rewriting history.
CREATE TABLE cms.operation_receipts (
  request_id uuid PRIMARY KEY,
  operation text NOT NULL CHECK (operation IN ('save','publish','discard')),
  fingerprint text NOT NULL CHECK (fingerprint ~ '^[0-9a-f]{64}$'),
  result jsonb NOT NULL CHECK (jsonb_typeof(result) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE cms.operation_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cms.operation_receipts FORCE ROW LEVEL SECURITY;
CREATE POLICY owner_only ON cms.operation_receipts TO portfolio_cms_owner USING (true) WITH CHECK (true);
CREATE TRIGGER immutable_receipts BEFORE UPDATE OR DELETE OR TRUNCATE ON cms.operation_receipts
FOR EACH STATEMENT EXECUTE FUNCTION cms.reject_revision_mutation();

CREATE FUNCTION cms.assets_publishable(content jsonb) RETURNS boolean
LANGUAGE sql STABLE STRICT SET search_path = pg_catalog, pg_temp AS $$
  -- Phase 2 admits only verified, deployable baseline images/CV. Storage references
  -- are blocked until the upload and asset-delivery verification workflow exists.
  SELECT NOT EXISTS (
    SELECT 1 FROM (
      SELECT content->'profile'->>'profileImage' AS path
      UNION ALL SELECT project->>'image' FROM jsonb_array_elements(content->'projects') project
      UNION ALL SELECT content->'profile'->>'cvUrl'
    ) refs WHERE refs.path IS NULL OR NOT EXISTS (SELECT 1 FROM cms.legacy_assets a WHERE a.path = refs.path)
  );
$$;

CREATE FUNCTION cms.state_snapshot() RETURNS jsonb
LANGUAGE sql STABLE SET search_path = pg_catalog, pg_temp AS $$
  SELECT jsonb_build_object(
    'version', s.version, 'publishedRevisionId', s.published_revision_id,
    'draftRevisionId', s.draft_revision_id, 'updatedAt', s.updated_at,
    'hasDraft', d.content IS DISTINCT FROM p.content
  ) FROM cms.portfolio_state s
  JOIN cms.portfolio_revisions d ON d.id = s.draft_revision_id
  JOIN cms.portfolio_revisions p ON p.id = s.published_revision_id WHERE s.id = 'portfolio';
$$;

CREATE FUNCTION cms.read_state() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
DECLARE result jsonb;
BEGIN
  result := cms.state_snapshot();
  IF result IS NULL THEN RAISE EXCEPTION 'CMS not initialized' USING ERRCODE = '55000'; END IF;
  RETURN result;
END $$;

CREATE FUNCTION cms.read_draft() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
DECLARE result jsonb;
BEGIN
  SELECT jsonb_build_object('state', cms.state_snapshot(), 'revisionId', r.id, 'content', r.content)
  INTO result FROM cms.portfolio_state s JOIN cms.portfolio_revisions r ON r.id = s.draft_revision_id WHERE s.id = 'portfolio';
  IF result IS NULL THEN RAISE EXCEPTION 'CMS not initialized' USING ERRCODE = '55000'; END IF;
  RETURN result;
END $$;

-- One private implementation, exposed only through the three typed wrappers below.
CREATE FUNCTION cms.change_content(action text, expected_version bigint, expected_draft uuid, payload jsonb, confirmation boolean, idempotency_key uuid) RETURNS jsonb
LANGUAGE plpgsql SET search_path = pg_catalog, pg_temp SET lock_timeout = '3s' AS $$
DECLARE state cms.portfolio_state%ROWTYPE; receipt cms.operation_receipts%ROWTYPE;
  fingerprint text; revision uuid; draft_content jsonb; result jsonb;
BEGIN
  IF action NOT IN ('save','publish','discard') OR action IS NULL OR
     expected_version IS NULL OR expected_version < 1 OR expected_version > 9007199254740990 OR idempotency_key IS NULL THEN
    RAISE EXCEPTION 'Invalid workflow request' USING ERRCODE = '22023';
  END IF;
  IF action = 'save' AND (payload IS NULL OR NOT coalesce(cms.valid_content(payload), false)) THEN
    RAISE EXCEPTION 'Invalid portfolio document' USING ERRCODE = '22023';
  END IF;
  IF action <> 'save' AND expected_draft IS NULL THEN RAISE EXCEPTION 'Draft revision required' USING ERRCODE = '22023'; END IF;
  IF action = 'discard' AND confirmation IS DISTINCT FROM true THEN RAISE EXCEPTION 'Discard confirmation required' USING ERRCODE = '22023'; END IF;
  fingerprint := encode(sha256(convert_to(jsonb_build_object('action',action,'version',expected_version,'draft',expected_draft,'content',payload,'confirm',confirmation)::text,'UTF8')),'hex');
  -- Lock first, then re-check both receipt and version. All writers serialize here.
  SELECT * INTO state FROM cms.portfolio_state WHERE id = 'portfolio' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'CMS not initialized' USING ERRCODE = '55000'; END IF;
  SELECT * INTO receipt FROM cms.operation_receipts WHERE request_id = idempotency_key;
  IF FOUND THEN
    IF receipt.operation <> action OR receipt.fingerprint <> fingerprint THEN
      RAISE EXCEPTION 'Idempotency key conflict' USING ERRCODE = 'P0409';
    END IF;
    RETURN receipt.result || jsonb_build_object('replayed', true);
  END IF;
  IF state.version <> expected_version OR (action <> 'save' AND state.draft_revision_id <> expected_draft) THEN
    RAISE EXCEPTION 'Stale content version' USING ERRCODE = 'P0409';
  END IF;

  IF action = 'save' THEN
    IF NOT cms.assets_publishable(payload) THEN RAISE EXCEPTION 'Unverified asset reference' USING ERRCODE = '22023'; END IF;
    INSERT INTO cms.portfolio_revisions(content,operation,source_revision_id,request_id,actor_label)
      VALUES (payload,'draft',state.draft_revision_id,idempotency_key,'authenticated-admin') RETURNING id INTO revision;
    UPDATE cms.portfolio_state SET draft_revision_id=revision, version=version+1 WHERE id='portfolio';
  ELSIF action = 'publish' THEN
    SELECT content INTO draft_content FROM cms.portfolio_revisions WHERE id=state.draft_revision_id;
    IF NOT coalesce(cms.valid_content(draft_content), false) OR NOT coalesce(cms.assets_publishable(draft_content), false) THEN
      RAISE EXCEPTION 'Draft cannot be published' USING ERRCODE = '22023';
    END IF;
    INSERT INTO cms.portfolio_revisions(content,operation,source_revision_id,request_id,actor_label)
      VALUES (draft_content,'publish',state.draft_revision_id,idempotency_key,'authenticated-admin') RETURNING id INTO revision;
    UPDATE cms.portfolio_state SET published_revision_id=revision, draft_revision_id=revision, version=version+1 WHERE id='portfolio';
  ELSE
    revision := state.published_revision_id;
    UPDATE cms.portfolio_state SET draft_revision_id=published_revision_id, version=version+1 WHERE id='portfolio';
  END IF;
  result := jsonb_build_object('state',cms.state_snapshot(),'revisionId',revision,'replayed',false);
  INSERT INTO cms.operation_receipts(request_id,operation,fingerprint,result) VALUES(idempotency_key,action,fingerprint,result);
  RETURN result;
END $$;

CREATE FUNCTION cms.save_draft(content jsonb, expected_version bigint, request_id uuid) RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
  SELECT cms.change_content('save', expected_version, NULL, content, NULL, request_id);
$$;
CREATE FUNCTION cms.publish_draft(expected_version bigint, draft_revision_id uuid, request_id uuid) RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
  SELECT cms.change_content('publish', expected_version, draft_revision_id, NULL, NULL, request_id);
$$;
CREATE FUNCTION cms.discard_draft(expected_version bigint, draft_revision_id uuid, confirmed boolean, request_id uuid) RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
  SELECT cms.change_content('discard', expected_version, draft_revision_id, NULL, confirmed, request_id);
$$;

REVOKE ALL ON cms.operation_receipts FROM PUBLIC, portfolio_cms_runtime, portfolio_cms_seed;
REVOKE ALL ON FUNCTION cms.assets_publishable(jsonb), cms.state_snapshot(),
  cms.change_content(text,bigint,uuid,jsonb,boolean,uuid), cms.read_draft(), cms.read_state(),
  cms.save_draft(jsonb,bigint,uuid), cms.publish_draft(bigint,uuid,uuid), cms.discard_draft(bigint,uuid,boolean,uuid)
  FROM PUBLIC, portfolio_cms_runtime, portfolio_cms_seed;
GRANT EXECUTE ON FUNCTION cms.read_draft(), cms.read_state(), cms.save_draft(jsonb,bigint,uuid),
  cms.publish_draft(bigint,uuid,uuid), cms.discard_draft(bigint,uuid,boolean,uuid) TO portfolio_cms_runtime;
RESET ROLE;
COMMIT;
