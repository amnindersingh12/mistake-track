const fs = require('fs');
const path = require('path');

function splitBilingual(text) {
  if (!text) return { en: '', hi: '' };
  text = text.trim();

  // If text has a question mark followed by Hindi (possibly with leading numbers/spaces)
  const qm = text.match(/^([\s\S]*?\?)\s*([0-9\s]*[\u0900-\u097F][\s\S]*)$/);
  if (qm) {
    return { en: qm[1].trim(), hi: qm[2].trim() };
  }

  // If text has explicit "निर्देश" or "नोट"
  const nIdx = text.search(/निर्देश\s*[:\s]|नोट\s*[:\s]/);
  if (nIdx !== -1) {
    return {
      en: text.slice(0, nIdx).trim(),
      hi: text.slice(nIdx).trim()
    };
  }

  // Fallback to first Devanagari character
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

function cleanOptionText(text) {
  if (!text) return { en: '', hi: '' };
  text = text.trim();

  // De-duplicate if mirrored e.g. "72%72%" or "Only IOnly I"
  if (text.length > 0 && text.length % 2 === 0) {
    const half = text.length / 2;
    if (text.slice(0, half) === text.slice(half)) {
      text = text.slice(0, half);
    }
  }

  return splitBilingual(text);
}

function formatExplanation(sol) {
  if (!sol) return '';
  let s = sol.trim();
  // Format bullet points
  s = s.replace(/•\s*/g, '\n- ');
  // Format option breakdowns like "a) ... b) ..." or "Option (a):"
  s = s.replace(/\s+([a-e]\))\s+/gi, '\n- $1 ');
  s = s.replace(/\s+(Option\s*\([a-e]\):)/gi, '\n- $1 ');
  // Clean spacing around formulas
  s = s.replace(/([0-9])([A-Z][a-z])/g, '$1 $2');
  s = s.replace(/\n{3,}/g, '\n\n');
  return s.trim();
}

const defaultIn = path.resolve(__dirname, '..', 'mocks', 'mock_1.json');
const inputPath = process.argv[2] || defaultIn;
const raw = JSON.parse(fs.readFileSync(inputPath, 'utf8'));

const sections = [...new Set(raw.questions.map(q => q.section))];
const secStats = {};
sections.forEach(sec => {
  secStats[sec] = { total: 0, correct: 0, incorrect: 0, unattempted: 0 };
});

const cleanedQuestions = raw.questions.map(q => {
  const pSplit = splitBilingual(q.passage);
  const qSplit = splitBilingual(q.question);
  const optObj = {};
  const optHiObj = {};
  let hasHiOpts = false;

  q.options.forEach(o => {
    const oClean = cleanOptionText(o.text);
    optObj[o.label] = oClean.en;
    if (oClean.hi) {
      optHiObj[o.label] = oClean.hi;
      hasHiOpts = true;
    }
  });

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
    passage: pSplit.en || null,
    passage_hindi: pSplit.hi || null,
    question: qSplit.en,
    question_hindi: qSplit.hi || null,
    options: optObj,
    options_hindi: hasHiOpts ? optHiObj : null,
    correctAnswer: q.correctOptionLabel,
    userAnswer: q.userOptionLabel,
    status: q.status,
    explanation: formatExplanation(q.solution)
  };
});

const cleanedData = {
  exam: {
    id: raw.examId,
    totalQuestions: raw.totalQuestions,
    sections: sections,
    overallSummary: raw.summary,
    sectionBreakdown: secStats
  },
  questions: cleanedQuestions
};

// 1. Write Clean JSON
const jsonOutPath = process.argv[3] || path.resolve(__dirname, '..', 'mocks', 'mock_1_clean.json');
fs.writeFileSync(jsonOutPath, JSON.stringify(cleanedData, null, 2), 'utf8');

// 2. Generate Gemini 4 Argon Optimized Markdown
let md = `# ${raw.examId} — Complete Study & Analysis Pack for Gemini 4 Argon\n\n`;
md += `> **Purpose**: Optimized for ingestion into **Gemini 4 Argon** (\`gemini-4-argon\`) for in-depth reasoning, diagnostic error analysis, concept tutoring, and targeted mock test generation.\n\n`;

