BEGIN;
SET LOCAL ROLE portfolio_cms_owner;

CREATE FUNCTION cms.valid_content(content jsonb) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE STRICT SET search_path = pg_catalog, pg_temp AS $$
DECLARE section text; total integer; distinct_total integer;
BEGIN
  IF octet_length(content::text) > 1048576 OR NOT cms.matches_schema(content, cms.content_schema()) THEN RETURN false; END IF;
  FOREACH section IN ARRAY ARRAY['skills','experience','projects','education','certifications'] LOOP
    SELECT count(*), count(DISTINCT item->>'id') INTO total, distinct_total FROM jsonb_array_elements(content->section) item;
    IF total <> distinct_total THEN RETURN false; END IF;
  END LOOP;
  SELECT count(*), count(DISTINCT item->>'platform') INTO total, distinct_total FROM jsonb_array_elements(content->'socialLinks') item;
  RETURN total = distinct_total;
END $$;

CREATE TABLE cms.portfolio_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
  content jsonb NOT NULL CHECK (cms.valid_content(content)),
  content_sha256 text NOT NULL CHECK (content_sha256 ~ '^[0-9a-f]{64}$'),
  schema_version integer NOT NULL DEFAULT 1 CHECK (schema_version = 1),
  operation text NOT NULL CHECK (operation IN ('seed','draft','publish','restore')),
  source_revision_id uuid REFERENCES cms.portfolio_revisions(id),
  request_id uuid UNIQUE,
  actor_label text NOT NULL CHECK (char_length(actor_label) BETWEEN 1 AND 100),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE cms.portfolio_state (
  id text PRIMARY KEY DEFAULT 'portfolio' CHECK (id = 'portfolio'),
  published_revision_id uuid NOT NULL REFERENCES cms.portfolio_revisions(id),
  draft_revision_id uuid NOT NULL REFERENCES cms.portfolio_revisions(id),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE cms.portfolio_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket text NOT NULL CHECK (bucket = 'portfolio-images'),
  object_path text NOT NULL UNIQUE,
  sha256 text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  mime_type text NOT NULL CHECK (mime_type IN ('image/jpeg','image/png','image/webp')),
  byte_size integer NOT NULL CHECK (byte_size BETWEEN 1 AND 4194304),
  width integer NOT NULL CHECK (width BETWEEN 1 AND 8192),
  height integer NOT NULL CHECK (height BETWEEN 1 AND 8192),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (width::bigint * height <= 40000000),
  CHECK (object_path = id::text || '/' || sha256 || CASE mime_type WHEN 'image/jpeg' THEN '.jpg' WHEN 'image/png' THEN '.png' WHEN 'image/webp' THEN '.webp' END)
);

CREATE TABLE cms.migration_ledger (
  migration_id text PRIMARY KEY,
  source_sha256 text NOT NULL CHECK (source_sha256 ~ '^[0-9a-f]{64}$'),
  seed_revision_id uuid NOT NULL REFERENCES cms.portfolio_revisions(id),
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE FUNCTION cms.hash_revision() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, pg_temp AS $$
BEGIN
  NEW.content_sha256 := encode(sha256(convert_to(NEW.content::text, 'UTF8')), 'hex');
  RETURN NEW;
END $$;
CREATE TRIGGER revision_checksum BEFORE INSERT ON cms.portfolio_revisions
FOR EACH ROW EXECUTE FUNCTION cms.hash_revision();

CREATE FUNCTION cms.reject_revision_mutation() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, pg_temp AS $$
BEGIN RAISE EXCEPTION 'CMS revisions and migration records are immutable' USING ERRCODE = '55000'; END $$;
CREATE TRIGGER immutable_revisions BEFORE UPDATE OR DELETE OR TRUNCATE ON cms.portfolio_revisions
FOR EACH STATEMENT EXECUTE FUNCTION cms.reject_revision_mutation();
CREATE TRIGGER immutable_migrations BEFORE UPDATE OR DELETE OR TRUNCATE ON cms.migration_ledger
FOR EACH STATEMENT EXECUTE FUNCTION cms.reject_revision_mutation();

CREATE FUNCTION cms.check_state() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, pg_temp AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cms.portfolio_revisions WHERE id = NEW.published_revision_id AND operation IN ('seed','publish','restore')) THEN
    RAISE EXCEPTION 'Published pointer must reference a published snapshot' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.version <> OLD.version + 1 THEN
    RAISE EXCEPTION 'State version must advance exactly once' USING ERRCODE = '23514';
  END IF;
  NEW.updated_at := now(); RETURN NEW;
