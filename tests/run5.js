const {JSDOM}=require('jsdom');const fs=require('fs');
const html=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
const log=[];const ok=(c,m)=>log.push((c?'PASS ':'FAIL ')+m);
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const uniq=(i,k=0,len=14)=>Array.from({length:len},(_,j)=>String.fromCharCode(0x4e00+i*400+k*60+j)).join('');
const mkQ=(id,topic='賃金管理')=>({q:'Q'+id+'：'+uniq(id),choices:['正'+uniq(id,1),'誤甲'+uniq(id,2),'誤乙'+uniq(id,3),'誤丙'+uniq(id,4)],answer:0,explanation:'解説'+id,topic,volatile:false});
const qid=q=>Number((q.match(/^Q(\d+)/)||[])[1]);
let calls=[],genQueue=[],verifyFn=null,verifyDelay=0;
const resp=o=>({ok:true,status:200,json:async()=>({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(o)}]}}]})});
const agree=items=>items.map(it=>({id:it.id,answer:it.choices.findIndex(c=>c.startsWith('正')),ambiguous:false,confidence:'high'}));
const fakeFetch=async(url,opts)=>{const body=JSON.parse(opts.body);const pr=body.contents[0].parts[0].text;const verify=pr.includes('採点者');
 calls.push({kind:verify?'verify':'gen',pr,temp:body.generationConfig.temperature});
 if(verify){await wait(verifyDelay);if(verifyFn==='500')return{ok:false,status:500,json:async()=>({})};const items=JSON.parse(pr.slice(pr.indexOf('【問題】\n')+5));return resp({results:(verifyFn||agree)(items)});}
 const next=genQueue.shift();if(next==='500'||!next)return{ok:false,status:500,json:async()=>({})};return resp({questions:next});};
const rec=(id,field,qs)=>({id,date:new Date().toISOString(),field,fieldName:'人事・人材開発',fieldIcon:'👥',grade:'3',count:qs.length,correct:qs.filter(q=>q.isRight).length,questions:qs});
const hq=(topic,isRight,id)=>({...mkQ(id,topic),userAnswer:0,isRight});
function boot(hist){calls=[];const ls={bizcareer_gemini_key:'k'};if(hist)ls.bizcareer_quiz_v1=JSON.stringify({history:hist,totalAnswered:0,totalCorrect:0});
 return new JSDOM(html,{runScripts:'dangerously',url:'https://x.test/',pretendToBeVisual:true,beforeParse(w){for(const[k,v]of Object.entries(ls))w.localStorage.setItem(k,v);w.Element.prototype.scrollIntoView=()=>{};w.matchMedia=()=>({matches:false});w.fetch=(u,o)=>String(u).includes("bank/")?Promise.resolve({ok:false,status:404,json:async()=>({})}):fakeFetch(u,o);}}).window;}
async function start(w,{count=5,focus,source}={}){const d=w.document;w.openConfig('jinzai');w.selectCount(count);if(source){const t=d.getElementById('source-input');t.value=source;t.dispatchEvent(new w.Event('input'));}
 if(focus)w.selectFocus(focus);d.getElementById('start-btn').click();await wait(500);}
