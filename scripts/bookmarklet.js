/**
 * Oliveboard Mock Exporter - Browser Bookmarklet
 * 
 * How to use:
 * 1. Create a new browser bookmark.
 * 2. Name it: "Export Mock JSON"
 * 3. In the URL field, paste the minified bookmarklet code below.
 * 4. Open any Oliveboard mock solution page and click the bookmark.
 */

// --- 1. Minified Bookmarklet (Copy and paste into Bookmark URL) ---
// javascript:(()=>{const d=s=>(s||'').replace(/([A-Z0-9]{30,34})([A-Za-z0-9+/=]+)\1/g,(_,__,b)=>{try{return atob(b)}catch{return b}}),c=h=>{const e=document.createElement('div');e.innerHTML=d(h);return e.innerText.trim()},t=window.totalnq||150,w=new Set(window.wrongContainer||[]),u=new Set(window.unatContainer||[]),sn=window.dsnames||window.ssnames||[],sc=window.secount||[t],sm=[];let k=0;sc.forEach((n,i)=>{for(let j=0;j<n;j++)sm[k++]=sn[i]||`Section ${i+1}`});const vm={};document.querySelectorAll('a[onclick*="viewsolution"]').forEach(a=>{const m=a.getAttribute('onclick').match(/viewsolution\((\d+),\s*(\d+)\)/);if(m)vm[+m[1]]=+m[2]});const q=[];for(let i=0;i<t;i++){const b=document.querySelector(`[id^="q-${i}-"]`);if(!b)continue;const p=c(b.querySelector('.panetxt')?.innerHTML),qt=c(b.querySelector(`#qblock-${i}`)?.innerHTML),sl=c(b.querySelector(`#soltxt-${i}`)?.innerHTML);let co=vm[i]??null,uo=null;const op=[];b.querySelectorAll(`[id^="opt-${i}-"]`).forEach((el,idx)=>{if(el.classList.contains('correct'))co=idx;if(el.classList.contains('wrong'))uo=idx;op.push({index:idx,label:String.fromCharCode(65+idx),text:c(el.querySelector('.rightopt')?.innerHTML)})});if(u.has(i))uo=null;else if(uo===null&&co!==null)uo=co;q.push({questionNumber:i+1,section:sm[i]||'General',passage:p,question:qt,options:op,correctOptionIndex:co,correctOptionLabel:co!==null?String.fromCharCode(65+co):null,userOptionIndex:uo,userOptionLabel:uo!==null?String.fromCharCode(65+uo):null,status:u.has(i)?'unattempted':(w.has(i)?'incorrect':'correct'),solution:sl})}const pl={examId:window.examid||'Mock_Test',totalQuestions:t,summary:{total:t,correct:t-u.size-w.size,incorrect:w.size,unattempted:u.size},questions:q},a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(pl,null,2)],{type:'application/json'}));a.download=`${(window.examid||'mock_test').replace(/[^a-zA-Z0-9_-]/g,'_')}.json`;a.click();console.log(`Exported ${q.length} questions.`)})();

// --- 2. Formatted Source Code ---
(() => {
  const decode = (s) => (s || '').replace(/([A-Z0-9]{30,34})([A-Za-z0-9+/=]+)\1/g, (_, __, b) => {
    try { return atob(b); } catch { return b; }
  });

  const clean = (h) => {
    const el = document.createElement('div');
    el.innerHTML = decode(h);
    return el.innerText.trim();
  };

  const DEVANAGARI = /[\u0900-\u097F]/;
  const LABEL = /^\(?([A-Ea-e]|[1-5])[\).:\-]\s+/;

  function normalizeOptionsRaw(raw) {
    let cleaned = (raw || [])
      .map((o) => (o || '').normalize('NFKC').replace(/\s+/g, ' ').trim().replace(LABEL, '').trim())
      .filter(Boolean);

    const english = cleaned.filter((o) => !DEVANAGARI.test(o));
    if (english.length >= 2 && english.length < cleaned.length) cleaned = english;

    const seen = new Set();
    const options = cleaned.filter((o) => {
      const key = o.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const needsReview = options.length < 2 || options.length > 5;
    return { options, needsReview, reason: needsReview ? `${options.length} options found, expected 2 to 5` : undefined };
  }

  const total = window.totalnq || 150;
  const wrong = new Set(window.wrongContainer || []);
  const unat = new Set(window.unatContainer || []);
  const secNames = window.dsnames || window.ssnames || [];
  const secCounts = window.secount || [total];
  const secMap = [];

  let sc = 0;
  secCounts.forEach((cnt, idx) => {
    for (let i = 0; i < cnt; i++) {
      secMap[sc++] = secNames[idx] || `Section ${idx + 1}`;
    }
  });

  const vsMap = {};
  document.querySelectorAll('a[onclick*="viewsolution"]').forEach(a => {
    const m = a.getAttribute('onclick').match(/viewsolution\((\d+),\s*(\d+)\)/);
    if (m) vsMap[+m[1]] = +m[2];
  });

  const questions = [];
  for (let i = 0; i < total; i++) {
    const block = document.querySelector(`[id^="q-${i}-"]`);
    if (!block) continue;

    const passage = clean(block.querySelector('.panetxt')?.innerHTML);
    const question = clean(block.querySelector(`#qblock-${i}`)?.innerHTML);
    const sol = clean(block.querySelector(`#soltxt-${i}`)?.innerHTML);

    let correctOpt = vsMap[i] ?? null;
    let userOpt = null;
    const rawOpts = [];

    block.querySelectorAll(`[id^="opt-${i}-"]`).forEach((el, idx) => {
      if (el.classList.contains('correct')) correctOpt = idx;
      if (el.classList.contains('wrong')) userOpt = idx;
      rawOpts.push({
        index: idx,
        text: clean(el.querySelector('.rightopt')?.innerHTML)
      });
    });

    const norm = normalizeOptionsRaw(rawOpts.map(o => o.text));
    const opts = norm.options.map((optText, idx) => {
      const orig = rawOpts.find(o => o.text.toLowerCase().includes(optText.toLowerCase()) || optText.toLowerCase().includes(o.text.toLowerCase()));
      return {
        index: idx,
        label: String.fromCharCode(65 + idx),
        text: optText
      };
    });

    if (unat.has(i)) {
      userOpt = null;
    } else if (userOpt === null && correctOpt !== null) {
      userOpt = correctOpt;
    }

    questions.push({
      questionNumber: i + 1,
      section: secMap[i] || 'General',
      passage,
      question,
      options: opts,
      correctOptionIndex: correctOpt,
      correctOptionLabel: correctOpt !== null ? String.fromCharCode(65 + correctOpt) : null,
      userOptionIndex: userOpt,
      userOptionLabel: userOpt !== null ? String.fromCharCode(65 + userOpt) : null,
      status: unat.has(i) ? 'unattempted' : (wrong.has(i) ? 'incorrect' : 'correct'),
      solution: sol,
      needsReview: norm.needsReview,
      reviewReason: norm.reason
    });
  }

  const payload = {
    examId: window.examid || 'Mock_Test',
    totalQuestions: total,
    summary: {
      total,
      correct: total - unat.size - wrong.size,
      incorrect: wrong.size,
      unattempted: unat.size
    },
    questions
  };

  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
  a.download = `${(window.examid || 'mock_test').replace(/[^a-zA-Z0-9_-]/g, '_')}.json`;
  a.click();
  console.log(`[Oliveboard Exporter] Exported ${questions.length} questions successfully.`);
})();
