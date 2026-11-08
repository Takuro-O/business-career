const {JSDOM}=require('jsdom');const fs=require('fs');
const html=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
const log=[];const ok=(c,m)=>log.push((c?'PASS ':'FAIL ')+m);
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const uniq=(i,k=0,len=14)=>Array.from({length:len},(_,j)=>String.fromCharCode(0x4e00+i*400+k*60+j)).join('');
const topics=['採用','賃金管理','人事評価','人材育成'];
const mk=i=>({q:'Q'+i+'：'+uniq(i),choices:['正'+uniq(i,1),'誤甲'+uniq(i,2),'誤乙'+uniq(i,3),'誤丙'+uniq(i,4)],answer:0,explanation:'解説'+i,topic:topics[i%4],volatile:i===0});
let bankQs=Array.from({length:40},(_,i)=>mk(i)),apiCalls=0,bankFetches=0;
const fakeFetch=async(url,opts)=>{
 if(String(url).includes('bank/jinzai-3.json')){bankFetches++;return{ok:true,status:200,json:async()=>({questions:bankQs})};}
 if(String(url).includes('bank/')) return{ok:false,status:404,json:async()=>({})};
 apiCalls++;return{ok:false,status:500,json:async()=>({})};};
function boot(ls={}){apiCalls=0;bankFetches=0;return new JSDOM(html,{runScripts:'dangerously',url:'https://x.test/',pretendToBeVisual:true,beforeParse(w){for(const[k,v]of Object.entries(ls))w.localStorage.setItem(k,v);w.fetch=fakeFetch;w.matchMedia=()=>({matches:false,addEventListener(){},addListener(){}});w.Element.prototype.scrollIntoView=()=>{};}}).window;}
const prog=w=>JSON.parse(w.localStorage.getItem('bizcareer_quiz_progress_v1')||'null');
const qid=q=>Number((q.match(/^Q(\d+)/)||[])[1]);
const toasts=d=>[...d.querySelectorAll('[role=alert]')].map(e=>e.textContent).join('|');
async function start(w,{grade='3',count=10,source,live}={}){const d=w.document;w.openConfig('jinzai');w.selectGrade(grade);w.selectCount(count);
 if(source)d.getElementById('source-input').value=source;if(live)d.getElementById('live-toggle').checked=true;d.getElementById('start-btn').click();await wait(500);}
(async()=>{
 // バンクから出題（APIキーなし）
 let w=boot();await wait(100);await start(w);
 let p=prog(w);
 ok(p&&p.questions.length===10,'quiz started from bank without API key');
 ok(apiCalls===0,'no generation API calls');
 ok(new Set(p.questions.map(x=>qid(x.q))).size===10,'10 distinct questions');
 ok(p.questions.every(x=>x.choices[x.answer].startsWith('正')),'answers consistent after re-shuffle');
 ok(new Set(p.questions.map(x=>x.topic)).size===4,'topics spread across plan');
 // 直近に解いた問題は避ける
 const done=[...Array(25).keys()].map(i=>({...mk(i),userAnswer:0,isRight:true}));
 const hist={history:[{id:'a',date:new Date().toISOString(),field:'jinzai',fieldName:'人事・人材開発',fieldIcon:'👥',grade:'3',count:25,correct:25,questions:done}],totalAnswered:25,totalCorrect:25};
 w=boot({bizcareer_quiz_v1:JSON.stringify(hist)});await wait(100);await start(w);
 p=prog(w);
 ok(p.questions.every(x=>qid(x.q)>=25),'avoids recently solved questions: '+p.questions.map(x=>qid(x.q)).join(','));
 // 足りなければ既出で補う
 const bigHist=JSON.parse(JSON.stringify(hist));bigHist.history[0].questions=[...Array(40).keys()].map(i=>({...mk(i),userAnswer:0,isRight:true}));
 w=boot({bizcareer_quiz_v1:JSON.stringify(bigHist)});await wait(100);await start(w);
 ok(prog(w)&&prog(w).questions.length===10,'falls back to seen questions when all seen');
 // 元資料あり → バンクを使わず生成（キーなし→エラー案内）
 w=boot();await wait(100);await start(w,{source:'あ'.repeat(200)});
 ok(bankFetches===0&&prog(w)===null&&/APIキー/.test(toasts(w.document)),'source forces live generation: '+toasts(w.document));
 ok(w.document.getElementById('advanced').open,'details opened to show key field');
 // AI生成トグル → バンクを使わない
 w=boot({bizcareer_gemini_key:'k'});await wait(100);await start(w,{live:true});
 ok(apiCalls>=1&&bankFetches===0,'live toggle bypasses bank (api calls '+apiCalls+')');
 ok(w.localStorage.getItem('bizcareer_live')==='1','live preference persisted');
 // バンクが無い等級 → 生成にフォールバック（キーなし→案内）
 w=boot();await wait(100);await start(w,{grade:'2'});
 ok(prog(w)===null&&/APIキー/.test(toasts(w.document)),'no bank for grade 2 → needs key');
 // 10問未満のバンクは使わない
 bankQs=bankQs.slice(0,5);w=boot();await wait(100);await start(w);
 ok(prog(w)===null,'tiny bank ignored');
 console.log(log.join('\n'));process.exit(log.some(l=>l.startsWith('FAIL'))?1:0);
})();