md += `## 📊 Performance Executive Summary\n\n`;
md += `| Metric | Count | Percentage |\n`;
md += `| :--- | :--- | :--- |\n`;
md += `| **Total Questions** | ${raw.totalQuestions} | 100% |\n`;
md += `| **Correct** | ${raw.summary.correct} | ${((raw.summary.correct / raw.totalQuestions) * 100).toFixed(1)}% |\n`;
md += `| **Incorrect (Mistakes to Review)** | ${raw.summary.incorrect} | ${((raw.summary.incorrect / raw.totalQuestions) * 100).toFixed(1)}% |\n`;
md += `| **Unattempted** | ${raw.summary.unattempted} | ${((raw.summary.unattempted / raw.totalQuestions) * 100).toFixed(1)}% |\n\n`;

md += `### Section Breakdown\n\n`;
md += `| Section | Total | Correct | Incorrect | Unattempted |\n`;
md += `| :--- | :--- | :--- | :--- | :--- |\n`;
Object.entries(secStats).forEach(([sec, stat]) => {
  md += `| **${sec}** | ${stat.total} | ${stat.correct} | ${stat.incorrect} | ${stat.unattempted} |\n`;
});
md += `\n---\n\n`;

md += `## 💡 Recommended Prompts for Gemini 4 Argon\n\n`;
md += `Copy-paste any of these prompts into your Gemini 4 Argon conversation along with this document:\n\n`;
md += `1. **Mistake Diagnostic**: *"Analyze all 27 questions tagged \`[STATUS: INCORRECT]\`. Group my mistakes by underlying knowledge gaps or cognitive traps (e.g. calculation errors, conceptual confusion, misreading questions), and explain how to fix them."*\n`;
md += `2. **Professional Knowledge Deep Dive**: *"Take Section 4 (Professional Knowledge - IT) from this exam. Identify the 5 most recurring technical topics (DBMS, Networking, OS, Data Structures, OOP) and give me high-yield revision notes for each."*\n`;
md += `3. **Adaptive Quiz Generation**: *"Generate 10 fresh, exam-level multiple-choice questions targeting the exact concepts I got wrong in Reasoning and Professional Knowledge, complete with detailed step-by-step solutions."*\n\n`;
md += `---\n\n`;

md += `## 📝 Questions & Detailed Solutions\n\n`;

cleanedQuestions.forEach(q => {
  const statusIcon = q.status === 'correct' ? '✅ CORRECT' : (q.status === 'incorrect' ? '❌ INCORRECT (REVIEW)' : '⏳ UNATTEMPTED');
  md += `### Question ${q.id} [${q.section}] — ${statusIcon}\n\n`;
  
  if (q.passage) {
    md += `> **Directions / Context:**\n`;
    md += `> ${q.passage.replace(/\n/g, '\n> ')}\n\n`;
  }

  md += `**Question:**\n${q.question}\n\n`;

  md += `**Options:**\n`;
  Object.entries(q.options).forEach(([label, text]) => {
    const isCorrectMark = label === q.correctAnswer ? ' *(Correct)*' : '';
    const isUserMark = label === q.userAnswer ? ' *(Your Choice)*' : '';
    md += `- **(${label})** ${text}${isCorrectMark}${isUserMark}\n`;
  });
  md += `\n`;

  md += `- **Correct Answer**: **(${q.correctAnswer})**\n`;
  md += `- **Your Answer**: ${q.userAnswer ? `**(${q.userAnswer})**` : '*Unattempted*'}\n`;
  md += `- **Status**: \`${q.status.toUpperCase()}\`\n\n`;

  md += `<details>\n<summary><b>📖 View Detailed Solution & Explanation</b></summary>\n\n`;
  md += `${q.explanation}\n\n`;
  md += `</details>\n\n`;
  md += `---\n\n`;
});

const mdOutPath = process.argv[4] || path.resolve(__dirname, '..', 'output', 'mock_1_study_pack.md');
fs.writeFileSync(mdOutPath, md, 'utf8');

console.log(`[Success] Cleaned JSON generated: ${jsonOutPath}`);
console.log(`[Success] Gemini 4 Argon Study Pack generated: ${mdOutPath}`);
