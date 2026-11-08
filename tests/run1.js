const {JSDOM}=require('jsdom');const fs=require('fs');
const html=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
const mk=(id,field,fn,fi,rights)=>({id,date:new Date().toISOString(),field,fieldName:fn,fieldIcon:fi,grade:'3',count:rights.length,correct:rights.filter(Boolean).length,
 questions:rights.map((r,i)=>({q:'問'+i+'<b>x</b>',choices:['a','b','c','d'],answer:1,explanation:'解説'+i,topic:i%2?'労働基準法':'貸借対照表',userAnswer:r?1:0,isRight:r}))});
const state={history:[mk('h1','jinzai','人事・人材開発','👥',[true,false,false,true]),mk('h2','keiri','経理・財務管理','💰',[false,false,true,true])],totalAnswered:8,totalCorrect:4};
const dom=new JSDOM(html,{runScripts:'dangerously',url:'https://x.test/',pretendToBeVisual:true,
 beforeParse(w){w.localStorage.setItem('bizcareer_quiz_v1',JSON.stringify(state));w.scrollTo=()=>{};w.Element.prototype.scrollIntoView=()=>{};}});
const w=dom.window,d=w.document;
const $=s=>d.querySelector(s);const log=[];const ok=(c,m)=>{log.push((c?'PASS ':'FAIL ')+m);};
setTimeout(()=>{
 w.showPage('stats');
 ok($('#topic-stats').textContent.includes('労働基準法')||$('#topic-stats').textContent.includes('貸借対照表'),'topic stats rendered: '+$('#topic-stats').textContent.replace(/\s+/g,' ').slice(0,80));
 const items=d.querySelectorAll('#history-list [data-id]');ok(items.length===2,'history items clickable x'+items.length);
 items[0].click();
 ok($('#page-detail').classList.contains('active'),'detail page active');
 ok(!$('#detail-body').innerHTML.includes('<b>x</b>问')&&$('#detail-body').textContent.includes('<b>x</b>'),'XSS escaped in detail');
 const rb=$('#detail-review-wrap button');ok(!!rb,'review button in detail: '+(rb&&rb.textContent));
 ok($('.nav-btn[data-page=stats]').classList.contains('active'),'stats tab stays active on detail');
 rb.click();
 ok($('#page-quiz').classList.contains('active'),'quiz active after review start');
 ok($('#quiz-counter').textContent.trim()==='1 / 2','review has 2 wrong qs: '+$('#quiz-counter').textContent);
 ok($('#quiz-meta').textContent.includes('復習'),'review tag shown');
 // answer all correctly by clicking the correct choice (find via text of explanation not avail) -> click each choice 'b' text
 for(let n=0;n<2;n++){
   const btns=[...d.querySelectorAll('.choice-btn')];
   const b=btns.find(x=>x.textContent.endsWith('. b'));b.click();
   const nav=$('#quiz-nav button');nav.click();
 }
 ok($('#page-result').classList.contains('active'),'result shown');
 const st=JSON.parse(w.localStorage.getItem('bizcareer_quiz_v1'));
 ok(st.history[0].review===true&&st.history[0].correct===2,'review record saved: review='+st.history[0].review+' correct='+st.history[0].correct);
 ok($('#review-btn-wrap').children.length===0,'no review btn when all correct');
 w.showPage('stats');
 ok($('#history-list').textContent.includes('復習'),'review tag in history');
 console.log(log.join('\n'));process.exit(log.some(l=>l.startsWith('FAIL'))?1:0);
},300);
