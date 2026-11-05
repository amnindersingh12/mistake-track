import React, { useState, useMemo } from 'react';
import {
  ExamSettings,
  MockTest,
  MistakeEntry,
  PaperAttempt,
  PaperTest,
  StudyTask,
  TaskPriority
} from '../types';
import {
  calculateAttemptsNeeded,
  calculateBreakEvenAccuracy,
  calculateWhatIfProjections,
  calculateTimePlan,
  calculateGapAnalysis,
  generateAccuracyTierCurves
} from '../utils/planner';
import { calculateTimeAnalysis, calculateRepeatedMistakes } from '../utils/insights';
import { calculateTopicMastery, TopicEvidence, TopicMasteryStatus } from '../utils/topicMastery';
import { getTodayDateStr } from '../utils/srs';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ReferenceLine,
  CartesianGrid
} from 'recharts';
import { Mascot } from './Mascot';
import {
  Target,
  Sliders,
  Clock,
  TrendingUp,
  AlertCircle,
  Sparkles,
  CheckCircle,
  XCircle,
  HelpCircle,
  RotateCcw,
  Zap,
  ListTodo,
  Plus,
  Trash2,
  CheckSquare,
  AlertTriangle,
  Info,
  Calendar
} from 'lucide-react';

interface PlannerViewProps {
  settings: ExamSettings;
  mocks: MockTest[];
  mistakes: MistakeEntry[];
  papers?: PaperTest[];
  paperAttempts?: PaperAttempt[];
  tasks?: StudyTask[];
  onAddTask?: (task: Omit<StudyTask, 'id' | 'createdAt'>) => void;
  onToggleTask?: (taskId: number) => void;
  onDeleteTask?: (taskId: number) => void;
}

