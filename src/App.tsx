import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { db, ensureSettings, DEFAULT_SETTINGS } from './db/db';
import { ExamSettings, MockTest, MistakeEntry, PaperTest, StudyTask, StudyBridgeImportPayload } from './types';
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

// Route-level code-splitting
const DashboardView = React.lazy(() => import('./components/DashboardView').then((m) => ({ default: m.DashboardView })));
const MocksView = React.lazy(() => import('./components/MocksView').then((m) => ({ default: m.MocksView })));
const MistakesView = React.lazy(() => import('./components/MistakesView').then((m) => ({ default: m.MistakesView })));
const PapersView = React.lazy(() => import('./components/PapersView').then((m) => ({ default: m.PapersView })));
const ImportInboxView = React.lazy(() => import('./components/ImportInboxView').then((m) => ({ default: m.ImportInboxView })));
const ReviewQueueView = React.lazy(() => import('./components/ReviewQueueView').then((m) => ({ default: m.ReviewQueueView })));
const PlannerView = React.lazy(() => import('./components/PlannerView').then((m) => ({ default: m.PlannerView })));
const CheatSheetView = React.lazy(() => import('./components/CheatSheetView').then((m) => ({ default: m.CheatSheetView })));
const SettingsView = React.lazy(() => import('./components/SettingsView').then((m) => ({ default: m.SettingsView })));

// Lazy-loaded dialogs & modals
const DataIntakeModal = React.lazy(() => import('./components/DataIntakeModal').then((m) => ({ default: m.DataIntakeModal })));
const GlobalSearchModal = React.lazy(() => import('./components/GlobalSearchModal').then((m) => ({ default: m.GlobalSearchModal })));
const KeyboardShortcutsModal = React.lazy(() => import('./components/KeyboardShortcutsModal').then((m) => ({ default: m.KeyboardShortcutsModal })));

export function App() {
  const { theme, toggleTheme } = useTheme();
  const shouldReduceMotion = useReducedMotion();
  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [isDataIntakeOpen, setIsDataIntakeOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [studyBridgePayload, setStudyBridgePayload] = useState<StudyBridgeImportPayload | null>(null);

  // Listen for StudyBridge extension import messages
  useEffect(() => {
    const handleStudyBridgeMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || data.type !== 'STUDYBRIDGE_IMPORT') return;

      const validation = validateStudyBridgePayload(data);
      if (!validation.isValid || !validation.payload) {
        console.warn('StudyBridge import payload rejected:', validation.error);
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

      setStudyBridgePayload(payload);
      setIsDataIntakeOpen(true);
      setCurrentTab('inbox');
    };

    window.addEventListener('message', handleStudyBridgeMessage);
    return () => window.removeEventListener('message', handleStudyBridgeMessage);
  }, []);

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
    } catch (err) {
      console.error('Failed to load database:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    reloadData();
  }, [reloadData]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 1. Omni Search: Cmd+K / Ctrl+K
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
        return;
      }

      // 2. Escape closes topmost open overlay
      if (e.key === 'Escape') {
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

      // 5. Number keys 1-9 for Instant Tab Switching
      const tabKeyMap: Record<string, NavTab> = {
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

      if (tabKeyMap[e.key]) {
        e.preventDefault();
        setCurrentTab(tabKeyMap[e.key]);
        return;
      }

      // 6. Action hotkeys: N or M for Mistake, I for Intake, T for Theme
      const key = e.key.toLowerCase();
      if (key === 'n' || key === 'm') {
        e.preventDefault();
        setCurrentTab('mistakes');
        setIsQuickAddOpen(true);
      } else if (key === 'i') {
        e.preventDefault();
        setIsDataIntakeOpen(true);
      } else if (key === 't') {
        e.preventDefault();
        toggleTheme();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
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
        onOpenSearch={() => setIsSearchOpen(true)}
        isOpenMobile={isMobileNavOpen}
        onCloseMobile={() => setIsMobileNavOpen(false)}
        pendingReviewCount={pendingReviewCount}
        masteredCount={masteredCount}
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
            <div className="flex items-center gap-2 truncate">
              <span className="font-display text-xs font-black px-2.5 py-1 rounded-lg bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-subtle)] shadow-manga-sm hidden sm:inline-block truncate max-w-[200px]">
                {settings.examName}
              </span>
              <span className="text-xs text-[var(--text-muted)] font-mono hidden md:inline-block truncate">
                Target: <strong className="text-[var(--text-primary)]">{settings.targetScore}</strong> • Cutoff: <strong className="text-[var(--text-primary)]">{settings.overallCutoff}</strong>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            {/* Global Search Header Button */}
            <button
              onClick={() => setIsSearchOpen(true)}
              className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border-2 border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:border-[var(--action-primary)] text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all shadow-xs"
              title="Search mocks, mistakes, papers, tasks (Cmd+K)"
            >
              <MangaIconSearch className="w-3.5 h-3.5 text-[var(--action-primary)]" />
              <span>Search...</span>
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

                {currentTab === 'cheatsheet' && (
                  <CheatSheetView
                    mistakes={mistakes}
                    settings={settings}
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
    </div>
  );
}
