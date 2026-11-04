import { MockTest, MistakeEntry, ExamSettings } from '../types';

export interface InsightCard {
  id: string;
  type: 'danger' | 'warning' | 'success' | 'info';
  title: string;
  description: string;
  metric?: string;
  section?: string;
}

export interface FocusAction {
  id: string;
  priority: 'High' | 'Medium';
  section: string;
  actionText: string;
  expectedMarkGain: number;
}

export interface GeneratedInsights {
  keyInsights: InsightCard[];
  focusActions: FocusAction[];
  repeatedMistakes: Array<{
    type: 'topic' | 'errorType';
    name: string;
    section: string;
    count: number;
    mockCount: number;
  }>;
  recentScoreDiff: {
    last3Avg: number;
    prev3Avg: number;
    delta: number;
  };
}

export interface ImprovementMetrics {
  hasEnoughData: boolean;
  message: string;
  last3ScoreAvg: number;
  prev3ScoreAvg: number;
  scoreDelta: number;
  last3AccuracyAvg: number;
  prev3AccuracyAvg: number;
  accuracyDelta: number;
  last3PercentileAvg: number;
  prev3PercentileAvg: number;
  percentileDelta: number;
}

export interface MarksLostBreakdown {
  totalNegativeLost: number;
  totalUnattemptedPotentialLost: number;
  totalMarksLost: number;
  negativePercentage: number;
  unattemptedPercentage: number;
  bySection: Array<{
    sectionName: string;
    negativeLost: number;
    unattemptedLost: number;
  }>;
}

export interface ErrorDistributionItem {
  name: string;
  count: number;
  percentage: number;
}

export interface TopicWeaknessItem {
  topic: string;
  sectionName: string;
  unresolvedMistakes: number;
  totalMistakes: number;
  marksLostNegative: number;
  avgTimeSpent: number;
  idealTime: number;
  isRecurring: boolean;
}

export interface TimeAnalysisData {
  avgTimeWrongSeconds: number;
  avgTimeIdealSeconds: number;
  timeWastageRatio: number;
  topicsWastingTime: Array<{
    topic: string;
    sectionName: string;
    wrongCount: number;
    avgTimeSpent: number;
    idealTime: number;
    ratio: number;
  }>;
}

export interface AccuracyVsAttemptsPoint {
  mockId?: number;
  mockName: string;
  date: string;
  attempts: number;
  accuracy: number;
  score: number;
  percentile?: number;
}

