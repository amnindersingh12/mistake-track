import React, { useState } from 'react';
import { PaperTest, PaperQuestion, ExamSettings, MockTest } from '../types';
import { db } from '../db/db';
import { PaperExamModal } from './PaperExamModal';
import { Mascot } from './Mascot';
import {
  BookOpen,
  Plus,
  Play,
  FileText,
  Clock,
  Calendar,
  Layers,
  Upload,
  CheckCircle2,
  Trash2,
  X,
  FileSpreadsheet
} from 'lucide-react';
import { parseCsvRows, getPaperQuestionsCsvTemplate, downloadTemplateFile } from '../utils/dataIntake';

interface PapersViewProps {
  papers: PaperTest[];
  settings: ExamSettings;
  onRefresh: () => void;
  onNavigateToMocks: () => void;
}

export const PapersView: React.FC<PapersViewProps> = ({
  papers,
  settings,
  onRefresh,
  onNavigateToMocks
}) => {
  const [filterType, setFilterType] = useState<'all' | 'pyq' | 'memory-based'>('all');

  // Modals
  const [isAddPaperModalOpen, setIsAddPaperModalOpen] = useState(false);
  const [activePaperForExam, setActivePaperForExam] = useState<PaperTest | null>(null);
  const [activePaperForQuestions, setActivePaperForQuestions] = useState<PaperTest | null>(null);
  const [activePaperForOutsideLog, setActivePaperForOutsideLog] = useState<PaperTest | null>(null);

  // Add Paper Form State
  const [examName, setExamName] = useState(settings.examName);
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [shift, setShift] = useState('Shift 1');
  const [isMemoryBased, setIsMemoryBased] = useState(false);
  const [sourceNote, setSourceNote] = useState('');
  const [totalTimeMinutes, setTotalTimeMinutes] = useState(settings.totalTimeMinutes || 60);

  // Add Question Form State (Single Question)
  const [qSectionId, setQSectionId] = useState(settings.sections[0]?.id || 'quant');
  const [qTopic, setQTopic] = useState(settings.sections[0]?.topics[0] || 'Percentage');
  const [qText, setQText] = useState('');
  const [qOptA, setQOptA] = useState('');
  const [qOptB, setQOptB] = useState('');
  const [qOptC, setQOptC] = useState('');
  const [qOptD, setQOptD] = useState('');
  const [qOptE, setQOptE] = useState('');
  const [correctOptionIndex, setCorrectOptionIndex] = useState(0);
  const [qSolution, setQSolution] = useState('');
  const [qShortcut, setQShortcut] = useState('');

  // Outside Log Form State
  const [outsideDate, setOutsideDate] = useState(new Date().toISOString().split('T')[0]);
  const [outsideSections, setOutsideSections] = useState(
    settings.sections.map((s) => ({
      sectionId: s.id,
      sectionName: s.name,
      attempted: '',
      correct: '',
      wrong: '',
      timeMinutes: String(s.timeLimitMinutes || 20)
    }))
  );

  const handleCreatePaper = async (e: React.FormEvent) => {
    e.preventDefault();
    const newPaper: Omit<PaperTest, 'id'> = {
      examName: examName.trim() || settings.examName,
      year: Number(year) || new Date().getFullYear(),
      shift: shift.trim() || undefined,
      isMemoryBased,
      sourceNote: sourceNote.trim() || undefined,
      totalTimeMinutes: Number(totalTimeMinutes) || 60,
      sections: settings.sections,
      questions: [],
      createdAt: new Date().toISOString()
    };

    await db.papers.add(newPaper as PaperTest);
    setIsAddPaperModalOpen(false);
    onRefresh();
  };

  const handleDeletePaper = async (id: number) => {
    if (confirm('Delete this paper from your library?')) {
      await db.papers.delete(id);
      onRefresh();
    }
  };

  const handleAddQuestionToPaper = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePaperForQuestions || !activePaperForQuestions.id) return;

    const newQuestion: PaperQuestion = {
      id: `q_${Date.now()}`,
      sectionId: qSectionId,
      questionNumber: (activePaperForQuestions.questions?.length || 0) + 1,
      text: qText.trim(),
      options: [qOptA, qOptB, qOptC, qOptD, qOptE].filter(Boolean),
      correctOptionIndex: Number(correctOptionIndex) || 0,
      solution: qSolution.trim() || undefined,
      shortcut: qShortcut.trim() || undefined,
      topic: qTopic
    };

    const updatedQuestions = [...(activePaperForQuestions.questions || []), newQuestion];
    await db.papers.update(activePaperForQuestions.id, { questions: updatedQuestions });

    // Reset inputs
    setQText('');
    setQOptA('');
    setQOptB('');
    setQOptC('');
    setQOptD('');
    setQOptE('');
    setQSolution('');
    setQShortcut('');

    activePaperForQuestions.questions = updatedQuestions;
    onRefresh();
  };

  // CSV Questions Upload for Paper
  const handleCsvQuestionsUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activePaperForQuestions || !activePaperForQuestions.id) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const text = evt.target?.result as string;
      const rows = parseCsvRows(text);
      if (rows.length < 2) return;

      const newQuestions: PaperQuestion[] = [...(activePaperForQuestions.questions || [])];

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (row.length < 6) continue;

        const secStr = row[0]?.toLowerCase() || 'quant';
        const sectionId = secStr.includes('reason') ? 'reasoning' : secStr.includes('eng') ? 'english' : 'quant';
        const topic = row[1] || 'General';
        const textQ = row[3] || 'Question text';
        const opts = [row[4], row[5], row[6], row[7], row[8]].filter(Boolean);
        const correctLetter = (row[9] || 'A').toUpperCase();
        const corrIdx = ['A', 'B', 'C', 'D', 'E'].indexOf(correctLetter);
        const sol = row[10] || '';
        const sc = row[11] || '';

        newQuestions.push({
          id: `q_${Date.now()}_${i}`,
          sectionId,
          questionNumber: newQuestions.length + 1,
          text: textQ,
          options: opts.length > 0 ? opts : ['A', 'B', 'C', 'D'],
          correctOptionIndex: corrIdx >= 0 ? corrIdx : 0,
          solution: sol,
          shortcut: sc,
          topic
        });
      }

      if (activePaperForQuestions.id) {
        await db.papers.update(activePaperForQuestions.id, { questions: newQuestions });
        activePaperForQuestions.questions = newQuestions;
        onRefresh();
      }
    };
    reader.readAsText(file);
  };

  // Outside Log Save
  const handleSaveOutsideResult = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePaperForOutsideLog) return;

    let totalAttempted = 0;
    let totalCorrect = 0;
    let totalWrong = 0;
    let totalNetScore = 0;

    const liveSections = outsideSections.map((sec) => {
      const secConfig = settings.sections.find((s) => s.id === sec.sectionId) || {
        totalQuestions: 35,
        marksPerCorrect: 1.0,
        negativeMark: 0.25
      };

      const attempted = Number(sec.attempted) || 0;
      const correct = Number(sec.correct) || 0;
      const wrong = Number(sec.wrong) || 0;
      const unattempted = Math.max(0, secConfig.totalQuestions - attempted);
      const net = Number((correct * secConfig.marksPerCorrect - wrong * secConfig.negativeMark).toFixed(2));
      const acc = attempted > 0 ? Number(((correct / attempted) * 100).toFixed(1)) : 0;
      const negLost = Number((wrong * secConfig.negativeMark).toFixed(2));

      totalAttempted += attempted;
      totalCorrect += correct;
      totalWrong += wrong;
      totalNetScore += net;

      return {
        sectionId: sec.sectionId,
        sectionName: sec.sectionName,
        attempted,
        correct,
        wrong,
        timeSpentSeconds: (Number(sec.timeMinutes) || 20) * 60,
        unattempted,
        netScore: net,
        accuracy: acc,
        marksLostNegative: negLost
      };
    });

    const mockName = `${activePaperForOutsideLog.examName} (${activePaperForOutsideLog.year}${activePaperForOutsideLog.isMemoryBased ? ' Memory-Based' : ' PYQ'})`;

    await db.mocks.add({
      name: mockName,
      date: outsideDate,
      source: activePaperForOutsideLog.isMemoryBased ? 'Memory-Based Paper' : 'Previous Year Paper',
      attemptType: activePaperForOutsideLog.isMemoryBased ? 'memory-based' : 'pyq',
      paperId: activePaperForOutsideLog.id,
      sections: liveSections,
      totalAttempted,
      totalCorrect,
      totalWrong,
      totalUnattempted: 100 - totalAttempted,
      totalNetScore: Number(totalNetScore.toFixed(2)),
      overallAccuracy: totalAttempted > 0 ? Number(((totalCorrect / totalAttempted) * 100).toFixed(1)) : 0,
      totalMarksLostNegative: Number(liveSections.reduce((s, x) => s + x.marksLostNegative, 0).toFixed(2)),
      totalTimeSpentSeconds: 3600,
      notes: `Logged result from external attempt.`
    });

    setActivePaperForOutsideLog(null);
    onRefresh();
    onNavigateToMocks();
  };

  const filteredPapers = papers.filter((p) => {
    if (filterType === 'pyq') return !p.isMemoryBased;
    if (filterType === 'memory-based') return p.isMemoryBased;
    return true;
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-display text-xl font-bold text-[var(--ink)] dark:text-[var(--text-main)]">
              Papers Library
            </h2>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--action-primary)] font-bold">
              PYQ & Timed Attempts
            </span>
          </div>
          <p className="text-xs text-[var(--text-muted)]">
            Store and attempt real Previous-Year Papers (PYQ) and Memory-Based Papers in timed mode or log external scores.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsAddPaperModalOpen(true)}
            className="manga-btn px-4 py-2 rounded-xl bg-[var(--sakura)] text-[var(--ink)] font-bold text-xs flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Add Paper to Library</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 p-1.5 rounded-xl bg-[var(--bg-surface)] border-2 border-[var(--ink-border)] text-xs font-bold w-fit">
        <button
          onClick={() => setFilterType('all')}
          className={`px-3 py-1.5 rounded-lg transition-colors ${
            filterType === 'all'
              ? 'bg-[var(--peach)] text-[var(--ink)] shadow-manga-sm'
              : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
          }`}
        >
          All Papers ({papers.length})
        </button>
        <button
          onClick={() => setFilterType('pyq')}
          className={`px-3 py-1.5 rounded-lg transition-colors ${
            filterType === 'pyq'
              ? 'bg-[var(--mint)] text-[var(--ink)] shadow-manga-sm'
              : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
          }`}
        >
          Previous Year Papers ({papers.filter((p) => !p.isMemoryBased).length})
        </button>
        <button
          onClick={() => setFilterType('memory-based')}
          className={`px-3 py-1.5 rounded-lg transition-colors ${
            filterType === 'memory-based'
              ? 'bg-[var(--sakura)] text-[var(--ink)] shadow-manga-sm'
              : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
          }`}
        >
          Memory-Based Papers ({papers.filter((p) => p.isMemoryBased).length})
        </button>
      </div>

      {/* Papers Grid */}
      {filteredPapers.length === 0 ? (
        <div className="p-10 text-center bg-[var(--bg-surface)] rounded-2xl border-3 border-[var(--ink-border)] shadow-manga space-y-4">
          <Mascot mood="reading" size="lg" className="mx-auto" />
          <div className="space-y-1">
            <h3 className="font-display text-base font-bold text-[var(--ink)] dark:text-[var(--text-main)]">
              No Papers Added Yet
            </h3>
            <p className="text-xs text-[var(--text-muted)] max-w-sm mx-auto">
              Add your first previous-year paper or memory-based exam paper to attempt it in timed mode or log results.
            </p>
          </div>
          <button
            onClick={() => setIsAddPaperModalOpen(true)}
            className="manga-btn px-5 py-2.5 rounded-xl bg-[var(--sakura)] text-[var(--ink)] font-bold text-xs inline-flex items-center gap-1.5 shadow-manga-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Add Your First Paper</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredPapers.map((paper) => {
            const qCount = paper.questions?.length || 0;

            return (
              <div
                key={paper.id}
                className="p-5 bg-[var(--bg-panel)] rounded-2xl border-3 border-[var(--ink-border)] shadow-manga hover:shadow-manga-lg transition-all space-y-4 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2 border-b-2 border-[var(--ink-border)] pb-2.5">
                    <div>
                      <span
                        className={`text-[10px] font-retro font-bold px-2 py-0.5 rounded-md border border-[var(--ink-border)] inline-block mb-1.5 ${
                          paper.isMemoryBased
                            ? 'bg-[var(--peach)] text-[var(--ink)]'
                            : 'bg-[var(--mint)] text-[var(--ink)]'
                        }`}
                      >
                        {paper.isMemoryBased ? 'Memory-Based' : 'Official PYQ'}
                      </span>
                      <h4 className="font-display text-sm font-bold text-[var(--ink)] dark:text-[var(--text-main)] leading-tight">
                        {paper.examName}
                      </h4>
                      <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                        Year {paper.year} {paper.shift ? `• ${paper.shift}` : ''}
                      </p>
                    </div>

                    <button
                      onClick={() => paper.id && handleDeletePaper(paper.id)}
                      className="p-1 rounded-md text-[var(--text-muted)] hover:text-rose-600 transition-colors"
                      title="Delete Paper"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {paper.sourceNote && (
                    <p className="text-xs text-[var(--text-muted)] italic line-clamp-2">
                      "{paper.sourceNote}"
                    </p>
                  )}

                  <div className="p-2.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--ink-border)] flex items-center justify-between text-xs font-bold">
                    <span className="text-[var(--text-muted)]">Questions Loaded:</span>
                    <span className="text-[var(--sakura)] font-display">{qCount} questions</span>
                  </div>
                </div>

                <div className="pt-2 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setActivePaperForQuestions(paper)}
                      className="manga-btn py-2 px-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--ink-border)] text-xs font-bold flex items-center justify-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Questions</span>
                    </button>
                    <button
                      onClick={() => {
                        setActivePaperForOutsideLog(paper);
                        setOutsideDate(new Date().toISOString().split('T')[0]);
                      }}
                      className="manga-btn py-2 px-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--ink-border)] text-xs font-bold flex items-center justify-center gap-1"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Log Score</span>
                    </button>
                  </div>

                  <button
                    onClick={() => setActivePaperForExam(paper)}
                    className="manga-btn w-full py-2.5 px-3 rounded-xl bg-[var(--mint)] text-[var(--ink)] font-bold text-xs flex items-center justify-center gap-2 shadow-manga-sm"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Attempt in Timed Mode ({paper.totalTimeMinutes}m)</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Paper Modal */}
      {isAddPaperModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-[var(--bg-panel)] p-6 rounded-2xl border-3 border-[var(--ink-border)] max-w-md w-full space-y-4 shadow-manga-lg my-6">
            <div className="flex items-center justify-between border-b-2 border-[var(--ink-border)] pb-3">
              <h3 className="font-display text-sm font-bold text-[var(--ink)] dark:text-[var(--text-main)]">
                Add Exam Paper to Library
              </h3>
              <button onClick={() => setIsAddPaperModalOpen(false)}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreatePaper} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold mb-1">Exam Name</label>
                <input
                  type="text"
                  value={examName}
                  onChange={(e) => setExamName(e.target.value)}
                  placeholder="e.g. SBI PO Prelims"
                  className="w-full text-xs p-2 rounded-lg bg-[var(--bg-surface)] border-2 border-[var(--ink-border)] font-semibold"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold mb-1">Year</label>
                  <input
                    type="number"
                    value={year}
                    onChange={(e) => setYear(Number(e.target.value))}
                    className="w-full text-xs p-2 rounded-lg bg-[var(--bg-surface)] border-2 border-[var(--ink-border)] font-semibold"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">Shift / Slot (Optional)</label>
                  <input
                    type="text"
                    value={shift}
                    onChange={(e) => setShift(e.target.value)}
                    placeholder="e.g. Shift 2"
                    className="w-full text-xs p-2 rounded-lg bg-[var(--bg-surface)] border-2 border-[var(--ink-border)] font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold mb-1">Time Limit (Minutes)</label>
                <input
                  type="number"
                  value={totalTimeMinutes}
                  onChange={(e) => setTotalTimeMinutes(Number(e.target.value) || 60)}
                  className="w-full text-xs p-2 rounded-lg bg-[var(--bg-surface)] border-2 border-[var(--ink-border)] font-semibold"
                />
              </div>

              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--ink-border)]">
                <input
                  type="checkbox"
                  id="isMemCheck"
                  checked={isMemoryBased}
                  onChange={(e) => setIsMemoryBased(e.target.checked)}
                  className="rounded accent-[var(--sakura)]"
                />
                <label htmlFor="isMemCheck" className="font-bold cursor-pointer">
                  Memory-Based Paper (not official released paper)
                </label>
              </div>

              <div>
                <label className="block font-bold mb-1">Source Notes (Optional)</label>
                <textarea
                  rows={2}
                  value={sourceNote}
                  onChange={(e) => setSourceNote(e.target.value)}
                  placeholder="e.g. From student recollections, Shift 1 Nov 2024."
                  className="w-full text-xs p-2 rounded-lg bg-[var(--bg-surface)] border-2 border-[var(--ink-border)]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t-2 border-[var(--ink-border)]">
                <button
                  type="button"
                  onClick={() => setIsAddPaperModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--ink-border)] text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="manga-btn px-5 py-2 rounded-xl bg-[var(--sakura)] text-[var(--ink)] font-bold text-xs"
                >
                  Save Paper
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Questions to Paper Modal */}
      {activePaperForQuestions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-[var(--bg-panel)] p-6 rounded-2xl border-3 border-[var(--ink-border)] max-w-2xl w-full space-y-4 shadow-manga-lg my-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b-2 border-[var(--ink-border)] pb-3">
              <div>
                <h3 className="font-display text-sm font-bold text-[var(--ink)] dark:text-[var(--text-main)]">
                  Add Questions to: {activePaperForQuestions.examName} ({activePaperForQuestions.year})
                </h3>
                <p className="text-xs text-[var(--text-muted)]">
                  Currently loaded: {activePaperForQuestions.questions?.length || 0} questions
                </p>
              </div>
              <button onClick={() => setActivePaperForQuestions(null)}>
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick CSV Question Import */}
            <div className="p-3.5 rounded-xl bg-[var(--bg-surface)] border-2 border-[var(--ink-border)] flex flex-wrap items-center justify-between gap-3 text-xs">
              <div>
                <span className="font-bold block">Bulk CSV Question Import</span>
                <span className="text-[11px] text-[var(--text-muted)]">Upload question text & options in bulk.</span>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => downloadTemplateFile('paper_questions_template.csv', getPaperQuestionsCsvTemplate())}
                  className="manga-btn px-3 py-1.5 rounded-lg bg-[var(--peach)] text-[var(--ink)] font-bold text-xs"
                >
                  Template
                </button>
                <label className="manga-btn px-3 py-1.5 rounded-lg bg-[var(--mint)] text-[var(--ink)] font-bold text-xs cursor-pointer">
                  <span>Import CSV</span>
                  <input type="file" accept=".csv" onChange={handleCsvQuestionsUpload} className="hidden" />
                </label>
              </div>
            </div>

            {/* Single Question Manual Form */}
            <form onSubmit={handleAddQuestionToPaper} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold mb-1">Section</label>
                  <select
                    value={qSectionId}
                    onChange={(e) => {
                      setQSectionId(e.target.value);
                      const sec = settings.sections.find((s) => s.id === e.target.value);
                      if (sec?.topics?.[0]) setQTopic(sec.topics[0]);
                    }}
                    className="w-full text-xs p-2 rounded-lg bg-[var(--bg-surface)] border-2 border-[var(--ink-border)] font-semibold"
                  >
                    {settings.sections.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold mb-1">Topic</label>
                  <select
                    value={qTopic}
                    onChange={(e) => setQTopic(e.target.value)}
                    className="w-full text-xs p-2 rounded-lg bg-[var(--bg-surface)] border-2 border-[var(--ink-border)] font-semibold"
                  >
                    {(settings.sections.find((s) => s.id === qSectionId)?.topics || []).map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold mb-1">Question Statement</label>
                <textarea
                  rows={3}
                  value={qText}
                  onChange={(e) => setQText(e.target.value)}
                  placeholder="Type real question text here..."
                  className="w-full text-xs p-2 rounded-lg bg-[var(--bg-surface)] border-2 border-[var(--ink-border)] font-medium"
                  required
                />
              </div>

              {/* Options */}
              <div className="space-y-2">
                <label className="block font-bold">Options (Pick the radio button for the correct one):</label>
                {[
                  { label: 'A', val: qOptA, setVal: setQOptA, idx: 0 },
                  { label: 'B', val: qOptB, setVal: setQOptB, idx: 1 },
                  { label: 'C', val: qOptC, setVal: setQOptC, idx: 2 },
                  { label: 'D', val: qOptD, setVal: setQOptD, idx: 3 },
                  { label: 'E', val: qOptE, setVal: setQOptE, idx: 4 }
                ].map((opt) => (
                  <div key={opt.label} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="correctOption"
                      checked={correctOptionIndex === opt.idx}
                      onChange={() => setCorrectOptionIndex(opt.idx)}
                      className="accent-[var(--sakura)]"
                    />
                    <span className="font-bold w-4">{opt.label})</span>
                    <input
                      type="text"
                      value={opt.val}
                      onChange={(e) => opt.setVal(e.target.value)}
                      placeholder={`Option ${opt.label} text`}
                      className="flex-1 text-xs p-1.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--ink-border)]"
                      required={opt.idx < 4}
                    />
                  </div>
                ))}
              </div>

              <div>
                <label className="block font-bold mb-1">Official / Step-by-Step Solution</label>
                <textarea
                  rows={2}
                  value={qSolution}
                  onChange={(e) => setQSolution(e.target.value)}
                  placeholder="Step by step solution..."
                  className="w-full text-xs p-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--ink-border)]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t-2 border-[var(--ink-border)]">
                <button
                  type="button"
                  onClick={() => setActivePaperForQuestions(null)}
                  className="px-4 py-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--ink-border)] text-xs font-bold"
                >
                  Done
                </button>
                <button
                  type="submit"
                  className="manga-btn px-5 py-2 rounded-xl bg-[var(--peach)] text-[var(--ink)] font-bold text-xs"
                >
                  Add Question & Next
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Outside Log Modal */}
      {activePaperForOutsideLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-[var(--bg-panel)] p-6 rounded-2xl border-3 border-[var(--ink-border)] max-w-2xl w-full space-y-4 shadow-manga-lg my-6">
            <div className="flex items-center justify-between border-b-2 border-[var(--ink-border)] pb-3">
              <div>
                <h3 className="font-display text-sm font-bold text-[var(--ink)] dark:text-[var(--text-main)]">
                  Log Score: {activePaperForOutsideLog.examName} ({activePaperForOutsideLog.year})
                </h3>
                <p className="text-xs text-[var(--text-muted)]">
                  Record score from an attempt done on pen-and-paper or an external platform.
                </p>
              </div>
              <button onClick={() => setActivePaperForOutsideLog(null)}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveOutsideResult} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold mb-1">Attempt Date</label>
                <input
                  type="date"
                  value={outsideDate}
                  onChange={(e) => setOutsideDate(e.target.value)}
                  className="w-full text-xs p-2 rounded-lg bg-[var(--bg-surface)] border-2 border-[var(--ink-border)] font-semibold"
                  required
                />
              </div>

              <div className="space-y-2">
                <span className="font-bold block">Sectional Attempts & Scores:</span>
                {outsideSections.map((sec, idx) => (
                  <div
                    key={sec.sectionId}
                    className="p-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--ink-border)] grid grid-cols-4 gap-2 items-center"
                  >
                    <span className="font-bold col-span-1">{sec.sectionName.split(' ')[0]}</span>
                    <div>
                      <label className="text-[10px] text-[var(--text-muted)] block">Attempted</label>
                      <input
                        type="number"
                        value={sec.attempted}
                        onChange={(e) => {
                          const next = [...outsideSections];
                          next[idx].attempted = e.target.value;
                          const att = Number(e.target.value) || 0;
                          const corr = Number(next[idx].correct) || 0;
                          if (att >= corr) next[idx].wrong = String(att - corr);
                          setOutsideSections(next);
                        }}
                        className="w-full p-1 rounded bg-[var(--bg-panel)] border border-[var(--ink-border)] text-xs font-semibold"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-[var(--text-muted)] block">Correct</label>
                      <input
                        type="number"
                        value={sec.correct}
                        onChange={(e) => {
                          const next = [...outsideSections];
                          next[idx].correct = e.target.value;
                          const att = Number(next[idx].attempted) || 0;
                          const corr = Number(e.target.value) || 0;
                          if (att >= corr) next[idx].wrong = String(att - corr);
                          setOutsideSections(next);
                        }}
                        className="w-full p-1 rounded bg-[var(--bg-panel)] border border-[var(--ink-border)] text-xs font-semibold text-emerald-600 dark:text-emerald-400"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-[var(--text-muted)] block">Wrong</label>
                      <input
                        type="number"
                        value={sec.wrong}
                        onChange={(e) => {
                          const next = [...outsideSections];
                          next[idx].wrong = e.target.value;
                          setOutsideSections(next);
                        }}
                        className="w-full p-1 rounded bg-[var(--bg-panel)] border border-[var(--ink-border)] text-xs font-semibold text-rose-600 dark:text-rose-400"
                        placeholder="0"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t-2 border-[var(--ink-border)]">
                <button
                  type="button"
                  onClick={() => setActivePaperForOutsideLog(null)}
                  className="px-4 py-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--ink-border)] text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="manga-btn px-5 py-2 rounded-xl bg-[var(--mint)] text-[var(--ink)] font-bold text-xs"
                >
                  Save Result to Log
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Timed Exam Modal */}
      {activePaperForExam && (
        <PaperExamModal
          paper={activePaperForExam}
          settings={settings}
          isOpen={true}
          onClose={() => setActivePaperForExam(null)}
          onFinished={() => {
            setActivePaperForExam(null);
            onRefresh();
            onNavigateToMocks();
          }}
        />
      )}
    </div>
  );
};
