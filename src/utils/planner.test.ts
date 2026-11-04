import { describe, it, expect } from 'vitest';
import {
  calculateExpectedScorePerAttempt,
  calculateBreakEvenAccuracy,
  calculateAttemptsNeeded,
  generateCurveData,
  calculateWhatIfProjections,
  calculateTimePlan,
  calculateGapAnalysis
} from './planner';

describe('Target Strategy Planner Math Module', () => {
  describe('calculateBreakEvenAccuracy', () => {
    it('calculates 20% break-even for +1 / -0.25 marking', () => {
      // 0.25 / (1 + 0.25) = 0.25 / 1.25 = 20%
      expect(calculateBreakEvenAccuracy(1.0, 0.25)).toBe(20);
    });

    it('returns 0% when negative marking is 0', () => {
      expect(calculateBreakEvenAccuracy(1.0, 0)).toBe(0);
    });

    it('calculates 20% break-even for +2 / -0.5 marking', () => {
      // 0.5 / (2 + 0.5) = 20%
      expect(calculateBreakEvenAccuracy(2.0, 0.5)).toBe(20);
    });
  });

  describe('calculateExpectedScorePerAttempt', () => {
    it('returns 1.0 when accuracy is 100% with +1 / -0.25', () => {
      expect(calculateExpectedScorePerAttempt(100, 1.0, 0.25)).toBe(1.0);
    });

    it('returns -0.25 when accuracy is 0% with +1 / -0.25', () => {
      expect(calculateExpectedScorePerAttempt(0, 1.0, 0.25)).toBe(-0.25);
    });

    it('returns 0.775 at 82% accuracy with +1 / -0.25', () => {
      // 0.82 * 1 - 0.18 * 0.25 = 0.82 - 0.045 = 0.775
      const ev = calculateExpectedScorePerAttempt(82, 1.0, 0.25);
      expect(Number(ev.toFixed(3))).toBe(0.775);
    });

    it('handles 0 negative marking properly', () => {
      // 0.5 * 2 - 0 = 1.0
      expect(calculateExpectedScorePerAttempt(50, 2.0, 0)).toBe(1.0);
    });
  });

  describe('calculateAttemptsNeeded', () => {
    it('handles edge case: target score <= 0', () => {
      const res = calculateAttemptsNeeded({
        targetScore: 0,
        accuracyPercent: 80,
        marksPerCorrect: 1.0,
        negativeMark: 0.25,
        maxQuestions: 35
      });
      expect(res.attemptsNeeded).toBe(0);
      expect(res.isAchievable).toBe(true);
    });

    it('handles edge case: 100% accuracy with target 25', () => {
      const res = calculateAttemptsNeeded({
        targetScore: 25,
        accuracyPercent: 100,
        marksPerCorrect: 1.0,
        negativeMark: 0.25,
        maxQuestions: 35
      });
      expect(res.attemptsNeeded).toBe(25);
      expect(res.isAchievable).toBe(true);
    });

    it('handles edge case: accuracy below break-even (expected score <= 0)', () => {
      const res = calculateAttemptsNeeded({
        targetScore: 20,
        accuracyPercent: 15, // break even is 20%
        marksPerCorrect: 1.0,
        negativeMark: 0.25,
        maxQuestions: 35
      });
      expect(res.attemptsNeeded).toBe(Infinity);
      expect(res.isAchievable).toBe(false);
      expect(res.explanation).toContain('below break-even');
    });

    it('handles edge case: no negative marking (negativeMark = 0)', () => {
      const res = calculateAttemptsNeeded({
        targetScore: 20,
        accuracyPercent: 50,
        marksPerCorrect: 1.0,
        negativeMark: 0,
        maxQuestions: 50
      });
      // EV = 0.5 * 1 = 0.5 => 20 / 0.5 = 40 attempts
      expect(res.attemptsNeeded).toBe(40);
      expect(res.isAchievable).toBe(true);
    });

    it('detects unachievable target when attempts needed exceed max questions', () => {
      const res = calculateAttemptsNeeded({
        targetScore: 30,
        accuracyPercent: 50,
        marksPerCorrect: 1.0,
        negativeMark: 0.25,
        maxQuestions: 35
      });
      // EV = 0.5 * 1 - 0.5 * 0.25 = 0.5 - 0.125 = 0.375
      // 30 / 0.375 = 80 attempts > 35
      expect(res.attemptsNeeded).toBe(80);
      expect(res.isAchievable).toBe(false);
    });

    it('calculates standard scenario correctly and formats explanation', () => {
      const res = calculateAttemptsNeeded({
        targetScore: 24,
        accuracyPercent: 82,
        marksPerCorrect: 1.0,
        negativeMark: 0.25,
        maxQuestions: 35
      });
      // 24 / 0.775 = 30.967 => 31
      expect(res.attemptsNeeded).toBe(31);
      expect(res.isAchievable).toBe(true);
      expect(res.explanation).toBe('At 82% accuracy you need to attempt 31 of 35 questions to score 24.');
    });
  });

  describe('generateCurveData', () => {
    it('produces curve data points including 0 and max', () => {
      const curve = generateCurveData(80, 1.0, 0.25, 35);
      expect(curve.length).toBeGreaterThan(0);
      expect(curve[0].attempts).toBe(0);
      expect(curve[0].scoreCurrent).toBe(0);
      const last = curve[curve.length - 1];
      expect(last.attempts).toBe(35);
      expect(last.scorePlus10).toBeGreaterThan(last.scoreCurrent);
      expect(last.scoreCurrent).toBeGreaterThan(last.scoreMinus10);
    });
  });

  describe('calculateWhatIfProjections', () => {
    it('projects scores and cutoff passes accurately', () => {
      const sections = [
        {
          sectionId: 'quant',
          sectionName: 'Quant',
          attempts: 25,
          accuracyPercent: 80,
          totalQuestions: 35,
          marksPerCorrect: 1,
          negativeMark: 0.25,
          cutoff: 12
        },
        {
          sectionId: 'reasoning',
          sectionName: 'Reasoning',
          attempts: 30,
          accuracyPercent: 90,
          totalQuestions: 35,
          marksPerCorrect: 1,
          negativeMark: 0.25,
          cutoff: 15
        }
      ];

      // Quant: 25 * (0.8 - 0.2*0.25) = 25 * 0.75 = 18.75
      // Reasoning: 30 * (0.9 - 0.1*0.25) = 30 * 0.875 = 26.25
      // Total: 45.0
      const result = calculateWhatIfProjections(sections, 30, 40);
      expect(result.totalScore).toBe(45);
      expect(result.passedOverallCutoff).toBe(true);
      expect(result.hitTargetScore).toBe(true);
      expect(result.sections[0].passedCutoff).toBe(true);
      expect(result.sections[0].projectedNetScore).toBe(18.75);
    });
  });

  describe('calculateTimePlan & calculateGapAnalysis', () => {
    it('recommends section priority based on historical marks per minute', () => {
      const sections = [
        { id: 'quant', name: 'Quant', defaultTimeLimit: 20 },
        { id: 'reasoning', name: 'Reasoning', defaultTimeLimit: 20 },
        { id: 'english', name: 'English', defaultTimeLimit: 20 }
      ];
      const history = [
        { sectionId: 'quant', netScore: 20, timeMinutes: 20 }, // 1.0 mpm
        { sectionId: 'reasoning', netScore: 30, timeMinutes: 20 }, // 1.5 mpm
        { sectionId: 'english', netScore: 16, timeMinutes: 20 } // 0.8 mpm
      ];

      const plan = calculateTimePlan(sections, history, 60);
      expect(plan[0].sectionName).toBe('Reasoning');
      expect(plan[0].attemptPriority).toBe(1);
      expect(plan[2].sectionName).toBe('English');
    });

    it('calculates gap analysis with silly mistakes and weak topic', () => {
      const gap = calculateGapAnalysis(65, 55, 4.5, { topic: 'Puzzles', marksLost: 5 });
      expect(gap.gap).toBe(10);
      expect(gap.sillyRecoverable).toBe(4.5);
      expect(gap.weakTopicRecoverable).toBe(5);
      expect(gap.summarySentence).toContain('+10 marks');
    });
  });
});

