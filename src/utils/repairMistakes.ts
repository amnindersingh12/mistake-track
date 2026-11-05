import { MistakeEntry } from '../types';
import { normalizeOptions } from './normalizeOptions';

export interface RepairPreview {
  id?: number;
  mockName: string;
  questionNumber: number;
  before: {
    questionText: string;
    myAnswer: string;
    correctAnswer: string;
    optionsCount: number;
  };
  after: {
    questionText: string;
    myAnswer: string;
    correctAnswer: string;
    optionsCount: number;
  };
  needsReview: boolean;
  reason?: string;
}

export interface RepairPlan {
  totalScanned: number;
  affectedCount: number;
  previews: RepairPreview[];
  repairedRecords: MistakeEntry[];
}

const LABEL_PREFIX = /^\(?([A-Ea-e]|[1-5])[\).:\-]\s+/;

function cleanOptionText(line: string): string {
  return line
    .replace(LABEL_PREFIX, '')
    .replace(/\[(?:Correct|Selected)\]/gi, '')
    .trim();
}

/**
 * Plans repairs for existing mistakes in db.mistakes.
 * Pure function: does NOT perform writes. Safe and idempotent.
 */
export function planMistakeRepairs(mistakes: MistakeEntry[]): RepairPlan {
  const previews: RepairPreview[] = [];
  const repairedRecords: MistakeEntry[] = [];
  let affectedCount = 0;

  for (const m of mistakes) {
    const rawText = m.questionText || '';
    const optIdx = rawText.search(/\n\s*Options:\s*\n/i);

    if (optIdx === -1) {
      repairedRecords.push(m);
      continue;
    }

    const prompt = rawText.slice(0, optIdx).trim();
    const optBlock = rawText.slice(optIdx).replace(/\n\s*Options:\s*\n/i, '');
    const lines = optBlock.split('\n').map((l) => l.trim()).filter(Boolean);

    // Extract raw text and metadata per line
    const rawOptions = lines.map((l, index) => {
      const isCorrectFlag = /\[Correct\]/i.test(l);
      const isSelectedFlag = /\[Selected\]/i.test(l);
      const text = cleanOptionText(l);
      return {
        originalIndex: index,
        rawLine: l,
        text,
        isCorrectFlag,
        isSelectedFlag
      };
    });

    const norm = normalizeOptions(rawOptions.map((o) => o.text));
    const newOptionTexts = norm.options;

    // Determine correct and selected answers mapped to the clean option texts
    let mappedCorrect = '';
    let mappedSelected = '';

    const cleanPrevCorrect = cleanOptionText(m.correctAnswer || '').toLowerCase();
    const cleanPrevSelected = cleanOptionText(m.myAnswer || '').toLowerCase();

    for (let i = 0; i < newOptionTexts.length; i++) {
      const optText = newOptionTexts[i];
      const lower = optText.toLowerCase();
      const letter = String.fromCharCode(65 + i).toLowerCase();
      const numStr = String(i + 1);

      // Check if original matched line was flagged correct or matched text/letter
      const origMatch = rawOptions.find((ro) => ro.text.toLowerCase() === lower);
      const isCorr = Boolean(
        origMatch?.isCorrectFlag ||
        lower === cleanPrevCorrect ||
        cleanPrevCorrect === letter ||
        cleanPrevCorrect === `option ${letter}` ||
        cleanPrevCorrect === numStr ||
        cleanPrevCorrect === `option ${numStr}`
      );

      if (isCorr && !mappedCorrect) {
        mappedCorrect = optText;
      }

      // Check if original matched line was flagged selected or matched text/letter
      const isSel = Boolean(
        origMatch?.isSelectedFlag ||
        lower === cleanPrevSelected ||
        cleanPrevSelected === letter ||
        cleanPrevSelected === `option ${letter}` ||
        cleanPrevSelected === numStr ||
        cleanPrevSelected === `option ${numStr}`
      );

      if (isSel && !mappedSelected) {
        mappedSelected = optText;
      }
    }

    // Preserve special selected values like 'Left unattempted'
    if (!mappedSelected) {
      if (/unattempt|skipped|not marked/i.test(m.myAnswer || '')) {
        mappedSelected = m.myAnswer;
      } else {
        mappedSelected = m.myAnswer || 'Not marked';
      }
    }

    if (!mappedCorrect) {
      mappedCorrect = m.correctAnswer || 'See solution';
    }

    // Reconstruct formatted options block
    const formattedLines = newOptionTexts.map((optText, i) => {
      const isCorr = optText === mappedCorrect;
      const isSel = optText === mappedSelected;
      return `${String.fromCharCode(65 + i)}. ${optText}${isCorr ? ' [Correct]' : ''}${isSel ? ' [Selected]' : ''}`;
    });

    const newQuestionText = `${prompt}\n\nOptions:\n${formattedLines.join('\n')}`;

    // Check if anything actually changed
    const isChanged =
      newQuestionText !== m.questionText ||
      mappedCorrect !== m.correctAnswer ||
      mappedSelected !== m.myAnswer ||
      Boolean(m.needsReview) !== norm.needsReview;

    if (isChanged) {
      affectedCount++;
      const updated: MistakeEntry = {
        ...m,
        questionText: newQuestionText,
        correctAnswer: mappedCorrect,
        myAnswer: mappedSelected,
        needsReview: norm.needsReview,
        reviewReason: norm.reason,
        status: norm.needsReview ? 'inbox' : m.status
      };
      repairedRecords.push(updated);

      if (previews.length < 5) {
        previews.push({
          id: m.id,
          mockName: m.mockName,
          questionNumber: m.questionNumber,
          before: {
            questionText: m.questionText,
            myAnswer: m.myAnswer,
            correctAnswer: m.correctAnswer,
            optionsCount: lines.length
          },
          after: {
            questionText: newQuestionText,
            myAnswer: mappedSelected,
            correctAnswer: mappedCorrect,
            optionsCount: newOptionTexts.length
          },
          needsReview: norm.needsReview,
          reason: norm.reason
        });
      }
    } else {
      repairedRecords.push(m);
    }
  }

  return {
    totalScanned: mistakes.length,
    affectedCount,
    previews,
    repairedRecords
  };
}

