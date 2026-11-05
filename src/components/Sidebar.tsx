import React from 'react';
import {
  X,
  Award,
  Home,
  BookOpen,
  FileQuestion,
  Notebook,
  Puzzle,
  Clock,
  Swords,
  GitFork,
  Globe2,
  CalendarDays,
  Flame,
  Minimize2,
  Maximize2
} from 'lucide-react';
import {
  MangaIconDashboard,
  MangaIconMocks,
  MangaIconPapers,
  MangaIconMistakes,
  MangaIconInbox,
  MangaIconReview,
  MangaIconPlanner,
  MangaIconCheatSheet,
  MangaIconSettings,
  MangaIconPlus,
  MangaIconSearch
} from './MangaIcons';
import { useTheme } from '../context/ThemeContext';
import { Mascot } from './Mascot';
import { calculateUserRank } from '../types';

export type NavTab =
  | 'home'
  | 'dashboard'
  | 'mocks'
  | 'papers'
  | 'mistakes'
  | 'inbox'
  | 'review'
  | 'planner'
  | 'study-planner'
  | 'syllabus'
  | 'pyq'
  | 'overlap'
  | 'notes'
  | 'patterns'
  | 'cheatsheet'
  | 'focus'
  | 'quests'
  | 'skill-tree'
  | 'all-exams'
  | 'settings';

interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  onOpenQuickAdd: () => void;
  onOpenSearch?: () => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  pendingReviewCount: number;
  masteredCount: number;
  isCompact?: boolean;
  onToggleCompact?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  onOpenQuickAdd,
  onOpenSearch,
  isOpenMobile,
  onCloseMobile,
  pendingReviewCount,
  masteredCount,
  isCompact = false,
  onToggleCompact
}) => {
  const { theme, toggleTheme } = useTheme();
  const rankInfo = calculateUserRank(masteredCount);

  const navGroups: Array<{
    title: string;
    items: Array<{
      id: NavTab;
      label: string;
      subLabel: string;
      icon: React.FC<{ className?: string }>;
      badge?: number;
      shortcutKey?: string;
    }>;
  }> = [
    {
      title: 'Study Loop',
      items: [
        { id: 'home', label: 'Command Center', subLabel: 'Daily Loop & XP', icon: Home, shortcutKey: 'H' },
        { id: 'quests', label: 'Quest Board', subLabel: 'Bounties & Boss', icon: Swords, shortcutKey: 'Q' },
        { id: 'review', label: 'Daily Review', subLabel: 'SRS Interleaved', icon: MangaIconReview, badge: pendingReviewCount, shortcutKey: 'R' },
        { id: 'focus', label: 'Focus Room', subLabel: 'Pomodoro & Beats', icon: Clock, shortcutKey: 'F' }
      ]
    },
    {
      title: 'Knowledge & Practice',
      items: [
        { id: 'mistakes', label: 'Mistake Log', subLabel: 'Error Intel', icon: MangaIconMistakes, shortcutKey: '4' },
        { id: 'pyq', label: 'PYQ Bank', subLabel: 'Previous Papers', icon: FileQuestion, shortcutKey: 'P' },
        { id: 'syllabus', label: 'Syllabus Tracker', subLabel: 'Rings & Coverage', icon: BookOpen, shortcutKey: 'S' },
        { id: 'overlap', label: 'Overlap Map', subLabel: 'CS Taxonomy', icon: GitFork, shortcutKey: 'O' },
        { id: 'notes', label: 'Study Notes', subLabel: 'KaTeX & Links', icon: Notebook, shortcutKey: 'N' },
        { id: 'patterns', label: 'Pattern Book', subLabel: 'Archetypes & Traps', icon: Puzzle, shortcutKey: 'B' },
        { id: 'cheatsheet', label: 'Formula Sheet', subLabel: 'Cheat Sheet', icon: MangaIconCheatSheet, shortcutKey: '8' }
      ]
    },
    {
      title: 'Planning & Analysis',
      items: [
        { id: 'mocks', label: 'Mock Log', subLabel: 'Attempt Analytics', icon: MangaIconMocks, shortcutKey: '2' },
        { id: 'papers', label: 'Papers Library', subLabel: 'Question Papers', icon: MangaIconPapers, shortcutKey: '3' },
        { id: 'planner', label: 'Score Strategy', subLabel: 'Break-even Math', icon: MangaIconPlanner, shortcutKey: '7' },
        { id: 'study-planner', label: 'Study Schedule', subLabel: 'Weekly Slots', icon: CalendarDays, shortcutKey: 'W' },
        { id: 'skill-tree', label: 'Skill Tree', subLabel: 'RPG Constellation', icon: Flame, shortcutKey: 'K' },
        { id: 'all-exams', label: 'All Exams', subLabel: 'GATE/SEBI/IBPS', icon: Globe2, shortcutKey: 'A' },
        { id: 'dashboard', label: 'Analytics', subLabel: 'Legacy Metrics', icon: MangaIconDashboard, shortcutKey: '1' },
        { id: 'inbox', label: 'Import Inbox', subLabel: 'Scanner Triage', icon: MangaIconInbox, shortcutKey: '5' },
        { id: 'settings', label: 'Settings', subLabel: 'Exam Profiles', icon: MangaIconSettings, shortcutKey: '9' }
      ]
    }
  ];

  const handleNavClick = (tab: NavTab) => {
    onSelectTab(tab);
    onCloseMobile();
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs lg:hidden transition-opacity"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar Panel */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-[var(--bg-panel)] border-r-3 border-[var(--ink-border)] flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full'
        } shadow-manga-lg`}
      >
        {/* Brand Header with Mascot */}
        <div className="p-3.5 border-b-2 border-[var(--ink-border)] flex items-center justify-between bg-[var(--bg-surface)]">
          <div className="flex items-center gap-2.5">
            <Mascot mood={pendingReviewCount > 10 ? 'thinking' : 'idle'} size="sm" />
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="font-display text-sm font-bold text-[var(--ink)] dark:text-[var(--text-main)] leading-tight">
                  Mistake Notebook
                </h1>
              </div>
              <span className="text-[10px] text-[var(--text-muted)] font-mono block">
                GATE CS • SEBI IT • IBPS SO
              </span>
            </div>
          </div>
          <button
            onClick={onCloseMobile}
            className="p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--text-main)] lg:hidden"
            aria-label="Close navigation"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Global Search Quick Trigger */}
        {onOpenSearch && (
          <div className="px-3 pt-2.5">
            <button
              onClick={onOpenSearch}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--action-primary)] text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors shadow-xs"
            >
              <span className="flex items-center gap-2">
                <MangaIconSearch className="w-3.5 h-3.5 text-[var(--action-primary)]" />
                <span className="text-[11px] font-medium">Command Palette...</span>
              </span>
              <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded-sm border border-[var(--border-subtle)] bg-[var(--bg-panel)]">
                ⌘K
              </kbd>
            </button>
          </div>
        )}

        {/* User Rank Card */}
        <div className="px-3 pt-2">
          <div className="p-2 rounded-xl bg-[var(--bg-surface)] border-2 border-[var(--ink-border)] shadow-manga-sm space-y-1">
            <div className="flex items-center justify-between text-[11px] font-bold">
              <span className="flex items-center gap-1 text-[var(--sakura)]">
                <Award className="w-3.5 h-3.5" />
                <span>{rankInfo.rank}</span>
              </span>
              <span className="text-[10px] font-retro text-[var(--text-muted)]">
                {masteredCount} Mastered
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-[var(--bg-panel)] border border-[var(--ink-border)] overflow-hidden">
              <div
                className="h-full bg-[var(--sakura)] transition-all duration-500 rounded-full"
                style={{ width: `${Math.min(100, rankInfo.progress)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Quick Add CTA */}
        <div className="p-2.5 px-3">
          <button
            onClick={() => {
              onOpenQuickAdd();
              onCloseMobile();
            }}
            className="manga-btn w-full py-1.5 px-3 rounded-xl bg-[var(--sakura)] text-[var(--ink)] font-bold text-xs flex items-center justify-between shadow-manga-sm hover:-translate-y-0.5 active:translate-y-0.5 transition-all"
            title="Quick Log Mistake (Press N)"
          >
            <span className="flex items-center gap-2">
              <MangaIconPlus className="w-3.5 h-3.5" />
              <span>Log Mistake</span>
            </span>
            <kbd className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-black/15 text-[var(--ink)] font-bold">
              N
            </kbd>
          </button>
        </div>

        {/* Grouped Navigation Items */}
        <nav className="flex-1 px-3 py-1 space-y-3 overflow-y-auto">
          {navGroups.map((group) => (
            <div key={group.title} className="space-y-0.5">
              <div className="px-2 pb-1 text-[9px] font-mono font-bold uppercase tracking-wider text-[var(--text-muted)] opacity-75">
                {group.title}
              </div>
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = currentTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavClick(item.id)}
                    className={`w-full flex items-center justify-between px-2.5 ${isCompact ? 'py-1' : 'py-1.5'} rounded-lg text-xs font-bold transition-all ${
                      isActive
                        ? 'bg-[var(--peach)] text-[var(--ink)] border-2 border-[var(--ink-border)] shadow-manga-sm'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-surface)] border-2 border-transparent'
                    }`}
                    title={item.shortcutKey ? `${item.label} (${item.shortcutKey})` : item.label}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Icon className="w-3.5 h-3.5 shrink-0" />
                      <div className="text-left truncate">
                        <span className="block leading-tight text-[11px] truncate">{item.label}</span>
                        {!isCompact && (
                          <span className="text-[8px] opacity-75 font-retro block truncate">{item.subLabel}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {item.badge !== undefined && item.badge > 0 && (
                        <span className="px-1.5 py-0.2 text-[9px] font-bold rounded-md bg-[var(--sakura)] text-[var(--ink)] border border-[var(--ink-border)] shadow-xs">
                          {item.badge}
                        </span>
                      )}
                      {item.shortcutKey && (
                        <kbd
                          className={`text-[8px] font-mono px-1 py-0.2 rounded border transition-colors ${
                            isActive
                              ? 'bg-[var(--bg-panel)]/60 border-[var(--ink-border)] text-[var(--ink)] font-bold'
                              : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-muted)]'
                          }`}
                        >
                          {item.shortcutKey}
                        </kbd>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Footer with Theme & Density Switchers */}
        <div className="p-2.5 px-3 border-t-2 border-[var(--ink-border)] bg-[var(--bg-surface)] flex items-center justify-between gap-1.5">
          {onToggleCompact && (
            <button
              onClick={onToggleCompact}
              className="p-1.5 rounded-lg border border-[var(--border-subtle)] hover:bg-[var(--bg-panel)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
              title={isCompact ? 'Comfortable Density' : 'Compact Density'}
              aria-label="Toggle layout density"
            >
              {isCompact ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
            </button>
          )}

          <div className="text-[9px] text-[var(--text-muted)] font-mono truncate">
            Local DB
          </div>

          <button
            onClick={toggleTheme}
            className="manga-btn px-2 py-1 rounded-lg bg-[var(--bg-panel)] border border-[var(--ink-border)] text-[10px] font-bold flex items-center gap-1 text-[var(--ink)] dark:text-[var(--text-main)]"
            title={theme === 'dark' ? 'Switch to Morning Theme' : 'Switch to Night Theme'}
          >
            <span>{theme === 'dark' ? '☀️ Day' : '🌙 Night'}</span>
          </button>
        </div>
      </aside>
    </>
  );
};
