import { describe, it, expect } from 'vitest';
import {
  parseTestbookPastedText,
  validateStudyBridgePayload,
  parseTimeString
} from './dataIntake';
import { DEFAULT_SETTINGS } from '../db/db';

describe('StudyBridge Data Intake & Parser', () => {
  describe('validateStudyBridgePayload', () => {
    it('accepts valid StudyBridge import message', () => {
      const msg = {
        schemaVersion: 1,
        type: 'STUDYBRIDGE_IMPORT',
        payload: {
          id: 'test-transfer-001',
          text: 'Quantitative Aptitude\nAttempted: 25 Correct: 22 Incorrect: 3',
          source: {
            platform: 'Testbook',
            url: 'https://testbook.com/test-series/sbi-po/analysis',
            title: 'SBI PO Live Mock 03'
          },
          capturedAt: '2026-11-04T12:00:00.000Z'
        }
      };
      const res = validateStudyBridgePayload(msg);
      expect(res.isValid).toBe(true);
      expect(res.payload?.id).toBe('test-transfer-001');
      expect(res.payload?.source.platform).toBe('Testbook');
    });

    it('rejects invalid schema or type', () => {
      expect(validateStudyBridgePayload(null).isValid).toBe(false);
      expect(validateStudyBridgePayload({ schemaVersion: 2, type: 'OTHER' }).isValid).toBe(false);
      expect(validateStudyBridgePayload({ schemaVersion: 1, type: 'STUDYBRIDGE_IMPORT', payload: { id: '', text: '' } }).isValid).toBe(false);
    });

    it('rejects payloads larger than 500 KB to avoid memory bloat', () => {
      const largeText = 'A'.repeat(500_001);
      const msg = {
        schemaVersion: 1,
        type: 'STUDYBRIDGE_IMPORT',
        payload: {
          id: 'too-big',
          text: largeText,
          source: { platform: 'Testbook', url: '', title: '' },
          capturedAt: '2026-11-04T12:00:00.000Z'
        }
      };
      const res = validateStudyBridgePayload(msg);
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('500 KB');
    });
  });

  describe('parseTimeString', () => {
    it('parses "18m 20s" format', () => {
      const res = parseTimeString('18m 20s');
      expect(res.minutes).toBe(18);
      expect(res.seconds).toBe(1100);
    });

    it('parses "75s" seconds format', () => {
      const res = parseTimeString('75s');
      expect(res.seconds).toBe(75);
      expect(res.minutes).toBe(1);
    });

    it('parses "19:40" MM:SS format', () => {
      const res = parseTimeString('19:40');
      expect(res.minutes).toBe(19);
      expect(res.seconds).toBe(1180);
    });
  });

  describe('parseTestbookPastedText - Mock Scorecard', () => {
    it('parses complete Testbook mock result text correctly', () => {
      const sample = `Testbook SBI PO Prelims Live Mock 03 Analysis
Quantitative Aptitude
Attempted: 28  Correct: 25  Incorrect: 3  Time: 18m 20s  Score: 24.25

Reasoning Ability
Attempted: 32  Correct: 30  Incorrect: 2  Time: 19m 15s  Score: 29.50

English Language
Attempted: 26  Correct: 22  Incorrect: 4  Time: 16m 40s  Score: 21.00

Total Score: 74.75 / 100
Accuracy: 88.37%
Rank: 1,420
Percentile: 94.2%`;

      const parsed = parseTestbookPastedText(sample, DEFAULT_SETTINGS);
      expect(parsed.contentType).toBe('mock');
      expect(parsed.mockName).toContain('Live Mock 03');
      expect(parsed.overallScore).toBe(74.75);
      expect(parsed.maxMarks).toBe(100);
      expect(parsed.overallAccuracy).toBe(88.37);
      expect(parsed.overallRank).toBe(1420);
      expect(parsed.overallPercentile).toBe(94.2);

      const quant = parsed.sections.find((s) => s.sectionId === 'quant');
      expect(quant).toBeDefined();
      expect(quant?.attempted).toBe(28);
      expect(quant?.correct).toBe(25);
      expect(quant?.wrong).toBe(3);
      expect(quant?.timeMinutes).toBe(18);
      expect(quant?.score).toBe(24.25);

      const reasoning = parsed.sections.find((s) => s.sectionId === 'reasoning');
      expect(reasoning?.attempted).toBe(32);
      expect(reasoning?.correct).toBe(30);

      const english = parsed.sections.find((s) => s.sectionId === 'english');
      expect(english?.attempted).toBe(26);
      expect(english?.correct).toBe(22);
      expect(parsed.rawText).toBe(sample);
    });

    it('preserves raw text and flags uncertain sections when data is missing', () => {
      const sparse = `Testbook Live Mock 05
Quantitative Aptitude: Attempted 20, Correct 18`;
      const parsed = parseTestbookPastedText(sparse, DEFAULT_SETTINGS);
      expect(parsed.contentType).toBe('mock');
      expect(parsed.rawText).toBe(sparse);
      // Reasoning and English were not in sparse text, so they are flagged uncertain
      expect(parsed.uncertainFields.some((f) => f.includes('missing'))).toBe(true);
    });
  });

  describe('parseTestbookPastedText - Mistake Review', () => {
    it('detects and parses single question / mistake analysis', () => {
      const mistakeSample = `Question 14
Quantitative Aptitude
Topic: Time & Work
Pipe A can fill a tank in 12 hours, and a leak empties in 15 hours. If full, how long for leak to empty?
Your Answer: 40 hrs (Incorrect)
Correct Answer: 60 hrs
Time Spent: 75 seconds
Ideal Time: 35 seconds
Explanation: Net emptying rate = 1/12 - 1/15 = 1/60 per hour, so 60 hours.
Shortcut: (A * B) / (B - A) = (12 * 15) / 3 = 60 hours.
Rule to Remember: For two opposing rates, use AB/(B-A) directly.`;

      const parsed = parseTestbookPastedText(mistakeSample, DEFAULT_SETTINGS);
      expect(parsed.contentType).toBe('mistake');
      expect(parsed.mistake).toBeDefined();
      expect(parsed.mistake?.questionNumber).toBe(14);
      expect(parsed.mistake?.sectionId).toBe('quant');
      expect(parsed.mistake?.topic).toContain('Time & Work');
      expect(parsed.mistake?.myAnswer).toContain('40 hrs');
      expect(parsed.mistake?.correctAnswer).toContain('60 hrs');
      expect(parsed.mistake?.resultType).toBe('Wrong');
      expect(parsed.mistake?.timeSpentSeconds).toBe(75);
      expect(parsed.mistake?.idealTimeSeconds).toBe(35);
      expect(parsed.mistake?.betterApproach).toContain('(A * B) / (B - A)');
      expect(parsed.mistake?.ruleToRemember).toContain('AB/(B-A)');
      expect(parsed.rawText).toBe(mistakeSample);
    });
  });

  describe('validateStudyBridgePayload - mode: fullscan', () => {
    it('accepts valid fullscan payload with scanData', () => {
      const msg = {
        schemaVersion: 1,
        type: 'STUDYBRIDGE_IMPORT',
        payload: {
          id: 'fullscan-001',
          mode: 'fullscan',
          text: 'SBI PO Live Mock 01 Full Scan',
          source: {
            platform: 'Testbook',
            url: 'https://testbook.com/test-series/sbi-po/solution',
            title: 'SBI PO Full Test'
          },
          capturedAt: '2026-11-04T12:00:00.000Z',
          scanData: {
            mockName: 'SBI PO Full Test 01',
            examName: 'SBI PO Prelims',
            overallScore: 68.5,
            maxScore: 100,
            totalQuestions: 100,
            sections: [
              {
                sectionName: 'Quantitative Aptitude',
                questionCount: 35,
                correctCount: 25,
                incorrectCount: 5,
                skippedCount: 5,
                marks: 23.75
              }
            ],
            questions: [
              {
                questionNumber: 1,
                section: 'Quantitative Aptitude',
                questionText: 'What is 15% of 240?',
                options: [
                  { index: 0, text: '36', isCorrect: true, isSelected: true },
                  { index: 1, text: '34' }
                ],
                selectedAnswer: '36',
                correctAnswer: '36',
                marks: 1,
                solutionStatus: 'captured',
                statusBadge: 'Correct'
              },
              {
                questionNumber: 2,
                section: 'Quantitative Aptitude',
                questionText: 'Speed of train is 60 km/h...',
                options: [
                  { index: 0, text: '120 m' },
                  { index: 1, text: '150 m', isCorrect: true }
                ],
                selectedAnswer: '120 m',
                correctAnswer: '150 m',
                marks: -0.25,
                solutionStatus: 'captured',
                statusBadge: 'Wrong'
              }
            ]
          }
        }
      };

      const res = validateStudyBridgePayload(msg);
      expect(res.isValid).toBe(true);
      expect(res.payload?.mode).toBe('fullscan');
      expect(res.payload?.scanData?.totalQuestions).toBe(100);
      expect(res.payload?.scanData?.questions.length).toBe(2);
      expect(res.payload?.scanData?.sections.length).toBe(1);
    });

    it('rejects fullscan when scanData is missing', () => {
      const msg = {
        schemaVersion: 1,
        type: 'STUDYBRIDGE_IMPORT',
        payload: {
          id: 'fullscan-missing-scandata',
          mode: 'fullscan',
          text: 'Scan without data',
          source: { platform: 'Testbook', url: '', title: '' }
        }
      };

      const res = validateStudyBridgePayload(msg);
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('missing scanData');
    });

    it('rejects fullscan when totalQuestions is missing or invalid', () => {
      const msg = {
        schemaVersion: 1,
        type: 'STUDYBRIDGE_IMPORT',
        payload: {
          id: 'fullscan-invalid-total',
          mode: 'fullscan',
          text: 'Scan invalid total',
          source: { platform: 'Testbook', url: '', title: '' },
          scanData: {
            totalQuestions: -1,
            sections: [],
            questions: []
          }
        }
      };

      const res = validateStudyBridgePayload(msg);
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('totalQuestions');
    });

    it('rejects fullscan when sections is not an array', () => {
      const msg = {
        schemaVersion: 1,
        type: 'STUDYBRIDGE_IMPORT',
        payload: {
          id: 'fullscan-bad-sections',
          mode: 'fullscan',
          text: 'Scan bad sections',
          source: { platform: 'Testbook', url: '', title: '' },
          scanData: {
            totalQuestions: 10,
            sections: 'not-an-array' as any,
            questions: []
          }
        }
      };

      const res = validateStudyBridgePayload(msg);
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('sections array');
    });

    it('rejects fullscan when questions is not an array', () => {
      const msg = {
        schemaVersion: 1,
        type: 'STUDYBRIDGE_IMPORT',
        payload: {
          id: 'fullscan-bad-questions',
          mode: 'fullscan',
          text: 'Scan bad questions',
          source: { platform: 'Testbook', url: '', title: '' },
          scanData: {
            totalQuestions: 10,
            sections: [],
            questions: null as any
          }
        }
      };

      const res = validateStudyBridgePayload(msg);
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('questions array');
    });

    it('falls back to mockName if text is omitted in fullscan mode', () => {
      const msg = {
        schemaVersion: 1,
        type: 'STUDYBRIDGE_IMPORT',
        payload: {
          id: 'fullscan-fallback-text',
          mode: 'fullscan',
          text: '',
          source: { platform: 'Testbook', url: '', title: '' },
          scanData: {
            mockName: 'IBPS PO Prelims Mock 02',
            totalQuestions: 100,
            sections: [],
            questions: []
          }
        }
      };

      const res = validateStudyBridgePayload(msg);
      expect(res.isValid).toBe(true);
      expect(res.payload?.text).toBe('IBPS PO Prelims Mock 02');
    });
  });
});
