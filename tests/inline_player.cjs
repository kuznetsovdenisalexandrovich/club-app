const {test}=require('node:test'),fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
for(const name of ['meeting-recordings.css','meeting-recordings.js','player-diagnostics.js','film-player.js'])test('embedded exact canonical '+name,()=>{
 const tag=name.endsWith('.css')?'style':'script';const start='<'+tag+' data-club-bundle="'+name+'">';const a=html.indexOf(start);assert(a>=0);const body=html.slice(a+start.length,html.indexOf('</'+tag+'>',a));assert.equal(body,fs.readFileSync(path.join(root,name),'utf8'));assert(!html.includes('src="'+name));assert(!html.includes('href="'+name));
});
test('dependency order and rescue marker remain before main',()=>{const names=['meeting-recordings.js','player-diagnostics.js','film-player.js'];const positions=names.map(n=>html.indexOf('data-club-bundle="'+n+'"'));assert(positions[0]<positions[1]&&positions[1]<positions[2]);assert(positions[2]<html.indexOf("ClubAppRescue.mark('player_script')"));assert(html.indexOf("ClubAppRescue.mark('player_script')")<html.indexOf("ClubAppRescue.mark('main')"));});
