-- REVIEW ONLY: separate approval required before applying to an isolated hosted project.
-- Storage schema/built-in roles belong to Supabase, not the CMS migration owner.
-- FIRST create the private bucket through the Supabase Dashboard/Storage API:
-- portfolio-images; 4194304 bytes; JPEG, PNG, WebP only. Never insert Storage
-- metadata directly. This script verifies configuration and installs policies.
BEGIN;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM storage.buckets WHERE id='portfolio-images' AND NOT public
   AND file_size_limit=4194304 AND allowed_mime_types @> ARRAY['image/jpeg','image/png','image/webp']::text[]
   AND allowed_mime_types <@ ARRAY['image/jpeg','image/png','image/webp']::text[]) THEN
  RAISE EXCEPTION 'Existing bucket configuration does not match policy; review manually';
 END IF;
END $$;
-- Restrictive policies also deny access if another permissive policy already exists.
CREATE POLICY portfolio_images_no_client_access ON storage.objects AS RESTRICTIVE
FOR ALL TO anon,authenticated USING(bucket_id <> 'portfolio-images') WITH CHECK(bucket_id <> 'portfolio-images');
CREATE POLICY portfolio_images_no_client_bucket_access ON storage.buckets AS RESTRICTIVE
FOR ALL TO anon,authenticated USING(id <> 'portfolio-images') WITH CHECK(id <> 'portfolio-images');
COMMIT;
