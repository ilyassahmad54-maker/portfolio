// Read-only hosted check. Still requires approved isolated connectivity.
const fs=require('node:fs');const {loadModule}=require('./load-module.cjs');
async function check(){
 if(process.env.CMS_PREVIEW_CHECK!=='isolated-preview'||process.env.VERCEL_ENV!=='preview')throw new Error();
 const {queryCms}=loadModule('lib/cms/database.ts',{'server-only':{}});
 const audit=await queryCms(fs.readFileSync('supabase/verification/preview-runtime.sql','utf8'));
 if(!audit||Object.keys(audit).length!==9||Object.values(audit).some(value=>value!==true))throw new Error();
 if(process.env.ADMIN_STATE_BACKEND==='postgres'){
  const auth=await queryCms(fs.readFileSync('supabase/verification/preview-auth.sql','utf8'));
  if(!auth||Object.keys(auth).length!==6||Object.values(auth).some(value=>value!==true))throw new Error();
 }
 const result=await queryCms('SELECT cms.read_published() AS result');
 const {decodePublished}=loadModule('lib/cms/store.ts',{'server-only':{}}),{contentHash}=loadModule('lib/cms/document.ts');
 const snapshot=decodePublished(result);if(snapshot.content.projects.length!==8||contentHash(snapshot.content)!==contentHash(JSON.parse(fs.readFileSync('data.json'))))throw new Error();
 console.log('Preview TLS/driver/runtime permissions, RLS and eight-project baseline checks passed.');
}
if(require.main===module)check().catch(()=>{console.error('Preview check refused or failed; details suppressed. Verify isolated configuration and database diagnostics.');process.exitCode=1;});
module.exports={check};
