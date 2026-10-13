const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createDatabase, asRole } = require('./helpers/cms-db.cjs');
const { loadModule } = require('../scripts/cms/load-module.cjs');
const { canonicalJSON, contentHash } = loadModule('lib/cms/document.ts');
const { validatePortfolio } = loadModule('lib/cms/validation.ts');
const published = require('../data.json');

test('real PostgreSQL foundation: migrations, permissions, seed retries and invariants', async t => {
  const db = await createDatabase();
  t.after(() => db.close());
  const seed = data => asRole(db, 'portfolio_cms_seed', () => db.query('SELECT cms.seed_published($1,$2) AS id',[canonicalJSON(data),contentHash(data)]));
  let seedId;

  await t.test('runtime can read only published content and has no table, seed, or helper access', async () => {
    await asRole(db,'portfolio_cms_runtime',async () => {
      assert.equal((await db.query('SELECT cms.read_published() AS document')).rows[0].document,null);
      for (const sql of ['SELECT * FROM cms.portfolio_revisions','SELECT * FROM cms.portfolio_state','SELECT * FROM cms.portfolio_assets','SELECT * FROM cms.migration_ledger',"SELECT cms.seed_published('{}','bad')",'SELECT cms.content_schema()',"INSERT INTO cms.portfolio_state VALUES ('portfolio',gen_random_uuid(),gen_random_uuid(),1,now())",'TRUNCATE cms.portfolio_revisions CASCADE']) {
        await assert.rejects(db.query(sql), error => error.code === '42501');
      }
    });
  });

  await t.test('all tables force RLS, functions pin search_path, and role flags are restricted', async () => {
    const tables = (await db.query("SELECT relrowsecurity,relforcerowsecurity FROM pg_class JOIN pg_namespace n ON n.oid=relnamespace WHERE n.nspname='cms' AND relkind='r'")).rows;
    assert.equal(tables.length,4);assert.ok(tables.every(r=>r.relrowsecurity&&r.relforcerowsecurity));
    const roles = (await db.query("SELECT rolcanlogin,rolsuper,rolbypassrls,rolcreaterole,rolcreatedb FROM pg_roles WHERE rolname LIKE 'portfolio_cms_%'")).rows;
    assert.equal(roles.length,3);assert.ok(roles.every(r=>Object.values(r).every(v=>v===false)));
    const functions=(await db.query("SELECT proconfig FROM pg_proc JOIN pg_namespace n ON n.oid=pronamespace WHERE n.nspname='cms'")).rows;
    assert.ok(functions.every(r=>r.proconfig?.includes('search_path=pg_catalog, pg_temp')));
    await asRole(db,'portfolio_cms_owner',()=>db.exec('CREATE FUNCTION cms.future_helper() RETURNS integer LANGUAGE sql AS $$ SELECT 1 $$;'));
    assert.equal((await db.query("SELECT has_function_privilege('portfolio_cms_runtime','cms.future_helper()','EXECUTE') AS allowed")).rows[0].allowed,false);
    await asRole(db,'portfolio_cms_owner',()=>db.exec('DROP FUNCTION cms.future_helper();'));
    await db.exec('CREATE ROLE cms_test_anon NOLOGIN');
    await asRole(db,'cms_test_anon',async()=>{
      await assert.rejects(db.query('SELECT cms.read_published()'),e=>e.code==='42501');
      await assert.rejects(db.query('SELECT * FROM cms.portfolio_state'),e=>e.code==='42501');
    });
  });

  await t.test('database and TypeScript validators agree on every current field and representative invalid inputs', async () => {
    const mutations=[d=>d,d=>{d.projects[0].category='Other';return d},d=>{d.projects[0].image='blob:temporary';return d},d=>{d.projects.push(d.projects[0]);return d},d=>{d.profile.formspreeEndpoint='https://evil.example/f/id';return d},d=>{delete d.profile.name;return d},d=>{d.projects[0].tags=[7];return d},d=>{d.extra='x';return d},d=>{d.projects[0].demoUrl='https://user:pass@example.com';return d},d=>{d.projects[0].demoUrl='https://example.internal';return d},d=>{d.projects[0].title='emoji 🟢';return d}];
    for(const mutate of mutations){const data=mutate(structuredClone(published));let valid=true;try{validatePortfolio(data)}catch{valid=false}const result=await db.query('SELECT cms.valid_content($1::jsonb) AS valid',[JSON.stringify(data)]);assert.equal(result.rows[0].valid,valid);}
  });

  await t.test('failed seed rolls back all content and ledger writes', async () => {
    await asRole(db,'portfolio_cms_owner',()=>db.exec("CREATE FUNCTION cms.test_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected failure'; END $$; CREATE TRIGGER test_failure BEFORE INSERT ON cms.migration_ledger FOR EACH STATEMENT EXECUTE FUNCTION cms.test_fail();"));
    await assert.rejects(seed(published),/injected failure/);
    for(const table of ['portfolio_state','portfolio_revisions','migration_ledger'])assert.equal((await db.query(`SELECT count(*)::int AS n FROM cms.${table}`)).rows[0].n,0);
    await asRole(db,'portfolio_cms_owner',()=>db.exec('DROP TRIGGER test_failure ON cms.migration_ledger; DROP FUNCTION cms.test_fail();'));
  });

  await t.test('seed preserves the exact eight projects, field values, order, and image references', async () => {
    seedId=(await seed(published)).rows[0].id;
    const document=await asRole(db,'portfolio_cms_runtime',()=>db.query('SELECT cms.read_published() AS document'));
    assert.deepEqual(document.rows[0].document.content,published);
    assert.equal(document.rows[0].document.revisionId,seedId);
    assert.equal(document.rows[0].document.version,1);
    const state=(await db.query('SELECT * FROM cms.portfolio_state')).rows[0];
    assert.equal(state.draft_revision_id,state.published_revision_id);
    const checksum=(await db.query("SELECT content_sha256 = encode(sha256(convert_to(content::text,'UTF8')),'hex') AS valid FROM cms.portfolio_revisions")).rows[0].valid;
    assert.equal(checksum,true);
  });

  await t.test('same seed is a no-op; changed source and incorrect checksum are rejected', async () => {
    assert.equal((await seed(published)).rows[0].id,seedId);
    const changed=structuredClone(published);changed.projects.reverse();
    await assert.rejects(seed(changed),/conflicts/);
    await assert.rejects(asRole(db,'portfolio_cms_seed',()=>db.query('SELECT cms.seed_published($1,$2)',[canonicalJSON(published),'0'.repeat(64)])),/checksum/);
    assert.equal((await db.query('SELECT count(*)::int AS n FROM cms.portfolio_revisions')).rows[0].n,1);
  });

  await t.test('revisions/ledger are append-only and state version/published pointer are constrained', async () => {
    await asRole(db,'portfolio_cms_owner',async()=>{
      await assert.rejects(db.query("UPDATE cms.portfolio_revisions SET actor_label='changed'"),e=>e.code==='55000');
      await assert.rejects(db.query('DELETE FROM cms.portfolio_revisions'),e=>e.code==='55000');
      await assert.rejects(db.query('TRUNCATE cms.portfolio_revisions CASCADE'),e=>e.code==='55000');
      await assert.rejects(db.query('DELETE FROM cms.migration_ledger'),e=>e.code==='55000');
      await assert.rejects(db.query('UPDATE cms.portfolio_state SET version=version+2'),e=>e.code==='23514');
      const draftContent=structuredClone(published);draftContent.projects[0].title='Private draft title';
      const draft=(await db.query("INSERT INTO cms.portfolio_revisions(content,operation,actor_label) VALUES ($1::jsonb,'draft','test-admin') RETURNING id",[JSON.stringify(draftContent)])).rows[0].id;
      await assert.rejects(db.query('UPDATE cms.portfolio_state SET published_revision_id=$1, version=version+1',[draft]),e=>e.code==='23514');
      await db.query('UPDATE cms.portfolio_state SET draft_revision_id=$1, version=version+1',[draft]);
    });
    // Initialization retries must not revert a later draft/version.
    assert.equal((await seed(published)).rows[0].id,seedId);
    assert.equal((await db.query('SELECT version FROM cms.portfolio_state')).rows[0].version,2);
    const publicDocument=await asRole(db,'portfolio_cms_runtime',()=>db.query('SELECT cms.read_published() AS document'));
    assert.deepEqual(publicDocument.rows[0].document.content,published);
  });

  await t.test('asset metadata enforces bucket, MIME, size and pixel limits', async () => {
    await asRole(db,'portfolio_cms_owner',async()=>{
      const sql='INSERT INTO cms.portfolio_assets(bucket,object_path,sha256,mime_type,byte_size,width,height,id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)';
      const valid=['portfolio-images','01234567-89ab-cdef-0123-456789abcdef/'+ 'a'.repeat(64)+'.png','a'.repeat(64),'image/png',100,400,400,'01234567-89ab-cdef-0123-456789abcdef'];
      await db.query(sql,valid);
      for(const [index,value] of [[0,'public'],[1,'wrong/path.png'],[2,'b'.repeat(64)],[3,'image/svg+xml'],[4,4194305],[5,0],[6,8193]]){const invalid=[...valid];invalid[index]=value;await assert.rejects(db.query(sql,invalid),e=>e.code==='23514');}
    });
  });
});

test('initializer refuses unexpected pre-existing content without a migration marker', async t => {
  const db=await createDatabase();t.after(()=>db.close());
  await asRole(db,'portfolio_cms_owner',()=>db.query("INSERT INTO cms.portfolio_revisions(content,operation,actor_label) VALUES ($1::jsonb,'draft','test')",[JSON.stringify(published)]));
  await assert.rejects(asRole(db,'portfolio_cms_seed',()=>db.query('SELECT cms.seed_published($1,$2)',[canonicalJSON(published),contentHash(published)])),/pre-existing/);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM cms.portfolio_state')).rows[0].n,0);
});
