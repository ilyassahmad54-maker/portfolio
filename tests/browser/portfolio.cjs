// Production build UI smoke tests. Run separately: npm run test:browser.
const {test}=require('node:test');const assert=require('node:assert/strict');const {chromium}=require('playwright-core');const data=require('../../data.json');const {randomUUID}=require('node:crypto');
const fs=require('node:fs');const artifacts='/tmp/portfolio-cms-phase5';fs.mkdirSync(artifacts,{recursive:true});
const origin=process.env.CMS_TEST_ORIGIN||'http://127.0.0.1:3105';
const chrome=process.env.CMS_TEST_CHROME||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
// All authenticated API traffic is intercepted; no hosted DB/Redis/Storage touched.
async function mock(context){let content=structuredClone(data),version=1,draft=randomUUID(),published=randomUUID();
 const state=()=>({version,draftRevisionId:draft,publishedRevisionId:published,hasDraft:JSON.stringify(content)!==JSON.stringify(data),updatedAt:new Date().toISOString()});
 await context.route('**/api/admin/**',async route=>{
  const req=route.request(),url=new URL(req.url());let result={};
  if(url.pathname==='/api/admin/session')result={authenticated:true};
  else if(url.pathname==='/api/admin/content/draft'&&req.method()==='GET')result={content,revisionId:draft,state:state()};
  else if(url.pathname==='/api/admin/content/draft'){content=req.postDataJSON().content;version++;draft=randomUUID();result={revisionId:draft,state:state(),replayed:false};}
  else if(url.pathname==='/api/admin/content/preview')result={content,revisionId:draft,state:state()};
  else if(url.pathname==='/api/admin/content/history')result={items:[{revisionId:published,sequence:1,operation:'seed',createdAt:new Date().toISOString()}],state:state(),nextCursor:null};
  else if(url.pathname==='/api/admin/content/publish'){version++;published=draft;result={revisionId:published,state:state(),replayed:false};}
  else if(url.pathname==='/api/admin/content/revision')result={content:data,revisionId:published,state:state(),sequence:1,operation:'seed',createdAt:new Date().toISOString()};
  await route.fulfill({json:result});
 });
}

test('production desktop and mobile render identical public projects and canonical SEO without localStorage overrides',async t=>{
 const browser=await chromium.launch({executablePath:chrome,headless:true});t.after(()=>browser.close());const snapshots=[];
 for(const viewport of [{width:1440,height:1000},{width:390,height:844}]){
  const context=await browser.newContext({viewport});t.after(()=>context.close());await context.addInitScript(value=>localStorage.setItem('portfolio_custom_data',JSON.stringify(value)),{...data,projects:[]});
  await context.route('**/api/admin/session',route=>route.fulfill({status:401,json:{}}));
  const page=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));await page.goto(origin,{waitUntil:'networkidle'});
  const titles=await page.locator('#projects h3').allTextContents();assert.equal(titles.length,8);assert.deepEqual(titles,data.projects.map(project=>project.title));snapshots.push(titles);await page.waitForTimeout(1500);await page.screenshot({path:`${artifacts}/public-${viewport.width}.png`});
  assert.equal(await page.locator('link[rel=canonical]').getAttribute('href'),'https://portfolio-woad-nu-owt4y7t889.vercel.app');
assert.equal(errors.length,0,errors.join('\n'));
  assert.equal(JSON.parse(await page.evaluate(()=>localStorage.getItem('portfolio_custom_data'))).projects.length,0);
  await page.getByRole('button',{name:'Data Analytics & Viz',exact:true}).click();await page.waitForTimeout(500);assert.ok((await page.locator('#projects h3').allTextContents()).includes('Unemployment Data Analysis Dashboard'));
 }
 assert.deepEqual(...snapshots);
});

test('existing drawer loads CMS draft, edits project order, saves and previews without changing browser drafts',async t=>{
 const browser=await chromium.launch({executablePath:chrome,headless:true});t.after(()=>browser.close());
 const context=await browser.newContext({viewport:{width:390,height:844}});t.after(()=>context.close());await mock(context);
 const legacy={...data,profile:{...data.profile,headline:'Legacy unpublished headline'}};await context.addInitScript(value=>localStorage.setItem('portfolio_custom_data',JSON.stringify(value)),legacy);
 const page=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));await page.goto(origin,{waitUntil:'networkidle'});assert.equal(errors.length,0,errors.join('\n'));await page.locator('button[title^="Open Admin Edit Mode"]').click();
 await page.getByText('Portfolio Draft Editor',{exact:true}).waitFor();await page.getByText('Saved draft loaded',{exact:false}).waitFor();
 assert.equal(await page.getByText('Legacy browser draft detected.',{exact:false}).count(),1);await page.screenshot({path:`${artifacts}/editor-mobile.png`});
 await page.getByRole('button',{name:'Compare Browser Draft',exact:true}).click();assert.equal(await page.locator('input[type=checkbox]:checked').count(),0);
 await page.getByRole('button',{name:'Cancel Comparison',exact:true}).click();
 await page.getByRole('button',{name:'Projects',exact:true}).click();
 await page.getByRole('button',{name:'Add New Project',exact:true}).click();
 const projects=page.locator('fieldset input[type=text]');await projects.first().fill('Browser test project');assert.equal(await page.evaluate(()=>window.dispatchEvent(new Event('beforeunload',{cancelable:true}))),false);
 await page.getByRole('button',{name:'Move Browser test project down',exact:true}).click();
 await page.getByRole('button',{name:'Save Draft',exact:true}).click();await page.getByText('Draft saved',{exact:false}).waitFor();
 await page.getByRole('button',{name:'Preview Draft',exact:true}).click();await page.getByText('Admin preview — unpublished content',{exact:false}).waitFor();
 assert.ok((await page.locator('#projects h3').allTextContents()).includes('Browser test project'));
 assert.deepEqual(JSON.parse(await page.evaluate(()=>localStorage.getItem('portfolio_custom_data'))),legacy);
 await page.getByRole('button',{name:'Show Published',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('#projects h3').length===8);
 await page.getByRole('button',{name:'Open Editor',exact:true}).click();
 page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'Delete Browser test project',exact:true}).click();
 assert.equal(await page.getByRole('button',{name:'Delete Browser test project',exact:true}).count(),0);
 assert.deepEqual(JSON.parse(await page.evaluate(()=>localStorage.getItem('portfolio_custom_data'))),legacy);
});

test('production CV and contact form remain functional without sending external messages',async t=>{
 const browser=await chromium.launch({executablePath:chrome,headless:true});t.after(()=>browser.close());const context=await browser.newContext();t.after(()=>context.close());
 const page=await context.newPage();let submitted;await page.route(data.profile.formspreeEndpoint,async route=>{submitted=route.request().postDataJSON();await route.fulfill({json:{ok:true}});});
 await page.goto(origin,{waitUntil:'networkidle'});const cv=await context.request.get(new URL(data.profile.cvUrl,origin).href);assert.equal(cv.status(),200);assert.ok((await cv.body()).subarray(0,5).equals(Buffer.from('%PDF-')));
 await page.locator('#contact input[name=name]').fill('Local QA');await page.locator('#contact input[name=email]').fill('qa@example.invalid');await page.locator('#contact input[name=subject]').fill('Local test');await page.locator('#contact textarea[name=message]').fill('Intercepted locally; never sent externally.');
 await page.getByRole('button',{name:'Send Message',exact:true}).click();await page.getByText("Message sent! I'll get back to you soon.").waitFor();assert.equal(submitted.name,'Local QA');
});
