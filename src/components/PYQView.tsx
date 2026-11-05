import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, DEFAULT_CANONICAL_TOPICS } from '../db/db';
import { PYQ, QuestionType, CanonicalTopic } from '../types';
import { QuestionRenderer } from './shared/QuestionRenderer';
import {
  INITIAL_PYQS,
  filterPYQs,
  recordPYQAttempt,
  calculateOverallPYQStats,
  evaluatePYQAnswer,
  seedInitialPYQsIfEmpty,
  PYQFilterOptions,
  PYQAttemptFilter
} from '../utils/pyqBank';
import { SUPPORTED_EXAMS } from '../utils/topicGraph';
import {
  FileText,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Plus,
  RotateCcw,
  Sparkles,
  BookOpen,
  ArrowRight,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  X,
  Database
} from 'lucide-react';

export interface PYQViewProps {
  initialExamId?: string;
  initialTopicId?: string;
  onNavigate?: (tab: string, filter?: { topic?: string; topicId?: string; examId?: string }) => void;
  className?: string;
}

/**
 * Resolves option string references from a key string like "A" or "A, B, D"
 * to actual option items in the options array.
 */
function resolveOptionMatches(options: string[] = [], answerKey: string = ''): string[] {
  if (!options || options.length === 0 || !answerKey) return [];
  const keys = answerKey
    .split(/[,; ]+/)
    .map(k => k.trim().toUpperCase())
    .filter(Boolean);

  const matched: string[] = [];
  for (let i = 0; i < options.length; i++) {
    const opt = options[i];
    const letter = String.fromCharCode(65 + i);
    if (
      keys.includes(letter) ||
      keys.some(k => opt.trim().toUpperCase().startsWith(k)) ||
      keys.includes(opt.trim().toUpperCase())
    ) {
      matched.push(opt);
    }
  }
  return matched.length > 0 ? matched : [answerKey];
}

