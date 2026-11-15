const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
function declaration(name){const start=html.indexOf('function '+name+'(');assert(start>=0);const open=html.indexOf('{',start);let depth=1,i=open+1;for(;depth;i++){if(html[i]==='{')depth++;if(html[i]==='}')depth--;}return html.slice(start,i)}
test('editor is a member route and waits for identity',async()=>{
 const table=html.slice(html.indexOf('const DEEPLINKS = {'),html.indexOf('const PARAM_LINKS = {'));
 const end=table.indexOf('\n};');assert(end>0);
 for(const member of [true,false]){let opened=0,paywall=0,release;const ready=new Promise(r=>release=r),tasks=[];
 const c={appStartParam:()=> 'profile_edit',document:{getElementById:()=>({style:{display:'block'}})},rememberEntrySource:()=>{},setTimeout:fn=>tasks.push(fn),waitProfile:()=>ready,isMember:member,MemberProfiles:{openEditor:()=>opened++},openPaywall:()=>paywall++};vm.createContext(c);vm.runInContext(table.slice(0,end+3)+'\n'+declaration('routeFromUrl')+'\nrouteFromUrl()',c);
 const task=tasks[0]();assert.equal(opened,0);release();await task;assert.equal(opened,member?1:0);assert.equal(paywall,member?0:1);
 }
});
test('profile is the final tour step with an editor action',()=>{
 const start=html.indexOf('const ONB_STEPS = [');const code=html.slice(start,html.indexOf('\n];',start)+3);const c={};vm.createContext(c);vm.runInContext(code+';globalThis.steps=ONB_STEPS',c);assert.equal(c.steps.at(-1).key,'profile');assert.equal(c.steps.at(-1).view,'profile');assert.match(declaration('onbTry'),/st.key === 'profile'.*MemberProfiles.openEditor\(\)/);assert.match(html,/onb.profile_b[^\n]+Заполнить профиль/);
});
test('embedded profile source matches maintained file',()=>{const js=fs.readFileSync(path.join(__dirname,'../member-profiles.js'),'utf8');assert.equal(html.match(/<script id="member-profiles-js">([\s\S]*?)<\/script>/)[1].trim(),js.trim());assert.match(js,/onbDone\('profile'\)/)});
