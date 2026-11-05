import { QuestionType, QuestionTypeMarkingRule } from '../types';

export interface ScoreQuestionInput {
  questionType: QuestionType;
  marks: number;
  negativeMarks?: number;
  userAnswer?: string | string[] | number | null;
  correctAnswer: string | string[] | number | { min: number; max: number };
  natTolerance?: number;
  allowPartialCredit?: boolean;
}

export interface ScoreQuestionResult {
  isAttempted: boolean;
  isCorrect: boolean;
  isPartiallyCorrect: boolean;
  marksAwarded: number;
  negativeDeducted: number;
  netScore: number;
  status: 'correct' | 'wrong' | 'unattempted' | 'partial';
  explanation: string;
}

/**
 * Standard GATE / Competitive exam negative marking rules per question type.
 */
export function getDefaultNegativeMarks(questionType: QuestionType, marks: number): number {
  switch (questionType) {
    case 'MCQ':
      // GATE standard: 1-mark MCQ has -1/3 penalty; 2-mark MCQ has -2/3 penalty
      return Number((marks / 3).toFixed(4));
    case 'MSQ':
    case 'NAT':
    case 'descriptive':
      // 0 negative marks for MSQ, NAT, and Descriptive in GATE and standard technical exams
      return 0;
    default:
      return 0;
  }
}

/**
 * Computes break-even accuracy for a given question type and marking scheme:
 * Break-even accuracy = negativeMarks / (marks + negativeMarks)
 */
export function calculateQuestionBreakEvenAccuracy(
  questionType: QuestionType,
  marks: number,
  customNegativeMarks?: number
): number {
  const negative = customNegativeMarks !== undefined
    ? customNegativeMarks
    : getDefaultNegativeMarks(questionType, marks);

  if (negative <= 0) return 0;
  const denominator = marks + negative;
  if (denominator <= 0) return 0;
  return Number(((negative / denominator) * 100).toFixed(2));
}

/**
 * Normalizes option strings into a sorted array of uppercase keys (e.g. ['A', 'C'])
 */
export function normalizeOptions(val: string | string[] | number | null | undefined): string[] {
  if (val === null || val === undefined) return [];
  if (Array.isArray(val)) {
    return Array.from(new Set(val.map((s) => String(s).trim().toUpperCase()).filter(Boolean))).sort();
  }
  const str = String(val).trim();
  if (!str) return [];
  // Handle comma or space separated options like "A, C" or "A C"
  if (str.includes(',')) {
    return Array.from(new Set(str.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean))).sort();
  }
  return [str.toUpperCase()];
}

/**
 * Evaluates and scores an individual question attempt based on its question type.
 * - MCQ: 1 or 2 marks with -1/3 or -2/3 penalty (or custom negative).
 * - MSQ: 1 or 2 marks with 0 negative and NO partial credit.
 * - NAT: 1 or 2 marks with 0 negative and tolerance check.
 * - Descriptive: awarded marks with 0 negative.
 */
