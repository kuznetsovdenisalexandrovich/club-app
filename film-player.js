/* HLS playback, native on Safari and bundled hls.js on MSE browsers. */
(function(root){
  'use strict';
  class ClubFilmPlayer {
    constructor(slot,options){
      this.options=options; this.slot=slot;
      this.sources=options.sources.filter(s=>/^https:\/\//.test(s.url));
      if(!this.sources.length)throw Error('No film sources');
      this.index=-1;this.position=options.position||0;this.generation=0;
      this.wantsPlay=false;this.started=false;this.destroyed=false;this.exhausted=false;
      this.quality='auto';this.timer=null;this.helpTimer=null;
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
      this.wrapper.append(this.notice,this.start);slot.replaceChildren(this.wrapper,this.help);
      this.switchSource(false);
    }
    button(text,className,click){const b=document.createElement('button');b.type='button';b.className=className;b.textContent=text;b.onclick=click;return b;}
    emit(method){if(!this.destroyed)this.options.onEvent({method,time:this.position,duration:this.video?this.video.duration:0});}
    status(key){this.notice.textContent=key?this.options.text(key):'';}
    clearTimers(){clearTimeout(this.timer);clearTimeout(this.helpTimer);this.timer=null;this.helpTimer=null;}
    progress(){
      this.clearTimers();this.retry.hidden=true;this.panel.hidden=true;
      if(this.wantsPlay)this.arm();
    }
    arm(){
      if(!this.wantsPlay||this.destroyed||this.exhausted)return;
      // Preserve these deadlines through source changes: continuous waiting counts.
      if(!this.helpTimer&&this.retry.hidden){
        this.helpTimer=setTimeout(()=>{this.helpTimer=null;if(this.wantsPlay)this.retry.hidden=false;},this.options.helpMs||10000);
      }
      if(!this.timer)this.timer=setTimeout(()=>{this.timer=null;this.switchSource(false);},this.options.stallMs||14000);
    }
    switchSource(manual,same=false){
      if(this.destroyed)return;
      clearTimeout(this.timer);this.timer=null;
      if(this.video&&Number.isFinite(this.video.currentTime)&&this.video.currentTime>0)this.position=this.video.currentTime;
      this.emit('pause');
      if(!same&&this.index+1>=this.sources.length&&!manual){
        this.exhausted=true;this.wantsPlay=false;this.clearTimers();
        ++this.generation;if(this.video)this.video.pause();
        this.status('film.unavailable');this.retry.hidden=false;this.panel.hidden=false;this.start.hidden=true;return;
      }
      this.exhausted=false;
      if(!same)this.index=(this.index+1)%this.sources.length;
      const generation=++this.generation;
      if(this.hls){this.hls.destroy();this.hls=null;}
      if(this.video){this.video.pause();this.video.removeAttribute('src');this.video.load();this.video.remove();}
      const v=this.video=document.createElement('video');v.controls=this.started;v.playsInline=true;v.preload='metadata';
      v.poster=this.options.poster||'';v.setAttribute('playsinline','');v.setAttribute('aria-label',this.options.text('funnel.title'));
      this.wrapper.prepend(v);
      const active=()=>!this.destroyed&&generation===this.generation;
      const on=(name,fn)=>v.addEventListener(name,()=>{if(active())fn();});
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
        if(v.seeking)return;
        const advancing=v.currentTime>this.position+.02;this.position=v.currentTime;
        if(advancing&&!v.paused){this.progress();this.emit('time');}
      });
      on('waiting',()=>{if(this.wantsPlay){this.emit('pause');this.status('film.buffering');this.arm();}});
      on('seeking',()=>{this.position=v.currentTime;this.emit('pause');this.clearTimers();this.arm();});
      on('pause',()=>{this.wantsPlay=false;this.clearTimers();this.showStart();this.emit('pause');});
      on('ended',()=>{this.wantsPlay=false;this.clearTimers();this.position=v.currentTime;this.emit('stop');});
      on('error',()=>this.switchSource(false));
      const source=this.sources[this.index];const url=this.quality==='360'&&source.lowUrl?source.lowUrl:source.url;
      if(source.type==='hls'&&!v.canPlayType('application/vnd.apple.mpegurl')){
        if(!root.Hls||!root.Hls.isSupported()){this.switchSource(false);return;}
        const hls=this.hls=new root.Hls({startLevel:0,maxBufferLength:20,maxMaxBufferLength:40,
          manifestLoadingTimeOut:8000,levelLoadingTimeOut:8000,fragLoadingTimeOut:10000});
        hls.on(root.Hls.Events.ERROR,(_,data)=>{if(active()&&data.fatal)this.switchSource(false);});
        hls.on(root.Hls.Events.MANIFEST_PARSED,()=>{if(active()&&this.wantsPlay)this.play();});
        hls.loadSource(url);hls.attachMedia(v);
      }else{v.src=url;v.load();}
      this.status(this.wantsPlay?'film.switching':'');
      if(this.wantsPlay)this.play();else this.showStart();
      this.arm();
    }
    setQuality(quality){this.quality=quality;this.panel.hidden=true;this.switchSource(true,true);}
    showStart(){if(!this.exhausted&&!this.destroyed){this.start.hidden=false;this.start.disabled=false;this.start.textContent=this.options.text(this.started?'film.resume':'film.start');}}
    play(){
      this.wantsPlay=true;this.start.disabled=true;const generation=this.generation;
      const p=this.video.play();
      if(p&&p.catch)p.catch(e=>{
        if(this.destroyed||generation!==this.generation)return;
        if(e.name==='NotAllowedError'){this.wantsPlay=false;this.clearTimers();this.status('film.tap_play');this.showStart();}
      });this.arm();
    }
    action(action,value){
      if(this.destroyed)return;
      if(action==='play')this.play();
      if(action==='pause'||action==='stop'){this.wantsPlay=false;this.clearTimers();this.video.pause();this.emit('pause');}
      if(action==='seek'&&Number.isFinite(this.video.duration))this.video.currentTime=this.video.duration*value/100;
    }
    destroy(){if(this.destroyed)return;this.destroyed=true;++this.generation;this.clearTimers();if(this.hls)this.hls.destroy();this.video.pause();this.video.removeAttribute('src');this.video.load();this.wrapper.remove();this.help.remove();}
  }
  root.ClubFilmPlayer=ClubFilmPlayer;
  if(typeof module!=='undefined')module.exports=ClubFilmPlayer;
})(typeof window!=='undefined'?window:globalThis);
