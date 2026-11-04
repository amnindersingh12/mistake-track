import React from 'react';
import {
  X,
  Flame,
  Award,
  Sparkles
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

export type NavTab = 'dashboard' | 'mocks' | 'papers' | 'mistakes' | 'inbox' | 'review' | 'planner' | 'cheatsheet' | 'settings';

interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  onOpenQuickAdd: () => void;
  onOpenSearch?: () => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  pendingReviewCount: number;
  masteredCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  onOpenQuickAdd,
  onOpenSearch,
  isOpenMobile,
  onCloseMobile,
  pendingReviewCount,
  masteredCount
}) => {
  const { theme, toggleTheme } = useTheme();
  const rankInfo = calculateUserRank(masteredCount);

  const navItems: Array<{
    id: NavTab;
    label: string;
    subLabel: string;
    icon: React.FC<{ className?: string }>;
    badge?: number;
    shortcutKey: string;
  }> = [
    { id: 'dashboard', label: 'Dashboard', subLabel: 'Command Centre', icon: MangaIconDashboard, shortcutKey: '1' },
    { id: 'mocks', label: 'Mock Log', subLabel: 'Performance Log', icon: MangaIconMocks, shortcutKey: '2' },
    { id: 'papers', label: 'Papers Library', subLabel: 'PYQ & Attempts', icon: MangaIconPapers, shortcutKey: '3' },
    { id: 'mistakes', label: 'Mistake Log', subLabel: 'Error Intelligence', icon: MangaIconMistakes, shortcutKey: '4' },
    { id: 'inbox', label: 'Import Inbox', subLabel: 'Testbook Triage', icon: MangaIconInbox, shortcutKey: '5' },
    { id: 'review', label: 'Daily Quest', subLabel: 'Spaced Repetition', icon: MangaIconReview, badge: pendingReviewCount, shortcutKey: '6' },
    { id: 'planner', label: 'Strategy Planner', subLabel: 'Strategy & Goals', icon: MangaIconPlanner, shortcutKey: '7' },
    { id: 'cheatsheet', label: 'Cheat Sheet', subLabel: 'Formula Bank', icon: MangaIconCheatSheet, shortcutKey: '8' },
    { id: 'settings', label: 'Settings', subLabel: 'Exam Profiles', icon: MangaIconSettings, shortcutKey: '9' }
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
        <div className="p-4 border-b-2 border-[var(--ink-border)] flex items-center justify-between bg-[var(--bg-surface)]">
          <div className="flex items-center gap-2.5">
            <Mascot mood="idle" size="sm" />
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="font-display text-sm font-bold text-[var(--ink)] dark:text-[var(--text-main)] leading-tight">
                  Mistake Notebook
                </h1>
              </div>
              <span className="text-[10px] text-[var(--text-muted)] font-mono block">
                Competitive Exam Prep
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
          <div className="px-3 pt-3">
            <button
              onClick={onOpenSearch}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--action-primary)] text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors shadow-xs"
            >
              <span className="flex items-center gap-2">
                <MangaIconSearch className="w-3.5 h-3.5 text-[var(--action-primary)]" />
                <span>Search everything...</span>
              </span>
              <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded-sm border border-[var(--border-subtle)] bg-[var(--bg-panel)]">
                ⌘K
              </kbd>
            </button>
          </div>
        )}

        {/* User Rank Card */}
        <div className="px-3 pt-3">
          <div className="p-2.5 rounded-xl bg-[var(--bg-surface)] border-2 border-[var(--ink-border)] shadow-manga-sm space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-bold">
              <span className="flex items-center gap-1 text-[var(--sakura)]">
                <Award className="w-3.5 h-3.5" />
                <span>Rank: {rankInfo.rank}</span>
              </span>
              <span className="text-[10px] font-retro text-[var(--text-muted)]">
                {masteredCount} Defeated
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-[var(--bg-panel)] border border-[var(--ink-border)] overflow-hidden">
              <div
                className="h-full bg-[var(--sakura)] transition-all duration-500 rounded-full"
                style={{ width: `${Math.min(100, rankInfo.progress)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Quick Add CTA */}
        <div className="p-3">
          <button
            onClick={() => {
              onOpenQuickAdd();
              onCloseMobile();
            }}
            className="manga-btn w-full py-2 px-3 rounded-xl bg-[var(--sakura)] text-[var(--ink)] font-bold text-xs flex items-center justify-between shadow-manga-sm hover:-translate-y-0.5 active:translate-y-0.5 transition-all"
            title="Quick Log Mistake (Press N)"
          >
            <span className="flex items-center gap-2">
              <MangaIconPlus className="w-4 h-4" />
              <span>Quick Log Mistake</span>
            </span>
            <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/15 text-[var(--ink)] font-bold">
              N
            </kbd>
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-3 py-1 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                  isActive
                    ? 'bg-[var(--peach)] text-[var(--ink)] border-2 border-[var(--ink-border)] shadow-manga-sm'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-surface)] border-2 border-transparent'
                }`}
                title={`${item.label} (Press ${item.shortcutKey})`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className="w-4 h-4 shrink-0" />
                  <div className="text-left">
                    <span className="block leading-tight">{item.label}</span>
                    <span className="text-[9px] opacity-75 font-retro block">{item.subLabel}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="px-1.5 py-0.2 text-[10px] font-bold rounded-md bg-[var(--sakura)] text-[var(--ink)] border border-[var(--ink-border)] shadow-xs">
                      {item.badge}
                    </span>
                  )}
                  <kbd
                    className={`text-[9px] font-mono px-1.5 py-0.5 rounded border transition-colors ${
                      isActive
                        ? 'bg-[var(--bg-panel)]/60 border-[var(--ink-border)] text-[var(--ink)] font-bold'
                        : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-muted)]'
                    }`}
                  >
                    {item.shortcutKey}
                  </kbd>
                </div>
              </button>
            );
          })}
        </nav>

        {/* Footer with Theme Switcher */}
        <div className="p-3 border-t-2 border-[var(--ink-border)] bg-[var(--bg-surface)] flex items-center justify-between">
          <div className="text-[10px] text-[var(--text-muted)] font-mono">
            Local IndexedDB
          </div>
          <button
            onClick={toggleTheme}
            className="manga-btn px-2.5 py-1.5 rounded-lg bg-[var(--bg-panel)] border border-[var(--ink-border)] text-xs font-bold flex items-center gap-1.5 text-[var(--ink)] dark:text-[var(--text-main)]"
            title={theme === 'dark' ? 'Switch to Morning Theme' : 'Switch to Night Theme'}
          >
            <span className="text-[11px] font-mono">
              {theme === 'dark' ? '☀️ Morning' : '🌙 Night'}
            </span>
          </button>
        </div>
      </aside>
    </>
  );
};
