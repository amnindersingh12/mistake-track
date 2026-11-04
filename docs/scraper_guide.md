# Oliveboard Mock Test Exporter

Extract questions, options, passages, correct answers, user selections, and solutions from Oliveboard mock test solution pages into clean, structured JSON.

## Features

- **1-Click Browser Export**: Runs directly on the solution page via a bookmarklet or console snippet. No manual copy-pasting of 20MB+ HTML.
- **Deobfuscation Engine**: Automatically un-wraps and base64-decodes question stems, options, and solutions.
- **Complete Test Schema**: Includes sections, question text, reading passages, 5 options, correct answer keys, user answer choices, and full explanations.
- **Offline CLI Support**: Extract directly from saved `.html` files using Node.js without any third-party dependencies.

---

## Method 1: 1-Click Browser Bookmarklet (Recommended)

### Setup (Takes 30 seconds):
1. In your browser (Chrome, Brave, Safari, Edge), show your Bookmarks Bar (`Cmd + Shift + B` on Mac).
2. Right-click the Bookmarks Bar -> **Add Page...** (or **Add Bookmark...**).
3. Set **Name** to: `Export Mock JSON`
4. Set **URL** to the code below:

```javascript
javascript:(()=>{const d=s=>(s||'').replace(/([A-Z0-9]{30,34})([A-Za-z0-9+/=]+)\1/g,(_,__,b)=>{try{return atob(b)}catch{return b}}),c=h=>{const e=document.createElement('div');e.innerHTML=d(h);return e.innerText.trim()},t=window.totalnq||150,w=new Set(window.wrongContainer||[]),u=new Set(window.unatContainer||[]),sn=window.dsnames||window.ssnames||[],sc=window.secount||[t],sm=[];let k=0;sc.forEach((n,i)=>{for(let j=0;j<n;j++)sm[k++]=sn[i]||`Section ${i+1}`});const vm={};document.querySelectorAll('a[onclick*="viewsolution"]').forEach(a=>{const m=a.getAttribute('onclick').match(/viewsolution\((\d+),\s*(\d+)\)/);if(m)vm[+m[1]]=+m[2]});const q=[];for(let i=0;i<t;i++){const b=document.querySelector(`[id^="q-${i}-"]`);if(!b)continue;const p=c(b.querySelector('.panetxt')?.innerHTML),qt=c(b.querySelector(`#qblock-${i}`)?.innerHTML),sl=c(b.querySelector(`#soltxt-${i}`)?.innerHTML);let co=vm[i]??null,uo=null;const op=[];b.querySelectorAll(`[id^="opt-${i}-"]`).forEach((el,idx)=>{if(el.classList.contains('correct'))co=idx;if(el.classList.contains('wrong'))uo=idx;op.push({index:idx,label:String.fromCharCode(65+idx),text:c(el.querySelector('.rightopt')?.innerHTML)})});if(u.has(i))uo=null;else if(uo===null&&co!==null)uo=co;q.push({questionNumber:i+1,section:sm[i]||'General',passage:p,question:qt,options:op,correctOptionIndex:co,correctOptionLabel:co!==null?String.fromCharCode(65+co):null,userOptionIndex:uo,userOptionLabel:uo!==null?String.fromCharCode(65+uo):null,status:u.has(i)?'unattempted':(w.has(i)?'incorrect':'correct'),solution:sl})}const pl={examId:window.examid||'Mock_Test',totalQuestions:t,summary:{total:t,correct:t-u.size-w.size,incorrect:w.size,unattempted:u.size},questions:q},a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(pl,null,2)],{type:'application/json'}));a.download=`${(window.examid||'mock_test').replace(/[^a-zA-Z0-9_-]/g,'_')}.json`;a.click();console.log(`Exported ${q.length} questions.`)})();
```

### Usage:
1. Open any completed Oliveboard mock solution page (`.../exams/solution/index3.php?...`).
2. Click the **Export Mock JSON** bookmark.
3. The JSON file automatically downloads to your `~/Downloads` folder.

---

## Method 2: Offline CLI Parser

If you already have a saved `.html` file of the solution page:

```bash
# Extract to a JSON file (defaults to data/raw/mock_solution.html -> mocks/mock_solution.json)
node scripts/extract_mock.js path/to/solution.html mocks/output.json
# or via npm script:
npm run extract
```

Zero external dependencies required (uses native Node.js).

---

## Output JSON Schema

```json
{
  "examId": "IBPS SO Mains [IT] - 4",
  "totalQuestions": 150,
  "sections": [
    "English Language",
    "Reasoning Ability",
    "Quantitative Aptitude",
    "Professional Knowledge"
  ],
  "summary": {
    "total": 150,
    "correct": 50,
    "incorrect": 13,
    "unattempted": 87
  },
  "questions": [
    {
      "questionNumber": 1,
      "section": "English Language",
      "passage": "Directions: Rearrange the following six sentences...",
      "question": "Which of the following will be the LAST sentence after rearrangement?",
      "options": [
        { "index": 0, "label": "A", "text": "A" },
        { "index": 1, "label": "B", "text": "D" },
        { "index": 2, "label": "C", "text": "E" },
        { "index": 3, "label": "D", "text": "B" },
        { "index": 4, "label": "E", "text": "C" }
      ],
      "correctOptionIndex": 2,
      "correctOptionLabel": "C",
      "userOptionIndex": null,
      "userOptionLabel": null,
      "status": "unattempted",
      "solution": "The passage discusses the debate surrounding..."
    }
  ]
}
```

## License

MIT
