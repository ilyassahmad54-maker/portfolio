import 'server-only';
import { readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import manifest from './legacy-assets.json';
import { createHash } from 'node:crypto';
import { queryCms } from './database';
import { imageStorage, type ImageStorage } from './storage';
import { CmsUnavailable, CmsHttpError } from './errors';
import type { PortfolioData } from '../../types/portfolio';
export interface Asset { id:string; path:string; sha256:string; mime:string; size:number; width:number; height:number }
export function decodeAsset(value:unknown):Asset {
  const a=value as Asset;
  if(!a || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(a.id) || !/^[0-9a-f]{64}$/.test(a.sha256) || !['image/jpeg','image/png','image/webp'].includes(a.mime) || !Number.isInteger(a.size) || a.size<1 || a.size>4194304 || !Number.isInteger(a.width) || !Number.isInteger(a.height) || a.width<1 || a.height<1 || a.width>8192 || a.height>8192 || a.width*a.height>40000000 || a.path!==`${a.id}/${a.sha256}.${a.mime==='image/jpeg'?'jpg':a.mime.slice(6)}`)throw new CmsUnavailable('database_response');
  return {id:a.id,path:a.path,sha256:a.sha256,mime:a.mime,size:a.size,width:a.width,height:a.height};
}
export async function readAsset(id:string, publicOnly:boolean) { return decodeAsset(await queryCms('SELECT cms.read_asset($1::uuid,$2::boolean) AS result',[id,publicOnly])); }
export async function verifiedBytes(asset:Asset, storage:ImageStorage=imageStorage) {
  const bytes=await storage.get(asset.path);
  if(bytes.length!==asset.size || createHash('sha256').update(bytes).digest('hex')!==asset.sha256)throw new CmsUnavailable('storage');
  return bytes;
}
export async function verifyContentAssets(content:PortfolioData) {
  const refs=new Set([content.profile.cvUrl,content.profile.profileImage,...content.projects.map(p=>p.image)]);
  for(const ref of refs)if(ref.startsWith('/api/assets/')) {
    const asset=await readAsset(ref.slice(12),false);
    await verifiedBytes(asset);
    await queryCms('SELECT cms.confirm_asset($1::uuid,$2::text) AS result',[asset.id,asset.sha256]);
  } else await verifyLegacyAsset(ref);
}

export async function verifyLegacyAsset(reference:string) {
  const asset=manifest.find(item=>item.path===reference);
  if(!asset)throw new CmsHttpError(422,'Unverified asset reference.');
  try {
    const root=await realpath(path.join(process.cwd(),'public'));
    const filename=await realpath(path.join(root,reference));
    if(!filename.startsWith(root+path.sep))throw new Error();
    const bytes=await readFile(filename);
    if(bytes.length!==asset.bytes || createHash('sha256').update(bytes).digest('hex')!==asset.sha256)throw new Error();
  }catch {throw new CmsUnavailable('storage');}
}
