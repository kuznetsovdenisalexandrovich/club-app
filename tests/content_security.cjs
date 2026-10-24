const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const wrapper=html.slice(html.indexOf("let clubPass = '', clubPassId = '';"),html.indexOf('/* ══ v464 · ПЕРЕХОД'));
const ensure=html.slice(html.indexOf('function clubPassTgData(){'),html.indexOf('function showAccessRestricted(){'));
function setup(id=77){
 const calls=[],storage=new Map();let restricted=0;
 const pass=id+'.'+(Math.floor(Date.now()/1000)+86400*30)+'.signed';
 const context={URL,Headers,Date,JSON,Promise,encodeURIComponent,console,API_PROD:'https://api.example',API_STANDBY:'https://backup.example',API_URL:'https://api.example',telegramId:id,
  location:{href:'https://app.example/'},localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},sessionHeaders:()=>({'X-Session-Token':'web-session'}),launchIdentity:()=>({vk_launch:'signed-vk'}),tgLaunchData:()=>'',showAccessRestricted:()=>restricted++,
  fetch:async(input,init)=>{calls.push({input,init});await new Promise(r=>setTimeout(r,1));return new Response(JSON.stringify(input.includes('/auth/pass')?{passes:{[id]:pass}}:input.includes('/restricted')?{detail:{code:'access_restricted'}}:{items:[]}),{status:input.includes('/restricted')?403:200});}};
 context.window=context;vm.createContext(context);vm.runInContext(wrapper+'\n'+ensure,context);
 return {context,calls,pass,restricted:()=>restricted};
}
(async()=>{
 const a=setup();await Promise.all([a.context.fetch('https://api.example/lectures'),a.context.fetch('https://api.example/streams/course/lectures')]);
 assert.equal(a.calls.filter(x=>x.input.includes('/auth/pass')).length,1);
 for(const call of a.calls.filter(x=>!x.input.includes('/auth/pass'))){assert.equal(new URL(call.input).searchParams.get('_cp'),a.pass);}
 await a.context.fetch('https://api.example/lectures',{headers:new Headers({'X-Test':'retained'})});assert.equal(a.calls.at(-1).init.headers.get('X-Test'),'retained');
 await a.context.fetch('https://api.example/restricted');assert.equal(a.restricted(),1);
 const before=a.calls.length;await a.context.fetch('https://api.example.evil.test/lectures');
 assert.equal(a.calls.length,before+1);assert.equal(a.calls.at(-1).init,undefined);assert.ok(!a.calls.at(-1).input.includes('_cp'));
 const guest=setup(null);await guest.context.fetch('https://api.example/lectures');assert.equal(guest.calls.length,1);assert.ok(!guest.calls[0].input.includes('_cp'));
 const audio=html.slice(html.indexOf('function plHasAudio('),html.indexOf('\n',html.indexOf('function plHasAudio(')));
 vm.runInContext(audio,a.context);assert.ok(a.context.plHasAudio({has_audio:true,audio_url:''}));assert.ok(a.context.plHasAudio({audio_url:'legacy'}));assert.ok(!a.context.plHasAudio({has_audio:false,audio_url:''}));
 const b=setup();vm.runInContext("clubPass='77.1.expired';clubPassId='77';",b.context);await b.context.fetch('https://api.example/lectures');assert.equal(b.calls.filter(x=>x.input.includes('/auth/pass')).length,1);
 console.log('PASS: single-flight first login, pass attachment, exact-origin isolation, guests, audio preview availability, expired-pass renewal');
})().catch(e=>{console.error(e);process.exit(1)});
