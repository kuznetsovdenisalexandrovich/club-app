/* Private Telemost replay. The permanent target is meeting_<calendar event ID>. */
let meetingPlayer=null, meetingGeneration=0, meetingPreviousFocus=null, meetingPreviousOverflow=null;
function meetingKeydown(event){
 if(event.key==='Escape'&&!document.fullscreenElement&&!meetingPlayer?.expanded){event.preventDefault();closeMeetingRecording();return;}
 if(event.key==='Tab'){
  const panel=document.getElementById('meeting-recording');if(!panel)return;
  const items=Array.from(panel.querySelectorAll('button:not([disabled]),a[href],video[controls],[tabindex="0"]')).filter(x=>x.getClientRects().length);
  const first=items[0],last=items[items.length-1];if(!first)return;
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
  else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
 }
}
function closeMeetingRecording(){
 meetingGeneration++;if(meetingPlayer){meetingPlayer.destroy();meetingPlayer=null;}
 document.removeEventListener('keydown',meetingKeydown);
 const d=document.getElementById('meeting-recording');if(d)d.remove();
 if(meetingPreviousOverflow!==null){document.body.style.overflow=meetingPreviousOverflow;meetingPreviousOverflow=null;}
 if(meetingPreviousFocus?.isConnected)meetingPreviousFocus.focus();meetingPreviousFocus=null;
}
async function openMeetingRecording(id){
 if(typeof isMember!=='undefined'&&!isMember&&!(typeof isPaused!=='undefined'&&isPaused)){openPaywall();return;}
 closeMeetingRecording();const gen=meetingGeneration;
 id=Number(id);if(!Number.isSafeInteger(id)||id<=0)return;
 if(window.ClubAppRescue)ClubAppRescue.target('meeting_'+id);
 meetingPreviousFocus=document.activeElement;meetingPreviousOverflow=document.body.style.overflow;document.body.style.overflow='hidden';
 const overlay=document.createElement('div');overlay.id='meeting-recording';overlay.className='meeting-replay-overlay';
 overlay.addEventListener('click',event=>{if(event.target===overlay)closeMeetingRecording();});
 const panel=document.createElement('section');panel.className='meeting-replay-panel';panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-labelledby','meeting-recording-title');
 const header=document.createElement('header');header.className='meeting-replay-header';
 const close=document.createElement('button');close.type='button';close.textContent='×';close.className='meeting-replay-close';close.setAttribute('aria-label','Закрыть запись');close.onclick=closeMeetingRecording;
 const title=document.createElement('h2');title.id='meeting-recording-title';title.textContent='Запись встречи';
 const body=document.createElement('div');body.className='meeting-replay-body';body.textContent='Загружаем…';header.append(title,close);panel.append(header,body);overlay.append(panel);document.body.append(overlay);
 document.addEventListener('keydown',meetingKeydown);close.focus?.();
 try{
  const data=await apiRequest(API_URL+'/meetings/'+id);
  if(gen!==meetingGeneration)return;
  title.textContent=data.title;body.replaceChildren();
  if(data.state==='library'){
   for(const item of data.lectures){const b=document.createElement('button');b.className='lec-link-btn';b.style.cssText='display:block;margin:12px 0';b.textContent=item.title;b.onclick=()=>{closeMeetingRecording();openArchiveLecture(item.slug);};body.append(b);}
   if(window.ClubAppRescue)ClubAppRescue.mark('content');return;
  }
  if(data.state==='live'){
   const b=document.createElement('button');b.className='lec-link-btn';b.textContent='Попасть на занятие';b.onclick=()=>openUrl(data.link);body.append(b);return;
  }
  if(data.state!=='recording'){body.textContent=data.state==='expired'?'Срок хранения временной записи истёк. Здесь появятся готовые занятия после публикации.':'Запись появится здесь после встречи и обработки видео.';return;}
  await filmEngineReady();
  const path=API_URL+'/media/meeting/'+id+'/replay?direct_capable=1';
  const media=await apiRequest(path);
  if(gen!==meetingGeneration)return;
  meetingPlayer=new ClubFilmPlayer(body,{sources:media.sources,text:key=>key==='film.start'?'Смотреть запись':key==='funnel.title'?'Запись занятия':t(key),expiresIn:media.expires_in,refreshSources:()=>refreshFilmSources(path),onEvent:()=>{},onDiagnostic:filmDiagnostics('meeting')});
 }catch(e){if(gen!==meetingGeneration)return;body.textContent='Не удалось открыть запись. Проверь доступ к клубу и попробуй ещё раз.';const b=document.createElement('button');b.className='lec-link-btn';b.textContent='Повторить';b.onclick=()=>openMeetingRecording(id);body.append(b);}
}
let meetingNoticeTimer;
function renderMeetingNotice(notice){
 let box=document.getElementById('meeting-recording-notice');
 if(!box){const calendar=document.getElementById('cal-widget-grid');if(!calendar)return;box=document.createElement('div');box.id='meeting-recording-notice';calendar.parentNode.insertBefore(box,calendar);}
 clearTimeout(meetingNoticeTimer);box.replaceChildren();
 if(!notice)return;const remaining=Date.parse(notice.until)-Date.now();if(!(remaining>0))return;
 const button=document.createElement('button');button.className='lec-link-btn';button.style.cssText='width:100%;margin:12px 0';button.textContent=notice.title;button.onclick=()=>openMeetingRecording(notice.event_id);box.append(button);
 meetingNoticeTimer=setTimeout(()=>box.replaceChildren(),Math.min(remaining,2147483647));
}
