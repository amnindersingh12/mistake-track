import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  MockTest,
  MistakeEntry,
  FullMockScanResult,
  ScannedQuestion,
  ScannedQuestionOption,
  StudyBridgeImportPayload,
  ResultType
} from '../types';
import { db } from '../db/db';
import { getTodayDateStr, addDaysToDate } from '../utils/srs';
import { parseTimeString, getScannedQuestionStatus } from '../utils/dataIntake';
import {
  Inbox,
  AlertTriangle,
  CheckCircle2,
  Zap,
  ArrowRight,
  Filter,
  Search,
  Upload,
  FileJson,
  X,
  Keyboard,
  Check,
  RotateCcw,
  BookOpen,
  Eye,
  ChevronLeft,
  ChevronRight,
  Trash2
} from 'lucide-react';
import { normalizeOptionObjects } from '../utils/normalizeOptions';

export interface ImportInboxViewProps {
  initialPayload?: StudyBridgeImportPayload | null;
  onNavigateToMistakes?: () => void;
  onNavigateToMocks?: () => void;
}

const ERROR_TYPE_SHORTCUTS: Array<{ key: string; label: string }> = [
  { key: '1', label: 'Concept gap' },
  { key: '2', label: 'Silly/careless' },
  { key: '3', label: 'Guessed (no basis)' },
  { key: '4', label: 'Calculation mistake' }
];

function isOptionCorrect(opt: ScannedQuestionOption, index: number, q: ScannedQuestion): boolean {
  if (opt.isCorrect === true) return true;
  if (!q.correctAnswer) return false;
  const ca = q.correctAnswer.trim().toLowerCase();
  const optText = opt.text.trim().toLowerCase();
  if (optText === ca) return true;
  const letter = String.fromCharCode(65 + index).toLowerCase();
  if (ca === letter || ca === `option ${letter}` || ca === `(${letter})`) return true;
  if (ca === String(index + 1) || ca === `option ${index + 1}`) return true;
  return false;
}