export function generateInsights(
  mocks: MockTest[],
  mistakes: MistakeEntry[],
  settings?: ExamSettings
): GeneratedInsights {
  const keyInsights: InsightCard[] = [];
  const focusActions: FocusAction[] = [];

  // 1. Zero Fake Data Empty State
  if (mocks.length === 0 && mistakes.length === 0) {
    return {
      keyInsights: [
        {
          id: 'welcome',
          type: 'info',
          title: 'Awaiting Mock Data',
          description: 'Needs at least 1 mock to calculate trend and identify vulnerabilities. Paste your Testbook scorecard or add manual entry to start.'
        }
      ],
      focusActions: [
        {
          id: 'start',
          priority: 'High',
          section: 'All',
          actionText: 'Log your latest Testbook mock to calibrate your target attempt strategy.',
          expectedMarkGain: 5.0
        }
      ],
      repeatedMistakes: [],
      recentScoreDiff: { last3Avg: 0, prev3Avg: 0, delta: 0 }
    };
  }

  // 2. Negative Marking Leak Analysis (Last 5 mocks)
  const recentMocks = mocks.slice(-5);
  let totalNegativeLost = 0;
  const sectionNegLost: Record<string, number> = {};

  for (const m of recentMocks) {
    totalNegativeLost += m.totalMarksLostNegative || 0;
    for (const s of m.sections || []) {
      sectionNegLost[s.sectionName] = (sectionNegLost[s.sectionName] || 0) + (s.marksLostNegative || 0);
    }
  }

  let worstNegSection = '';
  let worstNegAmount = 0;
  for (const [sec, amt] of Object.entries(sectionNegLost)) {
    if (amt > worstNegAmount) {
      worstNegAmount = amt;
      worstNegSection = sec;
    }
  }

  const guessedCount = mistakes.filter(
    (m) => (m.errorTypes || []).includes('Guessed (no basis)') && (!worstNegSection || m.sectionName === worstNegSection)
  ).length;
  const totalSectionMistakes = mistakes.filter((m) => !worstNegSection || m.sectionName === worstNegSection).length;
  const guessPct = totalSectionMistakes > 0 ? Math.round((guessedCount / totalSectionMistakes) * 100) : 0;

  if (worstNegAmount > 0) {
    keyInsights.push({
      id: 'neg-marking',
      type: 'danger',
      title: 'Negative Marking Drain',
      metric: `-${worstNegAmount.toFixed(2)} marks`,
      section: worstNegSection,
      description: `You lost ${worstNegAmount.toFixed(2)} marks to negative marking in ${worstNegSection} across your last ${recentMocks.length} mocks.${
        guessPct > 0 ? ` ${guessPct}% were random guesses.` : ''
      }`
    });
  }

  // 3. Top Error Type by Section
  const errorTypeCountBySec: Record<string, Record<string, number>> = {};
  const totalMistakesBySec: Record<string, number> = {};

  for (const m of mistakes) {
    if (!errorTypeCountBySec[m.sectionName]) {
      errorTypeCountBySec[m.sectionName] = {};
      totalMistakesBySec[m.sectionName] = 0;
    }
    totalMistakesBySec[m.sectionName]++;
    for (const err of m.errorTypes || []) {
      errorTypeCountBySec[m.sectionName][err] = (errorTypeCountBySec[m.sectionName][err] || 0) + 1;
    }
  }

  for (const [sec, errors] of Object.entries(errorTypeCountBySec)) {
    let topErr = '';
    let topCount = 0;
    for (const [err, count] of Object.entries(errors)) {
      if (count > topCount) {
        topCount = count;
        topErr = err;
      }
    }
    if (topCount >= 2) {
      keyInsights.push({
        id: `top-err-${sec}`,
        type: 'warning',
        title: `Primary Vulnerability: ${sec}`,
        metric: `${topCount} of ${totalMistakesBySec[sec]}`,
        section: sec,
        description: `"${topErr}" is your top error type in ${sec} (${topCount} of ${totalMistakesBySec[sec]} logged mistakes).`
      });
    }
  }

  // 4. Weakest Topic Detection
  const topicCounts: Record<string, { mistakes: number; section: string; pendingReviews: number }> = {};
  for (const m of mistakes) {
    if (!topicCounts[m.topic]) {
      topicCounts[m.topic] = { mistakes: 0, section: m.sectionName, pendingReviews: 0 };
    }
    topicCounts[m.topic].mistakes++;
    if (m.status !== 'Mastered') {
      topicCounts[m.topic].pendingReviews++;
    }
  }

  const sortedTopics = Object.entries(topicCounts).sort((a, b) => b[1].mistakes - a[1].mistakes);
  if (sortedTopics.length > 0) {
    const [worstTopic, info] = sortedTopics[0];
    keyInsights.push({
      id: 'weakest-topic',
      type: 'warning',
      title: `Critical Weak Area: ${worstTopic}`,
      metric: `${info.mistakes} mistakes`,
      section: info.section,
      description: `${worstTopic} has accumulated ${info.mistakes} mistakes with ${info.pendingReviews} pending in your daily review queue.`
    });

    focusActions.push({
      id: 'action-topic',
      priority: 'High',
      section: info.section,
      actionText: `Clear all ${info.pendingReviews} pending reviews in "${worstTopic}" using Flashcards mode.`,
      expectedMarkGain: Number((info.mistakes * 1.25).toFixed(1))
    });
  }

  // 5. Repeated Mistakes across 2+ Mocks
  const repeatedMistakes = calculateRepeatedMistakes(mistakes);

  // 6. Improvement Metrics & Trajectory
  const improvement = calculateImprovementMetrics(mocks);
  if (mocks.length >= 3) {
    keyInsights.push({
      id: 'improvement-trend',
      type: improvement.scoreDelta >= 0 ? 'success' : 'warning',
      title: improvement.scoreDelta >= 0 ? 'Upward Trajectory' : 'Score Dip Observed',
      metric: `${improvement.scoreDelta >= 0 ? '+' : ''}${improvement.scoreDelta} marks`,
      section: 'Overall',
      description: `Recent mock average is ${improvement.last3ScoreAvg} marks vs earlier ${improvement.prev3ScoreAvg} marks (${improvement.scoreDelta >= 0 ? 'improved by' : 'down by'} ${Math.abs(improvement.scoreDelta)} marks).`
    });
  } else if (mocks.length > 0) {
    keyInsights.push({
      id: 'trend-insufficient',
      type: 'info',
      title: 'Trend Calibration in Progress',
      metric: `${mocks.length} of 3 mocks`,
      section: 'Overall',
      description: 'Needs at least 3 mocks to calculate full score delta and trajectory trend.'
    });
  }

  // Focus Actions
  if (focusActions.length < 3 && worstNegAmount > 0) {
    focusActions.push({
      id: 'action-neg',
      priority: 'High',
      section: worstNegSection || 'Overall',
      actionText: `Eliminate speculative guessing in ${worstNegSection}. Only mark answers with >=80% confidence.`,
      expectedMarkGain: Number((worstNegAmount * 0.7).toFixed(1))
    });
  }

  if (focusActions.length < 3) {
    focusActions.push({
      id: 'action-time',
      priority: 'Medium',
      section: 'Strategy',
      actionText: 'Apply the 60-second rule: If an arithmetic or puzzle step is not clear in 60s, flag and move on immediately.',
      expectedMarkGain: 2.5
    });
  }

  if (focusActions.length < 3) {
    focusActions.push({
      id: 'action-cheat-sheet',
      priority: 'Medium',
      section: 'Revision',
      actionText: 'Review your Cheat Sheet rules before attempting the next full-length mock.',
      expectedMarkGain: 2.0
    });
  }

  return {
    keyInsights,
    focusActions: focusActions.slice(0, 3),
    repeatedMistakes,
    recentScoreDiff: {
      last3Avg: improvement.last3ScoreAvg,
      prev3Avg: improvement.prev3ScoreAvg,
      delta: improvement.scoreDelta
    }
  };
}

