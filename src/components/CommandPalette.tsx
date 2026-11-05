import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search,
  ArrowRight,
  Flame,
  BookOpen,
  FileQuestion,
  Notebook,
  Puzzle,
  Clock,
  Swords,
  GitFork,
  Globe2,
  CalendarDays,
  PlusCircle,
  Sun,
  Moon,
  Minimize2,
  Maximize2
} from 'lucide-react';
import { NavTab } from './Sidebar';
import { switchProfile } from '../db/db';

export interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTab: (tab: NavTab) => void;
  onOpenQuickAdd: () => void;
  onToggleTheme: () => void;
  isCompactDensity: boolean;
  onToggleDensity: () => void;
  onProfileChanged?: () => void;
}

interface PaletteAction {
  id: string;
  category: 'Navigation' | 'Actions' | 'Exams';
  title: string;
  subTitle?: string;
  shortcut?: string;
  icon: React.FC<{ className?: string }>;
  perform: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onSelectTab,
  onOpenQuickAdd,
  onToggleTheme,
  isCompactDensity,
  onToggleDensity,
  onProfileChanged
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const actions: PaletteAction[] = useMemo(() => [
    // Navigation
    { id: 'nav-home', category: 'Navigation', title: 'Home Command Center', subTitle: 'Overview, countdown, streaks', icon: Flame, perform: () => onSelectTab('home') },
    { id: 'nav-review', category: 'Navigation', title: 'Daily SRS Review', subTitle: 'Interleaved & weakness-weighted queue', shortcut: '6', icon: Flame, perform: () => onSelectTab('review') },
    { id: 'nav-mistakes', category: 'Navigation', title: 'Mistake Log', subTitle: 'Error intelligence & taxonomy', shortcut: '4', icon: FileQuestion, perform: () => onSelectTab('mistakes') },
    { id: 'nav-pyq', category: 'Navigation', title: 'PYQ Bank', subTitle: 'Previous-year questions with first-attempt stats', icon: FileQuestion, perform: () => onSelectTab('pyq') },
    { id: 'nav-syllabus', category: 'Navigation', title: 'Syllabus Tracker', subTitle: 'Syllabus progress rings', icon: BookOpen, perform: () => onSelectTab('syllabus') },
    { id: 'nav-overlap', category: 'Navigation', title: 'Cross-Exam Overlap Map', subTitle: 'Shared CS taxonomy and overlap', icon: GitFork, perform: () => onSelectTab('overlap') },
    { id: 'nav-notes', category: 'Navigation', title: 'Study Notes', subTitle: 'KaTeX markdown with two-way links', icon: Notebook, perform: () => onSelectTab('notes') },
    { id: 'nav-patterns', category: 'Navigation', title: 'Pattern Book', subTitle: 'Recurring problem archetypes & traps', icon: Puzzle, perform: () => onSelectTab('patterns') },
    { id: 'nav-focus', category: 'Navigation', title: 'Focus Room', subTitle: 'Pomodoro timer & Web Audio ambient beats', icon: Clock, perform: () => onSelectTab('focus') },
    { id: 'nav-quests', category: 'Navigation', title: 'Quest Board & Boss Battle', subTitle: 'Daily bounties and 15-Q Boss', icon: Swords, perform: () => onSelectTab('quests') },
    { id: 'nav-skill-tree', category: 'Navigation', title: 'Skill Tree', subTitle: 'RPG mastery constellation', icon: GitFork, perform: () => onSelectTab('skill-tree') },
    { id: 'nav-study-planner', category: 'Navigation', title: 'Study Planner', subTitle: 'Dynamic weekly availability slots', icon: CalendarDays, perform: () => onSelectTab('study-planner') },
    { id: 'nav-mocks', category: 'Navigation', title: 'Mock Test Log', subTitle: 'Full scorecard analytics', shortcut: '2', icon: FileQuestion, perform: () => onSelectTab('mocks') },
    { id: 'nav-papers', category: 'Navigation', title: 'Papers Library', subTitle: 'Interactive question papers', shortcut: '3', icon: BookOpen, perform: () => onSelectTab('papers') },
    { id: 'nav-all-exams', category: 'Navigation', title: 'All Exams Overview', subTitle: 'Compare GATE, SEBI & IBPS', icon: Globe2, perform: () => onSelectTab('all-exams') },
    { id: 'nav-settings', category: 'Navigation', title: 'Settings', subTitle: 'Exam profiles & backup', shortcut: '9', icon: Globe2, perform: () => onSelectTab('settings') },

    // Quick Actions
    { id: 'act-log-mistake', category: 'Actions', title: 'Quick Log Mistake', subTitle: 'Log a new question mistake', shortcut: 'N', icon: PlusCircle, perform: onOpenQuickAdd },
    { id: 'act-toggle-theme', category: 'Actions', title: 'Toggle Theme', subTitle: 'Switch between light and dark manga aesthetic', icon: Moon, perform: onToggleTheme },
    { id: 'act-toggle-density', category: 'Actions', title: isCompactDensity ? 'Switch to Comfortable Density' : 'Switch to Compact Density', subTitle: 'Adjust card and list spacing', icon: isCompactDensity ? Maximize2 : Minimize2, perform: onToggleDensity },

    // Exam Switchers
    {
      id: 'exam-gate-cs',
      category: 'Exams',
      title: 'Switch Exam: GATE CS (2027)',
      subTitle: '65 questions, 100 marks, CBT',
      icon: Globe2,
      perform: async () => {
        await switchProfile('gate-cs');
        onProfileChanged?.();
      }
    },
    {
      id: 'exam-sebi-it',
      category: 'Exams',
      title: 'Switch Exam: SEBI Grade A (IT)',
      subTitle: 'Phase 1 & Phase 2 IT Officer stream',
      icon: Globe2,
      perform: async () => {
        await switchProfile('sebi-it');
        onProfileChanged?.();
      }
    },
    {
      id: 'exam-ibps-so-it',
      category: 'Exams',
      title: 'Switch Exam: IBPS SO (IT Officer)',
      subTitle: 'Prelims & Mains Professional Knowledge',
      icon: Globe2,
      perform: async () => {
        await switchProfile('ibps-so-it');
        onProfileChanged?.();
      }
    }
  ], [onSelectTab, onOpenQuickAdd, onToggleTheme, isCompactDensity, onToggleDensity, onProfileChanged]);

