const { randomUUID } = require('node:crypto');
const { NextRequest } = require('next/server');
const { createDatabase, asRole } = require('./cms-db.cjs');
const { createAuth } = require('./cms-auth.cjs');
const { loadModule } = require('../../scripts/cms/load-module.cjs');
const published = require('../../data.json');
async function createApi(storage) {
  const db = await createDatabase({phase:2});
  const auth = createAuth(), logs=[], calls=[];
  let databaseOffline=false, cacheFailure=false, invalidations=0;
  const cache = new Map();
  const initial = loadModule('lib/cms/document.ts');
  await asRole(db,'portfolio_cms_seed',()=>db.query('SELECT cms.seed_published($1,$2)',[initial.canonicalJSON(published),initial.contentHash(published)]));
  const overrides = {...(storage?{'./storage':{imageStorage:storage}}:{}),'server-only':{},'../admin':auth.api,'./database':{
    queryCms:async (statement,parameters=[])=>{
      calls.push(statement);
      const errors=loadModule('lib/cms/errors.ts',overrides,cache);
      if(databaseOffline)throw new errors.CmsUnavailable('database');
      try{return (await asRole(db,'portfolio_cms_runtime',()=>db.query(statement,parameters))).rows[0].result;}
      catch(error){throw errors.safeDatabaseError(error);}
    },
  }};
  const {createCmsHandler}=loadModule('lib/cms/http.ts',overrides,cache);
  const {cmsStore}=loadModule('lib/cms/store.ts',overrides,cache);
  const security=loadModule('lib/cms/security.ts',overrides,cache);
  const dependencies={store:cmsStore,authorize:security.authorizeCms,limit:security.limitCms,
    invalidate:()=>{invalidations++;if(cacheFailure)throw new Error('secret-like cache failure');},
    log:(operation,category,status)=>logs.push({operation,category,status})};
  const handler=operation=>createCmsHandler(operation,dependencies);
  const token=await auth.api.newSession();
  const cookie=`${auth.api.cookieName}=${token}`;
  function request(operation,body,options={}) {
    const method=options.method||(['save','publish','discard','restore'].includes(operation)?'POST':'GET');
    const headers=new Headers({'content-type':'application/json',origin:'https://portfolio.test',...(options.cookie===null?{}:{cookie:options.cookie||cookie}),...options.headers});
    if(options.noOrigin)headers.delete('origin');
    const raw=options.rawBody!==undefined?options.rawBody:JSON.stringify(body);
    return new NextRequest(`https://portfolio.test/api/${operation==='published'?'content/published':'admin/content/'+operation}`,{method,headers,...(method==='POST'?{body:raw}:{}),...options.requestInit});
  }
  return {db,auth,handler,request,cookie,token,logs,calls,dependencies,security,overrides,cache,
    change:()=>{const data=structuredClone(published);data.projects[0].description='Private draft content';return data;},
    id:randomUUID,databaseOffline:()=>{databaseOffline=true;},cacheFailure:()=>{cacheFailure=true;},invalidations:()=>invalidations,
    assetHandler:operation=>{const {createAssetHandler}=loadModule('lib/cms/asset-http.ts',overrides,cache);const assets=loadModule('lib/cms/asset-store.ts',overrides,cache);return createAssetHandler(operation,{storage,authorize:security.authorizeCms,limit:security.limitCms,query:overrides['./database'].queryCms,asset:assets.readAsset,log:category=>logs.push({category})});},
    close:()=>db.close()};
}
module.exports={createApi};