export const PYQView: React.FC<PYQViewProps> = ({
  initialExamId = 'all',
  initialTopicId = 'all',
  onNavigate,
  className = ''
}) => {
  // Live queries
  const livePyqs = useLiveQuery(() => db.pyqs.toArray(), []);
  const liveTopics = useLiveQuery(() => db.topics.toArray(), []);

  const topics = useMemo(() => {
    return liveTopics && liveTopics.length > 0 ? liveTopics : DEFAULT_CANONICAL_TOPICS;
  }, [liveTopics]);

  const topicNameMap = useMemo(() => {
    const map = new Map<string, string>();
    topics.forEach(t => map.set(t.id, t.name));
    return map;
  }, [topics]);

  // Current PYQ list, auto-seeding if empty
  const pyqs = useMemo(() => {
    return livePyqs && livePyqs.length > 0 ? livePyqs : INITIAL_PYQS;
  }, [livePyqs]);

  // Filters
  const [examId, setExamId] = useState<string>(initialExamId);
  const [yearFilter, setYearFilter] = useState<number | 'all'>('all');
  const [topicFilter, setTopicFilter] = useState<string>(initialTopicId);
  const [typeFilter, setTypeFilter] = useState<QuestionType | 'all'>('all');
  const [attemptFilter, setAttemptFilter] = useState<PYQAttemptFilter>('all');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'official' | 'memory-based'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Interactive attempt states: questionId -> answer
  const [userSelections, setUserSelections] = useState<Record<number, string | string[]>>({});
  const [userNatInputs, setUserNatInputs] = useState<Record<number, string>>({});
  const [revealedSolutions, setRevealedSolutions] = useState<Set<number>>(new Set());
  const [lastAttemptFeedback, setLastAttemptFeedback] = useState<Record<number, { isCorrect: boolean; message: string }>>({});

  // Add Question Modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newQuestion, setNewQuestion] = useState<Partial<PYQ>>({
    examId: 'gate-cs',
    year: 2024,
    stage: 'cbt',
    topicId: 'algorithms',
    questionType: 'MCQ',
    marks: 1,
    negativeMarks: 0.33,
    questionText: '',
    options: ['', '', '', ''],
    correctAnswer: 'A',
    source: 'official',
    solutionText: ''
  });

  // Calculate available years dynamically
  const availableYears = useMemo(() => {
    const set = new Set<number>();
    pyqs.forEach(q => set.add(q.year));
    return Array.from(set).sort((a, b) => b - a);
  }, [pyqs]);

  // Filtered PYQs
  const filteredPYQs = useMemo(() => {
    const opts: PYQFilterOptions = {
      examId: examId === 'all' ? undefined : examId,
      year: yearFilter,
      topicId: topicFilter,
      questionType: typeFilter,
      attemptFilter,
      source: sourceFilter,
      searchQuery
    };
    return filterPYQs(pyqs, opts);
  }, [pyqs, examId, yearFilter, topicFilter, typeFilter, attemptFilter, sourceFilter, searchQuery]);

  // Overall Stats
  const stats = useMemo(() => {
    return calculateOverallPYQStats(pyqs, topics);
  }, [pyqs, topics]);

  // Seed handler
  const handleSeedPYQs = async () => {
    await seedInitialPYQsIfEmpty();
  };

  // Option select handler
  const handleOptionSelect = (q: PYQ, option: string) => {
    const qId = q.id || 0;
    if (q.questionType === 'MSQ') {
      const cur = (userSelections[qId] as string[]) || [];
      const next = cur.includes(option) ? cur.filter(o => o !== option) : [...cur, option];
      setUserSelections(prev => ({ ...prev, [qId]: next }));
    } else {
      setUserSelections(prev => ({ ...prev, [qId]: option }));
    }
  };

  // Submit attempt
  const handleSubmitAttempt = async (q: PYQ) => {
    const qId = q.id || 0;
    let answerToEvaluate: string | number | string[] = '';

    if (q.questionType === 'NAT') {
      const inputStr = userNatInputs[qId] || '';
      answerToEvaluate = parseFloat(inputStr.trim());
    } else if (q.questionType === 'MSQ') {
      const selected = (userSelections[qId] as string[]) || [];
      // Extract option letters (A, B, C, D) if options have them
      const letters: string[] = [];
      selected.forEach(opt => {
        const idx = (q.options || []).indexOf(opt);
        if (idx !== -1) {
          letters.push(String.fromCharCode(65 + idx));
        } else {
          letters.push(opt);
        }
      });
      answerToEvaluate = letters;
    } else {
      const selected = (userSelections[qId] as string) || '';
      const idx = (q.options || []).indexOf(selected);
      answerToEvaluate = idx !== -1 ? String.fromCharCode(65 + idx) : selected;
    }

    const result = recordPYQAttempt(q, answerToEvaluate);

    // Save to Dexie
    if (q.id) {
      await db.pyqs.put(result.pyq);
    }

    // Auto reveal solution
    setRevealedSolutions(prev => new Set(prev).add(qId));
    setLastAttemptFeedback(prev => ({
      ...prev,
      [qId]: {
        isCorrect: result.isCorrect,
        message: result.feedback
      }
    }));
  };

  const toggleSolution = (qId: number) => {
    setRevealedSolutions(prev => {
      const next = new Set(prev);
      if (next.has(qId)) {
        next.delete(qId);
      } else {
        next.add(qId);
      }
      return next;
    });
  };

  // Add question handler
  const handleSaveNewQuestion = async () => {
    if (!newQuestion.questionText || !newQuestion.correctAnswer) {
      alert('Please fill out the question text and correct answer.');
      return;
    }

    const payload: PYQ = {
      examId: newQuestion.examId || 'gate-cs',
      year: Number(newQuestion.year) || 2024,
      stage: newQuestion.stage || 'cbt',
      topicId: newQuestion.topicId || 'algorithms',
      questionNumber: (pyqs.length || 0) + 1,
      questionText: newQuestion.questionText,
      questionType: newQuestion.questionType || 'MCQ',
      marks: Number(newQuestion.marks) || 1,
      negativeMarks: Number(newQuestion.negativeMarks) || 0,
      options:
        newQuestion.questionType === 'NAT'
          ? []
          : (newQuestion.options || []).filter(o => o.trim().length > 0),
      correctAnswer: newQuestion.correctAnswer,
      solutionText: newQuestion.solutionText || '',
      source: (newQuestion.source as 'official' | 'memory-based') || 'official',
      attemptedCount: 0,
      createdAt: new Date().toISOString()
    };

    await db.pyqs.add(payload);
    setIsAddModalOpen(false);
  };

  return (
    <div className={`pyq-bank-view flex flex-col gap-6 text-neutral-100 ${className}`}>
      {/* Header & KPI Summary */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-neutral-800 pb-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400">
                <FileText className="w-5 h-5" />
              </span>
              <h1 className="text-xl font-bold tracking-tight text-white">Previous Year Questions (PYQ) Bank</h1>
            </div>
            <p className="text-xs text-neutral-400">
              Interactive bank with LaTeX rendering, first-attempt accuracy tracking, and official vs memory-based question filtering.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {livePyqs && livePyqs.length === 0 && (
              <button
                onClick={handleSeedPYQs}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-1.5 transition-colors shadow-sm"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Seed Initial PYQs
              </button>
            )}

            <button
              onClick={() => setIsAddModalOpen(true)}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 flex items-center gap-1.5 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Question
            </button>
          </div>
        </div>

        {/* 4 Metric Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
          <div className="bg-neutral-950/60 border border-neutral-800/80 rounded-lg p-3">
            <div className="text-[11px] font-medium text-neutral-400">Total PYQs in Bank</div>
            <div className="text-xl font-bold text-white mt-1">{stats.total}</div>
            <div className="text-[10px] text-neutral-500 mt-0.5">
              {stats.byQuestionType['MCQ']?.total || 0} MCQ • {stats.byQuestionType['MSQ']?.total || 0} MSQ • {stats.byQuestionType['NAT']?.total || 0} NAT
            </div>
          </div>

          <div className="bg-neutral-950/60 border border-neutral-800/80 rounded-lg p-3">
            <div className="text-[11px] font-medium text-neutral-400">Attempt Coverage</div>
            <div className="text-xl font-bold text-amber-400 mt-1">
              {stats.attempted} / {stats.total}
            </div>
            <div className="text-[10px] text-neutral-500 mt-0.5">
              {stats.coveragePercentage}% completed
            </div>
          </div>

          <div className="bg-neutral-950/60 border border-neutral-800/80 rounded-lg p-3">
            <div className="text-[11px] font-medium text-neutral-400">1st-Attempt Accuracy</div>
            <div
              className={`text-xl font-bold mt-1 ${
                stats.firstAttemptAccuracy >= 70
                  ? 'text-emerald-400'
                  : stats.firstAttemptAccuracy >= 50
                  ? 'text-amber-400'
                  : stats.attempted === 0
                  ? 'text-neutral-500'
                  : 'text-rose-400'
              }`}
            >
              {stats.attempted > 0 ? `${stats.firstAttemptAccuracy}%` : 'N/A'}
            </div>
            <div className="text-[10px] text-neutral-500 mt-0.5">
              {stats.firstAttemptCorrect} correct on first try
            </div>
          </div>

          <div className="bg-neutral-950/60 border border-neutral-800/80 rounded-lg p-3">
            <div className="text-[11px] font-medium text-neutral-400">Exam Distribution</div>
            <div className="text-sm font-semibold text-neutral-200 mt-1.5 flex items-center gap-2">
              <span className="text-indigo-400">{stats.byExam['gate-cs']?.total || 0} GATE</span>
              <span className="text-emerald-400">{stats.byExam['sebi-it']?.total || 0} SEBI</span>
              <span className="text-amber-400">{stats.byExam['ibps-so-it']?.total || 0} IBPS</span>
            </div>
            <div className="text-[10px] text-neutral-500 mt-0.5">Spanning {availableYears.join(', ')}</div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 flex flex-col gap-3">
        {/* Row 1: Search & Dropdowns */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2.5">
          {/* Search */}
          <div className="relative col-span-1 sm:col-span-2">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
            <input
              type="text"
              placeholder="Search question text, solution, or topic..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 text-xs bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-amber-500"
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

          {/* Exam Filter */}
          <select
            value={examId}
            onChange={(e) => setExamId(e.target.value)}
            className="py-2 px-3 text-xs bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-200 focus:outline-none focus:border-amber-500"
          >
            <option value="all">All Exams</option>
            <option value="gate-cs">GATE CS</option>
            <option value="sebi-it">SEBI Grade A (IT)</option>
            <option value="ibps-so-it">IBPS SO (IT Officer)</option>
          </select>

          {/* Year Filter */}
          <select
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
            className="py-2 px-3 text-xs bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-200 focus:outline-none focus:border-amber-500"
          >
            <option value="all">All Years</option>
            {availableYears.map(yr => (
              <option key={yr} value={yr}>
                {yr}
              </option>
            ))}
          </select>

          {/* Topic Filter */}
          <select
            value={topicFilter}
            onChange={(e) => setTopicFilter(e.target.value)}
            className="py-2 px-3 text-xs bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-200 focus:outline-none focus:border-amber-500"
          >
            <option value="all">All Topics</option>
            {topics.map(t => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.category})
              </option>
            ))}
          </select>
        </div>

        {/* Row 2: Pills for Type, Attempt Status, and Source */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-neutral-800/80 text-xs">
          {/* Question Type */}
          <div className="flex items-center gap-1 bg-neutral-950 p-1 rounded-lg border border-neutral-800">
            {(['all', 'MCQ', 'MSQ', 'NAT'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  typeFilter === t
                    ? 'bg-neutral-800 text-white font-medium shadow-sm'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                {t === 'all' ? 'All Types' : t}
              </button>
            ))}
          </div>

          {/* Attempt Status */}
          <div className="flex items-center gap-1 bg-neutral-950 p-1 rounded-lg border border-neutral-800">
            <button
              onClick={() => setAttemptFilter('all')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                attemptFilter === 'all' ? 'bg-neutral-800 text-white font-medium' : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              All Status
            </button>
            <button
              onClick={() => setAttemptFilter('unattempted')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                attemptFilter === 'unattempted' ? 'bg-neutral-800 text-white font-medium' : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              Unattempted
            </button>
            <button
              onClick={() => setAttemptFilter('attempted')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                attemptFilter === 'attempted' ? 'bg-neutral-800 text-white font-medium' : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              Attempted
            </button>
            <button
              onClick={() => setAttemptFilter('first-correct')}
              className={`px-2.5 py-1 rounded-md transition-colors flex items-center gap-1 ${
                attemptFilter === 'first-correct'
                  ? 'bg-emerald-950 text-emerald-300 font-medium border border-emerald-800'
                  : 'text-neutral-400 hover:text-emerald-300'
              }`}
            >
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              1st Correct
            </button>
            <button
              onClick={() => setAttemptFilter('first-incorrect')}
              className={`px-2.5 py-1 rounded-md transition-colors flex items-center gap-1 ${
                attemptFilter === 'first-incorrect'
                  ? 'bg-rose-950 text-rose-300 font-medium border border-rose-800'
                  : 'text-neutral-400 hover:text-rose-300'
              }`}
            >
              <XCircle className="w-3 h-3 text-rose-400" />
              1st Wrong
            </button>
          </div>

          {/* Source */}
          <div className="flex items-center gap-1 bg-neutral-950 p-1 rounded-lg border border-neutral-800">
            <button
              onClick={() => setSourceFilter('all')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                sourceFilter === 'all' ? 'bg-neutral-800 text-white font-medium' : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              All Sources
            </button>
            <button
              onClick={() => setSourceFilter('official')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                sourceFilter === 'official' ? 'bg-neutral-800 text-white font-medium' : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              Official
            </button>
            <button
              onClick={() => setSourceFilter('memory-based')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                sourceFilter === 'memory-based' ? 'bg-neutral-800 text-white font-medium' : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              Memory-based
            </button>
          </div>
        </div>
      </div>

      {/* Questions List */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between text-xs text-neutral-400 px-1">
          <span>Showing {filteredPYQs.length} previous-year questions</span>
          {(examId !== 'all' || yearFilter !== 'all' || topicFilter !== 'all' || typeFilter !== 'all' || attemptFilter !== 'all' || sourceFilter !== 'all' || searchQuery) && (
            <button
              onClick={() => {
                setExamId('all');
                setYearFilter('all');
                setTopicFilter('all');
                setTypeFilter('all');
                setAttemptFilter('all');
                setSourceFilter('all');
                setSearchQuery('');
              }}
              className="text-amber-400 hover:underline"
            >
              Reset all filters
            </button>
          )}
        </div>

        {filteredPYQs.map((q, idx) => {
          const qId = q.id || idx + 1;
          const examMeta = SUPPORTED_EXAMS[q.examId];
          const topicName = topicNameMap.get(q.topicId) || q.topicId;
          const isAttempted = (q.attemptedCount || 0) > 0;
          const isSolutionRevealed = revealedSolutions.has(qId);
          const feedback = lastAttemptFeedback[qId];

          const selectedOption = userSelections[qId];
          const natVal = userNatInputs[qId];

          // Compute matched options for QuestionRenderer
          const matchedCorrectOptions = resolveOptionMatches(q.options, q.correctAnswer);

          return (
            <div
              key={qId}
              className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-sm transition-all hover:border-neutral-700/80 flex flex-col gap-4"
            >
              {/* Question Header Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-800 pb-3">
                <div className="flex flex-wrap items-center gap-2">
                  {/* Exam Pill */}
                  <span
                    className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${
                      examMeta ? `${examMeta.badgeBg} ${examMeta.badgeText} ${examMeta.border}` : 'bg-neutral-800 text-neutral-300'
                    }`}
                  >
                    {examMeta?.shortName || q.examId} {q.year}
                  </span>

                  {/* Shift / Stage */}
                  <span className="text-[11px] text-neutral-400 bg-neutral-800/80 px-2 py-0.5 rounded border border-neutral-700">
                    {q.shift || q.stage}
                  </span>

                  {/* Topic badge */}
                  <span className="text-[11px] text-indigo-300 bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-900/60 font-medium">
                    {topicName}
                  </span>

                  {/* Marks */}
                  <span className="text-[11px] text-neutral-400 bg-neutral-950 px-2 py-0.5 rounded font-mono">
                    +{q.marks} / -{q.negativeMarks || 0} marks
                  </span>

                  {/* Source */}
                  <span
                    className={`text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.2 rounded border ${
                      q.source === 'official'
                        ? 'bg-blue-950/80 text-blue-300 border-blue-900/60'
                        : 'bg-purple-950/80 text-purple-300 border-purple-900/60'
                    }`}
                  >
                    {q.source}
                  </span>
                </div>

                {/* Attempt Status Indicator */}
                <div className="flex items-center gap-2 text-xs">
                  {isAttempted ? (
                    <div className="flex items-center gap-1.5">
                      {q.firstAttemptCorrect === true ? (
                        <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-950/80 border border-emerald-800 px-2 py-0.5 rounded-full">
                          <CheckCircle2 className="w-3 h-3" />
                          1st Attempt: Correct
                        </span>
                      ) : q.firstAttemptCorrect === false ? (
                        <span className="flex items-center gap-1 text-[11px] font-semibold text-rose-400 bg-rose-950/80 border border-rose-800 px-2 py-0.5 rounded-full">
                          <XCircle className="w-3 h-3" />
                          1st Attempt: Incorrect
                        </span>
                      ) : null}
                      <span className="text-[11px] text-neutral-500 font-mono">
                        ({q.attemptedCount} attempts)
                      </span>
                    </div>
                  ) : (
                    <span className="text-[11px] text-neutral-500 italic">Not attempted</span>
                  )}
                </div>
              </div>

              {/* Subtopic if available */}
              {q.subtopic && (
                <div className="text-xs text-neutral-400 font-medium -mt-2">
                  Subtopic: <span className="text-neutral-300">{q.subtopic}</span>
                </div>
              )}

              {/* Interactive Question Renderer */}
              <div className="bg-neutral-950/40 p-4 rounded-xl border border-neutral-850">
                <QuestionRenderer
                  text={q.questionText}
                  options={q.options || []}
                  selectedOption={selectedOption}
                  correctOption={matchedCorrectOptions}
                  questionType={q.questionType}
                  natAnswer={natVal ? parseFloat(natVal) : undefined}
                  correctNatAnswer={q.natAnswerRange || parseFloat(q.correctAnswer)}
                  image={q.questionImage}
                  solution={q.solutionText}
                  showSolution={isSolutionRevealed}
                  onOptionSelect={(opt) => handleOptionSelect(q, opt)}
                />

                {/* For NAT: Number Input */}
                {q.questionType === 'NAT' && !isSolutionRevealed && (
                  <div className="mt-3 flex items-center gap-2">
                    <label className="text-xs text-neutral-400 font-medium">Enter Numerical Value:</label>
                    <input
                      type="number"
                      step="any"
                      placeholder="e.g. 23"
                      value={userNatInputs[qId] || ''}
                      onChange={(e) => setUserNatInputs(prev => ({ ...prev, [qId]: e.target.value }))}
                      className="w-36 px-3 py-1.5 text-xs bg-neutral-900 border border-neutral-700 rounded-lg text-white font-mono focus:outline-none focus:border-amber-500"
                    />
                  </div>
                )}
              </div>

              {/* Feedback Alert if just submitted */}
              {feedback && (
                <div
                  className={`p-3 rounded-lg text-xs font-medium flex items-center gap-2 ${
                    feedback.isCorrect
                      ? 'bg-emerald-950/80 border border-emerald-800 text-emerald-300'
                      : 'bg-rose-950/80 border border-rose-800 text-rose-300'
                  }`}
                >
                  {feedback.isCorrect ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 shrink-0" />
                  )}
                  <span>{feedback.message}</span>
                </div>
              )}

              {/* Action Buttons: Submit / Toggle Solution / Topic Link */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-neutral-800">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleSubmitAttempt(q)}
                    className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-amber-600 hover:bg-amber-500 text-black flex items-center gap-1.5 transition-colors shadow-sm"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Submit Attempt
                  </button>

                  <button
                    onClick={() => toggleSolution(qId)}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 transition-colors flex items-center gap-1"
                  >
                    {isSolutionRevealed ? (
                      <>
                        <ChevronUp className="w-3.5 h-3.5" />
                        Hide Solution
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-3.5 h-3.5" />
                        Show Solution & Explanation
                      </>
                    )}
                  </button>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <button
                    onClick={() => onNavigate?.('syllabus', { topicId: q.topicId, examId: q.examId })}
                    className="text-neutral-400 hover:text-indigo-400 flex items-center gap-1 transition-colors"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    View in Syllabus
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {filteredPYQs.length === 0 && (
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-8 text-center">
            <HelpCircle className="w-8 h-8 text-neutral-500 mx-auto mb-2" />
            <h3 className="text-sm font-semibold text-neutral-300">No questions match your filter criteria</h3>
            <p className="text-xs text-neutral-500 mt-1">Try resetting filters or seeding initial questions.</p>
            <button
              onClick={() => {
                setExamId('all');
                setYearFilter('all');
                setTopicFilter('all');
                setTypeFilter('all');
                setAttemptFilter('all');
                setSourceFilter('all');
                setSearchQuery('');
              }}
              className="mt-3 px-3 py-1.5 text-xs bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg"
            >
              Reset Filters
            </button>
          </div>
        )}
      </div>

      {/* Add Question Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-amber-400" />
                Add Previous Year Question
              </h2>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="text-neutral-400 font-medium mb-1 block">Exam</label>
                <select
                  value={newQuestion.examId}
                  onChange={(e) => setNewQuestion(prev => ({ ...prev, examId: e.target.value }))}
                  className="w-full p-2 bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-200"
                >
                  <option value="gate-cs">GATE CS</option>
                  <option value="sebi-it">SEBI Grade A (IT)</option>
                  <option value="ibps-so-it">IBPS SO (IT Officer)</option>
                </select>
              </div>

              <div>
                <label className="text-neutral-400 font-medium mb-1 block">Year</label>
                <input
                  type="number"
                  value={newQuestion.year || 2024}
                  onChange={(e) => setNewQuestion(prev => ({ ...prev, year: Number(e.target.value) }))}
                  className="w-full p-2 bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-200"
                />
              </div>

              <div>
                <label className="text-neutral-400 font-medium mb-1 block">Stage / Shift</label>
                <input
                  type="text"
                  placeholder="e.g. Shift 1 or Phase 2"
                  value={newQuestion.stage || ''}
                  onChange={(e) => setNewQuestion(prev => ({ ...prev, stage: e.target.value }))}
                  className="w-full p-2 bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-200"
                />
              </div>

              <div>
                <label className="text-neutral-400 font-medium mb-1 block">Topic</label>
                <select
                  value={newQuestion.topicId}
                  onChange={(e) => setNewQuestion(prev => ({ ...prev, topicId: e.target.value }))}
                  className="w-full p-2 bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-200"
                >
                  {topics.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-neutral-400 font-medium mb-1 block">Question Type</label>
                <select
                  value={newQuestion.questionType}
                  onChange={(e) => setNewQuestion(prev => ({ ...prev, questionType: e.target.value as QuestionType }))}
                  className="w-full p-2 bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-200"
                >
                  <option value="MCQ">MCQ</option>
                  <option value="MSQ">MSQ</option>
                  <option value="NAT">NAT</option>
                </select>
              </div>

              <div>
                <label className="text-neutral-400 font-medium mb-1 block">Source</label>
                <select
                  value={newQuestion.source}
                  onChange={(e) => setNewQuestion(prev => ({ ...prev, source: e.target.value as 'official' | 'memory-based' }))}
                  className="w-full p-2 bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-200"
                >
                  <option value="official">Official</option>
                  <option value="memory-based">Memory-based</option>
                </select>
              </div>

              <div>
                <label className="text-neutral-400 font-medium mb-1 block">Marks</label>
                <input
                  type="number"
                  step="any"
                  value={newQuestion.marks || 1}
                  onChange={(e) => setNewQuestion(prev => ({ ...prev, marks: Number(e.target.value) }))}
                  className="w-full p-2 bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-200"
                />
              </div>

              <div>
                <label className="text-neutral-400 font-medium mb-1 block">Negative Marks</label>
                <input
                  type="number"
                  step="any"
                  value={newQuestion.negativeMarks || 0}
                  onChange={(e) => setNewQuestion(prev => ({ ...prev, negativeMarks: Number(e.target.value) }))}
                  className="w-full p-2 bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-200"
                />
              </div>

              <div>
                <label className="text-neutral-400 font-medium mb-1 block">Correct Answer Key</label>
                <input
                  type="text"
                  placeholder="e.g. A or A, B or 23"
                  value={newQuestion.correctAnswer || ''}
                  onChange={(e) => setNewQuestion(prev => ({ ...prev, correctAnswer: e.target.value }))}
                  className="w-full p-2 bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-200 font-mono"
                />
              </div>
            </div>

            {/* Question Text */}
            <div className="text-xs">
              <label className="text-neutral-400 font-medium mb-1 block">
                Question Text (supports LaTeX math with $...$ or $$...$$):
              </label>
              <textarea
                rows={4}
                value={newQuestion.questionText || ''}
                onChange={(e) => setNewQuestion(prev => ({ ...prev, questionText: e.target.value }))}
                className="w-full p-2.5 bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-200 font-mono focus:outline-none focus:border-amber-500"
                placeholder="What is the time complexity of..."
              />
            </div>

            {/* Options if MCQ or MSQ */}
            {newQuestion.questionType !== 'NAT' && (
              <div className="text-xs flex flex-col gap-2">
                <label className="text-neutral-400 font-medium">Options (A, B, C, D):</label>
                {(['A', 'B', 'C', 'D'] as const).map((letter, i) => (
                  <div key={letter} className="flex items-center gap-2">
                    <span className="w-5 text-center font-bold text-neutral-400">{letter}</span>
                    <input
                      type="text"
                      placeholder={`Option ${letter}`}
                      value={(newQuestion.options || [])[i] || ''}
                      onChange={(e) => {
                        const next = [...(newQuestion.options || ['', '', '', ''])];
                        next[i] = e.target.value;
                        setNewQuestion(prev => ({ ...prev, options: next }));
                      }}
                      className="flex-1 p-2 bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-200"
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Solution Text */}
            <div className="text-xs">
              <label className="text-neutral-400 font-medium mb-1 block">Solution & Explanation:</label>
              <textarea
                rows={3}
                value={newQuestion.solutionText || ''}
                onChange={(e) => setNewQuestion(prev => ({ ...prev, solutionText: e.target.value }))}
                className="w-full p-2.5 bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-200 font-mono focus:outline-none focus:border-amber-500"
                placeholder="Explanation of the correct answer..."
              />
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 border-t border-neutral-800 pt-3">
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="px-4 py-1.5 text-xs rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveNewQuestion}
                className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-amber-600 hover:bg-amber-500 text-black shadow-sm"
              >
                Save PYQ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
