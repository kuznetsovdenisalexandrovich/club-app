const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const html=fs.readFileSync('index.html','utf8');
const helper=html.slice(html.indexOf('var cardMotionCurrent ='),html.indexOf('function cardMotionAuto()'));
test('saved consent reconnects once per document, current card only',()=>{
 const calls=[],handlers={};const c={window:{},localStorage:{getItem:()=> 'granted'},document:{addEventListener:(n,f)=>handlers[n]=f}};vm.createContext(c);vm.runInContext(helper,c);
 handlers.click();assert.equal(c.cardMotionReconnectAttempted,false);
 c.cardMotionCurrent={startGyro:(ask)=>calls.push(ask)};handlers.click();handlers.click();assert.deepEqual(calls,[true]);
});
for(const choice of ['','declined'])test('no implicit request for '+choice,()=>{let calls=0;const c={window:{},localStorage:{getItem:()=>choice},document:{addEventListener(){}}};vm.createContext(c);vm.runInContext(helper,c);c.cardMotionCurrent={startGyro(){calls++}};c.cardMotionReconnect();assert.equal(calls,0)});
const branch=html.slice(html.indexOf('var rememberedConsent ='),html.indexOf('\n    function stopGyro'));
const logic=branch.slice(0,branch.lastIndexOf('\n    }'));
for(const ask of [true,false])test('remembered preference '+(ask?'reactivates browser API':'listens passively'),async()=>{let requests=0,started=0;const c={ask,window:{},cardMotionChoice:()=> 'granted',DeviceOrientationEvent:{requestPermission:()=>{requests++;return Promise.resolve('granted')}},cb(){},go(){started++}};vm.createContext(c);vm.runInContext('(function(){'+logic+'})()',c);await Promise.resolve();assert.equal(requests,ask?1:0);assert.equal(started,1)});
test('permission confirmed in this document does not request again',()=>{let started=0;const c={ask:true,window:{clubMotionGranted:true},cardMotionChoice:()=> 'granted',DeviceOrientationEvent:{requestPermission(){throw Error('repeated')}},cb(){},go(){started++}};vm.createContext(c);vm.runInContext('(function(){'+logic+'})()',c);assert.equal(started,1)});
