const {test}=require('node:test');
const assert=require('node:assert/strict');
const sharp=require('sharp');
const {NextRequest}=require('next/server');
const {loadModule}=require('../scripts/cms/load-module.cjs');
const {createApi}=require('./helpers/cms-api.cjs');
const {asRole}=require('./helpers/cms-db.cjs');
const {validateImage,MAX_IMAGE_BYTES}=loadModule('lib/cms/images.ts',{'server-only':{}});
function memory(){const objects=new Map();let fail=false;return {objects,offline(){fail=true;},async put(path,bytes){if(fail)throw new Error('secret storage failure');if(objects.has(path))throw new Error('overwrite');objects.set(path,Buffer.from(bytes));},async get(path){if(fail||!objects.has(path))throw new Error('secret missing');return objects.get(path);}};}
async function image(format='png',width=8,height=6){return sharp({create:{width,height,channels:3,background:'#112233'}}).toFormat(format).toBuffer();}
async function api(t){const storage=memory(),a=await createApi(storage);t.after(()=>a.close());return {a,storage};}
async function upload(a,bytes,options={}){return a.assetHandler('upload')(new NextRequest('https://portfolio.test/api/admin/assets/upload',{method:'POST',headers:{cookie:a.cookie,origin:'https://portfolio.test','content-type':'image/png',...options},body:bytes}));}
async function deliver(a,id,preview=false,headers={cookie:a.cookie}){return a.assetHandler(preview?'assetPreview':'asset')(new NextRequest(`https://portfolio.test/api/${preview?'admin/':''}assets/${id}`,{headers}));}
async function content(a,op,body){const r=await a.handler(op)(a.request(op,body));return {status:r.status,body:await r.json()};}