END $$;
CREATE TRIGGER validate_state BEFORE INSERT OR UPDATE ON cms.portfolio_state
FOR EACH ROW EXECUTE FUNCTION cms.check_state();

ALTER TABLE cms.portfolio_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cms.portfolio_revisions FORCE ROW LEVEL SECURITY;
ALTER TABLE cms.portfolio_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE cms.portfolio_state FORCE ROW LEVEL SECURITY;
ALTER TABLE cms.portfolio_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE cms.portfolio_assets FORCE ROW LEVEL SECURITY;
ALTER TABLE cms.migration_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE cms.migration_ledger FORCE ROW LEVEL SECURITY;
CREATE POLICY owner_only ON cms.portfolio_revisions TO portfolio_cms_owner USING (true) WITH CHECK (true);
CREATE POLICY owner_only ON cms.portfolio_state TO portfolio_cms_owner USING (true) WITH CHECK (true);
CREATE POLICY owner_only ON cms.portfolio_assets TO portfolio_cms_owner USING (true) WITH CHECK (true);
CREATE POLICY owner_only ON cms.migration_ledger TO portfolio_cms_owner USING (true) WITH CHECK (true);

CREATE FUNCTION cms.seed_published(canonical_source text, expected_sha256 text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
DECLARE payload jsonb; existing cms.migration_ledger%ROWTYPE; revision uuid;
BEGIN
  -- Serializes initializers, including simultaneous deployment retries.
  PERFORM pg_advisory_xact_lock(713401, 1);
  IF octet_length(canonical_source) > 1048576 OR
     encode(sha256(convert_to(canonical_source, 'UTF8')), 'hex') IS DISTINCT FROM expected_sha256 THEN
    RAISE EXCEPTION 'Seed source checksum or size invalid' USING ERRCODE = '22023';
  END IF;
  payload := canonical_source::jsonb;
  IF NOT coalesce(cms.valid_content(payload), false) THEN RAISE EXCEPTION 'Seed content invalid' USING ERRCODE = '22023'; END IF;
  SELECT * INTO existing FROM cms.migration_ledger WHERE migration_id = 'published-data-json-v1';
  IF FOUND THEN
    IF existing.source_sha256 <> expected_sha256 OR NOT EXISTS (
      SELECT 1 FROM cms.portfolio_revisions WHERE id = existing.seed_revision_id AND content = payload AND operation = 'seed'
    ) OR NOT EXISTS (SELECT 1 FROM cms.portfolio_state WHERE id = 'portfolio') THEN
      RAISE EXCEPTION 'Seed conflicts with existing migration state' USING ERRCODE = '55000';
    END IF;
    RETURN existing.seed_revision_id;
  END IF;
  IF EXISTS (SELECT 1 FROM cms.portfolio_state) OR EXISTS (SELECT 1 FROM cms.portfolio_revisions) THEN
    RAISE EXCEPTION 'Refusing to overwrite pre-existing CMS content' USING ERRCODE = '55000';
  END IF;
  INSERT INTO cms.portfolio_revisions(content, operation, actor_label) VALUES (payload, 'seed', 'published-data.json') RETURNING id INTO revision;
  INSERT INTO cms.portfolio_state(published_revision_id, draft_revision_id) VALUES (revision, revision);
  INSERT INTO cms.migration_ledger(migration_id, source_sha256, seed_revision_id) VALUES ('published-data-json-v1', expected_sha256, revision);
  RETURN revision;
END $$;

CREATE FUNCTION cms.read_published() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
  SELECT jsonb_build_object('revisionId', r.id, 'sequence', r.sequence, 'version', s.version, 'content', r.content)
  FROM cms.portfolio_state s JOIN cms.portfolio_revisions r ON r.id = s.published_revision_id WHERE s.id = 'portfolio';
$$;

-- No direct table/sequence access, anonymous API access, or runtime seed permission.
REVOKE ALL ON ALL TABLES IN SCHEMA cms FROM PUBLIC, portfolio_cms_runtime, portfolio_cms_seed;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA cms FROM PUBLIC, portfolio_cms_runtime, portfolio_cms_seed;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA cms FROM PUBLIC, portfolio_cms_runtime, portfolio_cms_seed;
GRANT USAGE ON SCHEMA cms TO portfolio_cms_runtime, portfolio_cms_seed;
GRANT EXECUTE ON FUNCTION cms.read_published() TO portfolio_cms_runtime;
GRANT EXECUTE ON FUNCTION cms.seed_published(text, text) TO portfolio_cms_seed;
RESET ROLE;
COMMIT;
