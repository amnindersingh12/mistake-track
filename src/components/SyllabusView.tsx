import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, DEFAULT_CANONICAL_TOPICS } from '../db/db';
import { CanonicalTopic, TopicCategory, SyllabusProgress, SyllabusStatus } from '../types';
import { SUPPORTED_EXAMS, getTopicsForExam } from '../utils/topicGraph';
import {
  BookOpen,
  CheckCircle2,
  Clock,
  Circle,
  Search,
  Filter,
  FileText,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  FileEdit,
  Sparkles,
  TrendingUp,
  X
} from 'lucide-react';

export interface SyllabusViewProps {
  initialExamId?: string;
  initialStage?: string;
  onNavigate?: (tab: string, filter?: { topic?: string; topicId?: string; examId?: string }) => void;
  className?: string;
}

interface ExamStageOption {
  id: string;
  name: string;
}

const EXAM_STAGES: Record<string, ExamStageOption[]> = {
  'gate-cs': [
    { id: 'cbt', name: 'Computer Based Test (All Sections)' }
  ],
  'sebi-it': [
    { id: 'phase-1', name: 'Phase 1 (Paper 1 Non-Tech + Paper 2 IT)' },
    { id: 'phase-2', name: 'Phase 2 (Paper 2 Specialized IT)' }
  ],
  'ibps-so-it': [
    { id: 'prelims', name: 'Prelims (Quant, Reasoning, English)' },
    { id: 'mains', name: 'Mains (Professional Knowledge)' }
  ]
};

/**
 * Circular SVG Progress Ring component.
 */
