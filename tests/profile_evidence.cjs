const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm'),path=require('path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');const source=html.slice(html.indexOf('let profileFailureReports = 0;'),html.indexOf('/* ══ НЕУДАЧНОЕ СПИСАНИЕ'));
test('request failure records only bounded enum/status, not raw error',async()=>{const reports=[];const c={API_URL:'https://fixture',telegramId:77,window:{},apiRequest:async()=>{throw Object.assign(Error('SECRET'),{status:401})},track:(...x)=>reports.push(x),document:{getElementById:()=>({})}};vm.createContext(c);vm.runInContext(source,c);for(let i=0;i<4;i++)await c.loadProfile();assert.deepEqual(reports,[['profile_load_failed','http',401],['profile_load_failed','http',401]]);});
test('render failure distinguished from a failed profile request',async()=>{const reports=[];const c={API_URL:'https://fixture',telegramId:77,window:{},apiRequest:async()=>({found:true}),track:(...x)=>reports.push(x),document:{getElementById:id=>id==='header-sub'?null:{}}};vm.createContext(c);vm.runInContext(source,c);await c.loadProfile();assert.deepEqual(reports,[['profile_render_failed','unknown',0]]);});

test('caught profile timeouts also reach the bounded technical reporter',async()=>{
 const notices=[];const c={API_URL:'https://fixture',telegramId:77,window:{__reportError:(...x)=>notices.push(x)},apiRequest:async()=>{throw Object.assign(new Error('Aborted'),{name:'AbortError'})},track:()=>{},document:{getElementById:()=>({})}};
 vm.createContext(c);vm.runInContext(source,c);await c.loadProfile();
 assert.deepEqual(notices,[['Не удалось загрузить профиль','','profile_timeout']]);
});
