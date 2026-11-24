/* Original Telegram captures. No rewritten testimonials or eager media downloads. */
(function(root){
 'use strict';
 let items=null,flight=null,topic='',count=0,generation=0;
 const batch=12;
 const el=id=>document.getElementById(id);
 function pause(){el('view-reviews')?.querySelectorAll('video').forEach(v=>v.pause());}
 function stop(){generation++;pause();}
 function go(item){
  stop();
  if(item.target&&/^l[ai]?_[a-zA-Z0-9_-]+$/.test(item.target))return runAppRoute(item.target);
  openAccessPage();
 }
 function more(){
  const selected=items.filter(x=>!topic||x.topic===topic),part=selected.slice(count,count+batch);
  for(const item of part){
   const card=document.createElement('article');card.className='review-card';card.dataset.reviewId=item.id;
   const asset=document.createElement(item.kind==='video'?'video':'img');
   asset.src=item.src;
   if(item.kind==='video'){
    asset.controls=true;asset.playsInline=true;asset.preload='none';if(item.poster)asset.poster=item.poster;
    asset.addEventListener('play',()=>el('review-list').querySelectorAll('video').forEach(v=>{if(v!==asset)v.pause();}));
   }else{asset.loading='lazy';asset.decoding='async';asset.tabIndex=0;asset.setAttribute('role','button');asset.addEventListener('click',()=>openCardZoom(item.src));asset.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openCardZoom(item.src);}});asset.alt=item.alt||'Отзыв из Telegram';if(item.width&&item.height){asset.width=item.width;asset.height=item.height;}}
   asset.addEventListener(item.kind==='video'?'loadeddata':'load',()=>{if(el('view-reviews').classList.contains('active'))root.ClubAppRescue?.mark('content');},{once:true});
   asset.addEventListener('error',()=>{if(card.querySelector('.review-media-error'))return;const e=document.createElement('a');e.className='review-media-error';e.textContent='Открыть оригинал в Telegram';e.href=item.source;e.target='_blank';e.rel='noopener';asset.hidden=true;card.prepend(e);},{once:true});
   card.append(asset);
   if(item.source){const source=document.createElement('a');source.className='review-source';source.textContent='В Telegram';source.href=item.source;source.target='_blank';source.rel='noopener';card.append(source);}
   const button=document.createElement('button');button.className='lec-link-btn access-btn';button.textContent=item.target?'Узнать как':'Хочу так же';button.addEventListener('click',()=>go(item));card.append(button);
   el('review-list').append(card);
  }
  count+=part.length;el('review-more').hidden=count>=selected.length;
  el('review-count').textContent=String(selected.length);
 }
 function render(){
  pause();count=0;el('review-list').replaceChildren();el('review-filters').replaceChildren();
  for(const name of ['',...new Set(items.map(x=>x.topic).filter(Boolean))]){
   const b=document.createElement('button');b.className='review-filter';b.textContent=name||'Все';b.setAttribute('aria-pressed',String(name===topic));b.addEventListener('click',()=>{topic=name;render();});el('review-filters').append(b);
  }
  more();
 }
 async function open(){
  root.ClubAppRescue?.target('reviews');switchView('reviews');const current=++generation;
  el('review-status').textContent='';el('review-retry').hidden=true;
  if(items){render();return;}
  el('review-retry').hidden=true;el('review-status').textContent='Загружаем отзывы…';
  try{
   if(!flight)flight=fetch('reviews/catalogue.json',{cache:'no-cache'}).then(r=>{if(!r.ok)throw Error('catalogue');return r.json();}).finally(()=>{flight=null;});
   const data=await flight;
   if(!Array.isArray(data)||!data.length)throw Error('empty');
   items=data.filter(x=>x&&/^[a-z0-9_-]+$/.test(x.id)&&/^reviews\/[a-zA-Z0-9_./-]+\.(png|jpg|jpeg|webp|mp4)$/.test(x.src)&&(!x.source||/^https:\/\/t\.me\//.test(x.source)));
   if(!items.length)throw Error('empty');
   if(current!==generation)return;
   el('review-status').textContent='';render();
  }catch(e){if(current!==generation)return;root.ClubAppRescue?.fail('content_error');el('review-status').textContent='Не удалось загрузить отзывы.';el('review-retry').hidden=false;}
 }
 function init(){
  el('review-more').addEventListener('click',more);el('review-retry').addEventListener('click',()=>{el('review-retry').hidden=true;open();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
 }
 root.ClubReviews={open,stop};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(window);
