// Offline only: preserve reviewed source, assets and SQL without copying secrets.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const {createPlan,validatePlan}=require('./migration-plan.cjs');
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function prepare(){
 const {directory,manifest}=createPlan();const root=fs.realpathSync(process.cwd()),files=[];
 const allowed=['app','components','lib/cms','scripts/cms','supabase','tests','docs','types','data'];
 const walk=dir=>{for(const item of fs.readdirSync(dir,{withFileTypes:true})){const name=path.join(dir,item.name);if(item.isSymbolicLink())throw new Error();if(item.isDirectory())walk(name);else if(/\.(tsx?|cjs|mjs|json|sql|md|css|svg)$/.test(name))files.push(name);}};
 allowed.forEach(walk);files.push('package.json','package-lock.json','next.config.js','tsconfig.json','eslint.config.mjs','lib/admin.ts','lib/admin-backend.ts','lib/admin-postgres.ts');
 const sourceFiles=[...new Set(files)].sort().map(name=>{
  const resolved=fs.realpathSync(name);if(!resolved.startsWith(root+path.sep))throw new Error();
  const bytes=fs.readFileSync(resolved),target=path.join(directory,'source',name);fs.mkdirSync(path.dirname(target),{recursive:true,mode:0o700});fs.writeFileSync(target,bytes,{flag:'wx',mode:0o600});
  return {path:name,bytes:bytes.length,sha256:hash(bytes)};
 });
 const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
 const result={formatVersion:1,createdAt:new Date().toISOString(),branch:git('branch','--show-current'),head:git('rev-parse','HEAD'),cachedOriginMain:git('rev-parse','origin/main'),remoteFreshness:'Verify separately using git ls-remote origin refs/heads/main',canonicalSourceSha256:manifest.canonicalSourceSha256,projectCount:manifest.projects.length,projects:manifest.projects,migrations:manifest.files.filter(f=>f.path.startsWith('supabase/migrations/')),previewOnlyMigrations:manifest.files.filter(f=>f.path.startsWith('supabase/preview-migrations/')),sourceFiles,seed:'seed-preview.cjs: dry-run default; --apply --backup <reviewed-directory> only after separate approval',hostedChangesPerformed:false};
 fs.writeFileSync(path.join(directory,'integration-manifest.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx',mode:0o600});validatePlan(directory);
 for(const file of sourceFiles)if(hash(fs.readFileSync(path.join(directory,'source',file.path)))!==file.sha256)throw new Error();
 return {directory,result};
}
if(require.main===module){try{const {directory,result}=prepare();console.log(`Offline integration backup: ${directory}\nVerified source files: ${result.sourceFiles.length}; projects: ${result.projectCount}; migrations: ${result.migrations.length}\nCanonical SHA-256: ${result.canonicalSourceSha256}`);}catch{console.error('Preview preparation failed; no hosted resources accessed.');process.exitCode=1;}}
module.exports={prepare};
