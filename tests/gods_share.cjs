const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('vm'),fs=require('fs'),path=require('path');
for(const platform of ['tg','vk'])test('real percentages and one send '+platform,async()=>{
 const calls=[],ctx={isMember:true,telegramId:77,isInsideVk:()=>platform==='vk',quizResult:{code:'ENMI',axes:[1,2/3,1,1].map(share=>({share}))},ggGuestKey:()=>'',API_URL:'https://fixture',apiRequest:async(url,opt)=>{calls.push({url,body:opt&&JSON.parse(opt.body)});return {id:'abc'}},vkAskMessages:async()=>{},showToast(){},t:k=>k,document:{getElementById:()=>null},appSyncNavigation(){}};
 vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(__dirname,'../game-sharing.js'),'utf8'),ctx);await ctx.openGameShare('gods',true);
 assert.equal(calls.length,2);assert.deepEqual(calls[0].body.percentages,[100,67,100,100]);assert.equal(calls[0].body.code,'ENMI');assert.equal(calls[1].body.platform,platform);
});
test('guest native share includes description and code',async()=>{
 let sent;const ctx={navigator:{share:async v=>{sent=v},canShare:()=>true},t:k=>k};vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(__dirname,'../game-sharing.js'),'utf8'),ctx);vm.runInContext("gameShareFile={};gameShareData={caption:'Ты — ENMI\\nОписание\\nСсылка',title:'Игра'}",ctx);await ctx.gameShareImage();assert.equal(sent.text,'Ты — ENMI\nОписание\nСсылка');
});
