/* HLS playback, native on Safari and bundled hls.js on MSE browsers. */
(function(root){
  'use strict';
  class ClubFilmPlayer {
    constructor(slot,options){
      this.options=options; this.slot=slot;
      this.sourcesExpireAt=Date.now()+Math.max(60,Number(options.expiresIn)||14400)*1000-60000;this.refreshing=false;this.lastRefresh=0;
      this.sources=options.sources.filter(s=>/^https:\/\//.test(s.url));
      if(!this.sources.length)throw Error('No film sources');
      this.diagStarted=false;this.diagWaiting=false;this.diagFrame=false;this.engine='unknown';
      this.index=-1;this.position=options.position||0;this.generation=0;
      this.wantsPlay=false;this.started=false;this.destroyed=false;this.exhausted=false;
      this.quality='auto';this.failedSources=new Set();this.timer=null;this.helpTimer=null;
      this.wrapper=document.createElement('div');this.wrapper.className='native-film';
      this.notice=document.createElement('div');this.notice.className='native-film-notice';
      this.notice.setAttribute('role','status');this.notice.setAttribute('aria-live','polite');
      this.start=this.button(options.text('film.start'),'native-film-start',()=>this.play());
      this.help=document.createElement('div');this.help.className='native-film-help';
      this.retry=this.button(options.text('film.help'),'native-film-retry',()=>{this.panel.hidden=!this.panel.hidden;});
      this.retry.hidden=true;
      this.panel=document.createElement('div');this.panel.className='native-film-help-panel';this.panel.hidden=true;
      this.other=this.button(options.text('film.other_server'),'native-film-option',()=>{this.wantsPlay=true;this.switchSource(true);});
      this.low=this.button(options.text('film.low'),'native-film-option',()=>this.setQuality('360'));
      this.auto=this.button(options.text('film.auto'),'native-film-option',()=>this.setQuality('auto'));
      this.panel.append(this.other,this.low,this.auto);this.help.append(this.retry,this.panel);
      this.fullscreen=this.button(options.text('film.fullscreen'),'native-film-fullscreen',()=>this.toggleFullscreen());
      this.fullscreen.textContent='';
      this.fullscreen.innerHTML='<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/></svg>';
      this.fullscreen.setAttribute('aria-label',options.text('film.fullscreen'));this.fullscreen.title=options.text('film.fullscreen');
      this.help.append(this.fullscreen);
      this.wrapper.append(this.notice,this.start);slot.replaceChildren(this.wrapper,this.help);
      this.visibilityHandler=()=>{this.clearTimers();if(!document.hidden&&this.wantsPlay)this.arm();};
      document.addEventListener('visibilitychange',this.visibilityHandler);
      this.switchSource(false);
    }
    button(text,className,click){const b=document.createElement('button');b.type='button';b.className=className;b.textContent=text;b.onclick=click;return b;}
    emit(method){if(!this.destroyed)this.options.onEvent({method,time:this.position,duration:this.video?this.video.duration:0});}
    diagnostic(event,extra={}){
      const v=this.video;
      try{if(this.options.onDiagnostic)this.options.onDiagnostic({event,source:this.index,engine:this.engine,
        server:root.clubMediaServer?root.clubMediaServer(this.sources[this.index]?.url):'unknown',position:Math.min(86400,Math.max(0,Math.round(this.position||0))),visible:!document.hidden,
        ready:v&&v.readyState||0,network:v&&v.networkState||0,quality:this.quality,...extra});}catch(e){}
    }
    failure(reason,extra={}){this.diagWaiting=true;this.diagnostic('error',{reason,...extra});}
    fault(code){this.diagWaiting=true;this.diagnostic(code==='film_unavailable'?'unavailable':'stall');try{if(this.options.onFault)this.options.onFault(code);}catch(e){}}
    status(key){this.notice.textContent=key?this.options.text(key):'';}
    clearTimers(){clearTimeout(this.timer);clearTimeout(this.helpTimer);this.timer=null;this.helpTimer=null;}
    progress(){
      this.clearTimers();this.retry.hidden=true;this.panel.hidden=true;
      if(this.wantsPlay)this.arm();
    }
    arm(){
      if(!this.wantsPlay||this.destroyed||this.exhausted||document.hidden)return;
      // Preserve these deadlines through source changes: continuous waiting counts.
      if(!this.helpTimer&&this.retry.hidden){
        this.helpTimer=setTimeout(()=>{this.helpTimer=null;if(this.wantsPlay){this.retry.hidden=false;this.fault('film_stall');}},this.options.helpMs||10000);
      }
      // Keep the fast first failover, but let the final source finish a slow
      // native startup. NETWORK_LOADING/HAVE_NOTHING is not a media error.
      const loadingStartup=this.engine==='native'&&!this.started&&this.video&&this.video.readyState===0&&this.video.networkState===2;
      const lastCandidate=this.failedSources.size>=this.sources.length-1;
      const wait=this.options.stallMs||(this.index===0&&this.sources.length>1?4000:loadingStartup&&lastCandidate?20000:8000);
      if(!this.timer)this.timer=setTimeout(()=>{this.timer=null;this.failure('progress_timeout');this.switchSource(false);},wait);
    }
    async refreshSources(){
      if(this.refreshing||this.destroyed)return;
      this.refreshing=true;this.lastRefresh=Date.now();this.clearTimers();this.diagWaiting=true;
      if(this.video&&this.video.currentTime>0)this.position=this.video.currentTime;
      this.diagnostic('refresh',{reason:'links_expired'});this.status('film.switching');
      try{
        const manifest=await this.options.refreshSources();
        if(this.destroyed)return;
        const sources=(manifest.sources||[]).filter(s=>/^https:\/\//.test(s.url));
        if(!sources.length)throw Error('no_sources');
        this.sources=sources;this.sourcesExpireAt=Date.now()+Math.max(60,Number(manifest.expires_in)||14400)*1000-60000;
        this.failedSources.clear();this.index=-1;this.diagnostic('refreshed');
      }catch(e){if(!this.destroyed)this.diagnostic('refresh_failed',{http:Number(e.status)||0,reason:'manifest_failed'});}
      finally{this.refreshing=false;}
      if(!this.destroyed)this.switchSource(false);
    }
    switchSource(manual,same=false){
      if(this.destroyed||this.refreshing)return;
      if(this.options.refreshSources&&Date.now()>=this.sourcesExpireAt&&Date.now()-this.lastRefresh>60000){this.refreshSources();return;}
      clearTimeout(this.timer);this.timer=null;
      if(this.video&&Number.isFinite(this.video.currentTime)&&this.video.currentTime>0)this.position=this.video.currentTime;
      this.emit('pause');
      if(manual)this.failedSources.clear();
      if(!same&&this.index>=0&&!manual)this.failedSources.add(this.index);
      let next=this.index;
      if(!same){
        for(let step=1;step<=this.sources.length;step++){
          const candidate=(this.index+step)%this.sources.length;
          if(!this.failedSources.has(candidate)){next=candidate;break;}
        }
      }
      if(!same&&this.failedSources.size>=this.sources.length){
        if(this.wantsPlay)this.fault('film_unavailable');
        this.exhausted=true;this.wantsPlay=false;this.clearTimers();
        ++this.generation;if(this.video)this.video.pause();
        this.status('film.unavailable');this.retry.hidden=false;this.panel.hidden=false;this.start.hidden=true;return;
      }
      this.exhausted=false;
      if(!same)this.index=next;
      this.engine='unknown';this.diagFrame=false;this.hlsReports={};this.diagnostic('source',{reason:manual?'manual':same?'quality':'automatic'});
      const generation=++this.generation;
      // Keep the same element: WebKit grants playback permission per element.
      if(this.mediaListeners){for(const [name,listener] of this.mediaListeners)this.video.removeEventListener(name,listener);}
      this.mediaListeners=[];
      if(this.hls){this.hls.destroy();this.hls=null;}
      const fresh=!this.video;
      const v=this.video||(this.video=document.createElement('video'));
      if(!fresh){v.pause();v.removeAttribute('src');v.load();}
      v.controls=this.started;v.playsInline=true;v.preload='metadata';
      v.poster=this.options.poster||'';v.setAttribute('playsinline','');v.setAttribute('aria-label',this.options.text('funnel.title'));
      if(fresh)this.wrapper.prepend(v);
      const active=()=>!this.destroyed&&generation===this.generation;
      const on=(name,fn)=>{const listener=()=>{if(active())fn();};this.mediaListeners.push([name,listener]);v.addEventListener(name,listener);};
      on('loadedmetadata',()=>{
        if(this.position>0&&Number.isFinite(v.duration))v.currentTime=Math.min(this.position,Math.max(0,v.duration-.1));
        this.emit('loaded');if(!this.wantsPlay)this.status('');
      });
      on('play',()=>{this.wantsPlay=true;this.arm();});
      on('playing',()=>{
        this.started=true;v.controls=true;this.start.hidden=true;this.start.disabled=false;
        this.wantsPlay=true;this.status('');this.emit('play');this.progress();
      });
      on('timeupdate',()=>{
        if(v.seeking||v.readyState<2)return;
        const advancing=v.currentTime>this.position+.02;this.position=v.currentTime;
        if(advancing&&!v.paused){this.failedSources.clear();
          if(!this.diagFrame||this.diagWaiting){this.diagnostic(this.diagWaiting?'recovered':'frame');this.diagWaiting=false;this.diagFrame=true;}
          this.progress();this.emit('time');}
      });
      on('waiting',()=>{if(this.wantsPlay){this.emit('pause');this.status('film.buffering');this.arm();}});
      on('seeking',()=>{this.position=v.currentTime;this.emit('pause');this.clearTimers();this.arm();});
      on('pause',()=>{if(!v.paused)return;this.wantsPlay=false;this.clearTimers();this.showStart();this.emit('pause');});
      on('ended',()=>{if(!v.ended)return;this.wantsPlay=false;this.clearTimers();this.position=v.currentTime;this.diagnostic('ended');this.emit('stop');});
      on('error',()=>{this.failure('media_error',{media:v.error&&v.error.code||0});this.switchSource(false);});
      const source=this.sources[this.index];
      // Native HLS must request cross-origin signed segments in CORS mode.
      if(source.type==='hls')v.crossOrigin='anonymous';else v.removeAttribute('crossorigin');
      const url=this.quality==='360'&&source.lowUrl?source.lowUrl:source.url;
      if(source.type==='hls'&&!v.canPlayType('application/vnd.apple.mpegurl')){
        this.engine='hls';
        if(!root.Hls||!root.Hls.isSupported()){this.failure('unsupported');this.switchSource(false);return;}
        const hls=this.hls=new root.Hls({startLevel:0,maxBufferLength:20,maxMaxBufferLength:40,
          manifestLoadingTimeOut:8000,levelLoadingTimeOut:8000,fragLoadingTimeOut:10000});
        hls.on(root.Hls.Events.ERROR,(_,data)=>{if(active()){
          const reason=String(data.details||'hls_error');
          // Never send loader URLs, response bodies, exception messages or signed tokens.
          if((this.hlsReports[reason]||0)<3||data.fatal){this.hlsReports[reason]=(this.hlsReports[reason]||0)+1;this.diagnostic('hls_error',{reason:/^[a-zA-Z_]{1,60}$/.test(reason)?reason:'hls_error',http:Math.max(0,Math.min(599,Number(data.response&&data.response.code)||0)),fatal:!!data.fatal});}
          if(data.fatal){this.diagWaiting=true;this.switchSource(false);}
        }});
        hls.on(root.Hls.Events.MANIFEST_PARSED,()=>{if(active()&&this.wantsPlay)this.play();});
        hls.loadSource(url);hls.attachMedia(v);
      }else{this.engine='native';v.src=url;v.load();}
      this.status(this.wantsPlay?'film.switching':'');
      if(this.wantsPlay)this.play();else this.showStart();
      this.arm();
    }
    async toggleFullscreen(){
      if(this.expanded){this.closeExpanded();return;}
      if(document.fullscreenElement===this.wrapper){await document.exitFullscreen();return;}
      try{
        if(this.video.webkitEnterFullscreen){this.video.webkitEnterFullscreen();return;}
        if(this.wrapper.requestFullscreen){await this.wrapper.requestFullscreen();return;}
      }catch(e){} // Embedded browsers may deny native fullscreen; expand inside the app.
      const resume=!this.video.paused;
      this.anchor=document.createComment('film-position');this.wrapper.before(this.anchor);
      this.expanded=document.createElement('dialog');this.expanded.className='native-film-expanded';
      this.expanded.addEventListener('cancel',e=>{e.preventDefault();this.closeExpanded();});
      document.body.append(this.expanded);this.expanded.append(this.wrapper,this.fullscreen);this.expanded.showModal();
      if(resume)this.play();
      this.fullscreen.setAttribute('aria-label',this.options.text('film.collapse'));this.fullscreen.title=this.options.text('film.collapse');
    }
    closeExpanded(){
      if(!this.expanded)return;
      const resume=!this.video.paused;
      this.anchor.replaceWith(this.wrapper);this.expanded.close();this.expanded.remove();this.expanded=null;
      if(resume)this.play();
      this.help.append(this.fullscreen);this.fullscreen.setAttribute('aria-label',this.options.text('film.fullscreen'));this.fullscreen.title=this.options.text('film.fullscreen');
    }
    setQuality(quality){this.wantsPlay=this.wantsPlay||this.exhausted;this.quality=quality;this.panel.hidden=true;this.switchSource(true,true);}
    showStart(){if(!this.exhausted&&!this.destroyed){this.start.hidden=false;this.start.disabled=false;this.start.textContent=this.options.text(this.started?'film.resume':'film.start');}}
    play(){
      if(!this.diagStarted){this.diagStarted=true;this.diagnostic('play');}
      if(this.refreshing){this.wantsPlay=true;return;}
      if(this.options.refreshSources&&Date.now()>=this.sourcesExpireAt&&Date.now()-this.lastRefresh>60000){this.wantsPlay=true;this.refreshSources();return;}
      if(this.exhausted){this.wantsPlay=true;this.switchSource(true);return;}
      this.wantsPlay=true;this.start.disabled=true;const generation=this.generation;
      const p=this.video.play();
      if(p&&p.catch)p.catch(e=>{
        if(this.destroyed||generation!==this.generation)return;
        this.diagnostic('play_rejected',{reason:e.name==='NotAllowedError'?'autoplay_denied':e.name==='AbortError'?'play_interrupted':'play_failed'});
        if(e.name==='NotAllowedError'){this.wantsPlay=false;this.clearTimers();this.status('film.tap_play');this.showStart();}
      });this.arm();
    }
    action(action,value){
      if(this.destroyed)return;
      if(action==='play')this.play();
      if(action==='pause'||action==='stop'){this.wantsPlay=false;this.clearTimers();this.video.pause();this.emit('pause');}
      if(action==='seek'&&Number.isFinite(this.video.duration))this.video.currentTime=this.video.duration*value/100;
    }
    destroy(){if(this.destroyed)return;this.diagnostic('closed');this.closeExpanded();this.destroyed=true;document.removeEventListener('visibilitychange',this.visibilityHandler);++this.generation;this.clearTimers();if(this.hls)this.hls.destroy();this.video.pause();this.video.removeAttribute('src');this.video.load();this.wrapper.remove();this.help.remove();}
  }
  root.ClubFilmPlayer=ClubFilmPlayer;
  if(typeof module!=='undefined')module.exports=ClubFilmPlayer;
})(typeof window!=='undefined'?window:globalThis);
