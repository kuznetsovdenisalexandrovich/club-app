/* One share flow for AI games, archetypes and knowledge quizzes. */
let gameShareData=null,gameShareFile=null,gameShareBusy=false,gameInvite=null;
const gsText=(key)=>t('resultshare.'+key);
async function gameShareAPI(path,body){return apiRequest(API_URL+'/game-sharing'+path,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:undefined,45000)}
function closeGameShare(){document.getElementById('game-share-overlay')?.classList.remove('open');appSyncNavigation()}
async function openGameShare(kind){
 if(gameShareBusy)return;
 if(!telegramId){showToast(gsText('telegramRequired'));return}
 gameShareBusy=true;
 try{
  const payload={kind,guest_key:ggGuestKey()};
  if(kind==='ai')payload.result_id=ggS?.session_id||'';
  if(kind==='quiz')payload.result_id=kqAttempt?.attempt_id||'';
  if(kind==='gods')payload.code=quizResult?.code||'';
  gameShareData=await gameShareAPI('',payload);gameShareFile=null;
  closeGameShare();
  showToast(gsText('sending'));
  await gameShareAPI('/'+gameShareData.id+'/send',{});
  showToast(gsText('sent'));
 }catch(e){showToast(e.message||gsText('error'))}finally{gameShareBusy=false}
}
async function gameShareImage(){
 if(!gameShareFile||!gameShareData)return;
 const text=gameShareData.title+' — '+gameShareData.score+'\n'+gsText('free')+'\n'+gameShareData.url;
 if(navigator.share&&navigator.canShare?.({files:[gameShareFile]})){
  try{await navigator.share({files:[gameShareFile],title:gameShareData.title,text})}catch(e){if(e.name!=='AbortError')showToast(gsText('error'))}return;
 }
 const href=URL.createObjectURL(gameShareFile),a=document.createElement('a');a.href=href;a.download='game-result.jpg';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(href),10000);showToast(gsText('saved'));
}
function gameShareLink(){if(gameShareData)shareWithChoice(gameShareData.title+' — '+gameShareData.score+'. '+gsText('free'),gameShareData.payload)}
async function gameShareBot(button){if(!gameShareData)return;button.disabled=true;try{await gameShareAPI('/'+gameShareData.id+'/send',{});showToast(gsText('sent'))}catch(e){showToast(e.message||gsText('error'))}finally{button.disabled=false}}
async function openGameInvitation(token){
 try{
  await waitProfile(8000);const data=await gameShareAPI('/'+token);gameInvite=data;
  if(data.ref_code){try{localStorage.setItem(REF_PENDING_KEY,data.ref_code)}catch(e){}await attachPendingReferral()}
  const shell=document.getElementById('app-shell');if(!shell||shell.style.display==='none'||shell.style.display==='')enterDemoMode();
  if(data.kind==='gods'){openQuiz(true);return}
  if(data.kind==='ai'){await ggOpenTo(data.game_key,'rules');return}
  switchView('games');document.documentElement.setAttribute('data-games-category','quizzes');document.querySelector('.kq-categories').hidden=true;document.getElementById('gg-list').style.display='none';kqPanel().hidden=false;
  kqCatalog={access:{allowed:true},quizzes:[data.quiz]};kqIntro(data.quiz.id);syncTgBackButton('games');
 }catch(e){showToast(e.message||gsText('error'))}
}
function gameInviteToken(key){return gameInvite?.kind==='ai'&&(!key||gameInvite.game_key===key)?gameInvite.id:''}
function gameInviteQuiz(){return gameInvite?.kind==='quiz'&&kqQuiz?.id===gameInvite.game_key}
