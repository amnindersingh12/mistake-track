import React, { useEffect } from 'react';
import { Mascot } from './Mascot';
import {
  X,
  Keyboard,
  Navigation,
  Sparkles,
  Zap,
  BookOpen,
  FileCheck2
} from 'lucide-react';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ShortcutItem {
  keys: string[];
  description: string;
}

interface ShortcutCategory {
  title: string;
  icon: React.FC<{ className?: string }>;
  shortcuts: ShortcutItem[];
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  isOpen,
  onClose
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const categories: ShortcutCategory[] = [
    {
      title: 'Global Navigation',
      icon: Navigation,
      shortcuts: [
        { keys: ['1', '–', '8'], description: 'Jump between tabs (Dashboard, Quest, Mistakes...)' },
        { keys: ['⌘', 'K'], description: 'Global omni-search across mocks, mistakes & tasks' },
        { keys: ['T'], description: 'Toggle theme (Morning ☀️ / Night 🌙)' },
        { keys: ['?'], description: 'Open this keyboard shortcuts cheat-sheet' }
      ]
    },
    {
      title: 'Quick Actions',
      icon: Zap,
      shortcuts: [
        { keys: ['N'], description: 'Open Quick Log Mistake modal' },
        { keys: ['I'], description: 'Open Data Intake Hub (Paste / CSV)' },
        { keys: ['⌘', '↵'], description: 'Quick save mistake or import data' },
        { keys: ['Esc'], description: 'Close any active modal or overlay' }
      ]
    },
    {
      title: 'Daily Quest (Spaced Repetition)',
      icon: Sparkles,
      shortcuts: [
        { keys: ['Space', 'or', '↓'], description: 'Flip card to check solution & rule' },
        { keys: ['1', 'or', '→'], description: 'Got It! Advance spaced repetition interval' },
        { keys: ['2', 'or', '←'], description: 'Still Wrong: Reset interval for immediate review' }
      ]
    },
    {
      title: 'Paper Exam Simulation',
      icon: BookOpen,
      shortcuts: [
        { keys: ['1', '–', '5'], description: 'Select option A, B, C, D, or E' },
        { keys: ['→', 'or', '↵'], description: 'Next question' },
        { keys: ['←'], description: 'Previous question' },
        { keys: ['M'], description: 'Toggle mark for review' },
        { keys: ['C'], description: 'Clear selected answer' }
      ]
    }
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-[var(--bg-panel)] border-3 border-[var(--ink-border)] rounded-2xl shadow-manga-lg overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b-2 border-[var(--ink-border)] bg-[var(--bg-surface)] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-[var(--sakura)]/20 border-2 border-[var(--ink-border)] text-[var(--ink-border)]">
              <Keyboard className="w-5 h-5 text-[var(--action-primary)]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display font-black text-base text-[var(--text-primary)]">
                  Keyboard Shortcuts
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[var(--bg-panel)] border border-[var(--border-subtle)] text-[var(--action-primary)] font-bold">
                  Power User Mode
                </span>
              </div>
              <p className="text-xs text-[var(--text-muted)] font-mono">
                Speed up study sessions without touching your mouse
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl border-2 border-[var(--border-subtle)] hover:border-[var(--ink-border)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Shortcuts Content */}
        <div className="p-5 overflow-y-auto space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {categories.map((cat) => {
              const Icon = cat.icon;
              return (
                <div
                  key={cat.title}
                  className="p-3.5 rounded-xl border-2 border-[var(--border-subtle)] bg-[var(--bg-surface)]/60 space-y-2.5 shadow-xs"
                >
                  <div className="flex items-center gap-2 text-xs font-black font-display text-[var(--text-primary)]">
                    <Icon className="w-4 h-4 text-[var(--action-primary)]" />
                    <span>{cat.title}</span>
                  </div>

                  <div className="space-y-1.5">
                    {cat.shortcuts.map((sc, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between text-xs py-1 px-1.5 rounded hover:bg-[var(--bg-panel)] transition-colors"
                      >
                        <span className="text-[11px] text-[var(--text-muted)] font-medium pr-2">
                          {sc.description}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          {sc.keys.map((k, idx) => (
                            <React.Fragment key={idx}>
                              {k === '–' || k === 'or' ? (
                                <span className="text-[10px] text-[var(--text-muted)] font-mono px-0.5">
                                  {k}
                                </span>
                              ) : (
                                <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-[var(--bg-panel)] text-[var(--text-primary)] border-2 border-[var(--ink-border)] rounded shadow-manga-xs">
                                  {k}
                                </kbd>
                              )}
                            </React.Fragment>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Manga Mascot Note */}
          <div className="p-3 rounded-xl border-2 border-[var(--ink-border)] bg-[var(--peach)]/20 flex items-center gap-3">
            <Mascot mood="celebrating" size="sm" />
            <div className="text-xs text-[var(--text-primary)]">
              <strong className="font-display">Pro tip:</strong> Press <kbd className="px-1.5 py-0.2 text-[10px] font-mono font-bold bg-[var(--bg-panel)] border border-[var(--ink-border)] rounded">?</kbd> anywhere outside of a text box to reopen this guide.
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t-2 border-[var(--ink-border)] bg-[var(--bg-surface)] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl border-2 border-[var(--ink-border)] bg-[var(--action-primary)] text-white text-xs font-bold shadow-manga-sm hover:-translate-y-0.5 active:translate-y-0.5 transition-all"
          >
            Got it (Esc)
          </button>
        </div>
      </div>
    </div>
  );
};

