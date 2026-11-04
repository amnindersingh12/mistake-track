import React, { useState, useEffect } from 'react';
import {
  ExamSettings,
  MockTest,
  MistakeEntry,
  StudyBridgeImportPayload,
  ResultType,
  Difficulty,
  FullMockScanResult,
  SectionPerformance
} from '../types';
import { db } from '../db/db';
import {
  getMockCsvTemplate,
  getMistakeCsvTemplate,
  getMockJsonTemplate,
  getMistakeJsonTemplate,
  downloadTemplateFile,
  parseCsvRows,
  parseMockCsv,
  parseMistakeCsv,
  parseTestbookPastedText,
  parseTimeString,
  QUESTION_MISTAKE_REASONS,
  getScannedQuestionStatus,
  ParsedPasteResult
} from '../utils/dataIntake';
import { Mascot } from './Mascot';
import { applyBackup, BackupPayload, summarizeBackup, validateBackup } from '../utils/exportImport';
import { getTodayDateStr } from '../utils/srs';
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
  ChevronUp,
  Layers,
  Search,
  BookOpen
} from 'lucide-react';

interface DataIntakeModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: ExamSettings;
  onSuccess: (msg: string) => void;
  initialImportPayload?: StudyBridgeImportPayload | null;
  onImportAck?: (id: string, status: 'saved' | 'cancelled') => void;
}

