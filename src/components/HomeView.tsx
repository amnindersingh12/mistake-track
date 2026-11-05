import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar,
  Clock,
  Flame,
  Zap,
  Trophy,
  ArrowRight,
  CheckCircle2,
  PlusCircle,
  FileText,
  Play,
  RotateCcw,
  Sparkles,
  BookOpen,
  HelpCircle,
  ChevronRight,
  TrendingUp,
  AlertCircle,
  Swords,
  Timer
} from 'lucide-react';
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar
} from 'recharts';
import { ExamProfile, MistakeEntry, MockTest, StudyTask, UserXPState } from '../types';
import { db } from '../db/db';
import { getXpState, calculateLevelAndRank, awardXP, saveXpState } from '../utils/xpEngine';
import { getLocalDateStr, addDaysToDate } from '../utils/srs';

export interface HomeViewProps {
  onNavigateTab: (tab: string) => void;
  onOpenQuickAdd: () => void;
  onOpenFocus?: (session?: { title: string; type: string; durationMinutes: number }) => void;
  onOpenBossBattle?: () => void;
}

interface QuickNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (noteTitle: string) => void;
}

const QuickNoteModal: React.FC<QuickNoteModalProps> = ({ isOpen, onClose, onSaved }) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!title.trim()) return;
    try {
      await db.notes.add({
        topicId: 'general',
        title: title.trim(),
        content: content.trim(),
        formulae: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      onSaved(title.trim());
      setTitle('');
      setContent('');
      onClose();
    } catch {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
        <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
          <FileText className="w-5 h-5 text-indigo-400" /> Capture Quick Study Note
        </h3>
        <div>
          <label className="text-xs text-slate-400 font-semibold block mb-1">Note Title / Formula:</label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g. Master Theorem Case 2 shortcut"
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="text-xs text-slate-400 font-semibold block mb-1">Key Insight / Details:</label>
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="Add formulas, constraints, or gotchas..."
            className="w-full h-28 bg-slate-800 border border-slate-700 rounded-lg p-3 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
          />
        </div>
        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!title.trim()}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow transition"
          >
            Save Note
          </button>
        </div>
      </div>
    </div>
  );
};

