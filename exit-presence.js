/* A hidden window is a hint, not proof of a closed application. */
(function(){
 const session=Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10);
 let externalUntil=0,lastSeq=0;
 window.clubExitExternal=function(){externalUntil=Date.now()+120000;};
 function send(){
  try{
   if(typeof telegramId==='undefined'||!telegramId||typeof ivIdent!=='function')return;
   const identity=ivIdent();if(!identity.tg_init)return;
   const state=document.hidden?(Date.now()<externalUntil?'external':'hidden'):'visible';
   lastSeq=Math.max(Date.now(),lastSeq+1);
   fetch(API_URL+'/events',{method:'POST',keepalive:true,headers:{'Content-Type':'application/json'},body:JSON.stringify({telegram_id:telegramId,tg_init:identity.tg_init,event:'app_presence',ref:JSON.stringify({session,state,seq:lastSeq}),value:0})}).catch(()=>{});
  }catch(e){}
 }
 document.addEventListener('visibilitychange',send);
 window.addEventListener('pagehide',send);
 document.addEventListener('click',function(e){const a=e.target.closest&&e.target.closest('a[href]');if(a&&/^https?:/.test(a.href))window.clubExitExternal();},true);
 setInterval(function(){if(!document.hidden)send();},20000);
 setTimeout(send,3000);
})();
