-- Phase 1 only. Not applied to any hosted database.
-- Apply once with an approved migration identity; the seed function is retry-safe.
BEGIN;

CREATE ROLE portfolio_cms_owner NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
CREATE ROLE portfolio_cms_runtime NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
CREATE ROLE portfolio_cms_seed NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
-- The migration identity needs ownership-transfer rights, never the runtime login.
DO $$ BEGIN EXECUTE format('GRANT portfolio_cms_owner TO %I', current_user); END $$;
CREATE SCHEMA cms AUTHORIZATION portfolio_cms_owner;
REVOKE ALL ON SCHEMA cms FROM PUBLIC;
SET LOCAL ROLE portfolio_cms_owner;
-- Function EXECUTE is granted to PUBLIC globally by PostgreSQL's default.
-- A per-schema REVOKE cannot undo that global default; this owner is CMS-only.
ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA cms REVOKE ALL ON TABLES FROM PUBLIC;

CREATE FUNCTION cms.valid_format(kind text, value text) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE STRICT SET search_path = pg_catalog, pg_temp AS $$
DECLARE host text;
BEGIN
  IF value ~ '[[:space:][:cntrl:]\\]' THEN RETURN false; END IF;
  CASE kind
    WHEN 'web-link' THEN
      IF value IN ('', '#') THEN RETURN true; END IF;
      host := substring(value FROM '^https://((?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63})(?::443)?(?:[/?#][^[:space:]\\]*)?$');
      RETURN host IS NOT NULL AND host !~* '\.(local|internal)$';
    WHEN 'email' THEN RETURN value ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$';
    WHEN 'social-link' THEN RETURN
      (value LIKE 'https:%' AND cms.valid_format('web-link', value)) OR
      value ~ '^mailto:[A-Za-z0-9.!#$%&''*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' OR
      value ~ '^tel:\+?[0-9()-]{3,30}$';
    WHEN 'formspree' THEN RETURN value ~ '^https://formspree\.io/f/[A-Za-z0-9]+$';
    WHEN 'cv-path' THEN RETURN value = '/cv.pdf' OR value ~ '^/assets/(?:[A-Za-z0-9_-]+/)*[A-Za-z0-9_-]+\.pdf$';
    WHEN 'image-ref' THEN RETURN
      value ~ '^/assets/(?:[A-Za-z0-9_-]+/)*[A-Za-z0-9_-]+\.(png|jpe?g|webp|gif)$' OR
      value ~ '^/api/assets/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
    ELSE RETURN false;
  END CASE;
END $$;

-- Shared JSON Schema subset: object/array/string/number/boolean, limits, enums, formats.
CREATE FUNCTION cms.matches_schema(value jsonb, spec jsonb) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE STRICT SET search_path = pg_catalog, pg_temp AS $$
DECLARE item record; required_key text; text_value text; element jsonb;
BEGIN
  IF jsonb_typeof(value) IS DISTINCT FROM spec->>'type' THEN RETURN false; END IF;
  CASE spec->>'type'
    WHEN 'object' THEN
      FOR required_key IN SELECT jsonb_array_elements_text(spec->'required') LOOP
        IF NOT value ? required_key THEN RETURN false; END IF;
      END LOOP;
      FOR item IN SELECT * FROM jsonb_each(value) LOOP
        IF NOT (spec->'properties') ? item.key OR
           NOT coalesce(cms.matches_schema(item.value, spec->'properties'->item.key), false) THEN RETURN false; END IF;
      END LOOP;
    WHEN 'array' THEN
      IF jsonb_array_length(value) > (spec->>'maxItems')::integer THEN RETURN false; END IF;
      FOR element IN SELECT jsonb_array_elements(value) LOOP
        IF NOT coalesce(cms.matches_schema(element, spec->'items'), false) THEN RETURN false; END IF;
      END LOOP;
    WHEN 'string' THEN
      text_value := value #>> '{}';
      IF char_length(text_value) < coalesce((spec->>'minLength')::integer, 0) OR
         char_length(text_value) > (spec->>'maxLength')::integer THEN RETURN false; END IF;
      IF spec ? 'enum' AND NOT (spec->'enum') ? text_value THEN RETURN false; END IF;
      IF spec ? 'pattern' AND text_value !~ (spec->>'pattern') THEN RETURN false; END IF;
      IF spec ? 'format' AND NOT cms.valid_format(spec->>'format', text_value) THEN RETURN false; END IF;
    WHEN 'number' THEN
      IF (value #>> '{}')::numeric < (spec->>'minimum')::numeric OR
         (value #>> '{}')::numeric > (spec->>'maximum')::numeric THEN RETURN false; END IF;
    WHEN 'boolean' THEN NULL;
    ELSE RETURN false;
  END CASE;
  RETURN true;
END $$;

-- Generated cms.content_schema() is installed by the following migration.
COMMIT;
