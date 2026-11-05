import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { db, ensureSettings, DEFAULT_SETTINGS } from './db/db';
import { ExamSettings, MockTest, MistakeEntry, PaperTest, StudyTask, StudyBridgeImportPayload, ImportBatch } from './types';
import { validateStudyBridgePayload } from './utils/dataIntake';
import { Sidebar, NavTab } from './components/Sidebar';
import { LivingSky } from './components/LivingSky';
import { useTheme } from './context/ThemeContext';
import { getTodayDateStr } from './utils/srs';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  Menu,
  Moon,
  Sun,
  PlusCircle,
  FileInput,
  Search,
  Keyboard,
  Inbox
} from 'lucide-react';
import { MangaIconPlus, MangaIconSearch, MangaIconInbox } from './components/MangaIcons';
import { ExamSwitcher } from './exams/ExamSwitcher';
import { switchProfile } from './db/db';

// Route-level code-splitting
const HomeView = React.lazy(() => import('./components/HomeView').then((m) => ({ default: m.HomeView })));
const DashboardView = React.lazy(() => import('./components/DashboardView').then((m) => ({ default: m.DashboardView })));
const MocksView = React.lazy(() => import('./components/MocksView').then((m) => ({ default: m.MocksView })));
const MistakesView = React.lazy(() => import('./components/MistakesView').then((m) => ({ default: m.MistakesView })));
const PapersView = React.lazy(() => import('./components/PapersView').then((m) => ({ default: m.PapersView })));
const ImportInboxView = React.lazy(() => import('./components/ImportInboxView').then((m) => ({ default: m.ImportInboxView })));
const ReviewQueueView = React.lazy(() => import('./components/ReviewQueueView').then((m) => ({ default: m.ReviewQueueView })));
const PlannerView = React.lazy(() => import('./components/PlannerView').then((m) => ({ default: m.PlannerView })));
const StudyPlannerView = React.lazy(() => import('./components/StudyPlannerView').then((m) => ({ default: m.StudyPlannerView })));
const SyllabusView = React.lazy(() => import('./components/SyllabusView').then((m) => ({ default: m.SyllabusView })));
const PYQView = React.lazy(() => import('./components/PYQView').then((m) => ({ default: m.PYQView })));
const OverlapMap = React.lazy(() => import('./components/OverlapMap').then((m) => ({ default: m.OverlapMap })));
const NotesView = React.lazy(() => import('./components/NotesView').then((m) => ({ default: m.NotesView })));
const PatternsView = React.lazy(() => import('./components/PatternsView').then((m) => ({ default: m.PatternsView })));
const CheatSheetView = React.lazy(() => import('./components/CheatSheetView').then((m) => ({ default: m.CheatSheetView })));
const FocusView = React.lazy(() => import('./components/FocusView').then((m) => ({ default: m.FocusView })));
const QuestsView = React.lazy(() => import('./components/QuestsView').then((m) => ({ default: m.QuestsView })));
const SkillTreeView = React.lazy(() => import('./components/SkillTreeView').then((m) => ({ default: m.SkillTreeView })));
const AllExamsView = React.lazy(() => import('./exams/AllExamsView').then((m) => ({ default: m.AllExamsView })));
const SettingsView = React.lazy(() => import('./components/SettingsView').then((m) => ({ default: m.SettingsView })));

// Lazy-loaded dialogs & modals
const DataIntakeModal = React.lazy(() => import('./components/DataIntakeModal').then((m) => ({ default: m.DataIntakeModal })));
const GlobalSearchModal = React.lazy(() => import('./components/GlobalSearchModal').then((m) => ({ default: m.GlobalSearchModal })));
const KeyboardShortcutsModal = React.lazy(() => import('./components/KeyboardShortcutsModal').then((m) => ({ default: m.KeyboardShortcutsModal })));
const CommandPalette = React.lazy(() => import('./components/CommandPalette').then((m) => ({ default: m.CommandPalette })));
const BossBattleModal = React.lazy(() => import('./components/BossBattleModal').then((m) => ({ default: m.BossBattleModal })));

