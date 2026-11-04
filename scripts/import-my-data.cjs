const fs = require('fs');
const path = require('path');

const MY_DATA_DIR = path.join(__dirname, '..', 'my-data');
const OUTPUT_BUNDLE = path.join(MY_DATA_DIR, 'bundle-ready-for-app.json');

console.log('📂 Scanning /my-data folder for user files...');

if (!fs.existsSync(MY_DATA_DIR)) {
  fs.mkdirSync(MY_DATA_DIR, { recursive: true });
}

const files = fs.readdirSync(MY_DATA_DIR).filter((f) => f !== 'bundle-ready-for-app.json' && !f.startsWith('.'));

if (files.length === 0) {
  console.log('ℹ️  No user files found in /my-data yet.');
  console.log('👉 Drop your mock CSVs, JSONs, screenshots (.png, .jpg), or text analysis summaries into /my-data and re-run this script:');
  console.log('   npm run import-my-data\n');
  process.exit(0);
}

console.log(`Found ${files.length} file(s) in /my-data: ${files.join(', ')}`);

const defaultSettings = {
  targetExam: 'IBPS PO Prelims',
  examDate: '2026-10-15',
  dailyTargetReviews: 20,
  retentionTarget: 85,
  markingScheme: { marksPerCorrect: 1, negativeMark: 0.25 },
  sections: [
    { id: 'english', name: 'English Language', totalQuestions: 30, durationMinutes: 20, marksPerCorrect: 1, negativeMark: 0.25, cutoff: 10, targetScore: 20, topics: ['Reading Comprehension', 'Cloze Test', 'Error Spotting'] },
    { id: 'quant', name: 'Quantitative Aptitude', totalQuestions: 35, durationMinutes: 20, marksPerCorrect: 1, negativeMark: 0.25, cutoff: 12, targetScore: 25, topics: ['Data Interpretation', 'Arithmetic', 'Quadratic Equations', 'Number Series'] },
    { id: 'reasoning', name: 'Reasoning Ability', totalQuestions: 35, durationMinutes: 20, marksPerCorrect: 1, negativeMark: 0.25, cutoff: 14, targetScore: 28, topics: ['Puzzles', 'Seating Arrangement', 'Syllogism', 'Inequalities'] }
  ],
  errorTypes: ['Calculation error', 'Concept gap', 'Misread question', 'Time pressure / rush', 'Formula forgotten', 'Unclassified']
};

const bundle = {
  version: 4,
  exportedAt: new Date().toISOString(),
  settings: defaultSettings,
  mocks: [],
  mistakes: [],
  papers: [],
  paperAttempts: [],
  tasks: [],
  profiles: [],
  images: [],
  importBatches: [],
  screenshots: {}
};

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  return lines.map((line) => {
    const row = [];
    let inQuotes = false;
    let cell = '';
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        row.push(cell.trim());
        cell = '';
      } else {
        cell += char;
      }
    }
    row.push(cell.trim());
    return row;
  });
}

function findCol(headers, candidates) {
  const norm = headers.map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
  for (const c of candidates) {
    const target = c.toLowerCase().replace(/[^a-z0-9]/g, '');
    const idx = norm.indexOf(target);
    if (idx >= 0) return idx;
  }
  return -1;
}

