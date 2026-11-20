const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const start=html.indexOf('  var ОТПРАВЛЕНО = {};'),end=html.indexOf("  window.addEventListener('error'",start);
test('error reporting survives Android without AbortSignal.timeout and clears deadline',async()=>{
 const requests=[],deadlines=new Map();let id=0;
 const c={window:{},location:{search:''},AbortController,AbortSignal:{},fetch:(u,o)=>{requests.push(o);return Promise.resolve({ok:true})},setTimeout:(f,ms)=>{deadlines.set(++id,{f,ms});return id},clearTimeout:i=>deadlines.delete(i)};
 vm.createContext(c);vm.runInContext(html.slice(start,end),c);
 c.window.__reportError('profile failed','','profile_timeout');
 assert.equal(requests.length,1);assert(requests[0].signal);
 await new Promise(r=>setImmediate(r));assert.equal(deadlines.size,0);
 c.window.__reportError('profile failed','','profile_timeout');assert.equal(requests.length,1);
});
