import React, { useState, useEffect, useMemo } from 'react';
import { db, DEFAULT_PROFILES } from '../db/db';
import { ExamProfile, MockTest, MistakeEntry, SyllabusProgress } from '../types';
import {
  Award,
  Calendar,
  Clock,
  Layers,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  BookOpen,
  FileText,
  Target,
  ArrowRight
} from 'lucide-react';

export interface AllExamsViewProps {
  onSelectExam?: (examId: string, stageId?: string) => void;
  onNavigateToSettings?: () => void;
}

interface ExamStats {
  mockCount: number;
  averageScore: number;
  latestScore: number | null;
  overallAccuracy: number;
  activeMistakes: number;
  syllabusMasteredCount: number;
  totalSyllabusTopics: number;
}

export const AllExamsView: React.FC<AllExamsViewProps> = ({
  onSelectExam,
  onNavigateToSettings
}) => {
  const [profiles, setProfiles] = useState<ExamProfile[]>(DEFAULT_PROFILES);
  const [mocks, setMocks] = useState<MockTest[]>([]);
  const [mistakes, setMistakes] = useState<MistakeEntry[]>([]);
  const [syllabusList, setSyllabusList] = useState<SyllabusProgress[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    Promise.all([
      db.profiles.toArray(),
      db.mocks.toArray(),
      db.mistakes.toArray(),
      db.syllabusProgress.toArray()
    ])
      .then(([profs, mks, msts, syl]) => {
        if (!isMounted) return;
        if (profs && profs.length > 0) setProfiles(profs);
        if (mks) setMocks(mks);
        if (msts) setMistakes(msts);
        if (syl) setSyllabusList(syl);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Compute stats per exam
  const statsByExam = useMemo(() => {
    const map: Record<string, ExamStats> = {};

    for (const prof of profiles) {
      // Find mocks matching exam
      const examMocks = mocks.filter((m) => {
        const idMatch = m.examId === prof.id;
        const nameMatch = m.name?.toLowerCase().includes(prof.name.toLowerCase().split(' ')[0]);
        return idMatch || nameMatch;
      });

      const mockCount = examMocks.length;
      const totalScore = examMocks.reduce((sum, m) => sum + m.totalNetScore, 0);
      const averageScore = mockCount > 0 ? Number((totalScore / mockCount).toFixed(1)) : 0;
      const latestScore = mockCount > 0 ? examMocks[mockCount - 1].totalNetScore : null;

      const totalAttempted = examMocks.reduce((sum, m) => sum + m.totalAttempted, 0);
      const totalCorrect = examMocks.reduce((sum, m) => sum + m.totalCorrect, 0);
      const overallAccuracy = totalAttempted > 0
        ? Math.round((totalCorrect / totalAttempted) * 100)
        : 0;

      // Mistakes matching exam
      const examMistakes = mistakes.filter((m) => {
        return m.examId === prof.id || (!m.examId && prof.isDefault);
      });
      const activeMistakes = examMistakes.filter((m) => m.status !== 'Mastered').length;

      // Syllabus progress matching exam
      const examSyllabus = syllabusList.filter((s) => s.examId === prof.id);
      const syllabusMasteredCount = examSyllabus.filter((s) => s.status === 'mastered').length;
      const totalSyllabusTopics = Math.max(
        examSyllabus.length,
        prof.sections?.reduce((sum, sec) => sum + sec.topics.length, 0) || 0
      );

      map[prof.id] = {
        mockCount,
        averageScore,
        latestScore,
        overallAccuracy,
        activeMistakes,
        syllabusMasteredCount,
        totalSyllabusTopics
      };
    }

    return map;
  }, [profiles, mocks, mistakes, syllabusList]);

  // Exam Timeline / Target dates info
  const examDatesInfo: Record<string, { targetWindow: string; note: string; isTentative: boolean }> = {
    'gate-cs': {
      targetWindow: 'February 2027',
      note: 'Annual cycle: First two weekends of February',
      isTentative: false
    },
    'sebi-it': {
      targetWindow: 'August – September 2026',
      note: 'Phase 1: August; Phase 2: September (Annual Notification)',
      isTentative: true
    },
    'ibps-so-it': {
      targetWindow: 'December 2026 – January 2027',
      note: 'Prelims: Late Dec; Mains: Late Jan (CRP Specialist Officers)',
      isTentative: true
    }
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="p-6 rounded-2xl border-2 border-[var(--ink-border)] bg-[var(--bg-panel)] shadow-manga space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-[var(--sakura)] text-white flex items-center justify-center shadow-xs">
                <Layers className="w-4.5 h-4.5" />
              </div>
              <h2 className="font-display text-2xl font-bold text-[var(--ink)] dark:text-[var(--text-main)]">
                All Exams Master View
              </h2>
            </div>
            <p className="text-xs text-[var(--text-muted)] max-w-2xl leading-relaxed">
              Consolidated preparation status, target qualifying cutoffs, important notification dates, and stage architecture across your active competitive exams.
            </p>
          </div>

          {onNavigateToSettings && (
            <button
              onClick={onNavigateToSettings}
              className="manga-btn px-4 py-2 rounded-xl border-2 border-[var(--ink-border)] bg-[var(--bg-surface)] hover:bg-[var(--sakura-soft)] text-xs font-bold transition-all shadow-manga-sm hover:-translate-y-0.5 shrink-0"
            >
              Configure Profiles & Rules
            </button>
          )}
        </div>

        {/* Global Summary Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-[var(--ink-border)]/40">
          <div className="p-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--ink-border)]">
            <span className="text-[10px] font-mono text-[var(--text-muted)] uppercase block font-bold">Active Profiles</span>
            <span className="font-display text-xl font-bold text-[var(--ink)] dark:text-[var(--text-main)]">{profiles.length}</span>
          </div>
          <div className="p-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--ink-border)]">
            <span className="text-[10px] font-mono text-[var(--text-muted)] uppercase block font-bold">Total Mocks Logged</span>
            <span className="font-display text-xl font-bold text-[var(--action-primary)]">{mocks.length}</span>
          </div>
          <div className="p-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--ink-border)]">
            <span className="text-[10px] font-mono text-[var(--text-muted)] uppercase block font-bold">Total Active Mistakes</span>
            <span className="font-display text-xl font-bold text-rose-500">{mistakes.filter(m => m.status !== 'Mastered').length}</span>
          </div>
          <div className="p-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--ink-border)]">
            <span className="text-[10px] font-mono text-[var(--text-muted)] uppercase block font-bold">Mastery Engine</span>
            <span className="font-display text-xl font-bold text-emerald-600 dark:text-emerald-400">SPEC A Active</span>
          </div>
        </div>
      </div>

      {/* Profiles Cards */}
      <div className="space-y-6">
        {profiles.map((profile) => {
          const stats = statsByExam[profile.id] || {
            mockCount: 0,
            averageScore: 0,
            latestScore: null,
            overallAccuracy: 0,
            activeMistakes: 0,
            syllabusMasteredCount: 0,
            totalSyllabusTopics: 0
          };

          const stages = profile.stages || [];
          const dateMeta = examDatesInfo[profile.id] || {
            targetWindow: 'Tentative',
            note: 'Refer to official recruitment website for latest schedule',
            isTentative: true
          };

          const hasUnverified = (profile.unverifiedFields || []).length > 0;
          const isCutoffUnverified = (profile.unverifiedFields || []).includes('cutoffMarks');

          return (
            <div
              key={profile.id}
              className="p-6 rounded-2xl border-2 border-[var(--ink-border)] bg-[var(--bg-panel)] shadow-manga space-y-5 transition-all hover:border-[var(--sakura)]"
            >
              {/* Card Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--ink-border)] pb-4">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-display text-lg font-bold text-[var(--ink)] dark:text-[var(--text-main)]">
                      {profile.name}
                    </h3>
                    {profile.targetYear && (
                      <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-[var(--peach-soft)] border border-[var(--ink-border)] text-[var(--ink)]">
                        Target {profile.targetYear}
                      </span>
                    )}
                    {hasUnverified && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300 font-bold">
                        <AlertTriangle className="w-3 h-3 text-amber-700" />
                        <span>UNVERIFIED, confirm</span>
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[var(--text-muted)] font-medium">
                    {profile.examName}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {onSelectExam && (
                    <button
                      onClick={() => onSelectExam(profile.id, stages[0]?.id)}
                      className="manga-btn inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--action-primary)] hover:bg-[var(--sakura)] text-white text-xs font-bold shadow-manga-sm hover:-translate-y-0.5 transition-all"
                    >
                      <span>Switch to Exam</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Progress & Target Cutoffs Grid */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Score & Cutoff */}
                <div className="p-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--ink-border)] space-y-2">
                  <span className="text-[10px] font-mono text-[var(--text-muted)] uppercase block font-bold">
                    Target & Qualifying Cutoff
                  </span>
                  <div className="flex items-baseline justify-between">
                    <div>
                      <span className="text-xs text-[var(--text-muted)] block">Target Score</span>
                      <span className="font-display text-xl font-bold text-[var(--ink)] dark:text-[var(--text-main)]">
                        {profile.targetScore ?? 65} pts
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <span className="text-xs text-[var(--text-muted)]">Cutoff</span>
                        {isCutoffUnverified && (
                          <span
                            className="text-[9px] font-mono px-1 py-0.2 rounded bg-amber-100 text-amber-800 font-bold"
                            title="Cutoff is unverified approximation from notification archive"
                          >
                            UNVERIFIED
                          </span>
                        )}
                      </div>
                      <span className="font-display text-xl font-bold text-[var(--action-primary)]">
                        {stages[0]?.cutoffMarks ?? profile.overallCutoff ?? 'N/A'} pts
                      </span>
                    </div>
                  </div>
                  {profile.sourceUrl && (
                    <div className="pt-1 border-t border-[var(--ink-border)]/20">
                      <a
                        href={profile.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[10px] font-mono text-[var(--action-primary)] hover:underline truncate max-w-full"
                        title={profile.sourceUrl}
                      >
                        <span>Source: {profile.sourceUrl.replace(/^https?:\/\//, '')}</span>
                        <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                      </a>
                    </div>
                  )}
                </div>

                {/* Mock Performance */}
                <div className="p-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--ink-border)] space-y-2">
                  <span className="text-[10px] font-mono text-[var(--text-muted)] uppercase block font-bold">
                    Mock Test Performance
                  </span>
                  <div className="flex items-baseline justify-between">
                    <div>
                      <span className="text-xs text-[var(--text-muted)] block">Mocks Taken</span>
                      <span className="font-display text-xl font-bold text-[var(--ink)] dark:text-[var(--text-main)]">
                        {stats.mockCount}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-[var(--text-muted)] block">Average Score</span>
                      <span className="font-display text-xl font-bold text-emerald-600 dark:text-emerald-400">
                        {stats.averageScore} pts
                      </span>
                    </div>
                  </div>
                  <div className="text-[11px] font-mono text-[var(--text-muted)] flex items-center justify-between pt-1 border-t border-[var(--ink-border)]/20">
                    <span>Accuracy: {stats.overallAccuracy}%</span>
                    <span>Latest: {stats.latestScore !== null ? `${stats.latestScore}m` : '--'}</span>
                  </div>
                </div>

                {/* Important Dates */}
                <div className="p-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--ink-border)] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-[var(--text-muted)] uppercase font-bold flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-[var(--sakura)]" />
                      <span>Exam Timeline</span>
                    </span>
                    {dateMeta.isTentative && (
                      <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 font-bold">
                        UNVERIFIED, confirm
                      </span>
                    )}
                  </div>
                  <div className="font-display text-sm font-bold text-[var(--ink)] dark:text-[var(--text-main)]">
                    {dateMeta.targetWindow}
                  </div>
                  <p className="text-[11px] text-[var(--text-muted)] leading-relaxed pt-1 border-t border-[var(--ink-border)]/20">
                    {dateMeta.note}
                  </p>
                </div>

                {/* Mistakes & Syllabus */}
                <div className="p-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--ink-border)] space-y-2">
                  <span className="text-[10px] font-mono text-[var(--text-muted)] uppercase block font-bold">
                    Mastery & Review Queue
                  </span>
                  <div className="flex items-baseline justify-between">
                    <div>
                      <span className="text-xs text-[var(--text-muted)] block">Active Mistakes</span>
                      <span className="font-display text-xl font-bold text-rose-500">
                        {stats.activeMistakes}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-[var(--text-muted)] block">Topics Mastered</span>
                      <span className="font-display text-xl font-bold text-emerald-600 dark:text-emerald-400">
                        {stats.syllabusMasteredCount} / {stats.totalSyllabusTopics}
                      </span>
                    </div>
                  </div>
                  <div className="pt-1 border-t border-[var(--ink-border)]/20 text-[11px] text-[var(--text-muted)]">
                    <span>Spaced Repetition Active</span>
                  </div>
                </div>
              </div>

              {/* Stage Architecture Breakdown */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-display text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-[var(--action-primary)]" />
                    <span>Stage Architecture & Question Schemes ({stages.length} Stages)</span>
                  </h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {stages.map((stage) => {
                    return (
                      <div
                        key={stage.id}
                        className="p-3.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--ink-border)] space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-display text-xs font-bold text-[var(--ink)] dark:text-[var(--text-main)]">
                            {stage.name}
                          </span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[var(--bg-panel)] border border-[var(--ink-border)] font-bold">
                            {stage.totalMarks} Marks • {stage.durationMinutes} Min
                          </span>
                        </div>

                        {/* Sections in Stage */}
                        <div className="space-y-1 text-xs">
                          {stage.sections.map((sec) => (
                            <div
                              key={sec.id}
                              className="flex items-center justify-between py-1 border-b border-[var(--ink-border)]/20 last:border-0"
                            >
                              <span className="text-[var(--ink)] dark:text-[var(--text-main)] font-semibold truncate max-w-[200px]">
                                {sec.name}
                              </span>
                              <span className="font-mono text-[11px] text-[var(--text-muted)]">
                                {sec.totalQuestions} Qs • Cutoff: {sec.sectionalCutoff}m
                              </span>
                            </div>
                          ))}
                        </div>

                        {/* Marking rules preview */}
                        {stage.markingRules && stage.markingRules.length > 0 && (
                          <div className="pt-1.5 border-t border-[var(--ink-border)]/30 flex flex-wrap gap-1.5">
                            {stage.markingRules.map((rule, idx) => (
                              <span
                                key={idx}
                                className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--bg-panel)] border border-[var(--ink-border)]"
                              >
                                {rule.questionType} (+{rule.marks} / -{rule.negativeMarks || 0})
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
