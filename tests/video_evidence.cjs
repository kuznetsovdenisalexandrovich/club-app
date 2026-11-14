
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
function setup(fetch){const ctx={URL,AbortController,TextDecoder,Uint8Array,Date,Promise,setTimeout,clearTimeout,navigator:{onLine:true},fetch};ctx.window=ctx;vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../player-diagnostics.js'),'utf8'),ctx);return ctx;}
function response(body,status=200){let done=false;const bytes=new TextEncoder().encode(body);return {status,ok:status>=200&&status<300,body:{cancel:async()=>{},getReader:()=>({read:async()=>{if(done)return {done:true};done=true;return {done:false,value:bytes};},cancel:async()=>{done=true;}})}};}
const prefix='https://selectel-api.youselllikeagod-magazine.ru/media/hls/'+'a'.repeat(32)+'/'+'b'.repeat(16)+'/0/360/';
const source={url:prefix.replace('360/','master.m3u8')+'?direct=1',lowUrl:prefix+'index.m3u8?signature=secret&expires=9999999999&direct=1'};
test('video snapshot observes buffer and seeking without requests or signed URL leakage',()=>{
 const ctx=setup(()=>{throw Error('No healthy probes');});const e=ctx.clubVideoEvidence({paused:false,seeking:true,currentTime:45,videoHeight:720,buffered:{length:1,start:()=>40,end:()=>50},getVideoPlaybackQuality:()=>({totalVideoFrames:100,droppedVideoFrames:2})},source,Date.now()-3000);
 assert.equal(e.buffer_ms,5000);assert(e.seeking);assert.equal(e.delivery,'direct');assert.equal(e.frames,100);assert(!JSON.stringify(e).includes('signature'));assert(e.since_progress_ms>=3000);
});
test('probe compares same 360p position by direct and proxy paths and cancels bounded reads',async()=>{
 const calls=[],events=[];const ctx=setup(async(url,opts)=>{calls.push({url,opts});if(url.includes('index.m3u8')){const pre=url.includes('direct=1')?'https://bucket.s3.ru-7.storage.selcloud.ru/':'';return response('#EXTM3U\n#EXTINF:4,\n'+pre+'segment-00000.ts?signature=secret\n#EXTINF:4,\n'+pre+'segment-00001.ts?signature=secret');}return response('x'.repeat(65536));});
 ctx.fetch=()=>{throw Error('Probe must bypass application failover wrappers');};
 await ctx.clubProbeVideo(source,5,e=>events.push(e));assert.equal(calls.length,4);assert(calls[1].url.includes('segment-00001'));assert(calls[3].url.includes('segment-00001'));assert.deepEqual(events.map(e=>e.delivery),['direct','proxy']);assert(events.every(e=>e.probe_result==='ok'&&e.probe_phase==='segment'));assert(events.every(e=>/^[a-zA-Z_]*$/.test(e.reason)),'Probe reason must pass API schema');assert.equal(events[0].media_server,'selectel_storage');assert.equal(events[1].media_server,'selectel');assert(!JSON.stringify(events).includes('secret'));assert(calls.every(c=>c.opts.credentials==='omit'&&c.opts.signal));
});
test('direct HTTP failure and successful proxy remain separate evidence',async()=>{
 const events=[];const ctx=setup(async(url)=>url.includes('index.m3u8')?response('#EXTM3U\n#EXTINF:4,\n'+(url.includes('direct=1')?'https://bucket.t3.storageapi.dev/segment-00000.ts':'segment-00000.ts')):url.includes('storageapi.dev')?response('',403):response('fragment'));
 await ctx.clubProbeVideo(source,0,e=>events.push(e));assert.equal(events[0].http,403);assert.equal(events[0].probe_result,'http');assert.equal(events[0].media_server,'railway_storage');assert.equal(events[1].probe_result,'ok');
});
test('network errors stay unknown and probes reject foreign URLs and oversized playlists',async()=>{
 let calls=0;const events=[];const ctx=setup(async()=>{calls++;throw TypeError('private URL');});await ctx.clubProbeVideo(source,0,e=>events.push(e));assert.equal(calls,2);assert(events.every(e=>e.http===0&&e.probe_result==='network'));assert(!JSON.stringify(events).includes('private'));await ctx.clubProbeVideo({lowUrl:'https://untrusted.test/'},0,()=>assert.fail());assert.equal(calls,2);
 const blocked=setup(async()=>response('#EXTM3U\n#EXTINF:4,\nhttps://untrusted.test/private'));const denied=[];await blocked.clubProbeVideo(source,0,e=>denied.push(e));assert(denied.every(e=>e.probe_result==='unsupported'));
 const large=setup(async()=>response('x'.repeat(524289)));const over=[];await large.clubProbeVideo(source,0,e=>over.push(e));assert(over.every(e=>e.probe_result==='oversize'));
});

test('probe deadline includes stalled response body and does not loop',async()=>{
 const events=[];let calls=0;const ctx=setup(async(url,opts)=>{calls++;return {ok:true,status:200,body:{getReader:()=>({read:()=>new Promise((resolve,reject)=>opts.signal.addEventListener('abort',()=>reject(Error('aborted')))),cancel:async()=>{}})}};});
 ctx.setTimeout=(fn,ms)=>setTimeout(fn,ms===5000?2:ms);
 await ctx.clubProbeVideo(source,0,e=>events.push(e));assert.equal(calls,2);assert(events.every(e=>e.probe_result==='timeout'&&e.probe_phase==='playlist'));assert(events.every(e=>e.http===200));
});
