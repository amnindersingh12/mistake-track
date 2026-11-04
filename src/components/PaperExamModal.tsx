import React, { useState, useEffect } from 'react';
import { PaperTest, PaperQuestion, MockTest, ExamSettings } from '../types';
import { db } from '../db/db';
import { Mascot } from './Mascot';
import {
  Clock,
  CheckCircle,
  AlertCircle,
  Flag,
  ArrowRight,
  ArrowLeft,
  X,
  Layers,
  Award
} from 'lucide-react';

interface PaperExamModalProps {
  paper: PaperTest;
  settings: ExamSettings;
  isOpen: boolean;
  onClose: () => void;
  onFinished: (mockId: number) => void;
}

export const PaperExamModal: React.FC<PaperExamModalProps> = ({
  paper,
  settings,
  isOpen,
  onClose,
  onFinished
}) => {
  if (!isOpen) return null;

  const totalSeconds = (paper.totalTimeMinutes || 60) * 60;
  const [secondsRemaining, setSecondsRemaining] = useState(totalSeconds);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

  // User responses: questionId -> selectedOptionIndex (0-4)
  const [responses, setResponses] = useState<Record<string, number>>({});
  // Marked for review: questionId -> boolean
  const [markedForReview, setMarkedForReview] = useState<Record<string, boolean>>({});

  const [isSubmitConfirmOpen, setIsSubmitConfirmOpen] = useState(false);

  // Timer countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleSubmitExam();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const questions = paper.questions || [];
  const currentQ = questions[currentQuestionIndex];

  // Active section from current question
  const currentSectionId = currentQ?.sectionId || settings.sections[0]?.id || 'quant';

  const handleSelectOption = (optIdx: number) => {
    if (!currentQ) return;
    setResponses((prev) => ({
      ...prev,
      [currentQ.id]: optIdx
    }));
  };

  const handleClearResponse = () => {
    if (!currentQ) return;
    setResponses((prev) => {
      const next = { ...prev };
      delete next[currentQ.id];
      return next;
    });
  };

  const handleToggleMarkReview = () => {
    if (!currentQ) return;
    setMarkedForReview((prev) => ({
      ...prev,
      [currentQ.id]: !prev[currentQ.id]
    }));
  };

  // Keyboard shortcuts for exam navigation
  useEffect(() => {
    if (!isOpen || questions.length === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is in an input
      const activeEl = document.activeElement;
      if (
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          activeEl.tagName === 'SELECT')
      ) {
        return;
      }

      if (e.key === 'ArrowRight' || e.key === 'Enter') {
        e.preventDefault();
        setCurrentQuestionIndex((i) => Math.min(questions.length - 1, i + 1));
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setCurrentQuestionIndex((i) => Math.max(0, i - 1));
      } else if (e.key.toLowerCase() === 'm') {
        e.preventDefault();
        handleToggleMarkReview();
      } else if (e.key.toLowerCase() === 'c') {
        e.preventDefault();
        handleClearResponse();
      } else if (['1', '2', '3', '4', '5'].includes(e.key)) {
        const idx = parseInt(e.key, 10) - 1;
        if (currentQ && currentQ.options[idx] !== undefined) {
          e.preventDefault();
          handleSelectOption(idx);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, questions.length, currentQ]);

  // Submit and auto-grade
  const handleSubmitExam = async () => {
    const timeSpentSeconds = totalSeconds - secondsRemaining;

    // Per section calculation
    const sectionBreakdown: Record<
      string,
      { attempted: number; correct: number; wrong: number; unattempted: number }
    > = {};

    settings.sections.forEach((s) => {
      sectionBreakdown[s.id] = { attempted: 0, correct: 0, wrong: 0, unattempted: 0 };
    });

    const mistakesToAutoLog: any[] = [];

    questions.forEach((q) => {
      const secId = q.sectionId;
      if (!sectionBreakdown[secId]) {
        sectionBreakdown[secId] = { attempted: 0, correct: 0, wrong: 0, unattempted: 0 };
      }

      const selected = responses[q.id];
      if (selected !== undefined) {
        sectionBreakdown[secId].attempted++;
        if (selected === q.correctOptionIndex) {
          sectionBreakdown[secId].correct++;
        } else {
          sectionBreakdown[secId].wrong++;
          // Queue mistake
          mistakesToAutoLog.push({
            sectionId: q.sectionId,
            sectionName: settings.sections.find((s) => s.id === q.sectionId)?.name || 'Section',
            topic: q.topic || 'General',
            questionNumber: q.questionNumber,
            questionText: q.text,
            myAnswer: q.options[selected] || `Option ${selected + 1}`,
            correctAnswer: q.options[q.correctOptionIndex] || `Option ${q.correctOptionIndex + 1}`,
            resultType: 'Wrong',
            errorTypes: ['Concept gap'],
            timeSpentSeconds: Math.round(timeSpentSeconds / (questions.length || 1)),
            idealTimeSeconds: 40,
            whatWentWrong: 'Missed in timed PYQ test attempt.',
            correctSolution: q.solution || 'Refer to standard solution.',
            betterApproach: q.shortcut || 'Review core approach.',
            ruleToRemember: `Carefully verify ${q.topic || 'question'} conditions.`,
            difficulty: 'Medium',
            tags: [paper.isMemoryBased ? 'memory-based' : 'pyq', `${paper.year}`],
            status: 'New',
            interval: 1,
            consecutiveCorrect: 0,
            nextReviewDate: new Date().toISOString().split('T')[0],
            history: [],
            createdAt: new Date().toISOString().split('T')[0]
          });
        }
      } else {
        sectionBreakdown[secId].unattempted++;
      }
    });

    let totalAttempted = 0;
    let totalCorrect = 0;
    let totalWrong = 0;
    let totalNetScore = 0;

    const sections = settings.sections.map((sec) => {
      const b = sectionBreakdown[sec.id] || { attempted: 0, correct: 0, wrong: 0, unattempted: sec.totalQuestions };
      const net = Number((b.correct * sec.marksPerCorrect - b.wrong * sec.negativeMark).toFixed(2));
      const acc = b.attempted > 0 ? Number(((b.correct / b.attempted) * 100).toFixed(1)) : 0;
      const neg = Number((b.wrong * sec.negativeMark).toFixed(2));

      totalAttempted += b.attempted;
      totalCorrect += b.correct;
      totalWrong += b.wrong;
      totalNetScore += net;

      return {
        sectionId: sec.id,
        sectionName: sec.name,
        attempted: b.attempted,
        correct: b.correct,
        wrong: b.wrong,
        timeSpentSeconds: Math.round(timeSpentSeconds / settings.sections.length),
        unattempted: Math.max(0, sec.totalQuestions - b.attempted),
        netScore: net,
        accuracy: acc,
        marksLostNegative: neg
      };
    });

    const overallAccuracy = totalAttempted > 0 ? Number(((totalCorrect / totalAttempted) * 100).toFixed(1)) : 0;
    const totalNeg = Number(sections.reduce((s, x) => s + x.marksLostNegative, 0).toFixed(2));

    const mockName = `${paper.examName} (${paper.year}${paper.shift ? ` Shift ${paper.shift}` : ''}${paper.isMemoryBased ? ' Memory-Based' : ' PYQ'})`;

    const mockId = await db.mocks.add({
      name: mockName,
      date: new Date().toISOString().split('T')[0],
      source: paper.isMemoryBased ? 'Memory-Based Paper' : 'Previous Year Paper',
      attemptType: paper.isMemoryBased ? 'memory-based' : 'pyq',
      paperId: paper.id,
      sections,
      totalAttempted,
      totalCorrect,
      totalWrong,
      totalUnattempted: questions.length - totalAttempted,
      totalNetScore: Number(totalNetScore.toFixed(2)),
      overallAccuracy,
      totalMarksLostNegative: totalNeg,
      totalTimeSpentSeconds: timeSpentSeconds,
      notes: `Attempted inside app in Timed Exam Mode.`
    });

    // Auto-log mistakes linked to mockId
    for (const mst of mistakesToAutoLog) {
      mst.mockId = mockId;
      mst.mockName = mockName;
      await db.mistakes.add(mst);
    }

    onFinished(mockId);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-[var(--bg-sky)] text-[var(--text-main)] flex flex-col overflow-hidden font-sans">
      {/* Top Exam Header */}
      <header className="h-14 px-4 sm:px-6 bg-[var(--bg-panel)] border-b-2 border-[var(--ink-border)] flex items-center justify-between shrink-0 shadow-sm">
        <div className="flex items-center gap-3">
          <Mascot mood="reading" size="sm" />
          <div>
            <h2 className="font-display text-xs sm:text-sm font-bold text-[var(--ink)] dark:text-[var(--text-main)] leading-tight">
              {paper.examName} ({paper.year})
            </h2>
            <span className="text-[10px] text-[var(--text-muted)] font-mono">
              {paper.isMemoryBased ? 'Memory-Based Paper' : 'Official Previous Year Paper'}
            </span>
          </div>
        </div>

        {/* Section Timer & Submit CTA */}
        <div className="flex items-center gap-3">
          <div
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg border-2 border-[var(--ink-border)] font-mono text-xs font-bold ${
              secondsRemaining < 300
                ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200 animate-pulse'
                : 'bg-[var(--bg-surface)] text-[var(--ink)] dark:text-[var(--text-main)]'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>{formatTime(secondsRemaining)}</span>
          </div>

          <button
            onClick={() => setIsSubmitConfirmOpen(true)}
            className="manga-btn px-4 py-1.5 rounded-lg bg-[var(--mint)] text-[var(--ink)] font-bold text-xs"
          >
            Submit Paper
          </button>
        </div>
      </header>

      {/* Main Examination Workspace */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Left: Question Viewer & Option Choices */}
        <div className="flex-1 p-4 sm:p-6 overflow-y-auto flex flex-col justify-between space-y-6">
          {questions.length === 0 ? (
            <div className="p-8 text-center bg-[var(--bg-surface)] rounded-2xl border-2 border-[var(--ink-border)] my-auto space-y-3">
              <Mascot mood="thinking" size="md" className="mx-auto" />
              <h3 className="font-display text-sm font-bold">No Questions in this Paper Yet</h3>
              <p className="text-xs text-[var(--text-muted)] max-w-sm mx-auto">
                Add questions to this paper via the "Add Questions" button in the Papers Library before starting a timed attempt.
              </p>
              <button
                onClick={onClose}
                className="manga-btn px-4 py-2 rounded-xl bg-[var(--peach)] text-[var(--ink)] font-bold text-xs"
              >
                Return to Library
              </button>
            </div>
          ) : (
            <div className="space-y-5 max-w-3xl mx-auto w-full">
              {/* Question Header Meta */}
              <div className="flex items-center justify-between border-b-2 border-[var(--ink-border)] pb-2 text-xs">
                <span className="font-bold text-[var(--sakura)] font-display">
                  Question #{currentQ.questionNumber} of {questions.length}
                </span>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-[var(--bg-panel)] border border-[var(--ink-border)] text-[10px] font-bold">
                    {currentQ.topic || 'General'}
                  </span>
                  {markedForReview[currentQ.id] && (
                    <span className="px-2 py-0.5 rounded bg-[var(--peach)] text-[var(--ink)] text-[10px] font-bold">
                      Marked for Review
                    </span>
                  )}
                </div>
              </div>

              {/* Question Statement */}
              <div className="p-4 sm:p-5 rounded-xl bg-[var(--bg-surface)] border-2 border-[var(--ink-border)] shadow-manga-sm space-y-3">
                <p className="text-sm font-medium leading-relaxed whitespace-pre-wrap">
                  {currentQ.text}
                </p>
                {currentQ.image && (
                  <div className="rounded-lg overflow-hidden border border-[var(--ink-border)] max-h-60 max-w-md mx-auto">
                    <img src={currentQ.image} alt="Question Diagram" className="w-full h-full object-contain" />
                  </div>
                )}
              </div>

              {/* Options Radio List */}
              <div className="space-y-2.5">
                {currentQ.options.map((opt, optIdx) => {
                  const isSelected = responses[currentQ.id] === optIdx;
                  return (
                    <button
                      key={optIdx}
                      type="button"
                      onClick={() => handleSelectOption(optIdx)}
                      className={`w-full text-left p-3.5 rounded-xl border-2 transition-all flex items-center justify-between gap-3 text-xs ${
                        isSelected
                          ? 'border-[var(--ink-border)] bg-[var(--sakura)] text-[var(--ink)] font-bold shadow-manga-sm'
                          : 'border-[var(--ink-border)]/60 bg-[var(--bg-surface)] hover:border-[var(--ink-border)] text-[var(--text-main)]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`w-6 h-6 rounded-md border-2 border-[var(--ink-border)] flex items-center justify-center font-bold text-xs shrink-0 ${
                            isSelected ? 'bg-[var(--ink)] text-white' : 'bg-[var(--bg-panel)]'
                          }`}
                        >
                          {String.fromCharCode(65 + optIdx)}
                        </span>
                        <span className="leading-snug">{opt}</span>
                      </div>
                      <kbd
                        className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                          isSelected
                            ? 'bg-black/20 text-white border-transparent'
                            : 'bg-[var(--bg-panel)] border-[var(--border-subtle)] text-[var(--text-muted)]'
                        }`}
                      >
                        {optIdx + 1}
                      </kbd>
                    </button>
                  );
                })}
              </div>

              {/* Bottom Navigation & Action Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t-2 border-[var(--ink-border)]">
                <div className="flex gap-2">
                  <button
                    onClick={handleClearResponse}
                    disabled={responses[currentQ.id] === undefined}
                    className="manga-btn px-3 py-1.5 rounded-lg border border-[var(--ink-border)] text-xs font-semibold disabled:opacity-40 flex items-center gap-1.5"
                    title="Clear response (Press C)"
                  >
                    <span>Clear Response</span>
                    <kbd className="text-[10px] font-mono px-1 py-0.2 rounded bg-black/10">C</kbd>
                  </button>
                  <button
                    onClick={handleToggleMarkReview}
                    className={`manga-btn px-3 py-1.5 rounded-lg border border-[var(--ink-border)] text-xs font-semibold flex items-center gap-1.5 ${
                      markedForReview[currentQ.id] ? 'bg-[var(--peach)] text-[var(--ink)]' : 'bg-[var(--bg-surface)]'
                    }`}
                    title="Mark for review (Press M)"
                  >
                    <Flag className="w-3.5 h-3.5" />
                    <span>{markedForReview[currentQ.id] ? 'Unmark Review' : 'Mark for Review'}</span>
                    <kbd className="text-[10px] font-mono px-1 py-0.2 rounded bg-black/10">M</kbd>
                  </button>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentQuestionIndex((i) => Math.max(0, i - 1))}
                    disabled={currentQuestionIndex === 0}
                    className="manga-btn px-3.5 py-1.5 rounded-lg bg-[var(--bg-surface)] text-xs font-bold flex items-center gap-1 disabled:opacity-40"
                    title="Previous question (Press ←)"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Previous</span>
                    <kbd className="text-[10px] font-mono px-1 py-0.2 rounded bg-black/10">←</kbd>
                  </button>
                  <button
                    onClick={() => setCurrentQuestionIndex((i) => Math.min(questions.length - 1, i + 1))}
                    disabled={currentQuestionIndex === questions.length - 1}
                    className="manga-btn px-4 py-1.5 rounded-lg bg-[var(--peach)] text-[var(--ink)] text-xs font-bold flex items-center gap-1 disabled:opacity-40"
                    title="Save & next question (Press → or Enter)"
                  >
                    <span>Save & Next</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                    <kbd className="text-[10px] font-mono px-1 py-0.2 rounded bg-black/10">↵</kbd>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right: Question Palette Drawer */}
        <div className="w-full md:w-64 bg-[var(--bg-panel)] border-t-2 md:border-t-0 md:border-l-2 border-[var(--ink-border)] p-4 flex flex-col shrink-0">
          <div className="font-display text-xs font-bold text-[var(--ink)] dark:text-[var(--text-main)] mb-2 flex items-center justify-between">
            <span>Question Palette</span>
            <span className="text-[10px] text-[var(--text-muted)] font-mono">
              {Object.keys(responses).length}/{questions.length} Ans
            </span>
          </div>

          {/* Palette Status Legend */}
          <div className="grid grid-cols-2 gap-1.5 text-[10px] mb-3 p-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--ink-border)]">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-xs bg-[var(--mint)] border border-[var(--ink-border)]" />
              <span>Answered</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-xs bg-[var(--peach)] border border-[var(--ink-border)]" />
              <span>Review</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-xs bg-[var(--bg-surface)] border border-[var(--ink-border)]" />
              <span>Unanswered</span>
            </div>
          </div>

          {/* Palette Grid */}
          <div className="flex-1 max-h-60 md:max-h-none overflow-y-auto grid grid-cols-5 gap-1.5 p-1">
            {questions.map((q, idx) => {
              const isAnswered = responses[q.id] !== undefined;
              const isReview = markedForReview[q.id];
              const isCurrent = idx === currentQuestionIndex;

              let bgClass = 'bg-[var(--bg-surface)] text-[var(--text-main)]';
              if (isReview) {
                bgClass = 'bg-[var(--peach)] text-[var(--ink)] font-bold';
              } else if (isAnswered) {
                bgClass = 'bg-[var(--mint)] text-[var(--ink)] font-bold';
              }

              return (
                <button
                  key={q.id}
                  onClick={() => setCurrentQuestionIndex(idx)}
                  className={`h-8 rounded-lg border-2 text-xs font-semibold flex items-center justify-center transition-all ${bgClass} ${
                    isCurrent ? 'border-[var(--ink-border)] ring-2 ring-[var(--sakura)] scale-105' : 'border-[var(--ink-border)]/60'
                  }`}
                >
                  {q.questionNumber}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Submit Confirmation Modal */}
      {isSubmitConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[var(--bg-panel)] p-5 rounded-2xl border-3 border-[var(--ink-border)] max-w-sm w-full space-y-4 shadow-manga-lg text-center">
            <Mascot mood="thinking" size="md" className="mx-auto" />
            <div>
              <h3 className="font-display text-sm font-bold text-[var(--ink)] dark:text-[var(--text-main)]">
                Submit Test Paper?
              </h3>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                You have answered <strong>{Object.keys(responses).length}</strong> of{' '}
                <strong>{questions.length}</strong> questions with {formatTime(secondsRemaining)} remaining.
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setIsSubmitConfirmOpen(false)}
                className="flex-1 py-2 rounded-xl border-2 border-[var(--ink-border)] bg-[var(--bg-surface)] text-xs font-bold"
              >
                Keep Solving
              </button>
              <button
                onClick={handleSubmitExam}
                className="manga-btn flex-1 py-2 rounded-xl bg-[var(--mint)] text-[var(--ink)] text-xs font-bold"
              >
                Confirm Submit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

