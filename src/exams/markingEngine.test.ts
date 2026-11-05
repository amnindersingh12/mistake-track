import { describe, it, expect } from 'vitest';
import {
  scoreQuestion,
  calculateQuestionBreakEvenAccuracy,
  getDefaultNegativeMarks,
  scoreExamAttempt,
  normalizeOptions
} from './markingEngine';

describe('markingEngine', () => {
  describe('MCQ Scoring', () => {
    it('scores 1-mark MCQ correctly with default -1/3 negative marking', () => {
      const correct = scoreQuestion({
        questionType: 'MCQ',
        marks: 1,
        userAnswer: 'B',
        correctAnswer: 'B'
      });
      expect(correct.isAttempted).toBe(true);
      expect(correct.isCorrect).toBe(true);
      expect(correct.marksAwarded).toBe(1);
      expect(correct.negativeDeducted).toBe(0);
      expect(correct.netScore).toBe(1);
      expect(correct.status).toBe('correct');

      const wrong = scoreQuestion({
        questionType: 'MCQ',
        marks: 1,
        userAnswer: 'A',
        correctAnswer: 'B'
      });
      expect(wrong.isAttempted).toBe(true);
      expect(wrong.isCorrect).toBe(false);
      expect(wrong.marksAwarded).toBe(0);
      expect(wrong.negativeDeducted).toBeCloseTo(0.3333, 3);
      expect(wrong.netScore).toBeCloseTo(-0.3333, 3);
      expect(wrong.status).toBe('wrong');
    });

    it('scores 2-mark MCQ correctly with default -2/3 negative marking', () => {
      const correct = scoreQuestion({
        questionType: 'MCQ',
        marks: 2,
        userAnswer: 'C',
        correctAnswer: 'C'
      });
      expect(correct.marksAwarded).toBe(2);
      expect(correct.negativeDeducted).toBe(0);
      expect(correct.netScore).toBe(2);

      const wrong = scoreQuestion({
        questionType: 'MCQ',
        marks: 2,
        userAnswer: 'D',
        correctAnswer: 'C'
      });
      expect(wrong.marksAwarded).toBe(0);
      expect(wrong.negativeDeducted).toBeCloseTo(0.6667, 3);
      expect(wrong.netScore).toBeCloseTo(-0.6667, 3);
    });

    it('handles custom negative marking (e.g. SEBI 0.25 penalty)', () => {
      const wrong = scoreQuestion({
        questionType: 'MCQ',
        marks: 1.25,
        negativeMarks: 0.3125,
        userAnswer: 'A',
        correctAnswer: 'C'
      });
      expect(wrong.marksAwarded).toBe(0);
      expect(wrong.negativeDeducted).toBe(0.3125);
      expect(wrong.netScore).toBe(-0.3125);
    });

    it('handles unattempted questions with 0 score', () => {
      const unattempted = scoreQuestion({
        questionType: 'MCQ',
        marks: 1,
        userAnswer: null,
        correctAnswer: 'A'
      });
      expect(unattempted.isAttempted).toBe(false);
      expect(unattempted.marksAwarded).toBe(0);
      expect(unattempted.negativeDeducted).toBe(0);
      expect(unattempted.netScore).toBe(0);
      expect(unattempted.status).toBe('unattempted');
    });
  });

  describe('MSQ Scoring (Zero Negative & NO Partial Credit)', () => {
    it('awards full marks when all correct options are selected and none incorrect', () => {
      const result = scoreQuestion({
        questionType: 'MSQ',
        marks: 2,
        userAnswer: ['A', 'C'],
        correctAnswer: ['A', 'C']
      });
      expect(result.isAttempted).toBe(true);
      expect(result.isCorrect).toBe(true);
      expect(result.marksAwarded).toBe(2);
      expect(result.negativeDeducted).toBe(0);
      expect(result.netScore).toBe(2);
      expect(result.status).toBe('correct');
    });

    it('awards 0 marks and 0 negative for partial selection (NO partial credit)', () => {
      const result = scoreQuestion({
        questionType: 'MSQ',
        marks: 2,
        userAnswer: ['A'], // Missing 'C'
        correctAnswer: ['A', 'C'],
        allowPartialCredit: false
      });
      expect(result.isAttempted).toBe(true);
      expect(result.isCorrect).toBe(false);
      expect(result.isPartiallyCorrect).toBe(false);
      expect(result.marksAwarded).toBe(0);
      expect(result.negativeDeducted).toBe(0);
      expect(result.netScore).toBe(0);
      expect(result.status).toBe('wrong');
    });

    it('awards 0 marks and 0 negative when an incorrect option is included', () => {
      const result = scoreQuestion({
        questionType: 'MSQ',
        marks: 1,
        userAnswer: ['A', 'B', 'C'], // 'B' is incorrect
        correctAnswer: ['A', 'C']
      });
      expect(result.isCorrect).toBe(false);
      expect(result.marksAwarded).toBe(0);
      expect(result.negativeDeducted).toBe(0);
      expect(result.netScore).toBe(0);
    });

    it('normalizes comma-separated string options for MSQ', () => {
      const result = scoreQuestion({
        questionType: 'MSQ',
        marks: 2,
        userAnswer: 'C, A',
        correctAnswer: ['A', 'C']
      });
      expect(result.isCorrect).toBe(true);
      expect(result.marksAwarded).toBe(2);
    });
  });

  describe('NAT Scoring (Tolerance Check & Zero Negative)', () => {
    it('awards full marks when answer exactly matches without tolerance', () => {
      const result = scoreQuestion({
        questionType: 'NAT',
        marks: 1,
        userAnswer: 42,
        correctAnswer: 42
      });
      expect(result.isCorrect).toBe(true);
      expect(result.marksAwarded).toBe(1);
      expect(result.negativeDeducted).toBe(0);
      expect(result.netScore).toBe(1);
    });

    it('evaluates NAT answer within numerical tolerance', () => {
      const withinTol = scoreQuestion({
        questionType: 'NAT',
        marks: 2,
        userAnswer: '3.141',
        correctAnswer: 3.14,
        natTolerance: 0.01
      });
      expect(withinTol.isCorrect).toBe(true);
      expect(withinTol.marksAwarded).toBe(2);
      expect(withinTol.negativeDeducted).toBe(0);

      const outsideTol = scoreQuestion({
        questionType: 'NAT',
        marks: 2,
        userAnswer: '3.16',
        correctAnswer: 3.14,
        natTolerance: 0.01
      });
      expect(outsideTol.isCorrect).toBe(false);
      expect(outsideTol.marksAwarded).toBe(0);
      expect(outsideTol.negativeDeducted).toBe(0);
      expect(outsideTol.netScore).toBe(0);
    });

    it('evaluates NAT answer within range [min, max]', () => {
      const inRange = scoreQuestion({
        questionType: 'NAT',
        marks: 2,
        userAnswer: 25.5,
        correctAnswer: { min: 25.0, max: 26.0 }
      });
      expect(inRange.isCorrect).toBe(true);
      expect(inRange.marksAwarded).toBe(2);

      const outRange = scoreQuestion({
        questionType: 'NAT',
        marks: 2,
        userAnswer: 24.9,
        correctAnswer: { min: 25.0, max: 26.0 }
      });
      expect(outRange.isCorrect).toBe(false);
      expect(outRange.marksAwarded).toBe(0);
      expect(outRange.negativeDeducted).toBe(0);
    });

    it('handles non-numeric invalid input gracefully', () => {
      const invalid = scoreQuestion({
        questionType: 'NAT',
        marks: 1,
        userAnswer: 'abc',
        correctAnswer: 10
      });
      expect(invalid.isAttempted).toBe(true);
      expect(invalid.isCorrect).toBe(false);
      expect(invalid.marksAwarded).toBe(0);
      expect(invalid.negativeDeducted).toBe(0);
    });
  });

  describe('Descriptive Scoring', () => {
    it('scores descriptive questions with evaluated score and 0 negative', () => {
      const full = scoreQuestion({
        questionType: 'descriptive',
        marks: 15,
        userAnswer: 12,
        correctAnswer: 'Model answer'
      });
      expect(full.isAttempted).toBe(true);
      expect(full.marksAwarded).toBe(12);
      expect(full.negativeDeducted).toBe(0);
      expect(full.netScore).toBe(12);
      expect(full.status).toBe('partial');
    });
  });

  describe('Break-Even Accuracy Math per Question Type', () => {
    it('computes 25% break-even for GATE 1-mark and 2-mark MCQ', () => {
      // 1 mark, -0.33333: 0.33333 / (1 + 0.33333) = 25%
      const be1 = calculateQuestionBreakEvenAccuracy('MCQ', 1, 1 / 3);
      expect(be1).toBeCloseTo(25, 1);

      // 2 marks, -0.66667: 0.66667 / (2 + 0.66667) = 25%
      const be2 = calculateQuestionBreakEvenAccuracy('MCQ', 2, 2 / 3);
      expect(be2).toBeCloseTo(25, 1);
    });

    it('computes 0% break-even for MSQ, NAT, and descriptive (zero negative marking)', () => {
      expect(calculateQuestionBreakEvenAccuracy('MSQ', 1)).toBe(0);
      expect(calculateQuestionBreakEvenAccuracy('MSQ', 2)).toBe(0);
      expect(calculateQuestionBreakEvenAccuracy('NAT', 1)).toBe(0);
      expect(calculateQuestionBreakEvenAccuracy('NAT', 2)).toBe(0);
      expect(calculateQuestionBreakEvenAccuracy('descriptive', 10)).toBe(0);
    });

    it('computes 20% break-even for +1 / -0.25 marking (e.g. banking prelims)', () => {
      expect(calculateQuestionBreakEvenAccuracy('MCQ', 1, 0.25)).toBe(20);
    });
  });

  describe('scoreExamAttempt batch evaluation', () => {
    it('aggregates mixed exam questions correctly', () => {
      const batch = scoreExamAttempt([
        { questionType: 'MCQ', marks: 1, userAnswer: 'A', correctAnswer: 'A' }, // +1
        { questionType: 'MCQ', marks: 1, userAnswer: 'B', correctAnswer: 'A', negativeMarks: 0.3333 }, // -0.3333
        { questionType: 'MSQ', marks: 2, userAnswer: ['A', 'B'], correctAnswer: ['A', 'B'] }, // +2
        { questionType: 'MSQ', marks: 2, userAnswer: ['A'], correctAnswer: ['A', 'B'] }, // 0
        { questionType: 'NAT', marks: 2, userAnswer: 15, correctAnswer: 15 }, // +2
        { questionType: 'NAT', marks: 2, userAnswer: null, correctAnswer: 15 } // unattempted
      ]);

      expect(batch.totalQuestions).toBe(6);
      expect(batch.totalAttempted).toBe(5);
      expect(batch.totalCorrect).toBe(3);
      expect(batch.totalWrong).toBe(2);
      expect(batch.totalUnattempted).toBe(1);
      expect(batch.totalMarksAwarded).toBe(5); // 1 + 2 + 2
      expect(batch.totalNegativeDeducted).toBeCloseTo(0.33, 2);
      expect(batch.totalNetScore).toBeCloseTo(4.67, 2);
      expect(batch.accuracyPercent).toBe(60);
    });
  });
});
