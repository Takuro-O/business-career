// 問題バンク生成: アプリ本体(index.html)の出題処理(生成→重複除去→検算)をそのまま使い、
// 結果を bank/<分野>-<等級>.json に追記する。
// 使い方: GEMINI_API_KEY=... node tools/generate-bank.mjs <分野ID> <等級> [目標問数=100]
import { JSDOM } from 'jsdom';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sleep = ms => new Promise(r => setTimeout(r, ms));

// 既存のバンクを「過去に解いた履歴」としてアプリに渡し、重複除去とテーマの偏り防止を効かせる
function seedHistory(field, grade, questions) {
  const history = [];
  for (let i = 0; i < questions.length && history.length < 20; i += 25) {
    const qs = questions.slice(i, i + 25).map(q => ({ ...q, userAnswer: q.answer, isRight: true }));
    history.push({
      id: 'bank' + i, date: new Date().toISOString(), field, fieldName: '', fieldIcon: '',
      grade, count: qs.length, correct: qs.length, questions: qs,
    });
  }
  return { history, totalAnswered: 0, totalCorrect: 0 };
}

async function runBatch({ html, apiKey, fetchImpl, field, grade, count, existing, timeoutMs }) {
  const dom = new JSDOM(html, {
    runScripts: 'dangerously', url: 'https://bank.local/', pretendToBeVisual: true,
    beforeParse(w) {
      w.localStorage.setItem('bizcareer_gemini_key', apiKey);
      w.localStorage.setItem('bizcareer_live', '1');
      w.localStorage.setItem('bizcareer_verify', '1');
      w.localStorage.setItem('bizcareer_quiz_v1', JSON.stringify(seedHistory(field, grade, existing)));
      w.fetch = fetchImpl;
      w.matchMedia = () => ({ matches: false, addEventListener() {}, addListener() {} });
      w.Element.prototype.scrollIntoView = () => {};
    },
  });
  const w = dom.window, d = w.document;
  try {
    await sleep(50);
    w.openConfig(field);
    w.selectGrade(grade);
    w.selectCount(count);
    d.getElementById('start-btn').click();
    const t0 = Date.now();
    while (Date.now() - t0 < timeoutMs) {
      await sleep(250);
      const prog = w.localStorage.getItem('bizcareer_quiz_progress_v1');
      if (prog) return { questions: JSON.parse(prog).questions };
      const toast = [...d.querySelectorAll('[role=alert]')].map(e => e.textContent).join('|');
      if (toast) return { error: toast, quota: /無料枠/.test(toast) };
    }
    return { error: 'timeout' };
  } finally { w.close(); }
}

export async function generate({ field, grade, target = 100, apiKey, fetchImpl = fetch, outDir = path.join(ROOT, 'bank'),
  htmlPath = path.join(ROOT, 'index.html'), batch = 10, timeoutMs = 600000, log = console.log }) {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const file = path.join(outDir, `${field}-${grade}.json`);
  fs.mkdirSync(outDir, { recursive: true });
  let bank = { field, grade, updatedAt: null, questions: [] };
  try { bank = JSON.parse(fs.readFileSync(file, 'utf8')); } catch {}
  let failures = 0, stopped = '';
  while (bank.questions.length < target && failures < 3) {
    const res = await runBatch({ html, apiKey, fetchImpl, field, grade, count: batch, existing: bank.questions, timeoutMs });
    if (res.quota) { stopped = '無料枠に達したため中断'; break; }
    if (res.error) { failures++; log(`失敗(${failures}/3): ${res.error}`); continue; }
    failures = 0;
    const now = new Date().toISOString().slice(0, 10);
    for (const q of res.questions) {
      bank.questions.push({ q: q.q, choices: q.choices, answer: q.answer, explanation: q.explanation, topic: q.topic, volatile: !!q.volatile, createdAt: now });
    }
    bank.updatedAt = now;
    fs.writeFileSync(file, JSON.stringify(bank, null, 1) + '\n');
    log(`${field}-${grade}: ${bank.questions.length}/${target}問`);
  }
  if (!stopped && failures >= 3) stopped = '失敗が続いたため中断';
  return { count: bank.questions.length, stopped };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [field, grade, target] = process.argv.slice(2);
  const apiKey = process.env.GEMINI_API_KEY;
  if (!field || !grade || !apiKey) { console.error('使い方: GEMINI_API_KEY=... node tools/generate-bank.mjs <分野ID> <等級> [問数]'); process.exit(2); }
  const r = await generate({ field, grade, target: Number(target) || 100, apiKey });
  console.log(`完了: ${r.count}問${r.stopped ? '（' + r.stopped + '）' : ''}`);
}
