import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import { generateAuto } from '../tools/generate-bank.mjs';
const log=[];const ok=(c,m)=>log.push((c?'PASS ':'FAIL ')+m);
let n=0;const uniq=(i,k=0,len=14)=>Array.from({length:len},(_,j)=>String.fromCharCode(0x4e00+(i%40)*400+k*60+j+Math.floor(i/40)*7)).join('');
const mk=i=>({q:'Q'+i+'：'+uniq(i),choices:['正'+uniq(i,1),'誤甲'+uniq(i,2),'誤乙'+uniq(i,3),'誤丙'+uniq(i,4)],answer:0,explanation:'解説'+i,topic:'採用',volatile:false});
const resp=o=>({ok:true,status:200,json:async()=>({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(o)}]}}]})});
let quotaAfter=Infinity,calls=0;
const f=async(url,opts)=>{calls++;const pr=JSON.parse(opts.body).contents[0].parts[0].text;
 if(calls>quotaAfter)return{ok:false,status:429,json:async()=>({error:{details:[{quotaId:'RequestsPerDay'}]}})};
 if(pr.includes('採点者')){const items=JSON.parse(pr.slice(pr.indexOf('【問題】\n')+5));return resp({results:items.map(it=>({id:it.id,answer:it.choices.findIndex(c=>c.startsWith('正')),ambiguous:false,confidence:'high'}))});}
 return resp({questions:Array.from({length:14},()=>mk(n++))});};
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'bank-'));
// 既存: jinzai-3 が 12問ある状態
fs.writeFileSync(path.join(dir,'jinzai-3.json'),JSON.stringify({field:'jinzai',grade:'3',questions:Array.from({length:12},(_,i)=>({...mk(1000+i),createdAt:'2026-01-01'}))}));
quotaAfter=8; // 4バッチ(生成+検算)ぶんで枠切れ
let r=await generateAuto({target:10,outDir:dir,apiKey:'k',fetchImpl:f,log:()=>{}});
const counts=Object.fromEntries(r.status.map(s=>s.split(': ')));
ok(counts['jinzai-3']==='12','already-filled combo untouched');
const filled=Object.entries(counts).filter(([k,v])=>k!=='jinzai-3'&&Number(v)>=10).length;
ok(filled===4,'4 batches filled 4 other fields, one each (balanced): '+JSON.stringify(counts));
ok(/無料枠/.test(r.stopped),'stopped on quota: '+r.stopped);
// 続きから: 残りを埋める
quotaAfter=Infinity;calls=0;
r=await generateAuto({target:10,outDir:dir,apiKey:'k',fetchImpl:f,log:()=>{}});
ok(r.status.every(s=>Number(s.split(': ')[1])>=10)&&!r.stopped,'all combos reach target on next run: '+r.status.join(','));
console.log(log.join('\n'));process.exit(log.some(l=>l.startsWith('FAIL'))?1:0);
