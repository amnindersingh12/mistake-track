import { describe, it, expect } from 'vitest';
import {
  calculateExpectedScorePerAttempt,
  calculateBreakEvenAccuracy,
  calculateAttemptsNeeded,
  generateCurveData,
  calculateWhatIfProjections,
  calculateTimePlan,
  calculateGapAnalysis,
  calculateQuestionTypeBreakEven,
  recommendAttemptStrategy,
  calculateSyllabusScoreDelta
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

  describe('Question-Type Break-Even Accuracy Math (SPEC A item 7)', () => {
    it('calculates 25% break-even for GATE 1-mark MCQ with 1/3 negative marking', () => {
      // negative = 1/3 = 0.33333...
      // BE = (1/3) / (1 + 1/3) = (1/3) / (4/3) = 1/4 = 25%
      const res = calculateQuestionTypeBreakEven('MCQ', 1, 1 / 3);
      expect(res.breakEvenAccuracyPercent).toBe(25);
      expect(res.formula).toContain('25%');
    });

    it('calculates 25% break-even for GATE 2-mark MCQ with 2/3 negative marking', () => {
      // BE = (2/3) / (2 + 2/3) = (2/3) / (8/3) = 1/4 = 25%
      const res = calculateQuestionTypeBreakEven('MCQ', 2, 2 / 3);
      expect(res.breakEvenAccuracyPercent).toBe(25);
    });

    it('calculates 0% break-even for MSQ, NAT, and descriptive (zero negative marking)', () => {
      const msq = calculateQuestionTypeBreakEven('MSQ', 2);
      expect(msq.breakEvenAccuracyPercent).toBe(0);
      expect(msq.negativeMarks).toBe(0);

      const nat = calculateQuestionTypeBreakEven('NAT', 2);
      expect(nat.breakEvenAccuracyPercent).toBe(0);
      expect(nat.negativeMarks).toBe(0);

      const desc = calculateQuestionTypeBreakEven('descriptive', 10);
      expect(desc.breakEvenAccuracyPercent).toBe(0);
      expect(desc.negativeMarks).toBe(0);
    });

    it('calculates 20% break-even for 1.25 mark / 0.3125 negative (SEBI Phase 1)', () => {
      // 0.3125 / (1.25 + 0.3125) = 0.3125 / 1.5625 = 20%
      const sebi = calculateQuestionTypeBreakEven('MCQ', 1.25, 0.3125);
      expect(sebi.breakEvenAccuracyPercent).toBe(20);
    });
  });

  describe('Recommended Attempt Strategy per Question Type (SPEC A item 7)', () => {
    it('recommends aggressive strategy when accuracy is well above break-even', () => {
      // BE for 1-mark MCQ is 25%, accuracy 75% > 25% + 10%
      const strat = recommendAttemptStrategy({
        questionType: 'MCQ',
        marks: 1,
        negativeMarks: 1 / 3,
        historicalAccuracyPercent: 75
      });
      expect(strat.strategy).toBe('aggressive');
      expect(strat.badgeLabel).toBe('Aggressive Attempt');
      expect(strat.expectedValuePerAttempt).toBeGreaterThan(0.5);
    });

    it('recommends selective strategy when accuracy is marginally above break-even', () => {
      // BE is 25%, accuracy 30% is within [25%, 35%]
      const strat = recommendAttemptStrategy({
        questionType: 'MCQ',
        marks: 1,
        negativeMarks: 1 / 3,
        historicalAccuracyPercent: 30,
        thresholdBuffer: 10
      });
      expect(strat.strategy).toBe('selective');
      expect(strat.badgeLabel).toBe('Selective Attempt');
      expect(strat.actionGuidance).toContain('eliminate at least 1-2 options');
    });

    it('recommends skip strategy when accuracy is below break-even', () => {
      // BE is 25%, accuracy 15% < 25%
      const strat = recommendAttemptStrategy({
        questionType: 'MCQ',
        marks: 1,
        negativeMarks: 1 / 3,
        historicalAccuracyPercent: 15
      });
      expect(strat.strategy).toBe('skip');
      expect(strat.badgeLabel).toBe('Skip / High Risk');
      expect(strat.expectedValuePerAttempt).toBeLessThan(0);
      expect(strat.actionGuidance).toContain('Skip guesses');
    });

    it('always recommends aggressive strategy for zero negative questions (NAT & MSQ)', () => {
      const natStrat = recommendAttemptStrategy({
        questionType: 'NAT',
        marks: 2,
        historicalAccuracyPercent: 40
      });
      expect(natStrat.strategy).toBe('aggressive');
      expect(natStrat.breakEvenAccuracyPercent).toBe(0);

      const msqStrat = recommendAttemptStrategy({
        questionType: 'MSQ',
        marks: 2,
        historicalAccuracyPercent: 50
      });
      expect(msqStrat.strategy).toBe('aggressive');
      expect(msqStrat.breakEvenAccuracyPercent).toBe(0);
      expect(msqStrat.actionGuidance).toContain('NO partial credit');
    });
  });

  describe('Target vs Current Score Delta by Syllabus Weight & Hit Rate (SPEC A item 7)', () => {
    it('calculates score delta and ranks high-yield topics', () => {
      const topics = [
        { name: 'Databases', weight: 8 },
        { name: 'Computer Networks', weight: 9 },
        { name: 'Discrete Math', weight: 7 }
      ];
      const hitRates = {
        Databases: { attempted: 20, correct: 8, hitRate: 40 }, // 40% hit rate, 8 marks -> current 3.2, potential 85% is 6.8 -> recoverable 3.6
        'Computer Networks': { attempted: 30, correct: 24, hitRate: 80 }, // 80% hit rate, 9 marks -> current 7.2, potential 7.65 -> recoverable 0.45
        'Discrete Math': { attempted: 15, correct: 7, hitRate: 46.7 } // 46.7% hit rate, 7 marks -> recoverable ~2.68
      };

      const result = calculateSyllabusScoreDelta({
        targetScore: 65,
        currentScore: 48,
        topics,
        topicHitRates: hitRates,
        targetHitRate: 85
      });

      expect(result.totalScoreDelta).toBe(17);
      expect(result.topics[0].topic).toBe('Databases');
      expect(result.topics[0].priority).toBe('High');
      expect(result.topics[0].recoverableDelta).toBeGreaterThan(3.0);
      expect(result.totalRecoverableMarks).toBeGreaterThan(6.0);
      expect(result.summarySentence).toContain('Target delta is +17 marks');
    });

    it('handles target already achieved', () => {
      const result = calculateSyllabusScoreDelta({
        targetScore: 50,
        currentScore: 55,
        topics: [{ name: 'Algorithms', weight: 10 }]
      });
      expect(result.totalScoreDelta).toBe(0);
      expect(result.summarySentence).toContain('Target achieved');
    });
  });
});

