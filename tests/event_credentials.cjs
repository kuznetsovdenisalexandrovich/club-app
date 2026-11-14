const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');
const html=fs.readFileSync('promo-kit.html','utf8');const code=html.slice(html.indexOf('function track(event, ref, value){'),html.indexOf('\n/*',html.indexOf('function track(event, ref, value){')));
for(const kind of ['tg','sdk','vk','web','anonymous'])test('promo event credentials '+kind,()=>{
 let sent;const context={window:kind==='sdk'?{Telegram:{WebApp:{initData:'signed_sdk'}}}:{},telegramId:kind==='anonymous'||kind==='vk'?0:77,isInsideVk:()=>kind==='vk',vkLaunchQuery:()=> 'signed_vk',tgLaunchData:()=>kind==='tg'?'signed_tg':'',sessionHeaders:()=>kind==='web'?{'X-Session-Token':'session'}:{},tgContactFields:()=>({}),API_URL:'https://api.example',fetch:(url,init)=>{sent=init;return Promise.resolve({})},encodeURIComponent};
 vm.createContext(context);vm.runInContext(code+';track("app_open","",0)',context);
 if(kind==='anonymous'){assert.equal(sent,undefined);return}
 const p=JSON.parse(sent.body);if(kind==='tg')assert.equal(p.tg_init,'signed_tg');if(kind==='sdk')assert.equal(p.tg_init,'tgWebAppData=signed_sdk');if(kind==='vk')assert.equal(p.vk_query,'signed_vk');if(kind==='web')assert.equal(sent.headers['X-Session-Token'],'session');
});
