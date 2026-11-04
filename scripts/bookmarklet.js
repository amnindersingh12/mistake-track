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
    const opts = [];

    block.querySelectorAll(`[id^="opt-${i}-"]`).forEach((el, idx) => {
      if (el.classList.contains('correct')) correctOpt = idx;
      if (el.classList.contains('wrong')) userOpt = idx;
      opts.push({
        index: idx,
        label: String.fromCharCode(65 + idx),
        text: clean(el.querySelector('.rightopt')?.innerHTML)
      });
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
      solution: sol
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
