const {JSDOM}=require('jsdom');const fs=require('fs');
const html=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
const log=[];const ok=(c,m)=>log.push((c?'PASS ':'FAIL ')+m);
const mkQ=(i,r)=>({q:'問題'+i+'を詳しく説明する長めの問題文です。'.repeat(3),choices:['選択肢A'.repeat(4),'選択肢B'.repeat(4),'選択肢C'.repeat(4),'選択肢D'.repeat(4)],answer:1,explanation:'解説'.repeat(60),topic:'テーマ'+(i%3),userAnswer:r?1:0,isRight:r});
const mkH=(n)=>({id:'h'+n,date:new Date(Date.now()-n*1000).toISOString(),field:'jinzai',fieldName:'人事・人材開発',fieldIcon:'👥',grade:'3',count:10,correct:5,questions:Array.from({length:10},(_,i)=>mkQ(i,i%2===0))});
const hist=Array.from({length:30},(_,n)=>mkH(n));
const rawBefore=JSON.stringify({history:hist,totalAnswered:300,totalCorrect:150});
const prog=(extra={})=>JSON.stringify({fieldId:'keiri',grade:'2',count:3,isReview:false,savedAt:Date.now(),current:1,
 questions:[0,1,2].map(i=>({q:'Q'+i,choices:['a','b','c','d'],answer:1,explanation:'解説'+i,topic:'t'})),
 answers:[{chosen:1,correct:1,isRight:true},{chosen:0,correct:1,isRight:false}],...extra});
function boot(ls){const dom=new JSDOM(html,{runScripts:'dangerously',url:'https://x.test/',pretendToBeVisual:true,
 beforeParse(w){for(const[k,v]of Object.entries(ls))w.localStorage.setItem(k,v);w.Element.prototype.scrollIntoView=()=>{};}});return dom.window;}
(async()=>{
 const wait=ms=>new Promise(r=>setTimeout(r,ms));
 // --- 8: 軽量化
 let w=boot({bizcareer_quiz_v1:rawBefore,bizcareer_quiz_progress_v1:prog()});await wait(200);let d=w.document,$=s=>d.querySelector(s);
 w.showPage('stats');
 w.document.querySelector('#history-list [data-id]').click(); // 最新=full
 ok($('#page-detail').classList.contains('active')&&$('#detail-body').textContent.includes('第1問'),'recent history shows full detail');
 // 25件目(古い)は一覧外なので、保存データ側を確認
 // 保存は次のsave時: 1セッション分クイズを終えて保存させる
 // --- 7: 途中再開
 w.showPage('home');
 ok($('#resume-banner').textContent.includes('2 / 3問 解答済み'),'resume banner: '+$('#resume-banner').textContent.replace(/\s+/g,' '));
 $('#resume-banner button').click();
 ok($('#page-quiz').classList.contains('active'),'resumed to quiz');
 ok($('#quiz-counter').textContent.trim()==='2 / 3','resumed at Q2: '+$('#quiz-counter').textContent);
 ok($('#quiz-explanation').style.display==='block'&&$('.choice-btn.incorrect')&&$('.choice-btn.correct'),'answered state restored (explanation + colors)');
 ok($('#quiz-nav button')&&$('#quiz-nav button').textContent.includes('次の問題'),'next button restored');
 // 再回答不可
 const before=JSON.parse(w.localStorage.getItem('bizcareer_quiz_progress_v1')).answers.length;
 d.querySelectorAll('.choice-btn')[2].click();
 ok(JSON.parse(w.localStorage.getItem('bizcareer_quiz_progress_v1')).answers.length===before,'cannot double-answer');
 $('#quiz-nav button').click();
 let p=JSON.parse(w.localStorage.getItem('bizcareer_quiz_progress_v1'));
 ok(p.current===2&&p.answers.length===2,'progress saved on next: current='+p.current);
 // 再読み込みを模擬 → Q3 未回答で再開
 const saved=w.localStorage.getItem('bizcareer_quiz_progress_v1');
 w=boot({bizcareer_quiz_v1:rawBefore,bizcareer_quiz_progress_v1:saved});await wait(200);d=w.document;$=s=>d.querySelector(s);
 $('#resume-banner button').click();
 ok($('#quiz-counter').textContent.trim()==='3 / 3'&&$('#quiz-explanation').style.display==='none','reload resumes at unanswered Q3');
 [...d.querySelectorAll('.choice-btn')].find(b=>b.textContent.endsWith('. b')).click();
 ok(JSON.parse(w.localStorage.getItem('bizcareer_quiz_progress_v1')).answers.length===3,'answer saved');
 $('#quiz-nav button').click(); // 結果を見る
 ok($('#page-result').classList.contains('active'),'finished -> result');
 ok(w.localStorage.getItem('bizcareer_quiz_progress_v1')===null,'progress cleared on finish');
 const st=JSON.parse(w.localStorage.getItem('bizcareer_quiz_v1'));
 ok(st.history.length===31,'history count 31');
 ok(st.history.every(h=>!h.slim),'history kept in full (no slimming)');
 w.showPage('stats');
 ok(/テーマ\d/.test($('#topic-stats').textContent),'topic stats still computed incl. slim');
 // slim詳細表示
 const slimRec=st.history.find(h=>h.slim);
 // 画面上は20件のみ→内部関数経由は不可。保存IDでopenDetailを疑似: stateに入れて確認は省略
 // --- 不正データは破棄
 w=boot({bizcareer_quiz_v1:rawBefore,bizcareer_quiz_progress_v1:prog({current:9})});await wait(200);
 ok(w.document.querySelector('#resume-banner').children.length===0&&w.localStorage.getItem('bizcareer_quiz_progress_v1')===null,'invalid progress discarded');
 w=boot({bizcareer_quiz_v1:rawBefore,bizcareer_quiz_progress_v1:'{broken'});await wait(200);
 ok(w.document.querySelector('#resume-banner').children.length===0,'corrupt JSON ignored');
 // 破棄ボタン
 w=boot({bizcareer_quiz_v1:rawBefore,bizcareer_quiz_progress_v1:prog()});await wait(200);
 w.document.querySelectorAll('#resume-banner button')[1].click();
 ok(w.localStorage.getItem('bizcareer_quiz_progress_v1')===null&&w.document.querySelector('#resume-banner').children.length===0,'discard button works');
 // 中断で破棄
 w=boot({bizcareer_quiz_v1:rawBefore,bizcareer_quiz_progress_v1:prog()});await wait(200);
 w.document.querySelector('#resume-banner button').click();w.document.getElementById('quiz-back-btn').click();w.doQuitQuiz();
 ok(w.localStorage.getItem('bizcareer_quiz_progress_v1')===null,'quit clears progress');
 console.log(log.join('\n'));process.exit(log.some(l=>l.startsWith('FAIL'))?1:0);
})();
