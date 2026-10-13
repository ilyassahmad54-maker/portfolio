import 'server-only';
import { CmsUnavailable } from './errors';
import { adminStateBackend } from '../admin-backend';

/** Non-secret allowlists pin Preview to the separately provisioned resources. */
export function assertPreviewConfiguration(env:NodeJS.ProcessEnv=process.env) {
  if(env.VERCEL_ENV!=='preview')return;
  try {
    const ref=env.CMS_PREVIEW_PROJECT_REF,redisHost=env.CMS_PREVIEW_REDIS_HOST;
    const backend=adminStateBackend(env);
    if(!ref || !/^[a-z0-9]{20}$/.test(ref) ||
      !/^preview-[A-Za-z0-9_-]{1,56}$/.test(env.CMS_CACHE_NAMESPACE||''))throw new Error();
    const database=new URL(env.SUPABASE_DATABASE_URL!);
    if(env.SUPABASE_URL!==`https://${ref}.supabase.co` ||
      !(database.hostname===`db.${ref}.supabase.co` || (database.hostname.endsWith('.pooler.supabase.com') && decodeURIComponent(database.username).endsWith(`.${ref}`))))throw new Error();
    if(backend==='redis'){
      if(!redisHost||!/^[a-z0-9.-]+\.upstash\.io$/.test(redisHost))throw new Error();
      const redis=new URL(env.UPSTASH_REDIS_REST_URL!);
      if(redis.protocol!=='https:'||redis.hostname!==redisHost||redis.port)throw new Error();
    }
  } catch {throw new CmsUnavailable('configuration');}
}
