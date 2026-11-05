import React, { useState, useEffect } from 'react';
import { MistakeEntry, MockTest, PaperTest, ExamSettings, ResultType, Difficulty, MistakeStatus, QuestionType, CS_ERROR_TYPES } from '../types';
import { db } from '../db/db';
import { exportMistakesAsCsv } from '../utils/exportImport';
import { getTodayDateStr } from '../utils/srs';
import { Mascot } from './Mascot';
import { ScreenshotInput } from './ScreenshotInput';
import { QuestionRenderer, renderFormattedContent } from './shared/QuestionRenderer';
import {
  Plus,
  Zap,
  Search,
  Download,
  Trash2,
  Edit3,
  Image as ImageIcon,
  Sparkles,
  X,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  CheckCircle2
} from 'lucide-react';

export function parseQuestionTextAndOptions(rawText: string): {
  prompt: string;
  options: { label: string; text: string; isCorrect: boolean; isSelected: boolean }[];
} {
  if (!rawText) return { prompt: '', options: [] };

  const optionsIndex = rawText.search(/\n\s*Options:\s*\n/i);
  if (optionsIndex === -1) {
    return { prompt: rawText, options: [] };
  }

  const prompt = rawText.slice(0, optionsIndex).trim();
  const optionsPart = rawText.slice(optionsIndex).replace(/\n\s*Options:\s*\n/i, '');
  const lines = optionsPart.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length > 5) {
    console.warn(`[MistakesView] Safety net triggered: question has ${lines.length} raw options, expected <= 5.`);
  }

  const parsed: { label: string; text: string; isCorrect: boolean; isSelected: boolean }[] = [];
  const seenTexts = new Set<string>();

  for (const line of lines) {
    const isCorrect = /\[Correct\]/i.test(line);
    const isSelected = /\[Selected\]/i.test(line);
    const clean = line
      .replace(/^(?:[0-9]+|[A-Za-z])[\.\)]\s*/, '')
      .replace(/\[(?:Correct|Selected)\]/gi, '')
      .trim();

    if (!clean) continue;
    const lower = clean.toLowerCase();
    if (seenTexts.has(lower)) continue;
    seenTexts.add(lower);

    if (parsed.length >= 5) break; // Hard limit: never more than 5 options!

    parsed.push({
      label: String.fromCharCode(65 + parsed.length),
      text: clean,
      isCorrect,
      isSelected
    });
  }

  return { prompt: prompt || rawText, options: parsed };
}

interface MistakesViewProps {
  mistakes: MistakeEntry[];
  mocks: MockTest[];
  papers?: PaperTest[];
  settings: ExamSettings;
  onRefresh: () => void;
  isQuickAddOpenDirectly?: boolean;
  onCloseQuickAddDirectly?: () => void;
  initialMockFilter?: number;
}

