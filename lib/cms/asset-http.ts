import 'server-only';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { validateImage, MAX_IMAGE_BYTES } from './images';
import { CmsHttpError, CmsUnavailable } from './errors';
import { imageStorage, type ImageStorage } from './storage';
import { queryCms } from './database';
import { readAsset, verifiedBytes, type Asset } from './asset-store';
import { authorizeCms, limitCms } from './security';

async function readUpload(request:NextRequest):Promise<Buffer> {
  const length=request.headers.get('content-length');
  if(length!==null && (!/^\d+$/.test(length) || !Number.isSafeInteger(Number(length))))throw new CmsHttpError(400,'Invalid request.');
  if(length!==null && Number(length)>MAX_IMAGE_BYTES)throw new CmsHttpError(413,'Image exceeds the 4 MiB limit.');
  if(!['image/jpeg','image/png','image/webp'].includes(request.headers.get('content-type') || '') || ![null,'identity'].includes(request.headers.get('content-encoding')))throw new CmsHttpError(415,'Use a JPEG, PNG or WebP image body.');
  const reader=request.body?.getReader();if(!reader)throw new CmsHttpError(400,'Image required.');
  let timer:ReturnType<typeof setTimeout>|undefined;
  const deadline=new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new CmsHttpError(408,'Upload timed out.')),5000);});
  const chunks:Uint8Array[]=[];let total=0;
  try {while(true){const p=await Promise.race([reader.read(),deadline]);if(p.done)break;total+=p.value.length;if(total>MAX_IMAGE_BYTES)throw new CmsHttpError(413,'Image exceeds the 4 MiB limit.');chunks.push(p.value);}return Buffer.concat(chunks);}
  catch(error){throw error instanceof CmsHttpError?error:new CmsHttpError(400,'Invalid upload.');}
  finally{if(timer)clearTimeout(timer);void reader.cancel().catch(()=>{});}
}
interface Dependencies {
  storage:ImageStorage;
  authorize:typeof authorizeCms;
  limit:typeof limitCms;
  query:typeof queryCms;
  asset:typeof readAsset;
  log(category:string):void;
}
const defaults:Dependencies={storage:imageStorage,authorize:authorizeCms,limit:limitCms,query:queryCms,asset:readAsset,log:category=>console.error(JSON.stringify({event:'cms_asset',category}))};
const headers={'Cache-Control':'private, no-store, max-age=0','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow','Vary':'Cookie, Origin'};
export function createAssetHandler(operation:'upload'|'asset'|'assetPreview',d:Dependencies=defaults){
  return async(request:NextRequest)=>{
    try{
      if(request.method!==(operation==='upload'?'POST':'GET'))throw new CmsHttpError(405,'Method not allowed.');
      if(operation!=='asset')await d.authorize(request,operation==='upload');
      await d.limit(request,operation);
      if(operation==='upload'){
        const bytes=await readUpload(request),info=await validateImage(bytes);
        if(request.headers.get('content-type')!==info.mime)throw new CmsHttpError(422,'Image type does not match its bytes.');
        const id=randomUUID(),path=`${id}/${info.sha256}.${info.mime==='image/jpeg'?'jpg':info.mime.slice(6)}`;
        await d.storage.put(path,bytes,info.mime);
        // Verify the stored object before registering it. Failures leave an unreferenced
        // object for manual review; never delete or expose an incompletely verified upload.
        await verifiedBytes({id,path,...info},d.storage);
        await d.query('SELECT cms.register_asset($1::uuid,$2::text,$3::text,$4::integer,$5::integer,$6::integer) AS result',[id,info.sha256,info.mime,info.size,info.width,info.height]);
        return NextResponse.json({id,image:`/api/assets/${id}`,preview:`/api/admin/assets/${id}`,mime:info.mime,width:info.width,height:info.height,size:info.size},{status:201,headers});
      }
      const pathname=new URL(request.url).pathname;
      const id=pathname.split('/').pop() || '';
      const expected=operation==='asset'?`/api/assets/${id}`:`/api/admin/assets/${id}`;
      if(pathname!==expected || new URL(request.url).search || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id))throw new CmsHttpError(404,'Image not found.');
      const asset:Asset=await d.asset(id,operation==='asset');
      const bytes=await verifiedBytes(asset,d.storage);
      return new NextResponse(new Uint8Array(bytes),{headers:{...headers,'Content-Type':asset.mime,'Content-Length':String(bytes.length),'Content-Security-Policy':"default-src 'none'; sandbox",'Content-Disposition':'inline'}});
    }catch(error){
      const status=error instanceof CmsHttpError?error.status:503;
      if(status===503)d.log(error instanceof CmsUnavailable?error.category:'unexpected');
      return NextResponse.json({error:error instanceof CmsHttpError?error.publicMessage:'Image service temporarily unavailable.'},{status,headers:{...headers,...(status===429?{'Retry-After':'60'}:{})}});
    }
  };
}
