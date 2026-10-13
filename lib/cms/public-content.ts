import 'server-only';
import { cache } from 'react';
import baseline from '../../data.json';
import { validatePortfolio } from './validation';
import { redis } from '../admin';
import { cmsStore, decodePublished } from './store';
import { requirePublishableAssets } from './assets';
import type { PublishedSnapshot } from './contracts';
import { CmsUnavailable } from './errors';
import { adminStateBackend } from '../admin-backend';

export interface PublicContent {
  content: PublishedSnapshot['content']; revisionId: string | null; sequence: number | null;
  source: 'database' | 'last-known-published' | 'fallback'; readOnly: boolean;
}
interface PublishedCache { read(): Promise<unknown>; write(snapshot: PublishedSnapshot): Promise<void> }
export function createPublishedReader(read: () => Promise<PublishedSnapshot>, backup: PublishedCache, log: (category:string)=>void = () => {}, requireDatabase = () => process.env.VERCEL_ENV === 'preview' || process.env.CMS_REQUIRE_DATABASE === '1') {
  return async ():Promise<PublicContent> => {
    try {
      const snapshot=decodePublished(await read()); requirePublishableAssets(snapshot.content);
      try { await backup.write(snapshot); } catch { log('backup_unavailable'); }
      return {...snapshot,source:'database',readOnly:false};
    } catch {
      log('database_unavailable');
      // Hosted integration must fail visibly, never pass using deployment/Redis data.
      if(requireDatabase())throw new CmsUnavailable('database');
      try {
        const snapshot=decodePublished(await backup.read()); requirePublishableAssets(snapshot.content);
        return {...snapshot,source:'last-known-published',readOnly:true};
      } catch {
        validatePortfolio(baseline);
        return {content:baseline,revisionId:null,sequence:null,source:'fallback',readOnly:true};
      }
    }
  };
}
function cacheKey() {
  const namespace=process.env.CMS_CACHE_NAMESPACE || 'portfolio';
  if(!/^[a-zA-Z0-9_-]{1,64}$/.test(namespace))throw new Error('Invalid cache namespace');
  return `portfolio:cms:published:${namespace}`;
}
// Published-only shared durable backup. Older in-flight reads cannot overwrite newer revisions.
const backup:PublishedCache={
  read:async()=>{if(adminStateBackend()==='postgres')throw new CmsUnavailable('database');const raw=await redis(['GET',cacheKey()]);if(typeof raw!=='string')throw new Error();return JSON.parse(raw);},
  write:async snapshot=>{if(adminStateBackend()==='postgres')return;await redis(['EVAL',"local old=redis.call('GET',KEYS[1]); if old and tonumber(cjson.decode(old).sequence)>tonumber(ARGV[1]) then return 2 end; redis.call('SET',KEYS[1],ARGV[2]); return 1",1,cacheKey(),snapshot.sequence,JSON.stringify(snapshot)]);},
};
export const readPublicContent=createPublishedReader(()=>cmsStore.published(),backup,category=>console.error(JSON.stringify({event:'cms_public',category})));
// One request snapshot for SEO and rendered body; no browser/session/device-specific data.
export const getPublicContent=cache(readPublicContent);
