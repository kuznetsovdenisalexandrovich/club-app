/* Deadlines come from the server; performance.now avoids local clock jumps. */
let saleBonusOnly=false;
let saleOffer=null,saleTickId=null,saleDeadline=0;
function saleTimerPlace(){
 const bar=document.getElementById('bonus-bar'),slot=document.getElementById('app-level-slot');
 if(bar&&slot&&bar.parentElement!==slot)slot.prepend(bar);
}
function saleTimerUse(data,code){
 const timer=data?.timer;if(!timer?.expires_at||timer.reason==='not_started'){saleOffer=null;clearInterval(saleTickId);document.getElementById('bonus-bar')?.classList.remove('on');return;}
 saleOffer={...data,code};saleDeadline=performance.now()+Math.max(0,timer.seconds_left||0)*1000;
 try{localStorage.setItem('club_sale_code',code)}catch(e){}
 clearInterval(saleTickId);saleTimerTick();saleTickId=setInterval(saleTimerTick,1000);
}
function saleTimerTick(){
 if(!saleOffer)return;
 const bar=document.getElementById('bonus-bar');if(!bar)return;
 saleTimerPlace();
 if(isMember){bar.classList.remove('on');clearInterval(saleTickId);return}
 const left=Math.max(0,Math.ceil((saleDeadline-performance.now())/1000));
 bar.classList.toggle('on',left>0);bar.setAttribute('role','button');bar.tabIndex=0;bar.setAttribute('aria-label','Срок и условия предложения');
 bar.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();bwOpen()}};
 const h=Math.floor(left/3600),m=Math.floor(left%3600/60),s=left%60;
 document.getElementById('bb-time').textContent=[h,m,s].map((n,i)=>i?String(n).padStart(2,'0'):n).join(':');
 document.getElementById('bb-txt').textContent=(saleOffer.headline||'Специальное предложение')+' · до конца';
 const fuse=document.getElementById('bb-fuse');if(fuse)fuse.hidden=true;
 if(!left){clearInterval(saleTickId);saleOffer.ok=false;const btn=document.getElementById('promo-t1r-btn');if(btn&&document.getElementById('promo-t1r-overlay')?.classList.contains('open')){btn.textContent='Посмотреть обычные тарифы';btn.onclick=()=>{closePromoTester();openAccessPage()}}}
}
async function saleTimerRefresh(){
 let code=typeof promoCode!=='undefined'?promoCode:'';try{code=code||localStorage.getItem('club_sale_code')||''}catch(e){}
 if(!code||isMember)return;
 try{const d=await apiRequest(API_URL+'/promo/'+encodeURIComponent(code)+'/claim',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...actionIdent(),guest_key:ggGuestKey()})});saleTimerUse(d,code)}catch(e){}
}
window.addEventListener('load',async()=>{saleTimerPlace();try{const p=await apiRequest(API_URL+'/sales-offers/policy');saleBonusOnly=!!p.bonus_window_only}catch(e){}await waitProfile(8000);saleTimerRefresh()});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)saleTimerRefresh()});
