import { MistakeEntry, MistakeStatus } from '../types';

export const SRS_INTERVALS = [1, 3, 7, 14, 30];

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/**
 * Formats a Date as YYYY-MM-DD using the device's local calendar, not UTC.
 */
export function getLocalDateStr(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  return `${year}-${month}-${day}`;
}

export function getTodayDateStr(): string {
  return getLocalDateStr(new Date());
}

/**
 * Counts consecutive active calendar days, allowing the streak to start today or yesterday.
 * Dates are local YYYY-MM-DD strings, so a UTC offset cannot break the streak.
 */
export function calculateStreak(activeDates: string[], now: Date = new Date()): number {
  const dates = new Set(activeDates.filter(Boolean));
  if (dates.size === 0) return 0;

  let cursor = getLocalDateStr(now);
  if (!dates.has(cursor)) {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    cursor = getLocalDateStr(yesterday);
    if (!dates.has(cursor)) return 0;
  }

  let streak = 0;
  while (dates.has(cursor)) {
    streak++;
    cursor = addDaysToDate(cursor, -1);
  }
  return streak;
}

export function addDaysToDate(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  // Using noon (12:00:00) avoids DST edge cases where midnight +- 1 hour shifts calendar day
  const d = new Date(year, (month || 1) - 1, day || 1, 12, 0, 0);
  d.setDate(d.getDate() + days);
  return getLocalDateStr(d);
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
