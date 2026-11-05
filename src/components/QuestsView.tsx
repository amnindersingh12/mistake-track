import React, { useState, useEffect } from 'react';
import {
  Trophy,
  Flame,
  CheckCircle2,
  Clock,
  Sparkles,
  Zap,
  Target,
  Gift,
  ChevronRight,
  ShieldAlert,
  Swords
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Quest, UserXPState } from '../types';
import { db, DEFAULT_QUESTS } from '../db/db';
import { getXpState, saveXpState, awardXP, calculateLevelAndRank } from '../utils/xpEngine';
import { getLocalDateStr } from '../utils/srs';

export interface QuestsViewProps {
  onOpenBossBattle?: () => void;
  onNavigateTab?: (tab: string) => void;
}

export const QuestsView: React.FC<QuestsViewProps> = ({ onOpenBossBattle, onNavigateTab }) => {
  const [quests, setQuests] = useState<Quest[]>([]);
  const [xpState, setXpState] = useState<UserXPState | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useEffect(() => {
    loadQuestsAndXp();
  }, []);

  const loadQuestsAndXp = async () => {
    try {
      const state = await getXpState();
      setXpState(state);

      const dbQuests = await db.quests.toArray();
      if (dbQuests.length > 0) {
        setQuests(dbQuests);
      } else {
        await db.quests.bulkPut(DEFAULT_QUESTS);
        setQuests(DEFAULT_QUESTS);
      }
    } catch {
      setQuests(DEFAULT_QUESTS);
    }
  };

  const handleClaimReward = async (quest: Quest) => {
    if (quest.completed || quest.current < quest.target) return;

    // Trigger celebratory confetti
    try {
      confetti({
        particleCount: 60,
        spread: 70,
        origin: { y: 0.6 }
      });
    } catch {
      // Confetti fallback
    }

    // 1. Mark quest completed in state & Dexie
    const updatedQuests = quests.map(q => {
      if (q.id === quest.id) {
        return { ...q, completed: true };
      }
      return q;
    });
    setQuests(updatedQuests);

    try {
      await db.quests.update(quest.id, { completed: true });
    } catch {
      // Non-fatal
    }

    // 2. Award XP
    if (xpState) {
      const result = awardXP(xpState, 'quest_completed', quest.xpReward);
      setXpState(result.nextState);
      await saveXpState(result.nextState);

      showToast(
        `Claimed +${quest.xpReward} XP! ${
          result.leveledUp ? `LEVEL UP! Now Level ${result.nextState.currentLevel}` : ''
        }`
      );
    }
  };

  const handleIncrementProgress = async (questId: string) => {
    const updated = quests.map(q => {
      if (q.id === questId && !q.completed) {
        const nextCurrent = Math.min(q.target, q.current + 1);
        return { ...q, current: nextCurrent };
      }
      return q;
    });
    setQuests(updated);

    const targetQ = updated.find(q => q.id === questId);
    if (targetQ) {
      try {
        await db.quests.update(questId, { current: targetQ.current });
      } catch {
        // Non-fatal
      }
    }
  };

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  const dailyQuests = quests.filter(q => q.type === 'daily');
  const weeklyBounties = quests.filter(q => q.type === 'weekly');

  const rankInfo = xpState ? calculateLevelAndRank(xpState.totalXp) : null;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Toast */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 border border-amber-500/50 text-amber-300 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3">
          <Sparkles className="w-5 h-5 text-amber-400" />
          <span className="text-sm font-semibold">{toastMsg}</span>
        </div>
      )}

      {/* Top Banner / Hero RPG Stats */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-3xl shadow-inner">
              {rankInfo?.badge || '🥋'}
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {rankInfo?.rank || 'Aspirant'}
                </span>
                <span className="text-xs font-semibold text-slate-400">
                  Level {rankInfo?.level || 1} Scholar
                </span>
              </div>
              <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
                <Trophy className="w-6 h-6 text-amber-400" /> Quest Board & Weekly Bounties
              </h1>
              <p className="text-xs text-slate-400 mt-1">
                Conquer daily micro-tasks, claim hefty XP bounties, and slay the weekly boss!
              </p>
            </div>
          </div>

          {/* XP & Streak Stats */}
          <div className="flex items-center gap-4 bg-slate-950/50 border border-slate-800 p-4 rounded-xl">
            <div className="pr-4 border-r border-slate-800">
              <div className="text-xs text-slate-400 font-medium flex items-center gap-1">
                <Flame className="w-4 h-4 text-rose-500" /> Current Streak
              </div>
              <div className="text-xl font-black text-rose-300 mt-0.5">
                {xpState?.currentStreak || 0} Days
              </div>
              <div className="text-[11px] text-slate-500">
                {xpState?.streakFreezesAvailable || 0} Freezes
              </div>
            </div>

            <div>
              <div className="text-xs text-slate-400 font-medium flex items-center gap-1">
                <Zap className="w-4 h-4 text-amber-400" /> Total XP
              </div>
              <div className="text-xl font-black text-amber-300 mt-0.5">
                {xpState?.totalXp || 0} XP
              </div>
              <div className="text-[11px] text-slate-500">
                Next: {rankInfo?.nextTarget || 100} XP ({rankInfo?.progress || 0}%)
              </div>
            </div>
          </div>
        </div>

        {/* Progress Bar towards Next Rank */}
        <div className="mt-5 pt-4 border-t border-slate-800/80">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
            <span>Rank Progress ({rankInfo?.rank} → Next Tier)</span>
            <span className="font-semibold text-indigo-300">{rankInfo?.progress || 0}%</span>
          </div>
          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
            <div
              className="bg-gradient-to-r from-indigo-500 to-amber-400 h-full rounded-full transition-all duration-500"
              style={{ width: `${rankInfo?.progress || 0}%` }}
            />
          </div>
        </div>
      </div>

      {/* Boss Battle Callout Banner */}
      <div className="bg-gradient-to-r from-rose-950/60 via-purple-950/40 to-slate-900 border border-rose-900/40 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-lg">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-rose-500/20 border border-rose-500/40 rounded-xl text-rose-400">
            <Swords className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold px-2 py-0.5 bg-rose-500 text-white rounded uppercase">
                BOSS EVENT
              </span>
              <span className="text-xs text-rose-300 font-semibold">Weekly Challenge</span>
            </div>
            <h3 className="text-base font-bold text-slate-100 mt-0.5">
              The Algorithm Colossus (15-Question Boss Raid)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Drain the monster's 1000 HP with correct answers. Reward: +200 XP & Boss Slayer status!
            </p>
          </div>
        </div>

        {onOpenBossBattle && (
          <button
            onClick={onOpenBossBattle}
            className="px-5 py-2.5 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-rose-600/30 transition shrink-0 flex items-center gap-2"
          >
            <Swords className="w-4 h-4" /> Enter Boss Arena
          </button>
        )}
      </div>

      {/* Daily Quests Board */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-indigo-400" />
            <h2 className="text-lg font-bold text-slate-100">Daily Quests</h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
              Resets every midnight
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {dailyQuests.map(quest => {
            const isReady = quest.current >= quest.target && !quest.completed;
            const progressPercent = Math.min(100, Math.round((quest.current / quest.target) * 100));

            return (
              <div
                key={quest.id}
                className={`p-5 rounded-2xl border transition-all flex flex-col justify-between ${
                  quest.completed
                    ? 'bg-slate-900/40 border-slate-800 opacity-60'
                    : isReady
                    ? 'bg-amber-950/20 border-amber-500/50 ring-1 ring-amber-500/40 shadow-lg'
                    : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 uppercase">
                      Daily
                    </span>
                    <span className="text-xs font-extrabold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                      <Zap className="w-3 h-3" /> +{quest.xpReward} XP
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-slate-100 mt-2.5">{quest.title}</h3>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">{quest.description}</p>
                </div>

                <div className="mt-5 pt-4 border-t border-slate-800">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-400 mb-1.5">
                    <span>
                      {quest.current} / {quest.target}
                    </span>
                    <span>{progressPercent}%</span>
                  </div>

                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden mb-3">
                    <div
                      className={`h-full rounded-full transition-all ${
                        quest.completed
                          ? 'bg-slate-600'
                          : isReady
                          ? 'bg-amber-400'
                          : 'bg-indigo-500'
                      }`}
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>

                  {quest.completed ? (
                    <div className="w-full py-2 rounded-xl bg-slate-800 text-slate-400 text-xs font-bold text-center flex items-center justify-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Claimed
                    </div>
                  ) : isReady ? (
                    <button
                      onClick={() => handleClaimReward(quest)}
                      className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-amber-500/30 transition animate-bounce"
                    >
                      Claim +{quest.xpReward} XP Reward!
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleIncrementProgress(quest.id)}
                        className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
                      >
                        +1 Progress (Test)
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Weekly Bounties Board */}
      <div className="space-y-4 pt-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Gift className="w-5 h-5 text-amber-400" />
            <h2 className="text-lg font-bold text-slate-100">Weekly Bounties</h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
              High stakes, large XP rewards
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {weeklyBounties.map(quest => {
            const isReady = quest.current >= quest.target && !quest.completed;
            const progressPercent = Math.min(100, Math.round((quest.current / quest.target) * 100));

            return (
              <div
                key={quest.id}
                className={`p-5 rounded-2xl border transition-all flex flex-col justify-between ${
                  quest.completed
                    ? 'bg-slate-900/40 border-slate-800 opacity-60'
                    : isReady
                    ? 'bg-amber-950/20 border-amber-500/50 shadow-lg'
                    : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 uppercase">
                      Weekly Bounty
                    </span>
                    <span className="text-xs font-black px-2.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                      <Zap className="w-3.5 h-3.5" /> +{quest.xpReward} XP
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-slate-100 mt-2.5">{quest.title}</h3>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">{quest.description}</p>
                </div>

                <div className="mt-5 pt-4 border-t border-slate-800">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-400 mb-1.5">
                    <span>
                      Progress: {quest.current} / {quest.target}
                    </span>
                    <span>{progressPercent}%</span>
                  </div>

                  <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden mb-3">
                    <div
                      className={`h-full rounded-full transition-all ${
                        quest.completed
                          ? 'bg-slate-600'
                          : isReady
                          ? 'bg-amber-400'
                          : 'bg-purple-500'
                      }`}
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>

                  {quest.completed ? (
                    <div className="w-full py-2.5 rounded-xl bg-slate-800 text-slate-400 text-xs font-bold text-center flex items-center justify-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Bounty Claimed
                    </div>
                  ) : isReady ? (
                    <button
                      onClick={() => handleClaimReward(quest)}
                      className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-amber-500/30 transition animate-pulse"
                    >
                      Claim Bounty (+{quest.xpReward} XP)!
                    </button>
                  ) : (
                    <button
                      onClick={() => handleIncrementProgress(quest.id)}
                      className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
                    >
                      +1 Bounty Step (Test)
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