export function scoreQuestion(input: ScoreQuestionInput): ScoreQuestionResult {
  const {
    questionType,
    marks,
    correctAnswer,
    natTolerance = 0,
    allowPartialCredit = false
  } = input;

  const negativeMarks = input.negativeMarks !== undefined
    ? input.negativeMarks
    : getDefaultNegativeMarks(questionType, marks);

  // 1. Check if attempted
  const isAttempted = input.userAnswer !== null &&
    input.userAnswer !== undefined &&
    input.userAnswer !== '' &&
    !(Array.isArray(input.userAnswer) && input.userAnswer.length === 0);

  if (!isAttempted) {
    return {
      isAttempted: false,
      isCorrect: false,
      isPartiallyCorrect: false,
      marksAwarded: 0,
      negativeDeducted: 0,
      netScore: 0,
      status: 'unattempted',
      explanation: 'Unattempted (0 marks)'
    };
  }

  // 2. Score based on question type
  switch (questionType) {
    case 'MCQ': {
      const userNorm = normalizeOptions(input.userAnswer)[0] || '';
      const correctNorm = normalizeOptions(
        typeof correctAnswer === 'object' && !Array.isArray(correctAnswer)
          ? ''
          : correctAnswer
      )[0] || '';

      const isMatch = userNorm === correctNorm;
      if (isMatch) {
        return {
          isAttempted: true,
          isCorrect: true,
          isPartiallyCorrect: false,
          marksAwarded: marks,
          negativeDeducted: 0,
          netScore: marks,
          status: 'correct',
          explanation: `Correct MCQ (+${marks} marks)`
        };
      } else {
        const roundedNeg = Number(negativeMarks.toFixed(4));
        return {
          isAttempted: true,
          isCorrect: false,
          isPartiallyCorrect: false,
          marksAwarded: 0,
          negativeDeducted: roundedNeg,
          netScore: -roundedNeg,
          status: 'wrong',
          explanation: `Incorrect MCQ (-${roundedNeg} marks penalty. Correct: ${correctNorm}, Selected: ${userNorm})`
        };
      }
    }

    case 'MSQ': {
      // MSQ: 0 negative marks and NO partial credit!
      const userOptions = normalizeOptions(input.userAnswer);
      const correctOptions = normalizeOptions(
        typeof correctAnswer === 'object' && !Array.isArray(correctAnswer)
          ? ''
          : correctAnswer
      );

      const isExactMatch =
        userOptions.length === correctOptions.length &&
        userOptions.every((opt, idx) => opt === correctOptions[idx]);

      if (isExactMatch) {
        return {
          isAttempted: true,
          isCorrect: true,
          isPartiallyCorrect: false,
          marksAwarded: marks,
          negativeDeducted: 0,
          netScore: marks,
          status: 'correct',
          explanation: `Correct MSQ: All correct options selected (+${marks} marks)`
        };
      }

      // If allowPartialCredit is explicitly true (for non-GATE custom exams)
      if (allowPartialCredit && userOptions.length > 0) {
        const hasWrongOption = userOptions.some((opt) => !correctOptions.includes(opt));
        if (!hasWrongOption) {
          const partialRatio = userOptions.length / correctOptions.length;
          const partialMarks = Number((marks * partialRatio).toFixed(2));
          return {
            isAttempted: true,
            isCorrect: false,
            isPartiallyCorrect: true,
            marksAwarded: partialMarks,
            negativeDeducted: 0,
            netScore: partialMarks,
            status: 'partial',
            explanation: `Partial credit awarded: ${userOptions.length}/${correctOptions.length} options (+${partialMarks} marks)`
          };
        }
      }

      // Standard MSQ: No partial credit, 0 negative marking
      return {
        isAttempted: true,
        isCorrect: false,
        isPartiallyCorrect: false,
        marksAwarded: 0,
        negativeDeducted: 0,
        netScore: 0,
        status: 'wrong',
        explanation: `Incorrect MSQ: No partial credit. Expected [${correctOptions.join(', ')}], Selected [${userOptions.join(', ')}] (0 marks)`
      };
    }

    case 'NAT': {
      // Numerical Answer Type: candidate answer tested against range or single value with tolerance. 0 negative.
      const rawUserStr = String(input.userAnswer).trim();
      const userVal = Number(rawUserStr);

      if (isNaN(userVal)) {
        return {
          isAttempted: true,
          isCorrect: false,
          isPartiallyCorrect: false,
          marksAwarded: 0,
          negativeDeducted: 0,
          netScore: 0,
          status: 'wrong',
          explanation: `Invalid numerical input "${rawUserStr}" (0 marks)`
        };
      }

      let isWithinTolerance = false;
      let targetDesc = '';

      if (
        typeof correctAnswer === 'object' &&
        correctAnswer !== null &&
        'min' in correctAnswer &&
        'max' in correctAnswer
      ) {
        // Range check [min, max]
        const min = (correctAnswer as { min: number; max: number }).min;
        const max = (correctAnswer as { min: number; max: number }).max;
        isWithinTolerance = userVal >= min - 1e-9 && userVal <= max + 1e-9;
        targetDesc = `[${min} to ${max}]`;
      } else {
        // Single value with optional tolerance
        const targetNum = Number(correctAnswer);
        const tol = Math.max(0, natTolerance);
        isWithinTolerance = Math.abs(userVal - targetNum) <= tol + 1e-9;
        targetDesc = tol > 0 ? `${targetNum} ± ${tol}` : `${targetNum}`;
      }

      if (isWithinTolerance) {
        return {
          isAttempted: true,
          isCorrect: true,
          isPartiallyCorrect: false,
          marksAwarded: marks,
          negativeDeducted: 0,
          netScore: marks,
          status: 'correct',
          explanation: `Correct NAT answer ${userVal} within ${targetDesc} (+${marks} marks)`
        };
      } else {
        return {
          isAttempted: true,
          isCorrect: false,
          isPartiallyCorrect: false,
          marksAwarded: 0,
          negativeDeducted: 0,
          netScore: 0,
          status: 'wrong',
          explanation: `Incorrect NAT answer: ${userVal} is outside expected ${targetDesc} (0 marks)`
        };
      }
    }

    case 'descriptive': {
      // Descriptive question: negative marking is 0
      const awarded = typeof input.userAnswer === 'number'
        ? Math.min(marks, Math.max(0, input.userAnswer))
        : marks; // If non-numeric, assume evaluated to marks or full if correct
      return {
        isAttempted: true,
        isCorrect: awarded === marks,
        isPartiallyCorrect: awarded > 0 && awarded < marks,
        marksAwarded: awarded,
        negativeDeducted: 0,
        netScore: awarded,
        status: awarded === marks ? 'correct' : awarded > 0 ? 'partial' : 'wrong',
        explanation: `Descriptive answer: ${awarded}/${marks} marks`
      };
    }

    default:
      return {
        isAttempted: true,
        isCorrect: false,
        isPartiallyCorrect: false,
        marksAwarded: 0,
        negativeDeducted: 0,
        netScore: 0,
        status: 'wrong',
        explanation: 'Unknown question type'
      };
  }
}

