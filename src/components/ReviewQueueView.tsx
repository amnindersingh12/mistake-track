import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { MistakeEntry, ExamSettings } from '../types';
import { db } from '../db/db';
import { processSrsReview, getTodayDateStr } from '../utils/srs';
import {
  sortQueueByWeakness,
  interleaveQueue,
  getQuick5Queue,
  calculateWeaknessScore,
  getDaysOverdue,
  getConsecutiveWrongCount
} from '../utils/reviewQueue';
import { downloadAnkiCsv } from '../utils/ankiExport';
import { renderFormattedContent } from './shared/QuestionRenderer';
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
  Target,
  Download,
  Shuffle,
  Timer,
  AlertTriangle
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

  // Mode: 'daily-queue' | 'retry-mode' | 'quick-5'
  const [mode, setMode] = useState<'daily-queue' | 'retry-mode' | 'quick-5'>('daily-queue');
  const [retryFilterType, setRetryFilterType] = useState<'topic' | 'errorType'>('topic');
  const [retryFilterValue, setRetryFilterValue] = useState<string>('');

  // Interleaved Mode Toggle
  const [isInterleaved, setIsInterleaved] = useState<boolean>(true);

  // Quick 5 blitz timer and tally
  const [quick5Seconds, setQuick5Seconds] = useState<number>(0);
  const [quick5Tally, setQuick5Tally] = useState<{ gotIt: number; stillWrong: number }>({
    gotIt: 0,
    stillWrong: 0
  });

  // Queue state
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isRevealed, setIsRevealed] = useState(false);
  const [reviewedSessionCount, setReviewedSessionCount] = useState(0);
  const [masteredSessionCount, setMasteredSessionCount] = useState(0);
  const [justMastered, setJustMastered] = useState(false);

  // Compute Daily Queue items: due today or earlier, not mastered
  const rawDailyQueue = useMemo(() => {
    return mistakes.filter((m) => {
      return m.status !== 'Mastered' && m.nextReviewDate <= todayStr;
    });
  }, [mistakes, todayStr]);

  // Weakness-weighted sorted queue:
  // (a) high weight, (b) high consecutive wrong, (c) overdue review date
  const weaknessSortedQueue = useMemo(() => {
    return sortQueueByWeakness(rawDailyQueue, todayStr);
  }, [rawDailyQueue, todayStr]);

  // Interleaved queue: mix questions across subjects rather than blocking by single topic
  const interleavedQueue = useMemo(() => {
    if (isInterleaved) {
      return interleaveQueue(weaknessSortedQueue);
    }
    return weaknessSortedQueue;
  }, [weaknessSortedQueue, isInterleaved]);

  // Quick 5 queue: top 5 questions from interleaved/weakness queue
  const quick5Queue = useMemo(() => {
    return getQuick5Queue(interleavedQueue);
  }, [interleavedQueue]);

  // Compute Retry Mode items (excluding Mastered cards)
  const retryQueue = useMemo(() => {
    return mistakes.filter((m) => {
      if (m.status === 'Mastered') return false;
      if (!retryFilterValue) return false;
      if (retryFilterType === 'topic') return m.topic === retryFilterValue;
      if (retryFilterType === 'errorType') return m.errorTypes.includes(retryFilterValue);
      return false;
    });
  }, [mistakes, retryFilterValue, retryFilterType]);

  const activeQueue = mode === 'daily-queue'
    ? interleavedQueue
    : mode === 'quick-5'
      ? quick5Queue
      : retryQueue;

  const currentCard = activeQueue[currentIndex];

  // Quick 5 timer tick
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    if (mode === 'quick-5' && activeQueue.length > 0) {
      interval = setInterval(() => {
        setQuick5Seconds((s) => s + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [mode, activeQueue.length]);

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
      if (mode === 'quick-5') {
        setQuick5Tally((t) => ({
          gotIt: outcome === 'got-it' ? t.gotIt + 1 : t.gotIt,
          stillWrong: outcome === 'still-wrong' ? t.stillWrong + 1 : t.stillWrong
        }));
      }

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
    [currentCard, onRefresh, activeQueue.length, mode]
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

  const formatTimer = (totalSeconds: number): string => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

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

        {/* Action Controls: Export Anki + Mode Switcher */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => downloadAnkiCsv(mistakes)}
            className="px-3 py-1.5 rounded-xl border-2 border-[var(--ink-border)] bg-[var(--card-bg)] hover:bg-[var(--surface-tag)] text-[var(--ink-border)] text-xs font-bold shadow-manga-sm flex items-center gap-1.5 transition-all"
            title="Export review deck to Anki-compatible CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Anki CSV</span>
          </button>

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
              {rawDailyQueue.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-[var(--accent-sakura)] text-[var(--ink-border)] text-[10px] font-black">
                  {rawDailyQueue.length}
                </span>
              )}
            </button>

            <button
              onClick={() => {
                setMode('quick-5');
                setIsRevealed(false);
                setCurrentIndex(0);
                setQuick5Seconds(0);
                setQuick5Tally({ gotIt: 0, stillWrong: 0 });
              }}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                mode === 'quick-5'
                  ? 'bg-[var(--card-bg)] text-[var(--ink-border)] shadow-manga-sm'
                  : 'text-[var(--ink-muted)] hover:text-[var(--ink-border)]'
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              <span>Quick 5</span>
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
      </div>

      {/* Sub-bar: Interleaving Toggle & Quick 5 Timer */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs bg-[var(--card-bg)] p-3 rounded-xl border-2 border-[var(--ink-border)] shadow-manga-sm">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsInterleaved(!isInterleaved)}
            className={`px-3 py-1 rounded-lg text-xs font-bold border-2 border-[var(--ink-border)] flex items-center gap-1.5 transition-all ${
              isInterleaved
                ? 'bg-[var(--accent-mint)]/30 text-[var(--ink-border)] shadow-manga-sm'
                : 'bg-[var(--surface-tag)] text-[var(--ink-muted)]'
            }`}
            title="Interleaved review mode mixes questions across subjects rather than blocking by single topic"
          >
            <Shuffle className="w-3.5 h-3.5" />
            <span>Interleaved Mode: {isInterleaved ? 'ON' : 'OFF'}</span>
          </button>
          <span className="text-[11px] text-[var(--ink-muted)] hidden sm:inline">
            Weakness-sorted (high weight + failing + overdue first)
          </span>
        </div>

        {mode === 'quick-5' && (
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 font-mono font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/30">
              <Timer className="w-3.5 h-3.5 animate-pulse" />
              <span>{formatTimer(quick5Seconds)}</span>
              <span className="text-[10px] text-[var(--ink-muted)]">/ 10:00 max</span>
            </span>
            <div className="text-[11px] font-mono">
              <span className="text-emerald-600 font-bold">{quick5Tally.gotIt} ✓</span>
              <span className="text-[var(--ink-muted)] mx-1">|</span>
              <span className="text-rose-600 font-bold">{quick5Tally.stillWrong} ✗</span>
            </div>
          </div>
        )}
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
                : mode === 'quick-5'
                  ? 'Quick 5 Blitz Complete!'
                  : mode === 'daily-queue'
                    ? 'Quest Complete For Today!'
                    : `No More Mistakes Found in "${retryFilterValue}"`}
            </h3>
            <p className="text-xs text-[var(--ink-muted)] max-w-md mx-auto mt-1 leading-relaxed">
              {mistakes.length === 0
                ? 'Log mistakes from your mocks or paper attempts to unlock your personalized Spaced Repetition queue.'
                : mode === 'quick-5'
                  ? `Completed 5-question blitz in ${formatTimer(quick5Seconds)}. Result: ${quick5Tally.gotIt} recalled, ${quick5Tally.stillWrong} need review.`
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

          {mistakes.length > 0 && (
            <div className="pt-2 flex flex-wrap justify-center gap-3">
              {mode !== 'quick-5' && (
                <button
                  onClick={() => {
                    setMode('quick-5');
                    setIsRevealed(false);
                    setCurrentIndex(0);
                    setQuick5Seconds(0);
                    setQuick5Tally({ gotIt: 0, stillWrong: 0 });
                  }}
                  className="px-5 py-2.5 rounded-xl border-2 border-[var(--ink-border)] bg-[var(--accent-sakura)] text-[var(--ink-border)] text-xs font-bold shadow-manga-sm hover:-translate-y-0.5 transition-all flex items-center gap-2"
                >
                  <Zap className="w-4 h-4 text-amber-500" />
                  <span>Start a Quick 5 Blitz</span>
                </button>
              )}
              {mode !== 'retry-mode' && (
                <button
                  onClick={() => {
                    setMode('retry-mode');
                    setIsRevealed(false);
                  }}
                  className="px-5 py-2.5 rounded-xl border-2 border-[var(--ink-border)] bg-[var(--surface-tag)] text-[var(--ink-border)] text-xs font-bold shadow-manga-sm hover:-translate-y-0.5 transition-all"
                >
                  Practice in Targeted Retry Mode
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Progress Banner & Keyboard Shortcuts Pill */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 text-[var(--ink-muted)]">
              <span className="font-bold">
                {mode === 'quick-5' ? `Blitz Card 1 of ${activeQueue.length}` : `Card 1 of ${activeQueue.length}`}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1 text-amber-500 font-bold">
                <Flame className="w-4 h-4 fill-amber-500 text-amber-500" />
                <span>{currentCard.consecutiveCorrect || 0} / 3 to Defeat</span>
              </span>
              {getDaysOverdue(currentCard.nextReviewDate, todayStr) > 0 && (
                <span className="px-2 py-0.5 rounded bg-rose-500/10 text-rose-600 font-bold text-[10px] border border-rose-500/30">
                  {getDaysOverdue(currentCard.nextReviewDate, todayStr)}d Overdue
                </span>
              )}
              {getConsecutiveWrongCount(currentCard) > 1 && (
                <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 font-bold text-[10px] border border-amber-500/30">
                  {getConsecutiveWrongCount(currentCard)}x Consecutive Wrong
                </span>
              )}
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
                  <div className="text-sm text-[var(--ink-border)] leading-relaxed font-bold">
                    {renderFormattedContent(currentCard.questionText)}
                  </div>

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
                      <div className="text-[var(--ink-border)] font-medium leading-relaxed">
                        {renderFormattedContent(currentCard.correctSolution)}
                      </div>
                    </div>

                    {/* Better Approach / Shortcut */}
                    <div className="p-3.5 rounded-xl border-2 border-[var(--ink-border)] bg-[var(--accent-mint)]/20 text-xs space-y-1">
                      <div className="font-display font-bold text-emerald-700 dark:text-emerald-400 text-[11px]">
                        BETTER APPROACH / SHORTCUT:
                      </div>
                      <div className="text-[var(--ink-border)] font-medium leading-relaxed">
                        {renderFormattedContent(currentCard.betterApproach)}
                      </div>
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