export const ImportInboxView: React.FC<ImportInboxViewProps> = ({
  initialPayload,
  onNavigateToMistakes,
  onNavigateToMocks
}) => {
  // Staged Mock & Questions state
  const [mockName, setMockName] = useState<string>('Testbook Full Mock Test');
  const [mockDate, setMockDate] = useState<string>(getTodayDateStr());
  const [scanResult, setScanResult] = useState<FullMockScanResult | null>(null);
  const [duplicateMock, setDuplicateMock] = useState<MockTest | null>(null);

  // Inbox Question Queue (wrong & unattempted)
  const [inboxQuestions, setInboxQuestions] = useState<ScannedQuestion[]>([]);
  const [savedCount, setSavedCount] = useState<number>(0);
  const [skippedCount, setSkippedCount] = useState<number>(0);

  // Fast Triage Mode
  const [isFastTriageOpen, setIsFastTriageOpen] = useState<boolean>(false);
  const [triageIndex, setTriageIndex] = useState<number>(0);
  const [selectedErrors, setSelectedErrors] = useState<string[]>(['Concept gap']);
  const [ruleToRemember, setRuleToRemember] = useState<string>('');

  // Question Detail & Attempt Modal State
  const [openQuestion, setOpenQuestion] = useState<ScannedQuestion | null>(null);
  const [selectedOptionIdx, setSelectedOptionIdx] = useState<number | null>(null);
  const [hasSubmitted, setHasSubmitted] = useState<boolean>(false);

  // Filtering & Search
  const [filterStatus, setFilterStatus] = useState<'all' | 'wrong' | 'unattempted'>('all');
  const [filterSection, setFilterSection] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [notification, setNotification] = useState<{ msg: string; type: 'success' | 'warning' } | null>(null);

  const showNotification = (msg: string, type: 'success' | 'warning' = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // Populate from initialPayload if provided
  useEffect(() => {
    if (initialPayload?.scanData) {
      loadScanData(initialPayload.scanData, initialPayload.capturedAt);
    }
  }, [initialPayload]);

  const loadScanData = (sd: FullMockScanResult, capturedAt?: string) => {
    setScanResult(sd);
    const title = sd.mockName || sd.examName || 'Testbook Mock Test';
    setMockName(title);
    const dateStr = capturedAt ? capturedAt.split('T')[0] : getTodayDateStr();
    setMockDate(dateStr);

    // Extract mistakes: questions that are Wrong, Skipped, or flagged for review
    const candidates = (sd.questions || [])
      .filter((q) => {
        const status = getScannedQuestionStatus(q);
        return status === 'Wrong' || status === 'Skipped' || q.needsReview;
      })
      .map((q) => {
        const norm = normalizeOptionObjects(q.options || []);
        const matchedCorr = norm.options.find((o) => o.isCorrect || (q.correctAnswer && o.text.toLowerCase().includes(q.correctAnswer.toLowerCase())));
        const matchedSel = norm.options.find((o) => o.isSelected || (q.selectedAnswer && o.text.toLowerCase().includes(q.selectedAnswer.toLowerCase())));

        return {
          ...q,
          options: norm.options,
          correctAnswer: matchedCorr ? matchedCorr.text : (q.correctAnswer || 'See solution'),
          selectedAnswer: (q.selectedAnswer && /skipped|unattempt/i.test(q.selectedAnswer))
            ? 'Left unattempted'
            : (matchedSel ? matchedSel.text : (q.selectedAnswer || 'Left unattempted')),
          needsReview: norm.needsReview || Boolean(q.needsReview),
          reviewReason: norm.reason || q.reviewReason
        };
      });

    setInboxQuestions(candidates);
    setTriageIndex(0);
    setSavedCount(0);
    setSkippedCount(0);
  };

  const handleDeleteOption = (qNum: number, optIdx: number) => {
    const updateQ = (q: ScannedQuestion): ScannedQuestion => {
      const remaining = (q.options || []).filter((_, idx) => idx !== optIdx);
      const reindexed = remaining.map((opt, idx) => ({
        ...opt,
        index: idx,
        label: String.fromCharCode(65 + idx)
      }));
      const norm = normalizeOptionObjects(reindexed);
      return {
        ...q,
        options: norm.options,
        needsReview: norm.needsReview,
        reviewReason: norm.reason
      };
    };

    setInboxQuestions((prev) => prev.map((q) => (q.questionNumber === qNum ? updateQ(q) : q)));
    if (openQuestion && openQuestion.questionNumber === qNum) {
      setOpenQuestion((prev) => (prev ? updateQ(prev) : null));
    }
  };

  const handleSetCorrectAnswer = (qNum: number, optIdx: number) => {
    const updateQ = (q: ScannedQuestion): ScannedQuestion => {
      const updatedOpts = (q.options || []).map((opt, idx) => ({
        ...opt,
        isCorrect: idx === optIdx
      }));
      const chosen = updatedOpts[optIdx];
      return {
        ...q,
        options: updatedOpts,
        correctAnswer: chosen ? chosen.text : q.correctAnswer
      };
    };

    setInboxQuestions((prev) => prev.map((q) => (q.questionNumber === qNum ? updateQ(q) : q)));
    if (openQuestion && openQuestion.questionNumber === qNum) {
      setOpenQuestion((prev) => (prev ? updateQ(prev) : null));
    }
  };

  // Check for duplicate mock in Dexie
  useEffect(() => {
    async function checkDuplicate() {
      if (!mockName.trim()) {
        setDuplicateMock(null);
        return;
      }
      try {
        const matches = await db.mocks.where('name').equalsIgnoreCase(mockName.trim()).toArray();
        const dup = matches.find((m) => m.date === mockDate);
        setDuplicateMock(dup || null);
      } catch {
        setDuplicateMock(null);
      }
    }
    checkDuplicate();
  }, [mockName, mockDate]);

  // Handle JSON file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);
        if (parsed.payload?.scanData) {
          loadScanData(parsed.payload.scanData, parsed.payload.capturedAt);
          showNotification('StudyBridge export loaded into inbox!');
        } else if (parsed.questions && parsed.totalQuestions) {
          loadScanData(parsed);
          showNotification('Mock questions loaded into inbox!');
        } else {
          showNotification('Unrecognized JSON format. Please use StudyBridge export.', 'warning');
        }
      } catch {
        showNotification('Invalid JSON file.', 'warning');
      }
    };
    reader.readAsText(file);
  };

  // Load sample fixture from sampletestbook.html data
  const handleLoadSampleFixture = () => {
    const sampleScan: FullMockScanResult = {
      mockName: 'TNPSC Group 1 Prelims Mock 01',
      examName: 'TNPSC Group 1',
      overallScore: 85.93,
      totalQuestions: 130,
      sections: [
        { sectionName: 'Paper 1', questionCount: 80, correctCount: 27, incorrectCount: 9, skippedCount: 44, marks: 30.93 },
        { sectionName: 'Paper 2', questionCount: 50, correctCount: 30, incorrectCount: 10, skippedCount: 10, marks: 55.0 }
      ],
      questions: [
        {
          questionNumber: 1,
          section: 'Paper 1',
          topic: 'Current Affairs',
          questionText: 'Tamil Nadu (TN) recently received six additional Geographical Indication (GI) tags. Which of the following combinations represents these newly tagged products correctly?',
          options: [
            { index: 0, text: 'Rameswaram Fish, Erode Turmeric, Madurai Malli' },
            { index: 1, text: 'Salem Silk, Kanchipuram Saree, Nilgiri Tea' },
            { index: 2, text: 'Tirunelveli Halwa, Chettinad Kottan, Thanjavur Doll' },
            { index: 3, text: 'Puliyankudi Acid Lime, Panruti Cashew, and Virudhunagar Samba Vathal', isCorrect: true },
            { index: 4, text: 'None of the above' }
          ],
          selectedAnswer: 'Left unattempted',
          correctAnswer: 'Puliyankudi Acid Lime, Panruti Cashew, and Virudhunagar Samba Vathal',
          statusBadge: 'Skipped',
          timeTaken: '00:15',
          avgTime: '00:45',
          explanation: 'The correct answer is Puliyankudi Acid Lime, Panruti Cashew, and Virudhunagar Samba Vathal. Key Points: TN now has over 58 GI tags leading all states in India.',
          solutionStatus: 'captured'
        },
        {
          questionNumber: 2,
          section: 'Paper 1',
          topic: 'Indian Polity',
          questionText: 'Consider the following statements regarding the powers of the State Governor under Article 200 of the Constitution. Which statement is incorrect?',
          options: [
            { index: 0, text: 'The Governor can give assent to the bill.' },
            { index: 1, text: 'The Governor can withhold assent to the bill.' },
            { index: 2, text: 'The Governor can reserve the bill for consideration of the President.' },
            { index: 3, text: 'The Governor must return a Money Bill for reconsideration.', isCorrect: true, isSelected: true }
          ],
          selectedAnswer: 'The Governor must return a Money Bill for reconsideration.',
          correctAnswer: 'The Governor can give assent or withhold, but CANNOT return a Money Bill.',
          statusBadge: 'Wrong',
          timeTaken: '01:20',
          avgTime: '00:50',
          explanation: 'Under Article 200, the Governor cannot return a Money Bill to the Legislature for reconsideration.',
          solutionStatus: 'captured'
        }
      ]
    };
    loadScanData(sampleScan);
    showNotification('Loaded 2 sample mistake questions from fixture!');
  };

  // Filtered inbox questions
  const filteredInbox = useMemo(() => {
    return inboxQuestions.filter((q) => {
      const status = getScannedQuestionStatus(q);
      if (filterStatus === 'wrong' && status !== 'Wrong') return false;
      if (filterStatus === 'unattempted' && status !== 'Skipped') return false;
      if (filterSection !== 'all' && q.section !== filterSection) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        return (
          q.questionText.toLowerCase().includes(query) ||
          (q.topic && q.topic.toLowerCase().includes(query)) ||
          String(q.questionNumber).includes(query)
        );
      }
      return true;
    });
  }, [inboxQuestions, filterStatus, filterSection, searchQuery]);

  const uniqueSections = useMemo(() => {
    const set = new Set<string>();
    inboxQuestions.forEach((q) => set.add(q.section));
    return Array.from(set);
  }, [inboxQuestions]);

  const currentTriageQuestion = filteredInbox[triageIndex];

  // Navigation for open question detail modal
  const currentOpenIdx = useMemo(() => {
    if (!openQuestion) return -1;
    return filteredInbox.findIndex((q) => q.questionNumber === openQuestion.questionNumber);
  }, [openQuestion, filteredInbox]);

  const hasPrev = currentOpenIdx > 0;
  const hasNext = currentOpenIdx >= 0 && currentOpenIdx < filteredInbox.length - 1;

  const handlePrevQuestion = () => {
    if (hasPrev) {
      setOpenQuestion(filteredInbox[currentOpenIdx - 1]);
      setSelectedOptionIdx(null);
      setHasSubmitted(false);
    }
  };

  const handleNextQuestion = () => {
    if (hasNext) {
      setOpenQuestion(filteredInbox[currentOpenIdx + 1]);
      setSelectedOptionIdx(null);
      setHasSubmitted(false);
    }
  };

  // Fast Triage: Accept & Save into db.mistakes
  const handleAcceptAndSave = useCallback(async () => {
    if (!currentTriageQuestion) return;

    const today = getTodayDateStr();
    const status = getScannedQuestionStatus(currentTriageQuestion);
    const resultType: ResultType = status === 'Wrong' ? 'Wrong' : 'Left unattempted';

    const secName = currentTriageQuestion.section || 'General';
    const secId = secName.toLowerCase().includes('reason') ? 'reasoning'
      : secName.toLowerCase().includes('quant') || secName.toLowerCase().includes('math') ? 'quant'
      : secName.toLowerCase().includes('eng') ? 'english' : 'general';

    const formattedOptions = (currentTriageQuestion.options || []).map((opt, i) =>
      `${String.fromCharCode(65 + i)}. ${opt.text}${opt.isCorrect ? ' [Correct]' : ''}${opt.isSelected ? ' [Selected]' : ''}`
    ).join('\n');

    const optCount = currentTriageQuestion.options?.length || 0;
    const isStillNeedsReview = Boolean(currentTriageQuestion.needsReview || (optCount > 0 && (optCount < 2 || optCount > 5)));

    const newMistake: MistakeEntry = {
      mockName,
      sectionId: secId,
      sectionName: secName,
      topic: currentTriageQuestion.topic || secName,
      questionNumber: currentTriageQuestion.questionNumber,
      questionText: currentTriageQuestion.questionText + (formattedOptions ? '\n\nOptions:\n' + formattedOptions : ''),
      questionImage: currentTriageQuestion.questionImage,
      myAnswer: currentTriageQuestion.selectedAnswer || 'Left unattempted',
      correctAnswer: currentTriageQuestion.correctAnswer || 'Refer to solution',
      resultType,
      errorTypes: selectedErrors.length > 0 ? selectedErrors : ['Concept gap'],
      timeSpentSeconds: currentTriageQuestion.timeTaken ? parseTimeString(currentTriageQuestion.timeTaken).seconds : 60,
      idealTimeSeconds: currentTriageQuestion.avgTime ? parseTimeString(currentTriageQuestion.avgTime).seconds : 45,
      whatWentWrong: status === 'Wrong' ? 'Incorrect option selected in mock test' : 'Question left unattempted',
      correctSolution: currentTriageQuestion.explanation || '',
      betterApproach: '',
      ruleToRemember: ruleToRemember.trim() || `Review key formula/rules for ${currentTriageQuestion.topic || secName}.`,
      difficulty: 'Medium',
      tags: ['testbook-import', 'inbox-triaged'],
      status: isStillNeedsReview ? 'inbox' : 'New',
      needsReview: isStillNeedsReview,
      reviewReason: currentTriageQuestion.reviewReason,
      interval: 1,
      consecutiveCorrect: 0,
      nextReviewDate: addDaysToDate(today, 1),
      history: [],
      createdAt: new Date().toISOString()
    };

    await db.mistakes.add(newMistake);

    setSavedCount((prev) => prev + 1);
    showNotification(`Q${currentTriageQuestion.questionNumber} saved to Mistake Log!`);

    // Remove from inbox queue
    setInboxQuestions((prev) => prev.filter((q) => q.questionNumber !== currentTriageQuestion.questionNumber));

    // Reset fields for next question
    setSelectedErrors(['Concept gap']);
    setRuleToRemember('');
  }, [currentTriageQuestion, mockName, selectedErrors, ruleToRemember]);

  // Fast Triage: Skip question
  const handleSkipQuestion = useCallback(() => {
    if (!currentTriageQuestion) return;
    setSkippedCount((prev) => prev + 1);
    if (triageIndex < filteredInbox.length - 1) {
      setTriageIndex((prev) => prev + 1);
    } else {
      setTriageIndex(0);
    }
  }, [currentTriageQuestion, triageIndex, filteredInbox.length]);

  // Fast Triage: Keyboard shortcuts (keys 1-4, Enter, Skip)
  useEffect(() => {
    if (!isFastTriageOpen || !currentTriageQuestion) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't capture digits when user is typing inside rule-to-remember input
      const activeTagName = (document.activeElement?.tagName || '').toLowerCase();
      const isInputFocused = activeTagName === 'input' || activeTagName === 'textarea';

      if (!isInputFocused) {
        // Digits 1-4 toggle error classifications
        const shortcut = ERROR_TYPE_SHORTCUTS.find((s) => s.key === e.key);
        if (shortcut) {
          e.preventDefault();
          setSelectedErrors((prev) =>
            prev.includes(shortcut.label)
              ? prev.filter((err) => err !== shortcut.label)
              : [...prev, shortcut.label]
          );
          return;
        }

        if (e.key === 's' || e.key === 'S') {
          e.preventDefault();
          handleSkipQuestion();
          return;
        }
      }

      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey || !isInputFocused)) {
        e.preventDefault();
        handleAcceptAndSave();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setIsFastTriageOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFastTriageOpen, currentTriageQuestion, handleAcceptAndSave, handleSkipQuestion]);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-stone-900 p-6 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-red-100 dark:bg-red-950/60 rounded-xl text-red-600 dark:text-red-400">
            <Inbox className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
              Import Inbox
              {inboxQuestions.length > 0 && (
                <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300">
                  {inboxQuestions.length} pending
                </span>
              )}
            </h1>
            <p className="text-sm text-stone-500 dark:text-stone-400">
              Review and triage wrong/unattempted questions from Testbook imports into your active Mistake Log.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {inboxQuestions.length > 0 && (
            <button
              onClick={() => setIsFastTriageOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-xl shadow-sm transition-colors"
            >
              <Zap className="w-4 h-4" />
              Fast Triage Mode
            </button>
          )}

          <label className="flex items-center gap-2 px-4 py-2 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 font-medium rounded-xl cursor-pointer transition-colors">
            <Upload className="w-4 h-4" />
            Upload JSON
            <input type="file" accept=".json" onChange={handleFileUpload} className="hidden" />
          </label>

          <button
            onClick={handleLoadSampleFixture}
            className="flex items-center gap-2 px-3 py-2 text-xs text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 border border-stone-200 dark:border-stone-800 rounded-xl transition-colors"
          >
            <BookOpen className="w-3.5 h-3.5" />
            Load Sample
          </button>
        </div>
      </div>

      {/* Notifications */}
      {notification && (
        <div className={`p-4 rounded-xl flex items-center gap-2 text-sm font-medium ${
          notification.type === 'warning'
            ? 'bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300'
            : 'bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300'
        }`}>
          {notification.type === 'warning' ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
          {notification.msg}
        </div>
      )}

      {/* Duplicate Mock Warning Banner */}
      {duplicateMock && (
        <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-xl flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-900 dark:text-amber-200">
            <span className="font-semibold">⚠️ Duplicate Mock Detected:</span> A mock test named{' '}
            <span className="font-mono font-medium">"{duplicateMock.name}"</span> on{' '}
            <span className="font-medium">{duplicateMock.date}</span> already exists in your database (Mock ID #{duplicateMock.id}).
            Questions saved will be attached to your Mistake Notebook, but avoid re-saving the scorecard to prevent duplicate logs.
          </div>
        </div>
      )}

      {/* Empty State */}
      {inboxQuestions.length === 0 ? (
        <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-12 text-center">
          <div className="w-16 h-16 bg-stone-100 dark:bg-stone-800 text-stone-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-emerald-500" />
          </div>
          <h2 className="text-xl font-bold text-stone-900 dark:text-stone-100 mb-2">Inbox Zero!</h2>
          <p className="text-stone-500 dark:text-stone-400 max-w-md mx-auto mb-6">
            No untriaged mistake questions remaining. Capture new tests via the Safari Extension or import an offline JSON file.
          </p>
          <div className="flex justify-center gap-3">
            <button
              onClick={handleLoadSampleFixture}
              className="px-4 py-2 bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 font-medium rounded-xl hover:opacity-90 transition-opacity"
            >
              Test with Sample Fixture
            </button>
            {onNavigateToMistakes && (
              <button
                onClick={onNavigateToMistakes}
                className="px-4 py-2 border border-stone-300 dark:border-stone-700 font-medium rounded-xl hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors"
              >
                Go to Mistake Notebook
              </button>
            )}
          </div>
        </div>
      ) : (
        /* Questions Table / List View */
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-stone-900 p-4 rounded-xl border border-stone-200 dark:border-stone-800">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-stone-400">Filters:</span>
              <button
                onClick={() => setFilterStatus('all')}
                className={`px-3 py-1 text-xs font-medium rounded-lg ${filterStatus === 'all' ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900' : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300'}`}
              >
                All ({inboxQuestions.length})
              </button>
              <button
                onClick={() => setFilterStatus('wrong')}
                className={`px-3 py-1 text-xs font-medium rounded-lg ${filterStatus === 'wrong' ? 'bg-red-600 text-white' : 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300'}`}
              >
                Wrong
              </button>
              <button
                onClick={() => setFilterStatus('unattempted')}
                className={`px-3 py-1 text-xs font-medium rounded-lg ${filterStatus === 'unattempted' ? 'bg-amber-600 text-white' : 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300'}`}
              >
                Unattempted
              </button>

              {uniqueSections.length > 1 && (
                <select
                  value={filterSection}
                  onChange={(e) => setFilterSection(e.target.value)}
                  className="px-2 py-1 text-xs font-medium bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg text-stone-700 dark:text-stone-200"
                >
                  <option value="all">All Sections</option>
                  {uniqueSections.map((sec) => (
                    <option key={sec} value={sec}>{sec}</option>
                  ))}
                </select>
              )}
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search question text or topic..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-3 py-1.5 text-xs bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg w-full sm:w-64 focus:outline-none focus:ring-1 focus:ring-red-500"
              />
            </div>
          </div>

          {/* Cards List */}
          <div className="grid gap-3">
            {filteredInbox.map((q, idx) => {
              const status = getScannedQuestionStatus(q);
              return (
                <div
                  key={q.questionNumber}
                  onClick={() => {
                    setOpenQuestion(q);
                    setSelectedOptionIdx(null);
                    setHasSubmitted(false);
                  }}
                  className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl p-5 hover:border-red-300 dark:hover:border-red-900 transition-colors cursor-pointer group"
                >
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold px-2.5 py-1 bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 rounded-md">
                        Q.{q.questionNumber}
                      </span>
                      <span className="text-xs font-semibold px-2.5 py-1 bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 rounded-md">
                        {q.section}
                      </span>
                      {q.topic && (
                        <span className="text-xs px-2.5 py-1 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 rounded-md">
                          {q.topic}
                        </span>
                      )}
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        status === 'Wrong'
                          ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
                          : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                      }`}>
                        {status === 'Wrong' ? '✕ Wrong Answer' : '○ Left Unattempted'}
                      </span>
                      {q.needsReview && (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-700 flex items-center gap-1">
                          ⚠️ Needs review
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-medium text-stone-400 group-hover:text-red-600 dark:group-hover:text-red-400 flex items-center gap-1 transition-colors">
                        <Eye className="w-3.5 h-3.5" />
                        View
                        <ArrowRight className="w-3.5 h-3.5" />
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setTriageIndex(idx);
                          setIsFastTriageOpen(true);
                        }}
                        className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-red-600 hover:text-white hover:bg-red-600 border border-red-200 dark:border-red-900 rounded-lg transition-colors"
                      >
                        <Zap className="w-3.5 h-3.5" />
                        Triage This
                      </button>
                    </div>
                  </div>

                  <p className="text-sm text-stone-900 dark:text-stone-100 font-medium mb-3 line-clamp-2">
                    {q.questionText}
                  </p>

                  {q.needsReview && (
                    <div className="mb-3 text-xs font-semibold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 p-2.5 rounded-lg border border-amber-200 dark:border-amber-800 flex items-center gap-1.5">
                      <span>⚠️ Review reason: {q.reviewReason || `${q.options?.length || 0} options found, expected 2 to 5`}</span>
                    </div>
                  )}

                  <div className="grid sm:grid-cols-2 gap-2 text-xs bg-stone-50 dark:bg-stone-800/50 p-3 rounded-lg">
                    <div>
                      <span className="text-stone-500">Your Answer: </span>
                      <span className="font-medium text-red-600 dark:text-red-400">
                        {q.selectedAnswer || 'Left unattempted'}
                      </span>
                    </div>
                    <div>
                      <span className="text-stone-500">Correct Answer: </span>
                      <span className="font-medium text-emerald-600 dark:text-emerald-400">
                        {q.correctAnswer || 'See solution'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* QUESTION DETAIL & ATTEMPT MODAL */}
      {openQuestion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[var(--bg-panel)] border-[3px] border-[var(--ink-border)] rounded-2xl shadow-manga-lg max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 border-b-2 border-stone-200 dark:border-stone-800 flex items-center justify-between bg-stone-50/80 dark:bg-stone-900/80">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-xs font-bold px-2.5 py-1 bg-stone-200 dark:bg-stone-800 text-stone-800 dark:text-stone-200 rounded-md">
                  Q.{openQuestion.questionNumber}
                </span>
                <span className="text-xs font-semibold px-2.5 py-1 bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300 rounded-md">
                  {openQuestion.section}
                </span>
                {openQuestion.topic && (
                  <span className="text-xs px-2.5 py-1 bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 rounded-md font-medium">
                    {openQuestion.topic}
                  </span>
                )}
                <span
                  className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                    getScannedQuestionStatus(openQuestion) === 'Wrong'
                      ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                      : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                  }`}
                >
                  {getScannedQuestionStatus(openQuestion) === 'Wrong' ? '✕ Wrong in Mock' : '○ Skipped in Mock'}
                </span>
              </div>

              <button
                onClick={() => setOpenQuestion(null)}
                className="p-1.5 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5 flex-1">
              {/* Question Text */}
              <div>
                <h4 className="text-base font-semibold text-stone-900 dark:text-stone-100 leading-relaxed">
                  {openQuestion.questionText}
                </h4>
                {openQuestion.questionImage && (
                  <img
                    src={openQuestion.questionImage}
                    alt="Question Diagram"
                    className="max-h-60 mt-3 rounded-xl border border-stone-200 dark:border-stone-800 object-contain"
                  />
                )}
              </div>

              {/* Mock Test Context */}
              <div className="flex items-center gap-4 text-xs text-stone-500 dark:text-stone-400 bg-stone-100/70 dark:bg-stone-800/50 p-2.5 rounded-xl border border-stone-200/60 dark:border-stone-700/60">
                <div>
                  <span>Your Mock Answer: </span>
                  <span className="font-semibold text-rose-600 dark:text-rose-400">
                    {openQuestion.selectedAnswer || 'Left unattempted'}
                  </span>
                </div>
                {openQuestion.timeTaken && (
                  <div>
                    <span>Time Spent: </span>
                    <span className="font-medium text-stone-700 dark:text-stone-300">{openQuestion.timeTaken}</span>
                  </div>
                )}
              </div>

              {/* Options as Clickable Buttons */}
              <div className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-stone-500 block">
                  {hasSubmitted ? 'Solution & Feedback' : 'Attempt Question (Select an Option):'}
                </span>

                {(!openQuestion.options || openQuestion.options.length === 0) ? (
                  <div className="text-sm text-stone-500 italic p-4 text-center">
                    No options recorded for this question.
                  </div>
                ) : (
                  <div className="grid gap-2.5">
                    {(() => {
                      if (openQuestion.options.length > 5) {
                        console.warn(`[ImportInboxView] Safety net triggered: question ${openQuestion.questionNumber} has ${openQuestion.options.length} options, expected <= 5.`);
                      }
                      return openQuestion.options.map((opt, i) => {
                        const isCorrect = isOptionCorrect(opt, i, openQuestion);
                        const isSelected = selectedOptionIdx === i;

                        // Style determination
                        let optionClasses = 'p-3 rounded-xl border-2 text-sm flex items-start gap-2.5 text-left transition-all';
                        let letterClasses = 'font-mono text-xs font-bold px-2 py-0.5 rounded';

                        if (!hasSubmitted) {
                          if (isSelected) {
                            optionClasses += ' border-blue-600 bg-blue-50/70 dark:bg-blue-950/40 text-blue-950 dark:text-blue-100 shadow-sm';
                            letterClasses += ' bg-blue-600 text-white';
                          } else {
                            optionClasses += ' border-stone-200 dark:border-stone-700 bg-stone-50/50 dark:bg-stone-800/40 text-stone-800 dark:text-stone-200 hover:border-stone-400 dark:hover:border-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer';
                            letterClasses += ' bg-stone-200 dark:bg-stone-700 text-stone-700 dark:text-stone-300';
                          }
                        } else {
                          // Submitted state
                          if (isCorrect && isSelected) {
                            optionClasses += ' border-[var(--mint)] bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-100';
                            letterClasses += ' bg-[var(--mint)] text-white';
                          } else if (!isCorrect && isSelected) {
                            optionClasses += ' border-rose-500 bg-rose-50 dark:bg-rose-950/40 text-rose-900 dark:text-rose-100';
                            letterClasses += ' bg-rose-500 text-white';
                          } else if (isCorrect && !isSelected) {
                            optionClasses += ' border-[var(--mint)] bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-200';
                            letterClasses += ' bg-[var(--mint)] text-white';
                          } else {
                            optionClasses += ' border-stone-200 dark:border-stone-800 bg-stone-50/30 dark:bg-stone-900/40 text-stone-400 dark:text-stone-600 opacity-60';
                            letterClasses += ' bg-stone-200/60 dark:bg-stone-800 text-stone-400 dark:text-stone-600';
                          }
                        }

                        return (
                          <div key={i} className="flex items-center gap-2">
                            <button
                              type="button"
                              disabled={hasSubmitted}
                              onClick={() => setSelectedOptionIdx(i)}
                              className={`flex-1 ${optionClasses}`}
                            >
                              <span className={letterClasses}>
                                {String.fromCharCode(65 + i)}
                              </span>
                              <span className="flex-1 leading-snug">{opt.text}</span>

                              {hasSubmitted && isCorrect && isSelected && (
                                <span className="text-xs font-bold text-[var(--mint)] px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/60 shrink-0">
                                  ✓ Correct!
                                </span>
                              )}
                              {hasSubmitted && !isCorrect && isSelected && (
                                <span className="text-xs font-bold text-rose-600 px-2 py-0.5 rounded bg-rose-100 dark:bg-rose-900/60 shrink-0">
                                  ✕ Wrong
                                </span>
                              )}
                              {hasSubmitted && isCorrect && !isSelected && (
                                <span className="text-xs font-bold text-[var(--mint)] px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/60 shrink-0">
                                  ✓ Correct Answer
                                </span>
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSetCorrectAnswer(openQuestion.questionNumber, i);
                              }}
                              className={`px-2 py-1.5 rounded-lg text-xs font-semibold border transition-colors shrink-0 ${
                                isCorrect
                                  ? 'bg-emerald-600 text-white border-emerald-600'
                                  : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 border-stone-300 dark:border-stone-700 hover:border-emerald-500'
                              }`}
                              title="Mark as correct answer"
                            >
                              {isCorrect ? '✓ Correct' : 'Set Correct'}
                            </button>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteOption(openQuestion.questionNumber, i);
                              }}
                              className="p-2 text-stone-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors shrink-0"
                              title="Delete extra option"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        );
                      });
                    })()}
                  </div>
                )}
              </div>

              {/* Submit / Retry Actions */}
              {!hasSubmitted ? (
                <div className="flex items-center justify-between pt-2">
                  <span className="text-xs text-stone-500 dark:text-stone-400">
                    {selectedOptionIdx !== null
                      ? `Option ${String.fromCharCode(65 + selectedOptionIdx)} selected`
                      : 'Choose an option to test your answer'}
                  </span>
                  <button
                    disabled={selectedOptionIdx === null}
                    onClick={() => setHasSubmitted(true)}
                    className="flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white shadow-sm transition-all"
                  >
                    <Check className="w-4 h-4" />
                    Check Answer
                  </button>
                </div>
              ) : (
                <div className="space-y-3 pt-2">
                  {/* Feedback Summary Banner */}
                  <div
                    className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs ${
                      selectedOptionIdx !== null && isOptionCorrect(openQuestion.options[selectedOptionIdx], selectedOptionIdx, openQuestion)
                        ? 'border-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-100'
                        : 'border-rose-300 bg-rose-50 dark:bg-rose-950/40 text-rose-900 dark:text-rose-100'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-medium">
                      {selectedOptionIdx !== null && isOptionCorrect(openQuestion.options[selectedOptionIdx], selectedOptionIdx, openQuestion) ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      ) : (
                        <X className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                      )}
                      <span>
                        {selectedOptionIdx !== null && isOptionCorrect(openQuestion.options[selectedOptionIdx], selectedOptionIdx, openQuestion)
                          ? 'Spot on! You picked the correct answer.'
                          : 'Not quite. Review the explanation below.'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 font-mono shrink-0">
                      <span>
                        Your Answer: <strong>{selectedOptionIdx !== null ? String.fromCharCode(65 + selectedOptionIdx) : 'None'}</strong>
                      </span>
                      <span>•</span>
                      <span>
                        Correct Answer: <strong>{
                          (() => {
                            const cIdx = openQuestion.options?.findIndex((o, idx) => isOptionCorrect(o, idx, openQuestion));
                            if (cIdx !== undefined && cIdx !== -1) {
                              return `${String.fromCharCode(65 + cIdx)}`;
                            }
                            return openQuestion.correctAnswer || 'Refer to solution';
                          })()
                        }</strong>
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      onClick={() => {
                        setHasSubmitted(false);
                        setSelectedOptionIdx(null);
                      }}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-600 dark:text-stone-300 flex items-center gap-1.5 transition-colors"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Try Again
                    </button>
                  </div>
                </div>
              )}

              {/* Explanation (Shown when submitted or if available) */}
              {hasSubmitted && openQuestion.explanation && (
                <div className="p-4 bg-stone-50 dark:bg-stone-800/40 rounded-xl border border-stone-200 dark:border-stone-800">
                  <span className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-1 block">
                    Explanation / Solution
                  </span>
                  <p className="text-xs text-stone-700 dark:text-stone-300 leading-relaxed whitespace-pre-wrap">
                    {openQuestion.explanation}
                  </p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t-2 border-stone-200 dark:border-stone-800 flex items-center justify-between bg-stone-50/80 dark:bg-stone-900/80">
              <div className="flex items-center gap-2">
                <button
                  disabled={!hasPrev}
                  onClick={handlePrevQuestion}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  Prev
                </button>
                {currentOpenIdx >= 0 && (
                  <span className="text-xs font-mono text-stone-500 dark:text-stone-400 px-1">
                    {currentOpenIdx + 1} / {filteredInbox.length}
                  </span>
                )}
                <button
                  disabled={!hasNext}
                  onClick={handleNextQuestion}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const idx = filteredInbox.findIndex((q) => q.questionNumber === openQuestion.questionNumber);
                    if (idx !== -1) {
                      setTriageIndex(idx);
                    }
                    setIsFastTriageOpen(true);
                    setOpenQuestion(null);
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-red-600 hover:text-white hover:bg-red-600 border border-red-200 dark:border-red-900 rounded-xl transition-colors"
                >
                  <Zap className="w-3.5 h-3.5" />
                  Triage This
                </button>

                <button
                  onClick={() => setOpenQuestion(null)}
                  className="px-4 py-2 text-xs font-semibold border border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300 rounded-xl transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FAST TRIAGE MODAL */}
      {isFastTriageOpen && currentTriageQuestion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between bg-stone-50 dark:bg-stone-900/80">
              <div className="flex items-center gap-3">
                <span className="p-2 bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400 rounded-lg">
                  <Zap className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
                    Fast Triage Mode
                    <span className="text-xs font-mono px-2 py-0.5 bg-stone-200 dark:bg-stone-800 rounded text-stone-700 dark:text-stone-300">
                      {triageIndex + 1} / {filteredInbox.length}
                    </span>
                  </h3>
                  <p className="text-xs text-stone-500">Use keys 1–4 for error type, text for rule, Enter to accept.</p>
                </div>
              </div>

              <button
                onClick={() => setIsFastTriageOpen(false)}
                className="p-2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {/* Question Statement */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-mono text-xs font-bold px-2 py-0.5 bg-stone-100 dark:bg-stone-800 rounded">
                    Q.{currentTriageQuestion.questionNumber}
                  </span>
                  <span className="text-xs px-2 py-0.5 bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 rounded">
                    {currentTriageQuestion.section}
                  </span>
                  {currentTriageQuestion.topic && (
                    <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 rounded">
                      {currentTriageQuestion.topic}
                    </span>
                  )}
                </div>
                <h4 className="text-base font-semibold text-stone-900 dark:text-stone-100 leading-relaxed">
                  {currentTriageQuestion.questionText}
                </h4>
                {currentTriageQuestion.questionImage && (
                  <img
                    src={currentTriageQuestion.questionImage}
                    alt="Question"
                    className="max-h-60 mt-3 rounded-lg border border-stone-200 dark:border-stone-800"
                  />
                )}
              </div>

              {/* Options */}
              {currentTriageQuestion.options && currentTriageQuestion.options.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-stone-400">Options</span>
                    {currentTriageQuestion.needsReview && (
                      <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
                        ⚠️ {currentTriageQuestion.reviewReason || 'Needs Review: Check options'}
                      </span>
                    )}
                  </div>
                  <div className="grid gap-2">
                    {(() => {
                      if (currentTriageQuestion.options.length > 5) {
                        console.warn(`[ImportInboxView] Safety net triggered: question ${currentTriageQuestion.questionNumber} has ${currentTriageQuestion.options.length} options, expected <= 5.`);
                      }
                      return currentTriageQuestion.options.map((opt, i) => {
                        const isCorrect = opt.isCorrect || opt.text === currentTriageQuestion.correctAnswer;
                        const isSelected = opt.isSelected || opt.text === currentTriageQuestion.selectedAnswer;
                        return (
                          <div
                            key={i}
                            className={`p-3 rounded-xl border text-sm flex items-center gap-2 ${
                              isCorrect
                                ? 'border-emerald-300 bg-emerald-50/60 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-200'
                                : isSelected
                                ? 'border-red-300 bg-red-50/60 dark:bg-red-950/20 text-red-900 dark:text-red-200'
                                : 'border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-200'
                            }`}
                          >
                            <span className="font-mono text-xs font-bold">{String.fromCharCode(65 + i)}.</span>
                            <span className="flex-1">{opt.text}</span>
                            {isCorrect && <span className="text-xs font-bold text-emerald-600 shrink-0">✓ Correct</span>}
                            {isSelected && !isCorrect && <span className="text-xs font-bold text-red-600 shrink-0">✕ Your Answer</span>}

                            <button
                              type="button"
                              onClick={() => handleSetCorrectAnswer(currentTriageQuestion.questionNumber, i)}
                              className={`px-2 py-1 rounded text-xs font-semibold border transition-colors shrink-0 ${
                                isCorrect
                                  ? 'bg-emerald-600 text-white border-emerald-600'
                                  : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 border-stone-300 dark:border-stone-700 hover:border-emerald-500'
                              }`}
                              title="Mark as correct answer"
                            >
                              {isCorrect ? 'Correct' : 'Set Correct'}
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteOption(currentTriageQuestion.questionNumber, i)}
                              className="p-1.5 text-stone-400 hover:text-rose-600 dark:hover:text-rose-400 rounded hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors shrink-0"
                              title="Delete extra option"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              )}

              {/* Solution */}
              {currentTriageQuestion.explanation && (
                <div className="p-4 bg-stone-50 dark:bg-stone-800/40 rounded-xl border border-stone-200 dark:border-stone-800">
                  <span className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-1 block">Solution / Explanation</span>
                  <p className="text-xs text-stone-700 dark:text-stone-300 leading-relaxed whitespace-pre-wrap">
                    {currentTriageQuestion.explanation}
                  </p>
                </div>
              )}

              {/* Error Classification Keyboard Hotkeys 1-4 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-stone-500">
                    Why did this mistake happen? (Press keys 1–4)
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {ERROR_TYPE_SHORTCUTS.map((shortcut) => {
                    const isSelected = selectedErrors.includes(shortcut.label);
                    return (
                      <button
                        key={shortcut.key}
                        onClick={() => {
                          setSelectedErrors((prev) =>
                            isSelected ? prev.filter((e) => e !== shortcut.label) : [...prev, shortcut.label]
                          );
                        }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                          isSelected
                            ? 'bg-red-600 text-white border-red-600 shadow-sm'
                            : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-700 hover:border-red-400'
                        }`}
                      >
                        <span className={`px-1 rounded text-[10px] font-mono ${isSelected ? 'bg-red-700 text-white' : 'bg-stone-200 dark:bg-stone-700 text-stone-600 dark:text-stone-300'}`}>
                          {shortcut.key}
                        </span>
                        {shortcut.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Rule to Remember Input */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-stone-500 block">
                  Rule to Remember (Key takeaway to avoid repeating this error)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Always check if Money Bill can be returned; apply A+B+AB/100..."
                  value={ruleToRemember}
                  onChange={(e) => setRuleToRemember(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
            </div>

            {/* Modal Footer Controls */}
            <div className="p-4 border-t border-stone-200 dark:border-stone-800 flex items-center justify-between bg-stone-50 dark:bg-stone-900">
              <button
                onClick={handleSkipQuestion}
                className="px-4 py-2 text-sm text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 font-medium rounded-xl transition-colors"
              >
                Skip Question <span className="text-xs font-mono opacity-60">[S]</span>
              </button>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleAcceptAndSave}
                  className="flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl shadow-md transition-colors"
                >
                  <Check className="w-4 h-4" />
                  Accept & Save to Mistakes
                  <span className="text-xs font-mono opacity-80">[Enter]</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};