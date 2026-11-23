const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const code=source.slice(source.indexOf('async function ggFetch('),source.indexOf('/* После сбоя:',source.indexOf('async function ggFetch(')));
function setup(fetch){const ctx=vm.createContext({fetch,AbortController,Response,setTimeout,clearTimeout});vm.runInContext(code,ctx);return ctx.ggFetch;}
test('game request deadline includes a stalled response body',async()=>{
 let aborted=false;const request=setup(async(url,{signal})=>({arrayBuffer:()=>new Promise((resolve,reject)=>{signal.addEventListener('abort',()=>{aborted=true;reject(new Error('aborted body'));});})}));
 await assert.rejects(request('fixture',{},20),/aborted body/);assert(aborted);
});
test('game response retains JSON status and headers',async()=>{
 const request=setup(async()=>new Response(JSON.stringify({score:35}),{status:503,headers:{'content-type':'application/json'}}));
 const r=await request('fixture',{},500);assert.equal(r.status,503);assert.equal(r.headers.get('content-type'),'application/json');assert.deepEqual(await r.json(),{score:35});
});
test('completed body clears the abort timer',async()=>{
 let signal;const request=setup(async(url,options)=>{signal=options.signal;return new Response('{}');});
 await request('fixture',{},20);await new Promise(r=>setTimeout(r,40));assert(!signal.aborted);
});
