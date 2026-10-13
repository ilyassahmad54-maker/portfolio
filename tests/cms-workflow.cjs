const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { createDatabase, asRole } = require('./helpers/cms-db.cjs');
const { createApi } = require('./helpers/cms-api.cjs');
const { loadModule } = require('../scripts/cms/load-module.cjs');
const published = require('../data.json');
const {canonicalJSON,contentHash}=loadModule('lib/cms/document.ts');
async function database(t) {
  const db=await createDatabase({phase:2});t.after(()=>db.close());
  await asRole(db,'portfolio_cms_seed',()=>db.query('SELECT cms.seed_published($1,$2)',[canonicalJSON(published),contentHash(published)]));
  return db;
}

test('workflow grants expose only twelve narrowly scoped functions; RLS and immutable history remain intact',async t=>{
  const db=await database(t);
  const functions=(await db.query("SELECT p.proname,has_function_privilege('portfolio_cms_runtime',p.oid,'EXECUTE') AS allowed FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='cms'")).rows;
  assert.deepEqual(functions.filter(f=>f.allowed).map(f=>f.proname).sort(),['read_published','read_draft','read_state','save_draft','publish_draft','discard_draft','list_revisions','read_revision','restore_publication','register_asset','read_asset','confirm_asset'].sort());
  const tables=(await db.query("SELECT relname,relrowsecurity,relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='cms' AND relkind='r'")).rows;
  assert.equal(tables.length,7);assert.ok(tables.every(r=>r.relrowsecurity&&r.relforcerowsecurity));
  await asRole(db,'portfolio_cms_runtime',async()=>{
    for(const {relname} of tables)await assert.rejects(db.query(`SELECT * FROM cms.${relname}`),e=>e.code==='42501');
    await assert.rejects(db.query('SELECT cms.state_snapshot()'),e=>e.code==='42501');
    await assert.rejects(db.query("SELECT cms.assets_publishable('{}')"),e=>e.code==='42501');
    await assert.rejects(db.query("SELECT cms.change_content('discard',1,NULL,NULL,true,NULL)"),e=>e.code==='42501');
  });
  await db.exec('CREATE ROLE cms_test_anon NOLOGIN');
  await asRole(db,'cms_test_anon',async()=>{
    for(const name of ['read_published','read_draft','read_state'])await assert.rejects(db.query(`SELECT cms.${name}()`),e=>e.code==='42501');
  });
});

test('SQL validates documents and assets independently of HTTP validation',async t=>{
  const db=await database(t);
  await asRole(db,'portfolio_cms_runtime',async()=>{
    const data=structuredClone(published);
    for(const image of ['https://external.test/logo.png','/assets/not-deployed.png','/api/assets/01234567-89ab-cdef-0123-456789abcdef']){data.projects[0].image=image;await assert.rejects(db.query('SELECT cms.save_draft($1::jsonb,1,$2::uuid)',[JSON.stringify(data),randomUUID()]),e=>e.code==='22023');}
    delete data.profile.name;
    await assert.rejects(db.query('SELECT cms.save_draft($1::jsonb,1,$2::uuid)',[JSON.stringify(data),randomUUID()]),e=>e.code==='22023');
    const draft=(await db.query('SELECT cms.read_draft() AS result')).rows[0].result;
    await assert.rejects(db.query('SELECT cms.discard_draft(1,$1::uuid,false,$2::uuid)',[draft.revisionId,randomUUID()]),e=>e.code==='22023');
  });
  assert.equal((await db.query('SELECT count(*)::int AS n FROM cms.operation_receipts')).rows[0].n,0);
});

test('publishing revalidates a draft, rejecting unverified asset references stored outside the API',async t=>{
  const db=await database(t);const unsafe=structuredClone(published);unsafe.projects[0].image='/api/assets/01234567-89ab-cdef-0123-456789abcdef';
  // Simulate a privileged import/bad historical draft; metadata alone must not grant publication.
  await asRole(db,'portfolio_cms_owner',async()=>{
    await db.query("INSERT INTO cms.portfolio_assets(id,bucket,object_path,sha256,mime_type,byte_size,width,height) VALUES ($1,'portfolio-images',$2,$3,'image/png',100,100,100)",['01234567-89ab-cdef-0123-456789abcdef','01234567-89ab-cdef-0123-456789abcdef/'+ 'a'.repeat(64)+'.png','a'.repeat(64)]);
    const id=(await db.query("INSERT INTO cms.portfolio_revisions(content,operation,actor_label) VALUES ($1::jsonb,'draft','test-import') RETURNING id",[JSON.stringify(unsafe)])).rows[0].id;
    await db.query('UPDATE cms.portfolio_state SET draft_revision_id=$1,version=version+1',[id]);
  });
  await asRole(db,'portfolio_cms_runtime',async()=>{
    const draft=(await db.query('SELECT cms.read_draft() AS result')).rows[0].result;
    await assert.rejects(db.query('SELECT cms.publish_draft(2,$1::uuid,$2::uuid)',[draft.revisionId,randomUUID()]),e=>e.code==='22023');
    assert.deepEqual((await db.query('SELECT cms.read_published() AS result')).rows[0].result.content,published);
  });
});

