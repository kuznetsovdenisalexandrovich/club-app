(function(root){
  const PAGE='https://kuznetsovdenisalexandrovich.github.io/club-app/account.html';
  function isPayment(url){try{const u=new URL(url);return u.protocol==='https:'&&!u.username&&!u.password&&(!u.port||u.port==='443')&&(u.hostname==='payform.ru'||u.hostname.endsWith('.payform.ru'));}catch(e){return false}}
  function route(url,enabled){return enabled&&isPayment(url)?PAGE+'#pay='+encodeURIComponent(url):url}
  const api={PAGE,isPayment,route};if(typeof module!=='undefined')module.exports=api;else root.ClubPaymentNavigation=api;
})(typeof window==='undefined'?globalThis:window);
