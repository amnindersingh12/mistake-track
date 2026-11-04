import { describe, it, expect } from 'vitest';
import {
  generateInsights,
  calculateImprovementMetrics,
  calculateMarksLostBreakdown,
  calculateErrorDistribution,
  calculateTopicWeaknesses,
  calculateTimeAnalysis,
  calculateAccuracyVsAttempts,
  calculateRepeatedMistakes
} from './insights';
import {
  calculateBreakEvenSentence,
  generateAccuracyTierCurves,
  calculateTargetGap
} from './planner';
import { MockTest, MistakeEntry } from '../types';

describe('Analytics & Insights Module', () => {
  describe('Zero Fake Data (Empty Data State)', () => {
    it('returns clean empty state when mocks and mistakes are 0 with no sample data text', () => {
      const insights = generateInsights([], []);
      expect(insights.keyInsights.length).toBeGreaterThan(0);
      expect(insights.keyInsights[0].description).not.toContain('Load sample data');
      expect(insights.keyInsights[0].description).toContain('Needs at least 1 mock');
      expect(insights.repeatedMistakes).toHaveLength(0);
      expect(insights.recentScoreDiff.delta).toBe(0);
    });

    it('handles empty data in improvement metrics gracefully', () => {
      const imp = calculateImprovementMetrics([]);
      expect(imp.hasEnoughData).toBe(false);
      expect(imp.message).toContain('Needs at least 2 mocks');
      expect(imp.scoreDelta).toBe(0);
    });

    it('handles empty data in marks lost breakdown', () => {
      const breakdown = calculateMarksLostBreakdown([]);
      expect(breakdown.totalNegativeLost).toBe(0);
      expect(breakdown.totalUnattemptedPotentialLost).toBe(0);
      expect(breakdown.totalMarksLost).toBe(0);
      expect(breakdown.negativePercentage).toBe(0);
    });

    it('handles empty data in error distribution and topic weaknesses', () => {
      expect(calculateErrorDistribution([])).toHaveLength(0);
      expect(calculateTopicWeaknesses([])).toHaveLength(0);
      expect(calculateRepeatedMistakes([])).toHaveLength(0);
    });
  });

  describe('Single Mock State', () => {
    const singleMock: MockTest = {
      id: 1,
      name: 'SBI Clerk Prelims Mock 01',
      date: '2026-11-01',
      source: 'Testbook',
      attemptType: 'mock',
      totalAttempted: 70,
      totalCorrect: 56,
      totalWrong: 14,
      totalUnattempted: 30,
      totalNetScore: 52.5,
      overallAccuracy: 80,
      totalMarksLostNegative: 3.5,
      totalTimeSpentSeconds: 3600,
      sections: [
        {
          sectionId: 'quant',
          sectionName: 'Quantitative Aptitude',
          attempted: 25,
          correct: 20,
          wrong: 5,
          unattempted: 10,
          netScore: 18.75,
          accuracy: 80,
          marksLostNegative: 1.25,
          timeSpentSeconds: 1200
        }
      ]
    };

    it('handles single mock in generateInsights without NaN or crashes', () => {
      const insights = generateInsights([singleMock], []);
      expect(insights.recentScoreDiff.last3Avg).toBe(52.5);
      expect(insights.keyInsights.some((k) => k.id === 'trend-insufficient')).toBe(true);
    });

    it('flags insufficient data in improvement metrics for single mock', () => {
      const imp = calculateImprovementMetrics([singleMock]);
      expect(imp.hasEnoughData).toBe(false);
      expect(imp.message).toContain('Needs at least 2 mocks');
    });

    it('calculates correct marks lost breakdown on single mock', () => {
      const breakdown = calculateMarksLostBreakdown([singleMock]);
      expect(breakdown.totalNegativeLost).toBe(3.5);
      expect(breakdown.totalUnattemptedPotentialLost).toBe(10);
      expect(breakdown.totalMarksLost).toBe(13.5);
    });
  });

  describe('100% Accuracy Edge Case', () => {
    const perfectMock: MockTest = {
      id: 2,
      name: 'Perfect Mock',
      date: '2026-11-02',
      source: 'Testbook',
      attemptType: 'mock',
      totalAttempted: 60,
      totalCorrect: 60,
      totalWrong: 0,
      totalUnattempted: 40,
      totalNetScore: 60,
      overallAccuracy: 100,
      totalMarksLostNegative: 0,
      totalTimeSpentSeconds: 3600,
      sections: [
        {
          sectionId: 'quant',
          sectionName: 'Quantitative Aptitude',
          attempted: 30,
          correct: 30,
          wrong: 0,
          unattempted: 5,
          netScore: 30,
          accuracy: 100,
          marksLostNegative: 0,
          timeSpentSeconds: 1200
        }
      ]
    };

    it('handles 100% accuracy with 0 negative lost', () => {
      const breakdown = calculateMarksLostBreakdown([perfectMock]);
      expect(breakdown.totalNegativeLost).toBe(0);
      expect(breakdown.negativePercentage).toBe(0);
    });

    it('formats break-even sentence accurately for high accuracy requirements', () => {
      // 20 attempts, cutoff 15, +1 / -0.25 => needed is 80%
      const sentence = calculateBreakEvenSentence(20, 15, 1.0, 0.25);
      expect(sentence).toBe('At your current attempt rate of 20 questions, you need 80% accuracy to reach the target cutoff of 15.');
    });
  });

  describe('No Negative Marking Edge Case', () => {
    it('calculates break even sentence when negativeMark is 0', () => {
      // 20 attempts, cutoff 15, +1 / 0 => needed is 75%
      const sentence = calculateBreakEvenSentence(20, 15, 1.0, 0);
      expect(sentence).toBe('At your current attempt rate of 20 questions, you need 75% accuracy to reach the target cutoff of 15.');
    });

    it('handles impossible cutoff target', () => {
      const sentence = calculateBreakEvenSentence(10, 15, 1.0, 0.25);
      expect(sentence).toContain('even 100% accuracy yields at most 10 marks');
    });

    it('generates accuracy tier curves for 70%, 80%, 90%', () => {
      const curves = generateAccuracyTierCurves(1.0, 0.25, 35, [70, 80, 90]);
      expect(curves.length).toBeGreaterThan(0);
      const last = curves[curves.length - 1];
      expect(last.attempts).toBe(35);
      expect(last.scoreTier3).toBeGreaterThan(last.scoreTier2);
      expect(last.scoreTier2).toBeGreaterThan(last.scoreTier1);
    });
  });

  describe('Repeated Mistakes Across 2+ Mocks', () => {
    const mistakes: MistakeEntry[] = [
      {
        id: 1,
        mockId: 101,
        mockName: 'Mock 01',
        sectionId: 'quant',
        sectionName: 'Quant',
        topic: 'Simplification',
        questionNumber: 1,
        questionText: 'Q1',
        myAnswer: 'A',
        correctAnswer: 'B',
        resultType: 'Wrong',
        errorTypes: ['Calculation Error'],
        timeSpentSeconds: 90,
        idealTimeSeconds: 45,
        whatWentWrong: 'Multiplication slip',
        correctSolution: 'B',
        betterApproach: 'Vedic trick',
        ruleToRemember: 'Double check',
        difficulty: 'Easy',
        tags: [],
        status: 'Active',
        interval: 1,
        consecutiveCorrect: 0,
        nextReviewDate: '2026-11-05',
        history: [],
        createdAt: '2026-11-01'
      },
      {
        id: 2,
        mockId: 102,
        mockName: 'Mock 02',
        sectionId: 'quant',
        sectionName: 'Quant',
        topic: 'Simplification',
        questionNumber: 5,
        questionText: 'Q5',
        myAnswer: 'C',
        correctAnswer: 'D',
        resultType: 'Wrong',
        errorTypes: ['Calculation Error'],
        timeSpentSeconds: 85,
        idealTimeSeconds: 45,
        whatWentWrong: 'Addition slip',
        correctSolution: 'D',
        betterApproach: 'Unit digit',
        ruleToRemember: 'Check unit digit',
        difficulty: 'Easy',
        tags: [],
        status: 'Active',
        interval: 1,
        consecutiveCorrect: 0,
        nextReviewDate: '2026-11-05',
        history: [],
        createdAt: '2026-11-03'
      },
      {
        id: 3,
        mockId: 101,
        mockName: 'Mock 01',
        sectionId: 'reasoning',
        sectionName: 'Reasoning',
        topic: 'Puzzles',
        questionNumber: 12,
        questionText: 'Q12',
        myAnswer: 'B',
        correctAnswer: 'A',
        resultType: 'Wrong',
        errorTypes: ['Misread Question'],
        timeSpentSeconds: 120,
        idealTimeSeconds: 90,
        whatWentWrong: 'Missed condition',
        correctSolution: 'A',
        betterApproach: 'Draw grid',
        ruleToRemember: 'Check all conditions',
        difficulty: 'Medium',
        tags: [],
        status: 'Active',
        interval: 1,
        consecutiveCorrect: 0,
        nextReviewDate: '2026-11-05',
        history: [],
        createdAt: '2026-11-01'
      }
    ];

    it('identifies errors and topics recurring in 2+ mocks', () => {
      const repeated = calculateRepeatedMistakes(mistakes);
      expect(repeated.some((r) => r.name === 'Calculation Error' && r.mockCount >= 2)).toBe(true);
      expect(repeated.some((r) => r.name === 'Simplification' && r.mockCount >= 2)).toBe(true);
      // 'Misread Question' only in mock 101, should NOT be in repeated
      expect(repeated.some((r) => r.name === 'Misread Question')).toBe(false);
    });

    it('computes time analysis and detects time sinks', () => {
      const timeData = calculateTimeAnalysis(mistakes);
      expect(timeData.avgTimeWrongSeconds).toBeGreaterThan(0);
      expect(timeData.timeWastageRatio).toBeGreaterThan(1.0);
      expect(timeData.topicsWastingTime.length).toBeGreaterThan(0);
    });
  });

  describe('Target Gap Analysis', () => {
    it('calculates cutoff gap and target score gap accurately', () => {
      const gap = calculateTargetGap(52.5, 58, 68);
      expect(gap.cutoffGap).toBe(5.5);
      expect(gap.targetGap).toBe(15.5);
      expect(gap.passedCutoff).toBe(false);
      expect(gap.passedTarget).toBe(false);
    });

    it('identifies when cutoff is passed but target is not', () => {
      const gap = calculateTargetGap(60, 58, 68);
      expect(gap.cutoffGap).toBe(0);
      expect(gap.targetGap).toBe(8);
      expect(gap.passedCutoff).toBe(true);
      expect(gap.passedTarget).toBe(false);
      expect(gap.summarySentence).toContain('Cutoff cleared');
    });
  });
});
