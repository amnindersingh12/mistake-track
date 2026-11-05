import { describe, it, expect } from 'vitest';
import {
  XP_AWARDS,
  calculateLevelAndRank,
  awardXP,
  recordActivityAndCheckStreak,
  INITIAL_XP_STATE
} from './xpEngine';
import { UserXPState } from '../types';

describe('xpEngine gamification module', () => {
  describe('XP Awards', () => {
    it('awards expected XP amounts for all key study events', () => {
      expect(XP_AWARDS.pyq).toBe(20);
      expect(XP_AWARDS.mistake).toBe(10);
      expect(XP_AWARDS.review).toBe(15);
      expect(XP_AWARDS.topic_mastered).toBe(50);
      expect(XP_AWARDS.mock).toBe(100);
      expect(XP_AWARDS.boss_defeat).toBe(200);
    });
  });

  describe('Rank & Level progression', () => {
    it('maps XP to correct rank tiers', () => {
      expect(calculateLevelAndRank(0).rank).toBe('Aspirant');
      expect(calculateLevelAndRank(99).rank).toBe('Aspirant');
      expect(calculateLevelAndRank(100).rank).toBe('Novice Scholar');
      expect(calculateLevelAndRank(249).rank).toBe('Novice Scholar');
      expect(calculateLevelAndRank(250).rank).toBe('Code Ninja');
      expect(calculateLevelAndRank(499).rank).toBe('Code Ninja');
      expect(calculateLevelAndRank(500).rank).toBe('Special Grade Candidate');
      expect(calculateLevelAndRank(999).rank).toBe('Special Grade Candidate');
      expect(calculateLevelAndRank(1000).rank).toBe('GATE/Officer Topper');
      expect(calculateLevelAndRank(2500).rank).toBe('GATE/Officer Topper');
    });

    it('calculates level appropriately (1 level per 100 XP)', () => {
      expect(calculateLevelAndRank(0).level).toBe(1);
      expect(calculateLevelAndRank(99).level).toBe(1);
      expect(calculateLevelAndRank(100).level).toBe(2);
      expect(calculateLevelAndRank(250).level).toBe(3);
      expect(calculateLevelAndRank(1050).level).toBe(11);
    });
  });

  describe('awardXP', () => {
    it('awards XP and tracks level up and rank elevation', () => {
      const startState: UserXPState = {
        ...INITIAL_XP_STATE,
        totalXp: 85,
        currentLevel: 1,
        rankTitle: 'Aspirant'
      };

      // Award +20 for PYQ -> 105 XP (Level 2, Novice Scholar)
      const result = awardXP(startState, 'pyq');
      expect(result.xpGained).toBe(20);
      expect(result.nextState.totalXp).toBe(105);
      expect(result.leveledUp).toBe(true);
      expect(result.newRank).toBe('Novice Scholar');
      expect(result.nextState.rankTitle).toBe('Novice Scholar');
    });

    it('handles custom XP awards properly', () => {
      const startState: UserXPState = { ...INITIAL_XP_STATE, totalXp: 50 };
      const result = awardXP(startState, 'custom', 75);
      expect(result.xpGained).toBe(75);
      expect(result.nextState.totalXp).toBe(125);
    });
  });

  describe('Streak freeze tracking', () => {
    it('increments streak on consecutive active days', () => {
      const state: UserXPState = {
        ...INITIAL_XP_STATE,
        currentStreak: 4,
        lastActiveDate: '2026-03-01'
      };

      const { nextState, streakUpdated } = recordActivityAndCheckStreak(state, '2026-03-02');
      expect(streakUpdated).toBe(true);
      expect(nextState.currentStreak).toBe(5);
      expect(nextState.lastActiveDate).toBe('2026-03-02');
    });

    it('does not re-increment streak if already logged today', () => {
      const state: UserXPState = {
        ...INITIAL_XP_STATE,
        currentStreak: 5,
        lastActiveDate: '2026-03-02'
      };

      const { nextState, streakUpdated } = recordActivityAndCheckStreak(state, '2026-03-02');
      expect(streakUpdated).toBe(false);
      expect(nextState.currentStreak).toBe(5);
    });

    it('awards 1 streak freeze at 7-day milestone up to max 2', () => {
      const state: UserXPState = {
        ...INITIAL_XP_STATE,
        currentStreak: 6,
        streakFreezesAvailable: 0,
        lastActiveDate: '2026-03-01'
      };

      const { nextState, freezeEarned } = recordActivityAndCheckStreak(state, '2026-03-02');
      expect(nextState.currentStreak).toBe(7);
      expect(freezeEarned).toBe(true);
      expect(nextState.streakFreezesAvailable).toBe(1);

      // If already at max 2, does not exceed 2
      const maxState: UserXPState = {
        ...state,
        currentStreak: 13,
        streakFreezesAvailable: 2,
        lastActiveDate: '2026-03-01'
      };
      const res = recordActivityAndCheckStreak(maxState, '2026-03-02');
      expect(res.nextState.currentStreak).toBe(14);
      expect(res.nextState.streakFreezesAvailable).toBe(2);
    });

    it('uses a streak freeze when user misses a day to save streak', () => {
      const state: UserXPState = {
        ...INITIAL_XP_STATE,
        currentStreak: 10,
        streakFreezesAvailable: 1,
        lastActiveDate: '2026-03-01' // gap: missed 2026-03-02
      };

      const { nextState, freezeUsed } = recordActivityAndCheckStreak(state, '2026-03-03');
      expect(freezeUsed).toBe(true);
      expect(nextState.streakFreezesAvailable).toBe(0);
      expect(nextState.currentStreak).toBe(11); // preserved and continued!
    });

    it('resets streak to 1 when gap occurs and no freezes are available', () => {
      const state: UserXPState = {
        ...INITIAL_XP_STATE,
        currentStreak: 10,
        streakFreezesAvailable: 0,
        lastActiveDate: '2026-03-01' // gap: missed 2026-03-02
      };

      const { nextState, freezeUsed } = recordActivityAndCheckStreak(state, '2026-03-03');
      expect(freezeUsed).toBe(false);
      expect(nextState.currentStreak).toBe(1);
    });
  });
});