/**
 * Calculates Improvement View delta between last 3 mocks vs previous 3 mocks.
 */
export function calculateImprovementMetrics(mocks: MockTest[]): ImprovementMetrics {
  if (mocks.length < 2) {
    const single = mocks[0];
    return {
      hasEnoughData: false,
      message: `Needs at least 2 mocks to calculate trend delta (currently ${mocks.length} mock logged).`,
      last3ScoreAvg: single ? single.totalNetScore : 0,
      prev3ScoreAvg: single ? single.totalNetScore : 0,
      scoreDelta: 0,
      last3AccuracyAvg: single ? single.overallAccuracy : 0,
      prev3AccuracyAvg: single ? single.overallAccuracy : 0,
      accuracyDelta: 0,
      last3PercentileAvg: single ? single.overallPercentile || 0 : 0,
      prev3PercentileAvg: single ? single.overallPercentile || 0 : 0,
      percentileDelta: 0
    };
  }

  let lMocks: MockTest[];
  let pMocks: MockTest[];

  if (mocks.length >= 6) {
    lMocks = mocks.slice(-3);
    pMocks = mocks.slice(-6, -3);
  } else {
    const mid = Math.floor(mocks.length / 2);
    pMocks = mocks.slice(0, mid);
    lMocks = mocks.slice(mid);
  }

  const avg = (arr: MockTest[], fn: (m: MockTest) => number) =>
    arr.length > 0 ? Number((arr.reduce((s, m) => s + (fn(m) || 0), 0) / arr.length).toFixed(2)) : 0;

  const last3ScoreAvg = avg(lMocks, (m) => m.totalNetScore);
  const prev3ScoreAvg = avg(pMocks, (m) => m.totalNetScore);
  const scoreDelta = Number((last3ScoreAvg - prev3ScoreAvg).toFixed(2));

  const last3AccuracyAvg = avg(lMocks, (m) => m.overallAccuracy);
  const prev3AccuracyAvg = avg(pMocks, (m) => m.overallAccuracy);
  const accuracyDelta = Number((last3AccuracyAvg - prev3AccuracyAvg).toFixed(2));

  const last3PercentileAvg = avg(lMocks, (m) => m.overallPercentile || 0);
  const prev3PercentileAvg = avg(pMocks, (m) => m.overallPercentile || 0);
  const percentileDelta = Number((last3PercentileAvg - prev3PercentileAvg).toFixed(2));

  return {
    hasEnoughData: true,
    message: mocks.length >= 6
      ? 'Comparing last 3 mocks vs previous 3 mocks baseline.'
      : `Comparing recent ${lMocks.length} mock(s) vs earlier ${pMocks.length} mock(s). Log 6+ mocks for full 3v3 baseline.`,
    last3ScoreAvg,
    prev3ScoreAvg,
    scoreDelta,
    last3AccuracyAvg,
    prev3AccuracyAvg,
    accuracyDelta,
    last3PercentileAvg,
    prev3PercentileAvg,
    percentileDelta
  };
}

