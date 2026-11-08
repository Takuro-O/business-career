const {JSDOM}=require('jsdom');const fs=require('fs');
const html=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
const log=[];const ok=(c,m)=>log.push((c?'PASS ':'FAIL ')+m);
const wait=ms=>new Promise(r=>setTimeout(r,ms));
let bodies=[],mode='ok';
const q=i=>({q:'Q'+i+'：'+String.fromCharCode(0x4e00+i*400)+'あ'.repeat(10),choices:['正'+i,'誤甲'+i,'誤乙'+i,'誤丙'+i],answer:0,explanation:'e'+i,topic:'賃金管理'});
const fakeFetch=async(url,opts)=>{const b=JSON.parse(opts.body);bodies.push(b);
 if(mode==='reject'&&b.generationConfig.thinkingConfig)return{ok:false,status:400,clone(){return this},json:async()=>({error:{message:'Thinking level is not supported for this model'}})};
 return{ok:true,status:200,json:async()=>({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({questions:[1,2,3,4,5,6].map(q)})}]}}]})};};
function boot(){bodies=[];return new JSDOM(html,{runScripts:'dangerously',url:'https://x.test/',pretendToBeVisual:true,beforeParse(w){w.localStorage.setItem('bizcareer_gemini_key','k');w.fetch=(u,o)=>String(u).includes("bank/")?Promise.resolve({ok:false,status:404,json:async()=>({})}):fakeFetch(u,o);w.matchMedia=()=>({matches:false,addEventListener(){},addListener(){}});}}).window;}
(async()=>{
 let w=boot();await wait(150);w.openConfig('jinzai');w.selectCount(5);w.document.getElementById('verify-toggle').checked=false;w.document.getElementById('start-btn').click();await wait(400);
 ok(bodies[0]&&bodies[0].generationConfig.thinkingConfig.thinkingLevel==='low','thinkingLevel low is sent');
 ok(/問題を6問生成/.test(bodies[0].contents[0].parts[0].text),'asks count+1');
 mode='reject';w=boot();await wait(150);w.openConfig('jinzai');w.selectCount(5);w.document.getElementById('verify-toggle').checked=false;w.document.getElementById('start-btn').click();await wait(400);
 ok(bodies.length===2&&!bodies[1].generationConfig.thinkingConfig,'400 about thinking -> retry without it');
 ok(w.document.getElementById('page-quiz').classList.contains('active'),'quiz still starts after fallback');
 console.log(log.join('\n'));process.exit(log.some(l=>l.startsWith('FAIL'))?1:0);
})();
