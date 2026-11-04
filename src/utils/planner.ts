import { PlannerInput, PlannerResult, WhatIfSectionInput, WhatIfResult } from '../types';

/**
 * Calculates the expected score per question attempt.
 * E = p * marks_correct - (1 - p) * negative_marks
 * where p = accuracy in [0, 1]
 */
export function calculateExpectedScorePerAttempt(
  accuracyPercent: number,
  marksPerCorrect: number,
  negativeMark: number
): number {
  const p = Math.max(0, Math.min(100, accuracyPercent)) / 100;
  return p * marksPerCorrect - (1 - p) * negativeMark;
}

/**
 * Calculates the break-even accuracy (where EV >= 0).
 * p_be = negative_mark / (marks_correct + negative_mark)
 */
export function calculateBreakEvenAccuracy(
  marksPerCorrect: number,
  negativeMark: number
): number {
  if (negativeMark <= 0) return 0;
  const denominator = marksPerCorrect + negativeMark;
  if (denominator <= 0) return 0;
  return Number(((negativeMark / denominator) * 100).toFixed(2));
}

/**
 * Solves for the number of attempts needed to reach a target score.
 */
export function calculateAttemptsNeeded(input: PlannerInput): PlannerResult {
  const {
    targetScore,
    accuracyPercent,
    marksPerCorrect,
    negativeMark,
    maxQuestions = 35
  } = input;

  const breakEvenAccuracyPercent = calculateBreakEvenAccuracy(marksPerCorrect, negativeMark);
  const expectedPerAttempt = calculateExpectedScorePerAttempt(accuracyPercent, marksPerCorrect, negativeMark);

  // Edge Case 1: Target score is <= 0
  if (targetScore <= 0) {
    return {
      attemptsNeeded: 0,
      isAchievable: true,
      expectedScorePerAttempt: expectedPerAttempt,
      breakEvenAccuracyPercent,
      explanation: `Target score is 0 or negative. 0 attempts needed.`,
      curveData: generateCurveData(accuracyPercent, marksPerCorrect, negativeMark, maxQuestions)
    };
  }

  // Edge Case 2: Expected score per attempt is <= 0 (accuracy is below or at break-even)
  if (expectedPerAttempt <= 0) {
    return {
      attemptsNeeded: Infinity,
      isAchievable: false,
      expectedScorePerAttempt: expectedPerAttempt,
      breakEvenAccuracyPercent,
      explanation: `At ${accuracyPercent.toFixed(1)}% accuracy, expected value per question is ${expectedPerAttempt.toFixed(2)} marks (below break-even ${breakEvenAccuracyPercent}%). You cannot reach ${targetScore} marks. Improve accuracy first!`,
      curveData: generateCurveData(accuracyPercent, marksPerCorrect, negativeMark, maxQuestions)
    };
  }

  const rawAttempts = targetScore / expectedPerAttempt;
  const attemptsNeeded = Math.ceil(rawAttempts);
  const isAchievable = attemptsNeeded <= maxQuestions;

  const formattedTarget = Number(targetScore.toFixed(2));
  const maxLabel = maxQuestions ? ` of ${maxQuestions}` : '';
  const explanation = isAchievable
    ? `At ${accuracyPercent.toFixed(0)}% accuracy you need to attempt ${attemptsNeeded}${maxLabel} questions to score ${formattedTarget}.`
    : `To score ${formattedTarget} at ${accuracyPercent.toFixed(0)}% accuracy, you'd need ${attemptsNeeded} attempts, which exceeds available questions (${maxQuestions}). Target higher accuracy.`;

  return {
    attemptsNeeded,
    isAchievable,
    expectedScorePerAttempt: expectedPerAttempt,
    breakEvenAccuracyPercent,
    explanation,
    curveData: generateCurveData(accuracyPercent, marksPerCorrect, negativeMark, Math.max(maxQuestions, attemptsNeeded + 5))
  };
}

/**
 * Computes the exact break-even sentence:
 * "At your current attempt rate of X questions, you need Y% accuracy to reach the target cutoff of Z."
 */
export function calculateBreakEvenSentence(
  attempts: number,
  cutoffScore: number,
  marksPerCorrect: number,
  negativeMark: number
): string {
  if (attempts <= 0) {
    return 'At 0 attempts, you cannot reach the cutoff score.';
  }

  const maxPossible = Number((attempts * marksPerCorrect).toFixed(2));
  if (cutoffScore > maxPossible) {
    return `At your current attempt rate of ${attempts} questions, even 100% accuracy yields at most ${maxPossible} marks, which cannot reach the target cutoff of ${cutoffScore}. You need to attempt at least ${Math.ceil(cutoffScore / marksPerCorrect)} questions.`;
  }

  const denom = marksPerCorrect + negativeMark;
  if (denom <= 0) return 'Invalid marking scheme.';

  // Net Score = attempts * [ p * (marksPerCorrect + negativeMark) - negativeMark ] = cutoffScore
  const p = (cutoffScore / attempts + negativeMark) / denom;
  const reqAcc = Number(Math.max(0, Math.min(100, p * 100)).toFixed(1));

  return `At your current attempt rate of ${attempts} questions, you need ${reqAcc}% accuracy to reach the target cutoff of ${cutoffScore}.`;
}

