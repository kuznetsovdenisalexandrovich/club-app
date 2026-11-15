const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const html=fs.readFileSync(__dirname+'/../index.html','utf8');
for(const marketing of [false,true])test('visible choices follow server mode: '+marketing,()=>{
 const nodes=[];function el(tag){const e={tag,children:[],classList:{add(){}},append(...children){this.children.push(...children);this.lastChild=children.at(-1)},setAttribute(){},dataset:{}};nodes.push(e);return e}
 const watch={disabled:true},modal=el('dialog');modal.querySelector=()=>watch;
 const c={modal,mode:'film',state:{marketing_materials:marketing},busy:false,choice:{data:false},label:x=>x,legalEl:el,legalButton:()=>el('button'),legalLink:()=>el('a'),legalClose(){},legalAcceptFilm(){},legalRejectFilm(){},legalDocumentUrl(){},base:''};
 vm.runInNewContext(html.slice(html.indexOf('function legalPurposes()'),html.indexOf('function legalSaved(')),c);c.legalRender();
 const inputs=nodes.filter(x=>x.tag==='input');assert.equal(inputs.length,marketing?2:1);assert.equal(inputs[0].checked,false);
 inputs[0].checked=true;inputs[0].onchange();assert.equal(watch.disabled,marketing);if(marketing){inputs[1].checked=true;inputs[1].onchange();assert.equal(watch.disabled,false)};
});
test('single explicit action records mailing bundle and then continues film',async()=>{
 const calls=[];let played=0;
 const c={busy:false,state:{can_receive:false,mailing_version:'mailing-v1'},choice:{data:true},run:1,visit:'a',continueFilm:()=>played++,legalRender(){},legalClose(){},legalEvent:async()=>{},sessionStorage:{getItem:()=>'',removeItem(){}},legalRequest:async body=>{calls.push(body);return {can_receive:true,film_token:'token'}},legalSaved:d=>c.state=d};
 vm.runInNewContext(html.slice(html.indexOf('function legalMissingChoice()'),html.indexOf('function legalChoiceLabel('))+html.slice(html.indexOf('async function legalAcceptFilm()'),html.indexOf('async function legalRejectFilm()')),c);
 await c.legalAcceptFilm();assert.equal(played,1);assert.equal(calls.length,1);assert.equal(calls[0].purpose,'mailing_bundle');assert.equal(calls[0].enabled,true);
 c.choice.data=false;await c.legalAcceptFilm();assert.equal(calls.length,1);
});
test('separate mode records two explicit choices without a mailing bundle',async()=>{
 const calls=[];let played=0;
 const c={busy:false,state:{marketing_materials:true,data:false,ads:false,version:'v1'},choice:{data:true,ads:false},run:1,visit:'a',continueFilm:()=>played++,legalRender(){},legalClose(){},legalEvent:async()=>{},sessionStorage:{getItem:()=>'',removeItem(){}},legalRequest:async body=>{calls.push(body);return {...c.state,[body.purpose]:body.enabled,film_token:body.purpose==='ads'?'token':''}},legalSaved:d=>c.state=d};
 vm.runInNewContext(html.slice(html.indexOf('function legalMissingChoice()'),html.indexOf('function legalChoiceLabel('))+html.slice(html.indexOf('async function legalAcceptFilm()'),html.indexOf('async function legalRejectFilm()')),c);
 await c.legalAcceptFilm();assert.equal(calls.length,0);
 c.choice.ads=true;await c.legalAcceptFilm();assert.equal(played,1);assert.deepEqual(calls.map(x=>x.purpose),['data','ads']);
});
