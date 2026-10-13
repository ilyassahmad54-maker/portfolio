const { test } = require('node:test');
const assert = require('node:assert/strict');
const { NextRequest } = require('next/server');
const { createApi } = require('./helpers/cms-api.cjs');
const { loadModule } = require('../scripts/cms/load-module.cjs');
const published = require('../data.json');

test('CMS APIs enforce authorization and preserve existing session behavior', async t => {
  const api=await createApi();t.after(()=>api.close());
  await t.test('every protected operation rejects missing, malformed and forged sessions before database access',async()=>{
    for(const operation of ['draft','preview','state','save','publish','discard']) {
      for(const cookie of [null,'__Host-admin-session=forged','__Host-admin-session='+ 'a'.repeat(64)]) {
        const result=await api.handler(operation)(api.request(operation,{}, {cookie}));assert.equal(result.status,401);
        assert.match(result.headers.get('cache-control'),/no-store/);
        assert.match(result.headers.get('x-robots-tag'),/noindex/);
      }
    }
    assert.equal(api.calls.length,0);
  });
  await t.test('all mutations reject foreign and missing origins, even with a valid session',async()=>{
    for(const operation of ['save','publish','discard']) {
      assert.equal((await api.handler(operation)(api.request(operation,{}, {headers:{origin:'https://evil.test'}}))).status,403);
      assert.equal((await api.handler(operation)(api.request(operation,{}, {noOrigin:true}))).status,403);
    }
    assert.equal(api.calls.length,0);
  });
  await t.test('read routes accept valid sessions and expired/revoked/rotated sessions are denied',async()=>{
    for(const operation of ['draft','preview','state'])assert.equal((await api.handler(operation)(api.request(operation))).status,200);
    const initialCalls=api.calls.length;
    await api.auth.api.revoke(api.request('state'));
    assert.equal((await api.handler('state')(api.request('state'))).status,401);
    assert.equal(api.calls.length,initialCalls);
    const second=await api.auth.api.newSession();api.auth.rotate();
    assert.equal((await api.handler('draft')(api.request('draft',undefined,{cookie:`__Host-admin-session=${second}`}))).status,401);
    const third=await api.auth.api.newSession();api.auth.advance(3601);
    assert.equal((await api.handler('preview')(api.request('preview',undefined,{cookie:`__Host-admin-session=${third}`}))).status,401);
  });
});

test('draft/save/preview/publish/discard lifecycle isolates public content and enforces versions',async t=>{
  const api=await createApi();t.after(()=>api.close());
  const content=api.change();let saved;
  await t.test('saved draft is visible only on authenticated draft/preview endpoints',async()=>{
    const result=await api.handler('save')(api.request('save',{content,expectedVersion:1,requestId:api.id()}));assert.equal(result.status,200);saved=await result.json();assert.equal(saved.state.version,2);assert.equal(saved.state.hasDraft,true);
    for(const operation of ['draft','preview']){const response=await api.handler(operation)(api.request(operation));const body=await response.json();assert.deepEqual(body.content,content);assert.equal(body.preview,operation==='preview');assert.equal(body.revisionId,saved.revisionId);}
    const response=await api.handler('published')(api.request('published',undefined,{cookie:null}));assert.equal(response.status,200);const body=await response.json();assert.deepEqual(body.content,published);assert.equal(body.source,'database');assert.equal(body.readOnly,false);
    for(const key of ['state','draftRevisionId','version','preview'])assert.ok(!Object.hasOwn(body,key));
    assert.ok(!JSON.stringify(body).includes('Private draft content'));
  });
  await t.test('stale save, wrong draft pointer and stale publication return 409',async()=>{
    assert.equal((await api.handler('save')(api.request('save',{content,expectedVersion:1,requestId:api.id()}))).status,409);
    assert.equal((await api.handler('publish')(api.request('publish',{expectedVersion:2,draftRevisionId:api.id(),requestId:api.id()}))).status,409);
    assert.equal((await api.handler('publish')(api.request('publish',{expectedVersion:1,draftRevisionId:saved.revisionId,requestId:api.id()}))).status,409);
  });
  await t.test('publish uses the saved revision only and refreshes publication atomically',async()=>{
    const input={expectedVersion:2,draftRevisionId:saved.revisionId,requestId:api.id()};
    const response=await api.handler('publish')(api.request('publish',input));assert.equal(response.status,200);const body=await response.json();assert.equal(body.state.version,3);assert.equal(body.state.hasDraft,false);assert.equal(body.state.draftRevisionId,body.state.publishedRevisionId);
    const live=await (await api.handler('published')(api.request('published'))).json();assert.deepEqual(live.content,content);assert.equal(live.revisionId,body.revisionId);assert.equal(api.invalidations(),1);
    const retry=await (await api.handler('publish')(api.request('publish',input))).json();assert.equal(retry.replayed,true);assert.equal(retry.revisionId,body.revisionId);assert.equal(retry.state.version,3);
    const fresh=await (await api.handler('state')(api.request('state'))).json();assert.equal(fresh.version,3);
  });
  await t.test('discard requires explicit confirmation and resets only draft, preserving published content/history',async()=>{
    const next=api.change();next.projects[0].title='Unsaved publication title';
    const draft=await (await api.handler('save')(api.request('save',{content:next,expectedVersion:3,requestId:api.id()}))).json();
    const input={expectedVersion:4,draftRevisionId:draft.revisionId,requestId:api.id(),confirmed:true};
    assert.equal((await api.handler('discard')(api.request('discard',{...input,confirmed:false}))).status,400);
    const response=await api.handler('discard')(api.request('discard',input));assert.equal(response.status,200);const body=await response.json();assert.equal(body.state.version,5);assert.equal(body.state.hasDraft,false);
    const read=await (await api.handler('draft')(api.request('draft'))).json();assert.deepEqual(read.content,content);
    const live=await (await api.handler('published')(api.request('published'))).json();assert.deepEqual(live.content,content);
    const retry=await (await api.handler('discard')(api.request('discard',input))).json();assert.equal(retry.replayed,true);assert.equal(retry.state.version,5);
    assert.equal((await api.db.query("SELECT count(*)::int AS n FROM cms.portfolio_revisions WHERE operation='draft'")).rows[0].n,2);
  });
});