/**
 * Generates data points for Expected Score vs Attempts across 3 accuracy tiers (e.g. 70%, 80%, 90%).
 */
export function generateAccuracyTierCurves(
  marksPerCorrect: number,
  negativeMark: number,
  maxQuestions: number,
  tiers: [number, number, number] = [70, 80, 90]
) {
  const points: Array<{
    attempts: number;
    scoreTier1: number;
    scoreTier2: number;
    scoreTier3: number;
  }> = [];

  const step = Math.max(1, Math.round(maxQuestions / 15));
  const attemptsSet = new Set<number>([0]);
  for (let a = step; a <= maxQuestions; a += step) {
    attemptsSet.add(a);
  }
  attemptsSet.add(maxQuestions);

  const sortedAttempts = Array.from(attemptsSet).sort((a, b) => a - b);

  for (const attempts of sortedAttempts) {
    const scoreTier1 = attempts * calculateExpectedScorePerAttempt(tiers[0], marksPerCorrect, negativeMark);
    const scoreTier2 = attempts * calculateExpectedScorePerAttempt(tiers[1], marksPerCorrect, negativeMark);
    const scoreTier3 = attempts * calculateExpectedScorePerAttempt(tiers[2], marksPerCorrect, negativeMark);

    points.push({
      attempts,
      scoreTier1: Number(scoreTier1.toFixed(2)),
      scoreTier2: Number(scoreTier2.toFixed(2)),
      scoreTier3: Number(scoreTier3.toFixed(2)),
    });
  }

  return points;
}

/**
 * Generates legacy curve data points for Expected Score vs Attempts across current +- 10% tiers.
 */
export function generateCurveData(
  currentAccuracy: number,
  marksPerCorrect: number,
  negativeMark: number,
  maxQuestions: number
) {
  const accCurrent = Math.max(0, Math.min(100, currentAccuracy));
  const accMinus10 = Math.max(0, currentAccuracy - 10);
  const accPlus10 = Math.min(100, currentAccuracy + 10);

  const points: Array<{
    attempts: number;
    scoreCurrent: number;
    scoreMinus10: number;
    scorePlus10: number;
  }> = [];

  const step = Math.max(1, Math.round(maxQuestions / 15));
  const attemptsSet = new Set<number>([0]);
  for (let a = step; a <= maxQuestions; a += step) {
    attemptsSet.add(a);
  }
  attemptsSet.add(maxQuestions);

  const sortedAttempts = Array.from(attemptsSet).sort((a, b) => a - b);

  for (const attempts of sortedAttempts) {
    const scoreCurrent = attempts * calculateExpectedScorePerAttempt(accCurrent, marksPerCorrect, negativeMark);
    const scoreMinus10 = attempts * calculateExpectedScorePerAttempt(accMinus10, marksPerCorrect, negativeMark);
    const scorePlus10 = attempts * calculateExpectedScorePerAttempt(accPlus10, marksPerCorrect, negativeMark);

    points.push({
      attempts,
      scoreCurrent: Number(scoreCurrent.toFixed(2)),
      scoreMinus10: Number(scoreMinus10.toFixed(2)),
      scorePlus10: Number(scorePlus10.toFixed(2)),
    });
  }

  return points;
}

/**
 * Calculates projected scores for What-If simulator.
 */
export function calculateWhatIfProjections(
  sections: WhatIfSectionInput[],
  overallCutoff: number,
  overallTarget: number
): WhatIfResult {
  let totalScore = 0;

  const sectionResults = sections.map((sec) => {
    const attempts = Math.max(0, Math.min(sec.totalQuestions, sec.attempts));
    const ev = calculateExpectedScorePerAttempt(sec.accuracyPercent, sec.marksPerCorrect, sec.negativeMark);
    const net = Number((attempts * ev).toFixed(2));
    totalScore += net;

    return {
      sectionId: sec.sectionId,
      sectionName: sec.sectionName,
      projectedNetScore: net,
      passedCutoff: net >= sec.cutoff,
      cutoff: sec.cutoff
    };
  });

  totalScore = Number(totalScore.toFixed(2));

  return {
    sections: sectionResults,
    totalScore,
    passedOverallCutoff: totalScore >= overallCutoff,
    hitTargetScore: totalScore >= overallTarget
  };
}

/**
 * Suggested time allocation per section based on marks earned per minute.
 */
export interface TimePlanRecommendation {
  sectionId: string;
  sectionName: string;
  marksPerMinute: number;
  suggestedMinutes: number;
  attemptPriority: number; // 1 = highest
  reason: string;
}

