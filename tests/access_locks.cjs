const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict'),test=require('node:test');
const html=fs.readFileSync('index.html','utf8');
function fn(name){const start=html.search(new RegExp('^(?:async )?function '+name+'\\(','m'));assert(start>=0);const next=html.slice(start+1).search(/\n(?:async )?function /);return html.slice(start,start+1+next);}
function context(member,level,manual=false){
 const calls=[],els={};const c={isMember:member,rewardLevel:level,pdfManualUnlocked:manual,tourActive:false,appSettings:{insights_unlock_level:2,pdf_unlock_level:3},document:{getElementById:id=>els[id]||(els[id]={textContent:'',innerHTML:'',classList:{add:()=>calls.push(id)}})},alert:()=>calls.push('tour'),openPaywall:()=>calls.push('paywall'),cardList:()=>[{slug:'lesson',title:'Lesson',key_insights:[{insight:'Demo insight'}]}],pdFeatureOpened:()=>{},nbEvent:()=>{},SHARE_ICON:'share',jsArg:x=>JSON.stringify(x),escapeHtml:x=>x,t:x=>x,fetch:()=>{calls.push('fetch');return Promise.resolve({ok:true,json:async()=>({url:'signed'})});},API_URL:'https://fixture',telegramId:77,isInsideVk:()=>true,window:{},setTimeout:()=>{},openUrl:()=>calls.push('url')};
 vm.createContext(c);for(const name of ['insightsLevelIsLocked','pdfAccessAllowed','openInsightsLevelLockNotice','openInsightsModal','_renderPdfBtn','openPdfLockNotice','downloadPdf'])vm.runInContext(fn(name),c);
 return {c,calls,els};
}
test('insights direct opening shares card level/tour gates, guest demo retained',()=>{
 let x=context(true,1);x.c.openInsightsModal(0);assert(x.calls.includes('insights-lock-overlay'));assert(!x.calls.includes('insights-modal-overlay'));
 x=context(true,3);x.c.tourActive=true;x.c.openInsightsModal(0);assert.deepEqual(x.calls,['tour']);
 for(const member of [false,true]){x=context(member,3);x.c.openInsightsModal(0);assert(x.calls.includes('insights-modal-overlay'));}
});
test('PDF manual grant only overrides level for active member',()=>{
 for(const [member,level,manual,allowed] of [[false,10,true,false],[true,1,false,false],[true,1,true,true],[true,3,false,true]]){
  const {c,els}=context(member,level,manual);assert.equal(c.pdfAccessAllowed(),allowed);c._renderPdfBtn('lesson');assert.equal(els['insights-modal-pdf'].innerHTML.includes('downloadPdf('),allowed);
 }
});
test('blocked download never uses stale link or issues network request',async()=>{
 for(const member of [false,true]){const {c,calls}=context(member,1);await c.downloadPdf('lesson',{dataset:{pdfUrl:'stale'},textContent:'PDF'});assert(!calls.includes('url')&&!calls.includes('fetch'));assert(calls.includes(member?'pdf-lock-overlay':'paywall'));}
});
test('manual grant still uses normal signed VK PDF flow',async()=>{const {c,calls}=context(true,1,true),btn={dataset:{},textContent:'PDF'};await c.downloadPdf('lesson',btn);assert(calls.includes('fetch'));assert.equal(btn.dataset.pdfUrl,'signed');assert.equal(btn.disabled,false);});
test('onboarding quiz lock clears when tour ends',()=>{const values=[];const c={onbActive:true,document:{querySelector:()=>({classList:{toggle:(name,v)=>values.push(v)}})},showToast:()=>{},t:x=>x};vm.createContext(c);vm.runInContext(fn('onbApplyLocks')+'\n'+fn('onbQuizBlocked'),c);c.onbApplyLocks();assert(c.onbQuizBlocked());c.onbActive=false;c.onbApplyLocks();assert(!c.onbQuizBlocked());assert.deepEqual(values,[true,false]);});
test('plan glow stays behind only expanded groups and clears prior glows',()=>{let removed=0;const children=[],style={setProperty(){}};const c={document:{getElementById:()=>({querySelectorAll:()=>[{remove:()=>removed++}],appendChild:x=>children.push(x)}),createElement:()=>({style:{...style}})},pfRoots:()=>['root','closed','single'],planDraft:{expanded:['root','single']},pfCluster:k=>k==='alone'?'single':'root',pfPos:{a:{x:0,y:0},b:{x:200,y:80},alone:{x:0,y:0}},pfSizes:{},PF_COLORS:['red']};vm.createContext(c);vm.runInContext(fn('pfGlows'),c);c.pfGlows({list:['a','b','alone'],color:{}});assert.equal(removed,1);assert.equal(children.length,1);assert.equal(children[0].className,'pf-glow');assert(!children[0].style.transform.includes('NaN'));});
