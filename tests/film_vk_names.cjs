const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict'),test=require('node:test');
const source=fs.readFileSync('index.html','utf8');
const part=source.slice(source.indexOf('var filmVkNamePromise='),source.indexOf('function filmPositionKey('));
function context({vk=true,reply,throwing=false,explicit=false}={}){
 let calls=0;const bridge={send:()=>{calls++;if(throwing)throw Error('bridge');return reply;}};
 const c={Promise,clearTimeout,setTimeout:(f)=>setTimeout(f,10),isInsideVk:()=>vk,tgContactFields:()=>({tg_first_name:'Татьяна'}),filmEdition:()=>explicit?'a'.repeat(32):'',filmNameKey:()=>'',vkUserId:()=>123,window:{vkBridge:bridge},vkBridge:bridge};vm.createContext(c);vm.runInContext(part,c);return {c,calls:()=>calls};
}
test('VK gets own first name and caches one request',async()=>{const {c,calls}=context({reply:Promise.resolve({id:123,first_name:'Екатерина'})});assert.equal(await c.filmContactName(),'Екатерина');assert.equal(await c.filmContactName(),'Екатерина');assert.equal(calls(),1);assert.equal(c.filmManifestQuery(await c.filmContactName()),'?direct_capable=1&name='+encodeURIComponent('Екатерина'));});
test('TG has no VK request',async()=>{const {c,calls}=context({vk:false});assert.equal(await c.filmContactName(),'Татьяна');assert.equal(calls(),0);});
test('missing, rejected, thrown, foreign and hung bridge all retain neutral film',async()=>{for(const opts of [{reply:Promise.resolve(null)},{reply:Promise.reject(Error())},{throwing:true},{reply:Promise.resolve({id:999,first_name:'Другой'})},{reply:new Promise(()=>{})}]){const {c}=context(opts);assert.equal(await c.filmContactName(),'');assert.equal(c.filmManifestQuery(''),'?direct_capable=1');}});
test('explicit edition does not wait for VK profile',async()=>{const {c,calls}=context({explicit:true});assert.equal(await c.filmContactName(),'');assert.equal(calls(),0);assert.equal(c.filmManifestQuery(''),'?direct_capable=1&edition='+'a'.repeat(32));});