/**
 * Calculates repeated mistakes repeating same error type or topic across 2+ mocks.
 */
export function calculateRepeatedMistakes(mistakes: MistakeEntry[]): GeneratedInsights['repeatedMistakes'] {
  const repeated: GeneratedInsights['repeatedMistakes'] = [];
  const errorMockTracker: Record<string, { mocks: Set<string | number>; section: string; totalCount: number }> = {};
  const topicMockTracker: Record<string, { mocks: Set<string | number>; section: string; totalCount: number }> = {};

  for (const m of mistakes) {
    const mockIdentifier = m.mockId ?? m.mockName;
    for (const err of m.errorTypes || []) {
      const key = `${m.sectionName}:::${err}`;
      if (!errorMockTracker[key]) {
        errorMockTracker[key] = { mocks: new Set(), section: m.sectionName, totalCount: 0 };
      }
      if (mockIdentifier !== undefined) errorMockTracker[key].mocks.add(mockIdentifier);
      errorMockTracker[key].totalCount++;
    }

    if (m.topic) {
      const tKey = `${m.sectionName}:::${m.topic}`;
      if (!topicMockTracker[tKey]) {
        topicMockTracker[tKey] = { mocks: new Set(), section: m.sectionName, totalCount: 0 };
      }
      if (mockIdentifier !== undefined) topicMockTracker[tKey].mocks.add(mockIdentifier);
      topicMockTracker[tKey].totalCount++;
    }
  }

  for (const [key, data] of Object.entries(errorMockTracker)) {
    if (data.mocks.size >= 2) {
      const [, errName] = key.split(':::');
      repeated.push({
        type: 'errorType',
        name: errName,
        section: data.section,
        count: data.totalCount,
        mockCount: data.mocks.size
      });
    }
  }

  for (const [key, data] of Object.entries(topicMockTracker)) {
    if (data.mocks.size >= 2) {
      const [, topicName] = key.split(':::');
      repeated.push({
        type: 'topic',
        name: topicName,
        section: data.section,
        count: data.totalCount,
        mockCount: data.mocks.size
      });
    }
  }

  repeated.sort((a, b) => b.mockCount - a.mockCount || b.count - a.count);
  return repeated;
}

/**
 * Calculates Marks-Lost breakdown (wrong answer penalty vs unattempted potential).
 */
