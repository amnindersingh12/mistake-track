import { MistakeEntry, MistakeStatus } from '../types';

export const SRS_INTERVALS = [1, 3, 7, 14, 30];

export function getTodayDateStr(): string {
  return new Date().toISOString().split('T')[0];
}

export function addDaysToDate(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

/**
 * Updates a mistake entry following a spaced repetition review event.
 */
export function processSrsReview(
  entry: MistakeEntry,
  outcome: 'got-it' | 'still-wrong'
): {
  interval: number;
  consecutiveCorrect: number;
  status: MistakeStatus;
  nextReviewDate: string;
  lastReviewedAt: string;
  history: MistakeEntry['history'];
} {
  const today = getTodayDateStr();
  const history = [...(entry.history || []), { date: today, result: outcome }];

  if (outcome === 'got-it') {
    const consecutiveCorrect = (entry.consecutiveCorrect || 0) + 1;
    let nextInterval = 1;

    const currentInterval = entry.interval || 0;
    const currentIndex = SRS_INTERVALS.indexOf(currentInterval);

    if (currentIndex === -1 || currentInterval === 0) {
      nextInterval = SRS_INTERVALS[0]; // 1
    } else if (currentIndex < SRS_INTERVALS.length - 1) {
      nextInterval = SRS_INTERVALS[currentIndex + 1];
    } else {
      nextInterval = SRS_INTERVALS[SRS_INTERVALS.length - 1]; // 30
    }

    // Auto-mark as Mastered after 3 consecutive correct reviews
    const status: MistakeStatus = consecutiveCorrect >= 3 ? 'Mastered' : 'Reviewing';
    const nextReviewDate = addDaysToDate(today, nextInterval);

    return {
      interval: nextInterval,
      consecutiveCorrect,
      status,
      nextReviewDate,
      lastReviewedAt: new Date().toISOString(),
      history
    };
  } else {
    // "still-wrong" resets interval and consecutive count
    return {
      interval: 1,
      consecutiveCorrect: 0,
      status: 'Reviewing',
      nextReviewDate: addDaysToDate(today, 1),
      lastReviewedAt: new Date().toISOString(),
      history
    };
  }
}