test('full decoded JPEG, PNG and WebP validation rejects corrupt, unsupported, oversized and excessive dimensions',async()=>{
 for(const format of ['jpeg','png','webp']){const bytes=await image(format),info=await validateImage(bytes);assert.equal(info.mime,'image/'+format);assert.equal(info.width,8);assert.equal(info.height,6);}
 for(const bytes of [Buffer.from('<svg/>'),Buffer.from('GIF89a'),Buffer.from([255,216,255,0]),Buffer.alloc(MAX_IMAGE_BYTES+1)])await assert.rejects(validateImage(bytes));
 const bytes=await image();await assert.rejects(validateImage(bytes.subarray(0,40)));
 await assert.rejects(validateImage(await image('png',8193,1)));
 // Metadata advertises huge dimensions; decoder must refuse before allocating pixels.
 const bomb=Buffer.from(bytes);bomb.writeUInt32BE(100000,16);bomb.writeUInt32BE(100000,20);await assert.rejects(validateImage(bomb));
});
test('upload authentication, CSRF, byte limits, content type and rate limits run before storage',async t=>{
 const {a,storage}=await api(t),bytes=await image();
 assert.equal((await upload(a,bytes,{cookie:''})).status,401);
 assert.equal((await upload(a,bytes,{origin:'https://evil.test'})).status,403);
 assert.equal((await upload(a,bytes,{'content-length':String(MAX_IMAGE_BYTES+1)})).status,413);
 assert.equal((await upload(a,bytes,{'content-type':'image/svg+xml'})).status,415);
 assert.equal((await upload(a,bytes,{'content-type':'image/jpeg'})).status,422);
 for(let i=0;i<7;i++)await upload(a,Buffer.from('invalid'));
 assert.equal((await upload(a,bytes)).status,429);assert.equal(storage.objects.size,0);
});
test('verified uploads remain private until publication, duplicate bytes use distinct immutable paths, history survives restore',async t=>{
 const {a,storage}=await api(t),bytes=await image();
 const one=await upload(a,bytes);assert.equal(one.status,201);const asset=await one.json();
 const two=await upload(a,bytes);assert.equal(two.status,201);assert.notEqual((await two.json()).id,asset.id);assert.equal(storage.objects.size,2);
 assert.equal((await deliver(a,asset.id,false,{})).status,404);
 assert.equal((await deliver(a,asset.id,true,{})).status,401);
 const preview=await deliver(a,asset.id,true);assert.equal(preview.status,200);assert.deepEqual(Buffer.from(await preview.arrayBuffer()),bytes);
 const data=a.change();data.projects[0].image=asset.image;
 const saved=await content(a,'save',{content:data,expectedVersion:1,requestId:a.id()});assert.equal(saved.status,200);
 const pub=await content(a,'publish',{draftRevisionId:saved.body.revisionId,expectedVersion:2,requestId:a.id()});assert.equal(pub.status,200);
 assert.equal((await deliver(a,asset.id,false,{})).status,200);
 const seed=(await a.db.query("SELECT id FROM cms.portfolio_revisions WHERE operation='seed'")).rows[0].id;
 assert.equal((await content(a,'restore',{targetRevisionId:seed,expectedVersion:3,requestId:a.id()})).status,200);
 assert.equal((await deliver(a,asset.id,false,{})).status,404);assert.equal((await deliver(a,asset.id,true)).status,200);
 assert.equal((await content(a,'restore',{targetRevisionId:pub.body.revisionId,expectedVersion:4,requestId:a.id()})).status,200);
 assert.equal((await deliver(a,asset.id,false,{})).status,200);
 assert.equal((await deliver(a,'..%2Fprivate')).status,404);
});
test('storage loss and integrity mismatch prevent publication and restore without changing state',async t=>{
 const {a,storage}=await api(t),bytes=await image();const asset=await (await upload(a,bytes)).json();
 const data=a.change();data.projects[0].image=asset.image;
 const saved=await content(a,'save',{content:data,expectedVersion:1,requestId:a.id()});
 const path=[...storage.objects.keys()][0];storage.objects.set(path,Buffer.from('tampered'));
 assert.equal((await content(a,'publish',{draftRevisionId:saved.body.revisionId,expectedVersion:2,requestId:a.id()})).status,503);
 assert.equal((await content(a,'state')).body.version,2);
 storage.objects.set(path,bytes);
 const pub=await content(a,'publish',{draftRevisionId:saved.body.revisionId,expectedVersion:2,requestId:a.id()});assert.equal(pub.status,200);
 storage.objects.delete(path);
 assert.equal((await content(a,'restore',{targetRevisionId:pub.body.revisionId,expectedVersion:3,requestId:a.id()})).status,503);
 assert.equal((await content(a,'state')).body.version,3);
 assert.equal((await deliver(a,asset.id)).status,503);
 storage.offline();const failed=await upload(a,bytes);assert.equal(failed.status,503);assert.ok(!(await failed.text()).includes('secret'));
});
test('inventory immutable, recent verification required and restricted SQL grants remain enforced',async t=>{
 const {a}=await api(t),asset=await (await upload(a,await image())).json();
 await asRole(a.db,'portfolio_cms_runtime',async()=>{await assert.rejects(a.db.query('SELECT * FROM cms.asset_checks'),e=>e.code==='42501');await assert.rejects(a.db.query('DELETE FROM cms.portfolio_assets'),e=>e.code==='42501');});
 await asRole(a.db,'portfolio_cms_owner',async()=>{await assert.rejects(a.db.query('UPDATE cms.portfolio_assets SET width=1'));await a.db.query("UPDATE cms.asset_checks SET verified_at=clock_timestamp()-interval '1 minute'");});
 const data=a.change();data.projects[0].image=asset.image;
 const save=await content(a,'save',{content:data,expectedVersion:1,requestId:a.id()});
 await asRole(a.db,'portfolio_cms_runtime',()=>assert.rejects(a.db.query('SELECT cms.publish_draft(2,$1::uuid,$2::uuid)',[save.body.revisionId,a.id()]),e=>e.code==='22023'));
});
test('Storage adapter uses server-only credentials, rejects URLs/keys and never upserts or follows redirects',async()=>{
 const {createStorage}=loadModule('lib/cms/storage.ts',{'server-only':{}}),calls=[];
 const path='01234567-89ab-cdef-0123-456789abcdef/'+'a'.repeat(64)+'.png';
 const storage=createStorage(async(url,options)=>{if(url.endsWith('/bucket/portfolio-images'))return Response.json({id:'portfolio-images',public:false,file_size_limit:4194304,allowed_mime_types:['image/jpeg','image/png','image/webp']});calls.push({url,options});return new Response(options.method==='GET'?Buffer.from('test'):null,{status:200});},()=>({url:'https://test.supabase.co',key:'test-only-secret'}));
 await storage.put(path,Buffer.from('test'),'image/png');assert.equal(calls[0].options.headers['x-upsert'],'false');assert.equal(calls[0].options.redirect,'error');assert.equal(calls[0].options.headers.Authorization,'Bearer test-only-secret');
 assert.equal((await storage.get(path)).toString(),'test');await assert.rejects(storage.get('../escape'));
 await assert.rejects(createStorage(fetch,()=>({url:'https://evil.test',key:'secret'})).get(path));
 const failed=createStorage(async()=>new Response('secret detail',{status:500}),()=>({url:'https://test.supabase.co',key:'secret'}));await assert.rejects(failed.get(path),e=>!e.message.includes('secret'));
});
test('all permitted formats upload and deliver with exact content types',async t=>{
 const {a}=await api(t);
 for(const format of ['jpeg','png','webp']){
  const bytes=await image(format);const result=await upload(a,bytes,{'content-type':'image/'+format});assert.equal(result.status,201);
  const asset=await result.json();const preview=await deliver(a,asset.id,true);assert.equal(preview.headers.get('content-type'),'image/'+format);assert.deepEqual(Buffer.from(await preview.arrayBuffer()),bytes);
 }
});
test('stream limits apply without Content-Length, mismatched or oversized Storage responses fail closed',async t=>{
 const {a}=await api(t);
 assert.equal((await upload(a,Buffer.alloc(MAX_IMAGE_BYTES+1))).status,413);
 const {createStorage}=loadModule('lib/cms/storage.ts',{'server-only':{}});
 const configuration=()=>({url:'https://test.supabase.co',key:'test-only-secret'});
 const path='01234567-89ab-cdef-0123-456789abcdef/'+'b'.repeat(64)+'.png';
 for(const publicValue of [true,false]){
  const storage=createStorage(async url=>url.includes('/bucket/')?Response.json({id:'portfolio-images',public:publicValue,file_size_limit:4194304,allowed_mime_types:['image/jpeg','image/png','image/webp']}):new Response(Buffer.alloc(MAX_IMAGE_BYTES+1)),configuration);
  await assert.rejects(storage.get(path));
 }
});
test('object verification and inventory registration failures never publish or delete unregistered objects',async t=>{
 const {a,storage}=await api(t);const bytes=await image();
 storage.get=async()=>Buffer.from('wrong');assert.equal((await upload(a,bytes)).status,503);
 assert.equal((await a.db.query('SELECT count(*)::int n FROM cms.portfolio_assets')).rows[0].n,0);assert.equal(storage.objects.size,1);
});
test('legacy verification rejects missing and corrupted local files without touching existing assets',async()=>{
 const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
 const manifest=require('../lib/cms/legacy-assets.json'),file=manifest[0];const root=await fs.mkdtemp(path.join(os.tmpdir(),'cms-asset-check-'));
 const overrides={'server-only':{},'./database':{},'./storage':{},'node:fs/promises':{realpath:async name=>name.endsWith('/public')?root:path.join(root,'test-image'),readFile:async()=>Buffer.from('corrupted')}};
 const {verifyLegacyAsset}=loadModule('lib/cms/asset-store.ts',overrides);await assert.rejects(verifyLegacyAsset(file.path));await assert.rejects(verifyLegacyAsset('/assets/not-approved.png'));
});
test('private bucket policy blocks broad anonymous/authenticated Storage policies',async t=>{
 const {a}=await api(t);const fs=require('node:fs');
 await a.db.exec(`CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE SCHEMA storage;
 CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 CREATE TABLE storage.objects(id integer,bucket_id text);
 ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
 GRANT USAGE ON SCHEMA storage TO anon,authenticated;GRANT SELECT,INSERT,UPDATE,DELETE ON storage.buckets,storage.objects TO anon,authenticated;
 CREATE POLICY broad_objects ON storage.objects FOR ALL TO anon,authenticated USING(true) WITH CHECK(true);
 CREATE POLICY broad_buckets ON storage.buckets FOR ALL TO anon,authenticated USING(true) WITH CHECK(true);
 -- Fixture represents a bucket already created through the hosted Storage API.
 INSERT INTO storage.buckets VALUES('portfolio-images','portfolio-images',false,4194304,ARRAY['image/jpeg','image/png','image/webp']);`);
 await a.db.exec(fs.readFileSync('supabase/configuration/private-images.sql','utf8'));
 await a.db.exec("INSERT INTO storage.objects VALUES(1,'portfolio-images'),(2,'other');");
 for(const role of ['anon','authenticated']){
  await a.db.exec('SET ROLE '+role);
  try{
   assert.deepEqual((await a.db.query('SELECT id FROM storage.objects')).rows,[{id:2}]);
   assert.equal((await a.db.query('SELECT id FROM storage.buckets')).rows.length,0);
   await assert.rejects(a.db.query("INSERT INTO storage.objects VALUES(3,'portfolio-images')"),e=>e.code==='42501');
   assert.equal((await a.db.query("DELETE FROM storage.objects WHERE bucket_id='portfolio-images' RETURNING id")).rows.length,0);
  }finally{await a.db.exec('RESET ROLE');}
 }
});
test('expired sessions and Redis failure deny image administration',async t=>{
 const {a}=await api(t),bytes=await image();a.auth.advance(3601);
 assert.equal((await upload(a,bytes)).status,401);assert.equal((await deliver(a,a.id(),true)).status,401);
 a.auth.offline();assert.equal((await upload(a,bytes)).status,503);assert.equal((await deliver(a,a.id(),true)).status,503);
});
test('database registration failure leaves only a private unreferenced object',async t=>{
 const {a,storage}=await api(t);
 await asRole(a.db,'portfolio_cms_owner',()=>a.db.exec("CREATE FUNCTION cms.fail_inventory() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'secret database detail'; END $$; CREATE TRIGGER fail_inventory BEFORE INSERT ON cms.portfolio_assets FOR EACH STATEMENT EXECUTE FUNCTION cms.fail_inventory();"));
 const result=await upload(a,await image());assert.equal(result.status,503);assert.ok(!(await result.text()).includes('secret'));
 assert.equal(storage.objects.size,1);assert.equal((await a.db.query('SELECT count(*)::int n FROM cms.portfolio_assets')).rows[0].n,0);
 const id=[...storage.objects.keys()][0].split('/')[0];assert.equal((await deliver(a,id)).status,404);assert.equal((await deliver(a,id,true)).status,404);
});
test('animated PNG and excessive image area are rejected',async()=>{
 const bytes=await image();const chunk=Buffer.alloc(20);chunk.writeUInt32BE(8,0);chunk.write('acTL',4,'ascii');
 await assert.rejects(validateImage(Buffer.concat([bytes.subarray(0,33),chunk,bytes.subarray(33)])));
 const large=await image('png',6400,6400);await assert.rejects(validateImage(large));
});
