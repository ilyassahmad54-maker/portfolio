const {test}=require('node:test');
const assert=require('node:assert/strict');
const {NextRequest}=require('next/server');
const {createApi}=require('./helpers/cms-api.cjs');
const {asRole}=require('./helpers/cms-db.cjs');
async function setup(t){const a=await createApi();t.after(()=>a.close());return a;}
async function call(a,op,body,options){const r=await a.handler(op)(a.request(op,body,options));return {status:r.status,body:await r.json()};}
async function history(a,query=''){const r=await a.handler('history')(new NextRequest('https://portfolio.test/api/admin/content/history'+query,{headers:{cookie:a.cookie}}));return {status:r.status,body:await r.json()};}
async function revision(a,id){const r=await a.handler('revision')(new NextRequest('https://portfolio.test/api/admin/content/revision?id='+id,{headers:{cookie:a.cookie}}));return {status:r.status,body:await r.json()};}

test('history authorization, CSRF, rate limits and database failures fail closed',async t=>{
 const a=await setup(t);
 for(const op of ['history','revision','restore']) assert.equal((await call(a,op,{}, {cookie:null})).status,401);
 assert.equal((await call(a,'restore',{}, {noOrigin:true})).status,403);
 for(let i=0;i<5;i++)assert.equal((await call(a,'restore',{})).status,400);
 assert.equal((await call(a,'restore',{})).status,429);
 a.databaseOffline();assert.equal((await history(a)).status,503);
 assert.equal((await revision(a,a.id())).status,503);
});
test('history pagination, selected content and restore keep drafts private and immutable',async t=>{
 const a=await setup(t);const initial=(await history(a)).body.items[0];assert.equal(initial.operation,'seed');
 const saved=await call(a,'save',{content:a.change(),expectedVersion:1,requestId:a.id()});
 assert.equal((await revision(a,saved.body.revisionId)).body.operation,'draft');
 assert.equal((await call(a,'restore',{targetRevisionId:saved.body.revisionId,expectedVersion:2,requestId:a.id()})).status,422);
 const published=await call(a,'publish',{draftRevisionId:saved.body.revisionId,expectedVersion:2,requestId:a.id()});
 const later=a.change();later.profile.headline='Unpublished independent work';
 const draft=await call(a,'save',{content:later,expectedVersion:3,requestId:a.id()});
 const input={targetRevisionId:initial.revisionId,expectedVersion:4,requestId:a.id()};
 const restored=await call(a,'restore',input);assert.equal(restored.status,200);assert.equal(restored.body.state.draftRevisionId,draft.body.revisionId);
 assert.equal((await call(a,'published')).body.content.profile.headline,require('../data.json').profile.headline);
 assert.equal((await call(a,'draft')).body.content.profile.headline,later.profile.headline);
 assert.equal((await revision(a,restored.body.revisionId)).body.operation,'restore');
 assert.deepEqual((await revision(a,initial.revisionId)).body.content,require('../data.json'));
 assert.equal((await call(a,'restore',input)).body.replayed,true);
 assert.equal((await call(a,'restore',{...input,targetRevisionId:published.body.revisionId})).status,409);
 const first=await history(a,'?limit=2');const second=await history(a,'?limit=2&before='+first.body.nextCursor);
 assert.equal(first.body.items.length,2);assert.ok(second.body.items.every(x=>x.sequence<first.body.nextCursor));
 assert.ok(!JSON.stringify(first.body).includes('authenticated-admin'));
 for(const q of ['?limit=0','?limit=51','?before=-1','?limit=2&limit=3','?unknown=1'])assert.equal((await history(a,q)).status,400);
 assert.equal((await revision(a,'bad')).status,400);assert.equal((await revision(a,a.id())).status,404);
 await asRole(a.db,'portfolio_cms_owner',async()=>{await assert.rejects(a.db.query('DELETE FROM cms.portfolio_revisions WHERE id=$1',[initial.revisionId]));});
});
test('restore clean draft follows publication; concurrent requests conflict and identical retries replay',async t=>{
 const a=await setup(t);const seed=(await history(a)).body.items[0].revisionId;
 const request={targetRevisionId:seed,expectedVersion:1,requestId:a.id()};
 const responses=await Promise.all([call(a,'restore',request),call(a,'restore',{...request,requestId:a.id()})]);
 assert.deepEqual(responses.map(x=>x.status).sort(),[200,409]);const success=responses.find(x=>x.status===200);
 assert.equal(success.body.state.draftRevisionId,success.body.revisionId);
 const input={targetRevisionId:seed,expectedVersion:2,requestId:a.id()};
 const repeated=await Promise.all([call(a,'restore',input),call(a,'restore',input)]);
 assert.ok(repeated.every(x=>x.status===200));assert.equal(repeated.filter(x=>x.body.replayed).length,1);
});
test('restore rejects missing IDs, invalid historical documents and absent assets without state changes',async t=>{
 const a=await setup(t);const before=(await call(a,'state')).body;
 assert.equal((await call(a,'restore',{targetRevisionId:a.id(),expectedVersion:1,requestId:a.id()})).status,404);
 assert.equal((await call(a,'restore',{targetRevisionId:'bad',expectedVersion:1,requestId:a.id()})).status,400);
 const data=a.change();data.projects[0].image='/assets/missing.png';
 const id=await asRole(a.db,'portfolio_cms_owner',async()=> (await a.db.query("INSERT INTO cms.portfolio_revisions(content,operation,actor_label) VALUES($1::jsonb,'publish','test') RETURNING id",[JSON.stringify(data)])).rows[0].id);
 assert.equal((await call(a,'restore',{targetRevisionId:id,expectedVersion:1,requestId:a.id()})).status,422);
 assert.deepEqual((await call(a,'state')).body,before);
});
test('receipt failure rolls back restore revisions and both pointers',async t=>{
 const a=await setup(t);const seed=(await history(a)).body.items[0].revisionId;
 const snapshot=async()=>({state:(await a.db.query('SELECT * FROM cms.portfolio_state')).rows,revisions:(await a.db.query('SELECT * FROM cms.portfolio_revisions ORDER BY sequence')).rows,receipts:(await a.db.query('SELECT * FROM cms.operation_receipts')).rows});
 const before=await snapshot();
 await asRole(a.db,'portfolio_cms_owner',()=>a.db.exec("CREATE FUNCTION cms.fail_restore() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'private failure'; END $$; CREATE TRIGGER fail_restore BEFORE INSERT ON cms.operation_receipts FOR EACH STATEMENT EXECUTE FUNCTION cms.fail_restore();"));
 assert.equal((await call(a,'restore',{targetRevisionId:seed,expectedVersion:1,requestId:a.id()})).status,503);
 assert.deepEqual(await snapshot(),before);
});
test('history operations reject expired sessions and Redis outages',async t=>{
 const a=await setup(t);
 a.auth.advance(3601);
 for(const op of ['history','revision','restore'])assert.equal((await call(a,op,{})).status,401);
});

test('Redis failure prevents all history operations',async t=>{const a=await setup(t);a.auth.offline();for(const op of ['history','revision','restore'])assert.equal((await call(a,op,{})).status,503);});
test('restore revalidates historical content against the current schema',async t=>{
 const a=await setup(t);const seed=(await history(a)).body.items[0].revisionId;
 const before=(await call(a,'state')).body;
 // Simulate a future schema tightening that invalidates previously valid content.
 await asRole(a.db,'portfolio_cms_owner',()=>a.db.exec("CREATE OR REPLACE FUNCTION cms.valid_content(content jsonb) RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path=pg_catalog,pg_temp AS $$ SELECT false $$;"));
 assert.equal((await call(a,'restore',{targetRevisionId:seed,expectedVersion:1,requestId:a.id()})).status,422);
 assert.deepEqual((await call(a,'state')).body,before);
});
