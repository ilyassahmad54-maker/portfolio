const {test}=require('node:test');
const assert=require('node:assert/strict');
const {loadModule}=require('../scripts/cms/load-module.cjs');
const {readJsonBody}=loadModule('lib/cms/http.ts');
const request=body=>({headers:new Headers({'content-type':'application/json'}),body});

test('request decoder rejects invalid UTF-8 and interrupted streams safely',async()=>{
  const invalid=new ReadableStream({start(controller){controller.enqueue(new Uint8Array([0xc3,0x28]));controller.close();}});
  await assert.rejects(readJsonBody(request(invalid)),error=>error.status===400&&error.publicMessage==='Malformed JSON.');
  const interrupted=new ReadableStream({start(controller){controller.error(new Error('private upstream detail'));}});
  await assert.rejects(readJsonBody(request(interrupted)),error=>error.status===400&&!error.message.includes('private'));
});

test('a stalled request hits its total read deadline and cancels the stream',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});
  let cancelled=false;
  const body=new ReadableStream({start(controller){controller.enqueue(new TextEncoder().encode('{'));},cancel(){cancelled=true;}});
  const pending=readJsonBody(request(body));
  const rejection=assert.rejects(pending,error=>error.status===408);
  await Promise.resolve();await Promise.resolve();
  t.mock.timers.tick(5001);
  await rejection;assert.equal(cancelled,true);
});