export const PlannerView: React.FC<PlannerViewProps> = ({
  settings,
  mocks,
  mistakes,
  papers = [],
  paperAttempts = [],
  tasks = [],
  onAddTask,
  onToggleTask,
  onDeleteTask
}) => {
  // 1. Section Selection for Single Section Planner
  const [selectedSectionId, setSelectedSectionId] = useState<string>(
    settings.sections[0]?.id || 'quant'
  );

  const selectedSection =
    settings.sections.find((s) => s.id === selectedSectionId) || settings.sections[0];

  // Calculate rolling accuracy over last 5 mocks for selected section
  const rollingSectionAccuracy = useMemo(() => {
    const recent = mocks.slice(-5);
    let totalAtt = 0;
    let totalCorr = 0;
    for (const m of recent) {
      const sp = m.sections.find((sec) => sec.sectionId === selectedSectionId);
      if (sp) {
        totalAtt += sp.attempted;
        totalCorr += sp.correct;
      }
    }
    if (totalAtt === 0) return 80;
    return Math.round((totalCorr / totalAtt) * 100);
  }, [mocks, selectedSectionId]);

  // Section target score slider state
  const [targetSectionScore, setTargetSectionScore] = useState<number>(() => {
    return selectedSection ? Math.round(selectedSection.sectionalCutoff * 1.5) : 25;
  });

  const [simulatedAccuracy, setSimulatedAccuracy] = useState<number>(() => {
    return rollingSectionAccuracy;
  });

  // Calculate attempts needed for selected section
  const singleSectionPlan = useMemo(() => {
    if (!selectedSection) return null;
    return calculateAttemptsNeeded({
      targetScore: targetSectionScore,
      accuracyPercent: simulatedAccuracy,
      marksPerCorrect: selectedSection.marksPerCorrect,
      negativeMark: selectedSection.negativeMark,
      maxQuestions: selectedSection.totalQuestions
    });
  }, [targetSectionScore, simulatedAccuracy, selectedSection]);

  // Break-even accuracy for selected section
  const breakEvenAcc = useMemo(() => {
    if (!selectedSection) return 20;
    return calculateBreakEvenAccuracy(
      selectedSection.marksPerCorrect,
      selectedSection.negativeMark
    );
  }, [selectedSection]);

  // What-If Simulation State for all sections
  const [whatIfInputs, setWhatIfInputs] = useState<
    Record<string, { attempts: number; accuracy: number }>
  >(() => {
    const initial: Record<string, { attempts: number; accuracy: number }> = {};
    settings.sections.forEach((s) => {
      initial[s.id] = {
        attempts: Math.round(s.totalQuestions * 0.75),
        accuracy: 80
      };
    });
    return initial;
  });

  const handleWhatIfChange = (sectionId: string, field: 'attempts' | 'accuracy', val: number) => {
    setWhatIfInputs((prev) => ({
      ...prev,
      [sectionId]: {
        ...prev[sectionId],
        [field]: val
      }
    }));
  };

  const whatIfProjections = useMemo(() => {
    const sectionInputs = settings.sections.map((s) => ({
      sectionId: s.id,
      sectionName: s.name,
      attempts: whatIfInputs[s.id]?.attempts ?? Math.round(s.totalQuestions * 0.7),
      accuracyPercent: whatIfInputs[s.id]?.accuracy ?? 80,
      totalQuestions: s.totalQuestions,
      marksPerCorrect: s.marksPerCorrect,
      negativeMark: s.negativeMark,
      cutoff: s.sectionalCutoff
    }));

    return calculateWhatIfProjections(
      sectionInputs,
      settings.overallCutoff,
      settings.targetScore
    );
  }, [whatIfInputs, settings]);

  // Suggested Time Allocation Plan
  const timePlan = useMemo(() => {
    const secConfigs = settings.sections.map((s) => ({
      id: s.id,
      name: s.name,
      defaultTimeLimit: s.timeLimitMinutes || 20
    }));

    const historical = mocks.flatMap((m) =>
      m.sections.map((sec) => ({
        sectionId: sec.sectionId,
        netScore: sec.netScore,
        timeMinutes: Math.round((sec.timeSpentSeconds || 1200) / 60)
      }))
    );

    return calculateTimePlan(secConfigs, historical, settings.totalTimeMinutes || 60);
  }, [mocks, settings]);

  // Topic Mastery Matrix (Task 5)
  const masteryMatrix = useMemo(() => {
    return calculateTopicMastery(settings.sections, mocks, mistakes, papers, paperAttempts);
  }, [settings.sections, mocks, mistakes, papers, paperAttempts]);

  // Gap Analysis Roadmap (Careless Mistakes vs Topic Gaps from real data)
  const gapAnalysis = useMemo(() => {
    const recentMocks = mocks.slice(-3);
    const recentAvg =
      recentMocks.length > 0
        ? recentMocks.reduce((sum, m) => sum + m.totalNetScore, 0) / recentMocks.length
        : 0;

    const sillyMistakesCount = mistakes.filter((m) =>
      (m.errorTypes || []).some((e) =>
        e.toLowerCase().includes('silly') ||
        e.toLowerCase().includes('careless') ||
        e.toLowerCase().includes('calculation') ||
        e.toLowerCase().includes('rush')
      )
    ).length;
    const sillyLost = Number((sillyMistakesCount * 1.25).toFixed(2));

    const topWeak = masteryMatrix.weakTopics[0];
    const topWeakTopicLoss = topWeak
      ? { topic: topWeak.topic, marksLost: Number((topWeak.unresolvedMistakes * 1.25).toFixed(2)) }
      : null;

    return calculateGapAnalysis(settings.targetScore, Number(recentAvg.toFixed(2)), sillyLost, topWeakTopicLoss);
  }, [mocks, mistakes, settings, masteryMatrix.weakTopics]);

  // Rolling Accuracy Centered Curves for Selected Section
  const rollingTiers = useMemo<[number, number, number]>(() => {
    const base = Math.max(20, Math.min(90, rollingSectionAccuracy));
    return [
      Math.max(10, base - 10),
      base,
      Math.min(99, base + 10)
    ];
  }, [rollingSectionAccuracy]);

  const accuracyTierCurves = useMemo(() => {
    if (!selectedSection) return [];
    return generateAccuracyTierCurves(
      selectedSection.marksPerCorrect,
      selectedSection.negativeMark,
      selectedSection.totalQuestions,
      rollingTiers
    );
  }, [selectedSection, rollingTiers]);

  // Time Analysis on wrong questions vs ideal time
  const timeAnalysisData = useMemo(() => {
    return calculateTimeAnalysis(mistakes);
  }, [mistakes]);

  // Repeated Mistakes recurring across mocks
  const repeatedMistakesList = useMemo(() => {
    return calculateRepeatedMistakes(mistakes);
  }, [mistakes]);

  const [masteryFilter, setMasteryFilter] = useState<TopicMasteryStatus | 'All'>('All');
  const [inspectedTopic, setInspectedTopic] = useState<TopicEvidence | null>(null);

  const filteredMasteryTopics = useMemo(() => {
    if (masteryFilter === 'All') return masteryMatrix.allTopics;
    return masteryMatrix.allTopics.filter((t) => t.status === masteryFilter);
  }, [masteryMatrix, masteryFilter]);

  // Study Task Creation Form State
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskSubject, setNewTaskSubject] = useState(settings.sections[0]?.name || 'Quantitative Aptitude');
  const [newTaskTopic, setNewTaskTopic] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<TaskPriority>('High');
  const [newTaskDuration, setNewTaskDuration] = useState(45);
  const [newTaskDueDate, setNewTaskDueDate] = useState(() => getTodayDateStr());

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim() || !onAddTask) return;

    onAddTask({
      title: newTaskTitle.trim(),
      subject: newTaskSubject,
      topic: newTaskTopic.trim() || undefined,
      priority: newTaskPriority,
      plannedDurationMinutes: newTaskDuration,
      dueDate: newTaskDueDate,
      isCompleted: false
    });

    setNewTaskTitle('');
    setNewTaskTopic('');
  };

  const handleQuickAddWeakTopicTask = (topicItem: TopicEvidence) => {
    if (!onAddTask) return;
    onAddTask({
      title: `Practice 15 Qs on ${topicItem.topic}`,
      description: `Targeting active errors: ${topicItem.reason}`,
      subject: topicItem.sectionName,
      topic: topicItem.topic,
      priority: 'High',
      plannedDurationMinutes: 45,
      dueDate: getTodayDateStr(),
      isCompleted: false
    });
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      {/* Title */}
      <div>
        <div className="flex items-center gap-2">
          <h2 className="font-display text-2xl font-bold text-[var(--text-primary)]">
            Target Strategy & Daily Planner
          </h2>
          <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--action-primary)] font-bold">
            Strategy & Goals
          </span>
        </div>
        <p className="text-xs text-[var(--text-muted)] mt-1">
          Mathematically solves attempt targets to hit your goal score, organizes daily study tasks, and tracks topic mastery.
        </p>
      </div>

      {/* Empty State Banner if no mocks logged */}
      {mocks.length === 0 && (
        <div className="p-5 rounded-2xl border-2 border-[var(--border-subtle)] bg-[var(--bg-panel)] shadow-manga flex flex-col sm:flex-row items-center gap-4">
          <Mascot mood="thinking" size="md" />
          <div className="space-y-1 text-center sm:text-left">
            <div className="font-display text-sm font-bold text-[var(--text-primary)]">
              Simulation Mode Active
            </div>
            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
              No mocks logged yet. The planner is using standard exam baselines (70% attempts, 80% accuracy). Move the sliders below to explore target strategies, or log a mock to calibrate your personalized historical accuracy automatically.
            </p>
          </div>
        </div>
      )}

      {/* Gap Analysis Roadmap */}
      <div className="manga-panel p-5 bg-[var(--bg-panel)] rounded-2xl border-2 border-[var(--border-subtle)] shadow-manga space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[var(--border-subtle)] pb-3">
          <div>
            <h3 className="font-display text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
              <Target className="w-4 h-4 text-[var(--action-primary)]" />
              <span>Target Gap Analysis & Score Roadmap</span>
            </h3>
            <p className="text-xs text-[var(--text-muted)]">
              Breakdown of lost marks into careless errors vs topic gaps derived from real logs.
            </p>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--action-primary)] font-bold">
            Target: {settings.targetScore} pts
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-1">
            <span className="text-[10px] font-mono text-[var(--text-muted)] uppercase font-bold">Gap to Target</span>
            <div className="text-2xl font-black font-display text-[var(--action-primary)]">
              {gapAnalysis.gap > 0 ? `+${gapAnalysis.gap}` : '0'} pts
            </div>
            <p className="text-[11px] text-[var(--text-muted)]">
              {gapAnalysis.gap > 0 ? 'Shortfall from rolling average' : 'Target reached or beaten!'}
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-1">
            <span className="text-[10px] font-mono text-[var(--text-muted)] uppercase font-bold">From Careless Errors</span>
            <div className="text-2xl font-black font-display text-rose-500">
              +{gapAnalysis.sillyRecoverable} pts
            </div>
            <p className="text-[11px] text-[var(--text-muted)]">
              Recoverable by eliminating calculation / rush errors
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-1">
            <span className="text-[10px] font-mono text-[var(--text-muted)] uppercase font-bold">From Topic Weakness</span>
            <div className="text-2xl font-black font-display text-[var(--mint)]">
              +{gapAnalysis.weakTopicRecoverable} pts
            </div>
            <p className="text-[11px] text-[var(--text-muted)]">
              Recoverable by mastering top weak topic
            </p>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-[var(--peach)]/20 border border-[var(--ink-border)]/40 text-xs text-[var(--ink)] dark:text-[var(--text-main)] font-medium leading-relaxed">
          💡 <span className="font-bold">{gapAnalysis.summarySentence}</span>
        </div>
      </div>

      {/* SECTION 1: Daily Study Tasks Manager */}
      <div className="p-6 bg-[var(--bg-panel)] rounded-2xl border-2 border-[var(--border-subtle)] shadow-manga space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--border-subtle)] pb-4">
          <div>
            <h3 className="font-display text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
              <ListTodo className="w-5 h-5 text-[var(--action-primary)]" />
              <span>Daily Study Task Checklist</span>
            </h3>
            <p className="text-xs text-[var(--text-muted)]">
              Scheduled tasks for focused practice, concept revisions, and weak-topic drills.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono text-[var(--text-muted)]">
            <span>Completed: {tasks.filter((t) => t.isCompleted).length} / {tasks.length}</span>
          </div>
        </div>

        {/* Task Creation Form */}
        {onAddTask && (
          <form onSubmit={handleCreateTask} className="p-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
            <div className="lg:col-span-2">
              <label className="text-[10px] font-mono text-[var(--text-muted)] block mb-1">Task Title *</label>
              <input
                type="text"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                placeholder="e.g. Solve 20 Simplification Qs"
                required
                className="w-full text-xs px-3 py-2 rounded-lg bg-[var(--bg-panel)] border border-[var(--border-subtle)] text-[var(--text-primary)] outline-hidden focus:border-[var(--action-primary)]"
              />
            </div>
            <div>
              <label className="text-[10px] font-mono text-[var(--text-muted)] block mb-1">Subject</label>
              <select
                value={newTaskSubject}
                onChange={(e) => setNewTaskSubject(e.target.value)}
                className="w-full text-xs px-2.5 py-2 rounded-lg bg-[var(--bg-panel)] border border-[var(--border-subtle)] text-[var(--text-primary)] outline-hidden"
              >
                {settings.sections.map((s) => (
                  <option key={s.id} value={s.name}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-mono text-[var(--text-muted)] block mb-1">Priority</label>
              <select
                value={newTaskPriority}
                onChange={(e) => setNewTaskPriority(e.target.value as TaskPriority)}
                className="w-full text-xs px-2.5 py-2 rounded-lg bg-[var(--bg-panel)] border border-[var(--border-subtle)] text-[var(--text-primary)] outline-hidden"
              >
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-mono text-[var(--text-muted)] block mb-1">Planned (min)</label>
              <input
                type="number"
                min="10"
                max="240"
                step="5"
                value={newTaskDuration}
                onChange={(e) => setNewTaskDuration(Number(e.target.value))}
                className="w-full text-xs px-3 py-2 rounded-lg bg-[var(--bg-panel)] border border-[var(--border-subtle)] text-[var(--text-primary)] outline-hidden"
              />
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                className="w-full manga-btn py-2 px-3 rounded-lg bg-[var(--action-primary)] text-white text-xs font-bold flex items-center justify-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Task</span>
              </button>
            </div>
          </form>
        )}

        {/* Tasks List */}
        {tasks.length === 0 ? (
          <div className="p-6 text-center text-xs text-[var(--text-muted)] border border-dashed border-[var(--border-subtle)] rounded-xl">
            No study tasks created yet. Add one above or click "Add to Study Tasks" on any weak topic below!
          </div>
        ) : (
          <div className="space-y-2">
            {tasks.map((task) => (
              <div
                key={task.id}
                className={`p-3 rounded-xl border border-[var(--border-subtle)] flex items-center justify-between gap-3 transition-colors ${
                  task.isCompleted ? 'bg-[var(--bg-surface)] opacity-60' : 'bg-[var(--bg-surface)]'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <input
                    type="checkbox"
                    checked={task.isCompleted}
                    onChange={() => task.id && onToggleTask && onToggleTask(task.id)}
                    className="w-4 h-4 rounded-sm border-gray-300 text-[var(--action-primary)] focus:ring-[var(--action-primary)] cursor-pointer"
                  />
                  <div className="min-w-0">
                    <p className={`text-xs font-bold truncate ${task.isCompleted ? 'line-through text-[var(--text-muted)]' : 'text-[var(--text-primary)]'}`}>
                      {task.title}
                    </p>
                    <p className="text-[10px] text-[var(--text-muted)] flex items-center gap-2 mt-0.5">
                      <span>{task.subject}</span>
                      {task.topic && <span>• {task.topic}</span>}
                      <span>• {task.plannedDurationMinutes}m</span>
                      <span>• Due {task.dueDate}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded-sm font-bold ${
                      task.priority === 'High'
                        ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                        : task.priority === 'Medium'
                        ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                        : 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20'
                    }`}
                  >
                    {task.priority}
                  </span>
                  {task.id && onDeleteTask && (
                    <button
                      onClick={() => onDeleteTask(task.id!)}
                      className="p-1 rounded-md text-[var(--text-muted)] hover:text-rose-600 transition-colors"
                      title="Delete task"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SECTION 2: Evidence-Based Topic Mastery Matrix (Task 5) */}
      <div className="p-6 bg-[var(--bg-panel)] rounded-2xl border-2 border-[var(--border-subtle)] shadow-manga space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--border-subtle)] pb-4">
          <div>
            <h3 className="font-display text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
              <CheckSquare className="w-5 h-5 text-[var(--status-success)]" />
              <span>Evidence-Based Topic Mastery Matrix</span>
            </h3>
            <p className="text-xs text-[var(--text-muted)]">
              Calculated dynamically from real mock results, paper questions, and mistake resolutions.
            </p>
          </div>

          {/* Filter Tabs */}
          <div className="flex flex-wrap items-center gap-1">
            {(['All', 'Weak', 'Improving', 'Learning', 'Strong', 'Not studied'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setMasteryFilter(status)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                  masteryFilter === status
                    ? 'bg-[var(--action-primary)] text-white'
                    : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)]'
                }`}
              >
                {status} ({status === 'All' ? masteryMatrix.allTopics.length : masteryMatrix.countsByStatus[status]})
              </button>
            ))}
          </div>
        </div>

        {/* Topics Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] text-[var(--text-muted)] font-mono">
                <th className="py-2 px-3">Topic</th>
                <th className="py-2 px-3">Section</th>
                <th className="py-2 px-3">Status</th>
                <th className="py-2 px-3">Accuracy</th>
                <th className="py-2 px-3">Active Errors</th>
                <th className="py-2 px-3">Reason & Evidence</th>
                <th className="py-2 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {filteredMasteryTopics.slice(0, 15).map((item) => (
                <tr key={`${item.sectionId}-${item.topic}`} className="hover:bg-[var(--bg-surface)] transition-colors">
                  <td className="py-3 px-3 font-bold text-[var(--text-primary)]">{item.topic}</td>
                  <td className="py-3 px-3 text-[var(--text-muted)]">{item.sectionName}</td>
                  <td className="py-3 px-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-sm font-bold font-mono text-[10px] ${
                        item.status === 'Strong'
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                          : item.status === 'Improving'
                          ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                          : item.status === 'Learning'
                          ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                          : item.status === 'Weak'
                          ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                          : 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20'
                      }`}
                    >
                      {item.status}
                    </span>
                  </td>
                  <td className="py-3 px-3 font-mono font-bold">
                    {item.totalAttempted > 0 ? `${item.accuracy}%` : '--'}
                  </td>
                  <td className="py-3 px-3 font-mono">
                    {item.unresolvedMistakes > 0 ? (
                      <span className="text-[var(--status-error)] font-bold">{item.unresolvedMistakes} active</span>
                    ) : (
                      <span className="text-[var(--status-success)]">0</span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-[var(--text-muted)] max-w-xs truncate" title={item.reason}>
                    {item.reason}
                  </td>
                  <td className="py-3 px-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => setInspectedTopic(item)}
                        className="p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--action-primary)] transition-colors"
                        title="Inspect Why"
                      >
                        <Info className="w-4 h-4" />
                      </button>
                      {item.status === 'Weak' && onAddTask && (
                        <button
                          onClick={() => handleQuickAddWeakTopicTask(item)}
                          className="px-2 py-0.5 rounded-md bg-[var(--action-primary)] text-white text-[10px] font-bold"
                          title="Schedule Study Task"
                        >
                          + Task
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredMasteryTopics.length > 15 && (
            <p className="text-xs text-center text-[var(--text-muted)] pt-3 font-mono">
              Showing 15 of {filteredMasteryTopics.length} topics in this view.
            </p>
          )}
        </div>
      </div>

      {/* Inspect Why Modal */}
      {inspectedTopic && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
          onClick={() => setInspectedTopic(null)}
        >
          <div
            className="w-full max-w-lg bg-[var(--bg-panel)] border-2 border-[var(--border-primary)] rounded-2xl p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
              <div>
                <h4 className="font-display text-base font-bold text-[var(--text-primary)]">
                  Topic Evidence: {inspectedTopic.topic}
                </h4>
                <p className="text-xs text-[var(--text-muted)]">{inspectedTopic.sectionName}</p>
              </div>
              <button
                onClick={() => setInspectedTopic(null)}
                className="p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-1">
                <span className="font-mono text-[10px] text-[var(--text-muted)] uppercase font-bold">Assigned Status</span>
                <p className="font-bold text-sm text-[var(--text-primary)]">{inspectedTopic.status}</p>
                <p className="text-[var(--text-muted)] mt-1">{inspectedTopic.reason}</p>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
                  <span className="text-[10px] text-[var(--text-muted)] block">Attempted</span>
                  <span className="font-mono font-bold text-sm text-[var(--text-primary)]">{inspectedTopic.totalAttempted}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
                  <span className="text-[10px] text-[var(--text-muted)] block">Accuracy</span>
                  <span className="font-mono font-bold text-sm text-[var(--text-primary)]">{inspectedTopic.accuracy}%</span>
                </div>
                <div className="p-2.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
                  <span className="text-[10px] text-[var(--text-muted)] block">Mistakes</span>
                  <span className="font-mono font-bold text-sm text-[var(--status-error)]">{inspectedTopic.unresolvedMistakes} active</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
                <span className="font-mono text-[10px] text-[var(--text-muted)] uppercase font-bold block mb-1">Recommended Action</span>
                <p className="text-[var(--text-primary)] font-medium">{inspectedTopic.recommendedAction}</p>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setInspectedTopic(null)}
                className="px-4 py-2 rounded-xl bg-[var(--action-primary)] text-white text-xs font-bold"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 3: Single Section Attempt Solver */}
      <div className="p-6 bg-[var(--bg-panel)] rounded-2xl border-2 border-[var(--border-subtle)] shadow-manga space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--border-subtle)] pb-4">
          <div>
            <h3 className="font-display text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
              <Zap className="w-5 h-5 text-[var(--action-primary)]" />
              <span>Sectional Attempt Solver</span>
            </h3>
            <p className="text-xs text-[var(--text-muted)]">
              Calculate exact attempts required for any chosen section target score.
            </p>
          </div>

          <div className="flex items-center gap-1.5 bg-[var(--bg-surface)] p-1 rounded-xl border border-[var(--border-subtle)]">
            {settings.sections.map((s) => (
              <button
                key={s.id}
                onClick={() => {
                  setSelectedSectionId(s.id);
                  setTargetSectionScore(Math.round(s.sectionalCutoff * 1.5));
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  selectedSectionId === s.id
                    ? 'bg-[var(--action-primary)] text-white shadow-xs'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {s.name.split(' ')[0]}
              </button>
            ))}
          </div>
        </div>

        {/* Sliders & Results */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-bold text-[var(--text-primary)]">
                <span>Target Score</span>
                <span className="font-mono text-sm">{targetSectionScore} marks</span>
              </div>
              <input
                type="range"
                min="5"
                max={selectedSection ? selectedSection.totalQuestions * selectedSection.marksPerCorrect : 35}
                value={targetSectionScore}
                onChange={(e) => setTargetSectionScore(Number(e.target.value))}
                className="w-full h-2 bg-[var(--bg-surface)] rounded-lg appearance-none cursor-pointer accent-[var(--action-primary)]"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-bold text-[var(--text-primary)]">
                <span>Expected Accuracy</span>
                <span className="font-mono text-sm">{simulatedAccuracy}%</span>
              </div>
              <input
                type="range"
                min="40"
                max="100"
                value={simulatedAccuracy}
                onChange={(e) => setSimulatedAccuracy(Number(e.target.value))}
                className="w-full h-2 bg-[var(--bg-surface)] rounded-lg appearance-none cursor-pointer accent-[var(--action-primary)]"
              />
            </div>
          </div>

          {/* Result Card */}
          <div className="lg:col-span-2 p-5 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-[var(--text-muted)] uppercase">Required Attempts</span>
              <span className="text-xs font-mono text-[var(--text-muted)]">Max Questions: {selectedSection?.totalQuestions}</span>
            </div>
            <div className="my-2">
              <span className="font-display text-4xl font-extrabold text-[var(--action-primary)]">
                {singleSectionPlan?.attemptsNeeded}
              </span>
              <span className="text-xs text-[var(--text-muted)] ml-2">questions needed</span>
            </div>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              {singleSectionPlan?.explanation}
            </p>
          </div>
        </div>

        {/* Expected Score Line Chart centered on rolling accuracy */}
        <div className="pt-4 border-t border-[var(--border-subtle)] space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h4 className="font-display text-xs font-bold text-[var(--text-primary)]">
                Expected Score vs Attempts Curve ({selectedSection?.name})
              </h4>
              <p className="text-[11px] text-[var(--text-muted)]">
                Curves centered on rolling accuracy: {rollingTiers[0]}% (-10), {rollingTiers[1]}% (current), and {rollingTiers[2]}% (+10).
              </p>
            </div>
            <span className="text-[10px] font-mono text-[var(--text-muted)]">
              Break-Even: {breakEvenAcc}%
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={accuracyTierCurves} margin={{ top: 10, right: 20, bottom: 10, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="attempts" label={{ value: 'Attempts', position: 'insideBottomRight', offset: -5, fontSize: 10 }} tick={{ fontSize: 11 }} />
                <YAxis label={{ value: 'Expected Score', angle: -90, position: 'insideLeft', fontSize: 10 }} tick={{ fontSize: 11, fontFamily: 'JetBrains Mono' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--bg-panel)',
                    borderColor: 'var(--border-subtle)',
                    borderRadius: '0.75rem',
                    fontSize: '11px',
                    fontFamily: 'JetBrains Mono'
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                <ReferenceLine y={targetSectionScore} stroke="var(--action-primary)" strokeDasharray="4 4" label={{ value: `Target (${targetSectionScore})`, fill: 'var(--action-primary)', fontSize: 10 }} />
                <Line
                  type="monotone"
                  dataKey="scoreTier1"
                  name={`${rollingTiers[0]}% Accuracy (-10)`}
                  stroke="var(--status-error)"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="scoreTier2"
                  name={`${rollingTiers[1]}% Accuracy (Rolling)`}
                  stroke="var(--action-primary)"
                  strokeWidth={2.5}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="scoreTier3"
                  name={`${rollingTiers[2]}% Accuracy (+10)`}
                  stroke="var(--status-success)"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* SECTION 4: What-If Exam Score Simulator */}
      <div className="p-6 bg-[var(--bg-panel)] rounded-2xl border-2 border-[var(--border-subtle)] shadow-manga space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--border-subtle)] pb-4">
          <div>
            <h3 className="font-display text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
              <Sliders className="w-5 h-5 text-[var(--action-primary)]" />
              <span>Full Exam What-If Simulator</span>
            </h3>
            <p className="text-xs text-[var(--text-muted)]">
              Adjust attempts and accuracy per section to verify if total score meets cutoff and target thresholds.
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <span className="text-[10px] font-mono text-[var(--text-muted)] block">Projected Total</span>
              <span className="font-display text-2xl font-black text-[var(--action-primary)]">
                {whatIfProjections.totalScore}
              </span>
            </div>
            <div className={`px-3 py-1.5 rounded-xl border text-xs font-bold ${
              whatIfProjections.hitTargetScore
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
            }`}>
              {whatIfProjections.hitTargetScore ? 'Hits Target!' : 'Below Target'}
            </div>
          </div>
        </div>

        {/* Section Sliders Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {settings.sections.map((sec) => {
            const state = whatIfInputs[sec.id] || { attempts: 25, accuracy: 80 };
            const proj = whatIfProjections.sections.find((p: any) => p.sectionId === sec.id);

            return (
              <div key={sec.id} className="p-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-3">
                <div className="flex items-center justify-between font-bold text-xs text-[var(--text-primary)]">
                  <span>{sec.name}</span>
                  <span className="font-mono text-[var(--action-primary)]">{proj?.projectedNetScore} pts</span>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] text-[var(--text-muted)]">
                    <span>Attempts</span>
                    <span className="font-mono">{state.attempts} / {sec.totalQuestions}</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max={sec.totalQuestions}
                    value={state.attempts}
                    onChange={(e) => handleWhatIfChange(sec.id, 'attempts', Number(e.target.value))}
                    className="w-full h-1.5 bg-[var(--bg-panel)] rounded-lg appearance-none cursor-pointer accent-[var(--action-primary)]"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] text-[var(--text-muted)]">
                    <span>Accuracy</span>
                    <span className="font-mono">{state.accuracy}%</span>
                  </div>
                  <input
                    type="range"
                    min="30"
                    max="100"
                    value={state.accuracy}
                    onChange={(e) => handleWhatIfChange(sec.id, 'accuracy', Number(e.target.value))}
                    className="w-full h-1.5 bg-[var(--bg-panel)] rounded-lg appearance-none cursor-pointer accent-[var(--action-primary)]"
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SECTION 5: Attempt Sequence & Time Plan */}
      <div className="p-6 bg-[var(--bg-panel)] rounded-2xl border-2 border-[var(--border-subtle)] shadow-manga space-y-4">
        <div>
          <h3 className="font-display text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
            <Clock className="w-5 h-5 text-[var(--action-primary)]" />
            <span>Optimal Attempt Sequence & Time Plan</span>
          </h3>
          <p className="text-xs text-[var(--text-muted)]">
            Suggested time allotment based on historical scoring efficiency.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {timePlan.map((tp) => (
            <div
              key={tp.sectionId}
              className="p-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-2 text-xs"
            >
              <div className="flex items-center justify-between">
                <span className="px-2 py-0.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-panel)] text-[var(--action-primary)] font-bold text-[11px]">
                  Priority #{tp.attemptPriority}
                </span>
                <span className="font-mono font-bold text-[var(--text-primary)]">
                  {tp.marksPerMinute} m/min
                </span>
              </div>

              <div className="font-display font-bold text-sm text-[var(--text-primary)]">
                {tp.sectionName}
              </div>

              <div className="flex items-baseline gap-1 text-[var(--text-primary)] font-bold">
                <span>Suggested Time: </span>
                <strong className="text-[var(--action-primary)] font-black">
                  {tp.suggestedMinutes} min
                </strong>
              </div>

              <p className="text-[11px] text-[var(--text-muted)] leading-snug pt-1 border-t border-[var(--border-subtle)]">
                {tp.reason}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* SECTION 6: Time Analysis & Time Sinks */}
      <div className="p-6 bg-[var(--bg-panel)] rounded-2xl border-2 border-[var(--border-subtle)] shadow-manga space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[var(--border-subtle)] pb-3">
          <div>
            <h3 className="font-display text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
              <Clock className="w-5 h-5 text-[var(--action-primary)]" />
              <span>Time Analysis & Question Time Sinks</span>
            </h3>
            <p className="text-xs text-[var(--text-muted)]">
              Identifies questions and topics where slow solving on wrong questions wastes precious exam minutes.
            </p>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)] font-bold">
            Wastage Ratio: {timeAnalysisData.timeWastageRatio}x
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
            <span className="text-[10px] font-mono text-[var(--text-muted)] block">Avg Time on Wrong Answers</span>
            <span className="font-mono text-xl font-bold text-rose-500">{timeAnalysisData.avgTimeWrongSeconds}s</span>
          </div>
          <div className="p-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
            <span className="text-[10px] font-mono text-[var(--text-muted)] block">Ideal Solving Target</span>
            <span className="font-mono text-xl font-bold text-[var(--mint)]">{timeAnalysisData.avgTimeIdealSeconds}s</span>
          </div>
          <div className="p-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
            <span className="text-[10px] font-mono text-[var(--text-muted)] block">Time Waste Factor</span>
            <span className="font-mono text-xl font-bold text-[var(--action-primary)]">{timeAnalysisData.timeWastageRatio}x slower</span>
          </div>
        </div>

        {timeAnalysisData.topicsWastingTime.length > 0 ? (
          <div className="overflow-x-auto rounded-xl border border-[var(--border-subtle)]">
            <table className="w-full text-left text-xs">
              <thead className="bg-[var(--bg-surface)] border-b border-[var(--border-subtle)] font-bold">
                <tr>
                  <th className="p-2.5">Topic</th>
                  <th className="p-2.5">Section</th>
                  <th className="p-2.5">Wrong Qs</th>
                  <th className="p-2.5">Avg Spent</th>
                  <th className="p-2.5">Ideal</th>
                  <th className="p-2.5">Wastage Ratio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]/40 bg-[var(--bg-panel)]">
                {timeAnalysisData.topicsWastingTime.map((t) => (
                  <tr key={t.topic}>
                    <td className="p-2.5 font-bold text-[var(--text-primary)]">{t.topic}</td>
                    <td className="p-2.5 text-[var(--text-muted)]">{t.sectionName}</td>
                    <td className="p-2.5 font-mono">{t.wrongCount}</td>
                    <td className="p-2.5 font-mono text-rose-500 font-bold">{t.avgTimeSpent}s</td>
                    <td className="p-2.5 font-mono text-[var(--text-muted)]">{t.idealTime}s</td>
                    <td className="p-2.5 font-mono font-bold text-rose-500">{t.ratio}x</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-[var(--text-muted)] italic py-2">
            No severe time sinks detected (all wrong question average times are within 1.25x of ideal target).
          </p>
        )}
      </div>

      {/* SECTION 7: Repeated Mistakes View */}
      <div className="p-6 bg-[var(--bg-panel)] rounded-2xl border-2 border-[var(--border-subtle)] shadow-manga space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[var(--border-subtle)] pb-3">
          <div>
            <h3 className="font-display text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-[var(--action-primary)]" />
              <span>Repeated Mistakes Across Mocks</span>
            </h3>
            <p className="text-xs text-[var(--text-muted)]">
              Pinpoints topics and patterns where you made mistakes across multiple separate mocks.
            </p>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--action-primary)] font-bold">
            {repeatedMistakesList.length} recurring pattern(s)
          </span>
        </div>

        {repeatedMistakesList.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {repeatedMistakesList.map((item, idx) => (
              <div key={idx} className="p-3.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-2 text-xs">
                <div className="flex items-center justify-between font-bold">
                  <span className="text-[var(--text-primary)] font-display">{item.name}</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-500/10 text-rose-600 font-bold border border-rose-500/20">
                    {item.mockCount} mock(s) • {item.count} total
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-[var(--text-muted)]">
                  <span className="capitalize px-1.5 py-0.5 rounded bg-[var(--bg-panel)] border border-[var(--border-subtle)] text-[10px] font-mono">
                    {item.type === 'errorType' ? 'Error Type' : 'Topic'}
                  </span>
                  <span>Section: {item.section}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-[var(--text-muted)] italic py-2">
            No repeated mistakes found across multiple mocks. Great job maintaining distinct learning feedback!
          </p>
        )}
      </div>
    </div>
  );
};
