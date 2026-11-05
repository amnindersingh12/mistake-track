import {
  MockTest,
  MistakeEntry,
  PaperQuestion,
  SectionPerformance,
  ExamSettings,
  ResultType,
  Difficulty,
  StudyBridgeImportPayload,
  StudyBridgeImportMessage,
  StudyBridgeSourceMetadata,
  StudyBridgeMode,
  FullMockScanResult
} from '../types';
import { getTodayDateStr } from './srs';
import { normalizeOptions } from './normalizeOptions';

/**
 * Generates sample CSV templates for user download.
 */
export function getMockCsvTemplate(): string {
  return [
    'Mock Name,Date (YYYY-MM-DD),Source,Type (mock/pyq/memory-based),Rank,Percentile,Quant Attempted,Quant Correct,Quant Wrong,Quant Time (min),Reasoning Attempted,Reasoning Correct,Reasoning Wrong,Reasoning Time (min),English Attempted,English Correct,English Wrong,English Time (min)',
    'Testbook Live Mock 01,2026-11-01,Testbook,mock,1420,93.5,26,22,4,20,28,24,4,20,22,17,5,20'
  ].join('\n');
}

export function getMistakeCsvTemplate(): string {
  return [
    'Mock Name,Section (Quant/Reasoning/English),Topic,Subtopic,Question Number,Question Text,My Answer,Correct Answer,Result Type (Wrong/Left unattempted/Correct-but-slow),Error Types (semicolon separated),Time Spent (sec),Ideal Time (sec),What Went Wrong,Correct Solution,Better Approach / Shortcut,Rule to Remember,Difficulty (Easy/Medium/Hard)',
    'Testbook Live Mock 01,Quant,Percentage,Successive change,4,"Price +25%, Consumption -20%, find % change in expenditure.",+5%,0% (No change),Wrong,Formula forgotten; Calculation mistake,75,35,Directly subtracted 25-20 without AB-rule,Price 5/4 * Consumption 4/5 = 1,AB-rule: 25 - 20 - (25*20)/100 = 0% in 5 seconds,Successive changes follow A + B + AB/100,Easy'
  ].join('\n');
}

export function getPaperQuestionsCsvTemplate(): string {
  return [
    'Section (Quant/Reasoning/English),Topic,Question Number,Question Text,Option A,Option B,Option C,Option D,Option E,Correct Option (A/B/C/D/E),Solution,Shortcut',
    'Quant,Time & Work,1,"Pipe A fills tank in 12h, leak empties in 15h. If full, how long for leak to empty?",40 hrs,50 hrs,60 hrs,70 hrs,None,C,"1/12 - 1/15 = 1/60 => 60 hrs","Formula: (A*B)/(B-A) = (12*15)/3 = 60h"'
  ].join('\n');
}

export function getMockJsonTemplate(): string {
  return JSON.stringify(
    [
      {
        name: 'SBI PO Prelims Real Mock 01',
        date: '2026-11-01',
        source: 'Testbook',
        attemptType: 'mock',
        overallRank: 1250,
        overallPercentile: 94.2,
        notes: 'Felt good in Quant, struggled with floor puzzle.',
        sections: [
          {
            sectionId: 'quant',
            sectionName: 'Quantitative Aptitude',
            attempted: 26,
            correct: 22,
            wrong: 4,
            timeSpentSeconds: 1200
          },
          {
            sectionId: 'reasoning',
            sectionName: 'Reasoning Ability',
            attempted: 28,
            correct: 24,
            wrong: 4,
            timeSpentSeconds: 1200
          },
          {
            sectionId: 'english',
            sectionName: 'English Language',
            attempted: 22,
            correct: 18,
            wrong: 4,
            timeSpentSeconds: 1200
          }
        ]
      }
    ],
    null,
    2
  );
}

export function getMistakeJsonTemplate(): string {
  return JSON.stringify(
    [
      {
        mockName: 'SBI PO Prelims Real Mock 01',
        sectionId: 'quant',
        sectionName: 'Quantitative Aptitude',
        topic: 'Percentage',
        subtopic: 'Successive percentage',
        questionNumber: 4,
        questionText: 'Price of sugar rose 20%, consumption fell 10%. Change in expenditure?',
        myAnswer: '+10%',
        correctAnswer: '+8%',
        resultType: 'Wrong',
        errorTypes: ['Calculation mistake', 'Formula forgotten'],
        timeSpentSeconds: 60,
        idealTimeSeconds: 30,
        whatWentWrong: 'Did 20 - 10 = 10 without applying AB rule.',
        correctSolution: '20 - 10 - (20*10)/100 = 8% increase.',
        betterApproach: 'AB rule: A + B + AB/100.',
        ruleToRemember: 'Never linearly subtract successive percentages; apply A + B + AB/100.',
        difficulty: 'Easy'
      }
    ],
    null,
    2
  );
}

