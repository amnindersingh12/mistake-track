import React, { useState, useEffect, useCallback } from 'react';
import { MistakeEntry, ExamSettings } from '../types';
import { db } from '../db/db';
import { processSrsReview, getTodayDateStr } from '../utils/srs';
import { Mascot } from './Mascot';
import confetti from 'canvas-confetti';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain,
  RotateCcw,
  CheckCircle,
  XCircle,
  Sparkles,
  ChevronRight,
  Eye,
  Filter,
  Flame,
  Award,
  Clock,
  Layers,
  ArrowRight,
  Zap,
  Target
} from 'lucide-react';

interface ReviewQueueViewProps {
  mistakes: MistakeEntry[];
  settings: ExamSettings;
  onRefresh: () => void;
}

export const ReviewQueueView: React.FC<ReviewQueueViewProps> = ({
  mistakes,
  settings,
  onRefresh
}) => {
  const todayStr = getTodayDateStr();

  // Mode: 'daily-queue' or 'retry-mode'
  const [mode, setMode] = useState<'daily-queue' | 'retry-mode'>('daily-queue');
  const [retryFilterType, setRetryFilterType] = useState<'topic' | 'errorType'>('topic');
  const [retryFilterValue, setRetryFilterValue] = useState<string>('');

  // Queue state
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isRevealed, setIsRevealed] = useState(false);
  const [reviewedSessionCount, setReviewedSessionCount] = useState(0);
  const [masteredSessionCount, setMasteredSessionCount] = useState(0);
  const [justMastered, setJustMastered] = useState(false);

  // Compute Daily Queue items: due today or earlier, not mastered
  const dailyQueue = mistakes.filter((m) => {
    return m.status !== 'Mastered' && m.nextReviewDate <= todayStr;
  });

  // Compute Retry Mode items (excluding Mastered cards)
  const retryQueue = mistakes.filter((m) => {
    if (m.status === 'Mastered') return false;
    if (!retryFilterValue) return false;
    if (retryFilterType === 'topic') return m.topic === retryFilterValue;
    if (retryFilterType === 'errorType') return m.errorTypes.includes(retryFilterValue);
    return false;
  });

  const activeQueue = mode === 'daily-queue' ? dailyQueue : retryQueue;
  const currentCard = activeQueue[currentIndex];

  // Set default retry filter value
  useEffect(() => {
    if (!retryFilterValue) {
      if (retryFilterType === 'topic') {
        const firstTopic = settings.sections[0]?.topics[0] || 'Percentage';
        setRetryFilterValue(firstTopic);
      } else {
        setRetryFilterValue(settings.errorTypes[0] || 'Calculation mistake');
      }
    }
  }, [retryFilterType, retryFilterValue, settings]);

  // Handle Review Actions
  const handleReviewAction = useCallback(
    async (outcome: 'got-it' | 'still-wrong') => {
      if (!currentCard || !currentCard.id) return;

      const updates = processSrsReview(currentCard, outcome);
      await db.mistakes.update(currentCard.id, updates);

      setReviewedSessionCount((c) => c + 1);
      if (updates.status === 'Mastered') {
        setMasteredSessionCount((c) => c + 1);
        setJustMastered(true);
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.7 }
        });
        setTimeout(() => setJustMastered(false), 2000);
      }

      setIsRevealed(false);
      onRefresh();

      // If finished last card
      if (activeQueue.length <= 1) {
        confetti({
          particleCount: 80,
          spread: 80,
          origin: { y: 0.5 }
        });
      }
    },
    [currentCard, onRefresh, activeQueue.length]
  );

  // Keyboard Shortcuts: Space/Enter = Reveal, '1' = Got it, '2' = Still wrong
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      if (!currentCard) return;

      if (!isRevealed) {
        if (e.code === 'Space' || e.code === 'Enter' || e.key === 'ArrowDown') {
          e.preventDefault();
          setIsRevealed(true);
        }
      } else {
        if (e.key === '1' || e.key === 'g' || e.key === 'G' || e.key === 'ArrowRight') {
          e.preventDefault();
          handleReviewAction('got-it');
        } else if (e.key === '2' || e.key === 's' || e.key === 'S' || e.key === 'ArrowLeft') {
          e.preventDefault();
          handleReviewAction('still-wrong');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentCard, isRevealed, handleReviewAction]);

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Top Header & Mode Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-display text-2xl font-black tracking-tight text-[var(--ink-border)]">
              Daily Quest
            </h2>
            <span className="font-mono text-xs px-2.5 py-0.5 rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--action-primary)] font-bold">
              Spaced Repetition
            </span>
          </div>
          <p className="text-xs text-[var(--ink-muted)] mt-1">
            Intervals: 1 → 3 → 7 → 14 → 30 days. Auto-promotes to <strong className="text-[var(--accent-twilight)]">Mastered (Defeated)</strong> after 3 consecutive recalls.
          </p>
        </div>

        {/* Mode Switcher */}
        <div className="flex p-1 rounded-xl bg-[var(--surface-tag)] border-2 border-[var(--ink-border)] text-xs font-bold">
          <button
            onClick={() => {
              setMode('daily-queue');
              setIsRevealed(false);
              setCurrentIndex(0);
            }}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              mode === 'daily-queue'
                ? 'bg-[var(--card-bg)] text-[var(--ink-border)] shadow-manga-sm'
                : 'text-[var(--ink-muted)] hover:text-[var(--ink-border)]'
            }`}
          >
            <span>Daily Queue</span>
            {dailyQueue.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-[var(--accent-sakura)] text-[var(--ink-border)] text-[10px] font-black">
                {dailyQueue.length}
              </span>
            )}
          </button>
          <button
            onClick={() => {
              setMode('retry-mode');
              setIsRevealed(false);
              setCurrentIndex(0);
            }}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              mode === 'retry-mode'
                ? 'bg-[var(--card-bg)] text-[var(--ink-border)] shadow-manga-sm'
                : 'text-[var(--ink-muted)] hover:text-[var(--ink-border)]'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Targeted Retry</span>
          </button>
        </div>
      </div>

      {/* Retry Filter Bar when in Retry Mode */}
      {mode === 'retry-mode' && (
        <div className="p-4 bg-[var(--card-bg)] rounded-xl border-2 border-[var(--ink-border)] shadow-manga space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <span className="font-bold text-[var(--ink-border)]">
              Drill past mistakes by Topic or Root-Cause Error:
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setRetryFilterType('topic');
                  setRetryFilterValue(settings.sections[0]?.topics[0] || '');
                  setCurrentIndex(0);
                }}
                className={`px-3 py-1 rounded-lg text-xs font-bold border-2 border-[var(--ink-border)] ${
                  retryFilterType === 'topic'
                    ? 'bg-[var(--accent-sakura)] text-[var(--ink-border)] shadow-manga-sm'
                    : 'bg-[var(--surface-tag)] text-[var(--ink-muted)]'
                }`}
              >
                By Topic
              </button>
              <button
                onClick={() => {
                  setRetryFilterType('errorType');
                  setRetryFilterValue(settings.errorTypes[0] || '');
                  setCurrentIndex(0);
                }}
                className={`px-3 py-1 rounded-lg text-xs font-bold border-2 border-[var(--ink-border)] ${
                  retryFilterType === 'errorType'
                    ? 'bg-[var(--accent-sakura)] text-[var(--ink-border)] shadow-manga-sm'
                    : 'bg-[var(--surface-tag)] text-[var(--ink-muted)]'
                }`}
              >
                By Error Type
              </button>
            </div>
          </div>

          <div className="flex gap-3">
            <select
              value={retryFilterValue}
              onChange={(e) => {
                setRetryFilterValue(e.target.value);
                setCurrentIndex(0);
                setIsRevealed(false);
              }}
              className="flex-1 text-xs px-3 py-2 rounded-xl bg-[var(--card-bg)] border-2 border-[var(--ink-border)] text-[var(--ink-border)] font-bold shadow-manga-sm"
            >
              {retryFilterType === 'topic'
                ? Array.from(new Set(settings.sections.flatMap((s) => s.topics))).map((t) => (
                    <option key={t} value={t}>
                      {t} ({mistakes.filter((m) => m.topic === t).length} logged)
                    </option>
                  ))
                : settings.errorTypes.map((err) => (
                    <option key={err} value={err}>
                      {err} ({mistakes.filter((m) => m.errorTypes.includes(err)).length} logged)
                    </option>
                  ))}
            </select>
          </div>
        </div>
      )}

      {/* Main Flashcard Container */}
      {!currentCard ? (
        /* Empty / Completed Session View */
        <div className="p-10 text-center bg-[var(--card-bg)] rounded-2xl border-2 border-[var(--ink-border)] shadow-manga space-y-4">
          <div className="flex justify-center">
            <Mascot
              mood={mistakes.length === 0 ? 'reading' : 'celebrating'}
              size="xl"
            />
          </div>
          <div>
            <h3 className="font-display text-lg font-bold text-[var(--ink-border)]">
              {mistakes.length === 0
                ? 'No Mistakes Logged Yet'
                : mode === 'daily-queue'
                ? 'Quest Complete For Today!'
                : `No More Mistakes Found in "${retryFilterValue}"`}
            </h3>
            <p className="text-xs text-[var(--ink-muted)] max-w-md mx-auto mt-1 leading-relaxed">
              {mistakes.length === 0
                ? 'Log mistakes from your mocks or paper attempts to unlock your personalized Spaced Repetition queue.'
                : mode === 'daily-queue'
                ? 'All scheduled cards reviewed! Next reviews will unlock automatically based on your retention intervals (1, 3, 7, 14, 30 days).'
                : 'Try switching to another topic or error type to keep drilling.'}
            </p>
          </div>

          {reviewedSessionCount > 0 && (
            <div className="p-3 bg-[var(--accent-mint)]/20 border-2 border-[var(--ink-border)] rounded-xl max-w-xs mx-auto text-xs text-[var(--ink-border)] font-bold shadow-manga-sm">
              Completed {reviewedSessionCount} reviews ({masteredSessionCount} defeated)!
            </div>
          )}

          {mistakes.length > 0 && mode === 'daily-queue' && (
            <div className="pt-2 flex justify-center gap-3">
              <button
                onClick={() => {
                  setMode('retry-mode');
                  setIsRevealed(false);
                }}
                className="px-5 py-2.5 rounded-xl border-2 border-[var(--ink-border)] bg-[var(--accent-sakura)] text-[var(--ink-border)] text-xs font-bold shadow-manga-sm hover:-translate-y-0.5 transition-all"
              >
                Practice in Targeted Retry Mode
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Progress Banner & Keyboard Shortcuts Pill */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 text-[var(--ink-muted)]">
              <span className="font-bold">Card 1 of {activeQueue.length}</span>
              <span>•</span>
              <span className="flex items-center gap-1 text-amber-500 font-bold">
                <Flame className="w-4 h-4 fill-amber-500 text-amber-500" />
                <span>{currentCard.consecutiveCorrect || 0} / 3 to Defeat</span>
              </span>
            </div>

            {/* Keyboard shortcut guide */}
            <div className="flex items-center gap-1.5 text-[11px] text-[var(--ink-muted)] bg-[var(--surface-tag)] border border-[var(--ink-border)]/40 px-3 py-1 rounded-lg">
              {!isRevealed ? (
                <span>Press <kbd className="px-1.5 py-0.5 rounded bg-[var(--card-bg)] border border-[var(--ink-border)] font-mono text-[var(--ink-border)]">Space</kbd> or <kbd className="px-1.5 py-0.5 rounded bg-[var(--card-bg)] border border-[var(--ink-border)] font-mono text-[var(--ink-border)]">↓</kbd> to reveal</span>
              ) : (
                <span>Press <kbd className="px-1.5 py-0.5 rounded bg-[var(--card-bg)] border border-[var(--ink-border)] font-mono text-[var(--ink-border)]">1</kbd> for Got It, <kbd className="px-1.5 py-0.5 rounded bg-[var(--card-bg)] border border-[var(--ink-border)] font-mono text-[var(--ink-border)]">2</kbd> for Still Wrong</span>
              )}
            </div>
          </div>

          {/* Flashcard with 3D Flip & Manga Panel */}
          <div className="relative">
            {/* Defeated Stamp Overlay */}
            {justMastered && (
              <motion.div
                initial={{ scale: 2, rotate: -25, opacity: 0 }}
                animate={{ scale: 1, rotate: -12, opacity: 1 }}
                className="absolute top-8 right-8 z-30 pointer-events-none px-4 py-2 rounded-xl border-4 border-emerald-600 bg-emerald-500/20 text-emerald-600 font-display font-black text-2xl tracking-widest uppercase shadow-manga"
              >
                MASTERED
              </motion.div>
            )}

            <div style={{ perspective: 1200 }} className="w-full relative">
              <motion.div
                animate={{ rotateY: isRevealed ? 360 : 0 }}
                transition={{ type: 'spring', stiffness: 240, damping: 22 }}
                className="bg-[var(--card-bg)] rounded-2xl border-2 border-[var(--ink-border)] shadow-manga overflow-hidden"
              >
              {/* Card Header */}
              <div className="p-4 bg-[var(--surface-tag)] border-b-2 border-[var(--ink-border)] flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-lg border-2 border-[var(--ink-border)] bg-[var(--accent-sakura)] text-[var(--ink-border)] text-xs font-black">
                    {currentCard.sectionName}
                  </span>
                  <span className="text-xs font-bold text-[var(--ink-border)]">
                    {currentCard.topic} (Q#{currentCard.questionNumber})
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-[var(--ink-muted)] font-mono">
                  <span>Interval: {currentCard.interval || 0}d</span>
                  <span>• Source: {currentCard.mockName}</span>
                </div>
              </div>

              {/* Card Question Body */}
              <div className="p-6 space-y-4">
                <div className="space-y-2">
                  <span className="text-[11px] font-black tracking-wider uppercase text-[var(--ink-muted)]">
                    QUESTION PROMPT
                  </span>
                  <p className="text-sm text-[var(--ink-border)] leading-relaxed font-bold whitespace-pre-wrap">
                    {currentCard.questionText}
                  </p>

                  {currentCard.questionImage && (
                    <div className="mt-3 rounded-xl overflow-hidden border-2 border-[var(--ink-border)] max-w-xl mx-auto shadow-manga-sm">
                      <img
                        src={currentCard.questionImage}
                        alt="Question diagram"
                        className="max-h-60 w-auto object-contain mx-auto"
                      />
                    </div>
                  )}
                </div>

                {/* Reveal Action / Back State */}
                {!isRevealed ? (
                  <div className="pt-6 flex flex-col items-center justify-center space-y-3">
                    <button
                      onClick={() => setIsRevealed(true)}
                      className="px-8 py-3.5 rounded-xl border-2 border-[var(--ink-border)] bg-[var(--accent-sakura)] hover:bg-[var(--accent-sakura)]/80 text-[var(--ink-border)] font-display font-black text-sm shadow-manga hover:-translate-y-0.5 active:translate-y-0.5 transition-all flex items-center gap-3"
                    >
                      <Eye className="w-4 h-4" />
                      <span>Flip Card & Check Solution</span>
                      <kbd className="px-2 py-0.5 text-[11px] font-mono font-bold bg-white/40 border border-[var(--ink-border)] rounded-md shadow-xs">
                        Space
                      </kbd>
                    </button>
                    <span className="text-[11px] text-[var(--ink-muted)] flex items-center gap-1.5 font-mono">
                      <span>Shortcut:</span>
                      <kbd className="px-1.5 py-0.2 rounded bg-[var(--surface-tag)] border border-[var(--ink-border)] font-bold text-[10px]">Space</kbd>
                      <span>or</span>
                      <kbd className="px-1.5 py-0.2 rounded bg-[var(--surface-tag)] border border-[var(--ink-border)] font-bold text-[10px]">↓</kbd>
                    </span>
                  </div>
                ) : (
                  /* Revealed Back Solution State */
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className="pt-4 border-t-2 border-[var(--ink-border)] space-y-4"
                  >
                    {/* Answers comparison */}
                    <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl border-2 border-[var(--ink-border)] bg-[var(--surface-tag)] text-xs">
                      <div>
                        <span className="text-rose-500 font-bold block mb-0.5">My Answer in Mock:</span>
                        <span className="text-[var(--ink-border)] font-mono font-black text-sm">
                          {currentCard.myAnswer}
                        </span>
                      </div>
                      <div>
                        <span className="text-emerald-500 font-bold block mb-0.5">Correct Answer:</span>
                        <span className="text-[var(--ink-border)] font-mono font-black text-sm">
                          {currentCard.correctAnswer}
                        </span>
                      </div>
                    </div>

                    {/* Why it happened */}
                    <div className="p-3.5 rounded-xl border-2 border-[var(--ink-border)] bg-[var(--accent-peach)]/20 text-xs space-y-1">
                      <div className="font-display font-bold text-amber-700 dark:text-amber-400 text-[11px]">
                        WHAT WENT WRONG:
                      </div>
                      <p className="text-[var(--ink-border)] font-medium leading-relaxed">
                        {currentCard.whatWentWrong}
                      </p>
                    </div>

                    {/* Step by Step Solution */}
                    <div className="p-3.5 rounded-xl border-2 border-[var(--ink-border)] bg-[var(--card-bg)] text-xs space-y-1 shadow-manga-sm">
                      <div className="font-display font-bold text-[var(--accent-twilight)] text-[11px]">
                        CORRECT SOLUTION:
                      </div>
                      <p className="text-[var(--ink-border)] font-medium leading-relaxed whitespace-pre-wrap">
                        {currentCard.correctSolution}
                      </p>
                    </div>

                    {/* Better Approach / Shortcut */}
                    <div className="p-3.5 rounded-xl border-2 border-[var(--ink-border)] bg-[var(--accent-mint)]/20 text-xs space-y-1">
                      <div className="font-display font-bold text-emerald-700 dark:text-emerald-400 text-[11px]">
                        BETTER APPROACH / SHORTCUT:
                      </div>
                      <p className="text-[var(--ink-border)] font-medium leading-relaxed">
                        {currentCard.betterApproach}
                      </p>
                    </div>

                    {/* Rule to Remember Highlight */}
                    <div className="p-3.5 rounded-xl border-2 border-[var(--ink-border)] bg-[var(--accent-sakura)]/30 flex items-center gap-3 shadow-manga-sm">
                      <Sparkles className="w-5 h-5 text-[var(--ink-border)] shrink-0" />
                      <div className="text-xs">
                        <span className="font-black text-[var(--ink-border)]">Rule to Remember: </span>
                        <span className="text-[var(--ink-border)] font-bold">
                          {currentCard.ruleToRemember}
                        </span>
                      </div>
                    </div>

                    {/* Action Decision Buttons */}
                    <div className="pt-4 flex flex-col sm:flex-row gap-3">
                      <button
                        onClick={() => handleReviewAction('still-wrong')}
                        className="flex-1 py-3 px-4 rounded-xl border-2 border-[var(--ink-border)] bg-rose-500/20 hover:bg-rose-500/30 text-[var(--ink-border)] font-bold text-xs flex items-center justify-between shadow-manga-sm hover:-translate-y-0.5 active:translate-y-0.5 transition-all"
                      >
                        <span className="flex items-center gap-2">
                          <XCircle className="w-4 h-4 text-rose-500" />
                          <span>Still Wrong (Reset to 1d)</span>
                        </span>
                        <div className="flex items-center gap-1 font-mono">
                          <kbd className="px-1.5 py-0.5 rounded bg-[var(--card-bg)] border border-[var(--ink-border)] text-[10px] font-bold shadow-xs">2</kbd>
                          <span className="text-[10px] text-[var(--ink-muted)]">/</span>
                          <kbd className="px-1.5 py-0.5 rounded bg-[var(--card-bg)] border border-[var(--ink-border)] text-[10px] font-bold shadow-xs">←</kbd>
                        </div>
                      </button>

                      <button
                        onClick={() => handleReviewAction('got-it')}
                        className="flex-1 py-3 px-4 rounded-xl border-2 border-[var(--ink-border)] bg-emerald-500/20 hover:bg-emerald-500/30 text-[var(--ink-border)] font-bold text-xs flex items-center justify-between shadow-manga-sm hover:-translate-y-0.5 active:translate-y-0.5 transition-all"
                      >
                        <span className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-emerald-500" />
                          <span>Got It! Advance Interval</span>
                        </span>
                        <div className="flex items-center gap-1 font-mono">
                          <kbd className="px-1.5 py-0.5 rounded bg-[var(--card-bg)] border border-[var(--ink-border)] text-[10px] font-bold shadow-xs">1</kbd>
                          <span className="text-[10px] text-[var(--ink-muted)]">/</span>
                          <kbd className="px-1.5 py-0.5 rounded bg-[var(--card-bg)] border border-[var(--ink-border)] text-[10px] font-bold shadow-xs">→</kbd>
                        </div>
                      </button>
                    </div>
                  </motion.div>
                )}
              </div>
            </motion.div>
          </div>
          </div>
        </div>
      )}
    </div>
  );
};
