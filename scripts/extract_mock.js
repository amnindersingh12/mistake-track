#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function decodeToken(str) {
  if (!str) return '';
  const tokenRegex = /([A-Z0-9]{30,34})([A-Za-z0-9+/=]+)\1/g;
  let decoded = str.replace(tokenRegex, (_, __, b64) => {
    try {
      return Buffer.from(b64, 'base64').toString('utf-8');
    } catch {
      return b64;
    }
  });
  return decoded.trim();
}

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

function cleanHtmlText(htmlStr) {
  if (!htmlStr) return '';
  return htmlStr
    .replace(/<br\s*[\/]?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function parseOliveboardHtml(html) {
  const getVar = (name) => {
    const m = html.match(new RegExp('var ' + name + '\\s*=\\s*([^;]+);'));
    return m ? eval(m[1]) : null;
  };

  const examid = getVar('examid') || 'Oliveboard Mock Test';
  const totalnq = getVar('totalnq') || 150;
  const ssnames = getVar('ssnames') || [];
  const dsnames = getVar('dsnames') || [];
  const secount = getVar('secount') || [totalnq];
  const wrongContainer = new Set(getVar('wrongContainer') || []);
  const unatContainer = new Set(getVar('unatContainer') || []);

  const sectionMap = [];
  let qCounter = 0;
  for (let s = 0; s < secount.length; s++) {
    const name = dsnames[s] || ssnames[s] || `Section ${s + 1}`;
    for (let c = 0; c < secount[s]; c++) {
      sectionMap[qCounter++] = name;
    }
  }

  const vsMap = {};
  const vsRegex = /viewsolution\((\d+),\s*(\d+)\)/g;
  let vm;
  while ((vm = vsRegex.exec(html)) !== null) {
    vsMap[parseInt(vm[1])] = parseInt(vm[2]);
  }

  const questions = [];

  for (let i = 0; i < totalnq; i++) {
    const idx = html.indexOf(`id="q-${i}-`);
    let block = '';
    if (idx !== -1) {
      block = html.slice(idx, idx + 25000);
      const endIdx = block.indexOf('<!-- \\.pane question -->');
      if (endIdx !== -1) block = block.slice(0, endIdx);
    }

    const paneMatch = block.match(/<div class="paneqcol panetxt"[^>]*>([\s\S]*?)<\/div>/);
    const rawPassage = paneMatch ? decodeToken(paneMatch[1]) : '';
    const passage = cleanHtmlText(rawPassage);

    const qbMatch = block.match(new RegExp(`<div id="qblock-${i}"[^>]*>([\\s\\S]*?)<\\/div>`));
    const rawQuestion = qbMatch ? decodeToken(qbMatch[1]) : '';
    const questionText = cleanHtmlText(rawQuestion);

    const optRegex = new RegExp(`<div id="opt-${i}-(\\d+)"\\s+class="([^"]*)"[\\s\\S]*?<div class="rightopt">([\\s\\S]*?)<\\/div>`, 'g');
    let om;
    const rawOptions = [];
    let correctOpt = vsMap[i] !== undefined ? vsMap[i] : null;
    let userOpt = null;

    while ((om = optRegex.exec(block)) !== null) {
      const optIdx = parseInt(om[1]);
      const optClasses = om[2];
      const optRaw = om[3];
      const optText = cleanHtmlText(decodeToken(optRaw));
      rawOptions.push({
        index: optIdx,
        text: optText,
        isCorrect: optClasses.includes('correct'),
        isWrong: optClasses.includes('wrong')
      });
      if (optClasses.includes('correct')) {
        correctOpt = optIdx;
      }
      if (optClasses.includes('wrong')) {
        userOpt = optIdx;
      }
    }

    const norm = normalizeOptionsRaw(rawOptions.map(o => o.text));
    const options = norm.options.map((optText, idx) => ({
      index: idx,
      label: String.fromCharCode(65 + idx),
      text: optText
    }));

    if (unatContainer.has(i)) {
      userOpt = null;
    } else if (userOpt === null && correctOpt !== null) {
      userOpt = correctOpt;
    }

    const solMatch = block.match(new RegExp(`<div id="soltxt-${i}"[^>]*>([\\s\\S]*?)<\\/div>`));
    const rawSol = solMatch ? decodeToken(solMatch[1]) : '';
    const solution = cleanHtmlText(rawSol);

    questions.push({
      questionNumber: i + 1,
      section: sectionMap[i] || 'General',
      passage: passage,
      question: questionText,
      options: options,
      correctOptionIndex: correctOpt,
      correctOptionLabel: correctOpt !== null ? String.fromCharCode(65 + correctOpt) : null,
      userOptionIndex: userOpt,
      userOptionLabel: userOpt !== null ? String.fromCharCode(65 + userOpt) : null,
      status: unatContainer.has(i) ? 'unattempted' : (wrongContainer.has(i) ? 'incorrect' : 'correct'),
      solution: solution,
      needsReview: norm.needsReview,
      reviewReason: norm.reason
    });
  }

  return {
    examId: examid,
    totalQuestions: totalnq,
    sections: dsnames,
    summary: {
      total: totalnq,
      correct: totalnq - unatContainer.size - wrongContainer.size,
      incorrect: wrongContainer.size,
      unattempted: unatContainer.size
    },
    questions: questions
  };
}

const defaultHtml = path.resolve(__dirname, '..', 'data', 'raw', 'mock_solution.html');
const inputPath = process.argv[2] || (fs.existsSync(defaultHtml) ? defaultHtml : 'mock_solution.html');
const defaultJson = path.resolve(__dirname, '..', 'mocks', path.basename(inputPath).replace(/\.html?$/i, '.json'));
const outputPath = process.argv[3] || defaultJson;

if (!fs.existsSync(inputPath)) {
  console.error(`File not found: ${inputPath}`);
  process.exit(1);
}

const html = fs.readFileSync(inputPath, 'utf8');
const result = parseOliveboardHtml(html);
fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), 'utf8');
console.log(`Saved ${result.questions.length} questions to ${outputPath}`);
console.log(`Summary:`, result.summary);
