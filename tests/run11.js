const {JSDOM}=require('jsdom');const fs=require('fs');
const html=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
const log=[];const ok=(c,m)=>log.push((c?'PASS ':'FAIL ')+m);
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const uniq=(i,k=0,len=14)=>Array.from({length:len},(_,j)=>String.fromCharCode(0x4e00+i*400+k*60+j)).join('');
const mk=(i,topic)=>({q:'Q'+i+'：'+uniq(i),choices:['正'+uniq(i,1),'誤甲'+uniq(i,2),'誤乙'+uniq(i,3),'誤丙'+uniq(i,4)],answer:0,explanation:'解説'+i,topic});
const banks={'jinzai-3':Array.from({length:20},(_,i)=>mk(i,'採用')),'keiri-3':Array.from({length:20},(_,i)=>mk(100+i,'原価計算')),'eigyo-3':Array.from({length:5},(_,i)=>mk(200+i,'顧客管理'))};
let apiCalls=0;
const fakeFetch=async(url)=>{const m=String(url).match(/bank\/([\w-]+)\.json/);
 if(m){return banks[m[1]]?{ok:true,status:200,json:async()=>({questions:banks[m[1]]})}:{ok:false,status:404,json:async()=>({})};}
 apiCalls++;return{ok:false,status:500,json:async()=>({})};};
function boot(ls={}){apiCalls=0;return new JSDOM(html,{runScripts:'dangerously',url:'https://x.test/',pretendToBeVisual:true,beforeParse(w){for(const[k,v]of Object.entries(ls))w.localStorage.setItem(k,v);w.fetch=fakeFetch;w.matchMedia=()=>({matches:false,addEventListener(){},addListener(){}});w.Element.prototype.scrollIntoView=()=>{};}}).window;}
const prog=w=>JSON.parse(w.localStorage.getItem('bizcareer_quiz_progress_v1')||'null');
const toasts=d=>[...d.querySelectorAll('[role=alert]')].map(e=>e.textContent).join('|');
(async()=>{
 let w=boot();await wait(100);const d=w.document;
 ok(d.querySelector('#category-list .category-card')&&/ランダム/.test(d.querySelector('#category-list .category-card').textContent),'random card is first on home');
 w.openConfig('random');
 ok(d.getElementById('advanced').style.display==='none','advanced settings hidden for random');
 w.selectGrade('3');w.selectCount(10);d.getElementById('start-btn').click();await wait(500);
 let p=prog(w);
 ok(p&&p.questions.length===10&&apiCalls===0,'random quiz from banks, no API');
 const byField={};p.questions.forEach(q=>byField[q.fieldId]=(byField[q.fieldId]||0)+1);
 ok(byField.jinzai===5&&byField.keiri===5&&!byField.eigyo,'balanced across fields with usable banks: '+JSON.stringify(byField));
 ok(p.questions.every(q=>q.fieldName&&q.choices[q.answer].startsWith('正')),'tagged with field names; answers valid');
 ok(/人事・人材開発 ／ 採用|経理・財務管理 ／ 原価計算/.test(d.getElementById('quiz-meta')?.textContent||d.body.textContent),'field name shown on question');
 // 全問回答して終了 → 記録と苦手テーマ集計
 for(let i=0;i<10;i++){const q=prog(w).questions[i];}
 w.openConfig&&0;
 // 等級2: バンクなし
 w=boot();await wait(100);w.openConfig('random');w.selectGrade('2');w.document.getElementById('start-btn').click();await wait(400);
 ok(prog(w)===null&&/バンクがまだ足りません/.test(toasts(w.document))&&apiCalls===0,'no banks for grade → friendly message, no API');
 // 履歴: ランダム記録の問題が元の分野の苦手集計に入る
 const rec={id:'r',date:new Date().toISOString(),field:'random',fieldName:'ランダム（全分野）',fieldIcon:'🎲',grade:'3',count:2,correct:1,questions:[
   {...mk(1,'採用'),fieldId:'jinzai',fieldName:'人事・人材開発',fieldIcon:'👥',userAnswer:1,isRight:false},
   {...mk(2,'原価計算'),fieldId:'keiri',fieldName:'経理・財務管理',fieldIcon:'💰',userAnswer:0,isRight:true}]};
 w=boot({bizcareer_quiz_v1:JSON.stringify({history:[rec],totalAnswered:2,totalCorrect:1})});await wait(100);
 w.openConfig('jinzai');
 ok(!w.document.querySelector('.focus-opt[data-m="weak"]').disabled,'wrong answer in random session counts as weak topic of its own field');
 w.document.getElementById('config-modal').style.display='none';
 console.log(log.join('\n'));process.exit(log.some(l=>l.startsWith('FAIL'))?1:0);
})();
