#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

// 1. Text Cleaning Engine
function splitBilingual(text) {
  if (!text) return { en: '', hi: '' };
  text = text.trim();
  const qm = text.match(/^([\s\S]*?\?)\s*([0-9\s]*[\u0900-\u097F][\s\S]*)$/);
  if (qm) return { en: qm[1].trim(), hi: qm[2].trim() };

  const nIdx = text.search(/निर्देश\s*[:\s]|नोट\s*[:\s]/);
  if (nIdx !== -1) return { en: text.slice(0, nIdx).trim(), hi: text.slice(nIdx).trim() };

  const firstHindiIdx = text.search(/[\u0900-\u097F]/);
  if (firstHindiIdx !== -1) {
    let enPart = text.slice(0, firstHindiIdx);
    let hiPart = text.slice(firstHindiIdx);
    const trailDigits = enPart.match(/([.\s:]|^)(\d+)\s*$/);
    if (trailDigits && (enPart.includes('.') || enPart.includes(':'))) {
      hiPart = trailDigits[2] + ' ' + hiPart;
      enPart = enPart.slice(0, trailDigits.index + trailDigits[1].length);
    }
    return { en: enPart.trim(), hi: hiPart.trim() };
  }
  return { en: text, hi: '' };
}

function cleanOption(text) {
  if (!text) return '';
  text = text.trim();
  if (text.length > 0 && text.length % 2 === 0) {
    const half = text.length / 2;
    if (text.slice(0, half) === text.slice(half)) text = text.slice(0, half);
  }
  return splitBilingual(text).en;
}

function formatExplanation(sol) {
  if (!sol) return '';
  return sol.trim().replace(/•\s*/g, '\n- ').replace(/\s+([a-e]\))\s+/gi, '\n- $1 ').replace(/\n{3,}/g, '\n\n');
}

function cleanMockData(raw) {
  const sections = [...new Set(raw.questions.map(q => q.section))];
  const secStats = {};
  sections.forEach(s => secStats[s] = { total: 0, correct: 0, incorrect: 0, unattempted: 0 });

  const questions = raw.questions.map(q => {
    const p = splitBilingual(q.passage);
    const qu = splitBilingual(q.question);
    const opts = {};
    q.options.forEach(o => { opts[o.label] = cleanOption(o.text); });

    const sec = q.section || 'General';
    if (secStats[sec]) {
      secStats[sec].total++;
      if (q.status === 'correct') secStats[sec].correct++;
      else if (q.status === 'incorrect') secStats[sec].incorrect++;
      else secStats[sec].unattempted++;
    }

    return {
      id: q.questionNumber,
      section: sec,
      passage: p.en || null,
      question: qu.en,
      options: opts,
      correctAnswer: q.correctOptionLabel,
      userAnswer: q.userOptionLabel,
      status: q.status,
      explanation: formatExplanation(q.solution)
    };
  });

  return {
    examId: raw.examId,
    totalQuestions: raw.totalQuestions,
    sections,
    summary: raw.summary,
    sectionBreakdown: secStats,
    questions
  };
}

// 2. Main Pipeline Runner
const mocksDir = path.resolve(__dirname, '..', 'mocks');
const outDir = path.resolve(__dirname, '..', 'output');
if (!fs.existsSync(mocksDir)) fs.mkdirSync(mocksDir, { recursive: true });
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

// Auto-import any json files from mocks directory
const files = fs.readdirSync(mocksDir).filter(f => f.endsWith('.json'));

if (files.length === 0) {
  console.log(`[!] Place your downloaded JSON files into the "mocks/" folder and run again.`);
  console.log(`    Example: cp ~/Downloads/*IBPS*.json mocks/ && node pipeline.js`);
  process.exit(0);
}

const allMocks = [];

