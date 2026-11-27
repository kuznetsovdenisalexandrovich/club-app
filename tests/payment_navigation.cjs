const vm=require('vm'),fs=require('fs'),assert=require('assert/strict');
const root=require('path').join(__dirname,'..');
const text=fs.readFileSync(root+'/index.html','utf8');const code=text.slice(text.indexOf('const paymentNavigationPending ='),text.indexOf('function openUrlResolved(url)'));
(async()=>{for(const mode of [false,true]){
 let opened=[],calls=0;const ctx={URL,document:{addEventListener(){}},appSettings:{payment_portal_enabled:mode},ClubPaymentNavigation:require(root+'/payment-navigation.js'),window:{Telegram:{WebApp:{initDataUnsafe:{user:{id:1}}}}},isInsideTelegram:()=>true,paymentProviderConfig:async()=>{calls++;return{portal_enabled:mode}},openUrlResolved:u=>opened.push(u),showToast:m=>{throw Error(m)}};vm.createContext(ctx);vm.runInContext(code,ctx);
 const url='https://payform.ru/path/?signature=a%2Bb';const a=ctx.openUrl(url),b=ctx.openUrl(url);await Promise.all([a,b]);assert.equal(calls,1);assert.equal(opened.length,1);assert.equal(opened[0],ctx.ClubPaymentNavigation.route(url,mode));ctx.openUrl('https://t.me/example');assert.equal(calls,1);
 ctx.paymentProviderConfig=async()=>{throw Error('offline')};ctx.showToast=()=>{};await ctx.openUrl(url);assert.equal(opened.length,3);assert.equal(opened[2],ctx.ClubPaymentNavigation.route(url,mode));console.log('mode',mode,'fresh route + dedup + configuration failure preserves ready order: OK');
 }})();
;(async()=>{
 for(const closed of [false,true]){
 let destination='',exit=0,resolve;
 const popup={closed:false,document:{body:{style:{}}},location:{replace:u=>destination=u},close(){this.closed=true}};
 const c={URL,document:{addEventListener(){}},ClubPaymentNavigation:require(root+'/payment-navigation.js'),window:{open:()=>popup,clubExitExternal:()=>exit++},isInsideTelegram:()=>false,paymentProviderConfig:()=>new Promise(r=>resolve=r),openUrlResolved:()=>{throw Error('unexpected replacement popup')},showToast:()=>{throw Error('unexpected error')}};
 vm.createContext(c);vm.runInContext(code,c);const task=c.openUrl('https://payform.ru/order');assert.equal(popup.document.body.textContent,'Открываем оплату…');popup.closed=closed;resolve({portal_enabled:true});await task;assert.equal(exit,closed?0:1);assert.equal(destination,closed?'':c.ClubPaymentNavigation.route('https://payform.ru/order',true));
 }
 console.log('web: loading screen, same popup, close cancellation: OK');
})();
