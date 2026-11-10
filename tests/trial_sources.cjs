const fs=require('fs'),vm=require('vm'),assert=require('assert');const html=fs.readFileSync(require('path').join(__dirname,'../index.html'),'utf8');const code=html.slice(html.indexOf('function promoFromUrl(){'),html.indexOf('async function promoOpen(){'));
for(const days of [7,30])for(const source of ['tg','ig','']){
 let saved='';const ctx={appStartParam:()=>`promo_trial${days}-1r`+(source?'__src_'+source:''),document:{getElementById:()=>({style:{display:'block'}})},rememberEntrySource:x=>saved=x,setTimeout:()=>{}};vm.createContext(ctx);vm.runInContext(code,ctx);assert(ctx.promoFromUrl());assert.equal(ctx.promoCode,`trial${days}-1r`);assert.equal(saved,source?`${source}_promo_trial${days}-1r`:`promo_trial${days}-1r`);
}
console.log('PASS: promo identity and TG/IG attribution remain separate; old links preserved');
