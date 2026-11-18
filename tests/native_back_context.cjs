const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm');
const s=fs.readFileSync('index.html','utf8');
const fn=s.slice(s.indexOf('function hasNativeTgBack(){'),s.indexOf('function hasRealTg(){'));
test('browser SDK and linked Telegram account never replace local close controls',()=>{
 for(const initData of ['',undefined,'signed-launch'])for(const supported of [true,false]){
 const tg={initData,BackButton:{show(){},onClick(){}},isVersionAtLeast:()=>supported};
 const c={window:{Telegram:{WebApp:tg}},telegramId:123};vm.createContext(c);vm.runInContext(fn,c);
 assert.equal(c.hasNativeTgBack(),Boolean(initData&&supported));
 }
});
test('SDK without host clears stale native navigation without initializing Telegram UI',()=>{
 let removed=false;
 const c={window:{Telegram:{WebApp:{initData:''}}},document:{documentElement:{removeAttribute:k=>{removed=k==='data-tg-native-back'}}}};
 vm.createContext(c);vm.runInContext(s.slice(s.indexOf('function tgSetupWhenReady(){'),s.indexOf('\n/* ═',s.indexOf('function tgSetupWhenReady(){'))),c);
 assert.equal(c.tgSetupWhenReady(),false);assert(removed);
});