const ProgressRing: React.FC<{
  percentage: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  trackColor?: string;
  label?: string;
  subLabel?: string;
}> = ({
  percentage,
  size = 110,
  strokeWidth = 9,
  color = '#6366f1',
  trackColor = '#262626',
  label,
  subLabel
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (Math.max(0, Math.min(100, percentage)) / 100) * circumference;

  return (
    <div className="flex flex-col items-center justify-center relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-all duration-500 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-lg font-bold text-white font-mono">{Math.round(percentage)}%</span>
        {label && <span className="text-[10px] text-neutral-400 font-medium leading-none mt-0.5">{label}</span>}
      </div>
    </div>
  );
};

export const SyllabusView: React.FC<SyllabusViewProps> = ({
  initialExamId = 'gate-cs',
  initialStage,
  onNavigate,
  className = ''
}) => {
  const [selectedExamId, setSelectedExamId] = useState<string>(initialExamId);
  const [selectedStage, setSelectedStage] = useState<string>(
    initialStage || (EXAM_STAGES[initialExamId]?.[0]?.id ?? 'cbt')
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | SyllabusStatus>('all');
  const [expandedTopicIds, setExpandedTopicIds] = useState<Set<string>>(new Set());

  // Dexie live queries
  const liveTopics = useLiveQuery(() => db.topics.toArray(), []);
  const liveProgress = useLiveQuery(() => db.syllabusProgress.toArray(), []);
  const liveMistakes = useLiveQuery(() => db.mistakes.toArray(), []);
  const livePyqs = useLiveQuery(() => db.pyqs.toArray(), []);
  const liveNotes = useLiveQuery(() => db.notes.toArray(), []);

  const allTopics = useMemo(() => {
    return liveTopics && liveTopics.length > 0 ? liveTopics : DEFAULT_CANONICAL_TOPICS;
  }, [liveTopics]);

  // Topics applicable to the currently selected exam
  const examTopics = useMemo(() => {
    return getTopicsForExam(selectedExamId, allTopics);
  }, [selectedExamId, allTopics]);

  // Handle exam switch
  const handleExamChange = (examId: string) => {
    setSelectedExamId(examId);
    const stages = EXAM_STAGES[examId] || [];
    setSelectedStage(stages[0]?.id || 'cbt');
  };

  // Progress Map: topicId -> SyllabusProgress
  const progressMap = useMemo(() => {
    const map = new Map<string, SyllabusProgress>();
    if (!liveProgress) return map;

    for (const p of liveProgress) {
      if (p.examId === selectedExamId && p.stage === selectedStage) {
        map.set(p.topicId, p);
      }
    }
    return map;
  }, [liveProgress, selectedExamId, selectedStage]);

  // Mistakes Map: topicLower -> count
  const mistakeCounts = useMemo(() => {
    const map = new Map<string, { total: number; active: number }>();
    if (!liveMistakes) return map;

    for (const m of liveMistakes) {
      const topicKey = (m.topic || '').trim().toLowerCase();
      if (!topicKey) continue;
      const cur = map.get(topicKey) || { total: 0, active: 0 };
      cur.total++;
      if (m.status !== 'Mastered') {
        cur.active++;
      }
      map.set(topicKey, cur);
    }
    return map;
  }, [liveMistakes]);

  // PYQs Map: topicId -> count
  const pyqCounts = useMemo(() => {
    const map = new Map<string, { total: number; attempted: number }>();
    if (!livePyqs) return map;

    for (const q of livePyqs) {
      const cur = map.get(q.topicId) || { total: 0, attempted: 0 };
      cur.total++;
      if ((q.attemptedCount || 0) > 0) {
        cur.attempted++;
      }
      map.set(q.topicId, cur);
    }
    return map;
  }, [livePyqs]);

  // Notes Map: topicId -> count
  const noteCounts = useMemo(() => {
    const map = new Map<string, number>();
    if (!liveNotes) return map;

    for (const n of liveNotes) {
      if (n.topicId) {
        map.set(n.topicId, (map.get(n.topicId) || 0) + 1);
      }
    }
    return map;
  }, [liveNotes]);

  // One-click status change / persistence in db.syllabusProgress
  const handleStatusChange = async (topicId: string, nextStatus: SyllabusStatus) => {
    const existing = progressMap.get(topicId);
    const confidence =
      nextStatus === 'mastered' ? 95 : nextStatus === 'in_progress' ? 50 : 0;

    const record: SyllabusProgress = {
      ...(existing || {}),
      examId: selectedExamId,
      stage: selectedStage,
      topicId,
      status: nextStatus,
      confidence,
      pyqsSolved: existing?.pyqsSolved || 0,
      totalPyqs: existing?.totalPyqs || 0,
      updatedAt: new Date().toISOString()
    };

    if (existing?.id) {
      record.id = existing.id;
    }

    await db.syllabusProgress.put(record);
  };

  // Toggle subtopics view
  const toggleTopicExpand = (topicId: string) => {
    setExpandedTopicIds(prev => {
      const next = new Set(prev);
      if (next.has(topicId)) {
        next.delete(topicId);
      } else {
        next.add(topicId);
      }
      return next;
    });
  };

  // Completion stats for overall and per category
  const stats = useMemo(() => {
    const total = examTopics.length;
    let mastered = 0;
    let inProgress = 0;
    let notStarted = 0;

    const byCat: Record<TopicCategory, { total: number; mastered: number; inProgress: number }> = {
      'Core CS': { total: 0, mastered: 0, inProgress: 0 },
      'IT-officer': { total: 0, mastered: 0, inProgress: 0 },
      'Common': { total: 0, mastered: 0, inProgress: 0 }
    };

    for (const t of examTopics) {
      const p = progressMap.get(t.id);
      const status = p?.status || 'not_started';

      if (byCat[t.category]) {
        byCat[t.category].total++;
      }

      if (status === 'mastered') {
        mastered++;
        if (byCat[t.category]) byCat[t.category].mastered++;
      } else if (status === 'in_progress') {
        inProgress++;
        if (byCat[t.category]) byCat[t.category].inProgress++;
      } else {
        notStarted++;
      }
    }

    const overallPct = total > 0 ? Math.round(((mastered * 1.0 + inProgress * 0.4) / total) * 100) : 0;
    const masteredPct = total > 0 ? Math.round((mastered / total) * 100) : 0;

    return {
      total,
      mastered,
      inProgress,
      notStarted,
      overallPct,
      masteredPct,
      byCat
    };
  }, [examTopics, progressMap]);

  // Filtered topics list
  const filteredTopics = useMemo(() => {
    return examTopics.filter(t => {
      const p = progressMap.get(t.id);
      const status = p?.status || 'not_started';

      if (statusFilter !== 'all' && status !== statusFilter) {
        return false;
      }

      if (searchQuery.trim().length > 0) {
        const q = searchQuery.toLowerCase();
        const matchName = t.name.toLowerCase().includes(q);
        const matchSub = t.subtopics.some(s => s.toLowerCase().includes(q));
        if (!matchName && !matchSub) return false;
      }

      return true;
    });
  }, [examTopics, progressMap, statusFilter, searchQuery]);

  // Group by category
  const groupedTopics = useMemo(() => {
    const groups: Record<TopicCategory, CanonicalTopic[]> = {
      'Core CS': [],
      'IT-officer': [],
      'Common': []
    };
    for (const t of filteredTopics) {
      if (groups[t.category]) {
        groups[t.category].push(t);
      }
    }
    return groups;
  }, [filteredTopics]);

  const stagesForCurrentExam = EXAM_STAGES[selectedExamId] || [];

  return (
    <div className={`syllabus-view flex flex-col gap-6 text-neutral-100 ${className}`}>
      {/* Header & Exam/Stage Selector */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-neutral-800 pb-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400">
                <BookOpen className="w-5 h-5" />
              </span>
              <h1 className="text-xl font-bold tracking-tight text-white">Syllabus Tracker</h1>
            </div>
            <p className="text-xs text-neutral-400">
              Per-exam, per-stage tracker with 3-state mastery persistence and direct links to mistakes and PYQs.
            </p>
          </div>

          {/* Exam Switcher Tabs */}
          <div className="flex items-center bg-neutral-950 p-1 rounded-xl border border-neutral-800">
            {Object.entries(SUPPORTED_EXAMS).map(([examId, meta]) => (
              <button
                key={examId}
                onClick={() => handleExamChange(examId)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  selectedExamId === examId
                    ? `${meta.badgeBg} ${meta.badgeText} border ${meta.border} shadow-sm`
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                {meta.shortName}
              </button>
            ))}
          </div>
        </div>

        {/* Stage Selector Subtabs */}
        {stagesForCurrentExam.length > 1 && (
          <div className="flex items-center gap-2 mt-4 pt-1">
            <span className="text-xs font-medium text-neutral-400">Stage / Tier:</span>
            <div className="flex items-center gap-1 bg-neutral-950 p-1 rounded-lg border border-neutral-800">
              {stagesForCurrentExam.map(stage => (
                <button
                  key={stage.id}
                  onClick={() => setSelectedStage(stage.id)}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                    selectedStage === stage.id
                      ? 'bg-neutral-800 text-white shadow-sm'
                      : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  {stage.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Progress Rings Overview Section */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-5 pt-4 border-t border-neutral-800/80">
          {/* Main Overall Ring */}
          <div className="flex items-center gap-4 bg-neutral-950/60 border border-neutral-800/80 rounded-xl p-4">
            <ProgressRing
              percentage={stats.overallPct}
              size={90}
              strokeWidth={8}
              color="#6366f1"
              label="Completed"
            />
            <div>
              <div className="text-xs font-bold text-neutral-200">Overall Syllabus</div>
              <div className="text-xs text-neutral-400 mt-1">
                <span className="font-semibold text-emerald-400">{stats.mastered}</span> Mastered •{' '}
                <span className="font-semibold text-amber-400">{stats.inProgress}</span> In Progress
              </div>
              <div className="text-[11px] text-neutral-500 mt-0.5">
                {stats.notStarted} of {stats.total} Not Started
              </div>
            </div>
          </div>

          {/* Category Rings */}
          {(['Core CS', 'IT-officer', 'Common'] as TopicCategory[]).map(cat => {
            const catStats = stats.byCat[cat];
            if (catStats.total === 0) return null;

            const pct = Math.round(((catStats.mastered + catStats.inProgress * 0.4) / catStats.total) * 100);
            const color =
              cat === 'Core CS' ? '#6366f1' : cat === 'IT-officer' ? '#10b981' : '#f59e0b';

            return (
              <div
                key={cat}
                className="flex items-center gap-3 bg-neutral-950/60 border border-neutral-800/80 rounded-xl p-3"
              >
                <ProgressRing
                  percentage={pct}
                  size={70}
                  strokeWidth={6}
                  color={color}
                  label={cat === 'Core CS' ? 'Core' : cat === 'IT-officer' ? 'IT' : 'Common'}
                />
                <div>
                  <div className="text-xs font-semibold text-neutral-200">{cat}</div>
                  <div className="text-[11px] text-neutral-400 mt-0.5">
                    {catStats.mastered} / {catStats.total} Mastered
                  </div>
                  <div className="text-[10px] text-neutral-500">
                    {catStats.inProgress} in progress
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
          <input
            type="text"
            placeholder="Search topic or subtopics in syllabus..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-2 text-xs bg-neutral-900 border border-neutral-800 rounded-lg text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-indigo-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Status Filter Buttons */}
        <div className="flex items-center gap-1 bg-neutral-900 p-1 rounded-lg border border-neutral-800 text-xs">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-2.5 py-1 rounded-md transition-colors ${
              statusFilter === 'all'
                ? 'bg-neutral-800 text-white font-medium'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            All ({examTopics.length})
          </button>
          <button
            onClick={() => setStatusFilter('not_started')}
            className={`px-2.5 py-1 rounded-md transition-colors flex items-center gap-1 ${
              statusFilter === 'not_started'
                ? 'bg-neutral-800 text-neutral-200 font-medium'
                : 'text-neutral-400 hover:text-neutral-300'
            }`}
          >
            <Circle className="w-2.5 h-2.5 text-neutral-500" />
            Not Started ({stats.notStarted})
          </button>
          <button
            onClick={() => setStatusFilter('in_progress')}
            className={`px-2.5 py-1 rounded-md transition-colors flex items-center gap-1 ${
              statusFilter === 'in_progress'
                ? 'bg-amber-950 text-amber-300 font-medium border border-amber-800'
                : 'text-neutral-400 hover:text-amber-300'
            }`}
          >
            <Clock className="w-2.5 h-2.5 text-amber-400" />
            In Progress ({stats.inProgress})
          </button>
          <button
            onClick={() => setStatusFilter('mastered')}
            className={`px-2.5 py-1 rounded-md transition-colors flex items-center gap-1 ${
              statusFilter === 'mastered'
                ? 'bg-emerald-950 text-emerald-300 font-medium border border-emerald-800'
                : 'text-neutral-400 hover:text-emerald-300'
            }`}
          >
            <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
            Mastered ({stats.mastered})
          </button>
        </div>
      </div>

      {/* Topics List Grouped by Category */}
      {(['Core CS', 'IT-officer', 'Common'] as TopicCategory[]).map(category => {
        const catTopics = groupedTopics[category];
        if (catTopics.length === 0) return null;

        return (
          <div key={category} className="flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-neutral-800/80 pb-2">
              <h2 className="text-sm font-bold text-neutral-200 uppercase tracking-wider flex items-center gap-2">
                <span>{category}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-400 font-normal">
                  {catTopics.length} topics
                </span>
              </h2>
            </div>

            <div className="flex flex-col gap-2.5">
              {catTopics.map(topic => {
                const progress = progressMap.get(topic.id);
                const currentStatus: SyllabusStatus = progress?.status || 'not_started';
                const isExpanded = expandedTopicIds.has(topic.id);

                // Direct jump link counts
                const mistakesInfo =
                  mistakeCounts.get(topic.name.toLowerCase()) ||
                  mistakeCounts.get(topic.id.toLowerCase()) || { total: 0, active: 0 };
                const pyqInfo = pyqCounts.get(topic.id) || { total: 0, attempted: 0 };
                const noteCount = noteCounts.get(topic.id) || 0;

                return (
                  <div
                    key={topic.id}
                    className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 transition-all hover:border-neutral-700/80"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      {/* Left: Topic Title & Subtopic expand toggle */}
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-sm text-neutral-100">{topic.name}</h3>
                          <span className="text-[10px] text-neutral-500 uppercase tracking-wider px-1.5 py-0.2 rounded bg-neutral-800">
                            {topic.category}
                          </span>
                        </div>

                        {/* Direct Jump Links Bar */}
                        <div className="flex flex-wrap items-center gap-2 mt-2 text-xs">
                          {/* Mistakes Jump Link */}
                          <button
                            onClick={() => onNavigate?.('mistakes', { topic: topic.name })}
                            className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors border ${
                              mistakesInfo.active > 0
                                ? 'bg-red-950/70 border-red-900/60 text-red-300 hover:bg-red-900/80'
                                : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-neutral-200'
                            }`}
                            title="Jump to mistakes for this topic"
                          >
                            <AlertTriangle className="w-3 h-3 text-red-400" />
                            <span>
                              {mistakesInfo.total > 0
                                ? `${mistakesInfo.active} active / ${mistakesInfo.total} mistakes`
                                : '0 mistakes'}
                            </span>
                          </button>

                          {/* PYQ Jump Link */}
                          <button
                            onClick={() => onNavigate?.('pyqs', { topicId: topic.id, examId: selectedExamId })}
                            className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-neutral-950 border border-neutral-800 text-neutral-400 hover:text-amber-300 transition-colors"
                            title="Jump to PYQ practice bank for this topic"
                          >
                            <FileText className="w-3 h-3 text-amber-400" />
                            <span>
                              {pyqInfo.total > 0
                                ? `${pyqInfo.attempted}/${pyqInfo.total} PYQs`
                                : 'Practice PYQs'}
                            </span>
                          </button>

                          {/* Notes Jump Link */}
                          <button
                            onClick={() => onNavigate?.('notes', { topicId: topic.id })}
                            className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-neutral-950 border border-neutral-800 text-neutral-400 hover:text-indigo-300 transition-colors"
                            title="Jump to study notes for this topic"
                          >
                            <FileEdit className="w-3 h-3 text-indigo-400" />
                            <span>{noteCount > 0 ? `${noteCount} notes` : 'Notes'}</span>
                          </button>

                          {/* Expand Subtopics Button */}
                          {topic.subtopics.length > 0 && (
                            <button
                              onClick={() => toggleTopicExpand(topic.id)}
                              className="text-[11px] text-neutral-500 hover:text-neutral-300 flex items-center gap-0.5 ml-1"
                            >
                              <span>{topic.subtopics.length} subtopics</span>
                              {isExpanded ? (
                                <ChevronUp className="w-3 h-3" />
                              ) : (
                                <ChevronDown className="w-3 h-3" />
                              )}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Right: One-Click 3-State Status Toggle */}
                      <div className="flex items-center gap-1 bg-neutral-950 p-1 rounded-xl border border-neutral-800 shrink-0">
                        <button
                          onClick={() => handleStatusChange(topic.id, 'not_started')}
                          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                            currentStatus === 'not_started'
                              ? 'bg-neutral-800 text-white shadow-sm'
                              : 'text-neutral-400 hover:text-neutral-200'
                          }`}
                        >
                          <Circle className="w-3 h-3 text-neutral-500" />
                          <span>Not started</span>
                        </button>

                        <button
                          onClick={() => handleStatusChange(topic.id, 'in_progress')}
                          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                            currentStatus === 'in_progress'
                              ? 'bg-amber-950 text-amber-300 border border-amber-800 shadow-sm'
                              : 'text-neutral-400 hover:text-amber-300'
                          }`}
                        >
                          <Clock className="w-3 h-3 text-amber-400" />
                          <span>In progress</span>
                        </button>

                        <button
                          onClick={() => handleStatusChange(topic.id, 'mastered')}
                          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                            currentStatus === 'mastered'
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-800 shadow-sm'
                              : 'text-neutral-400 hover:text-emerald-300'
                          }`}
                        >
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          <span>Mastered</span>
                        </button>
                      </div>
                    </div>

                    {/* Expandable Subtopics List */}
                    {isExpanded && topic.subtopics.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-neutral-800/80 bg-neutral-950/60 rounded-lg p-3">
                        <div className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-2">
                          Syllabus Coverage Subtopics
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {topic.subtopics.map((sub, i) => (
                            <div key={i} className="flex items-start gap-2 text-xs text-neutral-300">
                              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                              <span>{sub}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {filteredTopics.length === 0 && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-8 text-center">
          <AlertTriangle className="w-8 h-8 text-neutral-500 mx-auto mb-2" />
          <h3 className="text-sm font-semibold text-neutral-300">No syllabus topics found</h3>
          <p className="text-xs text-neutral-500 mt-1">Try clearing filters or search terms.</p>
          <button
            onClick={() => {
              setSearchQuery('');
              setStatusFilter('all');
            }}
            className="mt-3 px-3 py-1.5 text-xs bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg"
          >
            Clear Filters
          </button>
        </div>
      )}
    </div>
  );
};