export function calculateTimePlan(
  sections: Array<{ id: string; name: string; defaultTimeLimit: number }>,
  historicalSectionData: Array<{ sectionId: string; netScore: number; timeMinutes: number }>,
  totalTestMinutes: number
): TimePlanRecommendation[] {
  const aggregates: Record<string, { totalScore: number; totalMinutes: number }> = {};
  for (const sec of sections) {
    aggregates[sec.id] = { totalScore: 0, totalMinutes: 0 };
  }

  for (const item of historicalSectionData) {
    if (aggregates[item.sectionId]) {
      aggregates[item.sectionId].totalScore += item.netScore;
      aggregates[item.sectionId].totalMinutes += item.timeMinutes;
    }
  }

  const rates = sections.map((sec) => {
    const agg = aggregates[sec.id];
    const mpm = agg && agg.totalMinutes > 0 ? agg.totalScore / agg.totalMinutes : 0.8;
    return {
      sectionId: sec.id,
      sectionName: sec.name,
      defaultTime: sec.defaultTimeLimit || Math.round(totalTestMinutes / sections.length),
      marksPerMinute: Math.max(0.1, Number(mpm.toFixed(2)))
    };
  });

  rates.sort((a, b) => b.marksPerMinute - a.marksPerMinute);
  const totalWeight = rates.reduce((sum, r) => sum + r.defaultTime, 0) || 1;

  return rates.map((r, index) => {
    const suggestedMinutes = Math.round((r.defaultTime / totalWeight) * totalTestMinutes);
    let reason = '';
    if (index === 0) {
      reason = `Highest scoring rate (${r.marksPerMinute} marks/min). Attempt first to secure early momentum.`;
    } else if (index === rates.length - 1) {
      reason = `Lower scoring rate (${r.marksPerMinute} marks/min). Save for last; solve high-confidence questions only.`;
    } else {
      reason = `Steady scoring rate (${r.marksPerMinute} marks/min). Maintain steady pacing.`;
    }

    return {
      sectionId: r.sectionId,
      sectionName: r.sectionName,
      marksPerMinute: r.marksPerMinute,
      suggestedMinutes,
      attemptPriority: index + 1,
      reason
    };
  });
}

/**
 * Computes actionable gap analysis to reach target score.
 */
export function calculateGapAnalysis(
  targetScore: number,
  recentAvgScore: number,
  marksLostSillyMistakes: number,
  topWeakTopicLoss: { topic: string; marksLost: number } | null
): {
  gap: number;
  sillyRecoverable: number;
  weakTopicRecoverable: number;
  summarySentence: string;
} {
  const gap = Math.max(0, Number((targetScore - recentAvgScore).toFixed(2)));
  const sillyRecoverable = Number(Math.min(gap, marksLostSillyMistakes).toFixed(2));
  const weakLoss = topWeakTopicLoss ? topWeakTopicLoss.marksLost : 0;
  const weakTopicRecoverable = Number(Math.min(gap - sillyRecoverable, weakLoss).toFixed(2));

  let summarySentence = '';
  if (gap <= 0) {
    summarySentence = `Target achieved! You are currently averaging ${recentAvgScore} marks, matching or beating your target of ${targetScore}.`;
  } else {
    const parts: string[] = [];
    if (sillyRecoverable > 0) {
      parts.push(`roughly +${sillyRecoverable} marks from eliminating silly/calculation mistakes`);
    }
    if (topWeakTopicLoss && weakTopicRecoverable > 0) {
      parts.push(`+${weakTopicRecoverable} marks by mastering ${topWeakTopicLoss.topic}`);
    }
    if (parts.length > 0) {
      summarySentence = `To reach your target (${targetScore}), you need +${gap} marks: ${parts.join(' and ')}.`;
    } else {
      summarySentence = `To reach your target (${targetScore}), you need +${gap} marks across sections with higher question attempts and accuracy.`;
    }
  }

  return {
    gap,
    sillyRecoverable,
    weakTopicRecoverable,
    summarySentence
  };
}

/**
 * Computes Target Gap Analysis comparing current score vs exam cutoff and target score.
 */
export function calculateTargetGap(
  currentScore: number,
  overallCutoff: number,
  targetScore: number
): {
  cutoffGap: number;
  targetGap: number;
  passedCutoff: boolean;
  passedTarget: boolean;
  summarySentence: string;
} {
  const cutoffGap = Number(Math.max(0, overallCutoff - currentScore).toFixed(2));
  const targetGap = Number(Math.max(0, targetScore - currentScore).toFixed(2));
  const passedCutoff = currentScore >= overallCutoff;
  const passedTarget = currentScore >= targetScore;

  let summarySentence = '';
  if (passedTarget) {
    summarySentence = `Target achieved! Current score (${currentScore}) exceeds target of ${targetScore}.`;
  } else if (passedCutoff) {
    summarySentence = `Cutoff cleared (+${(currentScore - overallCutoff).toFixed(1)} marks above cutoff). You need +${targetGap} marks to reach target (${targetScore}).`;
  } else {
    summarySentence = `Below cutoff by ${cutoffGap} marks. Overall gap to target score (${targetScore}) is ${targetGap} marks.`;
  }

  return {
    cutoffGap,
    targetGap,
    passedCutoff,
    passedTarget,
    summarySentence
  };
}
