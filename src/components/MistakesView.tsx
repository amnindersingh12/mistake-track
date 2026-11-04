import React, { useState, useEffect } from 'react';
import { MistakeEntry, MockTest, ExamSettings, ResultType, Difficulty, MistakeStatus } from '../types';
import { db } from '../db/db';
import { exportMistakesAsCsv } from '../utils/exportImport';
import { Mascot } from './Mascot';
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
  AlertCircle
} from 'lucide-react';

interface MistakesViewProps {
  mistakes: MistakeEntry[];
  mocks: MockTest[];
  settings: ExamSettings;
  onRefresh: () => void;
  isQuickAddOpenDirectly?: boolean;
  onCloseQuickAddDirectly?: () => void;
  initialMockFilter?: number;
}

export const MistakesView: React.FC<MistakesViewProps> = ({
  mistakes,
  mocks,
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
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterResultType, setFilterResultType] = useState<string>('all');
  const [filterMockId, setFilterMockId] = useState<string>(initialMockFilter ? String(initialMockFilter) : 'all');
  const [sortBy, setSortBy] = useState<'date-desc' | 'date-asc' | 'time-desc' | 'diff'>('date-desc');

  // Preview Image Modal
  const [previewImage, setPreviewImage] = useState<string | null>(null);

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
  const [selectedMockId, setSelectedMockId] = useState<number>(defaultMock?.id || 1);
  const [sectionId, setSectionId] = useState<string>(settings.sections[0]?.id || 'quant');
  const [topic, setTopic] = useState<string>('');
  const [subtopic, setSubtopic] = useState<string>('');
  const [questionNumber, setQuestionNumber] = useState<number>(1);
  const [questionText, setQuestionText] = useState('');
  const [questionImage, setQuestionImage] = useState<string | undefined>(undefined);
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
    setSelectedMockId(mocks[mocks.length - 1]?.id || 1);
    const sec = settings.sections[0]?.id || 'quant';
    setSectionId(sec);
    setTopic(settings.sections[0]?.topics[0] || 'Percentage');
    setSubtopic('');
    setQuestionNumber(mistakes.length + 1);
    setQuestionText('');
    setQuestionImage(undefined);
    setMyAnswer('');
    setCorrectAnswer('');
    setResultType('Wrong');
    setSelectedErrorTypes(['Concept gap']);
    setTimeSpentSeconds(60);
    setIdealTimeSeconds(35);
    setWhatWentWrong('');
    setCorrectSolution('');
    setBetterApproach('');
    setRuleToRemember('');
    setDifficulty('Medium');
    setStatus('New');
    setIsFullModalOpen(true);
  };

  const openEdit = (m: MistakeEntry) => {
    setEditingMistakeId(m.id || null);
    setSelectedMockId(m.mockId);
    setSectionId(m.sectionId);
    setTopic(m.topic);
    setSubtopic(m.subtopic || '');
    setQuestionNumber(m.questionNumber);
    setQuestionText(m.questionText);
    setQuestionImage(m.questionImage);
    setMyAnswer(m.myAnswer);
    setCorrectAnswer(m.correctAnswer);
    setResultType(m.resultType);
    setSelectedErrorTypes(m.errorTypes);
    setTimeSpentSeconds(m.timeSpentSeconds);
    setIdealTimeSeconds(m.idealTimeSeconds);
    setWhatWentWrong(m.whatWentWrong);
    setCorrectSolution(m.correctSolution);
    setBetterApproach(m.betterApproach);
    setRuleToRemember(m.ruleToRemember);
    setDifficulty(m.difficulty);
    setStatus(m.status);
    setIsFullModalOpen(true);
  };

  const handleSaveFullMistake = async (e: React.FormEvent) => {
    e.preventDefault();
    const mock = mocks.find((mk) => mk.id === Number(selectedMockId)) || mocks[0];
    const secConfig = settings.sections.find((s) => s.id === sectionId) || settings.sections[0];
    const todayStr = new Date().toISOString().split('T')[0];

    const payload: Omit<MistakeEntry, 'id'> = {
      mockId: mock?.id || 1,
      mockName: mock?.name || 'Mock Test',
      sectionId,
      sectionName: secConfig?.name || 'Quantitative Aptitude',
      topic: topic || secConfig?.topics[0] || 'General',
      subtopic: subtopic.trim() || undefined,
      questionNumber: Number(questionNumber) || 1,
      questionText: questionText.trim() || 'Question not transcribed.',
      questionImage,
      myAnswer: myAnswer.trim() || 'N/A',
      correctAnswer: correctAnswer.trim() || 'N/A',
      resultType,
      errorTypes: selectedErrorTypes.length > 0 ? selectedErrorTypes : ['Concept gap'],
      timeSpentSeconds: Number(timeSpentSeconds) || 60,
      idealTimeSeconds: Number(idealTimeSeconds) || 35,
      whatWentWrong: whatWentWrong.trim() || 'Mistake logged for revision.',
      correctSolution: correctSolution.trim() || 'Refer to standard solution.',
      betterApproach: betterApproach.trim() || 'Review core approach.',
      ruleToRemember: ruleToRemember.trim() || 'Carefully re-read problem statements.',
      difficulty,
      tags: ['user-logged'],
      status,
      interval: status === 'Mastered' ? 30 : 1,
      consecutiveCorrect: status === 'Mastered' ? 3 : 0,
      nextReviewDate: todayStr,
      history: [],
      createdAt: todayStr
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
  const [quickErrorTypes, setQuickErrorTypes] = useState<string[]>(['Calculation mistake']);
  const [quickRule, setQuickRule] = useState('');
  const [quickQNo, setQuickQNo] = useState<number>(mistakes.length + 1);
  const [quickResultType, setQuickResultType] = useState<ResultType>('Wrong');

  const handleSaveQuickMistake = async (e: React.FormEvent) => {
    e.preventDefault();
    const mock = mocks[mocks.length - 1] || mocks[0];
    const secConfig = settings.sections.find((s) => s.id === quickSectionId) || settings.sections[0];
    const todayStr = new Date().toISOString().split('T')[0];

    const payload: Omit<MistakeEntry, 'id'> = {
      mockId: mock?.id || 1,
      mockName: mock?.name || 'Mock Test',
      sectionId: quickSectionId,
      sectionName: secConfig?.name || 'Section',
      topic: quickTopic,
      questionNumber: Number(quickQNo) || 1,
      questionText: `Question #${quickQNo}`,
      myAnswer: 'Marked wrong',
      correctAnswer: 'Correct option',
      resultType: quickResultType,
      errorTypes: quickErrorTypes.length > 0 ? quickErrorTypes : ['Calculation mistake'],
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

  const filteredMistakes = mistakes.filter((m) => {
    if (filterSection !== 'all' && m.sectionId !== filterSection) return false;
    if (filterTopic !== 'all' && m.topic !== filterTopic) return false;
    if (filterErrorType !== 'all' && !m.errorTypes.includes(filterErrorType)) return false;
    if (filterStatus !== 'all' && m.status !== filterStatus) return false;
    if (filterResultType !== 'all' && m.resultType !== filterResultType) return false;
    if (filterMockId !== 'all' && String(m.mockId) !== filterMockId) return false;

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
        (m.subtopic || '')
      ).toLowerCase();
      if (!matchText.includes(q)) return false;
    }

    return true;
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
      <div className="manga-panel p-4 bg-[var(--bg-panel)] rounded-2xl border-3 border-[var(--ink-border)] shadow-manga space-y-3">
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

          <div className="flex flex-wrap gap-2">
            <select
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
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="text-xs px-2.5 py-1.5 rounded-xl bg-[var(--bg-surface)] border-2 border-[var(--ink-border)] font-bold"
            >
              <option value="all">All Statuses</option>
              <option value="New">New</option>
              <option value="Reviewing">Reviewing</option>
              <option value="Mastered">Mastered (Defeated)</option>
            </select>
          </div>
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
          {filteredMistakes.map((m) => (
            <div
              key={m.id}
              className="manga-panel p-5 bg-[var(--bg-panel)] rounded-2xl border-3 border-[var(--ink-border)] shadow-manga space-y-3.5"
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b-2 border-[var(--ink-border)] pb-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md bg-[var(--sakura)] text-[var(--ink)] border border-[var(--ink-border)] text-xs font-bold">
                      {m.sectionName}
                    </span>
                    <span className="font-display text-xs font-bold text-[var(--ink)] dark:text-[var(--text-main)]">
                      {m.topic} (Q#{m.questionNumber})
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded border border-[var(--ink-border)] ${
                        m.status === 'Mastered'
                          ? 'bg-[var(--mint)] text-[var(--ink)]'
                          : 'bg-[var(--peach)] text-[var(--ink)]'
                      }`}
                    >
                      {m.status === 'Mastered' ? 'Defeated (Mastered)' : `${m.status} (${m.interval}d)`}
                    </span>
                  </div>
                  <p className="text-[11px] text-[var(--text-muted)] font-mono">
                    From: {m.mockName} • Spent {m.timeSpentSeconds}s (Ideal: {m.idealTimeSeconds}s)
                  </p>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => openEdit(m)}
                    className="p-1.5 rounded-lg border border-[var(--ink-border)] bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-[var(--text-main)]"
                    title="Edit Mistake"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => m.id && handleDelete(m.id)}
                    className="p-1.5 rounded-lg border border-[var(--ink-border)] bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-rose-600"
                    title="Delete Mistake"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Error Types Badges */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-bold text-[var(--text-muted)]">Cause:</span>
                {m.errorTypes.map((err) => (
                  <span
                    key={err}
                    className="text-[11px] px-2 py-0.5 rounded-md bg-[var(--bg-surface)] border border-[var(--ink-border)] font-bold text-[var(--ink)] dark:text-[var(--text-main)]"
                  >
                    {err}
                  </span>
                ))}
              </div>

              {/* Question Text & Screenshot Image */}
              <div className="p-3.5 rounded-xl bg-[var(--bg-surface)] border-2 border-[var(--ink-border)] text-xs space-y-2">
                <p className="font-medium whitespace-pre-wrap leading-relaxed">{m.questionText}</p>
                {m.questionImage && (
                  <div
                    onClick={() => setPreviewImage(m.questionImage || null)}
                    className="cursor-pointer border border-[var(--ink-border)] rounded-lg max-h-48 overflow-hidden max-w-md"
                  >
                    <img src={m.questionImage} alt="Mistake screenshot" className="w-full h-full object-contain" />
                  </div>
                )}
                <div className="flex gap-4 pt-1 border-t border-[var(--ink-border)]/40 text-[11px] font-mono">
                  <span className="text-rose-600 dark:text-rose-400 font-bold">My Ans: {m.myAnswer}</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">Correct Ans: {m.correctAnswer}</span>
                </div>
              </div>

              {/* Solution & Shortcut */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--ink-border)] space-y-1">
                  <span className="font-bold text-[var(--peach)] block text-[11px]">WHAT WENT WRONG:</span>
                  <p className="text-[var(--text-muted)] leading-relaxed">{m.whatWentWrong}</p>
                </div>
                <div className="p-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--ink-border)] space-y-1">
                  <span className="font-bold text-[var(--mint)] block text-[11px]">CORRECT APPROACH:</span>
                  <p className="text-[var(--text-muted)] leading-relaxed">{m.betterApproach || m.correctSolution}</p>
                </div>
              </div>

              {/* Rule to Remember Sticker */}
              <div className="p-2.5 rounded-xl bg-[var(--peach)] text-[var(--ink)] border-2 border-[var(--ink-border)] flex items-center gap-2 font-bold text-xs">
                <Sparkles className="w-4 h-4 shrink-0" />
                <span>Rule to Remember: {m.ruleToRemember}</span>
              </div>
            </div>
          ))}
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
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                  <label className="block font-bold mb-1">Question Number</label>
                  <input
                    type="number"
                    value={questionNumber}
                    onChange={(e) => setQuestionNumber(Number(e.target.value) || 1)}
                    className="w-full p-2 rounded-lg bg-[var(--bg-surface)] border-2 border-[var(--ink-border)] font-semibold"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold">Question Statement & Screenshot</label>
                  <label className="text-[11px] text-[var(--sakura)] font-bold cursor-pointer hover:underline flex items-center gap-1">
                    <ImageIcon className="w-3.5 h-3.5" />
                    <span>Attach Screenshot File</span>
                    <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                  </label>
                </div>
                <textarea
                  rows={3}
                  value={questionText}
                  onChange={(e) => setQuestionText(e.target.value)}
                  placeholder="Type question statement or paste screenshot with Cmd+V..."
                  className="w-full p-2.5 rounded-xl bg-[var(--bg-surface)] border-2 border-[var(--ink-border)] font-medium"
                />
                {questionImage && (
                  <div className="relative inline-block border-2 border-[var(--ink-border)] rounded-lg overflow-hidden mt-2 max-w-xs">
                    <img src={questionImage} alt="Pasted Screenshot" className="max-h-36 object-contain" />
                    <button
                      type="button"
                      onClick={() => setQuestionImage(undefined)}
                      className="absolute top-1 right-1 p-1 rounded-full bg-black/70 text-white hover:bg-rose-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
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
              </div>

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
