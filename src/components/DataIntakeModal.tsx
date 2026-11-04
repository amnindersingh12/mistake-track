import React, { useState, useEffect } from 'react';
import { ExamSettings, MockTest, MistakeEntry, StudyBridgeImportPayload, ResultType, Difficulty } from '../types';
import { db } from '../db/db';
import {
  getMockCsvTemplate,
  getMistakeCsvTemplate,
  getMockJsonTemplate,
  getMistakeJsonTemplate,
  downloadTemplateFile,
  parseCsvRows,
  parseTestbookPastedText,
  parseTimeString,
  QUESTION_MISTAKE_REASONS,
  ParsedPasteResult
} from '../utils/dataIntake';
import { Mascot } from './Mascot';
import {
  X,
  FileSpreadsheet,
  FileCode,
  ClipboardPaste,
  Download,
  Upload,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Eye,
  Edit2,
  ExternalLink,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

interface DataIntakeModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: ExamSettings;
  onSuccess: (msg: string) => void;
  initialImportPayload?: StudyBridgeImportPayload | null;
  onImportAck?: (id: string, status: 'saved' | 'cancelled') => void;
}

type TabType = 'paste' | 'csv-mock' | 'csv-mistake' | 'json';

export const DataIntakeModal: React.FC<DataIntakeModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSuccess,
  initialImportPayload,
  onImportAck
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('paste');

  // Paste Import State
  const [rawPastedText, setRawPastedText] = useState('');
  const [parsedPaste, setParsedPaste] = useState<ParsedPasteResult | null>(null);
  const [showRawTextPreview, setShowRawTextPreview] = useState(false);

  // File Import Preview State
  const [previewData, setPreviewData] = useState<any[] | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [fileName, setFileName] = useState<string>('');

  // Handle incoming StudyBridge payload
  useEffect(() => {
    if (isOpen && initialImportPayload) {
      setActiveTab('paste');
      setRawPastedText(initialImportPayload.text || '');

      // Mode A: Structured Result Summary
      if (initialImportPayload.mode === 'summary' && initialImportPayload.summaryData) {
        const s = initialImportPayload.summaryData;
        const sections = (s.sections || []).map((sec: any) => ({
          sectionId: sec.sectionName.toLowerCase().includes('reason') ? 'reasoning'
            : sec.sectionName.toLowerCase().includes('quant') || sec.sectionName.toLowerCase().includes('math') ? 'quant'
            : sec.sectionName.toLowerCase().includes('eng') ? 'english' : 'general',
          sectionName: sec.sectionName,
          attempted: sec.correctCount + sec.incorrectCount,
          correct: sec.correctCount,
          wrong: sec.incorrectCount,
          unattempted: sec.skippedCount,
          timeMinutes: 0,
          score: sec.marks
        }));

        setParsedPaste({
          contentType: 'mock',
          rawText: initialImportPayload.text || '',
          mockName: s.mockName || initialImportPayload.source?.title || 'Testbook Mock Test',
          date: new Date().toISOString().split('T')[0],
          source: 'Testbook',
          sections,
          totalAttempted: s.derivedTotals?.totalAttempted,
          totalCorrect: s.derivedTotals?.totalCorrect,
          totalWrong: s.derivedTotals?.totalIncorrect,
          totalUnattempted: s.derivedTotals?.totalSkipped,
          overallScore: s.overallMarks,
          overallAccuracy: s.derivedTotals?.accuracy,
          uncertainFields: s.missingFields || [],
          unparsedLines: []
        });
        return;
      }

      // Mode B: Structured Question Review
      if (initialImportPayload.mode === 'question' && initialImportPayload.questionData) {
        const q = initialImportPayload.questionData;
        const formattedOptions = q.options?.map((opt: any) => `${opt.index + 1}. ${opt.text}${opt.isCorrect ? ' [Correct]' : ''}${opt.isSelected ? ' [Selected]' : ''}`).join('\n') || '';

        let resultType: ResultType = 'Wrong';
        if (q.statusBadge?.toLowerCase().includes('skipped') || q.selectedAnswer === 'Left unattempted') {
          resultType = 'Left unattempted';
        } else if (q.selectedAnswer && q.correctAnswer && q.selectedAnswer === q.correctAnswer) {
          resultType = 'Correct-but-slow';
        }

        const secId = q.section?.toLowerCase().includes('reason') ? 'reasoning'
          : q.section?.toLowerCase().includes('quant') || q.section?.toLowerCase().includes('math') ? 'quant'
          : q.section?.toLowerCase().includes('eng') ? 'english' : 'general';

        setParsedPaste({
          contentType: 'mistake',
          rawText: initialImportPayload.text || '',
          mockName: initialImportPayload.source?.title || 'Testbook Review',
          date: new Date().toISOString().split('T')[0],
          source: 'Testbook',
          sections: [],
          mistake: {
            mockName: initialImportPayload.source?.title || 'Testbook Review',
            sectionId: secId,
            sectionName: q.section || 'General',
            topic: q.topic || q.section || 'General',
            subtopic: '',
            questionNumber: q.questionNumber || 1,
            questionText: q.questionText + (formattedOptions ? '\n\nOptions:\n' + formattedOptions : ''),
            myAnswer: q.selectedAnswer || 'Not marked',
            correctAnswer: q.correctAnswer || 'See solution',
            resultType,
            errorTypes: ['Conceptual gap'],
            timeSpentSeconds: q.timeTaken ? parseTimeString(q.timeTaken).seconds : 60,
            idealTimeSeconds: q.avgTime ? parseTimeString(q.avgTime).seconds : 45,
            whatWentWrong: q.statusBadge ? `Status: ${q.statusBadge}` : '',
            correctSolution: q.explanation || '',
            betterApproach: '',
            ruleToRemember: '',
            difficulty: 'Medium',
            uncertainFields: q.missingFields || []
          },
          uncertainFields: q.missingFields || [],
          unparsedLines: []
        });
        return;
      }

      // Mode C / Fallback: Plain text parsing
      if (initialImportPayload.text) {
        const parsed = parseTestbookPastedText(initialImportPayload.text, settings);
        if (initialImportPayload.source?.title && parsed.mockName === 'Imported Testbook Mock') {
          parsed.mockName = initialImportPayload.source.title.slice(0, 80);
        }
        setParsedPaste(parsed);
      }
    }
  }, [isOpen, initialImportPayload, settings]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleModalClose();
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        if (activeTab === 'paste') {
          if (parsedPaste?.contentType === 'mock') {
            handleSaveParsedMock();
          } else if (parsedPaste?.contentType === 'mistake' || parsedPaste?.mistake) {
            handleSaveParsedMistake();
          } else {
            handleParseText();
          }
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, activeTab, parsedPaste, rawPastedText]);

  if (!isOpen) return null;

  const handleModalClose = () => {
    if (initialImportPayload?.id && onImportAck) {
      onImportAck(initialImportPayload.id, 'cancelled');
    }
    onClose();
  };

  // Handle Paste Parse
  const handleParseText = () => {
    if (!rawPastedText.trim()) return;
    const parsed = parseTestbookPastedText(rawPastedText, settings);
    setParsedPaste(parsed);
  };

  const handleSaveParsedMistake = async () => {
    if (!parsedPaste?.mistake) return;
    const m = parsedPaste.mistake;
    const newMistake: Omit<MistakeEntry, 'id'> = {
      mockId: 1,
      mockName: m.mockName || 'Testbook Review',
      sectionId: m.sectionId,
      sectionName: m.sectionName,
      topic: m.topic || 'General',
      subtopic: m.subtopic || '',
      questionNumber: m.questionNumber || 1,
      questionText: m.questionText,
      myAnswer: m.myAnswer,
      correctAnswer: m.correctAnswer,
      resultType: m.resultType,
      errorTypes: m.errorTypes.length ? m.errorTypes : ['Concept gap'],
      timeSpentSeconds: m.timeSpentSeconds,
      idealTimeSeconds: m.idealTimeSeconds,
      whatWentWrong: m.whatWentWrong,
      correctSolution: m.correctSolution,
      betterApproach: m.betterApproach,
      ruleToRemember: m.ruleToRemember,
      difficulty: m.difficulty,
      tags: ['studybridge-import'],
      status: 'New',
      interval: 1,
      consecutiveCorrect: 0,
      nextReviewDate: new Date().toISOString().split('T')[0],
      history: [],
      createdAt: new Date().toISOString().split('T')[0]
    };

    await db.mistakes.add(newMistake as MistakeEntry);
    if (initialImportPayload?.id && onImportAck) {
      onImportAck(initialImportPayload.id, 'saved');
    }
    onSuccess(`Imported Question ${m.questionNumber} (${m.topic}) to Mistakes Log!`);
    onClose();
  };

  const handleSaveParsedMock = async () => {
    if (!parsedPaste) return;

    // Calculate totals
    let totalAttempted = 0;
    let totalCorrect = 0;
    let totalWrong = 0;
    let totalTime = 0;
    let totalNetScore = 0;

    const liveSections = parsedPaste.sections.map((sec) => {
      const secConf = settings.sections.find((s) => s.id === sec.sectionId) || {
        totalQuestions: 35,
        marksPerCorrect: 1,
        negativeMark: 0.25
      };

      const unattempted = sec.unattempted !== undefined ? sec.unattempted : Math.max(0, secConf.totalQuestions - sec.attempted);
      const calculatedNet = Number((sec.correct * secConf.marksPerCorrect - sec.wrong * secConf.negativeMark).toFixed(2));
      const net = sec.score !== undefined ? sec.score : calculatedNet;
      const acc = sec.attempted > 0 ? Number(((sec.correct / sec.attempted) * 100).toFixed(1)) : 0;
      const negLost = Number((sec.wrong * secConf.negativeMark).toFixed(2));

      totalAttempted += sec.attempted;
      totalCorrect += sec.correct;
      totalWrong += sec.wrong;
      totalTime += sec.timeMinutes * 60;
      totalNetScore += net;

      return {
        sectionId: sec.sectionId,
        sectionName: sec.sectionName,
        attempted: sec.attempted,
        correct: sec.correct,
        wrong: sec.wrong,
        timeSpentSeconds: sec.timeMinutes * 60,
        unattempted,
        netScore: net,
        accuracy: acc,
        marksLostNegative: negLost
      };
    });

    const overallAccuracy = parsedPaste.overallAccuracy !== undefined
      ? parsedPaste.overallAccuracy
      : totalAttempted > 0 ? Number(((totalCorrect / totalAttempted) * 100).toFixed(1)) : 0;
    const totalNegLost = liveSections.reduce((s, x) => s + x.marksLostNegative, 0);

    const finalNetScore = parsedPaste.overallScore !== undefined ? parsedPaste.overallScore : Number(totalNetScore.toFixed(2));

    const newMock: Omit<MockTest, 'id'> = {
      name: parsedPaste.mockName,
      date: parsedPaste.date,
      source: parsedPaste.source,
      attemptType: 'mock',
      overallRank: parsedPaste.overallRank,
      overallPercentile: parsedPaste.overallPercentile,
      sections: liveSections,
      totalAttempted: parsedPaste.totalAttempted !== undefined ? parsedPaste.totalAttempted : totalAttempted,
      totalCorrect: parsedPaste.totalCorrect !== undefined ? parsedPaste.totalCorrect : totalCorrect,
      totalWrong: parsedPaste.totalWrong !== undefined ? parsedPaste.totalWrong : totalWrong,
      totalUnattempted: parsedPaste.totalUnattempted !== undefined ? parsedPaste.totalUnattempted : (settings.sections.reduce((s, x) => s + x.totalQuestions, 0) - totalAttempted),
      totalNetScore: finalNetScore,
      overallAccuracy,
      totalMarksLostNegative: Number(totalNegLost.toFixed(2)),
      totalTimeSpentSeconds: totalTime,
      notes: initialImportPayload?.source?.url
        ? `Imported via StudyBridge from ${initialImportPayload.source.url}`
        : 'Imported via Testbook Result Paste'
    };

    await db.mocks.add(newMock as MockTest);
    if (initialImportPayload?.id && onImportAck) {
      onImportAck(initialImportPayload.id, 'saved');
    }
    onSuccess(`Imported "${parsedPaste.mockName}" successfully!`);
    onClose();
  };

  // CSV Mock File Handler
  const handleCsvMockUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setValidationErrors([]);

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      const rows = parseCsvRows(text);
      if (rows.length < 2) {
        setValidationErrors(['CSV file must have a header row and at least 1 data row.']);
        return;
      }

      const headers = rows[0].map((h) => h.toLowerCase());
      const parsedMocks: any[] = [];
      const errors: string[] = [];

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (row.length < 5) continue;

        const name = row[0] || `Mock Test ${i}`;
        const date = row[1] || new Date().toISOString().split('T')[0];
        const source = row[2] || 'Testbook';
        const type = (['mock', 'pyq', 'memory-based'].includes(row[3]?.toLowerCase()) ? row[3].toLowerCase() : 'mock');

        // Check date format
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
          errors.push(`Row ${i}: Invalid date format "${date}". Use YYYY-MM-DD.`);
        }

        parsedMocks.push({ name, date, source, attemptType: type, rawRow: row });
      }

      setValidationErrors(errors);
      setPreviewData(parsedMocks);
    };
    reader.readAsText(file);
  };

  // Commit CSV Mocks
  const handleSaveCsvMocks = async () => {
    if (!previewData || previewData.length === 0) return;

    for (const item of previewData) {
      const row = item.rawRow;
      // Default sectional distribution
      const qAtt = parseInt(row[6], 10) || 0;
      const qCorr = parseInt(row[7], 10) || 0;
      const qWrong = parseInt(row[8], 10) || 0;

      const rAtt = parseInt(row[10], 10) || 0;
      const rCorr = parseInt(row[11], 10) || 0;
      const rWrong = parseInt(row[12], 10) || 0;

      const eAtt = parseInt(row[14], 10) || 0;
      const eCorr = parseInt(row[15], 10) || 0;
      const eWrong = parseInt(row[16], 10) || 0;

      const sections = [
        {
          sectionId: 'quant',
          sectionName: 'Quantitative Aptitude',
          attempted: qAtt,
          correct: qCorr,
          wrong: qWrong,
          timeSpentSeconds: 1200,
          unattempted: 35 - qAtt,
          netScore: Number((qCorr - qWrong * 0.25).toFixed(2)),
          accuracy: qAtt > 0 ? Number(((qCorr / qAtt) * 100).toFixed(1)) : 0,
          marksLostNegative: Number((qWrong * 0.25).toFixed(2))
        },
        {
          sectionId: 'reasoning',
          sectionName: 'Reasoning Ability',
          attempted: rAtt,
          correct: rCorr,
          wrong: rWrong,
          timeSpentSeconds: 1200,
          unattempted: 35 - rAtt,
          netScore: Number((rCorr - rWrong * 0.25).toFixed(2)),
          accuracy: rAtt > 0 ? Number(((rCorr / rAtt) * 100).toFixed(1)) : 0,
          marksLostNegative: Number((rWrong * 0.25).toFixed(2))
        },
        {
          sectionId: 'english',
          sectionName: 'English Language',
          attempted: eAtt,
          correct: eCorr,
          wrong: eWrong,
          timeSpentSeconds: 1200,
          unattempted: 30 - eAtt,
          netScore: Number((eCorr - eWrong * 0.25).toFixed(2)),
          accuracy: eAtt > 0 ? Number(((eCorr / eAtt) * 100).toFixed(1)) : 0,
          marksLostNegative: Number((eWrong * 0.25).toFixed(2))
        }
      ];

      const totAtt = qAtt + rAtt + eAtt;
      const totCorr = qCorr + rCorr + eCorr;
      const totWrong = qWrong + rWrong + eWrong;
      const totNet = Number(sections.reduce((s, x) => s + x.netScore, 0).toFixed(2));

      await db.mocks.add({
        name: item.name,
        date: item.date,
        source: item.source,
        attemptType: item.attemptType || 'mock',
        sections,
        totalAttempted: totAtt,
        totalCorrect: totCorr,
        totalWrong: totWrong,
        totalUnattempted: 100 - totAtt,
        totalNetScore: totNet,
        overallAccuracy: totAtt > 0 ? Number(((totCorr / totAtt) * 100).toFixed(1)) : 0,
        totalMarksLostNegative: Number((totWrong * 0.25).toFixed(2)),
        totalTimeSpentSeconds: 3600
      });
    }

    onSuccess(`Imported ${previewData.length} mock test(s) successfully!`);
    onClose();
  };

  // CSV Mistake File Handler
  const handleCsvMistakeUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setValidationErrors([]);

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      const rows = parseCsvRows(text);
      if (rows.length < 2) {
        setValidationErrors(['CSV file must contain a header and at least 1 mistake entry.']);
        return;
      }

      const mistakesList: any[] = [];
      const errors: string[] = [];

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (row.length < 6) continue;

        const mockName = row[0] || 'Imported Mock';
        const secName = row[1] || 'Quant';
        const topic = row[2] || 'Arithmetic';
        const subtopic = row[3] || '';
        const qNo = parseInt(row[4], 10) || i;
        const qText = row[5] || 'Question statement';
        const myAns = row[6] || '';
        const corrAns = row[7] || '';
        const resultType = (['Wrong', 'Left unattempted', 'Correct-but-slow'].includes(row[8]) ? row[8] : 'Wrong');
        const errorTypes = row[9] ? row[9].split(';').map((s) => s.trim()) : ['Concept gap'];
        const timeSpent = parseInt(row[10], 10) || 60;
        const idealTime = parseInt(row[11], 10) || 35;
        const whatWrong = row[12] || 'Mistake recorded.';
        const sol = row[13] || 'Refer solution.';
        const shortcut = row[14] || '';
        const rule = row[15] || 'Review core rule.';
        const diff = (['Easy', 'Medium', 'Hard'].includes(row[16]) ? row[16] : 'Medium');

        if (!rule) {
          errors.push(`Row ${i}: Missing "Rule to Remember".`);
        }

        mistakesList.push({
          mockId: 1,
          mockName,
          sectionId: secName.toLowerCase().includes('reason') ? 'reasoning' : secName.toLowerCase().includes('eng') ? 'english' : 'quant',
          sectionName: secName,
          topic,
          subtopic,
          questionNumber: qNo,
          questionText: qText,
          myAnswer: myAns,
          correctAnswer: corrAns,
          resultType,
          errorTypes,
          timeSpentSeconds: timeSpent,
          idealTimeSeconds: idealTime,
          whatWentWrong: whatWrong,
          correctSolution: sol,
          betterApproach: shortcut,
          ruleToRemember: rule,
          difficulty: diff,
          tags: ['csv-import'],
          status: 'New',
          interval: 1,
          consecutiveCorrect: 0,
          nextReviewDate: new Date().toISOString().split('T')[0],
          history: [],
          createdAt: new Date().toISOString().split('T')[0]
        });
      }

      setValidationErrors(errors);
      setPreviewData(mistakesList);
    };
    reader.readAsText(file);
  };

  // Commit CSV Mistakes
  const handleSaveCsvMistakes = async () => {
    if (!previewData || previewData.length === 0) return;
    for (const m of previewData) {
      await db.mistakes.add(m);
    }
    onSuccess(`Imported ${previewData.length} mistake(s) successfully!`);
    onClose();
  };

  // JSON Import Handler
  const handleJsonUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setValidationErrors([]);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const json = JSON.parse(evt.target?.result as string);
        if (Array.isArray(json)) {
          setPreviewData(json);
        } else if (json.mocks || json.mistakes) {
          setPreviewData([json]);
        } else {
          setValidationErrors(['Invalid JSON structure.']);
        }
      } catch (err: any) {
        setValidationErrors([`JSON Syntax Error: ${err.message}`]);
      }
    };
    reader.readAsText(file);
  };

  const handleSaveJson = async () => {
    if (!previewData || previewData.length === 0) return;
    let mockAdded = 0;
    let mistakeAdded = 0;

    for (const item of previewData) {
      if (item.mocks && Array.isArray(item.mocks)) {
        for (const m of item.mocks) {
          await db.mocks.add(m);
          mockAdded++;
        }
      }
      if (item.mistakes && Array.isArray(item.mistakes)) {
        for (const mst of item.mistakes) {
          await db.mistakes.add(mst);
          mistakeAdded++;
        }
      }
      if (item.sections && item.totalAttempted !== undefined) {
        await db.mocks.add(item);
        mockAdded++;
      } else if (item.ruleToRemember && item.whatWentWrong) {
        await db.mistakes.add(item);
        mistakeAdded++;
      }
    }

    onSuccess(`Restored ${mockAdded} mocks & ${mistakeAdded} mistakes from JSON!`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-[var(--bg-panel)] text-[var(--text-main)] rounded-2xl max-w-3xl w-full border-3 border-[var(--ink-border)] shadow-manga-lg my-6 max-h-[92vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="p-5 border-b-2 border-[var(--ink-border)] flex items-center justify-between bg-[var(--bg-surface)]">
          <div className="flex items-center gap-3">
            <Mascot mood="reading" size="sm" />
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display text-base font-bold text-[var(--ink)] dark:text-[var(--text-main)]">
                  Data Intake Hub
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[var(--bg-panel)] border border-[var(--border-subtle)] font-bold text-[var(--action-primary)]">
                  Real Data Intake
                </span>
              </div>
              <p className="text-xs text-[var(--text-muted)]">
                Import your real mock tests, Testbook scorecards, and mistake logs without fake data.
              </p>
            </div>
          </div>
          <button
            onClick={handleModalClose}
            className="p-1.5 rounded-lg border-2 border-[var(--ink-border)] hover:bg-[var(--sakura)]/30 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b-2 border-[var(--ink-border)] bg-[var(--bg-surface)] text-xs font-bold overflow-x-auto">
          <button
            onClick={() => {
              setActiveTab('paste');
              setPreviewData(null);
            }}
            className={`px-4 py-3 border-r-2 border-[var(--ink-border)] flex items-center gap-2 whitespace-nowrap transition-colors ${
              activeTab === 'paste'
                ? 'bg-[var(--peach)] text-[var(--ink)]'
                : 'hover:bg-[var(--bg-panel)] text-[var(--text-muted)]'
            }`}
          >
            <ClipboardPaste className="w-4 h-4" />
            <span>Testbook Paste Import</span>
          </button>
          <button
            onClick={() => {
              setActiveTab('csv-mock');
              setPreviewData(null);
            }}
            className={`px-4 py-3 border-r-2 border-[var(--ink-border)] flex items-center gap-2 whitespace-nowrap transition-colors ${
              activeTab === 'csv-mock'
                ? 'bg-[var(--sakura)] text-[var(--ink)]'
                : 'hover:bg-[var(--bg-panel)] text-[var(--text-muted)]'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Mock CSV Import</span>
          </button>
          <button
            onClick={() => {
              setActiveTab('csv-mistake');
              setPreviewData(null);
            }}
            className={`px-4 py-3 border-r-2 border-[var(--ink-border)] flex items-center gap-2 whitespace-nowrap transition-colors ${
              activeTab === 'csv-mistake'
                ? 'bg-[var(--mint)] text-[var(--ink)]'
                : 'hover:bg-[var(--bg-panel)] text-[var(--text-muted)]'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Mistake CSV Import</span>
          </button>
          <button
            onClick={() => {
              setActiveTab('json');
              setPreviewData(null);
            }}
            className={`px-4 py-3 flex items-center gap-2 whitespace-nowrap transition-colors ${
              activeTab === 'json'
                ? 'bg-[var(--teal)] text-white'
                : 'hover:bg-[var(--bg-panel)] text-[var(--text-muted)]'
            }`}
          >
            <FileCode className="w-4 h-4" />
            <span>JSON Backup</span>
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* TAB 1: Testbook Paste Import */}
          {activeTab === 'paste' && (
            <div className="space-y-4">
              {/* StudyBridge Source Indicator */}
              {initialImportPayload && (
                <div className="p-3.5 rounded-xl bg-purple-50 dark:bg-purple-950/40 border-2 border-purple-300 dark:border-purple-800 text-xs flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2 font-bold text-purple-900 dark:text-purple-200">
                      <ExternalLink className="w-4 h-4" />
                      <span>StudyBridge Transfer Received</span>
                    </div>
                    <p className="text-[11px] text-purple-700 dark:text-purple-300">
                      From: <strong>{initialImportPayload.source?.title || 'Testbook'}</strong>
                      {initialImportPayload.source?.url && (
                        <span className="opacity-75"> ({initialImportPayload.source.url.slice(0, 50)}...)</span>
                      )}
                    </p>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-200 dark:bg-purple-900 text-purple-900 dark:text-purple-200 font-bold">
                    Pending Confirmation
                  </span>
                </div>
              )}

              <div className="p-3.5 rounded-xl bg-[var(--bg-surface)] border-2 border-[var(--ink-border)] text-xs space-y-1">
                <span className="font-bold text-[var(--ink)] dark:text-[var(--text-main)] block">
                  How it works:
                </span>
                <p className="text-[var(--text-muted)] leading-relaxed">
                  Open your Testbook test analysis or solution review page. Select any scorecard summary or mistake question, transfer via StudyBridge extension or paste below, and click <strong>Parse Text</strong>. Review and edit fields before saving.
                </p>
              </div>

              {!parsedPaste ? (
                <div className="space-y-3">
                  <textarea
                    rows={7}
                    value={rawPastedText}
                    onChange={(e) => setRawPastedText(e.target.value)}
                    placeholder="Paste copied Testbook test results summary or mistake review here...&#10;&#10;e.g.&#10;Testbook PO Prelims Live Mock 03&#10;Overall Rank: 1,420 | Percentile: 94.2%&#10;Quantitative Aptitude: Attempted 26, Correct 22, Wrong 4, Time: 20 mins&#10;Reasoning Ability: Attempted 28, Correct 24, Wrong 4, Time: 20 mins&#10;English Language: Attempted 22, Correct 18, Wrong 4, Time: 20 mins"
                    className="w-full text-xs font-mono p-3.5 rounded-xl bg-[var(--bg-surface)] border-2 border-[var(--ink-border)] focus:outline-none focus:ring-2 focus:ring-[var(--sakura)]"
                  />
                  <div className="flex justify-end">
                    <button
                      onClick={handleParseText}
                      disabled={!rawPastedText.trim()}
                      className="manga-btn px-5 py-2.5 rounded-xl bg-[var(--peach)] text-[var(--ink)] font-bold text-xs flex items-center gap-2 disabled:opacity-50"
                      title="Parse pasted content (Press ⌘↵)"
                    >
                      <Eye className="w-4 h-4" />
                      <span>Parse Text</span>
                      <kbd className="text-[10px] font-mono px-1 py-0.2 rounded bg-black/10 font-bold">⌘↵</kbd>
                    </button>
                  </div>
                </div>
              ) : (
                /* Editable Parsed Result View */
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between">
                    <h4 className="font-display text-sm font-bold text-[var(--ink)] dark:text-[var(--text-main)] flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-[var(--mint)]" />
                      <span>
                        Parsed {parsedPaste.contentType === 'mistake' ? 'Mistake Question' : 'Mock Scorecard'} (Review & Edit Before Saving)
                      </span>
                    </h4>
                    <button
                      onClick={() => setParsedPaste(null)}
                      className="text-xs text-[var(--text-muted)] hover:underline"
                    >
                      Paste again
                    </button>
                  </div>

                  {/* Highlight Uncertain Fields if Any */}
                  {parsedPaste.uncertainFields.length > 0 && (
                    <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-300 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-200 space-y-1">
                      <div className="font-bold flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                        <span>Please verify unconfirmed / approximate fields:</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {parsedPaste.uncertainFields.map((field, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 rounded bg-amber-200 dark:bg-amber-900 font-mono text-[10px] font-bold"
                          >
                            {field}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ------------------------------------------- */}
                  {/* TYPE A: PARSED MISTAKE QUESTION             */}
                  {/* ------------------------------------------- */}
                  {parsedPaste.contentType === 'mistake' && parsedPaste.mistake && (
                    <div className="space-y-3.5 text-xs">
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                        <div>
                          <label className="block text-[11px] font-bold mb-1">Source Mock</label>
                          <input
                            type="text"
                            value={parsedPaste.mistake.mockName}
                            onChange={(e) =>
                              setParsedPaste({
                                ...parsedPaste,
                                mistake: { ...parsedPaste.mistake!, mockName: e.target.value }
                              })
                            }
                            className="w-full text-xs p-2 rounded-lg bg-[var(--bg-surface)] border-2 border-[var(--ink-border)] font-semibold"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold mb-1">Section</label>
                          <select
                            value={parsedPaste.mistake.sectionId}
                            onChange={(e) => {
                              const s = settings.sections.find((sec) => sec.id === e.target.value);
                              setParsedPaste({
                                ...parsedPaste,
                                mistake: {
                                  ...parsedPaste.mistake!,
                                  sectionId: e.target.value,
                                  sectionName: s?.name || e.target.value
                                }
                              });
                            }}
                            className="w-full text-xs p-2 rounded-lg bg-[var(--bg-surface)] border-2 border-[var(--ink-border)] font-semibold"
                          >
                            {settings.sections.map((sec) => (
                              <option key={sec.id} value={sec.id}>
                                {sec.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold mb-1">Topic</label>
                          <input
                            type="text"
                            value={parsedPaste.mistake.topic}
                            onChange={(e) =>
                              setParsedPaste({
                                ...parsedPaste,
                                mistake: { ...parsedPaste.mistake!, topic: e.target.value }
                              })
                            }
                            className="w-full text-xs p-2 rounded-lg bg-[var(--bg-surface)] border-2 border-[var(--ink-border)] font-semibold"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold mb-1">Q Number</label>
                          <input
                            type="number"
                            value={parsedPaste.mistake.questionNumber}
                            onChange={(e) =>
                              setParsedPaste({
                                ...parsedPaste,
                                mistake: { ...parsedPaste.mistake!, questionNumber: parseInt(e.target.value, 10) || 1 }
                              })
                            }
                            className="w-full text-xs p-2 rounded-lg bg-[var(--bg-surface)] border-2 border-[var(--ink-border)] font-semibold"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold mb-1">Question Statement</label>
                        <textarea
                          rows={3}
                          value={parsedPaste.mistake.questionText}
                          onChange={(e) =>
                            setParsedPaste({
                              ...parsedPaste,
                              mistake: { ...parsedPaste.mistake!, questionText: e.target.value }
                            })
                          }
                          className="w-full text-xs font-mono p-2.5 rounded-lg bg-[var(--bg-surface)] border-2 border-[var(--ink-border)]"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[11px] font-bold mb-1">My / Selected Answer</label>
                          <input
                            type="text"
                            value={parsedPaste.mistake.myAnswer}
                            onChange={(e) =>
                              setParsedPaste({
                                ...parsedPaste,
                                mistake: { ...parsedPaste.mistake!, myAnswer: e.target.value }
                              })
                            }
                            className="w-full text-xs p-2 rounded-lg bg-[var(--bg-surface)] border-2 border-[var(--ink-border)] font-semibold text-rose-600 dark:text-rose-400"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold mb-1">Correct Answer</label>
                          <input
                            type="text"
                            value={parsedPaste.mistake.correctAnswer}
                            onChange={(e) =>
                              setParsedPaste({
                                ...parsedPaste,
                                mistake: { ...parsedPaste.mistake!, correctAnswer: e.target.value }
                              })
                            }
                            className="w-full text-xs p-2 rounded-lg bg-[var(--bg-surface)] border-2 border-[var(--ink-border)] font-semibold text-emerald-600 dark:text-emerald-400"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold mb-1">Result Type</label>
                          <select
                            value={parsedPaste.mistake.resultType}
                            onChange={(e) =>
                              setParsedPaste({
                                ...parsedPaste,
                                mistake: { ...parsedPaste.mistake!, resultType: e.target.value as ResultType }
                              })
                            }
                            className="w-full text-xs p-2 rounded-lg bg-[var(--bg-surface)] border-2 border-[var(--ink-border)] font-semibold"
                          >
                            <option value="Wrong">Wrong</option>
                            <option value="Left unattempted">Left unattempted</option>
                            <option value="Correct-but-slow">Correct-but-slow</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-bold mb-1">Time Spent (sec)</label>
                          <input
                            type="number"
                            value={parsedPaste.mistake.timeSpentSeconds}
                            onChange={(e) =>
                              setParsedPaste({
                                ...parsedPaste,
                                mistake: { ...parsedPaste.mistake!, timeSpentSeconds: parseInt(e.target.value, 10) || 0 }
                              })
                            }
                            className="w-full text-xs p-2 rounded-lg bg-[var(--bg-surface)] border-2 border-[var(--ink-border)] font-semibold"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold mb-1">Ideal Time (sec)</label>
                          <input
                            type="number"
                            value={parsedPaste.mistake.idealTimeSeconds}
                            onChange={(e) =>
                              setParsedPaste({
                                ...parsedPaste,
                                mistake: { ...parsedPaste.mistake!, idealTimeSeconds: parseInt(e.target.value, 10) || 0 }
                              })
                            }
                            className="w-full text-xs p-2 rounded-lg bg-[var(--bg-surface)] border-2 border-[var(--ink-border)] font-semibold"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold mb-1">Solution / Explanation</label>
                        <textarea
                          rows={2}
                          value={parsedPaste.mistake.correctSolution}
                          onChange={(e) =>
                            setParsedPaste({
                              ...parsedPaste,
                              mistake: { ...parsedPaste.mistake!, correctSolution: e.target.value }
                            })
                          }
                          className="w-full text-xs p-2.5 rounded-lg bg-[var(--bg-surface)] border-2 border-[var(--ink-border)]"
                        />
                      </div>

                      {/* Classification (Reason for mistake) */}
                      <div>
                        <label className="block text-[11px] font-bold mb-1.5 text-[var(--ink)] dark:text-[var(--text-main)]">
                          Mistake Classification:
                        </label>
                        <div className="flex flex-wrap gap-1.5">
                          {QUESTION_MISTAKE_REASONS.map((reason) => {
                            const isSelected = parsedPaste.mistake?.errorTypes.includes(reason);
                            return (
                              <button
                                key={reason}
                                type="button"
                                onClick={() => {
                                  const current = parsedPaste.mistake?.errorTypes || [];
                                  const updated = isSelected
                                    ? current.filter((r) => r !== reason)
                                    : [...current.filter((r) => !QUESTION_MISTAKE_REASONS.includes(r as any)), reason];
                                  setParsedPaste({
                                    ...parsedPaste,
                                    mistake: {
                                      ...parsedPaste.mistake!,
                                      errorTypes: updated.length > 0 ? updated : [reason]
                                    }
                                  });
                                }}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border-2 transition-all ${
                                  isSelected
                                    ? 'bg-[var(--action-primary)] text-white border-[var(--ink-border)] shadow-sm'
                                    : 'bg-[var(--bg-surface)] text-[var(--text-muted)] border-[var(--ink-border)] hover:bg-[var(--bg-panel)]'
                                }`}
                              >
                                {reason}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold mb-1">Shortcut / Better Approach</label>
                        <input
                          type="text"
                          value={parsedPaste.mistake.betterApproach}
                          onChange={(e) =>
                            setParsedPaste({
                              ...parsedPaste,
                              mistake: { ...parsedPaste.mistake!, betterApproach: e.target.value }
                            })
                          }
                          className="w-full text-xs p-2 rounded-lg bg-[var(--bg-surface)] border-2 border-[var(--ink-border)] font-semibold"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold mb-1">Rule to Remember (Core Lesson / Notes)</label>
                        <input
                          type="text"
                          value={parsedPaste.mistake.ruleToRemember}
                          onChange={(e) =>
                            setParsedPaste({
                              ...parsedPaste,
                              mistake: { ...parsedPaste.mistake!, ruleToRemember: e.target.value }
                            })
                          }
                          className="w-full text-xs p-2 rounded-lg bg-[var(--bg-surface)] border-2 border-[var(--ink-border)] font-semibold text-purple-700 dark:text-purple-300"
                        />
                      </div>

                      <div className="flex justify-end gap-2 pt-2">
                        <button
                          onClick={handleSaveParsedMistake}
                          className="manga-btn px-6 py-2.5 rounded-xl bg-[var(--sakura)] text-white font-bold text-xs flex items-center gap-2 shadow-manga-sm hover:-translate-y-0.5 active:translate-y-0.5 transition-all"
                          title="Save as Mistake (Press ⌘↵)"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Save as Mistake</span>
                          <kbd className="text-[10px] font-mono px-1 py-0.2 rounded bg-black/20 text-white font-bold">⌘↵</kbd>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* ------------------------------------------- */}
                  {/* TYPE B: PARSED MOCK SCORECARD               */}
                  {/* ------------------------------------------- */}
                  {parsedPaste.contentType === 'mock' && (
                    <div className="space-y-4">
                      {/* Basic Mock Metadata */}
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                        <div className="sm:col-span-2">
                          <label className="block text-[11px] font-bold mb-1">Mock Name</label>
                          <input
                            type="text"
                            value={parsedPaste.mockName}
                            onChange={(e) => setParsedPaste({ ...parsedPaste, mockName: e.target.value })}
                            className="w-full text-xs p-2 rounded-lg bg-[var(--bg-surface)] border-2 border-[var(--ink-border)] font-semibold"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold mb-1">Rank (Optional)</label>
                          <input
                            type="number"
                            value={parsedPaste.overallRank || ''}
                            onChange={(e) =>
                              setParsedPaste({ ...parsedPaste, overallRank: parseInt(e.target.value, 10) || undefined })
                            }
                            className="w-full text-xs p-2 rounded-lg bg-[var(--bg-surface)] border-2 border-[var(--ink-border)] font-semibold"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold mb-1">Percentile %</label>
                          <input
                            type="number"
                            step="0.1"
                            value={parsedPaste.overallPercentile || ''}
                            onChange={(e) =>
                              setParsedPaste({ ...parsedPaste, overallPercentile: parseFloat(e.target.value) || undefined })
                            }
                            className="w-full text-xs p-2 rounded-lg bg-[var(--bg-surface)] border-2 border-[var(--ink-border)] font-semibold"
                          />
                        </div>
                      </div>

                      {/* Sectional Performance Table */}
                      <div className="overflow-x-auto rounded-xl border-2 border-[var(--ink-border)]">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-[var(--bg-surface)] border-b-2 border-[var(--ink-border)] font-bold text-[var(--ink)] dark:text-[var(--text-main)]">
                            <tr>
                              <th className="p-2.5">Section</th>
                              <th className="p-2.5">Attempted</th>
                              <th className="p-2.5">Correct</th>
                              <th className="p-2.5">Wrong</th>
                              <th className="p-2.5">Time (min)</th>
                              <th className="p-2.5">Score</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[var(--ink-border)]/40 bg-[var(--bg-surface)]">
                            {parsedPaste.sections.map((sec, idx) => (
                              <tr key={`${sec.sectionId}-${idx}`} className={sec.isUncertain ? 'bg-amber-50/40 dark:bg-amber-950/20' : ''}>
                                <td className="p-2.5 font-bold">
                                  <span>{sec.sectionName}</span>
                                  {sec.isUncertain && (
                                    <span className="block text-[9px] text-amber-600 font-mono">Verify</span>
                                  )}
                                </td>
                                <td className="p-2.5">
                                  <input
                                    type="number"
                                    value={sec.attempted}
                                    onChange={(e) => {
                                      const next = [...parsedPaste.sections];
                                      next[idx].attempted = parseInt(e.target.value, 10) || 0;
                                      setParsedPaste({ ...parsedPaste, sections: next });
                                    }}
                                    className="w-16 p-1 rounded bg-[var(--bg-panel)] border border-[var(--ink-border)] text-xs font-semibold"
                                  />
                                </td>
                                <td className="p-2.5">
                                  <input
                                    type="number"
                                    value={sec.correct}
                                    onChange={(e) => {
                                      const next = [...parsedPaste.sections];
                                      next[idx].correct = parseInt(e.target.value, 10) || 0;
                                      if (next[idx].attempted >= next[idx].correct) {
                                        next[idx].wrong = next[idx].attempted - next[idx].correct;
                                      }
                                      setParsedPaste({ ...parsedPaste, sections: next });
                                    }}
                                    className="w-16 p-1 rounded bg-[var(--bg-panel)] border border-[var(--ink-border)] text-xs font-semibold text-emerald-600 dark:text-emerald-400"
                                  />
                                </td>
                                <td className="p-2.5">
                                  <input
                                    type="number"
                                    value={sec.wrong}
                                    onChange={(e) => {
                                      const next = [...parsedPaste.sections];
                                      next[idx].wrong = parseInt(e.target.value, 10) || 0;
                                      setParsedPaste({ ...parsedPaste, sections: next });
                                    }}
                                    className="w-16 p-1 rounded bg-[var(--bg-panel)] border border-[var(--ink-border)] text-xs font-semibold text-rose-600 dark:text-rose-400"
                                  />
                                </td>
                                <td className="p-2.5">
                                  <input
                                    type="number"
                                    value={sec.timeMinutes}
                                    onChange={(e) => {
                                      const next = [...parsedPaste.sections];
                                      next[idx].timeMinutes = parseInt(e.target.value, 10) || 20;
                                      setParsedPaste({ ...parsedPaste, sections: next });
                                    }}
                                    className="w-16 p-1 rounded bg-[var(--bg-panel)] border border-[var(--ink-border)] text-xs font-semibold"
                                  />
                                </td>
                                <td className="p-2.5">
                                  <input
                                    type="number"
                                    step="0.25"
                                    value={sec.score !== undefined ? sec.score : Number((sec.correct - sec.wrong * 0.25).toFixed(2))}
                                    onChange={(e) => {
                                      const next = [...parsedPaste.sections];
                                      next[idx].score = parseFloat(e.target.value);
                                      setParsedPaste({ ...parsedPaste, sections: next });
                                    }}
                                    className="w-16 p-1 rounded bg-[var(--bg-panel)] border border-[var(--ink-border)] text-xs font-semibold"
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div className="flex justify-end gap-2 pt-2">
                        <button
                          onClick={handleSaveParsedMock}
                          className="manga-btn px-6 py-2.5 rounded-xl bg-[var(--mint)] text-[var(--ink)] font-bold text-xs flex items-center gap-2 shadow-manga-sm hover:-translate-y-0.5 active:translate-y-0.5 transition-all"
                          title="Confirm & Save to Mock Log (Press ⌘↵)"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Confirm & Save to Mock Log</span>
                          <kbd className="text-[10px] font-mono px-1 py-0.2 rounded bg-black/15 font-bold">⌘↵</kbd>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Expandable Original Captured Text Inspection */}
                  <div className="pt-2 border-t border-[var(--ink-border)]/40">
                    <button
                      onClick={() => setShowRawTextPreview(!showRawTextPreview)}
                      className="text-[11px] font-bold text-[var(--text-muted)] hover:text-[var(--text-main)] flex items-center gap-1"
                    >
                      {showRawTextPreview ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      <span>Original Captured Selection ({parsedPaste.rawText?.length || 0} chars)</span>
                    </button>
                    {showRawTextPreview && (
                      <pre className="mt-2 p-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--ink-border)] text-[10px] font-mono whitespace-pre-wrap max-h-40 overflow-y-auto text-[var(--text-muted)]">
                        {parsedPaste.rawText}
                      </pre>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Mock CSV Import */}
          {activeTab === 'csv-mock' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-[var(--bg-surface)] border-2 border-[var(--ink-border)] text-xs">
                <div>
                  <span className="font-bold text-[var(--ink)] dark:text-[var(--text-main)] block">
                    Download Official Mock CSV Template
                  </span>
                  <p className="text-[var(--text-muted)] text-[11px]">
                    Includes columns for mock name, date, source, type, and sectional attempts/correct/wrong.
                  </p>
                </div>
                <button
                  onClick={() => downloadTemplateFile('mock_tests_template.csv', getMockCsvTemplate())}
                  className="manga-btn px-3.5 py-2 rounded-lg bg-[var(--peach)] text-[var(--ink)] font-bold text-xs flex items-center gap-1.5 shrink-0"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Template</span>
                </button>
              </div>

              {/* Upload Drop Zone */}
              <label className="flex flex-col items-center justify-center p-6 rounded-xl border-2 border-dashed border-[var(--ink-border)] hover:bg-[var(--bg-surface)]/50 cursor-pointer transition-colors">
                <Upload className="w-8 h-8 text-[var(--sakura)] mb-2" />
                <span className="text-xs font-bold text-[var(--ink)] dark:text-[var(--text-main)]">
                  {fileName ? `Selected: ${fileName}` : 'Click or drop your filled Mock CSV file here'}
                </span>
                <span className="text-[11px] text-[var(--text-muted)] mt-1">Accepts .csv format</span>
                <input type="file" accept=".csv" onChange={handleCsvMockUpload} className="hidden" />
              </label>

              {/* Validation errors */}
              {validationErrors.length > 0 && (
                <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border-2 border-rose-300 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-200 space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    <span>Validation Errors ({validationErrors.length}):</span>
                  </div>
                  <ul className="list-disc pl-5 space-y-0.5 text-[11px]">
                    {validationErrors.slice(0, 4).map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Preview & Save */}
              {previewData && (
                <div className="p-4 rounded-xl bg-[var(--bg-surface)] border-2 border-[var(--ink-border)] space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold">
                      Parsed {previewData.length} mock tests from {fileName}:
                    </span>
                    <button
                      onClick={handleSaveCsvMocks}
                      disabled={validationErrors.length > 0}
                      className="manga-btn px-4 py-2 rounded-lg bg-[var(--mint)] text-[var(--ink)] font-bold text-xs flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Commit {previewData.length} Mocks to Database</span>
                    </button>
                  </div>
                  <div className="max-h-40 overflow-y-auto space-y-1 text-[11px]">
                    {previewData.slice(0, 5).map((m, i) => (
                      <div key={i} className="p-2 rounded bg-[var(--bg-panel)] flex justify-between">
                        <span className="font-semibold">{m.name}</span>
                        <span>{m.date}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Mistake CSV Import */}
          {activeTab === 'csv-mistake' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-[var(--bg-surface)] border-2 border-[var(--ink-border)] text-xs">
                <div>
                  <span className="font-bold text-[var(--ink)] dark:text-[var(--text-main)] block">
                    Download Official Mistake CSV Template
                  </span>
                  <p className="text-[var(--text-muted)] text-[11px]">
                    Includes columns for mock link, topic, question, rule to remember, and explanation.
                  </p>
                </div>
                <button
                  onClick={() => downloadTemplateFile('mistakes_template.csv', getMistakeCsvTemplate())}
                  className="manga-btn px-3.5 py-2 rounded-lg bg-[var(--mint)] text-[var(--ink)] font-bold text-xs flex items-center gap-1.5 shrink-0"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Template</span>
                </button>
              </div>

              {/* Upload Drop Zone */}
              <label className="flex flex-col items-center justify-center p-6 rounded-xl border-2 border-dashed border-[var(--ink-border)] hover:bg-[var(--bg-surface)]/50 cursor-pointer transition-colors">
                <Upload className="w-8 h-8 text-[var(--mint)] mb-2" />
                <span className="text-xs font-bold text-[var(--ink)] dark:text-[var(--text-main)]">
                  {fileName ? `Selected: ${fileName}` : 'Click or drop your filled Mistake CSV file here'}
                </span>
                <span className="text-[11px] text-[var(--text-muted)] mt-1">Accepts .csv format</span>
                <input type="file" accept=".csv" onChange={handleCsvMistakeUpload} className="hidden" />
              </label>

              {/* Preview & Save */}
              {previewData && (
                <div className="p-4 rounded-xl bg-[var(--bg-surface)] border-2 border-[var(--ink-border)] space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold">
                      Parsed {previewData.length} mistakes from {fileName}:
                    </span>
                    <button
                      onClick={handleSaveCsvMistakes}
                      className="manga-btn px-4 py-2 rounded-lg bg-[var(--sakura)] text-[var(--ink)] font-bold text-xs flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Commit {previewData.length} Mistakes to Database</span>
                    </button>
                  </div>
                  <div className="max-h-40 overflow-y-auto space-y-1 text-[11px]">
                    {previewData.slice(0, 5).map((m, i) => (
                      <div key={i} className="p-2 rounded bg-[var(--bg-panel)] flex justify-between">
                        <span className="font-semibold">{m.topic}: {m.ruleToRemember}</span>
                        <span>{m.mockName}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: JSON Backup & Templates */}
          {activeTab === 'json' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <button
                  onClick={() => downloadTemplateFile('mocks_template.json', getMockJsonTemplate(), 'application/json')}
                  className="p-3.5 rounded-xl bg-[var(--bg-surface)] border-2 border-[var(--ink-border)] flex items-center justify-between hover:bg-[var(--peach)]/20 transition-colors"
                >
                  <span className="font-bold">Download Mock JSON Template</span>
                  <Download className="w-4 h-4 text-[var(--peach)]" />
                </button>
                <button
                  onClick={() => downloadTemplateFile('mistakes_template.json', getMistakeJsonTemplate(), 'application/json')}
                  className="p-3.5 rounded-xl bg-[var(--bg-surface)] border-2 border-[var(--ink-border)] flex items-center justify-between hover:bg-[var(--sakura)]/20 transition-colors"
                >
                  <span className="font-bold">Download Mistake JSON Template</span>
                  <Download className="w-4 h-4 text-[var(--sakura)]" />
                </button>
              </div>

              <label className="flex flex-col items-center justify-center p-6 rounded-xl border-2 border-dashed border-[var(--ink-border)] hover:bg-[var(--bg-surface)]/50 cursor-pointer transition-colors">
                <FileCode className="w-8 h-8 text-[var(--teal)] mb-2" />
                <span className="text-xs font-bold text-[var(--ink)] dark:text-[var(--text-main)]">
                  {fileName ? `Selected: ${fileName}` : 'Upload Backup or Template JSON file'}
                </span>
                <span className="text-[11px] text-[var(--text-muted)] mt-1">Accepts .json format</span>
                <input type="file" accept=".json" onChange={handleJsonUpload} className="hidden" />
              </label>

              {previewData && (
                <div className="flex justify-end pt-2">
                  <button
                    onClick={handleSaveJson}
                    className="manga-btn px-6 py-2.5 rounded-xl bg-[var(--teal)] text-white font-bold text-xs flex items-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Restore & Commit JSON Data</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