export function downloadTemplateFile(filename: string, content: string, mimeType = 'text/csv'): void {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8;` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export type ImportContentType = 'mock' | 'mistake';

export interface ParsedSection {
  sectionName: string;
  sectionId: string;
  attempted: number;
  correct: number;
  wrong: number;
  unattempted?: number;
  score?: number;
  timeMinutes: number;
  rawTextFound?: string;
  isUncertain?: boolean;
}

export interface ParsedMistake {
  mockName: string;
  sectionId: string;
  sectionName: string;
  topic: string;
  subtopic?: string;
  questionNumber: number;
  questionText: string;
  myAnswer: string;
  correctAnswer: string;
  resultType: ResultType;
  errorTypes: string[];
  timeSpentSeconds: number;
  idealTimeSeconds: number;
  whatWentWrong: string;
  correctSolution: string;
  betterApproach: string;
  ruleToRemember: string;
  difficulty: Difficulty;
  uncertainFields: string[];
  needsReview?: boolean;
  reviewReason?: string;
}

/**
 * Intelligent Testbook text result parser.
 * Best-effort parses raw text copied from Testbook analysis summary pages or question reviews.
 */
export interface ParsedPasteResult {
  contentType: ImportContentType;
  rawText: string;
  examName?: string;
  mockName: string;
  source: string;
  date: string;
  overallScore?: number;
  maxMarks?: number;
  overallPercentage?: number;
  overallAccuracy?: number;
  overallRank?: number;
  overallPercentile?: number;
  totalAttempted?: number;
  totalCorrect?: number;
  totalWrong?: number;
  totalUnattempted?: number;
  totalTimeSpentMinutes?: number;
  sections: ParsedSection[];
  mistake?: ParsedMistake;
  uncertainFields: string[];
  unparsedLines: string[];
}

export const QUESTION_MISTAKE_REASONS = [
  'Conceptual gap',
  'Calculation error',
  'Misreading',
  'Silly mistake',
  'Time pressure',
  'Guessing',
  'Forgot formula or fact'
] as const;

export type QuestionMistakeReason = typeof QUESTION_MISTAKE_REASONS[number];

/**
 * Classifies the attempt status of a scanned question.
 */
export function getScannedQuestionStatus(q: {
  statusBadge?: string;
  selectedAnswer?: string;
  correctAnswer?: string;
  marks?: number;
}): 'Correct' | 'Wrong' | 'Skipped' {
  if (q.statusBadge) {
    const lower = q.statusBadge.toLowerCase();
    if (lower.includes('correct') && !lower.includes('in') && !lower.includes('slow')) return 'Correct';
    if (lower.includes('wrong') || lower.includes('incorrect')) return 'Wrong';
    if (lower.includes('skip') || lower.includes('unattempt') || lower.includes('left')) return 'Skipped';
  }
  if (q.selectedAnswer === 'Left unattempted' || !q.selectedAnswer || q.selectedAnswer === 'Skipped') {
    return 'Skipped';
  }
  if (q.correctAnswer && q.selectedAnswer) {
    return q.selectedAnswer === q.correctAnswer ? 'Correct' : 'Wrong';
  }
  if (q.marks !== undefined) {
    if (q.marks > 0) return 'Correct';
    if (q.marks < 0) return 'Wrong';
    return 'Skipped';
  }
  return 'Wrong';
}

/**
 * Validates StudyBridge incoming import payload against schema.
 */
export function validateStudyBridgePayload(data: unknown): {
  isValid: boolean;
  error?: string;
  payload?: StudyBridgeImportPayload;
} {
  if (!data || typeof data !== 'object') {
    return { isValid: false, error: 'Import message must be a valid object.' };
  }

  const msg = data as Partial<StudyBridgeImportMessage>;
  if (msg.schemaVersion !== 1 || msg.type !== 'STUDYBRIDGE_IMPORT') {
    return { isValid: false, error: 'Unsupported message schema or type.' };
  }

  const p = msg.payload;
  if (!p || typeof p !== 'object') {
    return { isValid: false, error: 'Missing import payload.' };
  }

  if (typeof p.id !== 'string' || !p.id.trim()) {
    return { isValid: false, error: 'Invalid or missing transfer ID.' };
  }

  const rawText =
    typeof p.text === 'string' && p.text.trim()
      ? p.text
      : p.mode === 'fullscan' && p.scanData?.mockName
        ? p.scanData.mockName
        : p.mode === 'fullscan'
          ? 'StudyBridge Full Mock Scan'
          : '';

  if (!rawText.trim()) {
    return { isValid: false, error: 'Import payload text is empty.' };
  }

  // Enforce reasonable payload size limit (500 KB) to prevent DoS
  if (rawText.length > 500_000) {
    return { isValid: false, error: 'Payload exceeds maximum allowed size (500 KB).' };
  }

  if (!p.source || typeof p.source !== 'object') {
    return { isValid: false, error: 'Missing source metadata.' };
  }

  const source: StudyBridgeSourceMetadata = {
    platform: typeof p.source.platform === 'string' ? p.source.platform.slice(0, 100) : 'Testbook',
    url: typeof p.source.url === 'string' ? p.source.url.slice(0, 2048) : '',
    title: typeof p.source.title === 'string' ? p.source.title.slice(0, 500) : 'Testbook Analysis'
  };

  const capturedAt = typeof p.capturedAt === 'string' ? p.capturedAt : new Date().toISOString();
  const mode: StudyBridgeMode =
    p.mode === 'summary' || p.mode === 'question' || p.mode === 'selection' || p.mode === 'fullscan'
      ? p.mode
      : 'selection';

  if (mode === 'fullscan') {
    if (!p.scanData || typeof p.scanData !== 'object') {
      return { isValid: false, error: 'Full scan payload is missing scanData.' };
    }
    const sd = p.scanData as Partial<FullMockScanResult>;
    if (typeof sd.totalQuestions !== 'number' || isNaN(sd.totalQuestions) || sd.totalQuestions < 0) {
      return { isValid: false, error: 'scanData must include a valid non-negative totalQuestions count.' };
    }
    if (!Array.isArray(sd.sections)) {
      return { isValid: false, error: 'scanData must include a sections array.' };
    }
    if (!Array.isArray(sd.questions)) {
      return { isValid: false, error: 'scanData must include a questions array.' };
    }
  }

  return {
    isValid: true,
    payload: {
      id: p.id,
      mode,
      text: rawText,
      source,
      capturedAt,
      summaryData: p.summaryData,
      questionData: p.questionData,
      scanData: p.scanData
    }
  };
}

/**
 * Parses time expressions such as "18m 20s", "18 min", "18:20", "120s" into minutes and total seconds.
 */
export function parseTimeString(str: string): { minutes: number; seconds: number } {
  // Format: 18m 20s or 18 min 20 sec
  const mAndS = str.match(/(\d+)\s*(?:m|min|mins|minutes)\s*(\d+)?\s*(?:s|sec|secs|seconds)?/i);
  if (mAndS && (mAndS[2] || /m|min/i.test(str))) {
    const mins = parseInt(mAndS[1], 10);
    const secs = mAndS[2] ? parseInt(mAndS[2], 10) : 0;
    return { minutes: mins, seconds: mins * 60 + secs };
  }

  // Format: Xs or X seconds only
  const secMatch = str.match(/(\d+)\s*(?:s|sec|secs|seconds)\b/i);
  if (secMatch) {
    const totalSec = parseInt(secMatch[1], 10);
    return { minutes: Math.round(totalSec / 60), seconds: totalSec };
  }

  // Format: MM:SS
  const colonMatch = str.match(/(\d+):(\d{2})/);
  if (colonMatch) {
    const mins = parseInt(colonMatch[1], 10);
    const secs = parseInt(colonMatch[2], 10);
    return { minutes: mins, seconds: mins * 60 + secs };
  }

  // Plain number of minutes
  const plainMin = str.match(/(\d+)/);
  if (plainMin) {
    const mins = parseInt(plainMin[1], 10);
    return { minutes: mins, seconds: mins * 60 };
  }

  return { minutes: 0, seconds: 0 };
}

export function parseTestbookPastedText(rawText: string, settings: ExamSettings): ParsedPasteResult {
  const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const todayStr = getTodayDateStr();
  const uncertainFields: string[] = [];

  // Determine if this is a single Question / Mistake review or a Mock scorecard
  const isQuestionReview =
    /(?:question|q\.?)\s*(?:#|no\.?)?\s*\d+/i.test(rawText) &&
    /(?:your\s+answer|selected\s+answer|my\s+answer|correct\s+answer|right\s+answer|explanation|solution)/i.test(
      rawText
    );

  if (isQuestionReview) {
    // -------------------------------------------------------------
    // Parse Single Question / Mistake
    // -------------------------------------------------------------
    let qNo = 1;
    const qNoMatch = rawText.match(/(?:question|q\.?)\s*(?:#|no\.?)?\s*(\d+)/i);
    if (qNoMatch) {
      qNo = parseInt(qNoMatch[1], 10);
    } else {
      uncertainFields.push('questionNumber');
    }

    // Section detection
    let detectedSec = settings.sections[0] || { id: 'quant', name: 'Quantitative Aptitude' };
    for (const sec of settings.sections) {
      const kw = [sec.id.toLowerCase(), sec.name.toLowerCase(), sec.name.split(' ')[0].toLowerCase()];
      if (kw.some((k) => rawText.toLowerCase().includes(k))) {
        detectedSec = sec;
        break;
      }
    }

    // Topic detection
    let topic = 'General';
    const topicMatch = rawText.match(/Topic[:\s\-]+([^\n\r]+)/i);
    if (topicMatch) {
      topic = topicMatch[1].trim();
    } else {
      // Check if known topic in section
      const lower = rawText.toLowerCase();
      const matched = detectedSec.topics?.find((t) => lower.includes(t.toLowerCase()));
      if (matched) {
        topic = matched;
      } else {
        topic = detectedSec.name.split(' ')[0] || 'General';
        uncertainFields.push('topic');
      }
    }

    // Question Text: extract text before options / answers
    let questionText = '';
    const qTextMatch = rawText.match(
      /(?:question|q\.\s*\d+)?[:\s\d.]*([\s\S]+?)(?=(?:(?:your|selected|my)\s*answer|correct\s*answer|options?|[a-e]\)|\([a-e]\)|time\s*(?:spent|taken)|solution|explanation|$))/i
    );
    if (qTextMatch && qTextMatch[1].trim().length > 10) {
      // Strip out "Question 14" header if included
      questionText = qTextMatch[1].replace(/^(?:question\s*\d+[:\-.]?)\s*/i, '').trim();
    } else {
      questionText = lines[0] || 'Question statement';
      uncertainFields.push('questionText');
    }

    // My Answer
    let myAnswer = '';
    const myAnsMatch = rawText.match(/(?:your|selected|my)\s*answer[:\s]+([^\n\r]+)/i);
    if (myAnsMatch) {
      myAnswer = myAnsMatch[1].trim();
    } else {
      uncertainFields.push('myAnswer');
    }

    // Correct Answer
    let correctAnswer = '';
    const corrAnsMatch = rawText.match(/(?:correct|right)\s*answer[:\s]+([^\n\r]+)/i);
    if (corrAnsMatch) {
      correctAnswer = corrAnsMatch[1].trim();
    } else {
      uncertainFields.push('correctAnswer');
    }

    // Result Type (Wrong / Left unattempted / Correct-but-slow)
    let resultType: ResultType = 'Wrong';
    if (/unattempted|left\s*unattempted|not\s*attempted/i.test(rawText)) {
      resultType = 'Left unattempted';
    } else if (/\(correct\)|result[:\s]+correct/i.test(rawText) && !/incorrect/i.test(rawText)) {
      resultType = 'Correct-but-slow';
    } else {
      resultType = 'Wrong';
    }

    // Time Spent & Ideal Time
    let timeSpentSeconds = 60;
    const timeMatch = rawText.match(/(?:time\s*(?:spent|taken|spent on this question)|\btime)\s*:\s*([^\n\r]+)/i);
    if (timeMatch) {
      timeSpentSeconds = parseTimeString(timeMatch[1]).seconds || 60;
    } else {
      uncertainFields.push('timeSpentSeconds');
    }

    let idealTimeSeconds = 35;
    const idealMatch = rawText.match(/(?:ideal|avg|topper)\s*time[:\s]+([^\n\r]+)/i);
    if (idealMatch) {
      idealTimeSeconds = parseTimeString(idealMatch[1]).seconds || 35;
    }

    // Explanation / Solution
    let correctSolution = '';
    const solMatch = rawText.match(/(?:explanation|solution|detailed solution)[:\s]+([\s\S]+?)(?=(?:shortcut|better approach|rule|question|$))/i);
    if (solMatch) {
      correctSolution = solMatch[1].trim();
    } else {
      correctSolution = 'Refer to Testbook solution.';
      uncertainFields.push('correctSolution');
    }

    // Shortcut / Better Approach
    let betterApproach = '';
    const shortcutMatch = rawText.match(/(?:shortcut|better approach|smart method)[:\s]+([\s\S]+?)(?=(?:rule|question|$))/i);
    if (shortcutMatch) {
      betterApproach = shortcutMatch[1].trim();
    }

    // Rule to Remember
    let ruleToRemember = '';
    const ruleMatch = rawText.match(/(?:rule to remember|key rule|takeaway|concept)[:\s]+([^\n\r]+)/i);
    if (ruleMatch) {
      ruleToRemember = ruleMatch[1].trim();
    } else {
      ruleToRemember = `Review ${topic} concept and eliminate common calculation/formula mistakes.`;
      uncertainFields.push('ruleToRemember');
    }

    // Difficulty
    let difficulty: Difficulty = 'Medium';
    if (/easy/i.test(rawText)) difficulty = 'Easy';
    else if (/hard|difficult/i.test(rawText)) difficulty = 'Hard';

    const mistake: ParsedMistake = {
      mockName: 'Testbook Solution Review',
      sectionId: detectedSec.id,
      sectionName: detectedSec.name,
      topic,
      questionNumber: qNo,
      questionText,
      myAnswer,
      correctAnswer,
      resultType,
      errorTypes: ['Concept gap'],
      timeSpentSeconds,
      idealTimeSeconds,
      whatWentWrong: resultType === 'Wrong' ? 'Incorrect option selected in mock.' : 'Left unattempted due to time.',
      correctSolution,
      betterApproach,
      ruleToRemember,
      difficulty,
      uncertainFields
    };

    return {
      contentType: 'mistake',
      rawText,
      mockName: 'Testbook Solution Review',
      source: 'Testbook',
      date: todayStr,
      sections: [],
      mistake,
      uncertainFields,
      unparsedLines: []
    };
  }

  // -------------------------------------------------------------
  // Parse Mock Scorecard / Analysis Summary
  // -------------------------------------------------------------
  const result: ParsedPasteResult = {
    contentType: 'mock',
    rawText,
    mockName: 'Imported Testbook Mock',
    source: 'Testbook',
    date: todayStr,
    sections: settings.sections.map((s) => ({
      sectionName: s.name,
      sectionId: s.id,
      attempted: 0,
      correct: 0,
      wrong: 0,
      timeMinutes: s.timeLimitMinutes || 20
    })),
    uncertainFields,
    unparsedLines: []
  };

  // Exam Name detection
  for (const line of lines) {
    if (/(sbi|ibps|rbi|rrb|ssc|cat|gate)\s*(?:po|clerk|prelims|mains|cgl)?/i.test(line)) {
      result.examName = line.slice(0, 80);
      break;
    }
  }

  // Mock title detection
  for (const line of lines) {
    if (/(mock|prelims|mains|test|live mock|full test)/i.test(line) && line.length < 80) {
      result.mockName = line;
      break;
    }
  }
  if (result.mockName === 'Imported Testbook Mock') {
    uncertainFields.push('mockName');
  }

  // Overall Score and Maximum Marks (prefer Total Score / Overall Score over section-level score)
  const totalScoreMatch = rawText.match(/(?:total\s+score|overall\s+score)[:\s]+([0-9.]+)(?:\s*\/\s*([0-9.]+))?/i);
  const fallbackScoreMatch = rawText.match(/(?:your\s+score|score)[:\s]+([0-9.]+)(?:\s*\/\s*([0-9.]+))?/i);
  const scoreMatch = totalScoreMatch || fallbackScoreMatch;
  if (scoreMatch) {
    result.overallScore = parseFloat(scoreMatch[1]);
    if (scoreMatch[2]) {
      result.maxMarks = parseFloat(scoreMatch[2]);
    }
  }

  const maxMarksMatch = rawText.match(/(?:maximum\s*marks|max\s*marks)[:\s]+([0-9.]+)/i);
  if (maxMarksMatch && !result.maxMarks) {
    result.maxMarks = parseFloat(maxMarksMatch[1]);
  }

  // Percentage & Accuracy
  const pctMatch = rawText.match(/(?:percentage)[:\s]+([0-9.]+)\s*%?/i);
  if (pctMatch) {
    result.overallPercentage = parseFloat(pctMatch[1]);
  }

  const accMatch = rawText.match(/(?:accuracy|overall\s*accuracy)[:\s]+([0-9.]+)\s*%?/i);
  if (accMatch) {
    result.overallAccuracy = parseFloat(accMatch[1]);
  }

  // Rank & Percentile
  const rankMatch = rawText.match(/Rank[:\s#]+([0-9,]+)/i);
  if (rankMatch) {
    result.overallRank = parseInt(rankMatch[1].replace(/,/g, ''), 10);
  } else {
    uncertainFields.push('overallRank');
  }

  const percentileMatch = rawText.match(/Percentile[:\s]+([0-9.]+)\s*%?/i);
  if (percentileMatch) {
    result.overallPercentile = parseFloat(percentileMatch[1]);
  } else {
    uncertainFields.push('overallPercentile');
  }

  // Overall totals if explicitly listed
  const totalAttMatch = rawText.match(/(?:total\s+attempted|overall\s+attempted)[:\s]+(\d+)/i);
  if (totalAttMatch) result.totalAttempted = parseInt(totalAttMatch[1], 10);

  const totalCorrMatch = rawText.match(/(?:total\s+correct|overall\s+correct)[:\s]+(\d+)/i);
  if (totalCorrMatch) result.totalCorrect = parseInt(totalCorrMatch[1], 10);

  const totalWrongMatch = rawText.match(/(?:total\s+incorrect|total\s+wrong|overall\s+incorrect)[:\s]+(\d+)/i);
  if (totalWrongMatch) result.totalWrong = parseInt(totalWrongMatch[1], 10);

  const totalUnattMatch = rawText.match(/(?:total\s+unattempted|overall\s+unattempted)[:\s]+(\d+)/i);
  if (totalUnattMatch) result.totalUnattempted = parseInt(totalUnattMatch[1], 10);

  const totalTimeMatch = rawText.match(/(?:total\s+time|time\s+spent|duration)[:\s]+([^\n\r]+)/i);
  if (totalTimeMatch) {
    result.totalTimeSpentMinutes = parseTimeString(totalTimeMatch[1]).minutes;
  }

  // Parse Sectional Performance
  for (const sec of result.sections) {
    const secKeywords = [
      sec.sectionId,
      sec.sectionName.toLowerCase(),
      sec.sectionName.split(' ')[0].toLowerCase()
    ];

    let foundIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      const lineLower = lines[i].toLowerCase();
      if (secKeywords.some((k) => lineLower.includes(k))) {
        foundIndex = i;
        break;
      }
    }

    if (foundIndex !== -1) {
      // Look at the window of up to 10 lines around section header
      const windowLines = lines.slice(foundIndex, foundIndex + 10).join(' ');
      sec.rawTextFound = windowLines.slice(0, 120);

      // Match Attempted
      const attM = windowLines.match(/(?:attempted|attempts|total attempted)[:\s]+(\d+)/i);
      if (attM) sec.attempted = parseInt(attM[1], 10);

      // Match Correct
      const corrM = windowLines.match(/(?:correct|right)[:\s]+(\d+)/i);
      if (corrM) sec.correct = parseInt(corrM[1], 10);

      // Match Wrong / Incorrect
      const wrongM = windowLines.match(/(?:incorrect|wrong|negative)[:\s]+(\d+)/i);
      if (wrongM) sec.wrong = parseInt(wrongM[1], 10);
      else if (sec.attempted >= sec.correct && sec.correct > 0) {
        sec.wrong = sec.attempted - sec.correct;
      }

      // Match Unattempted
      const unattM = windowLines.match(/(?:unattempted|left)[:\s]+(\d+)/i);
      if (unattM) sec.unattempted = parseInt(unattM[1], 10);

      // Match Sectional Score
      const secScoreM = windowLines.match(/(?:score|marks)[:\s]+([0-9.]+)/i);
      if (secScoreM) sec.score = parseFloat(secScoreM[1]);

      // Match Sectional Time
      const timeM = windowLines.match(/(?:time|spent|duration)[:\s]+([^\s,;]+(?:\s*[^\s,;]+)?)/i);
      if (timeM) {
        const parsedTime = parseTimeString(timeM[1]);
        if (parsedTime.minutes > 0 || parsedTime.seconds > 0) {
          sec.timeMinutes = parsedTime.minutes;
        }
      }

      // Check uncertainty
      if (sec.attempted === 0 && sec.correct === 0 && sec.wrong === 0) {
        sec.isUncertain = true;
        uncertainFields.push(`${sec.sectionId}_performance`);
      } else if (sec.attempted < sec.correct + sec.wrong) {
        sec.isUncertain = true;
        uncertainFields.push(`${sec.sectionId}_math_mismatch`);
      }
    } else {
      sec.isUncertain = true;
      uncertainFields.push(`${sec.sectionId}_missing`);
    }
  }

  return result;
}

export interface MockCsvParseResult {
  records: Array<Omit<MockTest, 'id'>>;
  errors: string[];
}

export interface MistakeCsvParseResult {
  records: Array<Omit<MistakeEntry, 'id'>>;
  errors: string[];
}

function normalizeHeader(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function findColumn(headers: string[], candidates: string[]): number {
  const normalized = headers.map(normalizeHeader);
  for (const candidate of candidates) {
    const index = normalized.indexOf(normalizeHeader(candidate));
    if (index !== -1) return index;
  }
  return -1;
}

function numberAt(row: string[], index: number, fallback = 0): number {
  if (index < 0) return fallback;
  const parsed = Number.parseInt(row[index] ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Parses the mock CSV template into complete mock records using the current exam settings.
 * Section totals and negative marking come from settings, never from a hardcoded 100/0.25 layout.
 */
export function parseMockCsv(text: string, settings: ExamSettings): MockCsvParseResult {
  const rows = parseCsvRows(text);
  const errors: string[] = [];
  const records: Array<Omit<MockTest, 'id'>> = [];

  if (rows.length < 2) {
    return { records, errors: ['CSV file must have a header row and at least 1 data row.'] };
  }

  const headers = rows[0];
  const nameIndex = findColumn(headers, ['Mock Name', 'Name']);
  const dateIndex = findColumn(headers, ['Date (YYYY-MM-DD)', 'Date']);
  const sourceIndex = findColumn(headers, ['Source', 'Platform']);
  const typeIndex = findColumn(headers, ['Type (mock/pyq/memory-based)', 'Type']);
  const rankIndex = findColumn(headers, ['Rank']);
  const percentileIndex = findColumn(headers, ['Percentile']);

  for (let rowIndex = 1; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex];
    if (row.every((cell) => !cell.trim())) continue;

    const name = (nameIndex >= 0 ? row[nameIndex] : '') || `Mock Test ${rowIndex}`;
    const date = (dateIndex >= 0 ? row[dateIndex] : '') || getTodayDateStr();
    const source = (sourceIndex >= 0 ? row[sourceIndex] : '') || 'CSV Import';
    const rawType = (typeIndex >= 0 ? row[typeIndex] : '').toLowerCase();
    const attemptType = (['mock', 'pyq', 'memory-based'].includes(rawType) ? rawType : 'mock') as MockTest['attemptType'];

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      errors.push(`Row ${rowIndex + 1}: Invalid date "${date}". Use YYYY-MM-DD.`);
    }

    let totalAttempted = 0;
    let totalCorrect = 0;
    let totalWrong = 0;
    let totalUnattempted = 0;
    let totalNetScore = 0;
    let totalTimeSpentSeconds = 0;

    const sections: SectionPerformance[] = settings.sections.map((section) => {
      const attemptedIndex = findColumn(headers, [
        `${section.name} Attempted`,
        `${section.id} Attempted`,
        'Quant Attempted'
      ]);
      const correctIndex = findColumn(headers, [
        `${section.name} Correct`,
        `${section.id} Correct`,
        'Quant Correct'
      ]);
      const wrongIndex = findColumn(headers, [
        `${section.name} Wrong`,
        `${section.id} Wrong`,
        'Quant Wrong'
      ]);
      const timeIndex = findColumn(headers, [
        `${section.name} Time (min)`,
        `${section.id} Time (min)`,
        'Quant Time (min)'
      ]);

      const attempted = numberAt(row, attemptedIndex);
      const correct = numberAt(row, correctIndex);
      const wrong = numberAt(row, wrongIndex);
      const timeMinutes = numberAt(row, timeIndex, section.timeLimitMinutes || 0);
      const unattempted = Math.max(0, section.totalQuestions - attempted);
      const netScore = Number((correct * section.marksPerCorrect - wrong * section.negativeMark).toFixed(2));
      const accuracy = attempted > 0 ? Number(((correct / attempted) * 100).toFixed(1)) : 0;
      const marksLostNegative = Number((wrong * section.negativeMark).toFixed(2));

      totalAttempted += attempted;
      totalCorrect += correct;
      totalWrong += wrong;
      totalUnattempted += unattempted;
      totalNetScore += netScore;
      totalTimeSpentSeconds += timeMinutes * 60;

      return {
        sectionId: section.id,
        sectionName: section.name,
        attempted,
        correct,
        wrong,
        timeSpentSeconds: timeMinutes * 60,
        unattempted,
        netScore,
        accuracy,
        marksLostNegative
      };
    });

    records.push({
      name,
      date,
      source,
      attemptType,
      overallRank: rankIndex >= 0 && row[rankIndex] ? Number(row[rankIndex]) : undefined,
      overallPercentile: percentileIndex >= 0 && row[percentileIndex] ? Number(row[percentileIndex]) : undefined,
      sections,
      totalAttempted,
      totalCorrect,
      totalWrong,
      totalUnattempted,
      totalNetScore: Number(totalNetScore.toFixed(2)),
      overallAccuracy: totalAttempted > 0 ? Number(((totalCorrect / totalAttempted) * 100).toFixed(1)) : 0,
      totalMarksLostNegative: Number(sections.reduce((sum, section) => sum + section.marksLostNegative, 0).toFixed(2)),
      totalTimeSpentSeconds,
      notes: 'Imported from CSV'
    });
  }

  return { records, errors };
}

/**
 * Parses the mistake CSV template into validated mistake records. CSV mistakes are
 * unlinked by default; no fake mock id is invented.
 */
export function parseMistakeCsv(text: string): MistakeCsvParseResult {
  const rows = parseCsvRows(text);
  const errors: string[] = [];
  const records: Array<Omit<MistakeEntry, 'id'>> = [];
  const todayStr = getTodayDateStr();

  if (rows.length < 2) {
    return { records, errors: ['CSV file must contain a header and at least 1 mistake entry.'] };
  }

  const headers = rows[0];
  for (let rowIndex = 1; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex];
    if (row.every((cell) => !cell.trim())) continue;

    const mockName = (findColumn(headers, ['Mock Name']) >= 0 ? row[findColumn(headers, ['Mock Name'])] : '') || 'External / unlinked';
    const sectionName = (findColumn(headers, ['Section (Quant/Reasoning/English)', 'Section']) >= 0
      ? row[findColumn(headers, ['Section (Quant/Reasoning/English)', 'Section'])]
      : '') || 'Quant';
    const sectionId = sectionName.toLowerCase().includes('reason')
      ? 'reasoning'
      : sectionName.toLowerCase().includes('eng')
        ? 'english'
        : 'quant';
    const topicIndex = findColumn(headers, ['Topic']);
    const subtopicIndex = findColumn(headers, ['Subtopic']);
    const qNoIndex = findColumn(headers, ['Question Number', 'Q No']);
    const qTextIndex = findColumn(headers, ['Question Text']);
    const myAnswerIndex = findColumn(headers, ['My Answer']);
    const correctAnswerIndex = findColumn(headers, ['Correct Answer']);
    const resultIndex = findColumn(headers, ['Result Type (Wrong/Left unattempted/Correct-but-slow)', 'Result Type']);
    const errorIndex = findColumn(headers, ['Error Types (semicolon separated)', 'Error Types']);
    const timeIndex = findColumn(headers, ['Time Spent (sec)']);
    const idealIndex = findColumn(headers, ['Ideal Time (sec)']);
    const whatWrongIndex = findColumn(headers, ['What Went Wrong']);
    const solutionIndex = findColumn(headers, ['Correct Solution']);
    const approachIndex = findColumn(headers, ['Better Approach / Shortcut', 'Better Approach']);
    const ruleIndex = findColumn(headers, ['Rule to Remember']);
    const difficultyIndex = findColumn(headers, ['Difficulty (Easy/Medium/Hard)', 'Difficulty']);

    const rawResult = (resultIndex >= 0 ? row[resultIndex] : '') as string;
    const resultType = (['Wrong', 'Left unattempted', 'Correct-but-slow'].includes(rawResult)
      ? rawResult
      : 'Wrong') as ResultType;
    const rawDifficulty = (difficultyIndex >= 0 ? row[difficultyIndex] : '') as string;
    const difficulty = (['Easy', 'Medium', 'Hard'].includes(rawDifficulty) ? rawDifficulty : 'Medium') as Difficulty;
    const errorTypes = errorIndex >= 0 && row[errorIndex]
      ? row[errorIndex].split(';').map((entry) => entry.trim()).filter(Boolean)
      : ['Concept gap'];

    const rawQText = (qTextIndex >= 0 ? row[qTextIndex] : '') || 'Question not transcribed.';
    let cleanQText = rawQText;
    let isNeedsReview = false;
    let reviewReason: string | undefined;

    const optIdx = rawQText.search(/\n\s*Options:\s*\n/i);
    if (optIdx !== -1) {
      const prompt = rawQText.slice(0, optIdx).trim();
      const optLines = rawQText.slice(optIdx).replace(/\n\s*Options:\s*\n/i, '').split('\n').map((l) => l.trim()).filter(Boolean);
      const norm = normalizeOptions(optLines);
      isNeedsReview = norm.needsReview;
      reviewReason = norm.reason;
      cleanQText = `${prompt}\n\nOptions:\n${norm.options.map((t, idx) => `${String.fromCharCode(65 + idx)}. ${t}`).join('\n')}`;
    }

    records.push({
      mockName,
      sectionId,
      sectionName,
      topic: (topicIndex >= 0 ? row[topicIndex] : '') || 'General',
      subtopic: (subtopicIndex >= 0 ? row[subtopicIndex] : '') || undefined,
      questionNumber: numberAt(row, qNoIndex, rowIndex),
      questionText: cleanQText,
      myAnswer: (myAnswerIndex >= 0 ? row[myAnswerIndex] : '') || 'N/A',
      correctAnswer: (correctAnswerIndex >= 0 ? row[correctAnswerIndex] : '') || 'N/A',
      resultType,
      errorTypes,
      timeSpentSeconds: numberAt(row, timeIndex, 60),
      idealTimeSeconds: numberAt(row, idealIndex, 35),
      whatWentWrong: (whatWrongIndex >= 0 ? row[whatWrongIndex] : '') || 'Imported mistake.',
      correctSolution: (solutionIndex >= 0 ? row[solutionIndex] : '') || 'Refer to standard solution.',
      betterApproach: (approachIndex >= 0 ? row[approachIndex] : '') || 'Review core approach.',
      ruleToRemember: (ruleIndex >= 0 ? row[ruleIndex] : '') || 'Review this concept.',
      difficulty,
      tags: ['csv-import'],
      status: isNeedsReview ? 'inbox' : 'New',
      needsReview: isNeedsReview,
      reviewReason,
      interval: 1,
      consecutiveCorrect: 0,
      nextReviewDate: todayStr,
      history: [],
      createdAt: todayStr
    });
  }

  return { records, errors };
}

/**
 * CSV Line Parser supporting quoted commas.
 */
export function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  const lines = text.split(/\r?\n/);

  for (const line of lines) {
    if (!line.trim()) continue;
    const row: string[] = [];
    let insideQuote = false;
    let entry = '';

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (insideQuote && line[i + 1] === '"') {
          entry += '"';
          i++;
        } else {
          insideQuote = !insideQuote;
        }
      } else if (char === ',' && !insideQuote) {
        row.push(entry.trim());
        entry = '';
      } else {
        entry += char;
      }
    }
    row.push(entry.trim());
    rows.push(row);
  }

  return rows;
}

