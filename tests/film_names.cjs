const fs=require('fs'),vm=require('vm'),assert=require('assert');
const source=fs.readFileSync('index.html','utf8');
function fn(name){const begin=source.indexOf('function '+name+'(');assert(begin>=0);const body=source.indexOf('{',begin);let depth=1,i=body+1;for(;depth;i++){if(source[i]==='{')depth++;if(source[i]==='}')depth--;}return source.slice(begin,i);}
let raw='film',name='Настя';const context={URLSearchParams,location:{search:''},appStartParamRaw:()=>raw,tgContactFields:()=>({tg_first_name:name}),filmResolvedEdition:'',window:{},sellerTouch:null};vm.createContext(context);
for(const name of ['filmEdition','filmNameKey','filmManifestQuery','filmPositionKey','appStartParam'])vm.runInContext(fn(name),context);
assert.equal(context.filmManifestQuery(),'?name='+encodeURIComponent('Настя'));
raw='namedfilm_v1001859673';assert.equal(context.appStartParam(),'film');assert.equal(context.filmManifestQuery(),'?video_key=v1001859673');
raw='sb-seller-s7-namedfilm_v1001859673';assert.equal(context.appStartParam(),'film');assert.equal(context.filmNameKey(),'v1001859673');
raw='film_instagram';assert.equal(context.appStartParam(),'film_instagram');
context.location.search='?film_edition='+('a'.repeat(32));assert.equal(context.filmManifestQuery(),'?edition='+('a'.repeat(32)));
context.filmResolvedEdition='b'.repeat(32);assert.equal(context.filmPositionKey(),'club_app_film_pos_'+'b'.repeat(32));
console.log('Name links, old routes, explicit editions and per-edition resume passed');