export function calculateMarksLostBreakdown(mocks: MockTest[], settings?: ExamSettings): MarksLostBreakdown {
  let totalNegativeLost = 0;
  let totalUnattemptedPotentialLost = 0;
  const sectionBreakdown: Record<string, { negative: number; unattempted: number }> = {};

  for (const m of mocks) {
    totalNegativeLost += m.totalMarksLostNegative || 0;
    for (const sec of m.sections || []) {
      if (!sectionBreakdown[sec.sectionName]) {
        sectionBreakdown[sec.sectionName] = { negative: 0, unattempted: 0 };
      }
      sectionBreakdown[sec.sectionName].negative += sec.marksLostNegative || 0;

      const secConf = settings?.sections.find((s) => s.name === sec.sectionName || s.id === sec.sectionId);
      const marksPerCorr = secConf ? secConf.marksPerCorrect : 1.0;
      const unattemptedMarks = (sec.unattempted || 0) * marksPerCorr;

      sectionBreakdown[sec.sectionName].unattempted += unattemptedMarks;
      totalUnattemptedPotentialLost += unattemptedMarks;
    }
  }

  totalNegativeLost = Number(totalNegativeLost.toFixed(2));
  totalUnattemptedPotentialLost = Number(totalUnattemptedPotentialLost.toFixed(2));
  const totalMarksLost = Number((totalNegativeLost + totalUnattemptedPotentialLost).toFixed(2));

  const negativePercentage = totalMarksLost > 0 ? Math.round((totalNegativeLost / totalMarksLost) * 100) : 0;
  const unattemptedPercentage = totalMarksLost > 0 ? 100 - negativePercentage : 0;

  const bySection = Object.entries(sectionBreakdown).map(([sectionName, data]) => ({
    sectionName,
    negativeLost: Number(data.negative.toFixed(2)),
    unattemptedLost: Number(data.unattempted.toFixed(2))
  }));

  return {
    totalNegativeLost,
    totalUnattemptedPotentialLost,
    totalMarksLost,
    negativePercentage,
    unattemptedPercentage,
    bySection
  };
}

/**
 * Calculates Root Cause Error Distribution.
 */
export function calculateErrorDistribution(mistakes: MistakeEntry[]): ErrorDistributionItem[] {
  const counts: Record<string, number> = {};
  let total = 0;
  for (const m of mistakes) {
    for (const err of m.errorTypes || []) {
      counts[err] = (counts[err] || 0) + 1;
      total++;
    }
  }

  const items = Object.entries(counts).map(([name, count]) => ({
    name,
    count,
    percentage: total > 0 ? Math.round((count / total) * 100) : 0
  }));

  items.sort((a, b) => b.count - a.count);
  return items;
}

/**
 * Calculates Topic Weakness Table sorted by net marks lost or unresolved errors.
 */
export function calculateTopicWeaknesses(
  mistakes: MistakeEntry[],
  mocks: MockTest[] = [],
  settings?: ExamSettings
): TopicWeaknessItem[] {
  const map: Record<string, {
    topic: string;
    sectionName: string;
    unresolved: number;
    total: number;
    negativeLost: number;
    timeSpentTotal: number;
    idealTimeTotal: number;
    timeCount: number;
    mockSet: Set<string | number>;
  }> = {};

  for (const m of mistakes) {
    const key = `${m.sectionName}:::${m.topic}`;
    if (!map[key]) {
      map[key] = {
        topic: m.topic,
        sectionName: m.sectionName,
        unresolved: 0,
        total: 0,
        negativeLost: 0,
        timeSpentTotal: 0,
        idealTimeTotal: 0,
        timeCount: 0,
        mockSet: new Set()
      };
    }
    const item = map[key];
    item.total++;
    if (m.status !== 'Mastered') item.unresolved++;
    if (m.mockId !== undefined) item.mockSet.add(m.mockId);
    else if (m.mockName) item.mockSet.add(m.mockName);

    const secConf = settings?.sections.find((s) => s.name === m.sectionName || s.id === m.sectionId);
    const negPenalty = secConf ? secConf.negativeMark : 0.25;
    if (m.resultType === 'Wrong') {
      item.negativeLost += negPenalty;
    }

    if (m.timeSpentSeconds > 0) {
      item.timeSpentTotal += m.timeSpentSeconds;
      item.idealTimeTotal += m.idealTimeSeconds || 60;
      item.timeCount++;
    }
  }

  const result: TopicWeaknessItem[] = Object.values(map).map((i) => ({
    topic: i.topic,
    sectionName: i.sectionName,
    unresolvedMistakes: i.unresolved,
    totalMistakes: i.total,
    marksLostNegative: Number(i.negativeLost.toFixed(2)),
    avgTimeSpent: i.timeCount > 0 ? Math.round(i.timeSpentTotal / i.timeCount) : 0,
    idealTime: i.timeCount > 0 ? Math.round(i.idealTimeTotal / i.timeCount) : 60,
    isRecurring: i.mockSet.size >= 2
  }));

  // Sort by net marks lost, then unresolved mistakes
  result.sort((a, b) => b.marksLostNegative - a.marksLostNegative || b.unresolvedMistakes - a.unresolvedMistakes);
  return result;
}

