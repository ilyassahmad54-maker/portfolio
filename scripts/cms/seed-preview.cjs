// NEVER run --apply until the dedicated Preview database and seed are approved.
const fs=require('node:fs'),path=require('node:path'),postgres=require('postgres');
const {createPlan,validatePlan}=require('./migration-plan.cjs');
function seedConnection(env){
 const ref=env.CMS_PREVIEW_PROJECT_REF;
 if(env.CMS_SEED_APPROVAL!=='isolated-preview' || !/^[a-z0-9]{20}$/.test(ref||'') || env.VERCEL_ENV==='production')throw new Error();
 const uri=env.CMS_PREVIEW_SEED_DATABASE_URL,url=new URL(uri);
 const name=decodeURIComponent(url.username);
 if(!['postgres:','postgresql:'].includes(url.protocol)||!url.password||url.search||url.hash||url.pathname!=='/postgres'||
  !/^portfolio_cms_preview_seed(?:\.|$)/.test(name)||
  !((url.hostname===`db.${ref}.supabase.co` && name==='portfolio_cms_preview_seed') || (/^[a-z0-9.-]+\.pooler\.supabase\.com$/.test(url.hostname)&&name===`portfolio_cms_preview_seed.${ref}`)))throw new Error();
 return uri;
}
async function apply(directory,env=process.env,factory=postgres){
 const manifest=validatePlan(directory);
 const canonical=fs.readFileSync(path.join(directory,'seed-source.canonical.json'),'utf8');
 const {loadModule}=require('./load-module.cjs'),{contentHash}=loadModule('lib/cms/document.ts');
 if(manifest.projects.length!==8||contentHash(JSON.parse(fs.readFileSync('data.json')))!==manifest.canonicalSourceSha256)throw new Error();
 const ca=env.SUPABASE_DATABASE_CA;if(ca&&(ca.length>32768||!ca.includes('-----BEGIN CERTIFICATE-----')||!ca.includes('-----END CERTIFICATE-----')))throw new Error();
 const sql=factory(seedConnection(env),{prepare:false,max:1,ssl:{rejectUnauthorized:true,...(ca?{ca}:{})},connect_timeout:5,idle_timeout:5,onnotice:()=>{}});
 let timer;
 try{
  const deadline=new Promise((_,reject)=>{timer=setTimeout(()=>{void sql.end({timeout:0}).catch(()=>{});reject(new Error('Seed deadline'));},20000);});
  return await Promise.race([deadline,(async()=>{
  const rows=await sql.unsafe(`SELECT NOT (rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolreplication)
   AND pg_has_role(current_user,'portfolio_cms_seed','USAGE')
   AND NOT pg_has_role(current_user,'portfolio_cms_owner','MEMBER')
   AND NOT pg_has_role(current_user,'portfolio_cms_runtime','MEMBER') AS allowed FROM pg_roles WHERE rolname=current_user`);
  if(rows.length!==1||rows[0].allowed!==true)throw new Error();
  const result=await sql.unsafe('SELECT cms.seed_published($1::text,$2::text) AS revision',[canonical,manifest.canonicalSourceSha256]);
  if(result.length!==1||!/^[0-9a-f-]{36}$/.test(result[0].revision))throw new Error();
  return result[0].revision;
  })()]);
 }finally{clearTimeout(timer);await sql.end({timeout:5});}
}
if(require.main===module){(async()=>{try{
 const args=process.argv.slice(2);
 if(args.length===0){const plan=createPlan();console.log(`DRY RUN ONLY; eight-project seed backup: ${plan.directory}`);return;}
 if(args.length!==3||args[0]!=='--apply'||args[1]!=='--backup')throw new Error();
 const revision=await apply(args[2]);console.log(`Isolated Preview seed verified: ${revision}`);
}catch{console.error('Preview seed refused or failed. Verify approval, isolated target, role, backup and connectivity. No credentials are logged; an ambiguous timeout requires retrying the same verified seed.');process.exitCode=1;}})();}
module.exports={seedConnection,apply};
