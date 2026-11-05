import React, { useState, useEffect, useRef } from 'react';
import { db, DEFAULT_PROFILES } from '../db/db';
import { ExamProfile, ExamStage } from '../types';
import {
  ChevronDown,
  Layers,
  Award,
  Check,
  Calendar,
  AlertTriangle,
  ExternalLink,
  BookOpen
} from 'lucide-react';

export interface ExamSwitcherProps {
  currentExamId?: string;
  currentStageId?: string;
  onSelectExam: (examId: string, stageId?: string) => void;
  onSelectStage?: (stageId: string) => void;
  className?: string;
  compact?: boolean;
}

export const ExamSwitcher: React.FC<ExamSwitcherProps> = ({
  currentExamId = 'gate-cs',
  currentStageId,
  onSelectExam,
  onSelectStage,
  className = '',
  compact = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [profiles, setProfiles] = useState<ExamProfile[]>(DEFAULT_PROFILES);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load profiles from db
  useEffect(() => {
    let isMounted = true;
    db.profiles
      .toArray()
      .then((profs) => {
        if (isMounted && profs && profs.length > 0) {
          setProfiles(profs);
        }
      })
      .catch(() => {
        // Fallback to DEFAULT_PROFILES
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const activeProfile = profiles.find((p) => p.id === currentExamId);
  const isAllExams = currentExamId === 'all';

  // Determine active stage
  const activeStage: ExamStage | undefined = activeProfile?.stages?.find(
    (s) => s.id === currentStageId
  ) || activeProfile?.stages?.[0];

  const handleSelectExam = (examId: string, defaultStageId?: string) => {
    onSelectExam(examId, defaultStageId);
    setIsOpen(false);
  };

  const handleStageChange = (e: React.MouseEvent, stageId: string) => {
    e.stopPropagation();
    if (onSelectStage) {
      onSelectStage(stageId);
    } else {
      onSelectExam(currentExamId, stageId);
    }
  };

  return (
    <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`manga-btn inline-flex items-center gap-2.5 px-3.5 py-2 rounded-xl border-2 border-[var(--ink-border)] bg-[var(--bg-panel)] hover:bg-[var(--bg-surface)] text-[var(--ink)] dark:text-[var(--text-main)] shadow-manga-sm transition-all ${
          isOpen ? 'ring-2 ring-[var(--sakura)]' : ''
        }`}
        aria-expanded={isOpen}
        aria-haspopup="true"
        title="Switch active exam or view all exams"
      >
        <div className="w-6 h-6 rounded-lg bg-[var(--sakura-soft)] flex items-center justify-center shrink-0 border border-[var(--ink-border)]">
          {isAllExams ? (
            <Layers className="w-3.5 h-3.5 text-[var(--sakura)]" />
          ) : (
            <Award className="w-3.5 h-3.5 text-[var(--sakura)]" />
          )}
        </div>

        <div className="text-left flex flex-col">
          <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-muted)] leading-tight">
            Active Exam
          </span>
          <span className="font-display text-xs font-bold truncate max-w-[170px] sm:max-w-[220px]">
            {isAllExams ? 'All Exams View' : activeProfile?.name || 'GATE CS (2027)'}
          </span>
        </div>

        {!isAllExams && activeStage && !compact && (
          <span className="hidden sm:inline-block text-[10px] font-mono px-2 py-0.5 rounded-md bg-[var(--peach-soft)] border border-[var(--ink-border)] font-bold text-[var(--ink)] shrink-0">
            {activeStage.name.split(' ')[0]}
          </span>
        )}

        <ChevronDown
          className={`w-4 h-4 text-[var(--text-muted)] transition-transform duration-200 shrink-0 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 sm:left-0 z-50 mt-2 w-80 sm:w-96 rounded-2xl bg-[var(--bg-panel)] border-2 border-[var(--ink-border)] shadow-manga-lg p-2.5 space-y-2 animate-in fade-in zoom-in-95 duration-100">
          <div className="px-2 py-1 border-b border-[var(--ink-border)] pb-2 flex items-center justify-between">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Exam Switcher & Profiles
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[var(--bg-surface)] border border-[var(--ink-border)] font-bold">
              {profiles.length} Profiles
            </span>
          </div>

          {/* Option: All Exams Overview */}
          <button
            type="button"
            onClick={() => handleSelectExam('all')}
            className={`w-full text-left p-2.5 rounded-xl border-2 transition-all flex items-center justify-between gap-3 ${
              isAllExams
                ? 'bg-[var(--sakura-soft)] border-[var(--sakura)] shadow-manga-sm'
                : 'bg-[var(--bg-surface)] border-transparent hover:border-[var(--ink-border)] hover:bg-[var(--bg-panel)]'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[var(--sakura)] text-white flex items-center justify-center shrink-0 shadow-xs">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <div className="font-display text-xs font-bold text-[var(--ink)] dark:text-[var(--text-main)] flex items-center gap-1.5">
                  <span>All Exams Overview</span>
                </div>
                <div className="text-[10px] text-[var(--text-muted)]">
                  Progress, cutoffs & dates across GATE, SEBI & IBPS
                </div>
              </div>
            </div>
            {isAllExams && <Check className="w-4 h-4 text-[var(--sakura)] shrink-0" />}
          </button>

          {/* Specific Exam Profiles */}
          <div className="space-y-1.5 pt-1">
            {profiles.map((profile) => {
              const isSelected = !isAllExams && profile.id === currentExamId;
              const hasUnverified = (profile.unverifiedFields || []).length > 0;
              const stages = profile.stages || [];

              return (
                <div
                  key={profile.id}
                  onClick={() => handleSelectExam(profile.id, stages[0]?.id)}
                  className={`w-full text-left p-3 rounded-xl border-2 transition-all cursor-pointer space-y-2 ${
                    isSelected
                      ? 'bg-[var(--mint-soft)] border-[var(--mint)] shadow-manga-sm'
                      : 'bg-[var(--bg-surface)] border-transparent hover:border-[var(--ink-border)] hover:bg-[var(--bg-panel)]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-display text-xs font-bold text-[var(--ink)] dark:text-[var(--text-main)] flex items-center gap-1.5 truncate">
                        <span>{profile.name}</span>
                        {profile.targetYear && (
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[var(--bg-panel)] border border-[var(--ink-border)] text-[var(--text-muted)]">
                            {profile.targetYear}
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-[var(--text-muted)] truncate mt-0.5">
                        {profile.examName}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {hasUnverified && (
                        <span
                          className="inline-flex items-center gap-0.5 text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 font-bold"
                          title="Contains unverified cutoff / dates needing confirmation"
                        >
                          <AlertTriangle className="w-2.5 h-2.5 text-amber-700" />
                          <span>UNVERIFIED</span>
                        </span>
                      )}
                      {isSelected && <Check className="w-4 h-4 text-emerald-600 shrink-0" />}
                    </div>
                  </div>

                  {/* Stage Switcher Pills if multiple stages or stage selection */}
                  {stages.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-[var(--ink-border)]/20">
                      <span className="text-[9px] font-mono text-[var(--text-muted)] uppercase">Stage:</span>
                      {stages.map((stg) => {
                        const isCurrentStage = isSelected && (currentStageId === stg.id || (!currentStageId && stg === stages[0]));
                        return (
                          <button
                            key={stg.id}
                            type="button"
                            onClick={(e) => {
                              handleStageChange(e, stg.id);
                              onSelectExam(profile.id, stg.id);
                              setIsOpen(false);
                            }}
                            className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold transition-all border ${
                              isCurrentStage
                                ? 'bg-[var(--action-primary)] text-white border-[var(--action-primary)] shadow-xs'
                                : 'bg-[var(--bg-panel)] text-[var(--text-muted)] border-[var(--ink-border)] hover:text-[var(--ink)]'
                            }`}
                          >
                            {stg.name}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Cutoff & Source Link */}
                  <div className="flex items-center justify-between text-[10px] font-mono text-[var(--text-muted)] pt-0.5">
                    <span>
                      Cutoff:{' '}
                      <strong className="text-[var(--ink)] dark:text-[var(--text-main)]">
                        {stages[0]?.cutoffMarks ?? profile.overallCutoff ?? 'N/A'} pts
                      </strong>
                    </span>
                    {profile.sourceUrl && (
                      <a
                        href={profile.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 text-[var(--action-primary)] hover:underline"
                        title={profile.sourceUrl}
                      >
                        <span>Official Source</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