export const HomeView: React.FC<HomeViewProps> = ({
  onNavigateTab,
  onOpenQuickAdd,
  onOpenFocus,
  onOpenBossBattle
}) => {
  const [profile, setProfile] = useState<ExamProfile | null>(null);
  const [xpState, setXpState] = useState<UserXPState | null>(null);
  const [mistakes, setMistakes] = useState<MistakeEntry[]>([]);
  const [mocks, setMocks] = useState<MockTest[]>([]);
  const [tasks, setTasks] = useState<StudyTask[]>([]);
  const [recentActivities, setRecentActivities] = useState<Array<{ id: string; type: string; title: string; time: string; badge: string }>>([]);

  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Today's checklist items
  const [checklist, setChecklist] = useState<Array<{ id: string; title: string; type: string; durationMinutes: number; completed: boolean }>>([
    { id: 'chk-1', title: 'Review 8 Due Mistakes in SRS Queue', type: 'review', durationMinutes: 25, completed: false },
    { id: 'chk-2', title: 'Solve 10 PYQs: Subnetting & CIDR', type: 'practice', durationMinutes: 45, completed: false },
    { id: 'chk-3', title: 'Theory: Dynamic Programming State Formulations', type: 'reading', durationMinutes: 30, completed: false }
  ]);

  useEffect(() => {
    loadHomeData();
  }, []);

  const loadHomeData = async () => {
    try {
      // 1. Profile
      const defaultProf = await db.profiles.filter(p => p.isDefault).first();
      setProfile(defaultProf || null);

      // 2. XP State
      const state = await getXpState();
      setXpState(state);

      // 3. Mistakes
      const loadedMistakes = await db.mistakes.toArray();
      setMistakes(loadedMistakes);

      // 4. Mocks
      const loadedMocks = await db.mocks.toArray();
      setMocks(loadedMocks);

      // 5. Tasks
      const loadedTasks = await db.tasks.toArray();
      setTasks(loadedTasks);

      // Build recent activity feed
      const activities: Array<{ id: string; type: string; title: string; time: string; badge: string }> = [];

      for (const m of loadedMistakes.slice(-3)) {
        activities.push({
          id: `m-${m.id}`,
          type: 'Mistake Logged',
          title: `${m.topic || 'Unclassified'}: ${m.questionText?.slice(0, 45) || 'Logged question'}...`,
          time: m.createdAt?.split('T')[0] || getLocalDateStr(),
          badge: 'bg-rose-500/20 text-rose-300'
        });
      }

      for (const mk of loadedMocks.slice(-2)) {
        activities.push({
          id: `mk-${mk.id}`,
          type: 'Mock Attempted',
          title: `${mk.name} (Score: ${mk.totalNetScore} / Accuracy: ${mk.overallAccuracy}%)`,
          time: mk.date || getLocalDateStr(),
          badge: 'bg-amber-500/20 text-amber-300'
        });
      }

      setRecentActivities(activities.reverse());
    } catch {
      // Non-fatal
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleToggleChecklist = async (id: string) => {
    const nextChecklist = checklist.map(item => {
      if (item.id === id) {
        return { ...item, completed: !item.completed };
      }
      return item;
    });
    setChecklist(nextChecklist);

    const toggled = nextChecklist.find(i => i.id === id);
    if (toggled?.completed && xpState) {
      const award = awardXP(xpState, 'review');
      setXpState(award.nextState);
      await saveXpState(award.nextState);
      showToast(`Completed task! +${award.xpGained} XP awarded!`);
    }
  };

  // Target exam countdown (e.g. GATE target year 2027)
  const countdown = useMemo(() => {
    const targetDate = new Date(profile?.targetYear ? `${profile.targetYear}-02-06T09:00:00` : '2027-02-06T09:00:00');
    const now = new Date();
    const diffMs = targetDate.getTime() - now.getTime();
    if (diffMs <= 0) return { days: 0, hours: 0 };
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    return { days, hours };
  }, [profile]);

  const rankInfo = xpState ? calculateLevelAndRank(xpState.totalXp) : null;

  // Single Highest Leverage Suggestion (Next Best Action)
  const nextBestAction = useMemo(() => {
    const today = getLocalDateStr();
    const dueReviews = mistakes.filter(m => m.nextReviewDate && m.nextReviewDate <= today && m.status !== 'mastered');

    if (dueReviews.length >= 5) {
      return {
        title: `Clear ${dueReviews.length} Overdue Mistakes in SRS Review Queue`,
        description: `Spaced review cards are pending. Reviewing them now prevents memory decay and locks in an estimated +${Math.min(10, Math.round(dueReviews.length * 0.7))} marks.`,
        actionLabel: 'Start SRS Review',
        targetTab: 'review',
        xpBonus: 15 * dueReviews.length,
        priority: 'URGENT'
      };
    }

    if (mocks.length === 0) {
      return {
        title: 'Attempt Baseline Diagnostic Mock Exam',
        description: 'Calibrate your starting score, uncover baseline topic weaknesses, and establish target cutoff boundaries.',
        actionLabel: 'Launch Diagnostic Mock',
        targetTab: 'mocks',
        xpBonus: 100,
        priority: 'HIGH'
      };
    }

    return {
      title: 'Practice 10 High-Frequency PYQ Questions',
      description: 'Strengthen Computer Networks & Operating Systems problem-solving speed under 45-minute timed focus.',
      actionLabel: 'Start Practice Session',
      targetTab: 'focus',
      xpBonus: 50,
      priority: 'RECOMMENDED'
    };
  }, [mistakes, mocks]);

  // Subject Mastery Radar Data
  const radarData = useMemo(() => {
    return [
      { subject: 'Algorithms', mastery: 78, fullMark: 100 },
      { subject: 'DBMS', mastery: 85, fullMark: 100 },
      { subject: 'Networks', mastery: 62, fullMark: 100 },
      { subject: 'OS', mastery: 74, fullMark: 100 },
      { subject: 'Math', mastery: 90, fullMark: 100 },
      { subject: 'TOC', mastery: 55, fullMark: 100 }
    ];
  }, []);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 border border-emerald-500/50 text-emerald-300 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3">
          <Sparkles className="w-5 h-5 text-emerald-400" />
          <span className="text-sm font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* Quick Note Modal */}
      <QuickNoteModal
        isOpen={isNoteModalOpen}
        onClose={() => setIsNoteModalOpen(false)}
        onSaved={title => showToast(`Saved note: "${title}"`)}
      />

      {/* Top Banner: Active Exam Name, Countdown, Rank, Streak */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          {/* Exam info & Countdown */}
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                HOME COMMAND CENTER
              </span>
              <span className="text-xs text-slate-400 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" /> Exam Countdown
              </span>
            </div>

            <h1 className="text-2xl md:text-3xl font-black text-slate-100 flex items-center gap-3">
              {profile?.name || 'GATE CS (2027)'}
            </h1>

            <div className="flex items-center gap-3 mt-2">
              <span className="text-xs text-slate-400">Target Year: {profile?.targetYear || 2027}</span>
              <span className="text-slate-600">•</span>
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400">
                <Clock className="w-4 h-4 text-amber-400" />
                <span>{countdown.days} Days, {countdown.hours} Hours Remaining</span>
              </div>
            </div>
          </div>

          {/* Gamification Stats: Rank, Level, XP Bar, Streak */}
          <div className="flex flex-wrap items-center gap-4 bg-slate-950/60 border border-slate-800 p-4 rounded-xl">
            {/* Rank Avatar */}
            <div className="w-14 h-14 rounded-2xl bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-3xl shrink-0 shadow-inner">
              {rankInfo?.badge || '🥋'}
            </div>

            {/* Rank & Level */}
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-100">
                  {rankInfo?.rank || 'Aspirant'}
                </span>
                <span className="text-xs px-2 py-0.2 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                  Lvl {rankInfo?.level || 1}
                </span>
              </div>

              {/* XP Progress */}
              <div className="w-36 bg-slate-800 h-2 rounded-full overflow-hidden mt-2">
                <div
                  className="bg-gradient-to-r from-indigo-500 to-amber-400 h-full rounded-full transition-all duration-500"
                  style={{ width: `${rankInfo?.progress || 0}%` }}
                />
              </div>
              <div className="text-[10px] text-slate-400 mt-1">
                {xpState?.totalXp || 0} XP • {rankInfo?.progress || 0}% to Next Rank
              </div>
            </div>

            {/* Streak */}
            <div className="pl-4 border-l border-slate-800 text-center">
              <div className="text-[10px] text-slate-400 font-semibold flex items-center justify-center gap-1">
                <Flame className="w-3.5 h-3.5 text-rose-500" /> Streak
              </div>
              <div className="text-xl font-black text-rose-400 mt-0.5">
                {xpState?.currentStreak || 0}d
              </div>
              <div className="text-[9px] text-slate-500">
                {xpState?.streakFreezesAvailable || 0} Freezes
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Capture Triggers Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          onClick={onOpenQuickAdd}
          className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 hover:bg-slate-800/80 transition flex items-center gap-3 text-left group"
        >
          <div className="p-2 rounded-lg bg-rose-500/20 text-rose-400 group-hover:scale-105 transition">
            <PlusCircle className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-200">Log Mistake</div>
            <div className="text-[11px] text-slate-400">Error card + tags</div>
          </div>
        </button>

        <button
          onClick={() => setIsNoteModalOpen(true)}
          className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 hover:bg-slate-800/80 transition flex items-center gap-3 text-left group"
        >
          <div className="p-2 rounded-lg bg-blue-500/20 text-blue-400 group-hover:scale-105 transition">
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-200">Quick Note</div>
            <div className="text-[11px] text-slate-400">Capture formula/trap</div>
          </div>
        </button>

        <button
          onClick={() => {
            if (onOpenFocus) {
              onOpenFocus();
            } else {
              onNavigateTab('focus');
            }
          }}
          className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 hover:bg-slate-800/80 transition flex items-center gap-3 text-left group"
        >
          <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 group-hover:scale-105 transition">
            <Timer className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-200">Start Timer</div>
            <div className="text-[11px] text-slate-400">25/5 or 50/10 focus</div>
          </div>
        </button>

        <button
          onClick={() => {
            if (onOpenBossBattle) {
              onOpenBossBattle();
            } else {
              onNavigateTab('quests');
            }
          }}
          className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 hover:bg-slate-800/80 transition flex items-center gap-3 text-left group"
        >
          <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400 group-hover:scale-105 transition">
            <Swords className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-200">Boss Battle</div>
            <div className="text-[11px] text-slate-400">Weekly 15-Q challenge</div>
          </div>
        </button>
      </div>

      {/* Main Grid: Next Best Action & Checklist (2 Cols) + Mastery Radar & Activities (1 Col) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Next Best Action Card */}
          <div className="bg-gradient-to-r from-indigo-950/40 via-slate-900 to-slate-900 border border-indigo-500/40 rounded-2xl p-6 shadow-xl relative overflow-hidden">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-indigo-500 text-white uppercase tracking-wider">
                HIGHEST LEVERAGE NEXT ACTION
              </span>
              <span className="text-xs font-bold text-amber-300 flex items-center gap-1">
                <Zap className="w-3.5 h-3.5" /> +{nextBestAction.xpBonus} XP Potential
              </span>
            </div>

            <h3 className="text-lg font-bold text-slate-100 mt-2">{nextBestAction.title}</h3>
            <p className="text-xs text-slate-300 mt-1.5 leading-relaxed max-w-xl">
              {nextBestAction.description}
            </p>

            <div className="mt-5 flex items-center gap-3">
              <button
                onClick={() => onNavigateTab(nextBestAction.targetTab)}
                className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-600/30 transition"
              >
                <span>{nextBestAction.actionLabel}</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                onClick={() => onNavigateTab('planner')}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition"
              >
                View Full Study Plan
              </button>
            </div>
          </div>

          {/* Today's Study Checklist */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-indigo-400" />
                <h3 className="text-base font-bold text-slate-100">Today's Study Checklist</h3>
              </div>
              <span className="text-xs text-slate-400 font-medium">
                {checklist.filter(c => c.completed).length} of {checklist.length} Completed
              </span>
            </div>

            <div className="space-y-3">
              {checklist.map(item => (
                <div
                  key={item.id}
                  className={`p-3.5 rounded-xl border transition flex items-center justify-between gap-3 ${
                    item.completed
                      ? 'bg-slate-950/40 border-slate-800/60 opacity-60'
                      : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleToggleChecklist(item.id)}
                      className="text-slate-400 hover:text-emerald-400 transition shrink-0"
                    >
                      {item.completed ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      ) : (
                        <div className="w-5 h-5 rounded-md border-2 border-slate-600 hover:border-emerald-400" />
                      )}
                    </button>

                    <div>
                      <div
                        className={`text-xs font-bold ${
                          item.completed ? 'line-through text-slate-500' : 'text-slate-200'
                        }`}
                      >
                        {item.title}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-400">
                        <span className="uppercase font-semibold text-indigo-400">{item.type}</span>
                        <span>•</span>
                        <span>{item.durationMinutes} min block</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      if (onOpenFocus) {
                        onOpenFocus({
                          title: item.title,
                          type: item.type,
                          durationMinutes: item.durationMinutes
                        });
                      } else {
                        onNavigateTab('focus');
                      }
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow transition shrink-0"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    Start
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Col: Subject Mastery Radar + Activity Feed */}
        <div className="space-y-6">
          {/* Subject Mastery Radar Chart */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800 mb-2">
              <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" /> Subject Mastery Radar
              </h3>
              <span className="text-[10px] text-slate-400 font-semibold">Evidence-Based</span>
            </div>

            <div className="w-full h-56 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarData}>
                  <PolarGrid stroke="#334155" />
                  <PolarAngleAxis dataKey="subject" stroke="#94a3b8" tick={{ fontSize: 10 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="#475569" tick={false} />
                  <Radar
                    name="Mastery"
                    dataKey="mastery"
                    stroke="#6366f1"
                    fill="#6366f1"
                    fillOpacity={0.4}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            <div className="text-center text-[10px] text-slate-500">
              High: Math (90%), DBMS (85%) • Focus Needed: TOC (55%)
            </div>
          </div>

          {/* Recent Activity Feed */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800 mb-3">
              <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-400" /> Recent Study Activity
              </h3>
              <span className="text-[10px] text-slate-400">Live Feed</span>
            </div>

            {recentActivities.length === 0 ? (
              <div className="text-center text-xs text-slate-500 py-6 border border-dashed border-slate-800 rounded-xl">
                No recent activity logged yet. Log your first mistake or mock test!
              </div>
            ) : (
              <div className="space-y-2.5">
                {recentActivities.map(act => (
                  <div
                    key={act.id}
                    className="p-2.5 rounded-xl bg-slate-950/40 border border-slate-800/80 text-xs flex flex-col gap-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded uppercase ${act.badge}`}>
                        {act.type}
                      </span>
                      <span className="text-[10px] text-slate-500">{act.time}</span>
                    </div>
                    <div className="text-slate-200 font-medium truncate">{act.title}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