files.forEach(file => {
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(mocksDir, file), 'utf8'));
    if (!raw || !Array.isArray(raw.questions)) {
      console.warn(`[!] Skipping ${file}: missing 'questions' array.`);
      return;
    }
    const cleaned = cleanMockData(raw);
    allMocks.push(cleaned);

    // Generate individual study pack
    const baseName = path.basename(file, '.json');
    let singleMd = `# ${cleaned.examId} — Single Mock Analysis\n\n`;
  singleMd += `| Total | Correct | Incorrect | Unattempted | Accuracy |\n| :--- | :--- | :--- | :--- | :--- |\n`;
  const acc = (cleaned.summary.correct / (cleaned.summary.correct + cleaned.summary.incorrect) * 100 || 0).toFixed(1);
  singleMd += `| ${cleaned.totalQuestions} | ${cleaned.summary.correct} | ${cleaned.summary.incorrect} | ${cleaned.summary.unattempted} | ${acc}% |\n\n`;

  singleMd += `## Section Breakdown\n\n| Section | Correct | Incorrect | Unattempted |\n| :--- | :--- | :--- | :--- |\n`;
  Object.entries(cleaned.sectionBreakdown).forEach(([s, st]) => {
    singleMd += `| ${s} | ${st.correct} | ${st.incorrect} | ${st.unattempted} |\n`;
  });

  singleMd += `\n## Questions Review\n\n`;
  cleaned.questions.forEach(q => {
    const icon = q.status === 'correct' ? '✅' : (q.status === 'incorrect' ? '❌' : '⏳');
    singleMd += `### Q${q.id} [${q.section}] ${icon} \`${q.status.toUpperCase()}\`\n`;
    if (q.passage) singleMd += `> ${q.passage.replace(/\n/g, '\n> ')}\n\n`;
    singleMd += `**Q:** ${q.question}\n\n`;
    Object.entries(q.options).forEach(([lbl, txt]) => {
      const c = lbl === q.correctAnswer ? ' *(Correct)*' : '';
      const u = lbl === q.userAnswer ? ' *(Your Choice)*' : '';
      singleMd += `- **(${lbl})** ${txt}${c}${u}\n`;
    });
    singleMd += `\n<details><summary>Explanation</summary>\n\n${q.explanation}\n</details>\n\n---\n\n`;
  });

    fs.writeFileSync(path.join(outDir, `${baseName}.md`), singleMd, 'utf8');
  } catch (err) {
    console.error(`[!] Error processing ${file}:`, err.message);
  }
});

// 3. Multi-Mock Cross-Test Aggregation
let multiMd = `# Multi-Mock Performance & Trend Report (Gemini 4 Argon Ready)\n\n`;
multiMd += `> **Total Mocks Analyzed**: ${allMocks.length}\n\n`;

multiMd += `## 📈 Score & Accuracy Progression\n\n`;
multiMd += `| Exam Name | Total Qs | Correct | Incorrect | Unattempted | Attempt Rate | Accuracy |\n`;
multiMd += `| :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n`;

allMocks.forEach(m => {
  const attempted = m.summary.correct + m.summary.incorrect;
  const attRate = ((attempted / m.totalQuestions) * 100).toFixed(1);
  const acc = (attempted > 0 ? (m.summary.correct / attempted) * 100 : 0).toFixed(1);
  multiMd += `| **${m.examId}** | ${m.totalQuestions} | ${m.summary.correct} | ${m.summary.incorrect} | ${m.summary.unattempted} | ${attRate}% | **${acc}%** |\n`;
});

multiMd += `\n## 🎯 Recurring Mistakes Ledger (Cross-Mock Analysis)\n\n`;
multiMd += `The following questions represent direct mistakes across your tests that require targeted revision:\n\n`;

allMocks.forEach(m => {
  const wrongs = m.questions.filter(q => q.status === 'incorrect');
  multiMd += `### ❌ ${m.examId} (${wrongs.length} Mistakes)\n\n`;
  wrongs.forEach(q => {
    multiMd += `- **Q${q.id} [${q.section}]**: ${q.question.slice(0, 120)}...\n`;
    multiMd += `  - Your choice: **${q.userAnswer}** | Correct: **${q.correctAnswer}**\n`;
    multiMd += `  - Key takeaway: *${q.explanation.slice(0, 150).replace(/\n/g, ' ')}...*\n\n`;
  });
});

multiMd += `## 🤖 Strategic Gemini 4 Argon Prompts\n\n`;
multiMd += `Upload this document (\`trend_report.md\`) to Gemini 4 Argon and use:\n\n`;
multiMd += `1. **Trajectory Diagnostic**: *"Evaluate my score progression across these ${allMocks.length} mocks. Which sections show stagnation or negative delta, and what test-taking adjustments must I make?"*\n`;
multiMd += `2. **Error Pattern Synthesis**: *"Look at the Recurring Mistakes Ledger across all mocks. Synthesize my top 5 conceptual blindspots in Professional Knowledge and Reasoning, and create a targeted cheat-sheet."*\n`;
multiMd += `3. **Custom Adaptive Exam**: *"Generate a targeted 20-question challenge exam combining my weakest topics from both Mock 1 and Mock 4, with step-by-step verification."*\n`;

fs.writeFileSync(path.join(outDir, 'trend_report.md'), multiMd, 'utf8');

console.log(`[✓] Processed ${allMocks.length} mock tests.`);
console.log(`[✓] Generated individual study packs in: output/`);
console.log(`[✓] Generated multi-mock trend brief: output/trend_report.md`);