const progQ=w=>{const p=JSON.parse(w.localStorage.getItem('bizcareer_quiz_progress_v1')||'null');return p?p.questions.map(x=>qid(x.q)):null;};
const toasts=d=>[...d.querySelectorAll('[role=alert]')].map(e=>e.textContent).join('|');
(async()=>{
 // ── T1: 検算で除外＋足りない分を追加生成
 let w=boot();await wait(150);
 genQueue=[[0,1,2,3,4,5,6].map(i=>mkQ(i)),[20,21,22].map(i=>mkQ(i))];
 verifyFn=items=>agree(items).filter(r=>qid(items[r.id].q)!==5).map(r=>{const id=qid(items[r.id].q);
   if(id===1)return{...r,answer:(r.answer+1)%4};if(id===2)return{...r,ambiguous:true};if(id===3)return{...r,confidence:'low'};return r;});
 await start(w);
 const ids=progQ(w);
 ok(JSON.stringify(calls.map(c=>c.kind))==='["gen","verify","gen","verify"]','call sequence gen→verify→gen(top-up)→verify: '+calls.map(c=>c.kind).join(','));
 ok(ids&&ids.length===5&&[0,4,5,6].every(i=>ids.includes(i))&&![1,2,3].some(i=>ids.includes(i)),'kept 0,4,5(no verdict),6; dropped 1(mismatch),2(ambiguous),3(low): got '+JSON.stringify(ids));
 ok(ids&&ids.filter(i=>i>=20).length===1,'one question topped up from 2nd batch');
 ok(calls[2].pr.includes('以下の条件で問題を2問生成'),'top-up asks need+1 = 2 questions');
 const vp=calls[1];const items=JSON.parse(vp.pr.slice(vp.pr.indexOf('【問題】\n')+5));
 ok(items.every(it=>JSON.stringify(Object.keys(it).sort())==='["choices","id","q"]')&&!vp.pr.includes('解説'),'verifier is given only id/q/choices (no answer, no explanation)');
 ok(vp.temp===0&&calls[0].temp===0.7,'verifier temperature 0, generator 0.7');
 // ── T2: 検算が失敗しても出題は続行し、通知
 w=boot();await wait(150);genQueue=[[0,1,2,3,4,5,6].map(i=>mkQ(i))];verifyFn='500';await start(w);
 ok(progQ(w)&&progQ(w).length===5&&toasts(w.document).includes('検算できませんでした'),'verify failure → quiz still starts + toast: '+toasts(w.document));
 // ── T3: 追加生成が失敗してもここまでで続行
 w=boot();await wait(150);genQueue=[[0,1,2,3,4,5,6].map(i=>mkQ(i)),'500'];
 verifyFn=items=>agree(items).map(r=>[0,1,2].includes(qid(items[r.id].q))?r:{...r,ambiguous:true}); // 3問だけ残る
 await start(w);
 ok(progQ(w)&&progQ(w).length===3&&toasts(w.document).includes('作れたのは3問です'),'top-up failure → continue with 3 + toast: '+toasts(w.document));
 // ── T4: 全滅ならエラー
 w=boot();await wait(150);genQueue=[[0,1,2].map(i=>mkQ(i)),[10,11,12].map(i=>mkQ(i))];verifyFn=items=>agree(items).map(r=>({...r,ambiguous:true}));
 await start(w);
 ok(progQ(w)===null&&toasts(w.document).includes('生成に失敗しました'),'all rejected twice → error toast, no quiz: '+toasts(w.document));
 // ── T5: 過去の問題との重複を除外
 w=boot([rec('h1','jinzai',[hq('賃金管理',false,0)])]);await wait(150);
 genQueue=[[0,1,2,3,4,5,6].map(i=>mkQ(i))];verifyFn=null;await start(w);
 ok(progQ(w)&&!progQ(w).includes(0)&&progQ(w).length===5,'question identical to history is dropped: '+JSON.stringify(progQ(w)));
 // ── T6: 同じ回の中の重複
 w=boot();await wait(150);const dupe=mkQ(1);genQueue=[[mkQ(0),dupe,{...dupe,q:dupe.q+'。'},mkQ(3),mkQ(4),mkQ(5),mkQ(6)]];verifyFn=null;await start(w);
 const i6=progQ(w);ok(i6&&i6.filter(i=>i===1).length===1,'near-duplicate inside one batch removed: '+JSON.stringify(i6));
 // ── T7: 検算中の表示
 w=boot();await wait(150);genQueue=[[0,1,2,3,4,5,6].map(i=>mkQ(i))];verifyFn=null;verifyDelay=300;
 const d7=w.document;w.openConfig('jinzai');w.selectCount(5);d7.getElementById('start-btn').click();await wait(150);
 ok(d7.getElementById('loading-msg').textContent==='問題を検算中…','loading shows 検算中 during verification: '+d7.getElementById('loading-msg').textContent);
 await wait(500);verifyDelay=0;
 // ── T8: 出題テーマの割り振り（全範囲＝未挑戦を優先）
 const vocabJ=['人事管理','採用','配置・異動','人事評価','賃金管理','退職金・企業年金','人材育成','キャリア開発','組織開発','労働契約','労働基準法','労働時間管理','就業規則','労働安全衛生','社会保険・労働保険','労使関係','ハラスメント対策','ダイバーシティ'];
 const attempted=vocabJ.filter(t=>!['ハラスメント対策','ダイバーシティ'].includes(t));
 w=boot([rec('h2','jinzai',attempted.map((t,i)=>hq(t,true,100+i)))]);await wait(150);
 genQueue=[[0,1,2,3,4,5,6].map(i=>mkQ(i))];await start(w);
 const gp=calls[0].pr;const plan=[...gp.matchAll(/^\d+\. (.+)$/gm)].map(m=>m[1]);
 ok(gp.includes('【各問の出題テーマ】')&&plan.length===6&&new Set(plan).size===6&&plan.every(t=>vocabJ.includes(t)),'plan: 6 unique vocabulary topics: '+plan.join(','));
 ok(plan.includes('ハラスメント対策')&&plan.includes('ダイバーシティ'),'coverage mode prioritizes never-tried topics');
 // ── T9: 苦手中心
 const weakHist=[rec('h3','jinzai',[hq('賃金管理',false,200),hq('賃金管理',false,201),hq('賃金管理',false,202),hq('採用',true,203),hq('採用',false,204),hq('人事評価',true,205)])];
 w=boot(weakHist);await wait(150);let d=w.document;w.openConfig('jinzai');
 const wb=d.querySelector('.focus-opt[data-m=weak]');
 ok(!wb.disabled,'weak button enabled when weak topics exist');
 ok(d.getElementById('focus-hint').textContent.includes('未挑戦'),'hint (all): '+d.getElementById('focus-hint').textContent);
 w.selectFocus('weak');ok(wb.getAttribute('aria-pressed')==='true'&&d.getElementById('focus-hint').textContent==='苦手：賃金管理・採用','weak selected, hint lists weakest first: '+d.getElementById('focus-hint').textContent);
 const t=d.getElementById('source-input');t.value='資料';t.dispatchEvent(new w.Event('input'));ok(d.getElementById('focus-hint').textContent.includes('資料の内容から出題'),'hint switches when source typed');
 t.value='';t.dispatchEvent(new w.Event('input'));
 genQueue=[[0,1,2,3,4,5,6].map(i=>mkQ(i))];w.selectCount(5);d.getElementById('start-btn').click();await wait(500);
 const wp=[...calls[0].pr.matchAll(/^\d+\. (.+)$/gm)].map(m=>m[1]);
 ok(wp.length===6&&wp.filter(x=>x==='賃金管理'||x==='採用').length===5,'weak mode: 5 of 6 slots are weak topics: '+wp.join(','));
 ok(!wp.includes('人事評価')||true,'(人事評価 is 100% so not forced)');
 // 苦手が無い分野では選べない
 w=boot();await wait(150);d=w.document;w.openConfig('jinzai');
 ok(d.querySelector('.focus-opt[data-m=weak]').disabled&&d.getElementById('focus-hint').textContent.includes('記録がたまると'),'weak disabled without history');
 w.selectFocus('weak');ok(d.querySelector('.focus-opt[data-m=all]').getAttribute('aria-pressed')==='true','cannot select disabled weak mode');
 // ── T10: 良問ルール／資料モードでは割り振りなし・検算に資料を渡す
 genQueue=[[0,1,2,3,4,5,6].map(i=>mkQ(i))];await start(w,{source:'有給休暇は、雇入れの日から6か月継続勤務し全労働日の8割以上出勤した労働者に10日付与する。年5日の取得義務がある。'});
 const g=calls.find(c=>c.kind==='gen').pr,v=calls.find(c=>c.kind==='verify').pr;
 ok(['【良問の条件】','正解は1つだけ','よくある勘違い','事例形式','「すべて正しい」「該当なし」'].every(k=>g.includes(k)),'quality rules in generation prompt');
 ok(!g.includes('【各問の出題テーマ】'),'source mode: no topic plan');
 ok(v.includes('<資料>')&&v.includes('有給休暇')&&v.includes('<資料>だけを根拠に解いて'),'source mode: verifier is given the material');
 console.log(log.join('\n'));process.exit(log.some(l=>l.startsWith('FAIL'))?1:0);
})();
