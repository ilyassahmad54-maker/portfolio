// Actual existing admin module, isolated with synthetic credentials and an in-memory
// Redis transport. Never reads/modifies process.env or contacts a real service.
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function createAuth() {
  const entries = new Map(), expiries = new Map(), commands = [];
  let time = 0, offline = false;
  const env = { NODE_ENV:'production', VERCEL:'1', ADMIN_PASSCODE:'cms-test-only-passcode-12345', UPSTASH_REDIS_REST_URL:'https://test.invalid', UPSTASH_REDIS_REST_TOKEN:'test-only' };
  const exports = {};
  const fetch = async (_, options) => {
    if (offline) throw new Error('test-only upstream failure with secret-like text');
    const command = JSON.parse(options.body);commands.push(command);
    for (const [key, expiry] of expiries) if (expiry <= time) { entries.delete(key);expiries.delete(key); }
    const [operation,key,value] = command; let result;
    if (operation === 'SET') { entries.set(key,value);expiries.set(key,time+command[4]);result='OK'; }
    if (operation === 'GET') result=entries.get(key)||null;
    if (operation === 'DEL') result=entries.delete(key)?1:0;
    if (operation === 'EVAL') {
      const keys = command.slice(3,3+command[2]);result=0;
      for (const bucket of keys) { const count=(entries.get(bucket)||0)+1;entries.set(bucket,count);if(count===1)expiries.set(bucket,time+60);result=Math.max(result,count); }
    }
    return {ok:true,status:200,json:async()=>({result})};
  };
  const code=ts.transpileModule(fs.readFileSync('lib/admin.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  vm.runInNewContext(code,{exports,require:name=>name==='server-only'?{}:name.startsWith('./')?require('../../scripts/cms/load-module.cjs').loadModule('lib/'+name.slice(2)+'.ts',{'server-only':{}}):require(name),process:{env},fetch,AbortSignal,Buffer,URL,console:{error:()=>{}}});
  return {api:exports,commands,offline:()=>{offline=true;},advance:seconds=>{time+=seconds;},rotate:()=>{env.ADMIN_PASSCODE+='-rotated';}};
}
module.exports={createAuth};