test('API request validation blocks malformed, oversized and unsafe payloads before writes',async t=>{
  const api=await createApi();t.after(()=>api.close());const save=body=>api.handler('save')(api.request('save',body));
  await t.test('malformed JSON, wrong content types/encoding and missing request fields',async()=>{
    for(const rawBody of ['{','null','[]','{"expectedVersion":1}'])assert.equal((await api.handler('save')(api.request('save',undefined,{rawBody}))).status,400);
    for(const headers of [{'content-type':'text/plain'},{'content-encoding':'gzip'}])assert.equal((await api.handler('save')(api.request('save',{}, {headers}))).status,415);
    for(const expectedVersion of [0,-1,1.5,'1',null,Number.MAX_SAFE_INTEGER])assert.equal((await save({content:published,expectedVersion,requestId:api.id()})).status,400);
    assert.equal((await save({content:published,expectedVersion:1,requestId:'forged'})).status,400);
    assert.equal((await save({content:published,expectedVersion:1,requestId:api.id(),extra:'not-allowed'})).status,400);
    assert.equal((await api.handler('publish')(api.request('publish',{content:published,expectedVersion:1,draftRevisionId:api.id(),requestId:api.id()}))).status,400);
  });
  await t.test('stream bounds apply with absent or dishonest Content-Length',async()=>{
    const {MAX_REQUEST_BYTES}=loadModule('lib/cms/http.ts',api.overrides,api.cache);
    const make=(headers={})=>api.request('save',undefined,{rawBody:'x'.repeat(MAX_REQUEST_BYTES+1),headers});
    assert.equal((await api.handler('save')(make())).status,413);
    assert.equal((await api.handler('save')(make({'content-length':'1'}))).status,413);
    assert.equal((await api.handler('save')(api.request('save',{}, {headers:{'content-length':String(MAX_REQUEST_BYTES+1)}}))).status,413);
    assert.equal((await api.handler('save')(api.request('save',{}, {headers:{'content-length':'invalid'}}))).status,400);
    assert.equal(api.calls.length,0);
  });
  await t.test('documents, duplicate IDs, temporary/external/missing/managed image references are rejected',async()=>{
    const candidates=[];
    for(const image of ['blob:temporary','https://evil.test/logo.png','data:image/png;base64,eA==','/assets/missing.png','/api/assets/01234567-89ab-cdef-0123-456789abcdef']){const data=structuredClone(published);data.projects[0].image=image;candidates.push(data);}
    const duplicate=structuredClone(published);duplicate.projects.push(duplicate.projects[0]);candidates.push(duplicate);
    const unsafe=structuredClone(published);unsafe.projects[0].demoUrl='javascript:alert(1)';candidates.push(unsafe);
    for(const content of candidates)assert.equal((await save({content,expectedVersion:1,requestId:api.id()})).status,422);
    assert.equal((await api.db.query('SELECT count(*)::int AS n FROM cms.operation_receipts')).rows[0].n,0);
  });
});

