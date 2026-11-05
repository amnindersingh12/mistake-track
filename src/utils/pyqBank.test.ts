import { describe, it, expect } from 'vitest';
import {
  evaluatePYQAnswer,
  recordPYQAttempt,
  filterPYQs,
  calculateTopicPYQStats,
  calculateOverallPYQStats,
  INITIAL_PYQS
} from './pyqBank';
import { PYQ } from '../types';

describe('PYQ Bank Utilities', () => {
  const sampleMCQ: PYQ = {
    id: 1,
    examId: 'gate-cs',
    year: 2024,
    stage: 'cbt',
    topicId: 'algorithms',
    questionNumber: 1,
    questionText: 'What is the worst case time complexity of Merge Sort?',
    questionType: 'MCQ',
    marks: 1,
    options: ['A) O(n)', 'B) O(n log n)', 'C) O(n^2)', 'D) O(1)'],
    correctAnswer: 'B',
    source: 'official',
    attemptedCount: 0,
    createdAt: '2026-11-01'
  };

  const sampleNAT: PYQ = {
    id: 2,
    examId: 'gate-cs',
    year: 2024,
    stage: 'cbt',
    topicId: 'cn',
    questionNumber: 2,
    questionText: 'Subnet prefix length',
    questionType: 'NAT',
    marks: 2,
    correctAnswer: '23',
    natAnswerRange: { min: 23, max: 23 },
    source: 'official',
    attemptedCount: 0,
    createdAt: '2026-11-01'
  };

  const sampleMSQ: PYQ = {
    id: 3,
    examId: 'gate-cs',
    year: 2023,
    stage: 'cbt',
    topicId: 'os',
    questionNumber: 3,
    questionText: 'Which scheduling algorithms are preemptive?',
    questionType: 'MSQ',
    marks: 2,
    correctAnswer: 'A, B, D',
    source: 'official',
    attemptedCount: 0,
    createdAt: '2026-11-01'
  };

  describe('Answer Evaluation', () => {
    it('evaluates MCQ answers accurately', () => {
      expect(evaluatePYQAnswer(sampleMCQ, 'B')).toBe(true);
      expect(evaluatePYQAnswer(sampleMCQ, 'b')).toBe(true);
      expect(evaluatePYQAnswer(sampleMCQ, 'A')).toBe(false);
    });

    it('evaluates NAT answers within numeric precision and range', () => {
      expect(evaluatePYQAnswer(sampleNAT, 23)).toBe(true);
      expect(evaluatePYQAnswer(sampleNAT, '23')).toBe(true);
      expect(evaluatePYQAnswer(sampleNAT, 24)).toBe(false);

      const floatNAT: PYQ = {
        ...sampleNAT,
        correctAnswer: '4.5',
        natAnswerRange: { min: 4.4, max: 4.6 }
      };
      expect(evaluatePYQAnswer(floatNAT, 4.5)).toBe(true);
      expect(evaluatePYQAnswer(floatNAT, 4.45)).toBe(true);
      expect(evaluatePYQAnswer(floatNAT, 4.8)).toBe(false);
    });

    it('evaluates MSQ answers with order-independent sets', () => {
      expect(evaluatePYQAnswer(sampleMSQ, 'A, B, D')).toBe(true);
      expect(evaluatePYQAnswer(sampleMSQ, ['D', 'A', 'B'])).toBe(true);
      expect(evaluatePYQAnswer(sampleMSQ, 'B, A, D')).toBe(true);
      expect(evaluatePYQAnswer(sampleMSQ, 'A, B')).toBe(false); // missing D
      expect(evaluatePYQAnswer(sampleMSQ, 'A, B, C, D')).toBe(false); // extra C
    });
  });

  describe('Attempt Recording & First-Attempt Accuracy', () => {
    it('records first attempt and stores firstAttemptCorrect = true', () => {
      const result = recordPYQAttempt(sampleMCQ, 'B');
      expect(result.isCorrect).toBe(true);
      expect(result.pyq.attemptedCount).toBe(1);
      expect(result.pyq.firstAttemptCorrect).toBe(true);
    });

    it('records first attempt failure and preserves firstAttemptCorrect = false on subsequent retry', () => {
      // 1st attempt: wrong
      const firstResult = recordPYQAttempt(sampleMCQ, 'A');
      expect(firstResult.isCorrect).toBe(false);
      expect(firstResult.pyq.attemptedCount).toBe(1);
      expect(firstResult.pyq.firstAttemptCorrect).toBe(false);

      // 2nd attempt: correct now, but firstAttemptCorrect remains false
      const secondResult = recordPYQAttempt(firstResult.pyq, 'B');
      expect(secondResult.isCorrect).toBe(true);
      expect(secondResult.pyq.attemptedCount).toBe(2);
      expect(secondResult.pyq.firstAttemptCorrect).toBe(false);
    });
  });

  describe('Filtering PYQs', () => {
    const list: PYQ[] = [
      { ...sampleMCQ, id: 1, attemptedCount: 1, firstAttemptCorrect: true },
      { ...sampleNAT, id: 2, attemptedCount: 1, firstAttemptCorrect: false },
      { ...sampleMSQ, id: 3, attemptedCount: 0, firstAttemptCorrect: undefined }
    ];

    it('filters by examId and questionType', () => {
      const mcqs = filterPYQs(list, { questionType: 'MCQ' });
      expect(mcqs.length).toBe(1);
      expect(mcqs[0].id).toBe(1);

      const nats = filterPYQs(list, { questionType: 'NAT' });
      expect(nats.length).toBe(1);
      expect(nats[0].id).toBe(2);
    });

    it('filters by attempt status (attempted, unattempted, first-correct, first-incorrect)', () => {
      const attempted = filterPYQs(list, { attemptFilter: 'attempted' });
      expect(attempted.length).toBe(2);

      const unattempted = filterPYQs(list, { attemptFilter: 'unattempted' });
      expect(unattempted.length).toBe(1);
      expect(unattempted[0].id).toBe(3);

      const firstCorrect = filterPYQs(list, { attemptFilter: 'first-correct' });
      expect(firstCorrect.length).toBe(1);
      expect(firstCorrect[0].id).toBe(1);

      const firstIncorrect = filterPYQs(list, { attemptFilter: 'first-incorrect' });
      expect(firstIncorrect.length).toBe(1);
      expect(firstIncorrect[0].id).toBe(2);
    });

    it('filters by text search across questionText and topicId', () => {
      const matchAlgo = filterPYQs(list, { searchQuery: 'Merge Sort' });
      expect(matchAlgo.length).toBe(1);
      expect(matchAlgo[0].id).toBe(1);

      // Matches both sampleMCQ (topicId: 'algorithms') and sampleMSQ ("scheduling algorithms" in questionText)
      const matchAlgoAll = filterPYQs(list, { searchQuery: 'algorithms' });
      expect(matchAlgoAll.length).toBe(2);

      // Matches sampleNAT by topicId 'cn'
      const matchTopicCN = filterPYQs(list, { searchQuery: 'cn' });
      expect(matchTopicCN.length).toBe(1);
      expect(matchTopicCN[0].id).toBe(2);
    });
  });

  describe('Stats & Coverage Calculation', () => {
    it('calculates topic-level PYQ coverage and first-attempt accuracy', () => {
      const pyqs: PYQ[] = [
        { ...sampleMCQ, id: 1, topicId: 'algorithms', attemptedCount: 1, firstAttemptCorrect: true },
        { ...sampleMCQ, id: 2, topicId: 'algorithms', attemptedCount: 1, firstAttemptCorrect: false },
        { ...sampleMCQ, id: 3, topicId: 'algorithms', attemptedCount: 0, firstAttemptCorrect: undefined }
      ];

      const stats = calculateTopicPYQStats(pyqs, 'algorithms', 'Algorithms');
      expect(stats.total).toBe(3);
      expect(stats.attempted).toBe(2);
      expect(stats.unattempted).toBe(1);
      expect(stats.firstAttemptCorrect).toBe(1);
      expect(stats.firstAttemptIncorrect).toBe(1);
      expect(stats.coveragePercentage).toBe(67); // 2/3 = 67%
      expect(stats.firstAttemptAccuracy).toBe(50); // 1/2 = 50%
    });

    it('calculates overall PYQ bank summary with breakdowns by exam, year, and type', () => {
      const summary = calculateOverallPYQStats(INITIAL_PYQS);
      expect(summary.total).toBe(INITIAL_PYQS.length);
      expect(summary.total).toBeGreaterThanOrEqual(8);
      expect(summary.byExam['gate-cs']).toBeDefined();
      expect(summary.byExam['sebi-it']).toBeDefined();
      expect(summary.byExam['ibps-so-it']).toBeDefined();
      expect(summary.byQuestionType['MCQ']).toBeDefined();
      expect(summary.byQuestionType['NAT']).toBeDefined();
      expect(summary.byQuestionType['MSQ']).toBeDefined();
    });
  });
});