  const filtered = useMemo(() => {
    if (!query.trim()) return actions;
    const q = query.toLowerCase();
    return actions.filter(a => a.title.toLowerCase().includes(q) || a.subTitle?.toLowerCase().includes(q) || a.category.toLowerCase().includes(q));
  }, [actions, query]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [filtered]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % Math.max(1, filtered.length));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + filtered.length) % Math.max(1, filtered.length));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filtered[selectedIndex]) {
          filtered[selectedIndex].perform();
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filtered, selectedIndex, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/65 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-xl bg-[var(--bg-panel)] border-2 border-[var(--ink-border)] rounded-2xl shadow-manga-lg overflow-hidden flex flex-col max-h-[75vh]">
        {/* Search Input */}
        <div className="p-3.5 border-b-2 border-[var(--ink-border)] bg-[var(--bg-surface)] flex items-center gap-3">
          <Search className="w-5 h-5 text-[var(--action-primary)] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Type a command, view, or exam..."
            className="w-full bg-transparent border-none outline-hidden text-sm font-medium text-[var(--text-primary)] placeholder-[var(--text-muted)]"
          />
          <kbd className="text-[10px] font-mono px-2 py-0.5 rounded bg-[var(--bg-panel)] border border-[var(--ink-border)] text-[var(--text-muted)]">
            ESC
          </kbd>
        </div>

        {/* Action List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-xs text-[var(--text-muted)] font-mono">
              No matching commands found for "{query}"
            </div>
          ) : (
            filtered.map((item, idx) => {
              const Icon = item.icon;
              const isSelected = idx === selectedIndex;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    item.perform();
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left transition-all ${
                    isSelected
                      ? 'bg-[var(--peach)] text-[var(--ink)] border border-[var(--ink-border)] shadow-xs'
                      : 'text-[var(--text-primary)] hover:bg-[var(--bg-surface)] border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border ${
                      isSelected ? 'bg-[var(--bg-surface)] border-[var(--ink-border)] text-[var(--ink)]' : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-muted)]'
                    }`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="truncate">
                      <div className="text-xs font-bold truncate flex items-center gap-2">
                        <span>{item.title}</span>
                        <span className="text-[10px] font-normal opacity-70 px-1.5 py-0.2 rounded-full border border-current text-[9px]">
                          {item.category}
                        </span>
                      </div>
                      {item.subTitle && (
                        <div className="text-[11px] opacity-75 truncate">{item.subTitle}</div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {item.shortcut && (
                      <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--bg-panel)] border border-[var(--ink-border)] font-bold">
                        {item.shortcut}
                      </kbd>
                    )}
                    <ArrowRight className={`w-3.5 h-3.5 transition-transform ${isSelected ? 'translate-x-0.5 text-[var(--ink)]' : 'opacity-0'}`} />
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-2.5 px-4 border-t border-[var(--ink-border)] bg-[var(--bg-surface)] flex items-center justify-between text-[11px] text-[var(--text-muted)] font-mono">
          <div className="flex items-center gap-3">
            <span>↑↓ to navigate</span>
            <span>↵ to select</span>
          </div>
          <span>Antigravity Study Command</span>
        </div>
      </div>
    </div>
  );
};
