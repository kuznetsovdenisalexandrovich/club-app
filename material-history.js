/* Resume metadata only. Existing content routes remain the access authority. */
(function(root){
 'use strict';
 const kinds=new Set(['audio','lecture','insights','magazine','digest','personal_digest','bonus','meeting','game','learning']);
 let items=[],owner='',dirty=new Map(),timer=null,flight=null,loaded='',lastRead=0,listSignature='';
 const readers=new Set();
 const key=x=>[x.kind,x.id,x.platform||''].join('|');
 function identity(){return typeof telegramId!=='undefined'&&telegramId?String(telegramId):'guest';}
 function storageKey(){return 'club_material_history_v1:'+owner;}
 function valid(x){return x&&kinds.has(x.kind)&&typeof x.id==='string'&&/^[A-Za-z0-9_.:-]{1,180}$/.test(x.id)&&Number.isFinite(x.at)&&x.at>0;}
 function merge(a,b){const map=new Map();for(const x of [...a,...b])if(valid(x)&&(!map.has(key(x))||map.get(key(x)).at<x.at))map.set(key(x),x);return [...map.values()].sort((a,b)=>b.at-a.at).slice(0,30);}
 function save(){try{localStorage.setItem(storageKey(),JSON.stringify(items));}catch(e){}}
 function useOwner(){const next=identity();if(next===owner)return;owner=next;dirty=new Map();clearTimeout(timer);timer=null;loaded='';listSignature='';items=[];try{items=merge([],JSON.parse(localStorage.getItem(storageKey())||'[]'));for(const x of items)dirty.set(key(x),x);}catch(e){} }
 function get(kind,id,platform=''){useOwner();return items.find(x=>key(x)===key({kind,id:String(id),platform}));}
 function remember(kind,id,title,extra={}){
  useOwner();id=String(id||'');if(!kinds.has(kind)||!id)return;
  const platform=extra.platform||'',old=get(kind,id,platform);
  const item={kind,id,title:String(title||old?.title||'Материал').slice(0,300),platform,position:old?.position||0,duration:old?.duration||0,completed:false,...extra,at:Math.max(Date.now(),(old?.at||0)+1)};
  for(const field of ['position','duration'])item[field]=Number.isFinite(Number(item[field]))?Math.max(0,Math.min(10000000,Number(item[field]))):0;
  if(!valid(item))return;
  items=merge(items,[item]);dirty.set(key(item),item);save();render();schedule();
 }
 function media(kind,id,title,event){
  if(event.method==='loaded'||!Number.isFinite(event.time))return;
  const old=get(kind,id);
  if(event.method==='time'&&old&&Date.now()-old.at<10000)return;
  if(event.method!=='play'&&event.time<=0)return;
  const completed=event.method==='stop'||!!(old?.completed&&event.duration>0&&event.time>=event.duration-1);
  remember(kind,id,title,{position:event.time,duration:event.duration,completed});
 }
 function schedule(){if(owner==='guest'||timer)return;timer=setTimeout(()=>{timer=null;flush();},6000);}
 async function flush(){
  useOwner();if(owner==='guest'||!dirty.size||flight)return;
  const currentOwner=owner,batch=[...dirty.values()].sort((a,b)=>b.at-a.at).slice(0,30);
  flight=(async()=>{try{
   const d=await apiRequest(API_URL+'/material-history',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({items:batch}),keepalive:true},6000);
   if(identity()!==currentOwner)return;
   for(const x of batch)if(dirty.get(key(x))?.at===x.at)dirty.delete(key(x));
   items=merge(items,d.items||[]);save();render();
  }catch(e){/* Keep local progress; retry only on a later action or online. */}finally{flight=null;}})();
  return flight;
 }
 async function sync(){
  useOwner();const currentOwner=owner;
  if(owner==='guest'||(loaded===owner&&Date.now()-lastRead<60000)){render();return;}
  loaded=owner;lastRead=Date.now();
  try{const d=await apiRequest(API_URL+'/material-history',{},5000);if(identity()!==currentOwner)return;items=merge(items,d.items||[]);save();render();if(dirty.size)flush();}
  catch(e){loaded='';}
 }
 function available(){useOwner();return items.filter(x=>!x.completed&&(x.kind!=='game'||Date.now()-x.at<86400000));}
 const labels={audio:'Продолжить слушать',lecture:'Открывал в',insights:'Продолжить выжимку',magazine:'Продолжить журнал',digest:'Продолжить дайджест',personal_digest:'Продолжить дайджест',bonus:'Продолжить видео',meeting:'Продолжить запись',game:'Продолжить игру',learning:'Продолжить видео'};
 function label(x){let s=labels[x.kind];if(x.kind==='lecture')return s+' '+(x.platform==='vk'?'VK':'Telegram');if(x.position>0&&['audio','bonus','meeting','learning'].includes(x.kind)){const sec=Math.floor(x.position);s+=' · '+Math.floor(sec/60)+':'+String(sec%60).padStart(2,'0');}return s;}
 function render(){
  const recent=available(),x=recent[0],title=document.getElementById('continue-title'),kicker=document.getElementById('continue-kicker');if(!title||!kicker)return false;
  if(!x){if(!items.length)return false;title.textContent='Выбрать следующий материал';kicker.textContent='Библиотека';document.getElementById('continue-recent')?.replaceChildren();listSignature='';const bar=document.getElementById('continue-progress-wrap');if(bar)bar.style.display='none';return true;}
  title.textContent=x.title;kicker.textContent=label(x);
  const block=title.closest('[data-block="continue"]');if(block){block.hidden=false;block.style.setProperty('display','block','important');}
  const wrap=document.getElementById('continue-progress-wrap'),bar=document.getElementById('continue-progress-bar');
  const measurable=x.duration>0&&x.kind!=='lecture';if(wrap)wrap.style.display=measurable?'':'none';if(bar)bar.style.width=(measurable?Math.min(100,100*x.position/x.duration):0)+'%';
  let list=document.getElementById('continue-recent');
  if(!list&&block){list=document.createElement('div');list.id='continue-recent';block.append(list);}
  const signature=JSON.stringify(recent.slice(1,3));
  if(list&&signature!==listSignature){listSignature=signature;list.replaceChildren();for(const item of recent.slice(1,3)){const b=document.createElement('button');b.type='button';b.className='material-history-recent';b.style.cssText='display:block;text-align:left;margin:10px 0 0;padding:4px 2px;max-width:100%;white-space:normal;border:0;background:none;color:var(--text-dim);font:inherit;font-size:12px;line-height:1.45;text-decoration:none;cursor:pointer';b.textContent=label(item)+' · '+item.title;b.onclick=()=>open(item);list.append(b);}}
  return true;
 }
 let opening=false;
 async function open(item){
  if(opening)return;item=item||available()[0];if(!item)return false;opening=true;
  try{
   const x={...item};
   if(['audio','insights','lecture'].includes(x.kind)){
    const l=await apiRequest(API_URL+'/lectures/'+encodeURIComponent(x.id),{},8000);
    if(x.kind==='lecture'){
     if(!lectureRecordingAccess(l)){openLectureAsGuest(l);return true;}
     remember('lecture',x.id,l.title,{platform:x.platform});
     if(x.platform==='vk'&&l.link_vk)openUrl(l.link_vk);else openLectureByPlatform(l);
    }else if(x.kind==='audio'){
     plPendingSeek={slug:l.slug,sec:x.completed?0:x.position};playOneLecture(l);
    }else{await openLectureByKey(l.slug,'insights');}
   }else if(x.kind==='magazine'){await loadMagazine();await readMagazineIssue(x.id,x.platform||'mobile');}
   else if(x.kind==='digest')await openDigest(x.id);
   else if(x.kind==='personal_digest'){const [start,end]=x.id.split(':');await openPersonalDigest(start,end);}
   else if(x.kind==='meeting')await openMeetingRecording(Number(x.id));
   else if(x.kind==='bonus'){await loadBonuses();const [bonus,itemKey]=x.id.split(':');openBonusPopup(bonus);playBonusVideo(bonus,itemKey);}
   else if(x.kind==='game'){
    if(x.platform)return false;
    switchView('games');await waitProfile(4000);await ggLoad();
    const game=ggFind(x.id.split(':')[0]);if(!game||game.locked){if(game)ggTap(game.key);else showToast('Игра сейчас недоступна');return true;}
    if(x.id.startsWith('ignore:'))ClubIgnoreGame.open({resumeId:x.id.slice(7)});
    else if(!(await ggResume({game_key:x.id.split(':')[0],session_id:x.id.split(':').slice(1).join(':')}))){remember(x.kind,x.id,x.title,{completed:true});showToast('Эта партия завершена');}
   }else if(x.kind==='learning'){await QuizRecommendations.resume(x.id);}
   return true;
  }catch(e){showToast('Не удалось открыть материал. Попробуй ещё раз.');return true;}
  finally{opening=false;}
 }
 function watchScroll(kind,id,title,element){
  if(!element)return;
  const previous=get(kind,id),position=previous?.position||0;
  if(element._resumeCleanup)element._resumeCleanup();
  remember(kind,id,title,{position});
  requestAnimationFrame(()=>{element.scrollTop=position;});
  let delay=null;
  const capture=()=>{clearTimeout(delay);delay=null;remember(kind,id,title,{position:element.scrollTop,duration:Math.max(0,element.scrollHeight-element.clientHeight)});};
  const onScroll=()=>{clearTimeout(delay);delay=setTimeout(capture,500);};
  const target=element.ownerDocument?.scrollingElement===element?element.ownerDocument:element;
  target.addEventListener('scroll',onScroll,{passive:true});readers.add(capture);
  element._resumeCleanup=()=>{capture();readers.delete(capture);target.removeEventListener('scroll',onScroll);delete element._resumeCleanup;};
 }
 function stopScroll(element){element?._resumeCleanup?.();}
 function attachAudio(node,lecture){
  if(!lecture.slug)return ()=>{};
  const saved=get('audio',lecture.slug),controller=new AbortController();
  const capture=method=>{if(node.currentTime>0||method==='play')media('audio',lecture.slug,lecture.title,{method,time:node.currentTime,duration:node.duration});};
  node.addEventListener('loadedmetadata',()=>{if(saved?.position&&!saved.completed&&Number.isFinite(node.duration))node.currentTime=Math.min(saved.position,Math.max(0,node.duration-1));},{once:true,signal:controller.signal});
  for(const event of ['playing','pause','timeupdate'])node.addEventListener(event,()=>{if(event!=='timeupdate'||(!node.paused&&!node.seeking))capture(event==='playing'?'play':event==='timeupdate'?'time':'pause');},{signal:controller.signal});
  root.addEventListener('pagehide',()=>capture('pause'),{signal:controller.signal});
  return ()=>{capture('pause');controller.abort();};
 }
 root.addEventListener('online',()=>{sync();flush();});
 root.addEventListener('pagehide',()=>{for(const capture of readers)capture();queueMicrotask(flush);});
 document.addEventListener('visibilitychange',()=>{if(document.hidden){for(const capture of readers)capture();flush();}});
  root.ClubMaterialHistory={remember,media,get,render,sync,flush,open,available,hasHistory:()=>{useOwner();return items.length>0;},watchScroll,stopScroll,attachAudio,merge};
})(window);
