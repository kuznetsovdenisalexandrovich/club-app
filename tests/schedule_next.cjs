const fs=require('fs'),vm=require('vm'),assert=require('assert');
const html=fs.readFileSync('index.html','utf8');
const code=html.slice(html.indexOf('async function renderTodayLine(){'),html.indexOf('function collectCategories(){'));
(async()=>{
 const el={},requests=[],c={document:{getElementById:()=>el},API_URL:'https://api.test',escapeHtml:s=>s.replaceAll('<','&lt;'),widgetDaysData:{},openDayPopup:d=>c.opened=d,showToast:()=>{},switchView:()=>{},apiRequest:async u=>{requests.push(u);return u.includes('?month=')?{days:{'2026-12-01':[{title:'Next'}]}}:{found:true,date:'2026-12-01',title:'Next',label:'01.12 в 14:00'}}};
 vm.createContext(c);vm.runInContext(code,c);await c.renderTodayLine();assert(el.innerHTML.includes('01.12 в 14:00'));await el.onclick();assert.equal(c.opened,'2026-12-01');assert(c.widgetDaysData[c.opened]);
 c.apiRequest=async()=>({found:false});await c.renderTodayLine();assert(el.innerHTML.includes('Ближайших занятий пока нет'));
 c.apiRequest=async()=>{throw Error('network')};await c.renderTodayLine();assert(el.textContent.includes('Не удалось обновить'));console.log('PASS next event, cross-month details, empty and failed schedule');
})();
