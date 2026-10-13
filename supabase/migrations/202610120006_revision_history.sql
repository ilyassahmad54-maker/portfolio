BEGIN;
SET LOCAL ROLE portfolio_cms_owner;
ALTER TABLE cms.operation_receipts DROP CONSTRAINT operation_receipts_operation_check;
ALTER TABLE cms.operation_receipts ADD CONSTRAINT operation_receipts_operation_check CHECK (operation IN ('save','publish','discard','restore'));

-- Keyset pagination, descending immutable sequence. No actor/request identifiers exposed.
CREATE FUNCTION cms.list_revisions(page_size integer, before_sequence bigint) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
DECLARE items jsonb; next_cursor bigint;
BEGIN
  IF page_size IS NULL OR page_size < 1 OR page_size > 50 OR (before_sequence IS NOT NULL AND (before_sequence < 1 OR before_sequence > 9007199254740991)) THEN
    RAISE EXCEPTION 'Invalid pagination' USING ERRCODE='22023';
  END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object('revisionId',id,'sequence',sequence,'createdAt',created_at,'operation',operation) ORDER BY sequence DESC),'[]'::jsonb)
  INTO items FROM (SELECT id,sequence,created_at,operation FROM cms.portfolio_revisions WHERE before_sequence IS NULL OR sequence < before_sequence ORDER BY sequence DESC LIMIT page_size) r;
  SELECT min((item->>'sequence')::bigint) INTO next_cursor FROM jsonb_array_elements(items) item;
  IF NOT EXISTS (SELECT 1 FROM cms.portfolio_revisions WHERE sequence < next_cursor) THEN next_cursor := NULL; END IF;
  RETURN jsonb_build_object('items',items,'nextCursor',next_cursor,'state',cms.state_snapshot());
END $$;

CREATE FUNCTION cms.read_revision(revision_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
DECLARE result jsonb;
BEGIN
  IF revision_id IS NULL THEN RAISE EXCEPTION 'Invalid revision' USING ERRCODE='22023'; END IF;
  SELECT jsonb_build_object('revisionId',id,'sequence',sequence,'createdAt',created_at,'operation',operation,'content',content,'state',cms.state_snapshot()) INTO result FROM cms.portfolio_revisions WHERE id=revision_id;
  IF result IS NULL THEN RAISE EXCEPTION 'Revision not found' USING ERRCODE='P0404'; END IF;
  RETURN result;
END $$;

CREATE FUNCTION cms.restore_publication(target_revision uuid, expected_version bigint, idempotency_key uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp SET lock_timeout = '3s' AS $$
DECLARE state cms.portfolio_state%ROWTYPE; receipt cms.operation_receipts%ROWTYPE; target cms.portfolio_revisions%ROWTYPE;
  fingerprint text; revision uuid; result jsonb;
BEGIN
  IF target_revision IS NULL OR idempotency_key IS NULL OR expected_version IS NULL OR expected_version < 1 OR expected_version > 9007199254740990 THEN
    RAISE EXCEPTION 'Invalid restore' USING ERRCODE='22023';
  END IF;
  fingerprint := encode(sha256(convert_to(jsonb_build_object('action','restore','version',expected_version,'target',target_revision)::text,'UTF8')),'hex');
  SELECT * INTO state FROM cms.portfolio_state WHERE id='portfolio' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'CMS not initialized' USING ERRCODE='55000'; END IF;
  SELECT * INTO receipt FROM cms.operation_receipts WHERE request_id=idempotency_key;
  IF FOUND THEN
    IF receipt.operation <> 'restore' OR receipt.fingerprint <> fingerprint THEN RAISE EXCEPTION 'Idempotency conflict' USING ERRCODE='P0409'; END IF;
    RETURN receipt.result || jsonb_build_object('replayed',true);
  END IF;
  IF state.version <> expected_version THEN RAISE EXCEPTION 'Stale version' USING ERRCODE='P0409'; END IF;
  SELECT * INTO target FROM cms.portfolio_revisions WHERE id=target_revision;
  IF NOT FOUND THEN RAISE EXCEPTION 'Revision not found' USING ERRCODE='P0404'; END IF;
  IF target.operation NOT IN ('seed','publish','restore') OR NOT coalesce(cms.valid_content(target.content),false) OR NOT coalesce(cms.assets_publishable(target.content),false) THEN
    RAISE EXCEPTION 'Revision cannot be restored' USING ERRCODE='22023';
  END IF;
  INSERT INTO cms.portfolio_revisions(content,operation,source_revision_id,request_id,actor_label)
    VALUES(target.content,'restore',target.id,idempotency_key,'authenticated-admin') RETURNING id INTO revision;
  -- Preserve an independent saved draft; a clean draft follows the new publication.
  UPDATE cms.portfolio_state SET published_revision_id=revision,
    draft_revision_id=CASE WHEN state.draft_revision_id=state.published_revision_id THEN revision ELSE state.draft_revision_id END,
    version=version+1 WHERE id='portfolio';
  result := jsonb_build_object('state',cms.state_snapshot(),'revisionId',revision,'replayed',false);
  INSERT INTO cms.operation_receipts(request_id,operation,fingerprint,result) VALUES(idempotency_key,'restore',fingerprint,result);
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION cms.list_revisions(integer,bigint),cms.read_revision(uuid),cms.restore_publication(uuid,bigint,uuid) FROM PUBLIC,portfolio_cms_seed,portfolio_cms_runtime;
GRANT EXECUTE ON FUNCTION cms.list_revisions(integer,bigint),cms.read_revision(uuid),cms.restore_publication(uuid,bigint,uuid) TO portfolio_cms_runtime;
RESET ROLE;
COMMIT;
