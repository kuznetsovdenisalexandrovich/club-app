/* Additive recommendations. The frozen route, quiz scoring and member receipts remain authoritative. */
window.QuizRecommendations=(function(){
  'use strict';
  let generation=0,owned=null,bypass=false,player=null,audio=null,personal=[],personalOwner='',personalRequest=null;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const owner=()=>isMember&&telegramId?'member:'+telegramId:'';
  const api=(path,body)=>apiRequest(API_URL+'/learning'+path,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{},15000);
  function qrDispose(){generation++;if(player){player.destroy();player=null;}if(audio){audio.pause();audio.removeAttribute('src');audio.load();audio=null;}owned=null;}
  function qrReset(){qrDispose();bypass=false;}
  async function qrLoadPersonal(){
    const who=owner();if(!who){personal=[];personalOwner='';return;}
    if(personalRequest?.who===who)return personalRequest.promise;
    const promise=(async()=>{try{const d=await api('/recommendations');if(owner()===who){personal=Array.isArray(d.items)?d.items:[];personalOwner=who;}}catch(e){if(personalOwner!==who)personal=[];}finally{if(personalRequest?.promise===promise)personalRequest=null;}})();
    personalRequest={who,promise};return promise;
  }
  function qrItems(){return personalOwner===owner()?personal:[];}
  function qrMapHtml(){const rows=qrItems();if(!rows.length)return '';
    return '<section class="learning-map" aria-label="Твои рекомендации"><h3>Под твои задачи</h3>'+rows.map(x=>'<button class="learning-map-item" data-learning="lesson" data-slug="'+esc(x.slug)+'"><span>'+esc(x.lecture.title)+'</span><small>'+esc(x.reasons.join(' · '))+'</small></button>').join('')+'</section>';
  }
  function qrNote(text){const el=document.getElementById('learning-note');if(el)el.textContent=text;}
  function qrShow(result,context){
    if(bypass||!result||!['member','post_film'].includes(context))return false;
    if(owned?.code===result.code&&owned.context===context)return true;
    qrDispose();owned={code:result.code,context};const ticket=generation,startedOwner=owner();
    if(typeof quizPauseFilm==='function')quizPauseFilm();if(typeof quizHoloStop==='function')quizHoloStop();
    document.getElementById('quiz-inner').innerHTML='<div class="learning-result"><p class="learning-kicker">'+esc(QUIZ_RESULTS[result.code]?.god||'Твой результат')+'</p><div id="learning-slot" aria-busy="true">Подбираем занятие…</div><p id="learning-note" role="status"></p></div>';
    api('/quiz/'+encodeURIComponent(result.code)).then(async data=>{
      if(ticket!==generation||owner()!==startedOwner)return;
      owned.data=data;
      await qrRender(data,context,ticket);
      if(ticket!==generation)return;
      if(startedOwner&&owner()===startedOwner){
        const who=startedOwner;try{await (window.quizSavePending||Promise.resolve());if(ticket!==generation||owner()!==who)return;await api('/quiz',{code:result.code});if(owner()!==who)return;await qrLoadPersonal();if(ticket===generation&&typeof renderPersonalPlanBody==='function')renderPersonalPlanBody();}catch(e){if(ticket===generation)qrNote('Занятие открыто. Сохранить рекомендацию на карте пока не удалось.');}
      }
    }).catch(()=>{if(ticket!==generation)return;qrDispose();bypass=true;renderQuizResult();});
    return true;
  }
  async function qrRender(data,context,ticket){
    const l=data.lecture,member=!!isMember;
    window.ClubAppRescue?.target('l_'+safeContentKey(l.slug));
    document.getElementById('quiz-inner').innerHTML='<div class="learning-result"><p class="learning-kicker">'+esc(QUIZ_RESULTS[data.code]?.god||'По твоему вопросу')+' · следующий шаг</p><h2>'+esc(l.title)+'</h2><p>'+esc(data.reason)+'</p><div id="learning-slot"></div><p id="learning-note" role="status"></p><button class="learning-quiet" data-learning="result">Мой результат игры</button></div>';
    if(data.video_ready){
      try{const [manifest]=await Promise.all([api('/media/'+encodeURIComponent(l.slug)),filmEngineReady()]);if(ticket!==generation)return;
        player=new ClubFilmPlayer(document.getElementById('learning-slot'),{sources:manifest.sources,expiresIn:manifest.expires_in,text:k=>k==='film.start'?'Смотреть фрагмент':t(k),refreshSources:()=>api('/media/'+encodeURIComponent(l.slug)),onEvent:e=>{if(e.method==='play'&&typeof rememberLastLecture==='function')rememberLastLecture(l);if(e.method==='stop')qrEnded(data,context);},onFault:code=>{if(code==='film_unavailable')window.ClubAppRescue?.fail('content_error');},onDiagnostic:filmDiagnostics('bonus')});
        qrNote('Фрагмент занятия · около 10 минут');return;
      }catch(e){if(ticket!==generation)return;}
    }
    await qrPlayAudio(data,context,ticket,member);
  }
  async function qrPlayAudio(data,context,ticket,full){
    const l=data.lecture;
    try{
      const manifest=full?await apiRequest(API_URL+'/lectures/'+encodeURIComponent(l.slug)+'/audio',{},15000):await api('/media/'+encodeURIComponent(l.slug)+'?kind=audio');
      if(ticket!==generation)return;
      const slot=document.getElementById('learning-slot');slot.innerHTML='<div class="learning-audio"><span>Аудиоверсия занятия</span><audio controls preload="metadata"></audio></div>';
      audio=slot.querySelector('audio');audio.src=full?manifest.url:manifest.sources[0].url;
      audio.addEventListener('playing',()=>{if(typeof rememberLastLecture==='function')rememberLastLecture(l);});
      audio.addEventListener('ended',()=>qrEnded(data,context));
      audio.addEventListener('error',()=>{if(ticket!==generation)return;window.ClubAppRescue?.fail('content_error');qrNote('Не удалось загрузить аудио. Попробуй ещё раз.');slot.innerHTML='<button class="learning-primary" data-learning="retry">Повторить загрузку</button>';});
      qrNote(full?'Полная аудиоверсия. Видео этого занятия пока открывается на внешней площадке.':'Короткая аудиоверсия · около 10 минут. Видео готовится.');
    }catch(e){if(ticket!==generation)return;document.getElementById('learning-slot').innerHTML='<button class="learning-primary" data-learning="retry">Повторить загрузку</button>';qrNote('Сейчас не удалось открыть занятие.');window.ClubAppRescue?.fail('content_error');}
  }
  function qrEnded(data,context){
    const member=!!isMember;
    if(player){player.destroy();player=null;}if(audio){audio.pause();audio.removeAttribute('src');audio.load();audio=null;}
    document.getElementById('quiz-inner').innerHTML='<div class="learning-result"><h2>'+(member?'Продолжим по твоей задаче?':'Продолжение — в клубе')+'</h2><p>'+(member?'Полное занятие и другие рекомендации доступны на твоей карте.':'Полные занятия, практика и личные разборы твоих ситуаций с Денисом.')+'</p><button class="learning-primary" data-learning="'+(member?'map':'join')+'">'+(member?'Открыть мою карту':'Посмотреть условия клуба')+'</button><button class="learning-quiet" data-learning="'+(member?'result':'more')+'">'+(member?'Мой результат игры':'Хочу ещё контента')+'</button></div>';
  }
  function qrOriginal(){qrDispose();bypass=true;renderQuizResult();}
  async function qrOpenLesson(slug){
    const item=qrItems().find(x=>x.slug===slug);if(!item)return;
    // Use the existing library route for the complete member lesson.
    await openLectureByKey(safeContentKey(slug),'audio');
  }
  document.addEventListener('click',async e=>{
    const button=e.target.closest('[data-learning]');if(!button)return;
    const action=button.dataset.learning;
    if(action==='lesson')return qrOpenLesson(button.dataset.slug);
    if(action==='result')return qrOriginal();
    if(action==='retry'&&owned?.data){const data=owned.data,ctx=owned.context;qrDispose();owned={code:data.code,context:ctx,data};return qrRender(data,ctx,generation);}
    if(action==='map'){closeQuiz();await qrLoadPersonal();renderPersonalPlanBody();return openPersonalPlan();}
    if(action==='join'){closeQuiz();return openAccessPage();}
    if(action==='more'){closeQuiz();if(window.GuestExperiment?.next)return GuestExperiment.next();switchView('library');}
  });
  return {show:qrShow,reset:qrReset,dispose:qrDispose,loadPersonal:qrLoadPersonal,mapHtml:qrMapHtml,hasItems:()=>qrItems().length>0};
})();