export const MistakesView: React.FC<MistakesViewProps> = ({
  mistakes,
  mocks,
  papers = [],
  settings,
  onRefresh,
  isQuickAddOpenDirectly = false,
  onCloseQuickAddDirectly,
  initialMockFilter
}) => {
  const [isFullModalOpen, setIsFullModalOpen] = useState(false);
  const [isQuickModalOpen, setIsQuickModalOpen] = useState(isQuickAddOpenDirectly);
  const [editingMistakeId, setEditingMistakeId] = useState<number | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSection, setFilterSection] = useState<string>('all');
  const [filterTopic, setFilterTopic] = useState<string>('all');
  const [filterErrorType, setFilterErrorType] = useState<string>('all');
  const [filterQuestionType, setFilterQuestionType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterResultType, setFilterResultType] = useState<string>('all');
  const [filterSource, setFilterSource] = useState<string>(initialMockFilter ? `mock:${initialMockFilter}` : 'all');
  const [filterDateRange, setFilterDateRange] = useState<'all' | 'today' | '7days' | '30days'>('all');
  const [filterTag, setFilterTag] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date-desc' | 'date-asc' | 'time-desc' | 'diff'>('date-desc');
  const [tagsStr, setTagsStr] = useState('');

  // All available error types combining CS_ERROR_TYPES and exam settings
  const allAvailableErrorTypes = Array.from(
    new Set([...CS_ERROR_TYPES, ...(settings.errorTypes || [])])
  );

  // Preview Image Modal
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [collapsedMistakeIds, setCollapsedMistakeIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (isQuickAddOpenDirectly) {
      setIsQuickModalOpen(true);
    }
  }, [isQuickAddOpenDirectly]);

  // Modal keyboard listeners (Cmd+Enter to save, Esc to close)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        if (isFullModalOpen) {
          e.preventDefault();
          const form = document.querySelector('form');
          if (form) form.requestSubmit();
        }
      }
      if (e.key === 'Escape') {
        if (previewImage) {
          setPreviewImage(null);
        } else if (isFullModalOpen) {
          setIsFullModalOpen(false);
        } else if (isQuickModalOpen) {
          setIsQuickModalOpen(false);
          onCloseQuickAddDirectly?.();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullModalOpen, isQuickModalOpen, previewImage, onCloseQuickAddDirectly]);

  // Form State
  const defaultMock = mocks[mocks.length - 1] || mocks[0];
  const defaultSource = defaultMock?.id ? `mock:${defaultMock.id}` : 'unlinked';
  const [sourceValue, setSourceValue] = useState<string>(defaultSource);
  const [resetReviewSchedule, setResetReviewSchedule] = useState(false);
  const [sectionId, setSectionId] = useState<string>(settings.sections[0]?.id || 'quant');
  const [topic, setTopic] = useState<string>('');
  const [subtopic, setSubtopic] = useState<string>('');
  const [questionNumber, setQuestionNumber] = useState<number>(1);
  const [questionText, setQuestionText] = useState('');
  const [questionImage, setQuestionImage] = useState<string | undefined>(undefined);
  const [questionType, setQuestionType] = useState<QuestionType>('MCQ');
  const [natAnswer, setNatAnswer] = useState<number | undefined>(undefined);
  const [correctNatMin, setCorrectNatMin] = useState<string>('');
  const [correctNatMax, setCorrectNatMax] = useState<string>('');
  const [natTolerance, setNatTolerance] = useState<number | undefined>(undefined);
  const [msqWrongStr, setMsqWrongStr] = useState<string>('');
  const [msqMissedStr, setMsqMissedStr] = useState<string>('');
  const [showModalPreview, setShowModalPreview] = useState(false);
  const [myAnswer, setMyAnswer] = useState('');
  const [correctAnswer, setCorrectAnswer] = useState('');
  const [resultType, setResultType] = useState<ResultType>('Wrong');
  const [selectedErrorTypes, setSelectedErrorTypes] = useState<string[]>([]);
  const [timeSpentSeconds, setTimeSpentSeconds] = useState<number>(60);
  const [idealTimeSeconds, setIdealTimeSeconds] = useState<number>(35);
  const [whatWentWrong, setWhatWentWrong] = useState('');
  const [correctSolution, setCorrectSolution] = useState('');
  const [betterApproach, setBetterApproach] = useState('');
  const [ruleToRemember, setRuleToRemember] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty>('Medium');
  const [status, setStatus] = useState<MistakeStatus>('New');

  const currentSectionConfig = settings.sections.find((s) => s.id === sectionId) || settings.sections[0];
  const availableTopics = currentSectionConfig?.topics || [];

  useEffect(() => {
    if (availableTopics.length > 0 && (!topic || !availableTopics.includes(topic))) {
      setTopic(availableTopics[0]);
    }
  }, [sectionId, availableTopics]);

  // Handle Cmd+V Paste on Window or Inputs for Images
  const handlePasteEvent = (e: React.ClipboardEvent | ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            if (event.target?.result) {
              setQuestionImage(event.target.result as string);
            }
          };
          reader.readAsDataURL(file);
          break;
        }
      }
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) setQuestionImage(event.target.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const openFullAdd = () => {
    setEditingMistakeId(null);
    setSourceValue(mocks[mocks.length - 1]?.id ? `mock:${mocks[mocks.length - 1].id}` : 'unlinked');
    setResetReviewSchedule(false);
    const sec = settings.sections[0]?.id || 'quant';
    setSectionId(sec);
    setTopic(settings.sections[0]?.topics[0] || 'Percentage');
    setSubtopic('');
    setQuestionNumber(mistakes.length + 1);
    setQuestionText('');
    setQuestionImage(undefined);
    setQuestionType('MCQ');
    setNatAnswer(undefined);
    setCorrectNatMin('');
    setCorrectNatMax('');
    setNatTolerance(undefined);
    setMsqWrongStr('');
    setMsqMissedStr('');
    setShowModalPreview(false);
    setMyAnswer('');
    setCorrectAnswer('');
    setResultType('Wrong');
    setSelectedErrorTypes([]);
    setTimeSpentSeconds(60);
    setIdealTimeSeconds(35);
    setWhatWentWrong('');
    setCorrectSolution('');
    setBetterApproach('');
    setRuleToRemember('');
    setDifficulty('Medium');
    setStatus('New');
    setTagsStr('');
    setIsFullModalOpen(true);
  };

  const openEdit = (m: MistakeEntry) => {
    setEditingMistakeId(m.id || null);
    setSourceValue(m.paperId ? `paper:${m.paperId}` : m.mockId ? `mock:${m.mockId}` : 'unlinked');
    setResetReviewSchedule(false);
    setSectionId(m.sectionId);
    setTopic(m.topic);
    setSubtopic(m.subtopic || '');
    setQuestionNumber(m.questionNumber);
    setQuestionText(m.questionText);
    setQuestionImage(m.questionImage);
    setQuestionType(m.questionType || 'MCQ');
    setNatAnswer(m.natAnswer);
    if (typeof m.correctNatAnswer === 'number') {
      setCorrectNatMin(String(m.correctNatAnswer));
      setCorrectNatMax('');
    } else if (m.correctNatAnswer) {
      setCorrectNatMin(String(m.correctNatAnswer.min));
      setCorrectNatMax(String(m.correctNatAnswer.max));
    } else {
      setCorrectNatMin('');
      setCorrectNatMax('');
    }
    setNatTolerance(m.natTolerance);
    setMsqWrongStr((m.msqWrongOptions || []).join(', '));
    setMsqMissedStr((m.msqMissedOptions || []).join(', '));
    setShowModalPreview(false);
    setMyAnswer(m.myAnswer);
    setCorrectAnswer(m.correctAnswer);
    setResultType(m.resultType);
    setSelectedErrorTypes(m.errorTypes || []);
    setTimeSpentSeconds(m.timeSpentSeconds);
    setIdealTimeSeconds(m.idealTimeSeconds);
    setWhatWentWrong(m.whatWentWrong);
    setCorrectSolution(m.correctSolution);
    setBetterApproach(m.betterApproach);
    setRuleToRemember(m.ruleToRemember);
    setDifficulty(m.difficulty);
    setStatus(m.status);
    setTagsStr((m.tags || []).join(', '));
    setIsFullModalOpen(true);
  };

  const handleSaveFullMistake = async (e: React.FormEvent) => {
    e.preventDefault();
    const [sourceType, sourceRawId] = sourceValue.split(':');
    const sourceId = Number(sourceRawId);
    const mock = sourceType === 'mock' ? mocks.find((mk) => mk.id === sourceId) : undefined;
    const paper = sourceType === 'paper' ? papers.find((p) => p.id === sourceId) : undefined;
    const secConfig = settings.sections.find((s) => s.id === sectionId) || settings.sections[0];
    const todayStr = getTodayDateStr();
    const existing = editingMistakeId ? mistakes.find((m) => m.id === editingMistakeId) : undefined;
    const preserveReview = Boolean(existing && !resetReviewSchedule);
    const parsedTags = tagsStr.split(',').map((t) => t.trim()).filter(Boolean);

    let computedCorrectNat: { min: number; max: number } | number | undefined = undefined;
    if (correctNatMin !== '' && correctNatMax !== '') {
      computedCorrectNat = { min: Number(correctNatMin), max: Number(correctNatMax) };
    } else if (correctNatMin !== '') {
      computedCorrectNat = Number(correctNatMin);
    }
    const parsedMsqWrong = msqWrongStr.split(',').map((s) => s.trim()).filter(Boolean);
    const parsedMsqMissed = msqMissedStr.split(',').map((s) => s.trim()).filter(Boolean);

    const payload: Omit<MistakeEntry, 'id'> = {
      mockId: mock?.id,
      paperId: paper?.id,
      mockName: paper
        ? `${paper.examName} (${paper.year})`
        : mock?.name || 'External / unlinked',
      sectionId,
      sectionName: secConfig?.name || 'Quantitative Aptitude',
      topic: topic || secConfig?.topics[0] || 'General',
      subtopic: subtopic.trim() || undefined,
      questionNumber: Number(questionNumber) || 1,
      questionText: questionText.trim() || 'Question not transcribed.',
      questionImage,
      questionType,
      natAnswer: natAnswer !== undefined && !isNaN(natAnswer) ? natAnswer : undefined,
      correctNatAnswer: computedCorrectNat,
      natTolerance: natTolerance !== undefined && !isNaN(natTolerance) ? natTolerance : undefined,
      msqWrongOptions: parsedMsqWrong.length > 0 ? parsedMsqWrong : undefined,
      msqMissedOptions: parsedMsqMissed.length > 0 ? parsedMsqMissed : undefined,
      myAnswer: myAnswer.trim() || 'N/A',
      correctAnswer: correctAnswer.trim() || 'N/A',
      resultType,
      errorTypes: selectedErrorTypes.length > 0 ? selectedErrorTypes : ['Unclassified'],
      timeSpentSeconds: Number(timeSpentSeconds) || 60,
      idealTimeSeconds: Number(idealTimeSeconds) || 35,
      whatWentWrong: whatWentWrong.trim() || 'Mistake logged for revision.',
      correctSolution: correctSolution.trim() || 'Refer to standard solution.',
      betterApproach: betterApproach.trim() || 'Review core approach.',
      ruleToRemember: ruleToRemember.trim() || 'Carefully re-read problem statements.',
      difficulty,
      tags: parsedTags.length > 0 ? parsedTags : ['user-logged'],
      status: preserveReview ? existing!.status : status,
      interval: preserveReview ? existing!.interval : status === 'Mastered' ? 30 : 1,
      consecutiveCorrect: preserveReview ? existing!.consecutiveCorrect : status === 'Mastered' ? 3 : 0,
      lastReviewedAt: preserveReview ? existing!.lastReviewedAt : undefined,
      nextReviewDate: preserveReview ? existing!.nextReviewDate : todayStr,
      history: preserveReview ? existing!.history : [],
      createdAt: preserveReview ? existing!.createdAt : todayStr
    };

    if (editingMistakeId) {
      await db.mistakes.update(editingMistakeId, payload);
    } else {
      await db.mistakes.add(payload as MistakeEntry);
    }

    setIsFullModalOpen(false);
    onRefresh();
  };

  // Quick Add State
  const [quickSectionId, setQuickSectionId] = useState(settings.sections[0]?.id || 'quant');
  const [quickTopic, setQuickTopic] = useState(settings.sections[0]?.topics[0] || 'Percentage');
  const [quickErrorTypes, setQuickErrorTypes] = useState<string[]>([]);
  const [quickRule, setQuickRule] = useState('');
  const [quickQNo, setQuickQNo] = useState<number>(mistakes.length + 1);
  const [quickResultType, setQuickResultType] = useState<ResultType>('Wrong');

  const handleSaveQuickMistake = async (e: React.FormEvent) => {
    e.preventDefault();
    const mock = mocks[mocks.length - 1] || mocks[0];
    const secConfig = settings.sections.find((s) => s.id === quickSectionId) || settings.sections[0];
    const todayStr = getTodayDateStr();

    const payload: Omit<MistakeEntry, 'id'> = {
      mockId: mock?.id,
      mockName: mock?.name || 'External / unlinked',
      sectionId: quickSectionId,
      sectionName: secConfig?.name || 'Section',
      topic: quickTopic,
      questionNumber: Number(quickQNo) || 1,
      questionText: `Question #${quickQNo}`,
      myAnswer: 'Marked wrong',
      correctAnswer: 'Correct option',
      resultType: quickResultType,
      errorTypes: quickErrorTypes.length > 0 ? quickErrorTypes : ['Unclassified'],
      timeSpentSeconds: 60,
      idealTimeSeconds: 35,
      whatWentWrong: 'Quick logged.',
      correctSolution: 'To be elaborated.',
      betterApproach: 'To be elaborated.',
      ruleToRemember: quickRule.trim() || 'Review fundamental rule.',
      difficulty: 'Medium',
      tags: ['quick-logged'],
      status: 'New',
      interval: 1,
      consecutiveCorrect: 0,
      nextReviewDate: todayStr,
      history: [],
      createdAt: todayStr
    };

    await db.mistakes.add(payload as MistakeEntry);
    setQuickRule('');
    setQuickQNo((prev) => prev + 1);
    onRefresh();
  };

  const handleDelete = async (id: number) => {
    if (confirm('Delete this mistake record?')) {
      await db.mistakes.delete(id);
      onRefresh();
    }
  };

  const allTags = Array.from(new Set(mistakes.flatMap((m) => m.tags || []))).filter(Boolean);

  const filteredMistakes = mistakes
    .filter((m) => {
      if (filterSection !== 'all' && m.sectionId !== filterSection) return false;
      if (filterTopic !== 'all' && m.topic !== filterTopic) return false;
      if (filterErrorType !== 'all' && !m.errorTypes.includes(filterErrorType)) return false;
      if (filterQuestionType !== 'all') {
        const parsed = parseQuestionTextAndOptions(m.questionText);
        const qType = m.questionType || (parsed.options.length > 0 ? 'MCQ' : 'descriptive');
        if (qType !== filterQuestionType) return false;
      }
      if (filterStatus !== 'all' && m.status !== filterStatus) return false;
      if (filterResultType !== 'all' && m.resultType !== filterResultType) return false;
      if (filterSource !== 'all') {
        if (filterSource === 'unlinked') {
          if (m.mockId || m.paperId) return false;
        } else if (filterSource.startsWith('mock:')) {
          const id = Number(filterSource.replace('mock:', ''));
          if (m.mockId !== id) return false;
        } else if (filterSource.startsWith('paper:')) {
          const id = Number(filterSource.replace('paper:', ''));
          if (m.paperId !== id) return false;
        }
      }
      if (filterTag !== 'all' && !(m.tags || []).includes(filterTag)) return false;
      if (filterDateRange !== 'all') {
        const today = getTodayDateStr();
        if (filterDateRange === 'today' && m.createdAt !== today) return false;
        if (filterDateRange === '7days') {
          const d = new Date();
          d.setDate(d.getDate() - 7);
          const cut = d.toISOString().split('T')[0];
          if (m.createdAt < cut) return false;
        }
        if (filterDateRange === '30days') {
          const d = new Date();
          d.setDate(d.getDate() - 30);
          const cut = d.toISOString().split('T')[0];
          if (m.createdAt < cut) return false;
        }
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchText = (
          m.questionText +
          ' ' +
          m.ruleToRemember +
          ' ' +
          m.whatWentWrong +
          ' ' +
          m.topic +
          ' ' +
          m.mockName +
          ' ' +
          (m.subtopic || '') +
          ' ' +
          (m.tags || []).join(' ')
        ).toLowerCase();
        if (!matchText.includes(q)) return false;
      }

      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'date-desc') {
        return (b.createdAt || '').localeCompare(a.createdAt || '') || (b.id || 0) - (a.id || 0);
      }
      if (sortBy === 'date-asc') {
        return (a.createdAt || '').localeCompare(b.createdAt || '') || (a.id || 0) - (b.id || 0);
      }
      if (sortBy === 'time-desc') {
        return (b.timeSpentSeconds || 0) - (a.timeSpentSeconds || 0);
      }
      if (sortBy === 'diff') {
        const rank: Record<string, number> = { Hard: 3, Medium: 2, Easy: 1 };
        return (rank[b.difficulty] || 2) - (rank[a.difficulty] || 2);
      }
      return 0;
    });

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-display text-xl font-bold text-[var(--ink)] dark:text-[var(--text-main)]">
              Mistake Notebook
            </h2>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--action-primary)] font-bold">
              Error Intelligence
            </span>
          </div>
          <p className="text-xs text-[var(--text-muted)]">
            Log why you failed, capture the shortcut, and master rules. Press <kbd className="font-mono bg-[var(--bg-surface)] px-1 rounded border border-[var(--ink-border)]">Cmd+V</kbd> to paste screenshots.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => exportMistakesAsCsv(mistakes)}
            className="manga-btn px-3 py-2 rounded-xl bg-[var(--bg-surface)] text-[var(--ink)] dark:text-[var(--text-main)] font-bold text-xs flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5 text-[var(--text-muted)]" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={() => setIsQuickModalOpen(true)}
            className="manga-btn px-3 py-2 rounded-xl bg-[var(--peach)] text-[var(--ink)] font-bold text-xs flex items-center gap-1.5"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Quick-Add (20 in 5m)</span>
          </button>
          <button
            onClick={openFullAdd}
            className="manga-btn px-3.5 py-2 rounded-xl bg-[var(--sakura)] text-[var(--ink)] font-bold text-xs flex items-center gap-1.5 shadow-manga-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Log Mistake</span>
          </button>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="manga-panel p-4 bg-[var(--bg-panel)] rounded-2xl border-3 border-[var(--ink-border)] shadow-manga space-y-3.5">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search mistakes by keyword, rule, question, topic..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs pl-9 pr-3 py-2 rounded-xl bg-[var(--bg-surface)] border-2 border-[var(--ink-border)] text-[var(--text-main)] font-medium"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Filter by section"
              value={filterSection}
              onChange={(e) => {
                setFilterSection(e.target.value);
                setFilterTopic('all');
              }}
              className="text-xs px-2.5 py-1.5 rounded-xl bg-[var(--bg-surface)] border-2 border-[var(--ink-border)] font-bold"
            >
              <option value="all">All Sections</option>
              {settings.sections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>

            <select
              aria-label="Filter by topic"
              value={filterTopic}
              onChange={(e) => setFilterTopic(e.target.value)}
              className="text-xs px-2.5 py-1.5 rounded-xl bg-[var(--bg-surface)] border-2 border-[var(--ink-border)] font-bold"
            >
              <option value="all">All Topics</option>
              {Array.from(new Set(settings.sections.flatMap((s) => s.topics))).map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>

            <select
              aria-label="Filter by error type"
              value={filterErrorType}
              onChange={(e) => setFilterErrorType(e.target.value)}
              className="text-xs px-2.5 py-1.5 rounded-xl bg-[var(--bg-surface)] border-2 border-[var(--ink-border)] font-bold"
            >
              <option value="all">All Error Types</option>
              {allAvailableErrorTypes.map((et) => (
                <option key={et} value={et}>{et}</option>
              ))}
              {!allAvailableErrorTypes.includes('Unclassified') && (
                <option value="Unclassified">Unclassified</option>
              )}
            </select>

            <select
              aria-label="Filter by question type"
              value={filterQuestionType}
              onChange={(e) => setFilterQuestionType(e.target.value)}
              className="text-xs px-2.5 py-1.5 rounded-xl bg-[var(--bg-surface)] border-2 border-[var(--ink-border)] font-bold"
            >
              <option value="all">All Question Types</option>
              <option value="MCQ">MCQ</option>
              <option value="MSQ">MSQ</option>
              <option value="NAT">NAT</option>
              <option value="descriptive">Descriptive</option>
            </select>

            <select
              aria-label="Filter by result type"
              value={filterResultType}
              onChange={(e) => setFilterResultType(e.target.value)}
              className="text-xs px-2.5 py-1.5 rounded-xl bg-[var(--bg-surface)] border-2 border-[var(--ink-border)] font-bold"
            >
              <option value="all">All Results</option>
              <option value="Wrong">Wrong</option>
              <option value="Unattempted">Unattempted</option>
              <option value="Marked for Review">Marked for Review</option>
            </select>

            <select
              aria-label="Filter by status"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="text-xs px-2.5 py-1.5 rounded-xl bg-[var(--bg-surface)] border-2 border-[var(--ink-border)] font-bold"
            >
              <option value="all">All Statuses</option>
              <option value="New">New</option>
              <option value="Reviewing">Reviewing</option>
              <option value="Mastered">Mastered (Defeated)</option>
            </select>

            <select
              aria-label="Filter by source"
              value={filterSource}
              onChange={(e) => setFilterSource(e.target.value)}
              className="text-xs px-2.5 py-1.5 rounded-xl bg-[var(--bg-surface)] border-2 border-[var(--ink-border)] font-bold"
            >
              <option value="all">All Sources</option>
              <option value="unlinked">External / Unlinked</option>
              {mocks.map((mk) => (
                <option key={`m-${mk.id}`} value={`mock:${mk.id}`}>Mock: {mk.name}</option>
              ))}
              {papers.map((p) => (
                <option key={`p-${p.id}`} value={`paper:${p.id}`}>Paper: {p.examName} ({p.year})</option>
              ))}
            </select>

            <select
              aria-label="Filter by date range"
              value={filterDateRange}
              onChange={(e) => setFilterDateRange(e.target.value as any)}
              className="text-xs px-2.5 py-1.5 rounded-xl bg-[var(--bg-surface)] border-2 border-[var(--ink-border)] font-bold"
            >
              <option value="all">All Dates</option>
              <option value="today">Today</option>
              <option value="7days">Last 7 Days</option>
              <option value="30days">Last 30 Days</option>
            </select>

            {allTags.length > 0 && (
              <select
                aria-label="Filter by tag"
                value={filterTag}
                onChange={(e) => setFilterTag(e.target.value)}
                className="text-xs px-2.5 py-1.5 rounded-xl bg-[var(--bg-surface)] border-2 border-[var(--ink-border)] font-bold"
              >
                <option value="all">All Tags</option>
                {allTags.map((tag) => (
                  <option key={tag} value={tag}>#{tag}</option>
                ))}
              </select>
            )}

            <select
              aria-label="Sort mistakes"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="text-xs px-2.5 py-1.5 rounded-xl bg-[var(--peach)]/30 border-2 border-[var(--ink-border)] font-bold text-[var(--ink)] dark:text-[var(--text-main)]"
            >
              <option value="date-desc">Newest First</option>
              <option value="date-asc">Oldest First</option>
              <option value="time-desc">Time Spent (High to Low)</option>
              <option value="diff">Difficulty (Hard to Easy)</option>
            </select>
          </div>
        </div>

        {/* Interactive Clickable Section Pills */}
        <div className="space-y-1.5 pt-1 border-t border-[var(--ink-border)]/30">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Click Section to Filter:
            </span>
            {(filterSection !== 'all' || filterStatus !== 'all' || filterResultType !== 'all' || filterErrorType !== 'all' || filterTopic !== 'all' || filterTag !== 'all' || filterQuestionType !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setFilterSection('all');
                  setFilterTopic('all');
                  setFilterErrorType('all');
                  setFilterQuestionType('all');
                  setFilterStatus('all');
                  setFilterResultType('all');
                  setFilterTag('all');
                }}
                className="text-[11px] font-bold text-[var(--sakura)] hover:underline"
              >
                Reset All Filters
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => {
                setFilterSection('all');
                setFilterTopic('all');
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border-2 cursor-pointer ${
                filterSection === 'all'
                  ? 'bg-[var(--sakura)] text-[var(--ink)] border-[var(--ink-border)] shadow-manga-sm scale-[1.02]'
                  : 'bg-[var(--bg-surface)] text-[var(--text-muted)] border-[var(--ink-border)]/50 hover:border-[var(--ink-border)] hover:text-[var(--text-main)]'
              }`}
            >
              All Sections ({mistakes.length})
            </button>
            {settings.sections.map((s) => {
              const count = mistakes.filter((m) => m.sectionId === s.id).length;
              const isActive = filterSection === s.id;
              return (
                <button
                  type="button"
                  key={s.id}
                  onClick={() => {
                    setFilterSection(isActive ? 'all' : s.id);
                    setFilterTopic('all');
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border-2 flex items-center gap-1.5 cursor-pointer ${
                    isActive
                      ? 'bg-[var(--peach)] text-[var(--ink)] border-[var(--ink-border)] shadow-manga-sm scale-[1.02]'
                      : 'bg-[var(--bg-surface)] text-[var(--text-muted)] border-[var(--ink-border)]/50 hover:border-[var(--ink-border)] hover:text-[var(--text-main)]'
                  }`}
                >
                  <span>{s.name}</span>
                  <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-md ${isActive ? 'bg-[var(--ink)] text-[var(--bg-panel)] font-bold' : 'bg-[var(--bg-panel)]'}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Clickable Status & Result Badges */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-[var(--ink-border)]/20">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Status:</span>
          {(['all', 'New', 'Reviewing', 'Mastered'] as const).map((st) => {
            const isActive = filterStatus === st;
            return (
              <button
                type="button"
                key={st}
                onClick={() => setFilterStatus(st)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[var(--ink)] text-[var(--bg-panel)] border-[var(--ink-border)] shadow-sm'
                    : 'bg-[var(--bg-surface)] text-[var(--text-muted)] border-[var(--ink-border)]/40 hover:border-[var(--ink-border)]'
                }`}
              >
                {st === 'all' ? 'All' : st === 'Mastered' ? 'Mastered (Defeated)' : st}
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)] pt-1 border-t border-[var(--ink-border)]/40 font-mono">
          <span>Showing {filteredMistakes.length} of {mistakes.length} mistakes</span>
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="text-[var(--sakura)] font-bold hover:underline">
              Clear search
            </button>
          )}
        </div>
      </div>

      {/* Mistake Entries List */}
      {filteredMistakes.length === 0 ? (
        <div className="manga-panel p-10 text-center bg-[var(--bg-surface)] rounded-2xl border-3 border-[var(--ink-border)] shadow-manga space-y-4">
          <Mascot mood="reading" size="lg" className="mx-auto" />
          <div className="space-y-1">
            <h3 className="font-display text-base font-bold text-[var(--ink)] dark:text-[var(--text-main)]">
              No Mistakes Found
            </h3>
            <p className="text-xs text-[var(--text-muted)] max-w-sm mx-auto">
              Your notebook has no mistakes recorded matching this criteria. Log questions you missed in your mocks to build your personal revision cheat sheet!
            </p>
          </div>
          <button
            onClick={openFullAdd}
            className="manga-btn px-5 py-2.5 rounded-xl bg-[var(--sakura)] text-[var(--ink)] font-bold text-xs inline-flex items-center gap-1.5 shadow-manga-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Log a Mistake</span>
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredMistakes.map((m) => {
            const isCollapsed = m.id ? collapsedMistakeIds.has(m.id) : false;
            const parsedQuestion = parseQuestionTextAndOptions(m.questionText);

            return (
              <div
                key={m.id}
                className="manga-panel p-5 bg-[var(--bg-panel)] rounded-2xl border-3 border-[var(--ink-border)] shadow-manga space-y-3.5 transition-all"
              >
                {/* Clickable Header with Section, Topic, Status, and Controls */}
                <div
                  className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b-2 border-[var(--ink-border)] pb-3 cursor-pointer select-none"
                  onClick={() => {
                    if (!m.id) return;
                    setCollapsedMistakeIds((prev) => {
                      const next = new Set(prev);
                      if (next.has(m.id!)) next.delete(m.id!);
                      else next.add(m.id!);
                      return next;
                    });
                  }}
                >
                  <div className="space-y-1 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Clickable Section Badge */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setFilterSection(m.sectionId);
                          setFilterTopic('all');
                        }}
                        className="px-2.5 py-0.5 rounded-md bg-[var(--sakura)] text-[var(--ink)] border border-[var(--ink-border)] text-xs font-bold hover:brightness-105 hover:scale-105 transition-all cursor-pointer"
                        title={`Filter by ${m.sectionName}`}
                      >
                        {m.sectionName}
                      </button>

                      {/* Clickable Topic Badge */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setFilterSection(m.sectionId);
                          setFilterTopic(m.topic);
                        }}
                        className="font-display text-xs font-bold text-[var(--ink)] dark:text-[var(--text-main)] hover:underline cursor-pointer"
                        title={`Filter by ${m.topic}`}
                      >
                        {m.topic} (Q#{m.questionNumber})
                      </button>

                      {/* Clickable Status Badge */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setFilterStatus(m.status);
                        }}
                        className={`text-[10px] font-bold px-2 py-0.5 rounded border border-[var(--ink-border)] hover:scale-105 transition-all cursor-pointer ${
                          m.status === 'Mastered'
                            ? 'bg-[var(--mint)] text-[var(--ink)]'
                            : 'bg-[var(--peach)] text-[var(--ink)]'
                        }`}
                        title={`Filter by status ${m.status}`}
                      >
                        {m.status === 'Mastered' ? 'Defeated (Mastered)' : `${m.status} (${m.interval}d)`}
                      </button>
                    </div>

                    <p className="text-[11px] text-[var(--text-muted)] font-mono">
                      From: {m.mockId || m.paperId ? m.mockName : 'External / unlinked'} • Spent {m.timeSpentSeconds}s (Ideal: {m.idealTimeSeconds}s)
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-xs text-[var(--text-muted)] p-1 hover:text-[var(--text-main)]">
                      {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openEdit(m);
                      }}
                      className="p-1.5 rounded-lg border border-[var(--ink-border)] bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer"
                      title="Edit Mistake"
                      aria-label="Edit Mistake"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        m.id && handleDelete(m.id);
                      }}
                      className="p-1.5 rounded-lg border border-[var(--ink-border)] bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-rose-600 cursor-pointer"
                      title="Delete Mistake"
                      aria-label="Delete Mistake"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Error Types Badges (Always Clickable) */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-bold text-[var(--text-muted)]">Cause:</span>
                  {m.errorTypes.map((err) => (
                    <button
                      type="button"
                      key={err}
                      onClick={() => setFilterErrorType(err)}
                      className="text-[11px] px-2 py-0.5 rounded-md bg-[var(--bg-surface)] border border-[var(--ink-border)] font-bold text-[var(--ink)] dark:text-[var(--text-main)] hover:bg-[var(--sakura)] hover:text-[var(--ink)] hover:scale-105 transition-all cursor-pointer"
                      title={`Filter by error: ${err}`}
                    >
                      {err}
                    </button>
                  ))}
                  {m.tags && m.tags.map((tag) => (
                    <button
                      type="button"
                      key={tag}
                      onClick={() => setFilterTag(tag)}
                      className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--bg-surface)] border border-[var(--ink-border)]/50 text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer"
                    >
                      #{tag}
                    </button>
                  ))}
                </div>

                {!isCollapsed && (
                  <>
                    {/* Question Statement, Options, Diagram, Formulas & Solution rendered with QuestionRenderer */}
                    <div className="p-4 rounded-xl bg-[var(--bg-surface)] border-2 border-[var(--ink-border)] text-xs space-y-3">
                      <QuestionRenderer
                        text={parsedQuestion.prompt}
                        options={parsedQuestion.options.length > 0 ? parsedQuestion.options.map((o) => o.text) : undefined}
                        selectedOption={
                          m.questionType === 'MSQ' && m.msqSelectedOptions && m.msqSelectedOptions.length > 0
                            ? m.msqSelectedOptions
                            : m.myAnswer
                        }
                        correctOption={
                          m.questionType === 'MSQ' && m.msqCorrectOptions && m.msqCorrectOptions.length > 0
                            ? m.msqCorrectOptions
                            : m.correctAnswer
                        }
                        questionType={m.questionType || (parsedQuestion.options.length > 0 ? 'MCQ' : 'descriptive')}
                        natAnswer={m.natAnswer !== undefined ? m.natAnswer : (!isNaN(Number(m.myAnswer)) ? Number(m.myAnswer) : undefined)}
                        correctNatAnswer={m.correctNatAnswer}
                        natTolerance={m.natTolerance}
                        msqWrongOptions={m.msqWrongOptions}
                        msqMissedOptions={m.msqMissedOptions}
                        image={m.questionImage}
                        solution={m.correctSolution}
                        showSolution={true}
                      />

                      {/* Answer Badges */}
                      <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-[var(--ink-border)]/40 text-xs font-mono">
                        <span className="px-2.5 py-1 rounded-lg bg-rose-500/10 border border-rose-500/40 text-rose-600 dark:text-rose-400 font-bold">
                          My Answer: {m.myAnswer}
                        </span>
                        <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/40 text-emerald-600 dark:text-emerald-400 font-bold">
                          Correct Answer: {m.correctAnswer}
                        </span>
                      </div>
                    </div>

                    {/* Beautified Solution & Analysis Breakdown */}
                    <div className="space-y-2.5 text-xs">
                      {/* What Went Wrong Card */}
                      <div className="p-3.5 rounded-xl bg-amber-500/10 dark:bg-amber-950/30 border-2 border-amber-500/40 space-y-1">
                        <div className="flex items-center gap-1.5 font-bold text-amber-700 dark:text-amber-300">
                          <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                          <span className="uppercase tracking-wider text-[11px]">What Went Wrong (Root Cause)</span>
                        </div>
                        <div className="text-[var(--text-main)] font-medium leading-relaxed pl-5.5">
                          {renderFormattedContent(m.whatWentWrong)}
                        </div>
                      </div>

                      {m.betterApproach && m.betterApproach !== m.correctSolution && (
                        <div className="p-3.5 rounded-xl bg-indigo-500/10 dark:bg-indigo-950/30 border-2 border-indigo-500/40 space-y-1">
                          <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                            <Zap className="w-3.5 h-3.5 text-indigo-500" /> Speed Shortcut / Alternative Approach:
                          </span>
                          <div className="text-[var(--text-main)] italic pl-4 border-l-2 border-indigo-400">
                            {renderFormattedContent(m.betterApproach)}
                          </div>
                        </div>
                      )}

                      {/* Rule to Remember Sticker */}
                      {m.ruleToRemember && (
                        <div className="p-3 rounded-xl bg-gradient-to-r from-[var(--sakura)]/20 via-[var(--peach)]/25 to-[var(--mint)]/20 border-2 border-[var(--ink-border)] shadow-sm flex items-start gap-2.5">
                          <span className="text-base select-none">⚡</span>
                          <div className="text-xs">
                            <span className="font-bold text-[var(--ink)] dark:text-[var(--text-main)] uppercase tracking-wide block text-[10.5px]">
                              Rule to Remember:
                            </span>
                            <span className="font-semibold text-[var(--ink)] dark:text-[var(--text-main)]">
                              {renderFormattedContent(m.ruleToRemember)}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Quick Add Modal */}
      {isQuickModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-[var(--bg-panel)] p-5 rounded-2xl border-3 border-[var(--ink-border)] max-w-lg w-full space-y-4 shadow-manga-lg my-6">
            <div className="flex items-center justify-between border-b-2 border-[var(--ink-border)] pb-3">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-[var(--peach)]" />
                <h3 className="font-display text-sm font-bold text-[var(--ink)] dark:text-[var(--text-main)]">
                  Quick Log Mistake
                </h3>
              </div>
              <button
                onClick={() => {
                  setIsQuickModalOpen(false);
                  onCloseQuickAddDirectly?.();
                }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveQuickMistake} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold mb-1">Section</label>
                  <select
                    value={quickSectionId}
                    onChange={(e) => {
                      setQuickSectionId(e.target.value);
                      const sec = settings.sections.find((s) => s.id === e.target.value);
                      if (sec?.topics?.[0]) setQuickTopic(sec.topics[0]);
                    }}
                    className="w-full p-2 rounded-lg bg-[var(--bg-surface)] border-2 border-[var(--ink-border)] font-semibold"
                  >
                    {settings.sections.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold mb-1">Topic</label>
                  <select
                    value={quickTopic}
                    onChange={(e) => setQuickTopic(e.target.value)}
                    className="w-full p-2 rounded-lg bg-[var(--bg-surface)] border-2 border-[var(--ink-border)] font-semibold"
                  >
                    {(settings.sections.find((s) => s.id === quickSectionId)?.topics || []).map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold mb-1">
                  Root-Cause Error Types ({quickErrorTypes.length > 0 ? quickErrorTypes.join(', ') : 'Unclassified'})
                </label>
                <div className="flex flex-wrap gap-1.5 p-2 rounded-lg bg-[var(--bg-surface)] border-2 border-[var(--ink-border)] max-h-28 overflow-y-auto">
                  {allAvailableErrorTypes.map((et) => {
                    const isChecked = quickErrorTypes.includes(et);
                    return (
                      <button
                        type="button"
                        key={et}
                        onClick={() => {
                          setQuickErrorTypes((prev) =>
                            isChecked ? prev.filter((t) => t !== et) : [...prev, et]
                          );
                        }}
                        className={`px-2 py-0.5 rounded text-[11px] font-bold border transition-all ${
                          isChecked
                            ? 'bg-[var(--sakura)] text-[var(--ink)] border-[var(--ink-border)] shadow-sm'
                            : 'bg-[var(--bg-panel)] text-[var(--text-muted)] border-[var(--ink-border)]/50 hover:border-[var(--ink-border)]'
                        }`}
                      >
                        {isChecked ? '✓ ' : '+ '}{et}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block font-bold mb-1">One-Liner Rule to Remember</label>
                <input
                  type="text"
                  value={quickRule}
                  onChange={(e) => setQuickRule(e.target.value)}
                  placeholder="e.g. In successive discounts apply AB rule: A + B - AB/100"
                  className="w-full p-2 rounded-lg bg-[var(--bg-surface)] border-2 border-[var(--ink-border)] font-semibold"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t-2 border-[var(--ink-border)]">
                <button
                  type="button"
                  onClick={() => {
                    setIsQuickModalOpen(false);
                    onCloseQuickAddDirectly?.();
                  }}
                  className="px-4 py-1.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--ink-border)] font-bold text-xs"
                >
                  Close (Esc)
                </button>
                <button
                  type="submit"
                  className="manga-btn px-4 py-1.5 rounded-lg bg-[var(--peach)] text-[var(--ink)] font-bold text-xs flex items-center gap-1.5"
                >
                  <span>Log & Next</span>
                  <kbd className="text-[10px] font-mono px-1 py-0.2 rounded bg-black/15 font-bold">↵</kbd>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detailed Mistake Modal with Cmd+V paste */}
      {isFullModalOpen && (
        <div
          onPaste={handlePasteEvent}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto"
        >
          <div className="bg-[var(--bg-panel)] p-6 rounded-2xl border-3 border-[var(--ink-border)] max-w-3xl w-full space-y-4 shadow-manga-lg my-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b-2 border-[var(--ink-border)] pb-3">
              <div>
                <h3 className="font-display text-sm font-bold text-[var(--ink)] dark:text-[var(--text-main)]">
                  {editingMistakeId ? 'Edit Mistake Entry' : 'Log Detailed Mistake'}
                </h3>
                <p className="text-[11px] text-[var(--text-muted)]">
                  Press <kbd className="font-mono bg-[var(--bg-surface)] px-1 rounded border border-[var(--ink-border)]">Cmd+V</kbd> anywhere to paste screenshot.
                </p>
              </div>
              <button onClick={() => setIsFullModalOpen(false)}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveFullMistake} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold mb-1">Linked Source</label>
                <select
                  aria-label="Mistake source"
                  value={sourceValue}
                  onChange={(e) => setSourceValue(e.target.value)}
                  className="w-full p-2 rounded-lg bg-[var(--bg-surface)] border-2 border-[var(--ink-border)] font-semibold"
                >
                  <option value="unlinked">External / unlinked</option>
                  {mocks.map((mock) => (
                    <option key={`mock-${mock.id}`} value={`mock:${mock.id}`}>
                      Mock: {mock.name}
                    </option>
                  ))}
                  {papers.map((paper) => (
                    <option key={`paper-${paper.id}`} value={`paper:${paper.id}`}>
                      Paper: {paper.examName} ({paper.year})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block font-bold mb-1">Section</label>
                  <select
                    value={sectionId}
                    onChange={(e) => setSectionId(e.target.value)}
                    className="w-full p-2 rounded-lg bg-[var(--bg-surface)] border-2 border-[var(--ink-border)] font-semibold"
                  >
                    {settings.sections.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold mb-1">Topic</label>
                  <select
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    className="w-full p-2 rounded-lg bg-[var(--bg-surface)] border-2 border-[var(--ink-border)] font-semibold"
                  >
                    {availableTopics.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold mb-1">Subtopic (Optional)</label>
                  <input
                    type="text"
                    aria-label="Subtopic"
                    value={subtopic}
                    onChange={(e) => setSubtopic(e.target.value)}
                    placeholder="e.g. Boats & Streams"
                    className="w-full p-2 rounded-lg bg-[var(--bg-surface)] border-2 border-[var(--ink-border)] font-semibold"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">Question Number</label>
                  <input
                    type="number"
                    aria-label="Question Number"
                    value={questionNumber}
                    onChange={(e) => setQuestionNumber(Number(e.target.value) || 1)}
                    className="w-full p-2 rounded-lg bg-[var(--bg-surface)] border-2 border-[var(--ink-border)] font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block font-bold mb-1">Question Type</label>
                  <select
                    aria-label="Question Type"
                    value={questionType}
                    onChange={(e) => setQuestionType(e.target.value as QuestionType)}
                    className="w-full p-2 rounded-lg bg-[var(--bg-surface)] border-2 border-[var(--ink-border)] font-semibold"
                  >
                    <option value="MCQ">MCQ (Single Choice)</option>
                    <option value="MSQ">MSQ (Multiple Select)</option>
                    <option value="NAT">NAT (Numerical Answer)</option>
                    <option value="descriptive">Descriptive / Subjective</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold mb-1">Result Type</label>
                  <select
                    aria-label="Result Type"
                    value={resultType}
                    onChange={(e) => setResultType(e.target.value as ResultType)}
                    className="w-full p-2 rounded-lg bg-[var(--bg-surface)] border-2 border-[var(--ink-border)] font-semibold"
                  >
                    <option value="Wrong">Wrong</option>
                    <option value="Unattempted">Unattempted</option>
                    <option value="Marked for Review">Marked for Review</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold mb-1">Difficulty</label>
                  <select
                    aria-label="Difficulty"
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value as Difficulty)}
                    className="w-full p-2 rounded-lg bg-[var(--bg-surface)] border-2 border-[var(--ink-border)] font-semibold"
                  >
                    <option value="Easy">Easy</option>
                    <option value="Medium">Medium</option>
                    <option value="Hard">Hard</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold mb-1">Status</label>
                  <select
                    aria-label="Status"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as MistakeStatus)}
                    className="w-full p-2 rounded-lg bg-[var(--bg-surface)] border-2 border-[var(--ink-border)] font-semibold"
                  >
                    <option value="New">New</option>
                    <option value="Reviewing">Reviewing</option>
                    <option value="Mastered">Mastered (Defeated)</option>
                  </select>
                </div>
              </div>

              {/* Conditional MSQ Configuration */}
              {questionType === 'MSQ' && (
                <div className="p-3 rounded-xl bg-amber-500/10 border-2 border-amber-500/30 space-y-2">
                  <div className="flex items-center gap-1.5 font-bold text-amber-600 dark:text-amber-300 text-xs">
                    <AlertCircle className="w-4 h-4 text-amber-500" />
                    <span>MSQ Option Diagnostics</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold mb-1 text-[11px]">Wrong Options Picked (Comma-separated)</label>
                      <input
                        type="text"
                        value={msqWrongStr}
                        onChange={(e) => setMsqWrongStr(e.target.value)}
                        placeholder="e.g. Option B, Option D"
                        className="w-full p-2 rounded-lg bg-[var(--bg-surface)] border-2 border-[var(--ink-border)] font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block font-bold mb-1 text-[11px]">Correct Options Missed (Comma-separated)</label>
                      <input
                        type="text"
                        value={msqMissedStr}
                        onChange={(e) => setMsqMissedStr(e.target.value)}
                        placeholder="e.g. Option A"
                        className="w-full p-2 rounded-lg bg-[var(--bg-surface)] border-2 border-[var(--ink-border)] font-semibold"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Conditional NAT Configuration */}
              {questionType === 'NAT' && (
                <div className="p-3 rounded-xl bg-sky-500/10 border-2 border-sky-500/30 space-y-2">
                  <div className="flex items-center gap-1.5 font-bold text-sky-600 dark:text-sky-300 text-xs">
                    <Sparkles className="w-4 h-4 text-sky-500" />
                    <span>NAT Tolerance & Range Setup</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block font-bold mb-1 text-[11px]">Your NAT Answer</label>
                      <input
                        type="number"
                        step="any"
                        value={natAnswer !== undefined ? natAnswer : ''}
                        onChange={(e) => setNatAnswer(e.target.value !== '' ? Number(e.target.value) : undefined)}
                        placeholder="e.g. 45.2"
                        className="w-full p-2 rounded-lg bg-[var(--bg-surface)] border-2 border-[var(--ink-border)] font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block font-bold mb-1 text-[11px]">Target Answer / Min</label>
                      <input
                        type="number"
                        step="any"
                        value={correctNatMin}
                        onChange={(e) => setCorrectNatMin(e.target.value)}
                        placeholder="e.g. 45.0"
                        className="w-full p-2 rounded-lg bg-[var(--bg-surface)] border-2 border-[var(--ink-border)] font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block font-bold mb-1 text-[11px]">Range Max (Optional)</label>
                      <input
                        type="number"
                        step="any"
                        value={correctNatMax}
                        onChange={(e) => setCorrectNatMax(e.target.value)}
                        placeholder="e.g. 46.0"
                        className="w-full p-2 rounded-lg bg-[var(--bg-surface)] border-2 border-[var(--ink-border)] font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block font-bold mb-1 text-[11px]">Tolerance (±)</label>
                      <input
                        type="number"
                        step="any"
                        value={natTolerance !== undefined ? natTolerance : ''}
                        onChange={(e) => setNatTolerance(e.target.value !== '' ? Number(e.target.value) : undefined)}
                        placeholder="e.g. 0.5"
                        className="w-full p-2 rounded-lg bg-[var(--bg-surface)] border-2 border-[var(--ink-border)] font-semibold"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold mb-1">Time Spent (Seconds)</label>
                  <input
                    type="number"
                    aria-label="Time Spent"
                    value={timeSpentSeconds}
                    onChange={(e) => setTimeSpentSeconds(Number(e.target.value) || 0)}
                    className="w-full p-2 rounded-lg bg-[var(--bg-surface)] border-2 border-[var(--ink-border)] font-semibold"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">Ideal Time (Seconds)</label>
                  <input
                    type="number"
                    aria-label="Ideal Time"
                    value={idealTimeSeconds}
                    onChange={(e) => setIdealTimeSeconds(Number(e.target.value) || 0)}
                    className="w-full p-2 rounded-lg bg-[var(--bg-surface)] border-2 border-[var(--ink-border)] font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold mb-1">
                  Root-Cause Error Types ({selectedErrorTypes.length > 0 ? selectedErrorTypes.join(', ') : 'Unclassified'})
                </label>
                <div className="flex flex-wrap gap-2 p-2.5 rounded-xl bg-[var(--bg-surface)] border-2 border-[var(--ink-border)] max-h-48 overflow-y-auto">
                  {allAvailableErrorTypes.map((et) => {
                    const isChecked = selectedErrorTypes.includes(et);
                    return (
                      <button
                        type="button"
                        key={et}
                        onClick={() => {
                          setSelectedErrorTypes((prev) =>
                            isChecked ? prev.filter((t) => t !== et) : [...prev, et]
                          );
                        }}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all ${
                          isChecked
                            ? 'bg-[var(--sakura)] text-[var(--ink)] border-[var(--ink-border)] shadow-sm'
                            : 'bg-[var(--bg-panel)] text-[var(--text-muted)] border-[var(--ink-border)]/50 hover:border-[var(--ink-border)]'
                        }`}
                      >
                        {isChecked ? '✓ ' : '+ '}{et}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold">Question Statement & Screenshot</label>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setShowModalPreview(!showModalPreview)}
                      className="text-[11px] text-[var(--action-primary)] font-bold hover:underline cursor-pointer"
                    >
                      {showModalPreview ? 'Hide Live Preview' : 'Show Live Preview'}
                    </button>
                    <label className="text-[11px] text-[var(--sakura)] font-bold cursor-pointer hover:underline flex items-center gap-1">
                      <ImageIcon className="w-3.5 h-3.5" />
                      <span>Attach Screenshot File</span>
                      <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                    </label>
                  </div>
                </div>
                <textarea
                  rows={3}
                  value={questionText}
                  onChange={(e) => setQuestionText(e.target.value)}
                  placeholder="Type question statement or paste screenshot with Cmd+V..."
                  className="w-full p-2.5 rounded-xl bg-[var(--bg-surface)] border-2 border-[var(--ink-border)] font-medium"
                />
                <ScreenshotInput value={questionImage} onChange={setQuestionImage} />

                {/* Optional Live Preview inside Modal */}
                {showModalPreview && (
                  <div className="mt-3 p-3.5 rounded-xl border-2 border-[var(--ink-border)] bg-[var(--bg-surface)]">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">
                      Live Question Preview:
                    </div>
                    <QuestionRenderer
                      text={questionText || 'Question statement preview...'}
                      questionType={questionType}
                      image={questionImage}
                      natAnswer={natAnswer}
                      correctNatAnswer={
                        correctNatMin !== ''
                          ? correctNatMax !== ''
                            ? { min: Number(correctNatMin), max: Number(correctNatMax) }
                            : Number(correctNatMin)
                          : undefined
                      }
                      natTolerance={natTolerance}
                      msqWrongOptions={msqWrongStr.split(',').map((s) => s.trim()).filter(Boolean)}
                      msqMissedOptions={msqMissedStr.split(',').map((s) => s.trim()).filter(Boolean)}
                      solution={correctSolution}
                      showSolution={true}
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold mb-1">My Answer</label>
                  <input
                    type="text"
                    value={myAnswer}
                    onChange={(e) => setMyAnswer(e.target.value)}
                    placeholder="e.g. Option B (45 km/h)"
                    className="w-full p-2 rounded-lg bg-[var(--bg-surface)] border-2 border-[var(--ink-border)] font-semibold"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">Correct Answer</label>
                  <input
                    type="text"
                    value={correctAnswer}
                    onChange={(e) => setCorrectAnswer(e.target.value)}
                    placeholder="e.g. Option C (54 km/h)"
                    className="w-full p-2 rounded-lg bg-[var(--bg-surface)] border-2 border-[var(--ink-border)] font-semibold"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div>
                  <label className="block font-bold mb-1">What Went Wrong (Plain Words)</label>
                  <textarea
                    rows={2}
                    value={whatWentWrong}
                    onChange={(e) => setWhatWentWrong(e.target.value)}
                    placeholder="e.g. Misread 72 km/h without converting to m/s by 5/18."
                    className="w-full p-2 rounded-lg bg-[var(--bg-surface)] border-2 border-[var(--ink-border)]"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">Better Approach / Shortcut</label>
                  <textarea
                    rows={2}
                    value={betterApproach}
                    onChange={(e) => setBetterApproach(e.target.value)}
                    placeholder="e.g. 72 * 5/18 = 20 m/s. 20 * 15 = 300m."
                    className="w-full p-2 rounded-lg bg-[var(--bg-surface)] border-2 border-[var(--ink-border)]"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">Rule to Remember (Feeds Cheat Sheet)</label>
                  <input
                    type="text"
                    value={ruleToRemember}
                    onChange={(e) => setRuleToRemember(e.target.value)}
                    placeholder="e.g. Speed in km/h must be converted to m/s (x 5/18) before distance equations."
                    className="w-full p-2.5 rounded-lg bg-[var(--peach)]/30 border-2 border-[var(--ink-border)] font-bold text-[var(--ink)] dark:text-[var(--text-main)]"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">Tags (Comma-separated)</label>
                  <input
                    type="text"
                    aria-label="Tags"
                    value={tagsStr}
                    onChange={(e) => setTagsStr(e.target.value)}
                    placeholder="e.g. speed-time, algebra, silly-mistake"
                    className="w-full p-2 rounded-lg bg-[var(--bg-surface)] border-2 border-[var(--ink-border)] font-medium"
                  />
                </div>
              </div>

              {editingMistakeId && (
                <label className="flex items-center gap-2 p-2.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--ink-border)]">
                  <input
                    type="checkbox"
                    aria-label="Reset review schedule"
                    checked={resetReviewSchedule}
                    onChange={(e) => setResetReviewSchedule(e.target.checked)}
                    className="accent-[var(--sakura)]"
                  />
                  <span className="font-semibold">Reset review schedule and history</span>
                </label>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t-2 border-[var(--ink-border)]">
                <button
                  type="button"
                  onClick={() => setIsFullModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--ink-border)] font-bold text-xs"
                >
                  Cancel (Esc)
                </button>
                <button
                  type="submit"
                  className="manga-btn px-5 py-2 rounded-xl bg-[var(--sakura)] text-[var(--ink)] font-bold text-xs flex items-center gap-1.5"
                >
                  <span>Save Mistake</span>
                  <kbd className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-black/15 font-bold">⌘↵</kbd>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Image Preview Modal */}
      {previewImage && (
        <div
          onClick={() => setPreviewImage(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 cursor-pointer"
        >
          <div className="bg-[var(--bg-panel)] p-2 rounded-2xl border-3 border-[var(--ink-border)] max-w-4xl max-h-[85vh]">
            <img src={previewImage} alt="Enlarged Diagram" className="max-w-full max-h-[80vh] object-contain rounded-xl" />
          </div>
        </div>
      )}
    </div>
  );
};