/**
 * Batch score a set of question attempts and compute total summary.
 */
export function scoreExamAttempt(
  questions: ScoreQuestionInput[]
): {
  totalQuestions: number;
  totalAttempted: number;
  totalCorrect: number;
  totalWrong: number;
  totalUnattempted: number;
  totalMarksAwarded: number;
  totalNegativeDeducted: number;
  totalNetScore: number;
  accuracyPercent: number;
  results: ScoreQuestionResult[];
} {
  const results = questions.map((q) => scoreQuestion(q));

  let totalAttempted = 0;
  let totalCorrect = 0;
  let totalWrong = 0;
  let totalUnattempted = 0;
  let totalMarksAwarded = 0;
  let totalNegativeDeducted = 0;
  let totalNetScore = 0;

  for (const r of results) {
    if (r.isAttempted) {
      totalAttempted++;
      if (r.isCorrect) totalCorrect++;
      else totalWrong++;
    } else {
      totalUnattempted++;
    }
    totalMarksAwarded += r.marksAwarded;
    totalNegativeDeducted += r.negativeDeducted;
    totalNetScore += r.netScore;
  }

  const accuracyPercent = totalAttempted > 0
    ? Number(((totalCorrect / totalAttempted) * 100).toFixed(2))
    : 0;

  return {
    totalQuestions: questions.length,
    totalAttempted,
    totalCorrect,
    totalWrong,
    totalUnattempted,
    totalMarksAwarded: Number(totalMarksAwarded.toFixed(2)),
    totalNegativeDeducted: Number(totalNegativeDeducted.toFixed(2)),
    totalNetScore: Number(totalNetScore.toFixed(2)),
    accuracyPercent,
    results
  };
}
