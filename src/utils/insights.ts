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
  expectedMarkGain: number; // e.g. +2.5 marks
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

export function generateInsights(
  mocks: MockTest[],
  mistakes: MistakeEntry[],
  settings?: ExamSettings
): GeneratedInsights {
  const keyInsights: InsightCard[] = [];
  const focusActions: FocusAction[] = [];

  if (mocks.length === 0 && mistakes.length === 0) {
    return {
      keyInsights: [
        {
          id: 'welcome',
          type: 'info',
          title: 'Welcome to Mistake Notebook',
          description: 'Load sample data or add your first mock to generate targeted insights on marks lost and accuracy leaks.'
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

  // 1. Negative Marking Leak Analysis (Last 5 mocks)
  const recentMocks = mocks.slice(-5);
  let totalNegativeLost = 0;
  const sectionNegLost: Record<string, number> = {};

  for (const m of recentMocks) {
    totalNegativeLost += m.totalMarksLostNegative;
    for (const s of m.sections) {
      sectionNegLost[s.sectionName] = (sectionNegLost[s.sectionName] || 0) + s.marksLostNegative;
    }
  }

  // Find worst negative marking section
  let worstNegSection = '';
  let worstNegAmount = 0;
  for (const [sec, amt] of Object.entries(sectionNegLost)) {
    if (amt > worstNegAmount) {
      worstNegAmount = amt;
      worstNegSection = sec;
    }
  }

  // Check how many mistakes in that section had "Guessed (no basis)"
  const guessedCount = mistakes.filter(
    (m) => m.errorTypes.includes('Guessed (no basis)') && (!worstNegSection || m.sectionName === worstNegSection)
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

  // 2. Top Error Type by Section
  const errorTypeCountBySec: Record<string, Record<string, number>> = {};
  const totalMistakesBySec: Record<string, number> = {};

  for (const m of mistakes) {
    if (!errorTypeCountBySec[m.sectionName]) {
      errorTypeCountBySec[m.sectionName] = {};
      totalMistakesBySec[m.sectionName] = 0;
    }
    totalMistakesBySec[m.sectionName]++;
    for (const err of m.errorTypes) {
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

  // 3. Weakest Topic Detection & Review Queue Count
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

  // 4. Time Wastage Ratio on Wrong Answers
  const topicTimes: Record<string, { wrongTime: number; idealTime: number; count: number }> = {};
  for (const m of mistakes) {
    if (m.resultType === 'Wrong' && m.idealTimeSeconds > 0) {
      if (!topicTimes[m.topic]) {
        topicTimes[m.topic] = { wrongTime: 0, idealTime: 0, count: 0 };
      }
      topicTimes[m.topic].wrongTime += m.timeSpentSeconds;
      topicTimes[m.topic].idealTime += m.idealTimeSeconds;
      topicTimes[m.topic].count++;
    }
  }

  for (const [topic, tData] of Object.entries(topicTimes)) {
    if (tData.count >= 2 && tData.idealTime > 0) {
      const ratio = Number((tData.wrongTime / tData.idealTime).toFixed(1));
      if (ratio >= 1.5) {
        keyInsights.push({
          id: `time-waste-${topic}`,
          type: 'danger',
          title: `Time Sink Alert: ${topic}`,
          metric: `${ratio}x ideal time`,
          section: 'Pacing',
          description: `You spend ${ratio}x the ideal time on "${topic}" questions that you ultimately get wrong. Enforce a strict skip cutoff.`
        });
        break; // Show one punchy time-sink insight
      }
    }
  }

  // 5. Repeated-mistake detector across mocks
  const repeatedMistakes: GeneratedInsights['repeatedMistakes'] = [];
  const errorMockTracker: Record<string, { mocks: Set<number>; section: string; totalCount: number }> = {};

  for (const m of mistakes) {
    for (const err of m.errorTypes) {
      const key = `${m.sectionName}__${err}`;
      if (!errorMockTracker[key]) {
        errorMockTracker[key] = { mocks: new Set(), section: m.sectionName, totalCount: 0 };
      }
      errorMockTracker[key].mocks.add(m.mockId);
      errorMockTracker[key].totalCount++;
    }
  }

  for (const [key, data] of Object.entries(errorMockTracker)) {
    if (data.mocks.size >= 3) {
      const [, errName] = key.split('__');
      repeatedMistakes.push({
        type: 'errorType',
        name: errName,
        section: data.section,
        count: data.totalCount,
        mockCount: data.mocks.size
      });
    }
  }

  // 6. Recent Score Trends: Last 3 vs Prev 3
  let last3Avg = 0;
  let prev3Avg = 0;
  if (mocks.length >= 6) {
    const l3 = mocks.slice(-3);
    const p3 = mocks.slice(-6, -3);
    last3Avg = Number((l3.reduce((s, m) => s + m.totalNetScore, 0) / 3).toFixed(2));
    prev3Avg = Number((p3.reduce((s, m) => s + m.totalNetScore, 0) / 3).toFixed(2));
  } else if (mocks.length >= 2) {
    const mid = Math.floor(mocks.length / 2);
    const p = mocks.slice(0, mid);
    const l = mocks.slice(mid);
    last3Avg = Number((l.reduce((s, m) => s + m.totalNetScore, 0) / l.length).toFixed(2));
    prev3Avg = Number((p.reduce((s, m) => s + m.totalNetScore, 0) / p.length).toFixed(2));
  }

  const delta = Number((last3Avg - prev3Avg).toFixed(2));
  if (mocks.length >= 3) {
    keyInsights.push({
      id: 'improvement-trend',
      type: delta >= 0 ? 'success' : 'warning',
      title: delta >= 0 ? 'Upward Trajectory' : 'Score Dip Observed',
      metric: `${delta >= 0 ? '+' : ''}${delta} marks`,
      section: 'Overall',
      description: `Recent mock average is ${last3Avg} marks vs earlier ${prev3Avg} marks (${delta >= 0 ? 'improved by' : 'down by'} ${Math.abs(delta)} marks).`
    });
  }

  // Add 3 high-impact focus actions
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
    recentScoreDiff: { last3Avg, prev3Avg, delta }
  };
}

