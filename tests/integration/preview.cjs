// Opt-in real services test. No routes mocked; requires separate hosted-write approval.
const {test}=require('node:test'),assert=require('node:assert/strict'),{request,chromium}=require('playwright-core'),{randomUUID,createHash}=require('node:crypto'),sharp=require('sharp');
const baseline=require('../../data.json');
const diagnostic={stage:'configuration',path:'',status:0,error:'none'};
const enabled=process.env.CMS_INTEGRATION_ALLOW_WRITES==='isolated-preview';
async function runHosted(t){
 const origin=process.env.CMS_INTEGRATION_ORIGIN,url=new URL(origin);
 assert.equal(url.protocol,'https:');assert.equal(url.origin,origin);assert.match(url.hostname,/^[a-z0-9-]+\.vercel\.app$/);
 assert.notEqual(origin,'https://portfolio-woad-nu-owt4y7t889.vercel.app');assert.ok(process.env.ADMIN_PASSCODE);
 const headers=process.env.CMS_PREVIEW_BYPASS?{'x-vercel-protection-bypass':process.env.CMS_PREVIEW_BYPASS}:{};
 const storageState=process.env.CMS_PREVIEW_ACCESS_COOKIE?{cookies:[{name:'_vercel_jwt',value:process.env.CMS_PREVIEW_ACCESS_COOKIE,domain:url.hostname,path:'/',expires:-1,httpOnly:true,secure:true,sameSite:'None'}],origins:[]}:undefined;
 const admin=await request.newContext({baseURL:origin,extraHTTPHeaders:headers,storageState,timeout:30000}),publicClient=await request.newContext({baseURL:origin,extraHTTPHeaders:headers,storageState,timeout:30000});
 let cleanup=async()=>{};t.after(async()=>{try{await cleanup();}catch{throw new Error('Preview cleanup incomplete; inspect isolated state before retrying.');}finally{await Promise.all([admin.dispose(),publicClient.dispose()]);}});
 const json=async(response,status=200)=>{diagnostic.path=new URL(response.url()).pathname;diagnostic.status=response.status();if(response.status()!==status){try{const b=await response.json();const allowed=['Invalid portfolio document.','Content or asset references are invalid.','An image or CV reference is not verified for publication.','Content service temporarily unavailable.','Image service temporarily unavailable.'];diagnostic.error=allowed.includes(b.error)?b.error:'unexpected response';}catch{diagnostic.error='non-JSON response';}}assert.equal(response.status(),status,'Unexpected API status');return response.json();};
 const publicRead=async()=>{const r=await publicClient.get('/api/content/published');assert.equal(r.headers()['x-cms-environment'],'isolated-preview');const p=await json(r);assert.equal(p.source,'database');assert.equal(p.readOnly,false);return p;};
 diagnostic.stage='public baseline';
 const initial=await publicRead();assert.deepEqual(initial.content,baseline);
 await json(await publicClient.get('/api/admin/content/draft'),401);
 diagnostic.stage='admin login';
 await json(await admin.post('/api/admin/login',{headers:{Origin:origin},data:{passcode:process.env.ADMIN_PASSCODE}}));
 const readDraft=async()=>json(await admin.get('/api/admin/content/draft'));
 diagnostic.stage='load draft';
 let draft=await readDraft();assert.equal(draft.state.hasDraft,false,'Dedicated Preview must start without an unrelated draft');
 const ownedDrafts=new Set(),ownedPublications=new Set(),marker=`Preview integration ${randomUUID()}`;
 const post=async(path,body,status=200)=>json(await admin.post('/api/admin/content/'+path,{headers:{Origin:origin},data:body}),status);
 // Cleanup only our revisions; never overwrite an unknown writer or existing draft.
 cleanup=async()=>{
  try{
   let current=await readDraft();
   if(ownedPublications.has(current.state.publishedRevisionId))await post('restore',{expectedVersion:current.state.version,targetRevisionId:initial.revisionId,requestId:randomUUID()});
   current=await readDraft();if(ownedDrafts.has(current.revisionId))await post('discard',{expectedVersion:current.state.version,draftRevisionId:current.revisionId,confirmed:true,requestId:randomUUID()});
   assert.deepEqual((await publicRead()).content,baseline);
  }finally{await admin.post('/api/admin/logout',{headers:{Origin:origin}});}
 };
 const edited=structuredClone(baseline);edited.profile.headline=marker;
 await json(await admin.post('/api/admin/content/draft',{headers:{Origin:'https://attacker.invalid'},data:{content:edited,expectedVersion:draft.state.version,requestId:randomUUID()}}),403);
 diagnostic.stage='image uploads';
 for(const format of ['jpeg','png','webp']){
  const bytes=await sharp({create:{width:3,height:3,channels:3,background:'#00aa99'}})[format]().toBuffer();
  const asset=await json(await admin.post('/api/admin/assets/upload',{headers:{Origin:origin,'Content-Type':`image/${format}`},data:bytes}),201);
  assert.equal((await publicClient.get(asset.image)).status(),404);const preview=await admin.get(asset.preview);assert.equal(preview.status(),200);
  assert.equal(createHash('sha256').update(await preview.body()).digest('hex'),createHash('sha256').update(bytes).digest('hex'));
  if(format==='png')edited.projects[0].image=asset.image;
 }
 diagnostic.stage='save draft';
 const save={content:edited,expectedVersion:draft.state.version,requestId:randomUUID()};
 let saved=await post('draft',save);ownedDrafts.add(saved.revisionId);assert.equal((await post('draft',save)).replayed,true);
 assert.deepEqual((await publicRead()).content,baseline);assert.deepEqual((await json(await admin.get('/api/admin/content/preview'))).content,edited);
 diagnostic.stage='publish';
 const publish={expectedVersion:saved.state.version,draftRevisionId:saved.revisionId,requestId:randomUUID()};
 const published=await post('publish',publish);ownedPublications.add(published.revisionId);assert.equal((await post('publish',publish)).replayed,true);
 assert.deepEqual((await publicRead()).content,edited);assert.equal((await publicClient.get(edited.projects[0].image)).status(),200);
 diagnostic.stage='history';
 const history=await json(await admin.get('/api/admin/content/history?limit=2'));assert.equal(history.items.length,2);assert.ok(history.items[0].sequence>history.items[1].sequence);
 assert.ok(history.nextCursor);const older=await json(await admin.get(`/api/admin/content/history?limit=2&before=${history.nextCursor}`));assert.ok(older.items.every(item=>item.sequence<history.nextCursor));
 assert.deepEqual((await json(await admin.get('/api/admin/content/revision?id='+initial.revisionId))).content,baseline);
 // Real concurrent HTTP requests use separate server-side database reservations.
 diagnostic.stage='concurrent drafts';
 draft=await readDraft();const concurrent=await Promise.all([1,2].map(n=>admin.post('/api/admin/content/draft',{headers:{Origin:origin},data:{content:{...edited,profile:{...edited.profile,headline:marker+' '+n}},expectedVersion:draft.state.version,requestId:randomUUID()}})));
 assert.deepEqual(concurrent.map(r=>r.status()).sort(),[200,409]);saved=await concurrent.find(r=>r.status()===200).json();ownedDrafts.add(saved.revisionId);
 const discarded=await post('discard',{expectedVersion:saved.state.version,draftRevisionId:saved.revisionId,confirmed:true,requestId:randomUUID()});assert.equal(discarded.state.hasDraft,false);
 diagnostic.stage='restore';
 const restore={expectedVersion:discarded.state.version,targetRevisionId:initial.revisionId,requestId:randomUUID()};
 const restored=await post('restore',restore);ownedPublications.add(restored.revisionId);assert.equal((await post('restore',restore)).replayed,true);
 assert.deepEqual((await publicRead()).content,baseline);assert.equal((await publicClient.get(edited.projects[0].image)).status(),404);
 assert.equal((await admin.get(edited.projects[0].image.replace('/api/assets/','/api/admin/assets/'))).status(),200,'Historical image remains available to admin');
 diagnostic.stage='desktop/mobile browser';
 const browser=await chromium.launch({executablePath:process.env.CMS_TEST_CHROME||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});t.after(()=>browser.close());
 for(const viewport of [{width:1440,height:1000},{width:390,height:844}]){
  const context=await browser.newContext({viewport,extraHTTPHeaders:headers,storageState});try{
   const page=await context.newPage();await page.goto(origin,{waitUntil:'networkidle'});await page.waitForTimeout(1000);
   assert.deepEqual(await page.locator('#projects h3').allTextContents(),baseline.projects.map(p=>p.title));
   assert.equal(await page.locator('link[rel=canonical]').getAttribute('href'),'https://portfolio-woad-nu-owt4y7t889.vercel.app');
   const cv=await context.request.get(new URL(baseline.profile.cvUrl,origin).href);assert.equal(cv.status(),200);assert.ok((await cv.body()).subarray(0,5).equals(Buffer.from('%PDF-')));
   assert.equal(await page.locator('#contact form').count(),1);
  }finally{await context.close();}
 }
 diagnostic.stage='login rate limit';
 const attempts=await Promise.all(Array.from({length:6},()=>publicClient.post('/api/admin/login',{headers:{Origin:origin},data:{passcode:'deliberately-invalid-preview-test-value'}})));
 const statuses=attempts.map(r=>r.status());assert.ok(statuses.every(status=>status===401||status===429));assert.ok(statuses.filter(status=>status===401).length<=5);assert.ok(statuses.includes(429),'Concurrent attempts must enforce the shared login limit');
}
test('isolated hosted CMS lifecycle, real Storage, concurrency and browser consistency',{skip:!enabled},async t=>{try{await runHosted(t);}catch{throw new Error(`Hosted Preview integration failed at ${diagnostic.stage}; last HTTP ${diagnostic.status} ${diagnostic.path}; ${diagnostic.error}. Secret details suppressed.`);}});
