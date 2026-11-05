import { MistakeEntry } from '../types';

/**
 * Calculates how many consecutive times this mistake has been answered wrong.
 * Checks review history in reverse; falls back to 1 if newly logged wrong.
 */
export function getConsecutiveWrongCount(mistake: MistakeEntry): number {
  if (!mistake.history || mistake.history.length === 0) {
    return mistake.resultType === 'Wrong' ? 1 : 0;
  }
  let count = 0;
  for (let i = mistake.history.length - 1; i >= 0; i--) {
    if (mistake.history[i].result === 'still-wrong') {
      count++;
    } else {
      break;
    }
  }
  if (count === 0 && (mistake.consecutiveCorrect || 0) === 0 && mistake.resultType === 'Wrong') {
    count = 1;
  }
  return count;
}

/**
 * Calculates number of days a card is overdue relative to today.
 * Returns 0 if due today or in the future.
 */
export function getDaysOverdue(nextReviewDate: string, todayStr: string): number {
  if (!nextReviewDate || !todayStr) return 0;
  const next = new Date(nextReviewDate).getTime();
  const today = new Date(todayStr).getTime();
  if (isNaN(next) || isNaN(today)) return 0;
  const diffDays = Math.floor((today - next) / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}

/**
 * Calculates weakness priority score according to SPEC B item 3:
 * (a) weight is high (difficulty * marks)
 * (b) consecutive wrong count is high
 * (c) review date is past due
 */
export function calculateWeaknessScore(mistake: MistakeEntry, todayStr: string): number {
  const diffMap: Record<string, number> = { Hard: 3, Medium: 2, Easy: 1 };
  const difficultyWeight = diffMap[mistake.difficulty] || 1;
  const marksWeight = mistake.marks && mistake.marks > 0 ? mistake.marks : 1;
  const weight = difficultyWeight * marksWeight;
  const consecutiveWrong = getConsecutiveWrongCount(mistake);
  const daysOverdue = getDaysOverdue(mistake.nextReviewDate, todayStr);

  return (weight * 10) + (consecutiveWrong * 20) + (daysOverdue * 5);
}

/**
 * Sorts queue prioritizing high weakness, consecutive failures, and overdue reviews.
 */
export function sortQueueByWeakness(mistakes: MistakeEntry[], todayStr: string): MistakeEntry[] {
  return [...mistakes].sort((a, b) => {
    const scoreA = calculateWeaknessScore(a, todayStr);
    const scoreB = calculateWeaknessScore(b, todayStr);
    if (scoreB !== scoreA) {
      return scoreB - scoreA;
    }
    // Earlier review date takes precedence
    if (a.nextReviewDate !== b.nextReviewDate) {
      return (a.nextReviewDate || '').localeCompare(b.nextReviewDate || '');
    }
    return (a.id || 0) - (b.id || 0);
  });
}

/**
 * Interleaved review mode: mixes questions across subjects/sections in round-robin fashion
 * rather than blocking by single topic/subject.
 */
export function interleaveQueue(
  mistakes: MistakeEntry[],
  keyFn: (m: MistakeEntry) => string = (m) => m.sectionId || m.sectionName || m.topic || 'default'
): MistakeEntry[] {
  if (mistakes.length <= 1) return [...mistakes];

  const buckets = new Map<string, MistakeEntry[]>();
  const groupOrder: string[] = [];

  for (const item of mistakes) {
    const key = keyFn(item);
    if (!buckets.has(key)) {
      buckets.set(key, []);
      groupOrder.push(key);
    }
    buckets.get(key)!.push(item);
  }

  const result: MistakeEntry[] = [];
  let remaining = mistakes.length;

  while (remaining > 0) {
    let progressed = false;
    for (const key of groupOrder) {
      const bucket = buckets.get(key)!;
      if (bucket.length > 0) {
        result.push(bucket.shift()!);
        remaining--;
        progressed = true;
      }
    }
    if (!progressed) break;
  }

  return result;
}

/**
 * Quick 5 mini-session queue: extracts top 5 questions for rapid blitz session.
 */
export function getQuick5Queue(mistakes: MistakeEntry[]): MistakeEntry[] {
  return mistakes.slice(0, 5);
}
