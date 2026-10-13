const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {loadModule}=require('../scripts/cms/load-module.cjs');
const {seedConnection,apply}=require('../scripts/cms/seed-preview.cjs');
const {assertPreviewConfiguration}=loadModule('lib/cms/preview.ts',{'server-only':{}});
const ref='abcdefghijklmnopqrst';
const env={VERCEL_ENV:'preview',ADMIN_STATE_BACKEND:'redis',CMS_PREVIEW_PROJECT_REF:ref,CMS_PREVIEW_REDIS_HOST:'preview-test.upstash.io',CMS_CACHE_NAMESPACE:'preview-test',SUPABASE_DATABASE_URL:`postgresql://portfolio_cms_app.${ref}:example@aws-0-region.pooler.supabase.com:6543/postgres`,SUPABASE_URL:`https://${ref}.supabase.co`,UPSTASH_REDIS_REST_URL:'https://preview-test.upstash.io'};
test('Preview resources must match explicit non-secret allowlists',()=>{
 assert.doesNotThrow(()=>assertPreviewConfiguration(env));
 for(const changed of [{CMS_PREVIEW_PROJECT_REF:undefined},{CMS_CACHE_NAMESPACE:'portfolio'},{SUPABASE_URL:'https://other.supabase.co'},{UPSTASH_REDIS_REST_URL:'https://production.upstash.io'},{SUPABASE_DATABASE_URL:env.SUPABASE_DATABASE_URL.replace(ref,'wrong')}])assert.throws(()=>assertPreviewConfiguration({...env,...changed}),/temporarily unavailable/);
 assert.doesNotThrow(()=>assertPreviewConfiguration({VERCEL_ENV:'production'}));
});
test('public managed images are rate-limited by IP without a global anonymous session bucket',async()=>{
 let args;const {limitCms}=loadModule('lib/cms/security.ts',{'server-only':{},'../admin':{redis:async value=>{args=value;return 1;},cookieName:'portfolio_admin',configuredAdminBackend:()=> 'redis'}});
 const request={headers:new Headers(),cookies:{get:()=>undefined}};
 await limitCms(request,'asset');assert.equal(args[2],1);assert.equal(args.length,4);
 await limitCms(request,'assetPreview');assert.equal(args[2],2);assert.equal(args.length,5);
});
test('strict published reader cannot conceal DB failure behind any fallback',async()=>{
 const {createPublishedReader}=loadModule('lib/cms/public-content.ts',{'server-only':{},react:{cache:f=>f},'../admin':{}});
 let backupReads=0;const reader=createPublishedReader(async()=>{throw new Error('secret');},{read:async()=>{backupReads++;return {};},write:async()=>{}},()=>{},()=>true);
 await assert.rejects(reader(),/temporarily unavailable/);assert.equal(backupReads,0);
});
test('seed requires explicit approval, exact isolated target and restricted seed identity',()=>{
 const good={CMS_SEED_APPROVAL:'isolated-preview',CMS_PREVIEW_PROJECT_REF:ref,CMS_PREVIEW_SEED_DATABASE_URL:`postgresql://portfolio_cms_preview_seed.${ref}:example@aws-0-region.pooler.supabase.com:6543/postgres`};
 assert.equal(seedConnection(good),good.CMS_PREVIEW_SEED_DATABASE_URL);
 for(const changed of [{CMS_SEED_APPROVAL:undefined},{VERCEL_ENV:'production'},{CMS_PREVIEW_PROJECT_REF:'wrong'},{CMS_PREVIEW_SEED_DATABASE_URL:good.CMS_PREVIEW_SEED_DATABASE_URL.replace('portfolio_cms_preview_seed','postgres')},{CMS_PREVIEW_SEED_DATABASE_URL:good.CMS_PREVIEW_SEED_DATABASE_URL+'?sslmode=disable'}])assert.throws(()=>seedConnection({...good,...changed}));
});
test('seed binds reviewed canonical bytes and hash, validates role and closes driver',async()=>{
 const {createPlan}=require('../scripts/cms/migration-plan.cjs'),plan=createPlan();let calls=[],closed=0;
 const configuration={CMS_SEED_APPROVAL:'isolated-preview',CMS_PREVIEW_PROJECT_REF:ref,CMS_PREVIEW_SEED_DATABASE_URL:`postgresql://portfolio_cms_preview_seed.${ref}:example@aws-0-region.pooler.supabase.com:6543/postgres`};
 const factory=(_uri,options)=>{assert.equal(options.prepare,false);assert.equal(options.ssl.rejectUnauthorized,true);return {unsafe:async(sql,args)=>{calls.push({sql,args});return sql.includes('FROM pg_roles')?[{allowed:true}]:[{revision:'00000000-0000-4000-8000-000000000001'}];},end:async()=>{closed++;}};};
 await apply(plan.directory,configuration,factory);assert.equal(closed,1);assert.equal(calls[1].args[0],fs.readFileSync(plan.directory+'/seed-source.canonical.json','utf8'));assert.equal(calls[1].args[1],plan.manifest.canonicalSourceSha256);
 calls=[];await assert.rejects(apply(plan.directory,configuration,()=>({unsafe:async()=>[{allowed:false}],end:async()=>{closed++;}})));assert.equal(calls.length,0);
});
test('hosted runtime catalog audit passes against actual isolated SQL migrations',async t=>{
 const {createDatabase,asRole}=require('./helpers/cms-db.cjs'),db=await createDatabase({phase:2});t.after(()=>db.close());
 await db.exec('CREATE ROLE anon; CREATE ROLE authenticated;');
 const result=await asRole(db,'portfolio_cms_runtime',()=>db.query(fs.readFileSync('supabase/verification/preview-runtime.sql','utf8')));
 assert.equal(Object.keys(result.rows[0].result).length,9);assert.ok(Object.values(result.rows[0].result).every(value=>value===true));
});
test('Preview login setup grants separate runtime/seed memberships without elevated attributes',async t=>{
 const {createDatabase}=require('./helpers/cms-db.cjs'),db=await createDatabase({phase:2});t.after(()=>db.close());
 await db.exec(fs.readFileSync('supabase/configuration/preview-logins.sql','utf8'));
 const result=await db.query(`SELECT rolname,rolcanlogin,rolsuper,rolbypassrls,rolcreaterole,rolcreatedb,
 pg_has_role(rolname,'portfolio_cms_runtime','USAGE') AS runtime,
 pg_has_role(rolname,'portfolio_cms_seed','USAGE') AS seed,
 pg_has_role(rolname,'portfolio_cms_owner','MEMBER') AS owner
 FROM pg_roles WHERE rolname IN ('portfolio_cms_preview_app','portfolio_cms_preview_seed') ORDER BY rolname`);
 assert.equal(result.rows.length,2);
 for(const r of result.rows){assert.equal(r.rolcanlogin,true);for(const field of ['rolsuper','rolbypassrls','rolcreaterole','rolcreatedb','owner'])assert.equal(r[field],false);assert.equal(r.runtime,r.rolname==='portfolio_cms_preview_app');assert.equal(r.seed,r.rolname==='portfolio_cms_preview_seed');}
 await assert.rejects(db.exec(fs.readFileSync('supabase/configuration/preview-logins.sql','utf8')));
});
