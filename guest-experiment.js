/* Four post-film branches. Server owns assignment/order; no payment or member writes here. */
window.GuestExperiment=(function(){
 'use strict';
 let state=null,active=false,busy=false,generation=0,player=null,audio=null,mediaSpec=null,opening=null,bootChecked=false;
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const request=(path,body,timeout=8000)=>apiRequest(API_URL+'/guest-experiment'+path,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),rfNoRetry:true}:{},timeout);
 const button=(text,action,quiet=false)=>'<button class="'+(quiet?'learning-quiet':'learning-primary')+'" data-gx="'+action+'">'+text+'</button>';
 const storageKey=()=> 'club_guest_game_v1:'+String(telegramId||'');
 function game(){try{const d=JSON.parse(localStorage.getItem(storageKey()));if(IgnoreGameCore.valid(d))return d;}catch(e){}return IgnoreGameCore.fresh();}
 function saveGame(d){try{localStorage.setItem(storageKey(),JSON.stringify(d));}catch(e){}}
 function disposeMedia(){generation++;if(player){player.destroy();player=null;}if(audio){audio.pause();audio.removeAttribute('src');audio.load();audio=null;}}
 function dispose(){disposeMedia();active=false;document.getElementById('gx-next')?.remove();document.getElementById('quiz-overlay')?.classList.remove('gx-open');}
 function gxSignal(event,code=''){
  if(!state?.active)return Promise.resolve();
  const snapshot=state;return request('/event',{branch:state.current||state.seen[state.seen.length-1],event,code}).then(d=>{if(!d.active&&active&&state===snapshot){dispose();closeQuiz();}}).catch(()=>{});
 }
 function nav(){
  let el=document.getElementById('gx-next');if(!el){el=document.createElement('button');el.id='gx-next';el.className='learning-quiet';el.dataset.gx='next';document.getElementById('quiz-overlay').appendChild(el);}
  el.textContent='Хочу ещё контента';el.disabled=busy;el.hidden=state?.finished;
 }
 function surface(html){
  disposeMedia();active=true;qzSetLook(null);document.getElementById('quiz-overlay').classList.add('open','gx-open');
  document.getElementById('quiz-inner').innerHTML='<div class="gx-content">'+html+'</div>';nav();appSyncNavigation();
 }
 function note(text){const el=document.getElementById('gx-status');if(el)el.textContent=text;}
 function showQuestion(){surface('<h2>Что хочется изменить в продажах прямо сейчас?</h2><p>Опиши одну задачу — подберём короткий фрагмент занятия.</p><form id="gx-question-form"><textarea id="gx-question" maxlength="500" minlength="3" required placeholder="Например: спрашивают цену и пропадают"></textarea>'+button('Подобрать занятие','search')+'</form><p id="gx-status" role="status"></p>');}
 function showChat(){
  const d=game();if(d.done||state.completed.C)return showLesson('texting_p01_l11_lecture');
  surface('<h2>Обещал оплатить.<br>И пропал на неделю.</h2><div class="gx-chat" role="log">'+d.messages.map(m=>(m.old?'<small>Неделю назад</small>':'')+'<div class="gx-message '+m.who+'">'+esc(m.text)+'</div>').join('')+'</div><p class="gx-coach" role="status">'+esc(d.coach)+'</p><form id="gx-reply-form"><textarea id="gx-reply" maxlength="600" required placeholder="Попробуй напомнить об оплате">'+esc(d.draft)+'</textarea>'+button('Отправить','reply')+'</form>'+button('Нужна подсказка','hint',true)+'<small>Сценарный тренажёр · собеседник вымышленный.</small>');
  const list=document.querySelector('.gx-chat');list.scrollTop=list.scrollHeight;
 }
 async function showLesson(slug){
  surface('<div id="gx-media"></div><p id="gx-status" role="status">Открываем занятие…</p>');const ticket=generation;
  try{const data=await request('/lesson/'+encodeURIComponent(slug));if(ticket!==generation)return;await showMedia({slug,title:data.lecture.title});}
  catch(e){if(ticket!==generation)return;surface('<p>Не удалось открыть занятие.</p>'+button('Попробовать ещё раз','retry')+'<p id="gx-status" role="status"></p>');mediaSpec={slug,title:'Занятие по твоей задаче'};}
 }
 async function showMedia(spec){
  mediaSpec=spec;
  surface('<h2>'+esc(spec.title||'Продажи — это секс')+'</h2><div id="gx-media"></div><p id="gx-status" role="status">Загружаем видео…</p>'+button(spec.masterclass?'Получить полный доступ':'Смотреть полное видео','pay')+(!spec.masterclass?button('Слушать как подкаст','audio',true):''));
  const ticket=generation,branch=state.current;
  const path=spec.masterclass?'/media/bonus/masterclass/i1?direct_capable=1':'/learning/media/'+encodeURIComponent(spec.slug);
  window.ClubAppRescue?.target(spec.masterclass?'bi_masterclass__i1':'l_'+safeContentKey(spec.slug));
  const manifest=()=>apiRequest(API_URL+path,{},15000);
  try{
   const [data]=await Promise.all([manifest(),filmEngineReady()]);if(ticket!==generation)return;
   player=new ClubFilmPlayer(document.getElementById('gx-media'),{adaptiveRecovery:true,sources:data.sources,expiresIn:data.expires_in,text:k=>k==='film.start'?'Смотреть видео':t(k),refreshSources:manifest,onDiagnostic:filmDiagnostics('bonus'),onFault:code=>{if(code==='film_unavailable')window.ClubAppRescue?.fail('content_error');},onEvent:e=>{
    if(e.method==='play')gxSignal('started');
    if(e.method==='stop'){player?.removeFullscreen?.close();note(spec.masterclass?'Видео закончилось. Полный доступ — по кнопке ниже.':'Фрагмент закончился. Полное занятие — в клубе.');gxSignal('completed');}
   }});note(spec.masterclass?'':'Фрагмент занятия · около 10 минут');gxSignal('access_shown');
  }catch(e){if(ticket!==generation)return;note('Видео пока не загрузилось. Попробуй ещё раз.');document.getElementById('gx-media').innerHTML=button('Повторить загрузку','retry');}
 }
 async function toggleAudio(){
  if(!mediaSpec?.slug)return;
  const btn=document.querySelector('[data-gx="audio"]');if(!btn)return;
  if(audio&&!audio.hidden){audio.pause();audio.hidden=true;document.getElementById('gx-media').hidden=false;btn.textContent='Слушать как подкаст';return;}
  if(audio){player?.action('pause');document.getElementById('gx-media').hidden=true;audio.hidden=false;btn.textContent='Вернуться к видео';audio.play().catch(()=>note('Нажми ▶ в аудиоплеере.'));return;}
  const ticket=generation;btn.disabled=true;
  try{
   const d=await apiRequest(API_URL+'/learning/media/'+encodeURIComponent(mediaSpec.slug)+'?kind=audio',{},15000);if(ticket!==generation)return;
   player?.action('pause');player?.removeFullscreen?.close();audio=document.createElement('audio');audio.controls=true;audio.preload='metadata';audio.src=d.sources[0].url;
   document.getElementById('gx-media').after(audio);document.getElementById('gx-media').hidden=true;btn.textContent='Вернуться к видео';
   audio.addEventListener('playing',()=>gxSignal('started'));audio.addEventListener('ended',()=>{note('Фрагмент закончился. Полное занятие — в клубе.');gxSignal('completed');});
   audio.addEventListener('error',()=>note('Аудио не загрузилось. Можно вернуться к видео.'));
   audio.play().catch(()=>note('Нажми ▶ в аудиоплеере.'));
  }catch(e){if(ticket===generation)note('Аудиоверсия пока недоступна. Видео остаётся здесь.');}finally{if(ticket===generation)btn.disabled=false;}
 }
 async function gxRender(){
  disposeMedia();window.QuizRecommendations?.dispose();if(!state?.active)return false;active=true;gxSignal('shown');
  // A new branch starts at its heading; chat replies keep their local scroll.
  document.getElementById('quiz-overlay').scrollTop=0;
  if(state.finished){surface('<h2>Остаёмся на связи?</h2><p>В открытом канале — ещё идеи и разборы. А демо клуба можно изучать дальше в своём темпе.</p>'+button('Открыть бесплатный канал','channel')+button('Изучить демо приложения','demo',true));return true;}
  if(state.current==='A'){
   if(state.quiz_code&&QUIZ_RESULTS[state.quiz_code]){openQuiz(true,'post_film');const saved=savedQuizResult();quizResult=saved?.code===state.quiz_code?saved:{code:state.quiz_code};renderQuizResult();}
   else openQuiz(true,'post_film');
   active=true;document.getElementById('quiz-overlay').classList.add('gx-open');nav();return true;
  }
  if(state.current==='B'){if(state.search_slug)await showLesson(state.search_slug);else showQuestion();}
  if(state.current==='C')showChat();
  if(state.current==='D')await showMedia({masterclass:true,title:'Продажи — это секс'});
  return true;
 }
 async function begin(create){
  if(appSettings.guest_experiment_available===false)return false;
  if(opening)return opening;
  let ticket=generation,opened=false;opening=(async()=>{try{
   // Older reserve settings omit this key. Discover only this feature flag on
   // its serving node; do not replace unrelated settings or switch global RF.
   if(appSettings.guest_experiment_available===undefined){
    const settings=await apiRequest(API_URL+'/settings',{rfPrimaryOnly:true},8000);
    if(ticket!==generation)return true;
    appSettings.guest_experiment_available=settings.guest_experiment_available===true;
   }
   if(!appSettings.guest_experiment_available)return false;
   if(create){surface('<p role="status">Открываем следующий материал…</p>');document.getElementById('gx-next').hidden=true;ticket=generation;opened=true;}
   const d=await request(create?'/start':'/state',create?{}:undefined);if(ticket!==generation)return true;if(!d.active||(!create&&d.finished)){if(create)closeQuiz();return false;}
   state=d;bootChecked=true;if(typeof bwClose==='function')bwClose();funnelLeave(false);enterDemoMode();await gxRender();return true;
  }catch(e){if(ticket!==generation)return true;if(opened)closeQuiz();return false;}finally{opening=null;}})();return opening;
 }
 async function next(){
  if(busy||!state?.current)return;busy=true;nav();const branch=state.current,ticket=generation;
  try{const d=await request('/next',{branch});if(ticket!==generation)return;if(!d.active){closeQuiz();return;}state=d;await gxRender();}
  catch(e){showToast('Не удалось открыть следующую ветку. Попробуй ещё раз.');}
  finally{busy=false;if(active)nav();}
 }
 async function submitQuestion(){
  const field=document.getElementById('gx-question');if(!field?.reportValidity()||busy)return;busy=true;const ticket=generation;const btn=document.querySelector('[data-gx="search"]');btn.disabled=true;note('Ищем подходящий фрагмент…');
  try{const d=await request('/search',{text:field.value.trim()},20000);if(ticket!==generation)return;if(d.found){state.search_slug=d.lecture.slug;await showMedia({slug:d.lecture.slug,title:d.lecture.title});}else note('Подходящего фрагмента пока нет. Уточни задачу или посмотри другой контент.');}
  catch(e){if(ticket===generation)note('Не получилось подобрать занятие. Попробуй ещё раз или перейди к другому контенту.');}finally{busy=false;if(ticket===generation)btn.disabled=false;if(active)nav();}
 }
 function submitReply(){
  const field=document.getElementById('gx-reply');if(!field?.reportValidity())return;
  const result=IgnoreGameCore.submit(game(),field.value);if(!result.accepted)return;saveGame(result.state);gxSignal('started');
  if(result.state.done){state.completed.C=true;gxSignal('game_completed');}showChat();
 }
 document.addEventListener('submit',e=>{if(e.target.id==='gx-question-form'){e.preventDefault();submitQuestion();}if(e.target.id==='gx-reply-form'){e.preventDefault();submitReply();}});
 document.addEventListener('input',e=>{if(e.target.id==='gx-reply'){const d=game();d.draft=e.target.value;saveGame(d);}});
 document.addEventListener('click',e=>{
  const action=e.target.closest('[data-gx]')?.dataset.gx;if(!action||!active)return;
  if(action==='search'||action==='reply')return; // Native form submit also supports keyboard.
  if(action==='next')return next();
  if(action==='hint'){const d=game();d.draft=IgnoreGameCore.hints[d.step];saveGame(d);showChat();document.getElementById('gx-reply')?.focus();}
  if(action==='retry')return showMedia(mediaSpec);
  if(action==='audio')return toggleAudio();
  if(action==='pay'){gxSignal('payment_open');openQuizFullAccess();}
  if(action==='demo'){gxSignal('demo_open');closeQuiz();switchView('portal');}
  if(action==='channel'){gxSignal('channel_open');if(state.channel_url)openUrl(state.channel_url);else showToast('Ссылка на канал пока недоступна. Демо приложения открыто.');}
 });
 return {afterFilm:()=>begin(true),resume:()=>begin(false),maybeResume:()=>{if(bootChecked||appStartParam()||isMember||!telegramId||(funnelFilmStarted&&!filmDone))return;bootChecked=true;begin(false);},next,dispose,
  active:()=>active,branch:()=>active?state?.current:null,signal:gxSignal,
  quizDone:code=>{if(active&&state?.current==='A'){state.quiz_code=code;state.completed.A=true;gxSignal('game_completed',code);}},
  payment:()=>{if(active)gxSignal('payment_open');}};
})();
