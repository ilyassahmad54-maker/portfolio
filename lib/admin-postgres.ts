import 'server-only';
import { queryCms } from './cms/database';
import { CmsUnavailable } from './cms/errors';
export function createPostgresAdminState(query:typeof queryCms=queryCms){
  const boolean=(value:unknown)=>{if(value!==true)throw new CmsUnavailable('database_response');};
  const count=(value:unknown)=>{if(!Number.isSafeInteger(value)||(value as number)<0)throw new CmsUnavailable('database_response');return value as number;};
  return {
    create:async(hash:string,fingerprint:string)=>boolean(await query('SELECT preview_auth.create_session($1::text,$2::text) AS result',[hash,fingerprint])),
    read:async(hash:string)=>{const value=await query('SELECT preview_auth.read_session($1::text) AS result',[hash]);if(value!==null&&(typeof value!=='string'||!/^[a-f0-9]{64}$/.test(value)))throw new CmsUnavailable('database_response');return value as string|null;},
    revoke:async(hash:string)=>count(await query('SELECT preview_auth.revoke_session($1::text) AS result',[hash])),
    rate:async(operation:string,ipHash:string,sessionHash:string|null)=>{const value=count(await query('SELECT preview_auth.consume_rate($1::text,$2::text,$3::text) AS result',[operation,ipHash,sessionHash]));if(value<1)throw new CmsUnavailable('database_response');return value;},
  };
}
export const postgresAdminState=createPostgresAdminState();
