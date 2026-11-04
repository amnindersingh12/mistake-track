import React, { useState, useMemo } from 'react';
import {
  MockTest,
  MistakeEntry,
  ExamSettings,
  PaperTest,
  StudyTask
} from '../types';
import { NavTab } from './Sidebar';
import { Mascot } from './Mascot';
import { generateInsights, FocusAction, InsightCard } from '../utils/insights';
import { calculateTopicMastery } from '../utils/topicMastery';
import { getTodayDateStr } from '../utils/srs';
import {
  Brain,
  Flame,
  Award,
  Target,
  Sparkles,
  ChevronRight,
  TrendingUp,
  AlertTriangle,
  Upload,
  Plus,
  BookOpen,
  Filter,
  CheckCircle2,
  Clock,
  ListTodo,
  CheckSquare
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';

interface DashboardViewProps {
  mocks: MockTest[];
  mistakes: MistakeEntry[];
  papers?: PaperTest[];
  tasks?: StudyTask[];
  settings: ExamSettings;
  onNavigateToTab: (tab: NavTab) => void;
  onOpenQuickAdd: () => void;
  onOpenDataIntake: () => void;
  onToggleTask?: (taskId: number) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  mocks,
  mistakes,
  papers = [],
  tasks = [],
  settings,
  onNavigateToTab,
  onOpenQuickAdd,
  onOpenDataIntake,
  onToggleTask
}) => {
  const [attemptFilter, setAttemptFilter] = useState<'all' | 'mock' | 'pyq' | 'memory-based'>('all');

  const todayStr = getTodayDateStr();

  // Filter mocks according to attempt filter
  const filteredMocks = useMemo(() => {
    if (attemptFilter === 'all') return mocks;
    return mocks.filter((m) => m.attemptType === attemptFilter);
  }, [mocks, attemptFilter]);

  // Topic Mastery Matrix computed from real user data
  const masteryMatrix = useMemo(() => {
    return calculateTopicMastery(settings.sections, mocks, mistakes, papers);
  }, [settings.sections, mocks, mistakes, papers]);

  // Daily SRS Review count
  const pendingReviewCount = useMemo(() => {
    return mistakes.filter(
      (m) => m.status !== 'Mastered' && m.nextReviewDate <= todayStr
    ).length;
  }, [mistakes, todayStr]);

  const masteredMistakesCount = useMemo(() => {
    return mistakes.filter((m) => m.status === 'Mastered').length;
  }, [mistakes]);

  // Consecutive active day streak
  const currentStreak = useMemo(() => {
    const activeDates = new Set<string>();
    mocks.forEach((m) => activeDates.add(m.date));
    mistakes.forEach((m) => {
      if (m.createdAt) activeDates.add(m.createdAt.slice(0, 10));
      (m.history || []).forEach((h) => activeDates.add(h.date));
    });

    const sortedDates = Array.from(activeDates).sort().reverse();
    if (sortedDates.length === 0) return 0;

    let streak = 0;
    const checkDate = new Date();
    // Allow today or yesterday as latest
    let currentCheckStr = checkDate.toISOString().slice(0, 10);
    if (!sortedDates.includes(currentCheckStr)) {
      checkDate.setDate(checkDate.getDate() - 1);
      currentCheckStr = checkDate.toISOString().slice(0, 10);
      if (!sortedDates.includes(currentCheckStr)) return 0;
    }

    while (sortedDates.includes(currentCheckStr)) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
      currentCheckStr = checkDate.toISOString().slice(0, 10);
    }
    return streak;
  }, [mocks, mistakes]);

  // Overall statistics
  const totalAttemptedQuestions = useMemo(() => {
    return mocks.reduce((sum, m) => sum + (m.totalAttempted || 0), 0);
  }, [mocks]);

  const totalWrongQuestions = useMemo(() => {
    return mocks.reduce((sum, m) => sum + (m.totalWrong || 0), 0);
  }, [mocks]);

  const overallAccuracy = useMemo(() => {
    if (totalAttemptedQuestions === 0) return 0;
    const totalCorrect = mocks.reduce((sum, m) => sum + (m.totalCorrect || 0), 0);
    return Math.round((totalCorrect / totalAttemptedQuestions) * 100);
  }, [mocks, totalAttemptedQuestions]);

  const bestScore = useMemo(() => {
    if (mocks.length === 0) return 0;
    return Math.max(...mocks.map((m) => m.totalNetScore || 0));
  }, [mocks]);

  const lastMock = filteredMocks[filteredMocks.length - 1];
  const gapToTarget = lastMock ? Math.round((settings.targetScore - lastMock.totalNetScore) * 10) / 10 : settings.targetScore;

  // Key diagnostic insights
  const insightsData = useMemo(() => {
    return generateInsights(mocks, mistakes, settings);
  }, [mocks, mistakes, settings]);

  // Line Chart Trend
  const scoreTrendData = useMemo(() => {
    return filteredMocks.map((m, idx) => ({
      index: idx + 1,
      name: m.name.length > 15 ? m.name.slice(0, 15) + '...' : m.name,
      score: m.totalNetScore,
      accuracy: m.overallAccuracy,
      target: settings.targetScore,
      cutoff: settings.overallCutoff
    }));
  }, [filteredMocks, settings]);

  // Error type breakdown pie
  const errorDistributionData = useMemo(() => {
    const counts: Record<string, number> = {};
    mistakes.forEach((m) => {
      (m.errorTypes || []).forEach((e) => {
        counts[e] = (counts[e] || 0) + 1;
      });
    });
    const entries = Object.entries(counts).map(([name, value]) => ({ name, value }));
    entries.sort((a, b) => b.value - a.value);
    return entries.slice(0, 6);
  }, [mistakes]);

  const PIE_COLORS = ['#EF4444', '#F97316', '#F59E0B', '#3B82F6', '#8B5CF6', '#EC4899'];

  // Designed empty state if no mocks or mistakes exist
  if (mocks.length === 0 && mistakes.length === 0) {
    return (
      <div className="max-w-4xl mx-auto space-y-8 pb-12 pt-4">
        {/* Empty State Hero Panel */}
        <div className="manga-panel p-8 sm:p-12 rounded-3xl bg-[var(--bg-panel)] text-center space-y-6 washi-tape">
          <Mascot mood="sleepy" size="xl" className="mx-auto" />
          <div className="space-y-2">
            <span className="text-xs font-mono font-bold text-[var(--action-primary)] uppercase tracking-wider block">
              Personal Command Centre
            </span>
            <h2 className="font-display text-xl sm:text-2xl font-bold text-[var(--text-primary)]">
              Your Study Engine is Ready for Test #1
            </h2>
            <p className="text-xs sm:text-sm text-[var(--text-muted)] max-w-lg mx-auto leading-relaxed">
              No mocks or mistakes have been logged yet. The notebook starts completely empty with zero fake data. Add your first Testbook mock or paste your scorecard to bring your analytics to life.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              onClick={onOpenDataIntake}
              className="manga-btn px-5 py-3 rounded-2xl bg-[var(--action-primary)] text-white font-bold text-xs sm:text-sm flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              <span>Paste Testbook Scorecard</span>
            </button>
            <button
              onClick={() => onNavigateToTab('mocks')}
              className="manga-btn px-5 py-3 rounded-2xl bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-subtle)] font-bold text-xs sm:text-sm flex items-center gap-2"
            >
              <Plus className="w-4 h-4 text-[var(--action-primary)]" />
              <span>Manual Mock Entry</span>
            </button>
            <button
              onClick={() => onNavigateToTab('papers')}
              className="manga-btn px-5 py-3 rounded-2xl bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-subtle)] font-bold text-xs sm:text-sm flex items-center gap-2"
            >
              <BookOpen className="w-4 h-4 text-[var(--status-success)]" />
              <span>Add Previous Year Paper</span>
            </button>
          </div>
        </div>

        {/* 3 Step Onboarding Panel */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="manga-panel p-5 rounded-2xl bg-[var(--bg-panel)] space-y-2">
            <span className="font-display text-sm font-bold text-[var(--action-primary)]">01. Log Real Mock</span>
            <p className="text-xs text-[var(--text-muted)]">
              Paste your Testbook result text or enter section attempts. Scores and negative mark drain calculate automatically.
            </p>
          </div>
          <div className="manga-panel p-5 rounded-2xl bg-[var(--bg-panel)] space-y-2">
            <span className="font-display text-sm font-bold text-[var(--status-warning)]">02. Log Mistakes</span>
            <p className="text-xs text-[var(--text-muted)]">
              Paste question screenshots directly with Cmd+V. Record why you failed and one rule to remember.
            </p>
          </div>
          <div className="manga-panel p-5 rounded-2xl bg-[var(--bg-panel)] space-y-2">
            <span className="font-display text-sm font-bold text-[var(--status-success)]">03. Daily Quests</span>
            <p className="text-xs text-[var(--text-muted)]">
              Spaced repetition at 1, 3, 7, 14, 30 days. Mastered questions advance your rank to Legend!
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Daily Objective Banner */}
      <div className="manga-panel p-4 sm:p-5 rounded-2xl bg-[var(--bg-panel)] border-l-4 border-l-[var(--action-primary)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-[var(--action-primary)] text-white shrink-0">
            <Target className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono uppercase font-bold text-[var(--action-primary)]">Daily Objective</span>
              <span className="text-[10px] px-2 py-0.5 rounded-sm bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-muted)] font-mono">
                {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
              </span>
            </div>
            <p className="text-sm font-bold text-[var(--text-primary)] mt-0.5">
              {pendingReviewCount > 0
                ? `Clear ${pendingReviewCount} pending spaced repetition review(s) to protect your retention.`
                : masteryMatrix.weakTopics.length > 0
                ? `Target weakest topic: "${masteryMatrix.weakTopics[0].topic}" (${masteryMatrix.weakTopics[0].unresolvedMistakes} active errors).`
                : 'All reviews clear! Take a sectional test or attempt a PYQ paper.'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {pendingReviewCount > 0 ? (
            <button
              onClick={() => onNavigateToTab('review')}
              className="manga-btn px-4 py-2 rounded-xl bg-[var(--action-primary)] text-white text-xs font-bold flex items-center gap-1.5"
            >
              <Brain className="w-3.5 h-3.5" />
              <span>Start Review ({pendingReviewCount})</span>
            </button>
          ) : (
            <button
              onClick={() => onNavigateToTab('planner')}
              className="manga-btn px-4 py-2 rounded-xl bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-subtle)] text-xs font-bold flex items-center gap-1.5"
            >
              <ListTodo className="w-3.5 h-3.5 text-[var(--action-primary)]" />
              <span>Open Planner</span>
            </button>
          )}
        </div>
      </div>

      {/* Top Header & Attempt Type Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-display text-xl font-bold text-[var(--text-primary)]">
              Performance Command Centre
            </h2>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[var(--bg-surface)] border border-[var(--border-subtle)] font-bold text-[var(--text-muted)]">
              Live Metrics
            </span>
          </div>
          <p className="text-xs text-[var(--text-muted)]">
            Derived 100% from your actual mocks, PYQs, and mistake notebook entries.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1 bg-[var(--bg-panel)] p-1 rounded-xl border border-[var(--border-subtle)] self-start sm:self-auto">
          {(['all', 'mock', 'pyq', 'memory-based'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setAttemptFilter(mode)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                attemptFilter === mode
                  ? 'bg-[var(--action-primary)] text-white shadow-xs'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {mode === 'all' ? 'All Data' : mode === 'mock' ? 'Mocks' : mode === 'pyq' ? 'PYQ' : 'Memory'}
            </button>
          ))}
        </div>
      </div>

      {/* Top 4 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Daily Quest Card */}
        <div
          onClick={() => onNavigateToTab('review')}
          className="manga-panel p-4 rounded-2xl bg-[var(--bg-panel)] cursor-pointer space-y-1.5 hover:border-[var(--action-primary)] transition-colors"
        >
          <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
            <span className="font-bold">Daily Quest (Spaced Revision)</span>
            <Brain className="w-4 h-4 text-[var(--action-primary)]" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-display text-2xl font-bold text-[var(--text-primary)]">
              {pendingReviewCount}
            </span>
            <span className="text-xs text-[var(--text-muted)]">due today</span>
          </div>
          <span className="text-[11px] font-bold text-[var(--action-primary)] flex items-center gap-1">
            <span>Start Review Queue</span>
            <ChevronRight className="w-3 h-3" />
          </span>
        </div>

        {/* Consistency Streak */}
        <div className="manga-panel p-4 rounded-2xl bg-[var(--bg-panel)] space-y-1.5">
          <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
            <span className="font-bold">Study Streak</span>
            <Flame className="w-4 h-4 text-[var(--status-warning)]" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-display text-2xl font-bold text-[var(--text-primary)]">
              {currentStreak}
            </span>
            <span className="text-xs text-[var(--text-muted)]">active days</span>
          </div>
          <span className="text-[11px] font-bold text-[var(--status-success)]">
            {masteredMistakesCount} Mistakes Mastered
          </span>
        </div>

        {/* Latest Mock Score & Best Score */}
        <div
          onClick={() => onNavigateToTab('mocks')}
          className="manga-panel p-4 rounded-2xl bg-[var(--bg-panel)] cursor-pointer space-y-1.5 hover:border-[var(--action-primary)] transition-colors"
        >
          <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
            <span className="font-bold">Latest / Best Score</span>
            <Award className="w-4 h-4 text-[var(--status-success)]" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-display text-2xl font-bold text-[var(--text-primary)]">
              {lastMock ? lastMock.totalNetScore : '--'}
            </span>
            <span className="text-xs text-[var(--text-muted)]">
              (Best: {bestScore} pts)
            </span>
          </div>
          <span className="text-[11px] font-bold text-[var(--text-muted)] line-clamp-1">
            {lastMock ? `${lastMock.name} • ${lastMock.overallAccuracy}% acc` : 'Awaiting first mock'}
          </span>
        </div>

        {/* Gap to Target */}
        <div
          onClick={() => onNavigateToTab('planner')}
          className="manga-panel p-4 rounded-2xl bg-[var(--bg-panel)] cursor-pointer space-y-1.5 hover:border-[var(--action-primary)] transition-colors"
        >
          <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
            <span className="font-bold">Gap to Target</span>
            <Target className="w-4 h-4 text-[var(--action-primary)]" />
          </div>
          <div className="flex items-baseline gap-2">
            <span
              className={`font-display text-2xl font-bold ${
                gapToTarget <= 0 ? 'text-[var(--status-success)]' : 'text-[var(--status-warning)]'
              }`}
            >
              {gapToTarget <= 0 ? 'Surpassed!' : `+${gapToTarget}`}
            </span>
            <span className="text-xs text-[var(--text-muted)]">Target: {settings.targetScore}</span>
          </div>
          <span className="text-[11px] font-bold text-[var(--action-primary)] flex items-center gap-1">
            <span>Calibrate in Planner</span>
            <ChevronRight className="w-3 h-3" />
          </span>
        </div>
      </div>

      {/* Topic Mastery Matrix Summary */}
      <div className="manga-panel p-5 rounded-2xl bg-[var(--bg-panel)] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[var(--border-subtle)] pb-3">
          <div>
            <h3 className="font-display text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
              <CheckSquare className="w-4 h-4 text-[var(--action-primary)]" />
              <span>Evidence-Based Topic Mastery Matrix</span>
            </h3>
            <p className="text-xs text-[var(--text-muted)]">
              Computed directly from mock performance, paper questions, and mistake resolution history.
            </p>
          </div>
          {/* Status Breakdown Pills */}
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-mono">
            <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/20">
              Strong: {masteryMatrix.countsByStatus['Strong']}
            </span>
            <span className="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold border border-blue-500/20">
              Improving: {masteryMatrix.countsByStatus['Improving']}
            </span>
            <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold border border-amber-500/20">
              Learning: {masteryMatrix.countsByStatus['Learning']}
            </span>
            <span className="px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold border border-rose-500/20">
              Weak: {masteryMatrix.countsByStatus['Weak']}
            </span>
            <span className="px-2 py-0.5 rounded-md bg-slate-500/10 text-slate-600 dark:text-slate-400 font-bold border border-slate-500/20">
              Not Studied: {masteryMatrix.countsByStatus['Not studied']}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Weak Topics */}
          <div className="p-3.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[var(--status-error)] flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Weak Topics (Priority)</span>
              </span>
              <span className="text-[10px] font-mono text-[var(--text-muted)]">
                {masteryMatrix.weakTopics.length} topic(s)
              </span>
            </div>
            {masteryMatrix.weakTopics.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)] italic py-2">
                No weak topics detected. Keep logging mistakes to identify gaps.
              </p>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {masteryMatrix.weakTopics.slice(0, 5).map((t) => (
                  <div key={t.topic} className="p-2 rounded-lg bg-[var(--bg-panel)] border border-[var(--border-subtle)] text-xs">
                    <div className="flex items-center justify-between font-bold">
                      <span className="truncate pr-2 text-[var(--text-primary)]">{t.topic}</span>
                      <span className="text-[10px] font-mono text-[var(--status-error)] shrink-0">
                        {t.unresolvedMistakes} mistake(s)
                      </span>
                    </div>
                    <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{t.reason}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Improving Topics */}
          <div className="p-3.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[var(--action-primary)] flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>Improving Topics</span>
              </span>
              <span className="text-[10px] font-mono text-[var(--text-muted)]">
                {masteryMatrix.improvingTopics.length} topic(s)
              </span>
            </div>
            {masteryMatrix.improvingTopics.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)] italic py-2">
                Topics with resolved mistakes will show here as you review.
              </p>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {masteryMatrix.improvingTopics.slice(0, 5).map((t) => (
                  <div key={t.topic} className="p-2 rounded-lg bg-[var(--bg-panel)] border border-[var(--border-subtle)] text-xs">
                    <div className="flex items-center justify-between font-bold">
                      <span className="truncate pr-2 text-[var(--text-primary)]">{t.topic}</span>
                      <span className="text-[10px] font-mono text-[var(--action-primary)] shrink-0">
                        {t.masteredMistakes} mastered
                      </span>
                    </div>
                    <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{t.reason}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Strong Topics */}
          <div className="p-3.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[var(--status-success)] flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Strong Topics</span>
              </span>
              <span className="text-[10px] font-mono text-[var(--text-muted)]">
                {masteryMatrix.strongTopics.length} topic(s)
              </span>
            </div>
            {masteryMatrix.strongTopics.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)] italic py-2">
                Requires 6+ questions with ≥80% accuracy and 0 active errors.
              </p>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {masteryMatrix.strongTopics.slice(0, 5).map((t) => (
                  <div key={t.topic} className="p-2 rounded-lg bg-[var(--bg-panel)] border border-[var(--border-subtle)] text-xs">
                    <div className="flex items-center justify-between font-bold">
                      <span className="truncate pr-2 text-[var(--text-primary)]">{t.topic}</span>
                      <span className="text-[10px] font-mono text-[var(--status-success)] shrink-0">
                        {t.accuracy}% acc
                      </span>
                    </div>
                    <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{t.reason}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Upcoming Study Tasks */}
      {tasks.length > 0 && (
        <div className="manga-panel p-5 rounded-2xl bg-[var(--bg-panel)] space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
              <ListTodo className="w-4 h-4 text-[var(--action-primary)]" />
              <span>Daily Study Tasks</span>
            </h3>
            <button
              onClick={() => onNavigateToTab('planner')}
              className="text-xs text-[var(--action-primary)] font-bold hover:underline flex items-center gap-1"
            >
              <span>Manage all ({tasks.length})</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {tasks.slice(0, 6).map((task) => (
              <div
                key={task.id}
                onClick={() => task.id && onToggleTask && onToggleTask(task.id)}
                className={`p-3 rounded-xl border border-[var(--border-subtle)] cursor-pointer transition-colors ${
                  task.isCompleted
                    ? 'bg-[var(--bg-surface)] opacity-60'
                    : 'bg-[var(--bg-surface)] hover:border-[var(--action-primary)]'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <input
                    type="checkbox"
                    checked={task.isCompleted}
                    onChange={() => {}}
                    className="mt-0.5 rounded-sm border-gray-300 text-[var(--action-primary)] focus:ring-[var(--action-primary)] cursor-pointer"
                  />
                  <div className="min-w-0 flex-1">
                    <p className={`text-xs font-bold truncate ${task.isCompleted ? 'line-through text-[var(--text-muted)]' : 'text-[var(--text-primary)]'}`}>
                      {task.title}
                    </p>
                    <p className="text-[10px] text-[var(--text-muted)] flex items-center gap-2 mt-0.5">
                      <span>{task.subject}</span>
                      <span>•</span>
                      <span>{task.plannedDurationMinutes}m</span>
                      <span>•</span>
                      <span className={`font-bold ${task.priority === 'High' ? 'text-[var(--status-error)]' : 'text-[var(--status-warning)]'}`}>
                        {task.priority}
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Focus Actions & Diagnostic Insights */}
      {filteredMocks.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* This Week's 3 Focus Actions */}
          <div className="manga-panel p-5 rounded-2xl bg-[var(--bg-panel)] space-y-3.5">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-[var(--action-primary)]" />
                <span>High-Impact Focus Actions</span>
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)] font-bold">
                Priority
              </span>
            </div>

            <div className="space-y-2.5">
              {insightsData.focusActions.map((action: FocusAction, idx: number) => (
                <div
                  key={action.id}
                  className="p-3 bg-[var(--bg-surface)] rounded-xl border border-[var(--border-subtle)] space-y-1 text-xs"
                >
                  <div className="flex items-center justify-between font-bold">
                    <span className="text-[var(--text-primary)]">#{idx + 1} {action.section}</span>
                    <span className="text-[10px] font-bold text-[var(--status-success)] font-mono">
                      +{action.expectedMarkGain} pts
                    </span>
                  </div>
                  <p className="text-[var(--text-muted)] leading-snug">{action.actionText}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Diagnostic Insights Grid */}
          <div className="lg:col-span-2 manga-panel p-5 rounded-2xl bg-[var(--bg-panel)] space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-xs font-bold text-[var(--text-primary)] flex items-center gap-2">
                <Target className="w-4 h-4 text-[var(--action-primary)]" />
                <span>Diagnostic Insights Engine</span>
              </h3>
              <span className="text-[11px] text-[var(--text-muted)] font-mono">
                Based on {mistakes.length} mistakes
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {insightsData.keyInsights.slice(0, 4).map((ins: InsightCard) => (
                <div
                  key={ins.id}
                  className="p-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-xs space-y-1"
                >
                  <div className="flex items-center justify-between font-bold">
                    <span className="text-[11px] font-display uppercase tracking-wide text-[var(--text-primary)]">{ins.title}</span>
                    {ins.metric && (
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-[var(--bg-panel)] border border-[var(--border-subtle)] text-[var(--action-primary)] font-bold">
                        {ins.metric}
                      </span>
                    )}
                  </div>
                  <p className="text-[var(--text-muted)] leading-relaxed">{ins.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Chart 1: Score Trajectory */}
      <div className="manga-panel p-5 sm:p-6 rounded-2xl bg-[var(--bg-panel)] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[var(--border-subtle)] pb-3">
          <div>
            <h3 className="font-display text-sm font-bold text-[var(--text-primary)]">
              Score Trajectory Across Attempts
            </h3>
            <p className="text-xs text-[var(--text-muted)]">
              Target: {settings.targetScore} marks • Overall cutoff: {settings.overallCutoff} marks
            </p>
          </div>
          <span className="text-[10px] font-mono text-[var(--text-muted)]">Score Progression</span>
        </div>

        <div className="h-72 w-full">
          {scoreTrendData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-[var(--text-muted)]">
              No score records found for this filter.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={scoreTrendData} margin={{ top: 10, right: 20, bottom: 10, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, Math.max(80, settings.targetScore + 10)]} tick={{ fontSize: 11, fontFamily: 'JetBrains Mono' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--bg-panel)',
                    borderColor: 'var(--border-subtle)',
                    borderRadius: '12px',
                    fontSize: '12px'
                  }}
                />
                <ReferenceLine
                  y={settings.targetScore}
                  stroke="#10B981"
                  strokeDasharray="4 4"
                  label={{ value: `Target: ${settings.targetScore}`, position: 'right', fill: '#10B981', fontSize: 10 }}
                />
                <ReferenceLine
                  y={settings.overallCutoff}
                  stroke="#EF4444"
                  strokeDasharray="4 4"
                  label={{ value: `Cutoff: ${settings.overallCutoff}`, position: 'right', fill: '#EF4444', fontSize: 10 }}
                />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke="var(--action-primary)"
                  strokeWidth={3}
                  dot={{ r: 4, fill: 'var(--action-primary)' }}
                  activeDot={{ r: 6 }}
                  name="Net Score"
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Chart 2: Error Distribution Breakdown */}
      {errorDistributionData.length > 0 && (
        <div className="manga-panel p-5 sm:p-6 rounded-2xl bg-[var(--bg-panel)] space-y-4">
          <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
            <div>
              <h3 className="font-display text-sm font-bold text-[var(--text-primary)]">
                Root Cause Error Distribution
              </h3>
              <p className="text-xs text-[var(--text-muted)]">
                Classification breakdown across {mistakes.length} logged mistakes
              </p>
            </div>
            <span className="text-[10px] font-mono text-[var(--text-muted)]">Error Taxonomy</span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={errorDistributionData}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  innerRadius={45}
                  paddingAngle={3}
                  dataKey="value"
                  label={({ name, percent }: any) => `${name} (${(percent * 100).toFixed(0)}%)`}
                >
                  {errorDistributionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--bg-panel)',
                    borderColor: 'var(--border-subtle)',
                    borderRadius: '12px',
                    fontSize: '12px'
                  }}
                />
                <Legend verticalAlign="bottom" height={36} iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};
