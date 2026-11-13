const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict'),test=require('node:test');
const html=fs.readFileSync(require('path').join(__dirname,'../index.html'),'utf8');
function fixture(platform){
 const sent=[],classes=new Set(),copied=[];
 const c={URL,encodeURIComponent,navigator:{},localStorage:{getItem:()=>'',setItem(){}},BOT_LINK:'https://t.me/youselllikeagod_bot',APP_URL:'https://club.test/',telegramId:0,track(){},t:k=>k==='share.film_text'?'Фильм о продажах':'',isInsideVk:()=>platform==='vk',isInsideTelegram:()=>platform==='tg',isInsideMax:()=>false,document:{getElementById:()=>({classList:{add:x=>classes.add(x),remove:x=>classes.delete(x)}})},copyInviteText:x=>copied.push(x),showToast(){}};
 c.window=c;c.Telegram={WebApp:{initDataUnsafe:{},openTelegramLink:u=>sent.push(u)}};c.vkBridge={send:async(method,params)=>sent.push({method,...params})};vm.createContext(c);
 vm.runInContext(html.slice(html.indexOf('const VK_APP_LINK '),html.indexOf('function botLinkForPlatform()')),c);
 vm.runInContext(html.slice(html.indexOf('function shareFilm(){'),html.indexOf('function shareBonus(){')),c);
 return {c,sent,classes,copied};
}
test('new guest can share film in Telegram without profile or purchase',()=>{
 const {c,sent}=fixture('tg');c.shareFilm();assert.equal(sent.length,1);
 const url=new URL(sent[0]);assert.equal(url.pathname,'/share/url');assert.equal(new URL(url.searchParams.get('url')).searchParams.get('startapp'),'film');
});
test('film share keeps referral code and uses native VK destination',()=>{
 const {c,sent}=fixture('vk');vm.runInContext("shareCode='friend77'",c);c.shareFilm();
 assert.equal(sent.length,1);assert.equal(sent[0].method,'VKWebAppShare');assert.equal(sent[0].link,'https://vk.ru/app54715238#film_friend77');
});
test('web guest chooses destination, cancel does not copy or send',async()=>{
 const {c,sent,classes,copied}=fixture('web');c.shareFilm();assert(classes.has('gg-open'));assert.equal(sent.length,0);c.shareWhereClose();assert(!classes.has('gg-open'));assert.equal(copied.length,0);
 c.shareFilm();c.shareWherePick('tg');assert.equal(copied.length,1);assert(copied[0].endsWith('https://t.me/youselllikeagod_bot/app?startapp=film'));
 c.navigator.share=async()=>{throw Object.assign(Error('cancelled'),{name:'AbortError'})};c.shareFilm();c.shareWherePick('web');await new Promise(r=>setImmediate(r));assert.equal(copied.length,1);
});
