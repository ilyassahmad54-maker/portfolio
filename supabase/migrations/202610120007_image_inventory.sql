BEGIN;
SET LOCAL ROLE portfolio_cms_owner;
CREATE TABLE cms.asset_checks (
  asset_id uuid PRIMARY KEY REFERENCES cms.portfolio_assets(id),
  verified_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE cms.asset_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE cms.asset_checks FORCE ROW LEVEL SECURITY;
CREATE POLICY owner_only ON cms.asset_checks TO portfolio_cms_owner USING(true) WITH CHECK(true);
CREATE TRIGGER immutable_asset_inventory BEFORE UPDATE OR DELETE OR TRUNCATE ON cms.portfolio_assets
FOR EACH STATEMENT EXECUTE FUNCTION cms.reject_revision_mutation();

CREATE FUNCTION cms.register_asset(asset_id uuid, digest text, mime text, size_bytes integer, image_width integer, image_height integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE result jsonb; path text;
BEGIN
  path := asset_id::text || '/' || digest || CASE mime WHEN 'image/jpeg' THEN '.jpg' WHEN 'image/png' THEN '.png' WHEN 'image/webp' THEN '.webp' END;
  INSERT INTO cms.portfolio_assets(id,bucket,object_path,sha256,mime_type,byte_size,width,height)
    VALUES(asset_id,'portfolio-images',path,digest,mime,size_bytes,image_width,image_height);
  INSERT INTO cms.asset_checks(asset_id) VALUES(asset_id);
  RETURN jsonb_build_object('id',asset_id,'path',path,'sha256',digest,'mime',mime,'size',size_bytes,'width',image_width,'height',image_height);
END $$;

CREATE FUNCTION cms.read_asset(asset_id uuid, public_only boolean) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE result jsonb;
BEGIN
  IF public_only IS NULL THEN RAISE EXCEPTION 'Invalid scope' USING ERRCODE='22023'; END IF;
  IF public_only AND NOT EXISTS (
    SELECT 1 FROM cms.portfolio_state s JOIN cms.portfolio_revisions r ON r.id=s.published_revision_id
    WHERE r.content->'profile'->>'profileImage'='/api/assets/'||asset_id::text OR EXISTS (
      SELECT 1 FROM jsonb_array_elements(r.content->'projects') p WHERE p->>'image'='/api/assets/'||asset_id::text
    )
  ) THEN RAISE EXCEPTION 'Asset not found' USING ERRCODE='P0404'; END IF;
  SELECT jsonb_build_object('id',id,'path',object_path,'sha256',sha256,'mime',mime_type,'size',byte_size,'width',width,'height',height)
    INTO result FROM cms.portfolio_assets WHERE id=asset_id;
  IF result IS NULL THEN RAISE EXCEPTION 'Asset not found' USING ERRCODE='P0404'; END IF;
  RETURN result;
END $$;

CREATE FUNCTION cms.confirm_asset(asset_id uuid, digest text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM cms.portfolio_assets WHERE id=asset_id AND sha256=digest) THEN RAISE EXCEPTION 'Asset not found' USING ERRCODE='P0404'; END IF;
  INSERT INTO cms.asset_checks(asset_id) VALUES(asset_id) ON CONFLICT ON CONSTRAINT asset_checks_pkey DO UPDATE SET verified_at=clock_timestamp();
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION cms.assets_publishable(content jsonb) RETURNS boolean
LANGUAGE sql STABLE STRICT SET search_path=pg_catalog,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM cms.legacy_assets WHERE path=content->'profile'->>'cvUrl') AND NOT EXISTS (
  SELECT 1 FROM (SELECT content->'profile'->>'profileImage' AS path UNION ALL SELECT p->>'image' FROM jsonb_array_elements(content->'projects') p) refs
  WHERE NOT EXISTS(SELECT 1 FROM cms.legacy_assets a WHERE a.path=refs.path)
    AND NOT EXISTS(SELECT 1 FROM cms.portfolio_assets a WHERE refs.path='/api/assets/'||a.id::text)
 );
$$;
CREATE FUNCTION cms.require_recent_assets() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,pg_temp AS $$
BEGIN
 IF NEW.operation IN ('publish','restore') AND EXISTS (
  SELECT 1 FROM (SELECT NEW.content->'profile'->>'profileImage' AS path UNION ALL SELECT p->>'image' FROM jsonb_array_elements(NEW.content->'projects') p) refs
  WHERE refs.path LIKE '/api/assets/%' AND NOT EXISTS (
   SELECT 1 FROM cms.portfolio_assets a JOIN cms.asset_checks c ON c.asset_id=a.id
   WHERE refs.path='/api/assets/'||a.id::text AND c.verified_at > clock_timestamp()-interval '30 seconds'
  )
 ) THEN RAISE EXCEPTION 'Asset verification expired' USING ERRCODE='22023'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER verify_publication_assets BEFORE INSERT ON cms.portfolio_revisions FOR EACH ROW EXECUTE FUNCTION cms.require_recent_assets();
REVOKE ALL ON cms.asset_checks FROM PUBLIC,portfolio_cms_runtime,portfolio_cms_seed;
REVOKE ALL ON FUNCTION cms.register_asset(uuid,text,text,integer,integer,integer),cms.read_asset(uuid,boolean),cms.confirm_asset(uuid,text),cms.require_recent_assets() FROM PUBLIC,portfolio_cms_runtime,portfolio_cms_seed;
GRANT EXECUTE ON FUNCTION cms.register_asset(uuid,text,text,integer,integer,integer),cms.read_asset(uuid,boolean),cms.confirm_asset(uuid,text) TO portfolio_cms_runtime;
RESET ROLE;
COMMIT;
