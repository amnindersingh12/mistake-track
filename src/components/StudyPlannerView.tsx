import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar,
  Clock,
  Sparkles,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Play,
  BookOpen,
  HelpCircle,
  FileText,
  Flame,
  ChevronRight,
  TrendingUp,
  AlertCircle
} from 'lucide-react';
import { MistakeEntry, StudySessionType, UserXPState } from '../types';
import {
  generateSchedule,
  reallocateMissedSessions,
  calculateScheduleDistribution,
  PHASE_PRESETS,
  PhaseName,
  ScheduledStudySession,
  SessionStatus
} from '../utils/scheduleGenerator';
import { getLocalDateStr } from '../utils/srs';
import { awardXP, getXpState, saveXpState } from '../utils/xpEngine';
import { db } from '../db/db';

export interface StudyPlannerViewProps {
  mistakes?: MistakeEntry[];
  onStartFocus?: (session: { title: string; type: StudySessionType; durationMinutes: number }) => void;
  onNavigateTab?: (tab: string) => void;
}

const STORAGE_KEY = 'studybridge_scheduled_sessions';
const PHASE_STORAGE_KEY = 'studybridge_active_phase';

export const StudyPlannerView: React.FC<StudyPlannerViewProps> = ({
  mistakes = [],
  onStartFocus,
  onNavigateTab
}) => {
  const [selectedPhase, setSelectedPhase] = useState<PhaseName>(() => {
    return (localStorage.getItem(PHASE_STORAGE_KEY) as PhaseName) || 'regular';
  });

  const [sessions, setSessions] = useState<ScheduledStudySession[]>([]);
  const [lastRolloverCount, setLastRolloverCount] = useState<number | null>(null);
  const [xpState, setXpState] = useState<UserXPState | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Load saved sessions or generate fresh schedule
  useEffect(() => {
    getXpState().then(setXpState).catch(() => {});

    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSessions(parsed);
          return;
        }
      }
    } catch {
      // Fallback to generation
    }

    handleGenerateSchedule(selectedPhase);
  }, []);

  // Save changes to localStorage
  const saveSessions = (updated: ScheduledStudySession[]) => {
    setSessions(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // Ignore quota errors
    }
  };

  const handlePhaseChange = (phase: PhaseName) => {
    setSelectedPhase(phase);
    localStorage.setItem(PHASE_STORAGE_KEY, phase);
    handleGenerateSchedule(phase);
  };

  const handleGenerateSchedule = async (phase: PhaseName = selectedPhase) => {
    // Attempt to pull topics from Dexie if available
    let dbTopics: any[] = [];
    try {
      dbTopics = await db.topics.toArray();
    } catch {
      // Ignore
    }

    const newSessions = generateSchedule({
      phase,
      startDate: getLocalDateStr(),
      daysCount: 7,
      mistakesDue: mistakes,
      topics: dbTopics.length > 0 ? dbTopics : undefined
    });

    saveSessions(newSessions);
    setLastRolloverCount(null);
    showToast(`Generated balanced 7-day ${PHASE_PRESETS[phase].label} plan!`);
  };

  const handleIntelligentRollover = () => {
    const today = getLocalDateStr();
    const { reallocatedSessions, rolloverCount } = reallocateMissedSessions(
      sessions,
      today,
      PHASE_PRESETS[selectedPhase].dailyHoursAllocation
    );

    saveSessions(reallocatedSessions);
    setLastRolloverCount(rolloverCount);

    if (rolloverCount > 0) {
      showToast(`Rolled over ${rolloverCount} missed sessions into upcoming open slots!`);
    } else {
      showToast('All sessions up to date! No pending missed sessions found.');
    }
  };

  const handleToggleStatus = async (sessionId: string, currentStatus: SessionStatus) => {
    const nextStatus: SessionStatus = currentStatus === 'completed' ? 'pending' : 'completed';

    const updated = sessions.map(s => {
      if (s.id === sessionId) {
        return { ...s, status: nextStatus };
      }
      return s;
    });

    saveSessions(updated);

    if (nextStatus === 'completed' && xpState) {
      const award = awardXP(xpState, 'review');
      setXpState(award.nextState);
      await saveXpState(award.nextState);
      showToast(`Completed! +${award.xpGained} XP awarded (${award.nextState.rankTitle})`);
    }
  };

  const handleMarkMissed = (sessionId: string) => {
    const updated = sessions.map(s => {
      if (s.id === sessionId) {
        return { ...s, status: 'missed' as SessionStatus };
      }
      return s;
    });
    saveSessions(updated);
    showToast('Session marked missed. Click "Intelligent Rollover" to catch up!');
  };

  const showToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 3500);
  };

  const stats = useMemo(() => {
    return calculateScheduleDistribution(sessions);
  }, [sessions]);

  // Group sessions by date
  const groupedByDate = useMemo(() => {
    const map = new Map<string, ScheduledStudySession[]>();
    for (const s of sessions) {
      const list = map.get(s.date) || [];
      list.push(s);
      map.set(s.date, list);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [sessions]);

  const todayStr = getLocalDateStr();

  const getTypeStyle = (type: StudySessionType) => {
    switch (type) {
      case 'mock':
        return {
          bg: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
          badge: 'bg-amber-500 text-slate-950 font-bold',
          icon: <Flame className="w-4 h-4 text-amber-400" />
        };
      case 'review':
        return {
          bg: 'bg-purple-500/10 border-purple-500/30 text-purple-400',
          badge: 'bg-purple-500/20 text-purple-300 border border-purple-500/30',
          icon: <RotateCcw className="w-4 h-4 text-purple-400" />
        };
      case 'practice':
        return {
          bg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
          badge: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
          icon: <HelpCircle className="w-4 h-4 text-emerald-400" />
        };
      case 'reading':
      default:
        return {
          bg: 'bg-blue-500/10 border-blue-500/30 text-blue-400',
          badge: 'bg-blue-500/20 text-blue-300 border border-blue-500/30',
          icon: <BookOpen className="w-4 h-4 text-blue-400" />
        };
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Toast */}
      {successToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 border border-emerald-500/40 text-emerald-300 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2">
          <Sparkles className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-sm font-medium">{successToast}</span>
        </div>
      )}

      {/* Top Banner / Phase Selector */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 backdrop-blur-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                SPEC B • Study Loop Engine
              </span>
              <span className="text-xs text-slate-400 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> 7-Day Auto Rebalancer
              </span>
            </div>
            <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
              <Calendar className="w-6 h-6 text-indigo-400" /> Study Planner & Availability
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Balances theory reading, active PYQ practice, spaced error reviews, and Sunday full mock drills.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleIntelligentRollover}
              className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 rounded-xl text-sm font-semibold transition"
              title="Intelligently reschedule missed past sessions to future open slots"
            >
              <RotateCcw className="w-4 h-4" />
              Intelligent Rollover
              {lastRolloverCount !== null && lastRolloverCount > 0 && (
                <span className="bg-indigo-500 text-white text-xs px-1.5 py-0.2 rounded-full font-bold">
                  {lastRolloverCount}
                </span>
              )}
            </button>

            <button
              onClick={() => handleGenerateSchedule(selectedPhase)}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-indigo-600/20 transition"
            >
              <Sparkles className="w-4 h-4" /> Regenerate Schedule
            </button>
          </div>
        </div>

        {/* Phase selector tabs */}
        <div className="mt-6 pt-5 border-t border-slate-800">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-3">
            Select Availability Phase:
          </label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {(Object.keys(PHASE_PRESETS) as PhaseName[]).map(pKey => {
              const preset = PHASE_PRESETS[pKey];
              const isSelected = selectedPhase === pKey;
              return (
                <button
                  key={pKey}
                  onClick={() => handlePhaseChange(pKey)}
                  className={`text-left p-4 rounded-xl border transition flex flex-col justify-between ${
                    isSelected
                      ? 'bg-indigo-950/40 border-indigo-500/60 ring-1 ring-indigo-500/40 shadow-lg shadow-indigo-950/50'
                      : 'bg-slate-800/40 border-slate-800 hover:border-slate-700 hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-sm font-bold ${isSelected ? 'text-indigo-300' : 'text-slate-200'}`}>
                      {preset.label.split('(')[0].trim()}
                    </span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                        isSelected
                          ? 'bg-indigo-500 text-white'
                          : 'bg-slate-700/60 text-slate-300'
                      }`}
                    >
                      ~{preset.targetHoursPerWeek}h / wk
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-2 leading-relaxed">{preset.description}</p>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Target Hours & Distribution Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-400 font-medium flex items-center justify-between">
            <span>Total Target</span>
            <Clock className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold text-slate-100 mt-1">{stats.totalHours} hrs</div>
          <div className="text-xs text-slate-500 mt-0.5">
            {stats.completedCount} of {stats.totalSessions} sessions ({stats.completionRate}%)
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
            <div
              className="bg-indigo-500 h-full rounded-full transition-all duration-300"
              style={{ width: `${stats.completionRate}%` }}
            />
          </div>
        </div>

        <div className="bg-slate-900/80 border border-blue-900/30 rounded-xl p-4">
          <div className="text-xs text-blue-400 font-medium flex items-center justify-between">
            <span>Reading & Theory</span>
            <BookOpen className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-blue-100 mt-1">{stats.byType.reading.hours} hrs</div>
          <div className="text-xs text-slate-500 mt-0.5">{stats.byType.reading.percentage}% of weekly study</div>
        </div>

        <div className="bg-slate-900/80 border border-emerald-900/30 rounded-xl p-4">
          <div className="text-xs text-emerald-400 font-medium flex items-center justify-between">
            <span>PYQ Practice</span>
            <HelpCircle className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-100 mt-1">{stats.byType.practice.hours} hrs</div>
          <div className="text-xs text-slate-500 mt-0.5">{stats.byType.practice.percentage}% of weekly study</div>
        </div>

        <div className="bg-slate-900/80 border border-purple-900/30 rounded-xl p-4">
          <div className="text-xs text-purple-400 font-medium flex items-center justify-between">
            <span>SRS Review</span>
            <RotateCcw className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-purple-100 mt-1">{stats.byType.review.hours} hrs</div>
          <div className="text-xs text-slate-500 mt-0.5">{stats.byType.review.percentage}% of weekly study</div>
        </div>

        <div className="col-span-2 md:col-span-1 bg-slate-900/80 border border-amber-900/30 rounded-xl p-4">
          <div className="text-xs text-amber-400 font-medium flex items-center justify-between">
            <span>Weekend Mock</span>
            <Flame className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-100 mt-1">{stats.byType.mock.hours} hrs</div>
          <div className="text-xs text-slate-500 mt-0.5">{stats.byType.mock.percentage}% of weekly study</div>
        </div>
      </div>

      {/* Schedule Board */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-200 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-indigo-400" />
            Weekly Study Sessions Board
          </h2>
          <span className="text-xs text-slate-400">
            {groupedByDate.length} active schedule days
          </span>
        </div>

        {groupedByDate.map(([dateStr, daySessions]) => {
          const isToday = dateStr === todayStr;
          const dayName = daySessions[0]?.dayOfWeek || '';
          const totalDayMin = daySessions.reduce((acc, s) => acc + s.durationMinutes, 0);

          return (
            <div
              key={dateStr}
              className={`rounded-2xl border transition-all ${
                isToday
                  ? 'bg-slate-900 border-indigo-500/50 ring-1 ring-indigo-500/30 shadow-xl'
                  : 'bg-slate-900/60 border-slate-800'
              } p-5`}
            >
              {/* Day Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`px-3 py-1 rounded-lg text-sm font-bold flex items-center gap-1.5 ${
                      isToday
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                        : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    <span>{dayName}</span>
                    {isToday && <span className="text-xs px-1.5 py-0.2 bg-white/20 rounded-md">TODAY</span>}
                  </div>
                  <span className="text-sm text-slate-400 font-medium">{dateStr}</span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 font-medium flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {Math.round((totalDayMin / 60) * 10) / 10} hrs planned ({daySessions.length} sessions)
                  </span>
                </div>
              </div>

              {/* Sessions list */}
              <div className="grid grid-cols-1 gap-3">
                {daySessions.map(session => {
                  const style = getTypeStyle(session.type);
                  const isCompleted = session.status === 'completed';
                  const isMissed = session.status === 'missed';

                  return (
                    <div
                      key={session.id}
                      className={`p-4 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-3 transition ${
                        isCompleted
                          ? 'bg-slate-950/40 border-slate-800/60 opacity-70'
                          : isMissed
                          ? 'bg-rose-950/20 border-rose-900/30'
                          : `${style.bg} hover:border-slate-700`
                      }`}
                    >
                      <div className="flex items-start gap-3.5">
                        <button
                          onClick={() => handleToggleStatus(session.id, session.status)}
                          className="mt-0.5 text-slate-400 hover:text-emerald-400 transition"
                          title={isCompleted ? 'Mark pending' : 'Mark completed (+XP)'}
                        >
                          {isCompleted ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                          ) : (
                            <div className="w-5 h-5 rounded-md border-2 border-slate-600 hover:border-emerald-400" />
                          )}
                        </button>

                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`px-2 py-0.5 rounded text-xs font-semibold uppercase ${style.badge}`}>
                              {session.type}
                            </span>
                            {session.subject && (
                              <span className="text-xs text-slate-400 font-medium">
                                {session.subject}
                              </span>
                            )}
                            {session.priority === 'high' && (
                              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                                HIGH PRIORITY
                              </span>
                            )}
                            {session.originalDate && (
                              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                ROLLED OVER
                              </span>
                            )}
                          </div>

                          <h4
                            className={`text-sm font-semibold mt-1 ${
                              isCompleted ? 'line-through text-slate-500' : 'text-slate-200'
                            }`}
                          >
                            {session.title}
                          </h4>

                          {session.notes && (
                            <p className="text-xs text-slate-400 mt-1 max-w-2xl">{session.notes}</p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                        <span className="text-xs font-semibold text-slate-300 px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          {session.durationMinutes} min
                        </span>

                        {!isCompleted && !isMissed && (
                          <button
                            onClick={() => handleMarkMissed(session.id)}
                            className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition"
                            title="Mark as missed"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        )}

                        <button
                          onClick={() => {
                            if (onStartFocus) {
                              onStartFocus({
                                title: session.title,
                                type: session.type,
                                durationMinutes: session.durationMinutes
                              });
                            } else if (onNavigateTab) {
                              onNavigateTab('focus');
                            }
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow transition"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          Start
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
