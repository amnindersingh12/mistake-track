import React, { useState } from 'react';
import { MockTest, ExamSettings, SectionPerformance, AttemptType } from '../types';
import { db, extractExamNameFromMock } from '../db/db';
import { getTodayDateStr } from '../utils/srs';
import { validateMockSections, MockValidationErrors } from '../utils/mockValidation';
import { Mascot } from './Mascot';
import {
  Plus,
  Trash2,
  Edit2,
  Layers,
  Calendar,
  Award,
  Clock,
  X,
  Upload,
  Image as ImageIcon
} from 'lucide-react';

interface MocksViewProps {
  mocks: MockTest[];
  settings: ExamSettings;
  onRefresh: () => void;
  onOpenDataIntake?: () => void;
}

export const MocksView: React.FC<MocksViewProps> = ({
  mocks,
  settings,
  onRefresh,
  onOpenDataIntake
}) => {
  const [filterType, setFilterType] = useState<'all' | AttemptType>('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingMockId, setEditingMockId] = useState<number | null>(null);
  const [compareMockIds, setCompareMockIds] = useState<[number | null, number | null]>([null, null]);
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);
  const [validationErrors, setValidationErrors] = useState<MockValidationErrors>({});

  // Form State
  const defaultMockName = `Mock ${String(mocks.length + 1).padStart(2, '0')}`;
  const [name, setName] = useState(defaultMockName);
  const [date, setDate] = useState(getTodayDateStr());
  const [source, setSource] = useState('Testbook');
  const [attemptType, setAttemptType] = useState<AttemptType>('mock');
  const [overallRank, setOverallRank] = useState<string>('');
  const [overallPercentile, setOverallPercentile] = useState<string>('');
  const [screenshot, setScreenshot] = useState<string | undefined>(undefined);
  const [notes, setNotes] = useState('');

  interface SectionFormState {
    sectionId: string;
    sectionName: string;
    attempted: string;
    correct: string;
    wrong: string;
    timeMinutes: string;
  }

  const [sectionInputs, setSectionInputs] = useState<SectionFormState[]>(() =>
    settings.sections.map((s) => ({
      sectionId: s.id,
      sectionName: s.name,
      attempted: '',
      correct: '',
      wrong: '',
      timeMinutes: String(s.timeLimitMinutes || 20)
    }))
  );

  const openAddModal = () => {
    setEditingMockId(null);
    setName(`Mock ${String(mocks.length + 1).padStart(2, '0')}`);
    setDate(getTodayDateStr());
    setSource('Testbook');
    setAttemptType('mock');
    setOverallRank('');
    setOverallPercentile('');
    setScreenshot(undefined);
    setNotes('');
    setSectionInputs(
      settings.sections.map((s) => ({
        sectionId: s.id,
        sectionName: s.name,
        attempted: '',
        correct: '',
        wrong: '',
        timeMinutes: String(s.timeLimitMinutes || 20)
      }))
    );
    setIsAddModalOpen(true);
  };

  const openEditModal = (mock: MockTest) => {
    setEditingMockId(mock.id || null);
    setName(mock.name);
    setDate(mock.date);
    setSource(mock.source);
    setAttemptType(mock.attemptType || 'mock');
    setOverallRank(mock.overallRank ? String(mock.overallRank) : '');
    setOverallPercentile(mock.overallPercentile ? String(mock.overallPercentile) : '');
    setScreenshot(mock.screenshot);
    setNotes(mock.notes || '');

    const inputs = settings.sections.map((sec) => {
      const existing = mock.sections.find((s) => s.sectionId === sec.id);
      return {
        sectionId: sec.id,
        sectionName: sec.name,
        attempted: existing ? String(existing.attempted) : '',
        correct: existing ? String(existing.correct) : '',
        wrong: existing ? String(existing.wrong) : '',
        timeMinutes: existing ? String(Math.round(existing.timeSpentSeconds / 60)) : String(sec.timeLimitMinutes)
      };
    });
    setSectionInputs(inputs);
    setIsAddModalOpen(true);
  };

  const handleSectionInputChange = (index: number, field: keyof SectionFormState, val: string) => {
    setValidationErrors({});
    const next = [...sectionInputs];
    next[index] = { ...next[index], [field]: val };

    if (field === 'correct' || field === 'attempted') {
      const att = Number(field === 'attempted' ? val : next[index].attempted) || 0;
      const corr = Number(field === 'correct' ? val : next[index].correct) || 0;
      if (att >= corr && corr >= 0) {
        next[index].wrong = String(att - corr);
      }
    }
    setSectionInputs(next);
  };

  const handleScreenshotUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        if (evt.target?.result) setScreenshot(evt.target.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Compute live totals
  const liveSections: SectionPerformance[] = sectionInputs.map((input) => {
    const secConfig = settings.sections.find((s) => s.id === input.sectionId) || {
      totalQuestions: 35,
      marksPerCorrect: 1.0,
      negativeMark: 0.25
    };
    const attempted = Number(input.attempted) || 0;
    const correct = Number(input.correct) || 0;
    const wrong = Number(input.wrong) || 0;
    const timeSpentSeconds = (Number(input.timeMinutes) || 0) * 60;

    const unattempted = Math.max(0, secConfig.totalQuestions - attempted);
    const netScore = Number((correct * secConfig.marksPerCorrect - wrong * secConfig.negativeMark).toFixed(2));
    const accuracy = attempted > 0 ? Number(((correct / attempted) * 100).toFixed(1)) : 0;
    const marksLostNegative = Number((wrong * secConfig.negativeMark).toFixed(2));

    return {
      sectionId: input.sectionId,
      sectionName: input.sectionName,
      attempted,
      correct,
      wrong,
      timeSpentSeconds,
      unattempted,
      netScore,
      accuracy,
      marksLostNegative
    };
  });

  const totalAttempted = liveSections.reduce((s, x) => s + x.attempted, 0);
  const totalCorrect = liveSections.reduce((s, x) => s + x.correct, 0);
  const totalWrong = liveSections.reduce((s, x) => s + x.wrong, 0);
  const totalNetScore = Number(liveSections.reduce((s, x) => s + x.netScore, 0).toFixed(2));
  const overallAccuracy = totalAttempted > 0 ? Number(((totalCorrect / totalAttempted) * 100).toFixed(1)) : 0;
  const totalMarksLostNegative = Number(liveSections.reduce((s, x) => s + x.marksLostNegative, 0).toFixed(2));
  const totalTimeSpentSeconds = liveSections.reduce((s, x) => s + x.timeSpentSeconds, 0);

  const handleSubmitMock = async (e: React.FormEvent) => {
    e.preventDefault();

    const errors = validateMockSections(
      sectionInputs.map((input) => {
        const section = settings.sections.find((s) => s.id === input.sectionId);
        return {
          sectionId: input.sectionId,
          sectionName: input.sectionName,
          attempted: Number(input.attempted) || 0,
          correct: Number(input.correct) || 0,
          wrong: Number(input.wrong) || 0,
          timeMinutes: Number(input.timeMinutes) || 0,
          totalQuestions: section?.totalQuestions || 0
        };
      })
    );
    setValidationErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const mockPayload: Omit<MockTest, 'id'> = {
      name: name.trim() || defaultMockName,
      date,
      source: source.trim() || 'Testbook',
      attemptType,
      overallRank: overallRank ? Number(overallRank) : undefined,
      overallPercentile: overallPercentile ? Number(overallPercentile) : undefined,
      sections: liveSections,
      totalAttempted,
      totalCorrect,
      totalWrong,
      totalUnattempted: settings.sections.reduce((s, x) => s + x.totalQuestions, 0) - totalAttempted,
      totalNetScore,
      overallAccuracy,
      totalMarksLostNegative,
      totalTimeSpentSeconds,
      screenshot,
      notes: notes.trim()
    };

    if (editingMockId) {
      await db.mocks.update(editingMockId, mockPayload);
    } else {
      await db.mocks.add(mockPayload as MockTest);
    }

    // Auto-update exam name from mock title if non-trivial
    try {
      const derivedExam = extractExamNameFromMock(mockPayload.name);
      if (derivedExam && derivedExam.length > 2 && derivedExam.toLowerCase() !== 'mock') {
        const curSettings = await db.settings.get('current');
        if (curSettings && curSettings.examName !== derivedExam) {
          curSettings.examName = derivedExam;
          await db.settings.put(curSettings);
        }
      }
    } catch {
      // Ignore setting sync errors
    }

    setIsAddModalOpen(false);
    onRefresh();
  };

  const handleDeleteMock = async (id: number) => {
    if (confirm('Delete this mock test record?')) {
      await db.mocks.delete(id);
      onRefresh();
    }
  };

  const handleOpenCompare = () => {
    if (mocks.length < 2) {
      alert('You need at least 2 mocks to compare side-by-side.');
      return;
    }
    const m1 = mocks[mocks.length - 2]?.id || mocks[0]?.id;
    const m2 = mocks[mocks.length - 1]?.id || mocks[1]?.id;
    setCompareMockIds([m1 || null, m2 || null]);
    setIsCompareModalOpen(true);
  };

  const m1Id = compareMockIds[0] || (mocks.length >= 2 ? mocks[mocks.length - 2]?.id : mocks[0]?.id);
  const m2Id = compareMockIds[1] || (mocks.length >= 1 ? mocks[mocks.length - 1]?.id : mocks[0]?.id);
  const mockA = mocks.find((m) => m.id === m1Id) || mocks[0];
  const mockB = mocks.find((m) => m.id === m2Id) || (mocks.length > 1 ? mocks[1] : mocks[0]);

  const filteredMocks = mocks.filter((m) => {
    if (filterType === 'all') return true;
    return (m.attemptType || 'mock') === filterType;
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-display text-xl font-bold text-[var(--ink)] dark:text-[var(--text-main)]">
              Mock Test Log
            </h2>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--action-primary)] font-bold">
              Performance Log
            </span>
          </div>
          <p className="text-xs text-[var(--text-muted)]">
            Fast 60-second log with auto-calculated net scores, accuracy %, and negative mark drain.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onOpenDataIntake && (
            <button
              onClick={onOpenDataIntake}
              className="manga-btn px-3 py-2 rounded-xl bg-[var(--bg-surface)] text-[var(--ink)] dark:text-[var(--text-main)] font-bold text-xs flex items-center gap-1.5"
            >
              <Upload className="w-3.5 h-3.5 text-[var(--sakura)]" />
              <span>Data Intake Hub</span>
            </button>
          )}
          {mocks.length >= 2 && (
            <button
              onClick={handleOpenCompare}
              className="manga-btn px-3 py-2 rounded-xl bg-[var(--peach)] text-[var(--ink)] font-bold text-xs flex items-center gap-1.5"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Compare 2 Mocks</span>
            </button>
          )}
          <button
            onClick={openAddModal}
            className="manga-btn px-3.5 py-2 rounded-xl bg-[var(--sakura)] text-[var(--ink)] font-bold text-xs flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Fast Log Mock</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 p-1.5 rounded-xl bg-[var(--bg-surface)] border-2 border-[var(--ink-border)] text-xs font-bold w-fit">
        {(['all', 'mock', 'pyq', 'memory-based'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setFilterType(t)}
            className={`px-3 py-1.5 rounded-lg transition-colors capitalize ${
              filterType === t
                ? 'bg-[var(--mint)] text-[var(--ink)] shadow-manga-sm'
                : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            {t === 'all' ? 'All Tests' : t === 'pyq' ? 'PYQ Papers' : t === 'mock' ? 'Mocks' : 'Memory-Based'}
          </button>
        ))}
      </div>

      {/* Mock List */}
      {filteredMocks.length === 0 ? (
        <div className="manga-panel p-10 text-center bg-[var(--bg-surface)] rounded-2xl border-3 border-[var(--ink-border)] shadow-manga space-y-4">
          <Mascot mood="thinking" size="lg" className="mx-auto" />
          <div className="space-y-1">
            <h3 className="font-display text-base font-bold text-[var(--ink)] dark:text-[var(--text-main)]">
              No Mocks Recorded Yet
            </h3>
            <p className="text-xs text-[var(--text-muted)] max-w-sm mx-auto">
              No fake data is loaded. Use the Fast Log button or paste your Testbook scorecard to log your first attempt.
            </p>
          </div>
          <div className="flex justify-center gap-3">
            <button
              onClick={openAddModal}
              className="manga-btn px-5 py-2.5 rounded-xl bg-[var(--sakura)] text-[var(--ink)] font-bold text-xs flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Log Your First Mock</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3.5">
          {filteredMocks
            .slice()
            .reverse()
            .map((mock) => {
              const hitTarget = mock.totalNetScore >= settings.targetScore;
              const passedOverall = mock.totalNetScore >= settings.overallCutoff;

              return (
                <div
                  key={mock.id}
                  onClick={() => openEditModal(mock)}
                  className="manga-panel p-4 sm:p-5 bg-[var(--bg-panel)] rounded-2xl border-3 border-[var(--ink-border)] shadow-manga hover:shadow-manga-lg transition-all space-y-3 cursor-pointer"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b-2 border-[var(--ink-border)] pb-3">
                    <div className="flex items-center gap-3">
                      <span className="w-3 h-3 rounded-md bg-[var(--sakura)] border border-[var(--ink-border)] shrink-0" />
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-display text-sm font-bold text-[var(--ink)] dark:text-[var(--text-main)]">
                            {mock.name}
                          </h4>
                          <span className="text-[10px] font-retro px-2 py-0.5 rounded-md bg-[var(--bg-surface)] border border-[var(--ink-border)] font-bold">
                            {mock.attemptType || 'mock'}
                          </span>
                        </div>
                        <p className="text-[11px] text-[var(--text-muted)] flex items-center gap-2 mt-0.5 font-mono">
                          <span>{mock.date}</span>
                          {mock.overallPercentile !== undefined && <span>• {mock.overallPercentile}%tile</span>}
                          {mock.overallRank !== undefined && <span>• Rank #{mock.overallRank}</span>}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="flex items-baseline gap-1 justify-end">
                          <span className="font-display text-xl font-bold text-[var(--ink)] dark:text-[var(--text-main)]">
                            {mock.totalNetScore}
                          </span>
                          <span className="text-[11px] text-[var(--text-muted)] font-mono">marks</span>
                        </div>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded border border-[var(--ink-border)] ${
                            hitTarget
                              ? 'bg-[var(--mint)] text-[var(--ink)]'
                              : passedOverall
                              ? 'bg-[var(--peach)] text-[var(--ink)]'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {hitTarget ? 'Target Surpassed' : passedOverall ? 'Cutoff Met' : 'Below Cutoff'}
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                         <button
                           onClick={(e) => { e.stopPropagation(); openEditModal(mock); }}
                           className="p-1.5 rounded-lg border border-[var(--ink-border)] bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-[var(--text-main)]"
                           title="Edit Mock"
                         >
                           <Edit2 className="w-3.5 h-3.5" />
                         </button>
                         <button
                           onClick={(e) => { e.stopPropagation(); mock.id && handleDeleteMock(mock.id); }}
                           className="p-1.5 rounded-lg border border-[var(--ink-border)] bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-rose-600"
                           title="Delete Mock"
                         >
                           <Trash2 className="w-3.5 h-3.5" />
                         </button>
                       </div>
                    </div>
                  </div>

                  {/* Section Breakdown Pills */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
                    {mock.sections.map((sec) => (
                      <div
                        key={sec.sectionId}
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditModal(mock);
                        }}
                        className="p-3 rounded-xl bg-[var(--bg-surface)] border-2 border-[var(--ink-border)] hover:border-[var(--sakura)] hover:shadow-sm transition-all cursor-pointer space-y-1 text-xs"
                        title={`Click to view/edit ${sec.sectionName}`}
                      >
                        <div className="flex items-center justify-between font-bold">
                          <span className="truncate pr-1">{sec.sectionName}</span>
                          <span className="text-[var(--sakura)] font-display shrink-0">{sec.netScore} pts</span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)] font-mono">
                          <span>{sec.correct}C / {sec.wrong}W / {sec.unattempted}U</span>
                          <span className="font-bold">{sec.accuracy}%</span>
                        </div>
                        <div className="text-[10px] text-rose-600 dark:text-rose-400 font-bold">
                          Lost -{sec.marksLostNegative} to negative
                        </div>
                      </div>
                    ))}
                  </div>

                  {mock.notes && (
                    <div className="text-xs text-[var(--text-muted)] italic p-2.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--ink-border)]">
                      "{mock.notes}"
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      )}

      {/* Add / Edit Fast 60s Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-[var(--bg-panel)] p-6 rounded-2xl border-3 border-[var(--ink-border)] max-w-3xl w-full space-y-5 shadow-manga-lg my-6">
            <div className="flex items-center justify-between border-b-2 border-[var(--ink-border)] pb-3">
              <div>
                <h3 className="font-display text-sm font-bold text-[var(--ink)] dark:text-[var(--text-main)]">
                  {editingMockId ? 'Edit Mock Test' : 'Add Mock Test (Fast Log)'}
                </h3>
                <p className="text-xs text-[var(--text-muted)]">
                  Type attempted and correct answers. Net score and penalty calculate live.
                </p>
              </div>
              <button onClick={() => setIsAddModalOpen(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitMock} className="space-y-4 text-xs">
              {Object.keys(validationErrors).length > 0 && (
                <div role="alert" className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border-2 border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-semibold">
                  Fix the highlighted section values before saving.
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="sm:col-span-2">
                  <label className="block font-bold mb-1">Mock Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Testbook Live Mock 05"
                    className="w-full text-xs p-2 rounded-lg bg-[var(--bg-surface)] border-2 border-[var(--ink-border)] font-semibold"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">Date</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full text-xs p-2 rounded-lg bg-[var(--bg-surface)] border-2 border-[var(--ink-border)] font-semibold"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">Source / Platform</label>
                  <input
                    type="text"
                    value={source}
                    onChange={(e) => setSource(e.target.value)}
                    className="w-full text-xs p-2 rounded-lg bg-[var(--bg-surface)] border-2 border-[var(--ink-border)] font-semibold"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">Type</label>
                  <select
                    value={attemptType}
                    onChange={(e) => setAttemptType(e.target.value as AttemptType)}
                    className="w-full text-xs p-2 rounded-lg bg-[var(--bg-surface)] border-2 border-[var(--ink-border)] font-semibold"
                  >
                    <option value="mock">Standard Mock</option>
                    <option value="pyq">Previous Year Paper</option>
                    <option value="memory-based">Memory-Based Paper</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold mb-1">Rank (Optional)</label>
                  <input
                    type="number"
                    value={overallRank}
                    onChange={(e) => setOverallRank(e.target.value)}
                    className="w-full text-xs p-2 rounded-lg bg-[var(--bg-surface)] border-2 border-[var(--ink-border)] font-semibold"
                    placeholder="e.g. 1420"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">Percentile %</label>
                  <input
                    type="number"
                    step="0.1"
                    value={overallPercentile}
                    onChange={(e) => setOverallPercentile(e.target.value)}
                    className="w-full text-xs p-2 rounded-lg bg-[var(--bg-surface)] border-2 border-[var(--ink-border)] font-semibold"
                    placeholder="e.g. 93.5"
                  />
                </div>
              </div>

              {/* Sectional Breakdown */}
              <div className="space-y-3 pt-2">
                <span className="font-display text-xs font-bold block">Sectional Performance</span>
                {sectionInputs.map((input, idx) => {
                  const secLive = liveSections[idx];
                  return (
                    <div
                      key={input.sectionId}
                      className="p-3.5 rounded-xl bg-[var(--bg-surface)] border-2 border-[var(--ink-border)] space-y-2"
                    >
                      <div className="flex items-center justify-between font-bold">
                        <span>{input.sectionName}</span>
                        <span className="text-[var(--sakura)] font-display">
                          Net: {secLive.netScore} pts ({secLive.accuracy}% acc)
                        </span>
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        <div>
                          <label className="text-[10px] text-[var(--text-muted)] block">Attempted</label>
                          <input
                            type="number"
                            aria-label={`${input.sectionName} attempted`}
                            value={input.attempted}
                            onChange={(e) => handleSectionInputChange(idx, 'attempted', e.target.value)}
                            placeholder="0"
                            className={`w-full p-1.5 rounded-lg bg-[var(--bg-panel)] border font-semibold ${validationErrors[`${input.sectionId}.attempted`] ? 'border-rose-500' : 'border-[var(--ink-border)]'}`}
                          />
                          {validationErrors[`${input.sectionId}.attempted`] && (
                            <span className="text-[10px] text-rose-600 dark:text-rose-400 block mt-0.5">{validationErrors[`${input.sectionId}.attempted`]}</span>
                          )}
                        </div>
                        <div>
                          <label className="text-[10px] text-[var(--text-muted)] block">Correct</label>
                          <input
                            type="number"
                            aria-label={`${input.sectionName} correct`}
                            value={input.correct}
                            onChange={(e) => handleSectionInputChange(idx, 'correct', e.target.value)}
                            placeholder="0"
                            className={`w-full p-1.5 rounded-lg bg-[var(--bg-panel)] border font-semibold text-emerald-600 dark:text-emerald-400 ${validationErrors[`${input.sectionId}.correct`] ? 'border-rose-500' : 'border-[var(--ink-border)]'}`}
                          />
                          {validationErrors[`${input.sectionId}.correct`] && (
                            <span className="text-[10px] text-rose-600 dark:text-rose-400 block mt-0.5">{validationErrors[`${input.sectionId}.correct`]}</span>
                          )}
                        </div>
                        <div>
                          <label className="text-[10px] text-[var(--text-muted)] block">Wrong</label>
                          <input
                            type="number"
                            aria-label={`${input.sectionName} wrong`}
                            value={input.wrong}
                            onChange={(e) => handleSectionInputChange(idx, 'wrong', e.target.value)}
                            placeholder="0"
                            className={`w-full p-1.5 rounded-lg bg-[var(--bg-panel)] border font-semibold text-rose-600 dark:text-rose-400 ${validationErrors[`${input.sectionId}.wrong`] ? 'border-rose-500' : 'border-[var(--ink-border)]'}`}
                          />
                          {validationErrors[`${input.sectionId}.wrong`] && (
                            <span className="text-[10px] text-rose-600 dark:text-rose-400 block mt-0.5">{validationErrors[`${input.sectionId}.wrong`]}</span>
                          )}
                        </div>
                        <div>
                          <label className="text-[10px] text-[var(--text-muted)] block">Time (min)</label>
                          <input
                            type="number"
                            aria-label={`${input.sectionName} time`}
                            value={input.timeMinutes}
                            onChange={(e) => handleSectionInputChange(idx, 'timeMinutes', e.target.value)}
                            placeholder="20"
                            className={`w-full p-1.5 rounded-lg bg-[var(--bg-panel)] border font-semibold ${validationErrors[`${input.sectionId}.timeMinutes`] ? 'border-rose-500' : 'border-[var(--ink-border)]'}`}
                          />
                          {validationErrors[`${input.sectionId}.timeMinutes`] && (
                            <span className="text-[10px] text-rose-600 dark:text-rose-400 block mt-0.5">{validationErrors[`${input.sectionId}.timeMinutes`]}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Total Banner */}
              <div className="p-3 rounded-xl bg-[var(--peach)] text-[var(--ink)] border-2 border-[var(--ink-border)] flex items-center justify-between font-bold text-xs">
                <span>Total Net Score: {totalNetScore} marks</span>
                <span>Accuracy: {overallAccuracy}% • Total Penalty: -{totalMarksLostNegative}</span>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t-2 border-[var(--ink-border)]">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--ink-border)] font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="manga-btn px-5 py-2 rounded-xl bg-[var(--mint)] text-[var(--ink)] font-bold text-xs"
                >
                  {editingMockId ? 'Update Mock' : 'Save Mock Test'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Side-by-Side Comparison Modal */}
      {isCompareModalOpen && mockA && mockB && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-[var(--bg-panel)] p-6 rounded-2xl border-3 border-[var(--ink-border)] max-w-4xl w-full space-y-4 shadow-manga-lg my-6">
            <div className="flex items-center justify-between border-b-2 border-[var(--ink-border)] pb-3">
              <div>
                <h3 className="font-display text-base font-bold text-[var(--ink)] dark:text-[var(--text-main)]">
                  Side-by-Side Mock Comparator
                </h3>
                <p className="text-xs text-[var(--text-muted)]">Compare performance and sectional deltas.</p>
              </div>
              <button onClick={() => setIsCompareModalOpen(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs font-bold">
              <div>
                <label className="block text-[var(--text-muted)] mb-1">Baseline Mock (A)</label>
                <select
                  value={compareMockIds[0] || ''}
                  onChange={(e) => setCompareMockIds([Number(e.target.value), compareMockIds[1]])}
                  className="w-full p-2 rounded-lg bg-[var(--bg-surface)] border-2 border-[var(--ink-border)] font-semibold"
                >
                  {mocks.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.totalNetScore} marks)
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[var(--text-muted)] mb-1">Comparison Mock (B)</label>
                <select
                  value={compareMockIds[1] || ''}
                  onChange={(e) => setCompareMockIds([compareMockIds[0], Number(e.target.value)])}
                  className="w-full p-2 rounded-lg bg-[var(--bg-surface)] border-2 border-[var(--ink-border)] font-semibold"
                >
                  {mocks.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.totalNetScore} marks)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border-2 border-[var(--ink-border)]">
              <table className="w-full text-left text-xs">
                <thead className="bg-[var(--bg-surface)] border-b-2 border-[var(--ink-border)] font-bold">
                  <tr>
                    <th className="p-3">Metric</th>
                    <th className="p-3">{mockA.name}</th>
                    <th className="p-3">{mockB.name}</th>
                    <th className="p-3">Delta (B - A)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--ink-border)]/40 bg-[var(--bg-surface)]">
                  <tr className="bg-[var(--bg-panel)] font-bold">
                    <td className="p-3">Total Net Score</td>
                    <td className="p-3">{mockA.totalNetScore}</td>
                    <td className="p-3">{mockB.totalNetScore}</td>
                    <td className={`p-3 font-mono ${mockB.totalNetScore - mockA.totalNetScore >= 0 ? 'text-[var(--mint)]' : 'text-rose-500'}`}>
                      {mockB.totalNetScore - mockA.totalNetScore >= 0 ? '+' : ''}
                      {(mockB.totalNetScore - mockA.totalNetScore).toFixed(2)} pts
                    </td>
                  </tr>
                  <tr className="bg-[var(--bg-panel)] font-bold">
                    <td className="p-3">Overall Accuracy</td>
                    <td className="p-3">{mockA.overallAccuracy}%</td>
                    <td className="p-3">{mockB.overallAccuracy}%</td>
                    <td className={`p-3 font-mono ${mockB.overallAccuracy - mockA.overallAccuracy >= 0 ? 'text-[var(--mint)]' : 'text-rose-500'}`}>
                      {mockB.overallAccuracy - mockA.overallAccuracy >= 0 ? '+' : ''}
                      {(mockB.overallAccuracy - mockA.overallAccuracy).toFixed(1)}%
                    </td>
                  </tr>
                  <tr className="bg-[var(--bg-panel)] font-bold">
                    <td className="p-3">Total Time Spent</td>
                    <td className="p-3">{Math.round((mockA.totalTimeSpentSeconds || 0) / 60)}m</td>
                    <td className="p-3">{Math.round((mockB.totalTimeSpentSeconds || 0) / 60)}m</td>
                    <td className="p-3 font-mono">
                      {Math.round(((mockB.totalTimeSpentSeconds || 0) - (mockA.totalTimeSpentSeconds || 0)) / 60) >= 0 ? '+' : ''}
                      {Math.round(((mockB.totalTimeSpentSeconds || 0) - (mockA.totalTimeSpentSeconds || 0)) / 60)}m
                    </td>
                  </tr>

                  {/* Sectional Deltas */}
                  {Array.from(
                    new Set([
                      ...(mockA.sections || []).map((s) => s.sectionId),
                      ...(mockB.sections || []).map((s) => s.sectionId)
                    ])
                  ).map((secId) => {
                    const secA = mockA.sections?.find((s) => s.sectionId === secId) || {
                      sectionName: secId,
                      netScore: 0,
                      accuracy: 0,
                      timeSpentSeconds: 0
                    };
                    const secB = mockB.sections?.find((s) => s.sectionId === secId) || {
                      sectionName: secId,
                      netScore: 0,
                      accuracy: 0,
                      timeSpentSeconds: 0
                    };
                    const name = secB.sectionName || secA.sectionName || secId;
                    const scoreDiff = Number((secB.netScore - secA.netScore).toFixed(2));
                    const accDiff = Number((secB.accuracy - secA.accuracy).toFixed(1));
                    const timeDiff = Math.round(((secB.timeSpentSeconds || 0) - (secA.timeSpentSeconds || 0)) / 60);

                    return (
                      <React.Fragment key={secId}>
                        <tr className="bg-[var(--surface-tag)]/30 font-bold border-t-2 border-[var(--ink-border)]/60">
                          <td colSpan={4} className="p-2.5 text-[var(--ink)] dark:text-[var(--text-main)] font-display">
                            📌 Section: {name}
                          </td>
                        </tr>
                        <tr>
                          <td className="p-2.5 pl-6 text-[var(--text-muted)]">• Net Score</td>
                          <td className="p-2.5">{secA.netScore}</td>
                          <td className="p-2.5">{secB.netScore}</td>
                          <td className={`p-2.5 font-mono font-bold ${scoreDiff >= 0 ? 'text-[var(--mint)]' : 'text-rose-500'}`}>
                            {scoreDiff >= 0 ? '+' : ''}{scoreDiff} pts
                          </td>
                        </tr>
                        <tr>
                          <td className="p-2.5 pl-6 text-[var(--text-muted)]">• Accuracy</td>
                          <td className="p-2.5">{secA.accuracy}%</td>
                          <td className="p-2.5">{secB.accuracy}%</td>
                          <td className={`p-2.5 font-mono font-bold ${accDiff >= 0 ? 'text-[var(--mint)]' : 'text-rose-500'}`}>
                            {accDiff >= 0 ? '+' : ''}{accDiff}%
                          </td>
                        </tr>
                        <tr>
                          <td className="p-2.5 pl-6 text-[var(--text-muted)]">• Time Spent</td>
                          <td className="p-2.5">{Math.round((secA.timeSpentSeconds || 0) / 60)}m</td>
                          <td className="p-2.5">{Math.round((secB.timeSpentSeconds || 0) / 60)}m</td>
                          <td className="p-2.5 font-mono font-bold">
                            {timeDiff >= 0 ? '+' : ''}{timeDiff}m
                          </td>
                        </tr>
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setIsCompareModalOpen(false)}
                className="manga-btn px-5 py-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--ink-border)] font-bold text-xs"
              >
                Close Comparison
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
