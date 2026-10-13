import 'server-only';
import { CmsUnavailable } from './errors';
import { MAX_IMAGE_BYTES } from './images';
import { assertPreviewConfiguration } from './preview';
export interface ImageStorage { put(path: string, bytes: Buffer, mime: string): Promise<void>; get(path: string): Promise<Buffer> }
async function boundedResponse(res:Response, maximum:number):Promise<Buffer> {
  const reader=res.body?.getReader();if(!reader)throw new Error();
  let total=0;const chunks:Uint8Array[]=[];
  try { while(true){const part=await reader.read();if(part.done)break;total+=part.value.length;if(total>maximum)throw new Error();chunks.push(part.value);}return Buffer.concat(chunks); }
  finally {void reader.cancel().catch(()=>{});}
}
export function createStorage(fetcher: typeof fetch = fetch, configuration = () => ({ url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY })) : ImageStorage {
  async function run(path: string, bytes?: Buffer, mime?: string): Promise<Buffer> {
    assertPreviewConfiguration();
    const {url,key}=configuration();
    if (!url || !/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url) || !key || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{64}\.(jpg|png|webp)$/.test(path)) throw new CmsUnavailable('configuration');
    try {
      const bucket=await fetcher(`${url}/storage/v1/bucket/portfolio-images`,{headers:{apikey:key,Authorization:`Bearer ${key}`},signal:AbortSignal.timeout(8000),redirect:'error',cache:'no-store'});
      if(!bucket.ok) { void bucket.body?.cancel(); throw new Error(); }
      // Bound administrative metadata too; never trust a configured bucket to be private.
      const text=(await boundedResponse(bucket,16384)).toString('utf8');
      const config=JSON.parse(text);
      if(config.id!=='portfolio-images' || config.public!==false || config.file_size_limit!==MAX_IMAGE_BYTES || !Array.isArray(config.allowed_mime_types) || config.allowed_mime_types.length!==3 || !['image/jpeg','image/png','image/webp'].every(type=>config.allowed_mime_types.includes(type)))throw new Error();
      const res=await fetcher(`${url}/storage/v1/object/${bytes ? '' : 'authenticated/'}portfolio-images/${path}`, {
        method: bytes ? 'POST' : 'GET', headers: { apikey:key, Authorization:`Bearer ${key}`, ...(bytes ? {'Content-Type':mime!, 'x-upsert':'false'} : {}) },
        ...(bytes ? { body:new Uint8Array(bytes) } : {}), signal:AbortSignal.timeout(8000), redirect:'error', cache:'no-store',
      });
      if (!res.ok) { void res.body?.cancel(); throw new Error(); }
      if(bytes) { void res.body?.cancel(); return Buffer.alloc(0); }
      return await boundedResponse(res,MAX_IMAGE_BYTES);
    } catch { throw new CmsUnavailable('storage'); }
  }
  return { put:async(path,bytes,mime)=>{await run(path,bytes,mime);},get:path=>run(path) };
}
export const imageStorage=createStorage();
