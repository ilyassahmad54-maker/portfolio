const {test}=require('node:test');const assert=require('node:assert/strict');const {randomUUID}=require('node:crypto');const {NextRequest}=require('next/server');
const {loadModule}=require('../scripts/cms/load-module.cjs');const {createApi}=require('./helpers/cms-api.cjs');const published=require('../data.json');
const {PortfolioEditor}=loadModule('lib/cms/editor.ts');const legacy=loadModule('lib/cms/legacy.ts');
const initial={content:published,revisionId:null,sequence:null,source:'fallback',readOnly:true};
async function setup(t){
 const objects=new Map(),storage={put:async(p,b)=>objects.set(p,b),get:async p=>{if(!objects.has(p))throw new Error('Missing');return objects.get(p);}};
 const a=await createApi(storage);t.after(()=>a.close());let expired=false,fail=false,conflict=false,lose=false;const requests=[];
 const fetcher=async(url,options={})=>{
  if(url==='/api/admin/session')return new Response('{}',{status:expired?401:200});
  if(url==='/api/admin/login'){expired=false;return Response.json({ok:true});}
  if(url==='/api/admin/logout'){expired=true;return Response.json({ok:true});}
  requests.push({url,body:options.body});
  if(expired&&url.startsWith('/api/admin'))return new Response('{}',{status:401});
  if(fail){fail=false;throw new Error('Network failure');}
  if(conflict){conflict=false;return new Response('{}',{status:409});}
  if(url==='/api/admin/assets/upload')return a.assetHandler('upload')(new NextRequest('https://portfolio.test'+url,{...options,headers:{...options.headers,cookie:a.cookie,origin:'https://portfolio.test'}}));
  const op=url.startsWith('/api/content')?'published':url.includes('/draft')?(options.method==='POST'?'save':'draft'):url.split('/').pop().split('?')[0];
  const result=await a.handler(op)(new NextRequest('https://portfolio.test'+url,{...options,headers:{...options.headers,cookie:a.cookie,origin:'https://portfolio.test'}}));if(lose&&options.method==='POST'){lose=false;throw new Error('Committed response lost');}return result;
 };
 const editor=new PortfolioEditor(initial,fetcher,randomUUID);await editor.checkSession();await editor.load();
 return {a,editor,objects,requests,expire(){expired=true;},fail(){fail=true;},conflict(){conflict=true;},lose(){lose=true;}};
}
test('public reader uses only published content and validated durable backup on failure',async()=>{
 let offline=false,stored=null;const data=structuredClone(published),snapshot={content:data,revisionId:randomUUID(),sequence:2};
 const {createPublishedReader}=loadModule('lib/cms/public-content.ts',{'server-only':{},react:{cache:fn=>fn},'../admin':{},'./store':{cmsStore:{},decodePublished:loadModule('lib/cms/store.ts',{'server-only':{},'./database':{}}).decodePublished}});
 const reader=createPublishedReader(async()=>{if(offline)throw new Error();return snapshot;},{read:async()=>stored,write:async value=>{stored=structuredClone(value);}});
 assert.equal((await reader()).source,'database');offline=true;assert.deepEqual((await reader()).content,published);assert.equal((await reader()).source,'last-known-published');stored={content:{projects:[]}};assert.equal((await reader()).source,'fallback');
});
test('editor save, saved preview, publish, discard, history and restore use protected APIs',async t=>{
 const {editor:e}=await setup(t);assert.deepEqual(e.display,published);
 e.edit(current=>({...current,profile:{...current.profile,headline:'Unpublished headline'}}));assert.equal(e.dirty,true);assert.equal(e.display.profile.headline,published.profile.headline);
 assert.equal(await e.publish(true),false);assert.equal(await e.save(),true);assert.equal(e.dirty,false);
 assert.equal(await e.previewSaved(),true);assert.equal(e.display.profile.headline,'Unpublished headline');e.showPublished();
 assert.equal(await e.publish(true),true);assert.equal(e.display.profile.headline,'Unpublished headline');
 assert.equal(await e.history(),true);const seed=e.snapshot().history.items.find(item=>item.operation==='seed');assert.equal(await e.viewRevision(seed.revisionId),true);assert.equal(e.display.profile.headline,published.profile.headline);
 assert.equal(await e.restore(seed.revisionId,true),true);assert.deepEqual(e.display,published);
 e.edit(current=>({...current,profile:{...current.profile,name:'Unpublished name'}}));assert.equal(await e.discard(false),false);assert.equal(await e.discard(true),true);assert.deepEqual(e.snapshot().working,published);
});
test('session expiry and stale conflicts retain unsaved work; reload requires explicit consent',async t=>{
 const s=await setup(t),e=s.editor;e.edit(current=>({...current,profile:{...current.profile,name:'Retain my work'}}));s.expire();
 assert.equal(await e.save(),false);assert.equal(e.snapshot().expired,true);assert.equal(e.snapshot().working.profile.name,'Retain my work');assert.deepEqual(e.display,published);
 assert.equal(await e.login('test-only'),true);assert.equal(e.snapshot().working.profile.name,'Retain my work');s.conflict();assert.equal(await e.save(),false);assert.equal(e.snapshot().conflict,true);assert.equal(e.snapshot().working.profile.name,'Retain my work');
 assert.equal(await e.load(),false);assert.equal(await e.load(true),true);assert.deepEqual(e.snapshot().working,published);
});
test('uncertain requests reuse the same idempotency key and prevent unrelated overwrites',async t=>{
 const s=await setup(t),e=s.editor;e.edit(current=>({...current,profile:{...current.profile,name:'Retry me'}}));s.fail();assert.equal(await e.save(),false);const request=JSON.parse(s.requests.at(-1).body);
 assert.equal(await e.save(),true);assert.equal(JSON.parse(s.requests.at(-1).body).requestId,request.requestId);
});
test('legacy imports are selective, preserve newer projects/images, and never publish automatically',async t=>{
 const {editor:e}=await setup(t);const old=structuredClone(published);old.projects=old.projects.slice(1);old.projects[0].image='/assets/projects/multimodal-ai.jpg';old.profile.headline='Import just this';old.adminPasscode='obsolete-field';
 const raw=JSON.stringify(old);e.setLegacy(raw);assert.deepEqual(e.display,published);assert.equal(e.compare(raw),true);
 const selected=e.snapshot().importChanges.find(change=>change.path.join('.')==='profile.headline');assert.equal(await e.importSelected([selected.id]),true);
 assert.equal(e.snapshot().working.projects.length,8);assert.equal(e.snapshot().working.projects[1].image,published.projects[1].image);assert.equal(e.snapshot().working.profile.headline,'Import just this');assert.deepEqual(e.display,published);assert.equal(e.snapshot().legacy,raw);assert.equal(e.dirty,true);
 assert.throws(()=>legacy.compareImport(published,'{"profile":{},"projects":[],"__proto__":{}}'));
});
test('embedded legacy images use secure uploads and authenticated previews, not data/blob URLs',async t=>{
 const {editor:e}=await setup(t);const sharp=require('sharp'),bytes=await sharp({create:{width:2,height:2,channels:3,background:'red'}}).png().toBuffer();const data=structuredClone(published);data.projects[0].image='data:image/png;base64,'+bytes.toString('base64');
 assert.equal(e.compare(JSON.stringify(data)),true);assert.equal(await e.importSelected(e.snapshot().importChanges.map(change=>change.id)),true);
 const reference=e.snapshot().working.projects[0].image;assert.match(reference,/^\/api\/assets\//);assert.equal(legacy.imageSource(reference,true),reference.replace('/api/assets/','/api/admin/assets/'));assert.equal(legacy.imageSource(reference,false),reference);assert.equal(e.snapshot().saved.content.projects[0].image,published.projects[0].image);
});
test('project order operations and comparison conflicts preserve content',()=>{
 const first=published.projects[0].id;const moved=legacy.reorderProject(published,first,1);assert.equal(moved.projects[1].id,first);assert.deepEqual(legacy.reorderProject(moved,first,-1),published);assert.equal(published.projects.length,8);
 const draft=structuredClone(published);draft.profile.name='Different';const changes=legacy.compareImport(published,JSON.stringify(draft));const edited=structuredClone(published);edited.profile.name='Newer';assert.throws(()=>legacy.applyImport(edited,changes,[changes[0].id]));
});
test('metadata canonical and social preview come only from the published input',()=>{
 const {portfolioMetadata,PRODUCTION_URL}=loadModule('lib/cms/metadata.ts');const meta=portfolioMetadata(published);assert.equal(meta.alternates.canonical,PRODUCTION_URL);assert.equal(meta.metadataBase.origin,PRODUCTION_URL);assert.equal(meta.description,published.profile.summary);assert.equal(meta.openGraph.images[0].url,published.profile.profileImage);
 const previous=process.env.VERCEL_ENV;
 try{process.env.VERCEL_ENV='preview';assert.deepEqual(portfolioMetadata(published).robots,{index:false,follow:false});}
 finally{if(previous===undefined)delete process.env.VERCEL_ENV;else process.env.VERCEL_ENV=previous;}
});
test('newer published client snapshot is retained through stale or degraded public responses',async()=>{
 const live={content:structuredClone(published),revisionId:randomUUID(),sequence:10,source:'database',readOnly:false};live.content.profile.headline='Latest publication';
 const e=new PortfolioEditor(live,async()=>Response.json(initial),randomUUID);await e.refreshPublic();assert.equal(e.display.profile.headline,'Latest publication');assert.equal(e.snapshot().published.readOnly,true);
});
test('invalid unsaved links cannot enter an admin portfolio preview',async t=>{
 const {editor:e}=await setup(t);e.edit(current=>({...current,projects:current.projects.map((p,i)=>i===0?{...p,githubUrl:'javascript:alert(1)'}:p)}));assert.equal(e.previewWorking(),false);assert.deepEqual(e.display,published);
});
test('concurrent editor actions do not send duplicate mutations',async t=>{
 const {editor:e,a}=await setup(t);e.edit(current=>({...current,profile:{...current.profile,name:'One save only'}}));const results=await Promise.all([e.save(),e.save()]);assert.deepEqual(results.sort(),[false,true]);assert.equal((await a.db.query('SELECT count(*)::int n FROM cms.operation_receipts')).rows[0].n,1);
});

test('lost committed response retries once through database idempotency without duplicate revisions',async t=>{
 const s=await setup(t),e=s.editor;e.edit(current=>({...current,profile:{...current.profile,name:'Committed once'}}));s.lose();assert.equal(await e.save(),false);assert.equal(await e.save(),true);assert.equal(e.snapshot().saved.state.version,2);assert.equal((await s.a.db.query('SELECT count(*)::int n FROM cms.operation_receipts')).rows[0].n,1);
});
test('post-commit refresh failure reports discard completion and keeps editor work for backup',async()=>{
 const state={version:1,publishedRevisionId:randomUUID(),draftRevisionId:randomUUID(),hasDraft:false,updatedAt:new Date().toISOString()};let reads=0;
 const e=new PortfolioEditor(initial,async(url,options={})=>{
  if(url.endsWith('/session'))return Response.json({});
  if(url.endsWith('/discard'))return Response.json({state:{...state,version:2},revisionId:state.publishedRevisionId,replayed:false});
  if(url.endsWith('/draft')&&options.method==='GET'){reads++;return reads===1?Response.json({state,revisionId:state.draftRevisionId,content:published}):new Response('{}',{status:503});}
  throw new Error('Unexpected request');
 },randomUUID);
 await e.checkSession();await e.load();e.edit(current=>({...current,profile:{...current.profile,name:'Keep for backup'}}));assert.equal(await e.discard(true),true);assert.match(e.snapshot().status,/completed on server/);assert.equal(e.snapshot().saved,null);assert.equal(e.snapshot().working.profile.name,'Keep for backup');
});
