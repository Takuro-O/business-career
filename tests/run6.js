const {JSDOM}=require('jsdom');const fs=require('fs');
const html=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
const log=[];const ok=(c,m)=>log.push((c?'PASS ':'FAIL ')+m);
const wait=ms=>new Promise(r=>setTimeout(r,ms));
let fetches=0, mode='ok';
const fakeFetch=async()=>{fetches++;
 if(mode==='daily')return{ok:false,status:429,json:async()=>({error:{status:'RESOURCE_EXHAUSTED',details:[{violations:[{quotaId:'GenerateRequestsPerDayPerProjectPerModel-FreeTier'}]}]}})};
 if(mode==='minute')return{ok:false,status:429,json:async()=>({error:{status:'RESOURCE_EXHAUSTED',details:[{violations:[{quotaId:'GenerateRequestsPerMinutePerProjectPerModel-FreeTier'}]}]}})};
 return{ok:false,status:500,json:async()=>({})};};
function boot(ls={}){fetches=0;ls={bizcareer_gemini_key:'k',...ls};
 return new JSDOM(html,{runScripts:'dangerously',url:'https://x.test/',pretendToBeVisual:true,beforeParse(w){for(const[k,v]of Object.entries(ls))w.localStorage.setItem(k,v);w.fetch=(u,o)=>String(u).includes("bank/")?Promise.resolve({ok:false,status:404,json:async()=>({})}):fakeFetch(u,o);w.matchMedia=()=>({matches:false,addEventListener(){},addListener(){}});}}).window;}
const toasts=d=>[...d.querySelectorAll('[role=alert]')].map(e=>e.textContent).join('|');
const day=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles'}).format(new Date());
async function start(w){w.openConfig('jinzai');w.document.getElementById('start-btn').click();await wait(400);}
(async()=>{
 // 上限間近: 19回使用済み・検算ON(2回必要) → 生成しない
 let w=boot({bizcareer_usage_v1:JSON.stringify({day:day(),n:19,full:false})});await wait(150);
 await start(w);
 ok(fetches===0,'no API call when remaining < needed');
 ok(/無料枠の目安に達しました.*日本時間/.test(toasts(w.document)),'limit toast: '+toasts(w.document));
 // 検算OFFなら1回分残っているので生成できる
 w=boot({bizcareer_usage_v1:JSON.stringify({day:day(),n:19,full:false}),bizcareer_verify:'0'});await wait(150);
 w.openConfig('jinzai');w.document.getElementById('verify-toggle').checked=false;w.document.getElementById('start-btn').click();await wait(400);
 ok(fetches>=1,'verify OFF: 1 call left → allowed ('+fetches+')');
 // 別の日の記録はリセットされる
 w=boot({bizcareer_usage_v1:JSON.stringify({day:'2000-01-01',n:99,full:true})});await wait(150);
 await start(w);
 ok(fetches>=1,'old-day usage ignored');
 // 呼び出しが数えられる
 const u=JSON.parse(w.localStorage.getItem('bizcareer_usage_v1'));
 ok(u.day===day()&&u.n===fetches,'calls counted: n='+u.n+' fetches='+fetches);
 // 1日上限の429 → 以後ブロック
 w=boot();await wait(150);mode='daily';await start(w);
 ok(/使い切りました/.test(toasts(w.document)),'daily 429 message: '+toasts(w.document));
 ok(JSON.parse(w.localStorage.getItem('bizcareer_usage_v1')).full===true,'marked full');
 const f0=fetches;await wait(100);await start(w);
 ok(fetches===f0,'blocked afterwards');
 // 1分あたりの429 → ブロックしない
 w=boot();await wait(150);mode='minute';await start(w);
 ok(JSON.parse(w.localStorage.getItem('bizcareer_usage_v1')).full!==true,'per-minute 429 not blocking');
 console.log(log.join('\n'));process.exit(log.some(l=>l.startsWith('FAIL'))?1:0);
})();
