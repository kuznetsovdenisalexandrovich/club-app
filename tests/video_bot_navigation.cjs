const fs=require('fs'),vm=require('vm'),assert=require('assert');
const html=fs.readFileSync(__dirname+'/../index.html','utf8');
const code=html.slice(html.indexOf('const videoBotDestinations='),html.indexOf('function addVideoBotFallback'));
(async()=>{let requests=0,opens=[];const c={isInsideVk:()=>false,vkUserId:()=>77,vkLaunchQuery:()=> 'signed-fixture',telegramId:77,API_URL:'https://fixture',sessionHeaders:()=>({}),apiRequest:async()=>{requests++;return {url:'https://t.me/test_bot',status:'queued',message:'Queued'};},openUrl:url=>opens.push(url)};vm.createContext(c);vm.runInContext(code,c);
await c.watchVideoInBot();await c.watchVideoInBot();assert.equal(requests,1);assert.equal(opens.length,2);
c.telegramId=88;await c.watchVideoInBot();assert.equal(requests,2);
let starts=0;c.telegramId=99;c.apiRequest=async()=>{starts++;return {url:'https://t.me/test_bot?start=menu',status:'start_bot'}};await c.watchVideoInBot();await c.watchVideoInBot();assert.equal(starts,2);
c.isInsideVk=()=>true;let vkRequests=0;c.apiRequest=async(url,o)=>{assert(url.endsWith('/content/watch-in-bot'));assert.equal(JSON.parse(o.body).launch,'signed-fixture');vkRequests++;return {url:'https://vk.me/club123',status:'queued'}};await c.watchVideoInBot();await c.watchVideoInBot();assert.equal(vkRequests,1);
console.log('PASS chat reopening does not resend; different identity and initial bot permission are rechecked');})().catch(e=>{console.error(e);process.exit(1)});
