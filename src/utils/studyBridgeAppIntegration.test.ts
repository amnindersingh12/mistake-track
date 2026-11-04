import { describe, it, expect, vi } from 'vitest';
import {
  validateStudyBridgePayload,
  parseTestbookPastedText
} from './dataIntake';
import { DEFAULT_SETTINGS } from '../db/db';
import { MockTest, MistakeEntry } from '../types';

describe('Study Application Integration Bridge', () => {
  it('validates and ingests StudyBridge import event', () => {
    const rawMessage = {
      schemaVersion: 1,
      type: 'STUDYBRIDGE_IMPORT',
      payload: {
        id: 'sb-test-12345',
        text: `Testbook SBI PO Prelims Live Mock 03 Analysis
Quantitative Aptitude
Attempted: 28  Correct: 25  Incorrect: 3  Time: 18m 20s  Score: 24.25

Reasoning Ability
Attempted: 32  Correct: 30  Incorrect: 2  Time: 19m 15s  Score: 29.50

English Language
Attempted: 26  Correct: 22  Incorrect: 4  Time: 16m 40s  Score: 21.00

Total Score: 74.75 / 100
Accuracy: 88.37%
Rank: 1,420
Percentile: 94.2%`,
        source: {
          platform: 'Testbook',
          url: 'https://testbook.com/test-series/sbi-po/analysis',
          title: 'SBI PO Prelims Live Mock 03'
        },
        capturedAt: '2026-11-04T12:00:00.000Z'
      }
    };

    // 1. Validate incoming event
    const validation = validateStudyBridgePayload(rawMessage);
    expect(validation.isValid).toBe(true);
    expect(validation.payload).toBeDefined();

    // 2. Invoke parser on payload text
    const parsed = parseTestbookPastedText(validation.payload!.text, DEFAULT_SETTINGS);
    expect(parsed.contentType).toBe('mock');
    expect(parsed.mockName).toContain('Live Mock 03');
    expect(parsed.overallScore).toBe(74.75);

    // 3. Transform to MockTest data model with user review
    let totalAttempted = 0;
    let totalCorrect = 0;
    let totalWrong = 0;
    let totalTime = 0;
    let totalNetScore = 0;

    const sections = parsed.sections.map((sec) => {
      const net = sec.score !== undefined ? sec.score : Number((sec.correct - sec.wrong * 0.25).toFixed(2));
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
        unattempted: 35 - sec.attempted,
        netScore: net,
        accuracy: Number(((sec.correct / sec.attempted) * 100).toFixed(1)),
        marksLostNegative: Number((sec.wrong * 0.25).toFixed(2))
      };
    });

    const mockRecord: Omit<MockTest, 'id'> = {
      name: parsed.mockName,
      date: parsed.date,
      source: parsed.source,
      attemptType: 'mock',
      overallRank: parsed.overallRank,
      overallPercentile: parsed.overallPercentile,
      sections,
      totalAttempted,
      totalCorrect,
      totalWrong,
      totalUnattempted: 100 - totalAttempted,
      totalNetScore: parsed.overallScore || Number(totalNetScore.toFixed(2)),
      overallAccuracy: parsed.overallAccuracy || Number(((totalCorrect / totalAttempted) * 100).toFixed(1)),
      totalMarksLostNegative: Number(sections.reduce((s, x) => s + x.marksLostNegative, 0).toFixed(2)),
      totalTimeSpentSeconds: totalTime,
      notes: `Imported via StudyBridge from ${validation.payload!.source.url}`
    };

    expect(mockRecord.totalAttempted).toBe(86);
    expect(mockRecord.totalCorrect).toBe(77);
    expect(mockRecord.totalWrong).toBe(9);
    expect(mockRecord.totalNetScore).toBe(74.75);
    expect(mockRecord.notes).toContain('https://testbook.com');
  });

  it('correctly parses and builds MistakeEntry for question-level selections', () => {
    const rawMistakeMessage = {
      schemaVersion: 1,
      type: 'STUDYBRIDGE_IMPORT',
      payload: {
        id: 'sb-mistake-999',
        text: `Question 12
Reasoning Ability
Topic: Syllogism
Statements: All cats are dogs. Some dogs are birds.
Conclusions:
I. Some cats are birds.
II. Some dogs are cats.
Your Answer: Only I follows (Incorrect)
Correct Answer: Only II follows
Time Taken: 45s
Ideal Time: 25s
Explanation: Since cats are a subset of dogs, some dogs are certainly cats (Conclusion II follows).
Shortcut: Draw immediate Venn intersection.
Rule to Remember: A universal affirmative (All A are B) converts partially to (Some B are A).`,
        source: {
          platform: 'Testbook',
          url: 'https://testbook.com/solutions/q12',
          title: 'Reasoning Ability Solution Analysis'
        },
        capturedAt: '2026-11-04T12:00:00.000Z'
      }
    };

    const validation = validateStudyBridgePayload(rawMistakeMessage);
    expect(validation.isValid).toBe(true);

    const parsed = parseTestbookPastedText(validation.payload!.text, DEFAULT_SETTINGS);
    expect(parsed.contentType).toBe('mistake');
    expect(parsed.mistake).toBeDefined();

    const m = parsed.mistake!;
    expect(m.questionNumber).toBe(12);
    expect(m.sectionId).toBe('reasoning');
    expect(m.topic).toBe('Syllogism');
    expect(m.myAnswer).toContain('Only I follows');
    expect(m.correctAnswer).toContain('Only II follows');
    expect(m.resultType).toBe('Wrong');
    expect(m.timeSpentSeconds).toBe(45);
    expect(m.idealTimeSeconds).toBe(25);
    expect(m.ruleToRemember).toContain('Some B are A');

    // Build mistake record
    const mistakeRecord: Omit<MistakeEntry, 'id'> = {
      mockId: 1,
      mockName: 'Testbook Reasoning Solution',
      sectionId: m.sectionId,
      sectionName: m.sectionName,
      topic: m.topic,
      questionNumber: m.questionNumber,
      questionText: m.questionText,
      myAnswer: m.myAnswer,
      correctAnswer: m.correctAnswer,
      resultType: m.resultType,
      errorTypes: ['Concept gap'],
      timeSpentSeconds: m.timeSpentSeconds,
      idealTimeSeconds: m.idealTimeSeconds,
      whatWentWrong: 'Misinterpreted Venn conversion rule.',
      correctSolution: m.correctSolution,
      betterApproach: m.betterApproach,
      ruleToRemember: m.ruleToRemember,
      difficulty: m.difficulty,
      tags: ['studybridge-import'],
      status: 'New',
      interval: 1,
      consecutiveCorrect: 0,
      nextReviewDate: '2026-11-04',
      history: [],
      createdAt: '2026-11-04'
    };

    expect(mistakeRecord.status).toBe('New');
    expect(mistakeRecord.interval).toBe(1);
    expect(mistakeRecord.ruleToRemember).toContain('Some B are A');
  });

  it('rejects invalid messages without mutating state or data', () => {
    const invalidMessages = [
      null,
      undefined,
      {},
      { schemaVersion: 2, type: 'STUDYBRIDGE_IMPORT' },
      { schemaVersion: 1, type: 'OTHER_TYPE' },
      { schemaVersion: 1, type: 'STUDYBRIDGE_IMPORT', payload: { id: '', text: '' } }
    ];

    for (const msg of invalidMessages) {
      const res = validateStudyBridgePayload(msg);
      expect(res.isValid).toBe(false);
      expect(res.payload).toBeUndefined();
    }
  });

  it('supports V2 Mode A: Import Result Summary payload with structured summaryData', () => {
    const summaryMsg = {
      schemaVersion: 1,
      type: 'STUDYBRIDGE_IMPORT',
      payload: {
        id: 'sb-sum-456',
        mode: 'summary',
        text: 'Testbook Result Summary',
        summaryData: {
          overallMarks: 85.93,
          examName: 'SBI CLERK',
          mockName: 'SBI Clerk Prelims Mock 01',
          sections: [
            {
              sectionName: 'Paper 1',
              questionCount: 80,
              correctCount: 27,
              incorrectCount: 9,
              skippedCount: 44,
              marks: 30.93
            },
            {
              sectionName: 'Paper 2',
              questionCount: 50,
              correctCount: 30,
              incorrectCount: 10,
              skippedCount: 10,
              marks: 55
            }
          ],
          derivedTotals: {
            totalQuestions: 130,
            totalCorrect: 57,
            totalIncorrect: 19,
            totalSkipped: 54,
            totalAttempted: 76,
            totalMarks: 85.93,
            accuracy: 75.0
          },
          missingFields: []
        },
        source: {
          platform: 'Testbook',
          url: 'https://testbook.com/analysis/sbi-clerk-01',
          title: 'SBI Clerk Prelims 01 Analysis'
        },
        capturedAt: '2026-11-04T12:00:00.000Z'
      }
    };

    const res = validateStudyBridgePayload(summaryMsg);
    expect(res.isValid).toBe(true);
    expect(res.payload?.mode).toBe('summary');
    expect(res.payload?.summaryData?.overallMarks).toBe(85.93);
    expect(res.payload?.summaryData?.sections).toHaveLength(2);
    expect(res.payload?.summaryData?.derivedTotals.totalQuestions).toBe(130);
  });

  it('supports V2 Mode B: Import Current Question with structured questionData and classification', () => {
    const questionMsg = {
      schemaVersion: 1,
      type: 'STUDYBRIDGE_IMPORT',
      payload: {
        id: 'sb-q-789',
        mode: 'question',
        text: 'Question 1: Geographical Indication tags...',
        questionData: {
          questionNumber: 1,
          section: 'Paper 1',
          questionText: 'Which products received GI tags?',
          options: [
            { index: 0, text: 'Rameswaram Fish', isCorrect: false },
            { index: 1, text: 'Puliyankudi Acid Lime', isCorrect: true }
          ],
          selectedAnswer: 'Left unattempted',
          correctAnswer: 'Puliyankudi Acid Lime',
          marks: 0,
          explanation: 'The correct answer is Puliyankudi Acid Lime.',
          statusBadge: 'Skipped',
          missingFields: []
        },
        source: {
          platform: 'Testbook',
          url: 'https://testbook.com/review/q1',
          title: 'Question 1 Review'
        },
        capturedAt: '2026-11-04T12:00:00.000Z'
      }
    };

    const res = validateStudyBridgePayload(questionMsg);
    expect(res.isValid).toBe(true);
    expect(res.payload?.mode).toBe('question');
    expect(res.payload?.questionData?.questionNumber).toBe(1);
    expect(res.payload?.questionData?.correctAnswer).toBe('Puliyankudi Acid Lime');
    expect(res.payload?.questionData?.explanation).toContain('Puliyankudi Acid Lime');
  });
});

