(()=>{
 const pay=document.getElementById('pay'),status=document.getElementById('status');
 let url='';
 const title=document.querySelector('h1'),intro=document.querySelector('.intro');
 const initialTitle=title.innerHTML,initialIntro=intro.textContent;
 function render(){
 url='';pay.removeAttribute('href');pay.setAttribute('aria-disabled','true');title.innerHTML=initialTitle;intro.textContent=initialIntro;
 try{const p=new URLSearchParams(location.hash.slice(1));const values=p.getAll('pay');if(values.length===1&&values[0].length<=16000&&ClubPaymentNavigation.isPayment(values[0]))url=values[0];}catch(e){}
 if(url){pay.href=url;pay.rel='noreferrer noopener';pay.removeAttribute('aria-disabled');status.textContent='Продолжится тот же заказ. Повторная регистрация не нужна.';}
 else{document.querySelector('h1').textContent='Нужна ссылка на оплату';document.querySelector('.intro').textContent='Открой эту страницу по кнопке оплаты в приложении или боте клуба.';status.textContent='Ссылка отсутствует или не прошла проверку.';}
 }
 render();window.addEventListener('hashchange',render);
 pay.addEventListener('click',()=>{if(!url)return;status.textContent='Переходим к Продамусу. Если ты вернулся после оплаты, проверь доступ в приложении — повторно платить не нужно.';});
 document.getElementById('theme').onclick=()=>{document.documentElement.dataset.theme=document.documentElement.dataset.theme==='dark'?'light':'dark';};
 // No order creation, credentials, analytics, polling or entitlement changes on this page.
})();
