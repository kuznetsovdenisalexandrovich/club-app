/* Inline edition of the club podcast controls. Owns its media node only;
   never replaces the library queue, playback position or entitlement resolver. */
window.ClubLessonAudio=class {
 constructor(slot,{url,lecture={},onPlaying=()=>{},onEnded=()=>{},onError=()=>{}}){
  this.root=document.createElement('section');this.root.className='lesson-podcast';
  this.root.setAttribute('aria-label','Аудиоплеер занятия');
  this.root.innerHTML='<div class="fp-cover">'+plCoverHtml(lecture)+'</div><div class="fp-sub">Слушай как подкаст</div><div class="fp-progress"><input class="podcast-seek" type="range" min="0" max="100" value="0" step="0.1" aria-label="Позиция воспроизведения"><div class="fp-times"><span data-podcast="current">0:00</span><span data-podcast="duration">0:00</span></div></div><div class="mp-controls-row fp-controls-row"><div class="mp-controls"><button class="mp-btn skip" data-podcast="back" aria-label="Назад 15 секунд">−15</button><button class="mp-btn big" data-podcast="play" aria-label="Слушать">'+PL_ICON_PLAY+'</button><button class="mp-btn skip" data-podcast="forward" aria-label="Вперёд 15 секунд">+15</button></div><button class="mp-speed" data-podcast="speed" aria-label="Скорость воспроизведения">1×</button></div><span class="podcast-status" role="status"></span>';
  slot.appendChild(this.root);
  this.media=document.createElement('audio');this.media.preload='metadata';this.media.src=url;this.root.appendChild(this.media);
  this.seek=this.root.querySelector('input');this.playButton=this.root.querySelector('[data-podcast="play"]');
  this.resumeCleanup=window.ClubMaterialHistory?.attachAudio(this.media,lecture);
  this.status=this.root.querySelector('.podcast-status');this.lecture=lecture;this.dead=false;
  this.events=new AbortController();const listen=(event,fn)=>this.media.addEventListener(event,()=>{if(!this.dead)fn();},{signal:this.events.signal});
  const sync=()=>{const playing=!this.media.paused&&!this.media.ended;this.playButton.innerHTML=playing?PL_ICON_PAUSE:PL_ICON_PLAY;this.playButton.setAttribute('aria-label',playing?'Пауза':'Слушать');if(msOwner==='lesson-podcast')msState(playing);};
  const progress=()=>{const a=this.media,d=Number.isFinite(a.duration)?a.duration:0;this.seek.disabled=!d;this.seek.value=d?100*a.currentTime/d:0;this.seek.style.setProperty('--podcast-progress',this.seek.value+'%');this.root.querySelector('[data-podcast="current"]').textContent=plFmt(a.currentTime);this.root.querySelector('[data-podcast="duration"]').textContent=plFmt(d);};
  listen('loadedmetadata',progress);listen('durationchange',progress);listen('timeupdate',progress);
  listen('play',()=>{if(typeof plAudio!=='undefined')plAudio?.pause();if(typeof filmPipPause==='function')filmPipPause();sync();});
  listen('playing',()=>{this.status.textContent='';msTake('lesson-podcast',{title:lecture.title,cover:lecSquareCover(lecture)}, {play:()=>this.play(),pause:()=>this.pause(),stop:()=>this.pause(),seekbackward:()=>this.skip(-15),seekforward:()=>this.skip(15),seekto:d=>this.seekTo(d.seekTime)});sync();onPlaying();});
  listen('pause',sync);listen('ended',()=>{sync();onEnded();});
  listen('error',()=>{sync();this.status.textContent='Аудио не загрузилось. Нажми ▶, чтобы повторить.';onError();});
  this.root.addEventListener('click',e=>{switch(e.target.closest('[data-podcast]')?.dataset.podcast){case 'play':this.media.paused?this.play():this.pause();break;case 'back':this.skip(-15);break;case 'forward':this.skip(15);break;case 'speed':{const speeds=[1,1.25,1.5,1.75,2];this.media.playbackRate=speeds[(speeds.indexOf(this.media.playbackRate)+1)%speeds.length];const b=this.root.querySelector('[data-podcast="speed"]');b.textContent=this.media.playbackRate+'×';b.setAttribute('aria-label','Скорость '+b.textContent);break;}}},{signal:this.events.signal});
  this.seek.addEventListener('input',()=>this.seekTo(this.media.duration*Number(this.seek.value)/100),{signal:this.events.signal});progress();
 }
 seekTo(seconds){if(!this.dead&&Number.isFinite(seconds)&&Number.isFinite(this.media.duration))this.media.currentTime=Math.max(0,Math.min(this.media.duration,seconds));}
 skip(seconds){this.seekTo(this.media.currentTime+seconds);}
 play(){if(this.dead)return Promise.resolve();if(this.media.error)this.media.load();return this.media.play().catch(()=>{if(!this.dead){this.playButton.innerHTML=PL_ICON_PLAY;this.playButton.setAttribute('aria-label','Слушать');this.status.textContent='Нажми ▶, чтобы начать прослушивание.';}});}
 pause(){this.media.pause();}
 get hidden(){return this.root.hidden;}
 set hidden(value){this.root.hidden=value;}
 destroy(){if(this.dead)return;this.resumeCleanup?.();this.dead=true;this.events.abort();this.media.pause();this.media.removeAttribute('src');this.media.load();this.root.remove();msRelease('lesson-podcast');}
};