/**
 * Calculates Time Analysis on wrong answers vs ideal time.
 */
export function calculateTimeAnalysis(mistakes: MistakeEntry[]): TimeAnalysisData {
  let totalWrongTime = 0;
  let totalIdealTime = 0;
  let wrongCount = 0;

  const topicTimes: Record<string, { section: string; wrongTime: number; idealTime: number; count: number }> = {};

  for (const m of mistakes) {
    if (m.resultType === 'Wrong' && m.timeSpentSeconds > 0) {
      totalWrongTime += m.timeSpentSeconds;
      totalIdealTime += m.idealTimeSeconds || 60;
      wrongCount++;

      if (!topicTimes[m.topic]) {
        topicTimes[m.topic] = { section: m.sectionName, wrongTime: 0, idealTime: 0, count: 0 };
      }
      topicTimes[m.topic].wrongTime += m.timeSpentSeconds;
      topicTimes[m.topic].idealTime += m.idealTimeSeconds || 60;
      topicTimes[m.topic].count++;
    }
  }

  const avgTimeWrongSeconds = wrongCount > 0 ? Math.round(totalWrongTime / wrongCount) : 0;
  const avgTimeIdealSeconds = wrongCount > 0 ? Math.round(totalIdealTime / wrongCount) : 60;
  const timeWastageRatio = avgTimeIdealSeconds > 0 ? Number((avgTimeWrongSeconds / avgTimeIdealSeconds).toFixed(2)) : 1.0;

  const topicsWastingTime = Object.entries(topicTimes)
    .map(([topic, data]) => {
      const avgSpent = Math.round(data.wrongTime / data.count);
      const ideal = Math.round(data.idealTime / data.count);
      const ratio = ideal > 0 ? Number((avgSpent / ideal).toFixed(2)) : 1.0;
      return {
        topic,
        sectionName: data.section,
        wrongCount: data.count,
        avgTimeSpent: avgSpent,
        idealTime: ideal,
        ratio
      };
    })
    .filter((t) => t.ratio >= 1.25)
    .sort((a, b) => b.ratio - a.ratio);

  return {
    avgTimeWrongSeconds,
    avgTimeIdealSeconds,
    timeWastageRatio,
    topicsWastingTime
  };
}

/**
 * Calculates Accuracy vs Attempts data points with trendline slope.
 */
export function calculateAccuracyVsAttempts(mocks: MockTest[]): {
  data: AccuracyVsAttemptsPoint[];
  trendSlope: number;
  correlationText: string;
} {
  const data: AccuracyVsAttemptsPoint[] = mocks.map((m) => ({
    mockId: m.id,
    mockName: m.name,
    date: m.date,
    attempts: m.totalAttempted || 0,
    accuracy: m.overallAccuracy || 0,
    score: m.totalNetScore || 0,
    percentile: m.overallPercentile
  }));

  if (data.length < 2) {
    return {
      data,
      trendSlope: 0,
      correlationText: 'Needs at least 2 mocks to calculate trendline.'
    };
  }

  // Calculate linear regression slope: accuracy vs attempts
  const n = data.length;
  const sumX = data.reduce((s, p) => s + p.attempts, 0);
  const sumY = data.reduce((s, p) => s + p.accuracy, 0);
  const sumXY = data.reduce((s, p) => s + p.attempts * p.accuracy, 0);
  const sumXX = data.reduce((s, p) => s + p.attempts * p.attempts, 0);

  const denom = n * sumXX - sumX * sumX;
  const slope = denom !== 0 ? Number(((n * sumXY - sumX * sumY) / denom).toFixed(3)) : 0;

  let correlationText = '';
  if (slope > 0.1) {
    correlationText = 'Positive trend: higher attempts correlate with sustained high accuracy.';
  } else if (slope < -0.1) {
    correlationText = 'Over-attempting alert: higher question attempts correlate with lower accuracy.';
  } else {
    correlationText = 'Stable accuracy maintained regardless of attempt volume.';
  }

  return {
    data,
    trendSlope: slope,
    correlationText
  };
}
