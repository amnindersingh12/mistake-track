import { describe, it, expect } from 'vitest';
import {
  getConsecutiveWrongCount,
  getDaysOverdue,
  calculateWeaknessScore,
  sortQueueByWeakness,
  interleaveQueue,
  getQuick5Queue
} from './reviewQueue';
import { MistakeEntry } from '../types';

function createMockMistake(partial: Partial<MistakeEntry>): MistakeEntry {
  return {
    id: 1,
    mockName: 'Mock 1',
    sectionId: 'quant',
    sectionName: 'Quantitative Aptitude',
    topic: 'Percentages',
    questionNumber: 1,
    questionText: 'Test question',
    myAnswer: 'A',
    correctAnswer: 'B',
    resultType: 'Wrong',
    errorTypes: ['Concept gap'],
    timeSpentSeconds: 30,
    idealTimeSeconds: 30,
    whatWentWrong: 'Missed formula',
    correctSolution: 'Use formula',
    betterApproach: 'Shortcut',
    ruleToRemember: 'Rule 1',
    difficulty: 'Medium',
    tags: [],
    status: 'Reviewing',
    interval: 1,
    consecutiveCorrect: 0,
    nextReviewDate: '2026-11-01',
    history: [],
    createdAt: '2026-10-31',
    ...partial
  };
}

describe('reviewQueue utilities', () => {
  describe('getConsecutiveWrongCount', () => {
    it('returns 1 for newly logged wrong mistake without history', () => {
      const m = createMockMistake({ history: [], resultType: 'Wrong' });
      expect(getConsecutiveWrongCount(m)).toBe(1);
    });

    it('counts trailing still-wrong entries in history', () => {
      const m = createMockMistake({
        history: [
          { date: '2026-10-28', result: 'got-it' },
          { date: '2026-10-29', result: 'still-wrong' },
          { date: '2026-10-30', result: 'still-wrong' }
        ]
      });
      expect(getConsecutiveWrongCount(m)).toBe(2);
    });

    it('returns 0 if last review was got-it', () => {
      const m = createMockMistake({
        consecutiveCorrect: 1,
        history: [
          { date: '2026-10-29', result: 'still-wrong' },
          { date: '2026-10-30', result: 'got-it' }
        ]
      });
      expect(getConsecutiveWrongCount(m)).toBe(0);
    });
  });

  describe('getDaysOverdue', () => {
    it('returns 0 if due today or in future', () => {
      expect(getDaysOverdue('2026-11-05', '2026-11-05')).toBe(0);
      expect(getDaysOverdue('2026-11-07', '2026-11-05')).toBe(0);
    });

    it('returns positive number of days overdue for past date', () => {
      expect(getDaysOverdue('2026-11-01', '2026-11-05')).toBe(4);
    });
  });

  describe('calculateWeaknessScore and sortQueueByWeakness', () => {
    it('prioritizes high difficulty, consecutive failures, and overdue dates', () => {
      const today = '2026-11-05';
      const mEasyRecent = createMockMistake({
        id: 1,
        difficulty: 'Easy',
        history: [{ date: '2026-11-04', result: 'got-it' }],
        nextReviewDate: '2026-11-05' // due today, 0 overdue
      });
      const mHardOverdueFailing = createMockMistake({
        id: 2,
        difficulty: 'Hard',
        marks: 2,
        history: [
          { date: '2026-10-25', result: 'still-wrong' },
          { date: '2026-10-28', result: 'still-wrong' }
        ],
        nextReviewDate: '2026-10-28' // 8 days overdue, 2 consecutive wrong, Hard (3 * 2 = 6)
      });

      const scoreEasy = calculateWeaknessScore(mEasyRecent, today);
      const scoreHard = calculateWeaknessScore(mHardOverdueFailing, today);

      expect(scoreHard).toBeGreaterThan(scoreEasy);

      const sorted = sortQueueByWeakness([mEasyRecent, mHardOverdueFailing], today);
      expect(sorted[0].id).toBe(2);
      expect(sorted[1].id).toBe(1);
    });
  });

  describe('interleaveQueue', () => {
    it('mixes questions across subjects in round-robin order', () => {
      const q1 = createMockMistake({ id: 1, sectionId: 'quant', topic: 'P1' });
      const q2 = createMockMistake({ id: 2, sectionId: 'quant', topic: 'P2' });
      const q3 = createMockMistake({ id: 3, sectionId: 'quant', topic: 'P3' });

      const r1 = createMockMistake({ id: 4, sectionId: 'reasoning', topic: 'R1' });
      const r2 = createMockMistake({ id: 5, sectionId: 'reasoning', topic: 'R2' });

      const e1 = createMockMistake({ id: 6, sectionId: 'english', topic: 'E1' });

      const input = [q1, q2, q3, r1, r2, e1];
      const interleaved = interleaveQueue(input);

      // Round 1: quant, reasoning, english -> q1, r1, e1
      // Round 2: quant, reasoning -> q2, r2
      // Round 3: quant -> q3
      expect(interleaved.map((m) => m.id)).toEqual([1, 4, 6, 2, 5, 3]);
    });

    it('handles empty and single-item queues gracefully', () => {
      expect(interleaveQueue([])).toEqual([]);
      const single = createMockMistake({ id: 99 });
      expect(interleaveQueue([single])).toEqual([single]);
    });
  });

  describe('getQuick5Queue', () => {
    it('limits to first 5 items', () => {
      const items = Array.from({ length: 12 }, (_, i) => createMockMistake({ id: i + 1 }));
      const quick5 = getQuick5Queue(items);
      expect(quick5.length).toBe(5);
      expect(quick5.map((m) => m.id)).toEqual([1, 2, 3, 4, 5]);
    });

    it('returns all items if fewer than 5', () => {
      const items = [createMockMistake({ id: 1 }), createMockMistake({ id: 2 })];
      expect(getQuick5Queue(items).length).toBe(2);
    });
  });
});