test('operation-specific rate limits fail closed without changing login rate buckets',async t=>{
  const api=await createApi();t.after(()=>api.close());
  for(let i=0;i<5;i++)assert.equal((await api.handler('publish')(api.request('publish',{}))).status,400);
  const blocked=await api.handler('publish')(api.request('publish',{}));assert.equal(blocked.status,429);assert.equal(blocked.headers.get('retry-after'),'60');
  assert.equal((await api.handler('state')(api.request('state'))).status,200);
  const newToken=await api.auth.api.newSession();
  assert.equal((await api.handler('publish')(api.request('publish',{}, {cookie:'__Host-admin-session='+newToken}))).status,429);
  api.auth.advance(61);
  assert.equal((await api.handler('publish')(api.request('publish',{}))).status,400);
  const keys=api.auth.commands.filter(c=>c[0]==='EVAL').flatMap(c=>c.slice(3,3+c[2]));
  assert.ok(keys.every(key=>key.startsWith('portfolio:cms:')));assert.ok(keys.every(key=>!key.includes(api.token)));assert.ok(keys.some(k=>k.includes(':publish:ip:')));assert.ok(keys.some(k=>k.includes(':state:session:')));
});

test('Redis/database outages and cache errors have safe, explicit outcomes',async t=>{
  await t.test('Redis failure rejects protected reads/writes before DB, without secret diagnostics',async()=>{
    const api=await createApi();try{api.auth.offline();for(const operation of ['draft','preview','state','save','publish','discard']){const response=await api.handler(operation)(api.request(operation,{}));assert.equal(response.status,503);assert.ok(!(await response.text()).includes('secret'));}assert.equal(api.calls.length,0);assert.ok(api.logs.every(log=>log.category==='redis'));}finally{await api.close();}
  });
  await t.test('database failure provides only published fallback, while admin operations fail closed',async()=>{
    const api=await createApi();try{const state=await (await api.handler('state')(api.request('state'))).json();api.databaseOffline();const response=await api.handler('published')(api.request('published'));assert.equal(response.status,200);const body=await response.json();assert.deepEqual(body.content,published);assert.equal(body.readOnly,true);assert.equal(body.source,'fallback');for(const operation of ['draft','preview','state'])assert.equal((await api.handler(operation)(api.request(operation))).status,503);assert.equal((await api.handler('save')(api.request('save',{content:api.change(),expectedVersion:1,requestId:api.id()}))).status,503);for(const operation of ['publish','discard'])assert.equal((await api.handler(operation)(api.request(operation,{expectedVersion:state.version,draftRevisionId:state.draftRevisionId,requestId:api.id(),...(operation==='discard'?{confirmed:true}:{})}))).status,503);assert.ok(api.logs.every(log=>!JSON.stringify(log).includes('secret')));}finally{await api.close();}
  });
  await t.test('cache invalidation failure does not pretend an already committed publication failed',async()=>{
    const api=await createApi();try{const saved=await (await api.handler('save')(api.request('save',{content:api.change(),expectedVersion:1,requestId:api.id()}))).json();api.cacheFailure();const response=await api.handler('publish')(api.request('publish',{expectedVersion:2,draftRevisionId:saved.revisionId,requestId:api.id()}));assert.equal(response.status,200);assert.equal((await response.json()).cacheRefreshPending,true);const live=await (await api.handler('published')(api.request('published'))).json();assert.deepEqual(live.content,api.change());}finally{await api.close();}
  });
});

test('all Next route exports map independently to the intended operation and disable caching',async t=>{
  const api=await createApi();t.after(()=>api.close());
  const routes={ 'app/api/content/published/route.ts':{GET:'published'}, 'app/api/admin/content/draft/route.ts':{GET:'draft',POST:'save'}, 'app/api/admin/content/preview/route.ts':{GET:'preview'}, 'app/api/admin/content/state/route.ts':{GET:'state'}, 'app/api/admin/content/publish/route.ts':{POST:'publish'}, 'app/api/admin/content/discard/route.ts':{POST:'discard'} };
  const overrides={'@/lib/cms/routes':{cmsRoute:api.handler}};
  for(const [file,operations] of Object.entries(routes)){const route=loadModule(file,overrides);assert.equal(route.dynamic,'force-dynamic');assert.equal(route.revalidate,0);assert.equal(route.runtime,'nodejs');for(const [method,operation] of Object.entries(operations)){const response=await route[method](api.request(operation,{}, {cookie:null}));assert.equal(response.status,operation==='published'?200:401);}}
  const wrong=await api.handler('state')(new NextRequest('https://portfolio.test/api/admin/content/state',{method:'POST'}));assert.equal(wrong.status,405);
});
