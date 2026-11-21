const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const code=fs.readFileSync('abort-diagnostics.js','utf8');
function setup(){const listeners={},root={URL,WeakMap,Set,Date,Error,document:{addEventListener:(k,f)=>listeners[k]=f,getElementById:id=>id==='bonus-video-overlay'?{classList:{contains:()=>true}}:null},__APP_READY:true};root.window=root;vm.runInNewContext(code,root);return {d:root.ClubAbortDiagnostics,listeners,root};}
test('identity attribution differs from simultaneous unrelated cancellation; no error mutation',()=>{
 const {d}=setup(),e=Object.freeze({name:'AbortError',message:'SECRET',stack:'play@https://x/index.html?token=SECRET:123:9\nfn@https://x/other.js:8:4'}),ticket=d.begin('media_play',{currentTime:12,readyState:2,networkState:2,paused:true});d.fail(e,ticket,'interrupted');
 const s=d.snapshot(e);assert(s.exact);assert.equal(s.op,'media_play');assert.equal(s.scene,'bonus');assert.equal(s.frames[0],'index.html:123:9');assert(!JSON.stringify(s).includes('SECRET'));assert.equal(d.snapshot({name:'AbortError'}).exact,false);assert.equal(d.snapshot({name:'AbortError'}).op,'unknown');
});
test('passive listeners and bounded ring do not control video',()=>{
 const {d,listeners}=setup();let changes=0;const target={tagName:'VIDEO',closest:()=>true,currentTime:9,readyState:3,networkState:2,paused:false,play:()=>changes++,pause:()=>changes++};
 for(let i=0;i<50;i++){listeners.seeking({target});listeners.pause({target});}assert.equal(changes,0);assert.equal(d.snapshot(null).recent.length,6);assert(d.snapshot(null).recent.every(x=>x.position===9));
});
test('api deadline preserves exact rejection and caller signal versus timeout',async()=>{
 const html=fs.readFileSync('index.html','utf8'),src=html.slice(html.indexOf('async function apiRequest('),html.indexOf('async function diagPingApi('));
 for(const caller of [false,true]){const {root,d}=setup();const error=new DOMException('SECRET','AbortError');Object.assign(root,{AbortController,DOMException,setTimeout,clearTimeout,fetch:(_,o)=>new Promise((resolve,reject)=>o.signal.addEventListener('abort',()=>reject(error),{once:true}))});vm.runInNewContext(src,root);const c=new AbortController(),p=root.apiRequest('https://private/token',{signal:c.signal},caller?1000:3);if(caller)c.abort();await assert.rejects(p,e=>e===error);assert.equal(d.snapshot(error).cause,caller?'caller':'deadline');}
});
test('canonical inlining and network/player hot path keep exact diagnostics optional',()=>{
 const html=fs.readFileSync('index.html','utf8');assert(html.includes(code.trim()));assert(html.includes(fs.readFileSync('client-diagnostics.js','utf8').trim()));assert(html.includes(fs.readFileSync('film-player.js','utf8')));
 assert(!/\.preventDefault\s*\(/.test(code));assert(!code.includes('fetch('));assert(!code.includes('.play('));assert(!code.includes('.pause('));
});

test('scene labels use actual film, live and replay elements without layout measurement',()=>{
 const {root,d}=setup();for(const [id,el,name] of [['funnel-screen',{style:{display:'flex'}},'film'],['live-full',{style:{display:'flex'}},'meeting'],['meeting-recording',{},'meeting'],['view-library',{classList:{contains:()=>true}},'library']]){root.document.getElementById=key=>key===id?el:null;assert.equal(d.snapshot(null).scene,name);}
 root.document.getElementById=key=>key==='funnel-screen'?{style:{display:'none'}}:null;assert.equal(d.snapshot(null).scene,'other');
});
