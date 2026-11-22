const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict'),test=require('node:test');
const html=fs.readFileSync(require('path').join(__dirname,'../index.html'),'utf8');
const code=html.slice(html.indexOf('async function loadContinueWidget()'),html.indexOf('let isMember = false;',html.indexOf('async function loadContinueWidget()')));
for(const slug of ['sales_p04_l09_lecture','funnels_p01_l08_lecture'])test('purchased '+slug+' wins over previous content and live event',async()=>{
 const els={'continue-kicker':{},'continue-title':{}};let live=0;const calls=[];
 const c={document:{getElementById:id=>els[id]},localStorage:{getItem:()=>JSON.stringify({title:'Old',ts:1})},lastMagazineRead:()=>({title:'Magazine',ts:2}),welcomeLectureSlug:slug,welcomeLectureData:null,API_URL:'https://fixture.test',apiRequest:async url=>{calls.push(url);return {slug,title:'Promised lecture'}},continueLiveState:async()=>{live++;return {state:'live'}}};vm.createContext(c);vm.runInContext(code,c);
 await c.loadContinueWidget();assert.equal(els['continue-kicker'].textContent,'Твоя полная версия');assert.equal(els['continue-title'].textContent,'Promised lecture');assert.equal(c.welcomeLectureData.slug,slug);assert.equal(live,0);assert.deepEqual(calls,['https://fixture.test/lectures/'+slug]);
});
