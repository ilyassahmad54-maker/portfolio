const {test}=require('node:test');
const assert=require('node:assert/strict');
const {loadModule}=require('../scripts/cms/load-module.cjs');
const cache=new Map(),overrides={'server-only':{}};
const {createCmsQuery}=loadModule('lib/cms/database.ts',overrides,cache);
const {CmsUnavailable,CmsHttpError}=loadModule('lib/cms/errors.ts',overrides,cache);
const uri='postgresql://portfolio_cms_app:synthetic-test-value@db.testproject.supabase.co/postgres';

test('database adapter binds parameters, verifies role, uses TLS and releases reserved connections',async()=>{
  const calls=[];let released=0,created=0;
  const factory=(connection,options)=>{created++;assert.equal(connection,uri);assert.equal(options.prepare,false);assert.equal(options.ssl.rejectUnauthorized,true);assert.equal(options.max,2);return {reserve:async()=>({unsafe:async(sql,parameters)=>{calls.push({sql,parameters});return sql.includes('FROM pg_roles')?[{allowed:true}]:[{result:{ok:true}}]},release:()=>{released++}}),end:async()=>{}}};
  const query=createCmsQuery(factory,()=>uri);
  assert.deepEqual(await query('SELECT cms.save_draft($1::jsonb,$2::bigint,$3::uuid) AS result',['{"text":"bound"}',1,'test-id']),{ok:true});
  assert.equal(calls.length,2);assert.match(calls[0].sql,/pg_has_role/);assert.deepEqual(calls[1].parameters,['{"text":"bound"}',1,'test-id']);assert.equal(released,1);
  await query('SELECT cms.read_state() AS result');assert.equal(created,1);assert.equal(released,2);
});

test('database configuration rejects missing/insecure/elevated/non-Supabase URLs without leaking input',async()=>{
  for(const value of [undefined,'not-a-uri','postgresql://postgres:secret@db.test.supabase.co/postgres','postgresql://portfolio_cms_owner:secret@db.test.supabase.co/postgres','postgresql://portfolio_cms_app:secret@localhost/postgres',uri+'?sslmode=disable',uri+'#fragment']) {
    let created=false;
    const query=createCmsQuery(()=>{created=true;throw new Error('must not connect')},()=>value);
    await assert.rejects(query('SELECT cms.read_state()'),error=>error instanceof CmsUnavailable&&error.category==='configuration'&&!error.message.includes('secret'));
    assert.equal(created,false);
  }
});

test('elevated role responses and malformed database output fail closed',async()=>{
  for(const [identity,rows,category] of [[false,[{result:1}],'configuration'],[true,[],'database_response'],[true,[{unexpected:'secret'}],'database_response']]) {
    let releases=0,contentCalls=0;
    const query=createCmsQuery(()=>({reserve:async()=>({unsafe:async sql=>{if(sql.includes('FROM pg_roles'))return [{allowed:identity}];contentCalls++;return rows},release:()=>{releases++}}),end:async()=>{}}),()=>uri);
    await assert.rejects(query('SELECT cms.read_state() AS result'),error=>error instanceof CmsUnavailable&&error.category===category);
    assert.equal(releases,1);if(!identity)assert.equal(contentCalls,0);
  }
});

test('SQLSTATE mapping exposes safe conflicts/validation errors, not upstream SQL or secrets',async()=>{
  for(const [code,status] of [['P0409',409],['23514',422],['57014',503],['55P03',503],['XX000',503]]) {
    const query=createCmsQuery(()=>({reserve:async()=>({unsafe:async sql=>{if(sql.includes('FROM pg_roles'))return [{allowed:true}];throw {code,message:'secret connection/password/sql arguments',detail:'private draft'}},release:()=>{}}),end:async()=>{}}),()=>uri);
    await assert.rejects(query('SELECT cms.read_state() AS result'),error=>(status===503?error instanceof CmsUnavailable:error instanceof CmsHttpError&&error.status===status)&&!JSON.stringify(error).includes('secret')&&!error.message.includes('private'));
  }
});

test('deadline includes queued acquisition; late reservations never execute timed-out mutations',async()=>{
  let releaseReservation,ended=0,released=0,executed=0;
  const reservation=new Promise(resolve=>{releaseReservation=resolve});
  const query=createCmsQuery(()=>({reserve:()=>reservation,end:async()=>{ended++}}),()=>uri,10);
  await assert.rejects(query('SELECT cms.publish_draft(1,NULL,NULL) AS result'),e=>e instanceof CmsUnavailable&&e.category==='database_timeout');
  assert.equal(ended,1);
  releaseReservation({unsafe:async()=>{executed++;return []},release:()=>{released++}});
  await new Promise(resolve=>setImmediate(resolve));assert.equal(executed,0);assert.equal(released,1);
});

test('deadline closes an in-flight pool and a later retry gets a fresh client',async()=>{
  let settle,created=0,ended=0,released=0;
  const factory=()=>{created++;const number=created;return {reserve:async()=>({unsafe:async sql=>sql.includes('FROM pg_roles')?[{allowed:true}]:number===1?new Promise(resolve=>{settle=resolve}):[{result:'retry-result'}],release:()=>{released++}}),end:async()=>{ended++;if(settle)settle([{result:'uncertain-prior-outcome'}])}}};
  const query=createCmsQuery(factory,()=>uri,10);
  await assert.rejects(query('SELECT cms.publish_draft(1,NULL,NULL) AS result'),e=>e instanceof CmsUnavailable&&e.category==='database_timeout');
  assert.equal(ended,1);assert.equal(await query('SELECT cms.read_state() AS result'),'retry-result');assert.equal(created,2);assert.equal(released,2);
});

test('an upstream connection failure fails closed and the next request reconnects without replaying the failed operation',async()=>{
  let created=0,ended=0,contentCalls=0;
  const query=createCmsQuery(()=>{const number=++created;return {
    reserve:async()=>{if(number===1)throw {code:'08006',message:'private upstream details'};return {
      unsafe:async sql=>{if(sql.includes('FROM pg_roles'))return [{allowed:true}];contentCalls++;return [{result:'recovered'}];},release:()=>{}};},
    end:async()=>{ended++;},
  };},()=>uri);
  await assert.rejects(query('SELECT cms.publish_draft(1,NULL,NULL) AS result'),e=>e instanceof CmsUnavailable&&e.category==='database');
  assert.equal(contentCalls,0);assert.equal(ended,1);
  assert.equal(await query('SELECT cms.read_state() AS result'),'recovered');assert.equal(created,2);assert.equal(contentCalls,1);
});
