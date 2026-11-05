import { UserXPState, UserRank, calculateUserRank } from '../types';
import { getLocalDateStr, addDaysToDate } from './srs';
import { db } from '../db/db';

export type XPAction =
  | 'pyq'
  | 'mistake'
  | 'review'
  | 'topic_mastered'
  | 'mock'
  | 'boss_defeat'
  | 'quest_completed'
  | 'custom';

export const XP_AWARDS: Record<XPAction, number> = {
  pyq: 20,
  mistake: 10,
  review: 15,
  topic_mastered: 50,
  mock: 100,
  boss_defeat: 200,
  quest_completed: 25,
  custom: 0
};

export interface RankInfo {
  rank: UserRank;
  level: number;
  nextTarget: number;
  progress: number;
  badge: string;
}

export function getRankBadge(rank: UserRank): string {
  switch (rank) {
    case 'GATE/Officer Topper':
      return '👑';
    case 'Special Grade Candidate':
      return '⚡';
    case 'Code Ninja':
      return '🥷';
    case 'Novice Scholar':
      return '📜';
    case 'Aspirant':
    default:
      return '🥋';
  }
}

export function calculateLevelAndRank(totalXp: number): RankInfo {
  const rankData = calculateUserRank(totalXp);
  // 1 level per 100 XP, minimum level 1
  const level = Math.max(1, Math.floor(totalXp / 100) + 1);

  return {
    rank: rankData.rank,
    level,
    nextTarget: rankData.nextTarget,
    progress: rankData.progress,
    badge: getRankBadge(rankData.rank)
  };
}

export interface AwardXPResult {
  nextState: UserXPState;
  xpGained: number;
  leveledUp: boolean;
  newRank?: UserRank;
}

/**
 * Awards XP to user state and computes potential rank & level ups.
 */
export function awardXP(
  currentState: UserXPState,
  action: XPAction,
  customAmount?: number
): AwardXPResult {
  const xpGained = customAmount !== undefined ? customAmount : (XP_AWARDS[action] || 0);
  const prevXp = currentState.totalXp;
  const newXp = prevXp + xpGained;

  const prevRankInfo = calculateLevelAndRank(prevXp);
  const nextRankInfo = calculateLevelAndRank(newXp);

  const leveledUp = nextRankInfo.level > prevRankInfo.level;
  const rankChanged = nextRankInfo.rank !== prevRankInfo.rank;

  const nextState: UserXPState = {
    ...currentState,
    totalXp: newXp,
    currentLevel: nextRankInfo.level,
    rankTitle: nextRankInfo.rank,
    updatedAt: new Date().toISOString()
  };

  return {
    nextState,
    xpGained,
    leveledUp,
    newRank: rankChanged ? nextRankInfo.rank : undefined
  };
}

export interface StreakUpdateResult {
  nextState: UserXPState;
  freezeUsed: boolean;
  freezeEarned: boolean;
  streakUpdated: boolean;
}

/**
 * Updates activity streak and manages streak freezes.
 * Rule: 1 freeze awarded per 7-day streak milestone (7, 14, 21...), maximum 2 freezes held.
 * If user missed yesterday:
 *   - If streakFreezesAvailable > 0, consumes 1 freeze to protect streak.
 *   - Otherwise, streak resets to 1.
 */
export function recordActivityAndCheckStreak(
  currentState: UserXPState,
  todayStr: string = getLocalDateStr(),
  activeDates: string[] = []
): StreakUpdateResult {
  const lastActive = currentState.lastActiveDate;
  let streak = currentState.currentStreak;
  let freezes = currentState.streakFreezesAvailable ?? 0;
  let freezeUsed = false;
  let freezeEarned = false;

  if (lastActive === todayStr) {
    // Already active today, nothing changes
    return {
      nextState: currentState,
      freezeUsed: false,
      freezeEarned: false,
      streakUpdated: false
    };
  }

  const yesterdayStr = addDaysToDate(todayStr, -1);

  if (lastActive === yesterdayStr) {
    // Continuous streak!
    streak += 1;
    // Check 7-day milestone
    if (streak > 0 && streak % 7 === 0 && freezes < 2) {
      freezes = Math.min(2, freezes + 1);
      freezeEarned = true;
    }
  } else if (!lastActive) {
    // First activity ever
    streak = 1;
  } else {
    // Gap detected! User missed at least 1 day.
    if (freezes > 0) {
      // Consume 1 streak freeze to preserve streak!
      freezes -= 1;
      freezeUsed = true;
      streak += 1; // preserved and incremented for today
    } else {
      // Streak broken, reset to 1 for today
      streak = 1;
    }
  }

  const nextState: UserXPState = {
    ...currentState,
    currentStreak: streak,
    streakFreezesAvailable: freezes,
    lastActiveDate: todayStr,
    updatedAt: new Date().toISOString()
  };

  return {
    nextState,
    freezeUsed,
    freezeEarned,
    streakUpdated: true
  };
}

export const INITIAL_XP_STATE: UserXPState = {
  id: 'current',
  totalXp: 0,
  currentLevel: 1,
  rankTitle: 'Aspirant',
  currentStreak: 0,
  streakFreezesAvailable: 2,
  lastActiveDate: getLocalDateStr(),
  updatedAt: new Date().toISOString()
};

/**
 * Loads user XP state from Dexie DB or initializes default state if absent.
 */
export async function getXpState(): Promise<UserXPState> {
  try {
    const existing = await db.xpState.get('current');
    if (existing) {
      return existing;
    }
    await db.xpState.put(INITIAL_XP_STATE);
    return INITIAL_XP_STATE;
  } catch {
    return INITIAL_XP_STATE;
  }
}

/**
 * Persists updated XP state to Dexie DB.
 */
export async function saveXpState(state: UserXPState): Promise<void> {
  try {
    await db.xpState.put(state);
  } catch (err) {
    // Non-fatal if Dexie is busy or in test stub
  }
}