type TabType = 'paste' | 'csv-mock' | 'csv-mistake' | 'json' | 'fullscan';

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
  const [pendingBackup, setPendingBackup] = useState<BackupPayload | null>(null);
  const [pendingBackupError, setPendingBackupError] = useState<string | null>(null);

  // Full Mock Scan State
  const [fullScanData, setFullScanData] = useState<FullMockScanResult | null>(null);
  const [fullScanMockName, setFullScanMockName] = useState('');
  const [fullScanDate, setFullScanDate] = useState(getTodayDateStr());
  const [selectedMistakeNumbers, setSelectedMistakeNumbers] = useState<Set<number>>(new Set());
  const [questionMistakeReasons, setQuestionMistakeReasons] = useState<Record<number, string[]>>({});
  const [selectedSectionFilter, setSelectedSectionFilter] = useState('All');
  const [questionSearch, setQuestionSearch] = useState('');
  const [expandedQuestionNumber, setExpandedQuestionNumber] = useState<number | null>(null);
  const [isDuplicateMock, setIsDuplicateMock] = useState(false);
  const [isSavingFullScan, setIsSavingFullScan] = useState(false);

  // Handle incoming StudyBridge payload
  useEffect(() => {
    if (isOpen && initialImportPayload) {
      // Mode D: Full Mock Scan
      if (initialImportPayload.mode === 'fullscan' && initialImportPayload.scanData) {
        const sd = initialImportPayload.scanData;
        setFullScanData(sd);
        setFullScanMockName(sd.mockName || sd.examName || initialImportPayload.source?.title || 'Testbook Full Mock');
        setFullScanDate(initialImportPayload.capturedAt ? initialImportPayload.capturedAt.slice(0, 10) : getTodayDateStr());

        const initialCandidateSet = new Set<number>();
        const initialReasons: Record<number, string[]> = {};
        (sd.questions || []).forEach((q) => {
          const status = getScannedQuestionStatus(q);
          if (q.isMistakeCandidate ?? (status === 'Wrong' || status === 'Skipped')) {
            initialCandidateSet.add(q.questionNumber);
            initialReasons[q.questionNumber] = ['Conceptual gap'];
          }
        });

        setSelectedMistakeNumbers(initialCandidateSet);
        setQuestionMistakeReasons(initialReasons);
        setActiveTab('fullscan');
        return;
      }

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
          date: getTodayDateStr(),
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
          date: getTodayDateStr(),
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

  // Check for duplicate mocks in Dexie by name and date
  useEffect(() => {
    async function checkDuplicate() {
      if (!isOpen || activeTab !== 'fullscan' || !fullScanMockName.trim() || !fullScanDate) {
        setIsDuplicateMock(false);
        return;
      }
      try {
        const matches = await db.mocks.where('name').equalsIgnoreCase(fullScanMockName.trim()).toArray();
        setIsDuplicateMock(matches.some((m) => m.date === fullScanDate));
      } catch {
        setIsDuplicateMock(false);
      }
    }
    checkDuplicate();
  }, [isOpen, activeTab, fullScanMockName, fullScanDate]);

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
      mockName: m.mockName || 'External / unlinked',
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
      nextReviewDate: getTodayDateStr(),
      history: [],
      createdAt: getTodayDateStr()
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

  // Full Mock Scan Save Handler (ACID Transaction across db.mocks & db.mistakes)
  const handleSaveFullScan = async () => {
    if (!fullScanData) return;
    setIsSavingFullScan(true);
    try {
      const sections: SectionPerformance[] = (fullScanData.sections || []).map((sec) => {
        const secConf = settings.sections.find(
          (s) => s.name.toLowerCase() === sec.sectionName.toLowerCase() || s.id.toLowerCase() === sec.sectionName.toLowerCase()
        ) || { totalQuestions: sec.questionCount, marksPerCorrect: 1, negativeMark: 0.25, id: sec.sectionName.toLowerCase().replace(/[^a-z0-9]/g, '_') };

        const attempted = sec.correctCount + sec.incorrectCount;
        const unattempted = sec.skippedCount ?? Math.max(0, sec.questionCount - attempted);
        const marksLost = Number((sec.incorrectCount * secConf.negativeMark).toFixed(2));
        const net = sec.marks !== undefined ? sec.marks : Number((sec.correctCount * secConf.marksPerCorrect - marksLost).toFixed(2));
        const acc = attempted > 0 ? Number(((sec.correctCount / attempted) * 100).toFixed(1)) : 0;

        return {
          sectionId: secConf.id || sec.sectionName.toLowerCase().replace(/[^a-z0-9]/g, '_'),
          sectionName: sec.sectionName,
          attempted,
          correct: sec.correctCount,
          wrong: sec.incorrectCount,
          timeSpentSeconds: 0,
          unattempted,
          netScore: net,
          accuracy: acc,
          marksLostNegative: marksLost
        };
      });

      const totAtt = sections.reduce((s, x) => s + x.attempted, 0);
      const totCorr = sections.reduce((s, x) => s + x.correct, 0);
      const totWrong = sections.reduce((s, x) => s + x.wrong, 0);
      const totUnatt = sections.reduce((s, x) => s + x.unattempted, 0);
      const totNet = fullScanData.overallScore !== undefined ? fullScanData.overallScore : Number(sections.reduce((s, x) => s + x.netScore, 0).toFixed(2));
      const totAcc = totAtt > 0 ? Number(((totCorr / totAtt) * 100).toFixed(1)) : 0;
      const totNeg = Number(sections.reduce((s, x) => s + x.marksLostNegative, 0).toFixed(2));

      const mockRecord: Omit<MockTest, 'id'> = {
        name: fullScanMockName.trim() || 'Testbook Full Mock Scan',
        date: fullScanDate || getTodayDateStr(),
        source: initialImportPayload?.source?.platform || 'Testbook',
        attemptType: 'mock',
        sections,
        totalAttempted: totAtt,
        totalCorrect: totCorr,
        totalWrong: totWrong,
        totalUnattempted: totUnatt,
        totalNetScore: totNet,
        overallAccuracy: totAcc,
        totalMarksLostNegative: totNeg,
        totalTimeSpentSeconds: Math.round((fullScanData.scanDurationMs || 0) / 1000),
        notes: `Imported via StudyBridge V4 Full Mock Scan from ${initialImportPayload?.source?.title || 'Testbook'}`
      };

      const selectedQuestions = (fullScanData.questions || []).filter((q) => selectedMistakeNumbers.has(q.questionNumber));
      const todayStr = getTodayDateStr();

      // Single ACID transaction saving mock and selected mistakes
      await db.transaction('rw', [db.mocks, db.mistakes], async () => {
        const mockId = (await db.mocks.add(mockRecord as MockTest)) as number;

        if (selectedQuestions.length > 0) {
          const mistakeEntries: MistakeEntry[] = selectedQuestions.map((q) => {
            const qStatus = getScannedQuestionStatus(q);
            const resultType: ResultType = qStatus === 'Skipped' ? 'Left unattempted' : qStatus === 'Correct' ? 'Correct-but-slow' : 'Wrong';
            const reasons = questionMistakeReasons[q.questionNumber] || ['Conceptual gap'];
            const formattedOptions = q.options?.map((opt) =>
              `${opt.index + 1}. ${opt.text}${opt.isCorrect ? ' [Correct]' : ''}${opt.isSelected ? ' [Selected]' : ''}`
            ).join('\n') || '';

            return {
              mockId,
              mockName: mockRecord.name,
              attemptType: 'mock',
              sectionId: q.section.toLowerCase().replace(/[^a-z0-9]/g, '_'),
              sectionName: q.section,
              topic: q.topic || q.section || 'General',
              subtopic: '',
              questionNumber: q.questionNumber,
              questionText: q.questionText + (formattedOptions ? '\n\nOptions:\n' + formattedOptions : ''),
              questionImage: q.questionImage,
              myAnswer: q.selectedAnswer || (qStatus === 'Skipped' ? 'Left unattempted' : 'Not marked'),
              correctAnswer: q.correctAnswer || (q.explanation ? 'See explanation' : 'Not captured'),
              resultType,
              errorTypes: reasons.length > 0 ? reasons : ['Conceptual gap'],
              timeSpentSeconds: q.timeTaken ? parseTimeString(q.timeTaken).seconds : 60,
              idealTimeSeconds: q.avgTime ? parseTimeString(q.avgTime).seconds : 45,
              whatWentWrong: q.statusBadge ? `Status: ${q.statusBadge}` : 'Full scan mistake capture',
              correctSolution: q.explanation || '',
              betterApproach: '',
              ruleToRemember: `Review key concept in ${q.topic || q.section}.`,
              difficulty: 'Medium',
              tags: ['studybridge-v4', 'fullscan', q.section.toLowerCase().replace(/[^a-z0-9]/g, '-')],
              status: 'New',
              interval: 1,
              consecutiveCorrect: 0,
              nextReviewDate: todayStr,
              history: [],
              createdAt: todayStr
            };
          });

          await db.mistakes.bulkAdd(mistakeEntries);
        }
      });

      if (initialImportPayload?.id && onImportAck) {
        onImportAck(initialImportPayload.id, 'saved');
      }
      onSuccess(`Successfully saved "${mockRecord.name}" with ${selectedQuestions.length} mistake(s)!`);
      onClose();
    } catch (err: any) {
      console.error('Failed to save fullscan mock:', err);
      alert(`Save failed: ${err?.message || 'Database error'}`);
    } finally {
      setIsSavingFullScan(false);
    }
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
      const parsed = parseMockCsv(text, settings);
      setValidationErrors(parsed.errors);
      setPreviewData(parsed.records);
    };
    reader.readAsText(file);
  };

  // Commit CSV Mocks. The parser uses the active section config, not a fixed 100-question layout.
  const handleSaveCsvMocks = async () => {
    if (!previewData || previewData.length === 0) return;
    await db.transaction('rw', db.mocks, async () => {
      await db.mocks.bulkAdd(previewData as MockTest[]);
    });
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
      const parsed = parseMistakeCsv(evt.target?.result as string);
      setValidationErrors(parsed.errors);
      setPreviewData(parsed.records);
    };
    reader.readAsText(file);
  };

  // Commit CSV Mistakes
  const handleSaveCsvMistakes = async () => {
    if (!previewData || previewData.length === 0) return;
    await db.mistakes.bulkAdd(previewData as MistakeEntry[]);
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
        const text = evt.target?.result as string;
        const json = JSON.parse(text);
        setPendingBackup(null);
        setPendingBackupError(null);

        // Full backup or /my-data bundle: validate and preview before any write.
        if (json && typeof json === 'object' && !Array.isArray(json) && 'version' in json && 'settings' in json) {
          try {
            const payload = validateBackup(text);
            setPendingBackup(payload);
            setPreviewData(null);
          } catch (err: unknown) {
            setPendingBackupError(err instanceof Error ? err.message : 'Invalid backup file.');
          }
          return;
        }

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

  const handleConfirmBackup = async (mode: 'replace' | 'merge') => {
    if (!pendingBackup) return;
    try {
      const summary = summarizeBackup(pendingBackup);
      await applyBackup(pendingBackup, mode);
      const message = `${mode === 'replace' ? 'Replaced' : 'Merged'} ${summary.mocks} mocks, ${summary.mistakes} mistakes, ${summary.papers} papers and ${summary.images} images.`;
      onSuccess(message);
      setPendingBackup(null);
      onClose();
    } catch (err: unknown) {
      setPendingBackupError(err instanceof Error ? err.message : 'Import failed.');
    }
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
          {(fullScanData || activeTab === 'fullscan') && (
            <button
              onClick={() => {
                setActiveTab('fullscan');
                setPreviewData(null);
              }}
              className={`px-4 py-3 border-r-2 border-[var(--ink-border)] flex items-center gap-2 whitespace-nowrap transition-colors ${
                activeTab === 'fullscan'
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white font-extrabold'
                  : 'hover:bg-[var(--bg-panel)] text-[var(--sakura)]'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>Full Mock Scan ({fullScanData?.totalQuestions || 0} Qs)</span>
            </button>
          )}
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

              {pendingBackupError && (
                <div role="alert" className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border-2 border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-semibold">
                  {pendingBackupError}
                </div>
              )}

              {pendingBackup && (
                <div className="p-4 rounded-xl bg-[var(--bg-surface)] border-2 border-[var(--ink-border)] space-y-3 text-xs">
                  <h4 className="font-display font-bold text-sm">Backup preview — confirm before saving</h4>
                  <p className="text-[var(--text-muted)]">
                    {summarizeBackup(pendingBackup).mocks} mocks • {summarizeBackup(pendingBackup).mistakes} mistakes •{' '}
                    {summarizeBackup(pendingBackup).papers} papers • {summarizeBackup(pendingBackup).paperAttempts} paper responses •{' '}
                    {summarizeBackup(pendingBackup).images} images
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleConfirmBackup('replace')}
                      className="manga-btn px-4 py-2 rounded-xl bg-[var(--peach)] text-[var(--ink)] font-bold"
                    >
                      Replace current data
                    </button>
                    <button
                      type="button"
                      onClick={() => handleConfirmBackup('merge')}
                      className="manga-btn px-4 py-2 rounded-xl bg-[var(--mint)] text-[var(--ink)] font-bold"
                    >
                      Merge by id
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingBackup(null)}
                      className="px-4 py-2 rounded-xl border border-[var(--ink-border)] font-bold"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

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

          {/* TAB 5: Full Mock Scan Review */}
          {activeTab === 'fullscan' && fullScanData && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* Top Banner with Provenance */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-purple-950/50 via-slate-900 to-indigo-950/50 border-2 border-purple-500/40 text-xs flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-md">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 font-extrabold text-sm text-purple-200">
                    <Layers className="w-4 h-4 text-pink-400" />
                    <span>StudyBridge V4 Full Mock Scan Preview</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/20 border border-purple-400/40 text-purple-300 font-mono">
                      {fullScanData.totalQuestions} Questions Collected
                    </span>
                  </div>
                  <p className="text-[11px] text-purple-300/80">
                    Source: <strong>{initialImportPayload?.source?.title || 'Testbook'}</strong>
                    {fullScanData.scanDurationMs ? ` • Scan duration: ${(fullScanData.scanDurationMs / 1000).toFixed(1)}s` : ''}
                  </p>
                </div>

                {isDuplicateMock && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 border border-amber-500/50 text-amber-300 text-xs font-bold">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    <span>A mock with this name & date already exists!</span>
                  </div>
                )}
              </div>

              {/* Editable Mock Meta Card */}
              <div className="p-4 rounded-xl bg-[var(--bg-surface)] border-2 border-[var(--ink-border)] space-y-4">
                <h4 className="font-display text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  Mock Test Overview & Metadata
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-[var(--text-muted)] block mb-1">
                      Mock Test Name
                    </label>
                    <input
                      type="text"
                      value={fullScanMockName}
                      onChange={(e) => setFullScanMockName(e.target.value)}
                      className="w-full text-xs font-bold p-2.5 rounded-lg bg-[var(--bg-panel)] border-2 border-[var(--ink-border)] focus:outline-none focus:ring-2 focus:ring-[var(--sakura)]"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-[var(--text-muted)] block mb-1">
                      Attempt Date
                    </label>
                    <input
                      type="date"
                      value={fullScanDate}
                      onChange={(e) => setFullScanDate(e.target.value)}
                      className="w-full text-xs font-bold p-2.5 rounded-lg bg-[var(--bg-panel)] border-2 border-[var(--ink-border)] focus:outline-none focus:ring-2 focus:ring-[var(--sakura)]"
                    />
                  </div>
                </div>

                {/* Score & Derived Metrics Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                  <div className="p-2.5 rounded-lg bg-[var(--bg-panel)] border border-[var(--ink-border)]">
                    <span className="text-[10px] text-[var(--text-muted)] font-bold block">Overall Marks</span>
                    <span className="text-base font-extrabold text-[var(--peach)] font-mono">
                      {fullScanData.overallScore ?? '—'}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-[var(--bg-panel)] border border-[var(--ink-border)]">
                    <span className="text-[10px] text-[var(--text-muted)] font-bold block">Total Questions</span>
                    <span className="text-base font-extrabold text-[var(--text-main)] font-mono">
                      {fullScanData.totalQuestions}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-[var(--bg-panel)] border border-[var(--ink-border)]">
                    <span className="text-[10px] text-[var(--text-muted)] font-bold block">Selected Mistakes</span>
                    <span className="text-base font-extrabold text-[var(--rose)] font-mono">
                      {selectedMistakeNumbers.size}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-[var(--bg-panel)] border border-[var(--ink-border)]">
                    <span className="text-[10px] text-[var(--text-muted)] font-bold block">Sections</span>
                    <span className="text-base font-extrabold text-[var(--mint)] font-mono">
                      {fullScanData.sections?.length || 0}
                    </span>
                  </div>
                </div>
              </div>

              {/* Section Performance Summary Table */}
              {fullScanData.sections && fullScanData.sections.length > 0 && (
                <div className="p-4 rounded-xl bg-[var(--bg-surface)] border-2 border-[var(--ink-border)] space-y-3">
                  <h4 className="font-display text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                    Section Breakdown
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead>
                        <tr className="border-b border-[var(--ink-border)] text-[var(--text-muted)]">
                          <th className="py-2 px-2.5">Section</th>
                          <th className="py-2 px-2.5 text-center">Questions</th>
                          <th className="py-2 px-2.5 text-center text-[var(--mint)]">Correct</th>
                          <th className="py-2 px-2.5 text-center text-[var(--rose)]">Incorrect</th>
                          <th className="py-2 px-2.5 text-center text-[var(--peach)]">Skipped</th>
                          <th className="py-2 px-2.5 text-right font-mono">Marks</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--ink-border)] font-mono">
                        {fullScanData.sections.map((sec, idx) => (
                          <tr key={`${sec.sectionName}-${idx}`} className="hover:bg-[var(--bg-panel)]/40 transition-colors">
                            <td className="py-2 px-2.5 font-sans font-bold text-[var(--text-main)]">{sec.sectionName}</td>
                            <td className="py-2 px-2.5 text-center">{sec.questionCount}</td>
                            <td className="py-2 px-2.5 text-center text-[var(--mint)]">{sec.correctCount}</td>
                            <td className="py-2 px-2.5 text-center text-[var(--rose)]">{sec.incorrectCount}</td>
                            <td className="py-2 px-2.5 text-center text-[var(--peach)]">{sec.skippedCount}</td>
                            <td className="py-2 px-2.5 text-right font-bold text-[var(--peach)]">{sec.marks}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Question Library Browser & Mistake Selector */}
              <div className="p-4 rounded-xl bg-[var(--bg-surface)] border-2 border-[var(--ink-border)] space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <h4 className="font-display text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-[var(--sakura)]" />
                      <span>Question Library & Mistake Tagger</span>
                    </h4>
                    <p className="text-[11px] text-[var(--text-muted)]">
                      Select questions to import as mistakes in your Spaced Repetition Notebook.
                    </p>
                  </div>

                  {/* Bulk Select / Deselect Controls */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const newSet = new Set(selectedMistakeNumbers);
                        (fullScanData.questions || []).forEach((q) => {
                          const status = getScannedQuestionStatus(q);
                          if (status === 'Wrong' || status === 'Skipped') {
                            newSet.add(q.questionNumber);
                          }
                        });
                        setSelectedMistakeNumbers(newSet);
                      }}
                      className="px-2.5 py-1 text-[10.5px] font-bold rounded-md bg-[var(--bg-panel)] border border-[var(--ink-border)] text-[var(--text-main)] hover:border-[var(--sakura)] transition-colors"
                    >
                      Select All Incorrect
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedMistakeNumbers(new Set())}
                      className="px-2.5 py-1 text-[10.5px] font-bold rounded-md bg-[var(--bg-panel)] border border-[var(--ink-border)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors"
                    >
                      Clear Selection
                    </button>
                  </div>
                </div>

                {/* Filter and Search Bar */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                    <input
                      type="text"
                      placeholder="Search question text, numbers, or topics..."
                      value={questionSearch}
                      onChange={(e) => setQuestionSearch(e.target.value)}
                      className="w-full text-xs pl-8 pr-3 py-2 rounded-lg bg-[var(--bg-panel)] border border-[var(--ink-border)] focus:outline-none focus:ring-1 focus:ring-[var(--sakura)] text-[var(--text-main)]"
                    />
                  </div>

                  {/* Section Tabs */}
                  <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
                    {['All', ...(fullScanData.sections || []).map((s) => s.sectionName)].map((sec) => (
                      <button
                        key={sec}
                        type="button"
                        onClick={() => setSelectedSectionFilter(sec)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${
                          selectedSectionFilter === sec
                            ? 'bg-[var(--sakura)] text-white shadow-sm'
                            : 'bg-[var(--bg-panel)] text-[var(--text-muted)] border border-[var(--ink-border)] hover:text-[var(--text-main)]'
                        }`}
                      >
                        {sec}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Question List */}
                <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                  {(fullScanData.questions || [])
                    .filter((q) => {
                      if (selectedSectionFilter !== 'All' && q.section !== selectedSectionFilter) return false;
                      if (!questionSearch.trim()) return true;
                      const term = questionSearch.toLowerCase();
                      return (
                        String(q.questionNumber).includes(term) ||
                        q.questionText.toLowerCase().includes(term) ||
                        (q.explanation && q.explanation.toLowerCase().includes(term)) ||
                        (q.section && q.section.toLowerCase().includes(term))
                      );
                    })
                    .map((q) => {
                      const isSelected = selectedMistakeNumbers.has(q.questionNumber);
                      const status = getScannedQuestionStatus(q);
                      const isExpanded = expandedQuestionNumber === q.questionNumber;
                      const reasons = questionMistakeReasons[q.questionNumber] || ['Conceptual gap'];

                      return (
                        <div
                          key={`q-${q.section}-${q.questionNumber}`}
                          className={`p-3 rounded-xl border-2 transition-all ${
                            isSelected
                              ? 'bg-purple-950/20 border-purple-400/60 dark:bg-purple-950/40'
                              : 'bg-[var(--bg-panel)] border-[var(--ink-border)] opacity-85 hover:opacity-100'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            {/* Checkbox & Header */}
                            <label className="flex items-start gap-2.5 cursor-pointer flex-1">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => {
                                  const next = new Set(selectedMistakeNumbers);
                                  if (e.target.checked) {
                                    next.add(q.questionNumber);
                                    if (!questionMistakeReasons[q.questionNumber]) {
                                      setQuestionMistakeReasons({
                                        ...questionMistakeReasons,
                                        [q.questionNumber]: ['Conceptual gap']
                                      });
                                    }
                                  } else {
                                    next.delete(q.questionNumber);
                                  }
                                  setSelectedMistakeNumbers(next);
                                }}
                                className="mt-1 w-4 h-4 rounded border-2 border-[var(--ink-border)] text-purple-600 focus:ring-purple-500 cursor-pointer"
                              />

                              <div className="space-y-1 flex-1">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="font-extrabold text-xs text-[var(--text-main)] font-mono">
                                    Q{q.questionNumber}
                                  </span>
                                  <span className="text-[10px] px-2 py-0.5 rounded bg-[var(--bg-surface)] border border-[var(--ink-border)] text-[var(--text-muted)] font-semibold">
                                    {q.section}
                                  </span>
                                  <span
                                    className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                                      status === 'Correct'
                                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                        : status === 'Wrong'
                                        ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                                        : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                                    }`}
                                  >
                                    {status}
                                  </span>
                                  <span
                                    className={`text-[9.5px] px-1.5 py-0.5 rounded font-mono ${
                                      q.solutionStatus === 'captured'
                                        ? 'bg-purple-500/15 text-purple-300'
                                        : 'bg-slate-700/30 text-slate-400'
                                    }`}
                                  >
                                    {q.solutionStatus === 'captured' ? '✓ Solution' : 'No Solution'}
                                  </span>
                                  {q.marks !== undefined && (
                                    <span className="text-[10px] font-mono text-[var(--text-muted)] ml-auto">
                                      Marks: {q.marks}
                                    </span>
                                  )}
                                </div>

                                <p className="text-xs text-[var(--text-main)] line-clamp-2 leading-relaxed">
                                  {q.questionText}
                                </p>
                              </div>
                            </label>

                            {/* Expand / Collapse Button */}
                            <button
                              type="button"
                              onClick={() => setExpandedQuestionNumber(isExpanded ? null : q.questionNumber)}
                              className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors"
                              title={isExpanded ? 'Collapse question details' : 'Expand question details'}
                            >
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>
                          </div>

                          {/* Expanded Details: Options & Explanation */}
                          {isExpanded && (
                            <div className="mt-3 pt-3 border-t border-[var(--ink-border)] space-y-2.5 text-xs">
                              {q.options && q.options.length > 0 && (
                                <div className="space-y-1">
                                  <span className="text-[10.5px] font-bold text-[var(--text-muted)] uppercase tracking-wider block">
                                    Options:
                                  </span>
                                  <div className="grid grid-cols-1 gap-1">
                                    {q.options.map((opt) => (
                                      <div
                                        key={opt.index}
                                        className={`p-2 rounded-lg text-xs flex items-center justify-between border ${
                                          opt.isCorrect
                                            ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-300 font-semibold'
                                            : opt.isSelected
                                            ? 'bg-rose-950/20 border-rose-500/40 text-rose-300'
                                            : 'bg-[var(--bg-surface)] border-[var(--ink-border)] text-[var(--text-main)]'
                                        }`}
                                      >
                                        <span>
                                          <strong className="mr-1.5">{opt.index + 1}.</strong> {opt.text}
                                        </span>
                                        {opt.isCorrect && <span className="text-[10px] text-emerald-400 font-bold">✓ Correct</span>}
                                        {opt.isSelected && !opt.isCorrect && <span className="text-[10px] text-rose-400 font-bold">✗ Selected</span>}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {q.explanation && (
                                <div className="p-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--ink-border)] space-y-1">
                                  <span className="text-[10.5px] font-bold text-[var(--peach)] uppercase tracking-wider block">
                                    Explanation:
                                  </span>
                                  <p className="text-xs text-[var(--text-main)] whitespace-pre-line leading-relaxed">
                                    {q.explanation}
                                  </p>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Mistake Classification Chips (Shown when checked) */}
                          {isSelected && (
                            <div className="mt-3 pt-2.5 border-t border-purple-500/30 space-y-1.5">
                              <span className="text-[10.5px] font-bold text-purple-300 block">
                                Mistake Reason Classification:
                              </span>
                              <div className="flex flex-wrap gap-1.5">
                                {QUESTION_MISTAKE_REASONS.map((reason) => {
                                  const hasReason = reasons.includes(reason);
                                  return (
                                    <button
                                      key={reason}
                                      type="button"
                                      onClick={() => {
                                        const current = questionMistakeReasons[q.questionNumber] || [];
                                        const updated = current.includes(reason)
                                          ? current.filter((r) => r !== reason)
                                          : [...current, reason];
                                        setQuestionMistakeReasons({
                                          ...questionMistakeReasons,
                                          [q.questionNumber]: updated.length > 0 ? updated : ['Conceptual gap']
                                        });
                                      }}
                                      className={`px-2.5 py-1 rounded-md text-[10.5px] font-bold transition-all ${
                                        hasReason
                                          ? 'bg-purple-600 text-white shadow-sm scale-102'
                                          : 'bg-[var(--bg-surface)] text-[var(--text-muted)] border border-[var(--ink-border)] hover:border-purple-400'
                                      }`}
                                    >
                                      {reason}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Bottom Confirmation Bar */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t-2 border-[var(--ink-border)]">
                <div className="text-xs text-[var(--text-muted)]">
                  <span>Saving will create <strong>1 Mock</strong> and <strong>{selectedMistakeNumbers.size} Mistakes</strong> in your database.</span>
                </div>

                <div className="flex items-center gap-2.5 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2.5 rounded-xl border-2 border-[var(--ink-border)] text-xs font-bold text-[var(--text-muted)] hover:bg-[var(--bg-surface)] transition-colors flex-1 sm:flex-initial"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveFullScan}
                    disabled={isSavingFullScan || !fullScanMockName.trim()}
                    className="manga-btn px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 via-pink-600 to-rose-600 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 flex-1 sm:flex-initial"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>
                      {isSavingFullScan
                        ? 'Saving to Database...'
                        : `Confirm & Save Mock (${selectedMistakeNumbers.size} Mistakes)`}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

