/* Optional introduction: separate from guest sales and the media players. */
window.ClubIntroduction = (function(){
  'use strict';
  let state=null, busy=false, previousFocus=null, loading=null, profileNext=false;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const active=()=>!!(state?.active && isMember);
  async function ciApi(path,body){return apiRequest(API_URL+'/introduction'+path,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{},25000);}
  function ciMount(){
    if(document.getElementById('ci-overlay'))return;
    const overlay=document.createElement('div');overlay.id='ci-overlay';overlay.hidden=true;overlay.className='ci-overlay';
    overlay.innerHTML='<section class="ci-sheet" role="dialog" aria-modal="true" aria-label="Знакомство с клубом"><button class="ci-close" data-ci="close" aria-label="Закрыть">×</button><div id="ci-body"></div><p id="ci-status" role="status"></p></section>';
    document.body.appendChild(overlay);
    overlay.addEventListener('click',e=>{if(e.target===overlay)ciClose();});
  }
  function ciShow(html){ciMount();previousFocus=document.activeElement;document.getElementById('ci-body').innerHTML=html;document.getElementById('ci-status').textContent='';document.getElementById('ci-overlay').hidden=false;document.querySelector('#ci-overlay .ci-sheet').scrollTop=0;document.querySelector('#ci-overlay textarea, #ci-overlay button')?.focus();}
  function ciClose(){if(busy)return;const o=document.getElementById('ci-overlay');if(o)o.hidden=true;previousFocus?.focus?.();}
  function status(text){const el=document.getElementById('ci-status');if(el)el.textContent=text;}
  async function ciLoad(){
    if(!isMember||!telegramId){state=null;ciRender();return false;}
    if(loading)return loading;
    loading=(async()=>{try{state=await ciApi('/sync',{platform:typeof nbPlatform==='function'?nbPlatform():'tg'});ciRender();return active();}catch(e){return active();}finally{loading=null;}})();
    return loading;
  }
  function ciRender(){
    document.body.classList.toggle("introduction-active",active());
    let bar=document.getElementById('ci-progress');
    if(!bar){bar=document.createElement('button');bar.id='ci-progress';bar.className='ci-progress';bar.dataset.ci='steps';document.getElementById('app-level-slot')?.after(bar);}
    bar.hidden=!active();
    const host=document.getElementById('nb-start-host');
    if(!active()){if(host?.dataset.ciOwned){host.innerHTML='';delete host.dataset.ciOwned;}return;}
    if(Number.isFinite(state.points))points=state.points;
    renderLevelCard();
    bar.innerHTML='<span>Знакомство '+Number(state.percent||0)+'%</span><i style="width:'+Math.min(100,Math.max(0,state.percent||0))+'%"></i>';
    if(host){host.dataset.ciOwned='1';const game=state.result&&state.steps.some(s=>s.action==='profile'&&s.done)&&state.steps.some(s=>s.action==='game'&&!s.done);host.innerHTML='<button class="ci-start" data-ci="'+(game?'game':'start')+'">'+(game?'Узнать своего бога продаж':'С чего начать')+' <span aria-hidden="true">↗</span></button>'; }
  }
  async function ciStart(){
    if(!active()){if(!await ciLoad())return showToast('Не удалось открыть знакомство. Попробуй ещё раз.');}
    if(state.result)return result();
    ciShow('<div class="ci-eyebrow">Первый шаг</div><h2>Что сейчас не получается?</h2><p>Напиши свой вопрос о продажах. Подберём занятие и запишем вопрос для личного разбора с Денисом.</p><label class="ci-field">Твой вопрос<textarea id="ci-question" maxlength="500" rows="4" placeholder="Например, клиент говорит «дорого». Что ответить?"></textarea></label><button class="ci-primary" data-ci="submit">Получить ответ</button>');
  }
  async function submit(){
    const question=document.getElementById('ci-question')?.value.trim();if(!question){status('Напиши свой вопрос.');return;}
    const key='club_intro_request_'+telegramId;let id;try{id=sessionStorage.getItem(key)||crypto.randomUUID();sessionStorage.setItem(key,id);}catch(e){id='q_'+Date.now();}
    busy=true;const button=document.querySelector('[data-ci="submit"]');button.disabled=true;status('Записываю вопрос и подбираю лекцию…');
    try{state=await ciApi('/question',{question,request_id:id});ciRender();result();}
    catch(e){status('Не удалось получить ответ. Нажми ещё раз — сохранённый вопрос не продублируется.');}
    finally{busy=false;if(button.isConnected)button.disabled=false;}
  }
  function calendarUrl(meeting){return API_URL+'/onb/ics?'+new URLSearchParams({key:meeting.key,date:meeting.date});}
  function result(){
    const r=state.result;if(!r)return ciStart();const m=r.meeting,l=r.lecture;
    let text=m?'Шикарный вопрос! Я передал его Денису, и он разберёт его лично в ближайшую пятницу, '+esc(m.time)+'. Можешь <a href="'+esc(calendarUrl(m))+'" target="_blank" rel="noopener">добавить себе напоминание в календарь</a>.':'Шикарный вопрос! Я передал его Денису для личного разбора. Дата ближайшей пятничной встречи пока не опубликована — она появится в расписании.';
    if(l)text+=' А прямо сейчас глянь и вот это видео, оно прям по теме:';
    let card='';
    if(l)card='<article class="ci-lecture"><div class="ci-note ci-save-note">лекцию можно сохранить на попозже <span>↘</span></div><button class="ci-save" data-ci="save" aria-label="Смотреть позже">'+(typeof SAVE_ICON!=='undefined'?SAVE_ICON:'◷')+'</button><h3>'+esc(l.title)+'</h3><p>'+esc(l.description||'')+'</p><button class="ci-primary" data-ci="watch">Смотреть лекцию ↗</button>'+(l.has_audio?'<div class="ci-note ci-audio-note">или слушать как подкаст <span>↓</span></div><button class="ci-audio" data-ci="audio">Слушать аудиоверсию →</button>':'')+'</article>';
    if(r.search_status==='pending')card='<p>Вопрос уже записан. Подбор лекции ещё не завершился.</p><button data-ci="refresh">Обновить ответ</button>';
    if(r.search_status==='unavailable')card+='<p class="ci-muted">Сейчас не удалось проверить библиотеку. Это не помешало записать твой вопрос.</p>';
    ciShow('<div class="ci-eyebrow">Твой вопрос записан</div><p class="ci-response">'+text+'</p>'+card+'<button class="ci-primary ci-continue" data-ci="profile">Продолжить знакомство</button>');
  }
  async function steps(){if(!active()&&!await ciLoad())return;ciShow('<div class="ci-eyebrow">Необязательно · в любом порядке</div><h2>Знакомство с клубом</h2><div class="ci-steps">'+state.steps.map(s=>'<button class="ci-step" data-ci="step" data-id="'+esc(s.id)+'"><span class="ci-step-icon">'+(s.done?'✓':'↗')+'</span><span><strong>'+esc(s.title)+'</strong><small>'+esc(s.description)+'</small></span><b>'+(s.done?'Готово':'+'+s.reward)+'</b></button>').join('')+'</div>');}
  async function doStep(id){
    const s=state.steps.find(x=>x.id===id);if(!s)return;
    if(s.action==='first')return ciStart();
    if(s.action==='profile')return profile();
    if(s.action==='game'){ciClose();openQuiz(false,'member');return;}
    if(s.done)return;
    ciClose();
    if(s.action==='custom'){
      ciShow('<h2>'+esc(s.title)+'</h2><p>'+esc(s.description)+'</p>'+(s.target?'<button class="ci-primary" data-ci="custom-open" data-id="'+esc(s.id)+'">'+esc(s.button)+'</button>':'')+'<button class="ci-primary" data-ci="complete" data-id="'+esc(s.id)+'">Готово</button>');return;
    }
    if(s.action==='intro'){nbDoStep(s.action);state=await ciApi('/complete',{step_id:s.id});ciRender();return;}
    nbDoStep(s.action);
  }
  async function record(key){
    if(!active())return;
    const action=key.startsWith('game_')?'game':key;
    const step=state.steps.find(s=>s.action===action&&!s.done);
    if(!step)return;
    if(!['game','chat','intro'].includes(action)){await ciLoad();return;}
    try{state=await ciApi('/complete',{step_id:step.id,platform:nbPlatform()});ciRender();}catch(e){await ciLoad();}
  }
  function profile(){ciClose();profileNext=true;MemberProfiles.openEditor();}
  async function profileSaved(){if(!profileNext)return;profileNext=false;await ciLoad();if(!active())return;await gift();}
  async function gift(){
    try{state=await ciApi('/gift',{});ciRender();}catch(e){ciShow('<h2>Профиль сохранён</h2><p>Не удалось проверить подарок. Можно попробовать ещё раз.</p><button class="ci-primary" data-ci="gift">Проверить подарок</button>');return;}
    const g=state.gift;
    ciShow('<div class="ci-eyebrow">Для тебя</div><h2>'+(g?.amount?'Твои 1000 баллов':'Подарок уже на твоём счёте')+'</h2><p>'+(g?.amount?'А вот и мой подарок за твою решительность — 1000 баллов.':'Ты уже получал 1000 приветственных баллов за знакомство с клубом.')+' Можешь использовать их, чтобы сделать свой аккаунт «Премиум» на месяц. Это даст тебе <button class="ci-inline" data-ci="perks">кучу ничтяков</button>.</p><div id="ci-perks" hidden><ul><li>Заметная аватарка и более крупный текст в чате эфиров.</li><li>Особое оформление профиля.</li><li>Возможность представить себя на бирже специалистов.</li><li>Три карты за продление вместо одной.</li></ul></div><div class="ci-sticky"><button class="ci-primary ci-shimmer" data-ci="premium">Хочу премиум</button><small>1000 баллов · один месяц · без автосписания</small></div>');
  }
  async function premium(){
    // Opening the offer never grants the welcome gift or spends points.
    await ciLoad();
    if(!active()){ciShow('<h2>Премиум в клубе</h2><p>Сейчас предложение недоступно. Попробуй открыть его позже.</p>');return;}
    ciShow('<div class="ci-eyebrow">Для участников клуба</div><h2>Премиум на месяц</h2><p>Заметная аватарка и более крупный текст в чате эфиров, особое оформление профиля, размещение на бирже специалистов и три карты за продление вместо одной.</p><p>На твоём счёте: <strong>'+Number(state.points||0)+' баллов</strong>.</p><div class="ci-sticky"><button class="ci-primary ci-shimmer" data-ci="premium">Хочу премиум</button><small>1000 баллов · один месяц · без автосписания</small></div>');
  }
  async function ciAction(button){
    if(busy)return;const name=button.dataset.ci;
    if(name==='game'){ciClose();openQuiz(false,'member');return;}if(name==='close')return ciClose();if(name==='start')return ciStart();if(name==='steps')return steps();if(name==='submit')return submit();if(name==='profile')return profile();if(name==='gift')return gift();
    if(name==='step')return doStep(button.dataset.id);
    if(name==='custom-open'){const step=state.steps.find(s=>s.id===button.dataset.id);ciClose();if(step?.target)runAppRoute(step.target);return;}
    if(name==='perks'){const el=document.getElementById('ci-perks');el.hidden=!el.hidden;return;}
    if(name==='refresh'){busy=true;button.disabled=true;try{state=await ciApi('/question',{});ciRender();result();}finally{busy=false;if(button.isConnected)button.disabled=false;}return;}
    if(name==='save'){await ensureLibrary();toggleSaved(state.result.lecture.slug);button.setAttribute('aria-pressed',String(savedSlugs.has(state.result.lecture.slug)));return;}
    if(name==='watch'||name==='audio'){const l=state.result?.lecture;if(!l)return;ciClose();return openLectureByKey(l.slug,name==='audio'?'audio':'');}
    if(name==='complete'){busy=true;try{state=await ciApi('/complete',{step_id:button.dataset.id});ciRender();steps();}catch(e){status(e.message);}finally{busy=false;}return;}
    if(name==='premium'){busy=true;button.disabled=true;try{const r=await ciApi('/premium',{request_id:'welcome_month'});ciShow('<h2>Премиум активен</h2><p>До '+esc(new Date(r.until).toLocaleDateString('ru-RU'))+'. Все возможности уже доступны.</p><button class="ci-primary" data-ci="close">Отлично</button>');MemberProfiles.load();}catch(e){status(e.message||'Не удалось активировать. Попробуй ещё раз.');}finally{busy=false;if(button.isConnected)button.disabled=false;}}
  }
  document.addEventListener('click',e=>{const b=e.target.closest('[data-ci]');if(b)ciAction(b).catch(()=>status('Не удалось выполнить действие. Попробуй ещё раз.'));});
  document.addEventListener('keydown',e=>{const o=document.getElementById('ci-overlay');if(!o||o.hidden)return;if(e.key==='Escape')ciClose();if(e.key==='Tab'){const list=[...o.querySelectorAll('button:not(:disabled),textarea,a[href]')].filter(x=>x.offsetParent!==null);const first=list[0],last=list.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}});
  window.addEventListener('focus',()=>{if(active())ciLoad();});
  return {active,load:ciLoad,render:ciRender,start:ciStart,steps,premium,profileSaved,record};
})();