export function App() {
  const { theme, toggleTheme } = useTheme();
  const shouldReduceMotion = useReducedMotion();
  const [currentTab, setCurrentTab] = useState<NavTab>('home');
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [isDataIntakeOpen, setIsDataIntakeOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isBossBattleOpen, setIsBossBattleOpen] = useState(false);
  const [isCompactDensity, setIsCompactDensity] = useState<boolean>(() => {
    return localStorage.getItem('studybridge_compact_density') === 'true';
  });
  const [focusSessionConfig, setFocusSessionConfig] = useState<{
    title: string;
    type: any;
    durationMinutes: number;
  } | null>(null);
  const [studyBridgePayload, setStudyBridgePayload] = useState<StudyBridgeImportPayload | null>(null);

  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'info' | 'warning' } | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string, type: 'success' | 'info' | 'warning' = 'success') => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setToast({ msg, type });
    toastTimeoutRef.current = setTimeout(() => {
      setToast(null);
      toastTimeoutRef.current = null;
    }, 4000);
  }, []);

  // Listen for StudyBridge extension import messages
  useEffect(() => {
    const handleStudyBridgeMessage = async (event: MessageEvent) => {
      const data = event.data;
      if (!data || data.type !== 'STUDYBRIDGE_IMPORT') return;

      const validation = validateStudyBridgePayload(data);
      if (!validation.isValid || !validation.payload) {
        window.postMessage(
          {
            type: 'STUDYBRIDGE_IMPORT_ACK',
            id: data.payload?.id || 'unknown',
            status: 'error',
            error: validation.error
          },
          '*'
        );
        return;
      }

      const payload = validation.payload;
      // Send immediate receipt acknowledgement
      window.postMessage(
        {
          type: 'STUDYBRIDGE_IMPORT_ACK',
          id: payload.id,
          status: 'received'
        },
        '*'
      );

      // Deduplication check for fullscan payload against db.importBatches
      if (payload.mode === 'fullscan' || payload.scanData) {
        const mockName = payload.scanData?.mockName || payload.text?.substring(0, 60) || 'Mock Test';
        const todayDateStr = new Date().toISOString().split('T')[0];
        const capturedDateStr = payload.capturedAt ? payload.capturedAt.split('T')[0] : todayDateStr;

        try {
          const existingBatches = await db.importBatches.toArray();
          const duplicate = existingBatches.find((b) => {
            const bDate = b.importedAt ? b.importedAt.split('T')[0] : '';
            return b.mockName === mockName && (bDate === todayDateStr || bDate === capturedDateStr);
          });

          if (duplicate) {
            showToast(`Already imported this scan (${mockName}) — skipped`, 'warning');
            return;
          }

          const untriagedCount = (payload.scanData?.questions || []).filter(
            (q) => q.statusBadge === 'Wrong' || q.statusBadge === 'Skipped'
          ).length;

          await db.importBatches.add({
            source: payload.source?.platform || 'extension',
            mockName: payload.scanData?.mockName || payload.text?.substring(0, 60),
            importedAt: new Date().toISOString(),
            totalQuestions: payload.scanData?.totalQuestions || 0,
            untriagedCount,
            status: 'pending'
          } as ImportBatch);
        } catch {
          // Fallback if db read/write errors
        }
      }

      setStudyBridgePayload(payload);
      const untriagedCount = (payload.scanData?.questions || []).filter(
        (q) => q.statusBadge === 'Wrong' || q.statusBadge === 'Skipped'
      ).length;
      const qCount = untriagedCount > 0 ? untriagedCount : payload.scanData?.totalQuestions || 0;
      showToast(`Scan imported — ${qCount} questions queued in Import Inbox`, 'success');
      setCurrentTab('inbox');
    };

    window.addEventListener('message', handleStudyBridgeMessage);
    return () => window.removeEventListener('message', handleStudyBridgeMessage);
  }, [showToast]);

  const handleStudyBridgeAck = (id: string, status: 'saved' | 'cancelled') => {
    window.postMessage(
      {
        type: 'STUDYBRIDGE_IMPORT_ACK',
        id,
        status
      },
      '*'
    );
  };

  // App State from Dexie
  const [settings, setSettings] = useState<ExamSettings>(DEFAULT_SETTINGS);
  const [mocks, setMocks] = useState<MockTest[]>([]);
  const [mistakes, setMistakes] = useState<MistakeEntry[]>([]);
  const [papers, setPapers] = useState<PaperTest[]>([]);
  const [tasks, setTasks] = useState<StudyTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const reloadData = useCallback(async () => {
    try {
      const s = await ensureSettings();
      const mks = await db.mocks.orderBy('date').toArray();
      const mst = await db.mistakes.toArray();
      const pps = await db.papers.toArray();
      const tsk = await db.tasks.toArray();
      setSettings(s);
      setMocks(mks);
      setMistakes(mst);
      setPapers(pps);
      setTasks(tsk);
    } catch {
      // Database load error handled gracefully
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    reloadData();
  }, [reloadData]);

  const handleSelectExam = async (examId: string, stageId?: string) => {
    try {
      const updated = await switchProfile(examId, stageId);
      setSettings(updated);
      await reloadData();
      showToast(`Switched active exam to ${updated.examName}`, 'info');
    } catch (err: any) {
      showToast(err.message || 'Failed to switch exam', 'warning');
    }
  };

  const toggleCompactDensity = () => {
    setIsCompactDensity((prev) => {
      const next = !prev;
      localStorage.setItem('studybridge_compact_density', String(next));
      return next;
    });
  };

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 1. Omni Search / Command Palette: Cmd+K / Ctrl+K
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
        return;
      }

      // 2. Escape closes topmost open overlay
      if (e.key === 'Escape') {
        if (isCommandPaletteOpen) {
          setIsCommandPaletteOpen(false);
          return;
        }
        if (isBossBattleOpen) {
          setIsBossBattleOpen(false);
          return;
        }
        if (isShortcutsOpen) {
          setIsShortcutsOpen(false);
          return;
        }
        if (isSearchOpen) {
          setIsSearchOpen(false);
          return;
        }
        if (isDataIntakeOpen) {
          setIsDataIntakeOpen(false);
          return;
        }
        if (isQuickAddOpen) {
          setIsQuickAddOpen(false);
          return;
        }
        if (isMobileNavOpen) {
          setIsMobileNavOpen(false);
          return;
        }
      }

      // 3. Ignore single-key shortcuts when typing in inputs/textareas
      const activeEl = document.activeElement;
      const isInput =
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          activeEl.tagName === 'SELECT' ||
          activeEl.getAttribute('contenteditable') === 'true');

      if (isInput || e.metaKey || e.ctrlKey || e.altKey) {
        return;
      }

      // 4. Question mark (?) to toggle Shortcuts cheat-sheet
      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault();
        setIsShortcutsOpen((prev) => !prev);
        return;
      }

      // 5. Hotkeys for Instant Tab Switching
      const tabKeyMap: Record<string, NavTab> = {
        h: 'home',
        q: 'quests',
        r: 'review',
        f: 'focus',
        p: 'pyq',
        s: 'syllabus',
        o: 'overlap',
        n: 'notes',
        b: 'patterns',
        '1': 'dashboard',
        '2': 'mocks',
        '3': 'papers',
        '4': 'mistakes',
        '5': 'inbox',
        '6': 'review',
        '7': 'planner',
        '8': 'cheatsheet',
        '9': 'settings'
      };

      const lowerKey = e.key.toLowerCase();
      if (tabKeyMap[lowerKey]) {
        e.preventDefault();
        setCurrentTab(tabKeyMap[lowerKey]);
        return;
      }

      // 6. Action hotkeys: M for Mistake, I for Intake, T for Theme
      if (lowerKey === 'm') {
        e.preventDefault();
        setCurrentTab('mistakes');
        setIsQuickAddOpen(true);
      } else if (lowerKey === 'i') {
        e.preventDefault();
        setIsDataIntakeOpen(true);
      } else if (lowerKey === 't') {
        e.preventDefault();
        toggleTheme();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isCommandPaletteOpen,
    isBossBattleOpen,
    isShortcutsOpen,
    isSearchOpen,
    isDataIntakeOpen,
    isQuickAddOpen,
    isMobileNavOpen,
    toggleTheme
  ]);

  const todayStr = getTodayDateStr();
  const pendingReviewCount = mistakes.filter(
    (m) => m.status !== 'Mastered' && m.nextReviewDate <= todayStr
  ).length;

  const masteredCount = mistakes.filter((m) => m.status === 'Mastered').length;

  const handleToggleTask = async (taskId: number) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    await db.tasks.update(taskId, {
      isCompleted: !task.isCompleted,
      updatedAt: new Date().toISOString()
    });
    await reloadData();
  };

  const handleDeleteTask = async (taskId: number) => {
    await db.tasks.delete(taskId);
    await reloadData();
  };

  const handleAddTask = async (newTask: Omit<StudyTask, 'id' | 'createdAt'>) => {
    await db.tasks.add({
      ...newTask,
      createdAt: new Date().toISOString()
    });
    await reloadData();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-sky)] text-[var(--text-muted)] text-xs font-mono">
        <div className="flex items-center gap-3 p-4 rounded-xl border-2 border-[var(--border-subtle)] bg-[var(--bg-panel)] shadow-manga">
          <div className="w-5 h-5 border-2 border-[var(--action-primary)] border-t-transparent rounded-full animate-spin" />
          <span className="font-bold">Opening local IndexedDB database...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative flex flex-col bg-[var(--bg-sky)] text-[var(--text-primary)] selection:bg-[var(--action-primary)] selection:text-white">
      {/* Living Sky Animated Background (Clouds, Stars, Falling Sakura) */}
      <LivingSky />

      {/* Sidebar Navigation */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={(tab) => setCurrentTab(tab)}
        onOpenQuickAdd={() => setIsQuickAddOpen(true)}
        onOpenSearch={() => setIsCommandPaletteOpen(true)}
        isOpenMobile={isMobileNavOpen}
        onCloseMobile={() => setIsMobileNavOpen(false)}
        pendingReviewCount={pendingReviewCount}
        masteredCount={masteredCount}
        isCompact={isCompactDensity}
        onToggleCompact={toggleCompactDensity}
      />

      {/* Main Content Area */}
      <div className="lg:pl-64 flex-1 flex flex-col z-10 relative max-w-full overflow-x-hidden">
        {/* Top Header Bar */}
        <header className="h-16 bg-[var(--bg-panel)]/90 backdrop-blur-md border-b-2 border-[var(--border-subtle)] sticky top-0 z-30 px-3 sm:px-6 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              onClick={() => setIsMobileNavOpen(true)}
              className="p-2 rounded-xl border-2 border-[var(--border-subtle)] text-[var(--text-primary)] hover:bg-[var(--bg-surface)] lg:hidden shrink-0"
              aria-label="Open mobile navigation"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 min-w-0">
              <ExamSwitcher
                currentExamId={settings.currentExamId || 'gate-cs'}
                currentStageId={settings.currentStageId}
                onSelectExam={handleSelectExam}
                onSelectStage={(stageId) => handleSelectExam(settings.currentExamId || 'gate-cs', stageId)}
                compact
              />
              <span className="text-xs text-[var(--text-muted)] font-mono hidden xl:inline-block truncate">
                Target: <strong className="text-[var(--text-primary)]">{settings.targetScore}</strong> • Cutoff: <strong className="text-[var(--text-primary)]">{settings.overallCutoff}</strong>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            {/* Command Palette Trigger Button */}
            <button
              onClick={() => setIsCommandPaletteOpen(true)}
              className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border-2 border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:border-[var(--action-primary)] text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all shadow-xs"
              title="Command Palette (Cmd+K)"
            >
              <MangaIconSearch className="w-3.5 h-3.5 text-[var(--action-primary)]" />
              <span>Commands...</span>
              <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded-sm border border-[var(--border-subtle)] bg-[var(--bg-panel)]">
                ⌘K
              </kbd>
            </button>

            {/* Keyboard Shortcuts Trigger Button */}
            <button
              onClick={() => setIsShortcutsOpen(true)}
              className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border-2 border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-panel)] text-[var(--text-primary)] text-xs font-bold shadow-manga-sm hover:-translate-y-0.5 active:translate-y-0.5 transition-all"
              title="Keyboard Shortcuts Guide (Press ?)"
              aria-label="Keyboard Shortcuts"
            >
              <Keyboard className="w-4 h-4 text-[var(--action-primary)]" />
              <kbd className="text-[10px] font-mono px-1.5 py-0.2 rounded-sm border border-[var(--border-subtle)] bg-[var(--bg-panel)] text-[var(--text-muted)] font-bold">
                ?
              </kbd>
            </button>

            {/* Import Inbox Button */}
            <button
              onClick={() => setCurrentTab('inbox')}
              className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl border-2 text-xs font-bold shadow-manga-sm hover:-translate-y-0.5 active:translate-y-0.5 transition-all ${
                currentTab === 'inbox'
                  ? 'border-[var(--ink-border)] bg-[var(--peach)] text-[var(--ink)]'
                  : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-panel)] text-[var(--text-primary)]'
              }`}
              title="Import Inbox (Press 5)"
            >
              <MangaIconInbox className="w-4 h-4 text-[var(--peach)]" />
              <span className="hidden sm:inline">Inbox</span>
            </button>

            {/* Real Data Intake Button */}
            <button
              onClick={() => setIsDataIntakeOpen(true)}
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl border-2 border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-panel)] text-[var(--text-primary)] text-xs font-bold shadow-manga-sm hover:-translate-y-0.5 active:translate-y-0.5 transition-all"
              title="Import CSV, Paste Testbook text, or restore JSON (Press I)"
            >
              <FileInput className="w-4 h-4 text-[var(--action-primary)]" />
              <span className="hidden sm:inline">Intake</span>
              <span className="sm:hidden">Import</span>
              <kbd className="hidden md:inline-block text-[10px] font-mono px-1 py-0.2 rounded-sm border border-[var(--border-subtle)] bg-[var(--bg-panel)] text-[var(--text-muted)] font-bold">
                I
              </kbd>
            </button>

            {/* Quick Log Mistake */}
            <button
              onClick={() => {
                setCurrentTab('mistakes');
                setIsQuickAddOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-xl border-2 border-[var(--ink-border)] bg-[var(--sakura)] text-white text-xs font-bold shadow-manga-sm hover:-translate-y-0.5 active:translate-y-0.5 transition-all"
              title="Quick Log Mistake (Press N)"
            >
              <MangaIconPlus className="w-4 h-4" />
              <span className="hidden sm:inline">Log Mistake</span>
              <kbd className="hidden sm:inline-block text-[10px] font-mono px-1.5 py-0.2 rounded-sm bg-black/20 text-white font-bold">
                N
              </kbd>
            </button>

            {/* Theme Toggle (Night / Morning) */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl border-2 border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-primary)] hover:bg-[var(--bg-panel)] shadow-manga-sm transition-all"
              title={`Switch to ${theme === 'dark' ? 'Morning' : 'Night'} theme (Press T)`}
              aria-label="Toggle Theme"
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-[var(--action-primary)]" />
              )}
            </button>
          </div>
        </header>

        {/* View Switcher Container with Page Transitions & Lazy Suspense */}
        <main className="flex-1 p-3 sm:p-6 lg:p-8 max-w-full overflow-x-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentTab}
              initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: -8 }}
              transition={{ duration: 0.16, ease: 'easeOut' }}
            >
              <Suspense
                fallback={
                  <div className="flex flex-col items-center justify-center p-12 space-y-3">
                    <div className="w-8 h-8 rounded-full border-3 border-[var(--ink-border)] border-t-[var(--sakura)] animate-spin" />
                    <span className="text-xs font-bold text-[var(--text-muted)] font-mono">Loading module...</span>
                  </div>
                }
              >
                {currentTab === 'home' && (
                  <HomeView
                    onNavigateTab={(tab) => setCurrentTab(tab as NavTab)}
                    onOpenQuickAdd={() => {
                      setCurrentTab('mistakes');
                      setIsQuickAddOpen(true);
                    }}
                    onOpenFocus={() => setCurrentTab('focus')}
                    onOpenBossBattle={() => setIsBossBattleOpen(true)}
                  />
                )}

                {currentTab === 'dashboard' && (
                  <DashboardView
                    mocks={mocks}
                    mistakes={mistakes}
                    papers={papers}
                    tasks={tasks}
                    settings={settings}
                    onNavigateToTab={(tab) => setCurrentTab(tab)}
                    onOpenQuickAdd={() => setIsQuickAddOpen(true)}
                    onOpenDataIntake={() => setIsDataIntakeOpen(true)}
                    onToggleTask={handleToggleTask}
                  />
                )}

                {currentTab === 'mocks' && (
                  <MocksView
                    mocks={mocks}
                    settings={settings}
                    onRefresh={reloadData}
                    onOpenDataIntake={() => setIsDataIntakeOpen(true)}
                  />
                )}

                {currentTab === 'papers' && (
                  <PapersView
                    papers={papers}
                    settings={settings}
                    onRefresh={reloadData}
                    onNavigateToMocks={() => setCurrentTab('mocks')}
                  />
                )}

                {currentTab === 'mistakes' && (
                  <MistakesView
                    mistakes={mistakes}
                    mocks={mocks}
                    settings={settings}
                    onRefresh={reloadData}
                    isQuickAddOpenDirectly={isQuickAddOpen}
                    onCloseQuickAddDirectly={() => setIsQuickAddOpen(false)}
                  />
                )}

                {currentTab === 'inbox' && (
                  <ImportInboxView
                    initialPayload={studyBridgePayload}
                    onNavigateToMistakes={() => setCurrentTab('mistakes')}
                    onNavigateToMocks={() => setCurrentTab('mocks')}
                  />
                )}

                {currentTab === 'review' && (
                  <ReviewQueueView
                    mistakes={mistakes}
                    settings={settings}
                    onRefresh={reloadData}
                  />
                )}

                {currentTab === 'planner' && (
                  <PlannerView
                    settings={settings}
                    mocks={mocks}
                    mistakes={mistakes}
                    papers={papers}
                    tasks={tasks}
                    onAddTask={handleAddTask}
                    onToggleTask={handleToggleTask}
                    onDeleteTask={handleDeleteTask}
                  />
                )}

                {currentTab === 'study-planner' && (
                  <StudyPlannerView
                    mistakes={mistakes}
                    onStartFocus={(session) => {
                      setFocusSessionConfig(session);
                      setCurrentTab('focus');
                    }}
                    onNavigateTab={(tab) => setCurrentTab(tab as NavTab)}
                  />
                )}

                {currentTab === 'syllabus' && (
                  <SyllabusView
                    initialExamId={settings.currentExamId || 'gate-cs'}
                    initialStage={settings.currentStageId}
                    onNavigate={(tab) => setCurrentTab(tab as NavTab)}
                  />
                )}

                {currentTab === 'pyq' && (
                  <PYQView
                    initialExamId={settings.currentExamId || 'all'}
                    onNavigate={(tab) => setCurrentTab(tab as NavTab)}
                  />
                )}

                {currentTab === 'overlap' && (
                  <OverlapMap
                    onNavigate={(tab) => setCurrentTab(tab as NavTab)}
                  />
                )}

                {currentTab === 'notes' && (
                  <NotesView
                    onRefresh={reloadData}
                  />
                )}

                {currentTab === 'patterns' && (
                  <PatternsView
                    onRefresh={reloadData}
                  />
                )}

                {currentTab === 'cheatsheet' && (
                  <CheatSheetView
                    mistakes={mistakes}
                    settings={settings}
                  />
                )}

                {currentTab === 'focus' && (
                  <FocusView
                    initialSessionTitle={focusSessionConfig?.title}
                    initialSessionType={focusSessionConfig?.type}
                    initialDurationMinutes={focusSessionConfig?.durationMinutes}
                  />
                )}

                {currentTab === 'quests' && (
                  <QuestsView
                    onOpenBossBattle={() => setIsBossBattleOpen(true)}
                    onNavigateTab={(tab) => setCurrentTab(tab as NavTab)}
                  />
                )}

                {currentTab === 'skill-tree' && (
                  <SkillTreeView />
                )}

                {currentTab === 'all-exams' && (
                  <AllExamsView
                    onSelectExam={handleSelectExam}
                    onNavigateToSettings={() => setCurrentTab('settings')}
                  />
                )}

                {currentTab === 'settings' && (
                  <SettingsView
                    settings={settings}
                    onSettingsSaved={(newS) => setSettings(newS)}
                    onDataResetOrLoaded={reloadData}
                    onOpenDataIntake={() => setIsDataIntakeOpen(true)}
                  />
                )}
              </Suspense>
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Command Palette (Cmd+K) */}
      <Suspense fallback={null}>
        <CommandPalette
          isOpen={isCommandPaletteOpen}
          onClose={() => setIsCommandPaletteOpen(false)}
          onSelectTab={(tab) => {
            setCurrentTab(tab);
            setIsCommandPaletteOpen(false);
          }}
          onOpenQuickAdd={() => {
            setCurrentTab('mistakes');
            setIsQuickAddOpen(true);
            setIsCommandPaletteOpen(false);
          }}
          onToggleTheme={toggleTheme}
          isCompactDensity={isCompactDensity}
          onToggleDensity={toggleCompactDensity}
          onProfileChanged={() => reloadData()}
        />
      </Suspense>

      {/* Boss Battle Modal */}
      <Suspense fallback={null}>
        <BossBattleModal
          isOpen={isBossBattleOpen}
          onClose={() => setIsBossBattleOpen(false)}
          onVictory={(xp) => {
            showToast(`Boss Defeated! +${xp} XP`, 'success');
            setIsBossBattleOpen(false);
          }}
        />
      </Suspense>

      {/* Global Search Modal */}
      <Suspense fallback={null}>
        <GlobalSearchModal
          isOpen={isSearchOpen}
          onClose={() => setIsSearchOpen(false)}
          onNavigate={(tab) => setCurrentTab(tab)}
          mocks={mocks}
          mistakes={mistakes}
          papers={papers}
          tasks={tasks}
          settings={settings}
        />
      </Suspense>

      {/* Data Intake Hub Modal */}
      <Suspense fallback={null}>
        <DataIntakeModal
          isOpen={isDataIntakeOpen}
          onClose={() => {
            setIsDataIntakeOpen(false);
            setStudyBridgePayload(null);
          }}
          settings={settings}
          onSuccess={() => reloadData()}
          initialImportPayload={studyBridgePayload}
          onImportAck={handleStudyBridgeAck}
        />
      </Suspense>

      {/* Keyboard Shortcuts Cheat-sheet Modal */}
      <Suspense fallback={null}>
        <KeyboardShortcutsModal
          isOpen={isShortcutsOpen}
          onClose={() => setIsShortcutsOpen(false)}
        />
      </Suspense>

      {/* Global Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl bg-[var(--bg-panel)] border-2 border-[var(--ink-border)] shadow-manga text-xs font-bold text-[var(--ink)] dark:text-[var(--text-main)]">
          <span className={toast.type === 'warning' ? 'text-amber-500' : 'text-[var(--mint)]'}>
            {toast.type === 'warning' ? '⚠' : '✓'}
          </span>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