test('each save/publish/discard transaction rolls back state, revisions and receipts on injected failure',async t=>{
  const db=await database(t);const draft=structuredClone(published);draft.projects[0].description='Transaction test draft';
  for(const action of ['save','publish','discard']){
    await t.test(action,async()=>{
      if(action!=='save')await asRole(db,'portfolio_cms_runtime',async()=>{const s=(await db.query('SELECT cms.read_state() AS result')).rows[0].result;await db.query('SELECT cms.save_draft($1::jsonb,$2::bigint,$3::uuid)',[JSON.stringify(draft),s.version,randomUUID()]);});
      const snapshot=async()=>({state:(await db.query('SELECT * FROM cms.portfolio_state')).rows,revisions:(await db.query('SELECT id,operation,content FROM cms.portfolio_revisions ORDER BY sequence')).rows,receipts:(await db.query('SELECT * FROM cms.operation_receipts ORDER BY created_at')).rows});
      const before=await snapshot();
      await asRole(db,'portfolio_cms_owner',()=>db.exec("CREATE FUNCTION cms.inject_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected receipt failure'; END $$; CREATE TRIGGER injected_failure BEFORE INSERT ON cms.operation_receipts FOR EACH STATEMENT EXECUTE FUNCTION cms.inject_failure();"));
      await asRole(db,'portfolio_cms_runtime',async()=>{
        const state=(await db.query('SELECT cms.read_state() AS result')).rows[0].result;
        const query=action==='save'?'SELECT cms.save_draft($1::jsonb,$2::bigint,$3::uuid)':action==='publish'?'SELECT cms.publish_draft($1::bigint,$2::uuid,$3::uuid)':'SELECT cms.discard_draft($1::bigint,$2::uuid,true,$3::uuid)';
        const parameters=action==='save'?[JSON.stringify(draft),state.version,randomUUID()]:[state.version,state.draftRevisionId,randomUUID()];
        await assert.rejects(db.query(query,parameters),/injected receipt failure/);
      });
      assert.deepEqual(await snapshot(),before);
      await asRole(db,'portfolio_cms_owner',()=>db.exec('DROP TRIGGER injected_failure ON cms.operation_receipts; DROP FUNCTION cms.inject_failure();'));
    });
  }
});

test('concurrent HTTP requests and repeat requests produce exactly one mutation per version/key',async t=>{
  const api=await createApi();t.after(()=>api.close());
  const first={content:api.change(),expectedVersion:1,requestId:api.id()};
  const second={...first,requestId:api.id()};second.content=structuredClone(first.content);second.content.profile.headline='Concurrent change';
  const responses=await Promise.all([api.handler('save')(api.request('save',first)),api.handler('save')(api.request('save',second))]);
  assert.deepEqual(responses.map(r=>r.status).sort(),[200,409]);
  const saved=await responses.find(r=>r.status===200).json();
  const winner=responses[0].status===200?first:second;
  const retry=await (await api.handler('save')(api.request('save',winner))).json();assert.equal(retry.replayed,true);assert.equal(retry.revisionId,saved.revisionId);
  const changed={...winner,content:structuredClone(winner.content)};changed.content.profile.name='Changed payload with reused key';
  assert.equal((await api.handler('save')(api.request('save',changed))).status,409);
  const publication={expectedVersion:2,draftRevisionId:saved.revisionId,requestId:api.id()};
  const repeated=await Promise.all([api.handler('publish')(api.request('publish',publication)),api.handler('publish')(api.request('publish',publication))]);
  assert.ok(repeated.every(r=>r.status===200));const results=await Promise.all(repeated.map(r=>r.json()));assert.equal(results[0].revisionId,results[1].revisionId);assert.deepEqual(results.map(r=>r.replayed).sort(),[false,true]);
  assert.equal((await api.db.query("SELECT count(*)::int AS n FROM cms.portfolio_revisions WHERE operation='publish'")).rows[0].n,1);
  // Reusing a save key for a different operation is rejected, even if version is current.
  const current=await (await api.handler('state')(api.request('state'))).json();
  assert.equal((await api.handler('discard')(api.request('discard',{expectedVersion:current.version,draftRevisionId:current.draftRevisionId,requestId:winner.requestId,confirmed:true}))).status,409);
});

test('response decoders reject malformed database output and omit unexpected fields',()=>{
  const cache=new Map(),overrides={'server-only':{},'./database':{queryCms:()=>{throw new Error('unused')}}};
  const {decodePublished,decodeState}=loadModule('lib/cms/store.ts',overrides,cache);
  const {CmsUnavailable}=loadModule('lib/cms/errors.ts',overrides,cache);
  assert.throws(()=>decodePublished(null),CmsUnavailable);
  assert.throws(()=>decodePublished({revisionId:randomUUID(),sequence:1,content:{}}),CmsUnavailable);
  assert.throws(()=>decodeState({version:1}),CmsUnavailable);
  const clean=decodePublished({revisionId:randomUUID(),sequence:1,content:published,draft:{content:'private'},version:99});
  assert.deepEqual(Object.keys(clean).sort(),['content','revisionId','sequence']);
});