// Pass 1: Encode all screenshot files into bundle.screenshots and bundle.images
for (const file of files) {
  const filePath = path.join(MY_DATA_DIR, file);
  const ext = path.extname(file).toLowerCase();
  if (['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) {
    const imgBuffer = fs.readFileSync(filePath);
    const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
    const dataUri = `data:${mime};base64,${imgBuffer.toString('base64')}`;
    bundle.screenshots[file] = dataUri;
    bundle.images.push({
      id: file,
      name: file,
      dataUrl: dataUri,
      mimeType: mime,
      byteSize: imgBuffer.length,
      createdAt: new Date().toISOString()
    });
    console.log(`✓ Encoded screenshot ${file} (${Math.round(imgBuffer.length / 1024)} KB)`);
  }
}

// Pass 2: Parse JSONs, CSVs, and text files
for (const file of files) {
  const filePath = path.join(MY_DATA_DIR, file);
  const ext = path.extname(file).toLowerCase();

  try {
    if (ext === '.json') {
      const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (Array.isArray(content)) {
        if (content[0]?.sections) {
          bundle.mocks.push(...content);
          console.log(`✓ Read ${content.length} mock(s) from ${file}`);
        } else if (content[0]?.ruleToRemember || content[0]?.whatWentWrong) {
          bundle.mistakes.push(...content);
          console.log(`✓ Read ${content.length} mistake(s) from ${file}`);
        } else if (content[0]?.questions) {
          bundle.papers.push(...content);
          console.log(`✓ Read ${content.length} paper(s) from ${file}`);
        }
      } else if (content.mocks || content.mistakes) {
        if (content.mocks) bundle.mocks.push(...content.mocks);
        if (content.mistakes) bundle.mistakes.push(...content.mistakes);
        if (content.papers) bundle.papers.push(...content.papers);
        if (content.settings) bundle.settings = content.settings;
        console.log(`✓ Read structured backup from ${file}`);
      }
    } else if (ext === '.csv') {
      const csvRaw = fs.readFileSync(filePath, 'utf8');
      const rows = parseCsv(csvRaw);
      if (rows.length < 2) continue;
      const headers = rows[0];
      const headerStr = headers.join(' ').toLowerCase();

      if (headerStr.includes('attempted') || headerStr.includes('quant') || headerStr.includes('score')) {
        // Mock CSV
        const nameIdx = findCol(headers, ['Mock Name', 'Name', 'Test Name']);
        const dateIdx = findCol(headers, ['Date', 'Date (YYYY-MM-DD)']);
        let importedCount = 0;

        for (let r = 1; r < rows.length; r++) {
          const row = rows[r];
          if (row.every((c) => !c)) continue;
          const mockName = (nameIdx >= 0 ? row[nameIdx] : '') || `Imported Mock ${r}`;
          const date = (dateIdx >= 0 ? row[dateIdx] : '') || new Date().toISOString().split('T')[0];

          let totalAttempted = 0;
          let totalCorrect = 0;
          let totalWrong = 0;
          let totalNet = 0;
          let totalNeg = 0;

          const sections = defaultSettings.sections.map((sec) => {
            const attIdx = findCol(headers, [`${sec.name} Attempted`, `${sec.id} Attempted`]);
            const corrIdx = findCol(headers, [`${sec.name} Correct`, `${sec.id} Correct`]);
            const wrgIdx = findCol(headers, [`${sec.name} Wrong`, `${sec.id} Wrong`]);
            const timeIdx = findCol(headers, [`${sec.name} Time`, `${sec.id} Time`]);

            const att = attIdx >= 0 ? parseInt(row[attIdx] || '0', 10) || 0 : 0;
            const corr = corrIdx >= 0 ? parseInt(row[corrIdx] || '0', 10) || 0 : 0;
            const wrg = wrgIdx >= 0 ? parseInt(row[wrgIdx] || '0', 10) || 0 : 0;
            const timeSec = timeIdx >= 0 ? (parseInt(row[timeIdx] || '20', 10) || 20) * 60 : 1200;

            const net = Number((corr * sec.marksPerCorrect - wrg * sec.negativeMark).toFixed(2));
            const neg = Number((wrg * sec.negativeMark).toFixed(2));
            const acc = att > 0 ? Number(((corr / att) * 100).toFixed(1)) : 0;

            totalAttempted += att;
            totalCorrect += corr;
            totalWrong += wrg;
            totalNet += net;
            totalNeg += neg;

            return {
              sectionId: sec.id,
              sectionName: sec.name,
              attempted: att,
              correct: corr,
              wrong: wrg,
              unattempted: Math.max(0, sec.totalQuestions - att),
              timeSpentSeconds: timeSec,
              netScore: net,
              accuracy: acc,
              marksLostNegative: neg
            };
          });

          bundle.mocks.push({
            name: mockName,
            date,
            source: 'CSV Import',
            attemptType: 'mock',
            sections,
            totalAttempted,
            totalCorrect,
            totalWrong,
            totalUnattempted: 100 - totalAttempted,
            totalNetScore: Number(totalNet.toFixed(2)),
            overallAccuracy: totalAttempted > 0 ? Number(((totalCorrect / totalAttempted) * 100).toFixed(1)) : 0,
            totalMarksLostNegative: Number(totalNeg.toFixed(2)),
            totalTimeSpentSeconds: sections.reduce((s, x) => s + x.timeSpentSeconds, 0),
            notes: `Converted from ${file}`
          });
          importedCount++;
        }
        console.log(`✓ Converted ${importedCount} mock(s) from CSV: ${file}`);
      } else if (headerStr.includes('rule') || headerStr.includes('wrong') || headerStr.includes('question')) {
        // Mistake CSV
        const qTextIdx = findCol(headers, ['Question Text', 'Question', 'Problem']);
        const qNoIdx = findCol(headers, ['Question Number', 'Q No', 'Q#']);
        const secIdx = findCol(headers, ['Section', 'Section Name']);
        const topIdx = findCol(headers, ['Topic', 'Subject']);
        const myAnsIdx = findCol(headers, ['My Answer', 'Your Answer']);
        const corrAnsIdx = findCol(headers, ['Correct Answer', 'Answer']);
        const ruleIdx = findCol(headers, ['Rule to Remember', 'Rule', 'Lesson']);
        const wrongIdx = findCol(headers, ['What Went Wrong', 'Why Wrong', 'Mistake Reason']);
        const solIdx = findCol(headers, ['Correct Solution', 'Solution']);
        const appIdx = findCol(headers, ['Better Approach', 'Shortcut']);
        const imgIdx = findCol(headers, ['Screenshot File', 'Screenshot', 'Image']);
        const mockNameIdx = findCol(headers, ['Mock Name', 'Mock']);

        let importedMistakes = 0;
        for (let r = 1; r < rows.length; r++) {
          const row = rows[r];
          if (row.every((c) => !c)) continue;

          const imgRef = imgIdx >= 0 ? row[imgIdx]?.trim() : '';
          const attachedScreenshot = bundle.screenshots[imgRef] || bundle.screenshots[`${imgRef}.png`] || undefined;

          bundle.mistakes.push({
            mockName: (mockNameIdx >= 0 ? row[mockNameIdx] : '') || 'External / CSV Import',
            sectionId: 'quant',
            sectionName: (secIdx >= 0 ? row[secIdx] : '') || 'Quantitative Aptitude',
            topic: (topIdx >= 0 ? row[topIdx] : '') || 'General',
            questionNumber: qNoIdx >= 0 ? parseInt(row[qNoIdx] || '1', 10) || 1 : r,
            questionText: (qTextIdx >= 0 ? row[qTextIdx] : '') || `Imported Mistake #${r}`,
            questionImage: attachedScreenshot,
            myAnswer: (myAnsIdx >= 0 ? row[myAnsIdx] : '') || 'Wrong Option',
            correctAnswer: (corrAnsIdx >= 0 ? row[corrAnsIdx] : '') || 'Correct Option',
            resultType: 'Wrong',
            errorTypes: ['Unclassified'],
            timeSpentSeconds: 60,
            idealTimeSeconds: 35,
            whatWentWrong: (wrongIdx >= 0 ? row[wrongIdx] : '') || 'Converted from CSV import.',
            correctSolution: (solIdx >= 0 ? row[solIdx] : '') || 'Refer to standard solution.',
            betterApproach: (appIdx >= 0 ? row[appIdx] : '') || 'Review standard method.',
            ruleToRemember: (ruleIdx >= 0 ? row[ruleIdx] : '') || 'Carefully review problem steps.',
            difficulty: 'Medium',
            tags: ['csv-import'],
            status: 'New',
            interval: 1,
            consecutiveCorrect: 0,
            nextReviewDate: new Date().toISOString().split('T')[0],
            history: [],
            createdAt: new Date().toISOString().split('T')[0]
          });
          importedMistakes++;
        }
        console.log(`✓ Converted ${importedMistakes} mistake(s) from CSV: ${file} (with attached screenshots)`);
      }
    }
  } catch (err) {
    console.warn(`⚠️  Could not parse ${file}:`, err.message);
  }
}

fs.writeFileSync(OUTPUT_BUNDLE, JSON.stringify(bundle, null, 2), 'utf8');
console.log(`\n🎉 Generated bundle saved to: my-data/bundle-ready-for-app.json`);
console.log(`Summary: ${bundle.mocks.length} mocks, ${bundle.mistakes.length} mistakes, ${bundle.papers.length} papers, ${bundle.images.length} screenshots encoded.`);
console.log(`👉 You can now click "Restore from Backup" in the app's Settings to review and load this data.\n`);
