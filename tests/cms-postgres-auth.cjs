const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),{createHash}=require('node:crypto');
const {loadModule}=require('../scripts/cms/load-module.cjs'),{createDatabase,asRole}=require('./helpers/cms-db.cjs');
const {adminStateBackend}=loadModule('lib/admin-backend.ts',{'server-only':{}});
const ref='abcdefghijklmnopqrst',hash=v=>createHash('sha256').update(v).digest('hex');
const environment=()=>({NODE_ENV:'production',VERCEL:'1',VERCEL_ENV:'preview',ADMIN_STATE_BACKEND:'postgres',CMS_PREVIEW_AUTH_ENABLED:'1',ADMIN_PASSCODE:'preview-only-test-passcode-12345',CMS_PREVIEW_PROJECT_REF:ref,CMS_CACHE_NAMESPACE:'preview-auth-test',SUPABASE_URL:`https://${ref}.supabase.co`,SUPABASE_DATABASE_URL:`postgresql://portfolio_cms_preview_app.${ref}:synthetic@aws-0-test.pooler.supabase.com:6543/postgres`});
async function fixture(t){
 const db=await createDatabase({phase:2});t.after(()=>db.close());await db.exec(fs.readFileSync('supabase/preview-migrations/202610120008_preview_auth.sql','utf8'));
 let offline=false;const calls=[],logs=[],env=environment();
 const query=async(sql,args)=>{calls.push({sql,args});if(offline)throw new Error('private database failure with connection/password/IP/token');return db.transaction(async tx=>{await tx.exec('SET LOCAL ROLE portfolio_cms_runtime');return (await tx.query(sql,args)).rows[0].result;});};
 const pg=loadModule('lib/admin-postgres.ts',{'server-only':{}}).createPostgresAdminState(query);
 const modules={'./admin-backend':{adminStateBackend},'./admin-postgres':{postgresAdminState:pg},'./cms/preview':loadModule('lib/cms/preview.ts',{'server-only':{}})};
 const api={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/admin.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:api,require:n=>n==='server-only'?{}:modules[n]||require(n),process:{env},fetch:()=>{throw new Error('Redis must not be contacted');},Buffer,URL,AbortSignal,console:{error:value=>logs.push(value)}});
 return {db,env,api,pg,calls,logs,offline:()=>{offline=true;},owner:sql=>{return db.exec('SET ROLE portfolio_preview_auth_owner').then(()=>db.exec(sql)).finally(()=>db.exec('RESET ROLE'));}};
}
const request=token=>({cookies:{get:()=>token?{value:token}:undefined},headers:new Headers({origin:'https://preview.test','x-vercel-forwarded-for':'192.0.2.88'}),nextUrl:{origin:'https://preview.test'}});
function route(name,api){const output={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(`app/api/admin/${name}/route.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:output,require:n=>n==='@/lib/admin'?api:require(n),Buffer});return output;}
test('backend selection defaults Production to Redis and rejects unsafe/ambiguous Preview configurations',()=>{
 assert.equal(adminStateBackend({VERCEL_ENV:'production'}),'redis');assert.equal(adminStateBackend({VERCEL_ENV:'production',ADMIN_STATE_BACKEND:'redis'}),'redis');assert.equal(adminStateBackend(environment()),'postgres');
 for(const env of [{VERCEL_ENV:'preview'},{ADMIN_STATE_BACKEND:''},{ADMIN_STATE_BACKEND:'invalid'},{ADMIN_STATE_BACKEND:'postgres'},{...environment(),VERCEL_ENV:'production'},{...environment(),VERCEL_ENV:undefined},{...environment(),CMS_PREVIEW_AUTH_ENABLED:undefined},{...environment(),UPSTASH_REDIS_REST_URL:''},{...environment(),UPSTASH_REDIS_REST_TOKEN:'forbidden'},{ADMIN_STATE_BACKEND:'redis',CMS_PREVIEW_AUTH_ENABLED:'1'}])assert.throws(()=>adminStateBackend(env));
});
test('PostgreSQL sessions store only hashes, preserve cookies, revoke and invalidate on rotation',async t=>{
 const a=await fixture(t),token=await a.api.newSession();assert.equal(await a.api.sessionValid(request(token)),true);assert.equal(await a.api.sessionValid(request('forged')),false);
 const rows=(await a.db.query('SELECT * FROM preview_auth.sessions')).rows;assert.equal(rows.length,1);assert.equal(rows[0].token_sha256,hash(token));assert.equal(rows[0].credential_sha256,hash(a.env.ADMIN_PASSCODE));assert.ok(!JSON.stringify(rows).includes(token));assert.ok(!JSON.stringify(a.calls).includes(token));
 assert.equal(a.api.cookieName,'__Host-admin-session');assert.equal(a.api.cookieOptions.httpOnly,true);assert.equal(a.api.cookieOptions.secure,true);assert.equal(a.api.cookieOptions.sameSite,'strict');assert.equal(a.api.cookieOptions.maxAge,3600);
 a.env.ADMIN_PASSCODE+='rotated';assert.equal(await a.api.sessionValid(request(token)),false);a.env.ADMIN_PASSCODE=a.env.ADMIN_PASSCODE.replace('rotated','');await a.api.revoke(request(token));assert.equal(await a.api.sessionValid(request(token)),false);await a.api.revoke(request(token));
});
test('session expiration is enforced by database time independent of cleanup',async t=>{
 const a=await fixture(t),token=await a.api.newSession();const row=(await a.db.query('SELECT extract(epoch from (expires_at-clock_timestamp())) seconds FROM preview_auth.sessions')).rows[0];assert.ok(Number(row.seconds)>3590&&Number(row.seconds)<=3600);
 await a.owner("UPDATE preview_auth.sessions SET expires_at=clock_timestamp()-interval '1 second'");assert.equal(await a.api.sessionValid(request(token)),false);assert.equal((await a.db.query('SELECT count(*)::int n FROM preview_auth.sessions')).rows[0].n,1);
});
test('Preview target mismatches and inherited Redis credentials deny operations before any state call',async t=>{
 const a=await fixture(t);a.env.SUPABASE_URL='https://wrongproject.supabase.co';await assert.rejects(a.api.newSession(),/configuration/);assert.equal(a.calls.length,0);
 a.env.SUPABASE_URL=`https://${ref}.supabase.co`;a.env.UPSTASH_REDIS_REST_TOKEN='forbidden-production-value';await assert.rejects(a.api.limited(request()),/configuration/);assert.equal(a.calls.length,0);
 delete a.env.UPSTASH_REDIS_REST_TOKEN;await assert.rejects(a.api.redis(['GET',hash('x')]),/configuration/);assert.equal(a.calls.length,0);
});
test('PostgreSQL Preview published reads do not access a Redis backup',async()=>{
 const content=require('../data.json'),snapshot={content,revisionId:'00000000-0000-4000-8000-000000000001',sequence:1};let redisCalls=0;
 const {readPublicContent}=loadModule('lib/cms/public-content.ts',{'server-only':{},react:{cache:f=>f},'../admin':{redis:async()=>{redisCalls++;throw new Error();}},'../admin-backend':{adminStateBackend:()=> 'postgres'},'./store':{cmsStore:{published:async()=>snapshot},decodePublished:x=>x}});
 assert.equal((await readPublicContent()).source,'database');assert.equal(redisCalls,0);
});
test('concurrent SQL rate calls allow exactly five logins and reset after fifteen minutes',async t=>{
 const a=await fixture(t); // PGlite serializes statements; hosted multi-connection contention is a separate acceptance gate.
 const results=await Promise.all(Array.from({length:20},()=>a.pg.rate('login',hash('test IP'),null)));assert.equal(results.filter(n=>n<=5).length,5);assert.equal(Math.max(...results),6);
 const row=(await a.db.query('SELECT extract(epoch from (expires_at-clock_timestamp())) seconds FROM preview_auth.rate_buckets')).rows[0];assert.ok(Number(row.seconds)>890&&Number(row.seconds)<=900);
 await a.owner("UPDATE preview_auth.rate_buckets SET expires_at=clock_timestamp()-interval '1 second'");assert.equal(await a.pg.rate('login',hash('test IP'),null),1);
 const policy=await Promise.all(Array.from({length:8},()=>a.api.limited(request())));assert.deepEqual(policy.slice(0,5),[false,false,false,false,false]);assert.deepEqual(policy.slice(5),[true,true,true]);assert.ok(!JSON.stringify(a.calls).includes('192.0.2.88'));
});
test('SQL CMS limits match TypeScript policy and atomically update IP/session buckets',async t=>{
 const a=await fixture(t),{CMS_LIMITS}=loadModule('lib/cms/security.ts',{'server-only':{},'../admin':a.api});
 for(const [op,max] of Object.entries(CMS_LIMITS)){
  const session=['published','asset'].includes(op)?null:hash('session-'+op);const counts=await Promise.all(Array.from({length:max+2},()=>a.pg.rate(op,hash('IP-'+op),session)));
  assert.equal(counts.filter(n=>n<=max).length,max);assert.equal(Math.max(...counts),max+1);
 }
 const {limitCms}=loadModule('lib/cms/security.ts',{'server-only':{},'../admin':a.api});for(let i=0;i<5;i++)await limitCms(request(),'publish');await assert.rejects(limitCms(request(),'publish'),e=>e.status===429);
});
test('private auth schema exposes exactly four runtime functions and denies direct access',async t=>{
 const a=await fixture(t);const functions=await a.db.query("SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='preview_auth' AND has_function_privilege('portfolio_cms_runtime',p.oid,'EXECUTE') ORDER BY p.proname");assert.deepEqual(functions.rows.map(r=>r.proname),['consume_rate','create_session','read_session','revoke_session']);
 const tables=await a.db.query("SELECT relrowsecurity,relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='preview_auth' AND relkind='r'");assert.equal(tables.rows.length,2);assert.ok(tables.rows.every(r=>r.relrowsecurity&&r.relforcerowsecurity));
 for(const sql of ['SELECT * FROM preview_auth.sessions','INSERT INTO preview_auth.sessions VALUES(NULL,NULL,now())','DELETE FROM preview_auth.rate_buckets','SELECT preview_auth.purge_expired(10)'])await assert.rejects(asRole(a.db,'portfolio_cms_runtime',()=>a.db.query(sql)),e=>e.code==='42501');
 await assert.rejects(asRole(a.db,'portfolio_cms_seed',()=>a.db.query("SELECT preview_auth.read_session($1)",[hash('x')])),e=>e.code==='42501');
});
test('database errors and malformed results fail closed without sensitive diagnostics',async t=>{
 const a=await fixture(t),token=await a.api.newSession();a.offline();
 for(const work of [()=>a.api.newSession(),()=>a.api.sessionValid(request(token)),()=>a.api.revoke(request(token)),()=>a.api.limited(request())]){try{await work();assert.fail('Must deny');}catch(error){a.api.reportAdminFailure(error,'session','session_lookup');assert.equal(error.message,'postgres_unavailable');}}
 assert.ok(a.logs.every(v=>!v.includes(token)&&!v.includes('192.0.2.88')&&!v.includes(a.env.ADMIN_PASSCODE)&&!v.includes('postgresql:')));
 const broken=loadModule('lib/admin-postgres.ts',{'server-only':{}}).createPostgresAdminState(async()=>({secret:'not forwarded'}));await assert.rejects(broken.create(hash('x'),hash('y')));await assert.rejects(broken.read(hash('x')));await assert.rejects(broken.rate('login',hash('x'),null));
});
test('existing login/session/logout routes enforce CSRF and fail-closed behavior with PostgreSQL',async t=>{
 const a=await fixture(t),{NextRequest}=require('next/server'),login=route('login',a.api),logout=route('logout',a.api),session=route('session',a.api);
 const req=(path,body,origin='https://preview.test',cookie)=>new NextRequest('https://preview.test/api/admin/'+path,{method:body?'POST':'GET',headers:{origin,'content-type':'application/json',...(cookie?{cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});
 assert.equal((await login.POST(req('login',{passcode:a.env.ADMIN_PASSCODE},'https://attacker.test'))).status,403);
 const response=await login.POST(req('login',{passcode:a.env.ADMIN_PASSCODE}));assert.equal(response.status,200);const cookie=response.headers.get('set-cookie').split(';')[0];assert.match(response.headers.get('set-cookie'),/HttpOnly/);assert.match(response.headers.get('set-cookie'),/Secure/);
 assert.equal((await session.GET(req('session',null,undefined,cookie))).status,200);
 const out=await logout.POST(new NextRequest('https://preview.test/api/admin/logout',{method:'POST',headers:{origin:'https://preview.test',cookie}}));assert.equal(out.status,200);assert.equal((await session.GET(req('session',null,undefined,cookie))).status,401);
 a.offline();const failed=await login.POST(req('login',{passcode:a.env.ADMIN_PASSCODE}));assert.equal(failed.status,503);assert.equal(failed.headers.get('set-cookie'),null);
});
test('invalid SQL rate requests and partial failures roll back both buckets',async t=>{
 const a=await fixture(t);await assert.rejects(a.pg.rate('unknown',hash('x'),null));await assert.rejects(a.pg.rate('publish',hash('x'),null));
 await a.owner("CREATE FUNCTION preview_auth.fail_session_bucket() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.scope='session' THEN RAISE EXCEPTION 'injected'; END IF; RETURN NEW; END $$; CREATE TRIGGER failure BEFORE INSERT ON preview_auth.rate_buckets FOR EACH ROW EXECUTE FUNCTION preview_auth.fail_session_bucket();");
 await assert.rejects(a.pg.rate('save',hash('x'),hash('y')));assert.equal((await a.db.query('SELECT count(*)::int n FROM preview_auth.rate_buckets')).rows[0].n,0);
});

test('Preview auth catalog audit validates real RLS and restricted grants',async t=>{
 const a=await fixture(t);await a.db.exec('CREATE ROLE anon; CREATE ROLE authenticated;');
 const result=await asRole(a.db,'portfolio_cms_runtime',()=>a.db.query(fs.readFileSync('supabase/verification/preview-auth.sql','utf8')));assert.equal(Object.keys(result.rows[0].result).length,6);assert.ok(Object.values(result.rows[0].result).every(v=>v===true));
});
