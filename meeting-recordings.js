/* Private Telemost replay. The permanent target is meeting_<calendar event ID>. */
let meetingPlayer=null, meetingGeneration=0;
function closeMeetingRecording(){meetingGeneration++;if(meetingPlayer){meetingPlayer.destroy();meetingPlayer=null;}const d=document.getElementById('meeting-recording');if(d)d.remove();}
async function openMeetingRecording(id){
 closeMeetingRecording(); const gen=meetingGeneration;
 id=Number(id);if(!Number.isSafeInteger(id)||id<=0)return;
 if(window.ClubAppRescue)ClubAppRescue.target('meeting_'+id);
 const overlay=document.createElement('div');overlay.id='meeting-recording';overlay.className='overlay open';overlay.style.cssText='position:fixed;inset:0;z-index:12000;background:rgba(0,0,0,.8);display:flex;align-items:center;justify-content:center;padding:16px';
 const panel=document.createElement('section');panel.style.cssText='background:var(--bg,#171622);color:var(--text,#fff);width:min(800px,100%);max-height:90vh;overflow:auto;border-radius:20px;padding:20px';
 const close=document.createElement('button');close.textContent='Закрыть';close.className='lec-link-btn';close.onclick=closeMeetingRecording;
 const title=document.createElement('h2');title.textContent='Запись встречи';
 const body=document.createElement('div');body.textContent='Загружаем…';panel.append(close,title,body);overlay.append(panel);document.body.append(overlay);
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
  meetingPlayer=new ClubFilmPlayer(body,{sources:media.sources,text:t,expiresIn:media.expires_in,refreshSources:()=>refreshFilmSources(path),onEvent:()=>{},onDiagnostic:filmDiagnostics('meeting')});
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
