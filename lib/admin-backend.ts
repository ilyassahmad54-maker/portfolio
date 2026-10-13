import 'server-only';
export type AdminStateBackend = 'redis' | 'postgres';
/** Missing Preview selection is unsafe. Existing non-Preview Redis defaults remain. */
export function adminStateBackend(env:NodeJS.ProcessEnv=process.env):AdminStateBackend {
  const value=env.ADMIN_STATE_BACKEND;
  if(value===undefined){if(env.VERCEL_ENV==='preview'||env.CMS_PREVIEW_AUTH_ENABLED!==undefined)throw new Error('Invalid admin backend');return 'redis';}
  if(value==='redis'){
    if(env.CMS_PREVIEW_AUTH_ENABLED!==undefined)throw new Error('Ambiguous admin backend');
    return 'redis';
  }
  if(value!=='postgres'||env.VERCEL_ENV!=='preview'||env.CMS_PREVIEW_AUTH_ENABLED!=='1'||
    env.UPSTASH_REDIS_REST_URL!==undefined||env.UPSTASH_REDIS_REST_TOKEN!==undefined||env.CMS_PREVIEW_REDIS_HOST!==undefined)throw new Error('Invalid admin backend');
  return 'postgres';
}
