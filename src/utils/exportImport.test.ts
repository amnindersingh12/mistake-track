import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db, DEFAULT_SETTINGS, clearAllUserData } from '../db/db';
import {
  createBackupPayload,
  validateBackup,
  importDataFromJson,
  BACKUP_SCHEMA_VERSION,
  BackupPayload
} from './exportImport';

describe('Export / Import & Data Integrity', () => {
  beforeEach(async () => {
    await clearAllUserData();
    vi.restoreAllMocks();
  });

  const validSampleBackup: BackupPayload = {
    version: BACKUP_SCHEMA_VERSION,
    exportedAt: '2026-11-04T12:00:00.000Z',
    settings: {
      ...DEFAULT_SETTINGS,
      examName: 'SBI PO Prelims 2026'
    },
    mocks: [
      {
        id: 1,
        name: 'Mock Test 01',
        date: '2026-11-01',
        source: 'Testbook',
        attemptType: 'mock',
        sections: [
          {
            sectionId: 'quant',
            sectionName: 'Quantitative Aptitude',
            attempted: 25,
            correct: 22,
            wrong: 3,
            timeSpentSeconds: 1200,
            unattempted: 10,
            netScore: 21.25,
            accuracy: 88,
            marksLostNegative: 0.75
          }
        ],
        totalAttempted: 25,
        totalCorrect: 22,
        totalWrong: 3,
        totalUnattempted: 10,
        totalNetScore: 21.25,
        overallAccuracy: 88,
        totalMarksLostNegative: 0.75,
        totalTimeSpentSeconds: 1200
      }
    ],
    mistakes: [
      {
        id: 1,
        mockId: 1,
        mockName: 'Mock Test 01',
        sectionId: 'quant',
        sectionName: 'Quantitative Aptitude',
        topic: 'Percentage',
        questionNumber: 4,
        questionText: 'Find 15% of 240',
        myAnswer: '32',
        correctAnswer: '36',
        resultType: 'Wrong',
        errorTypes: ['Calculation mistake'],
        timeSpentSeconds: 50,
        idealTimeSeconds: 30,
        whatWentWrong: 'Calculation slip',
        correctSolution: '240 * 0.15 = 36',
        betterApproach: '10% (24) + 5% (12) = 36',
        ruleToRemember: 'Split percentages into 10% + 5%',
        difficulty: 'Easy',
        tags: ['user-logged'],
        status: 'New',
        interval: 1,
        consecutiveCorrect: 0,
        nextReviewDate: '2026-11-05',
        history: [],
        createdAt: '2026-11-01'
      }
    ],
    papers: [
      {
        id: 1,
        examName: 'SBI PO 2023 PYQ',
        year: 2023,
        isMemoryBased: false,
        totalTimeMinutes: 60,
        sections: DEFAULT_SETTINGS.sections,
        questions: [
          {
            id: 'q1',
            sectionId: 'quant',
            questionNumber: 1,
            text: 'Question 1 text',
            options: ['A', 'B', 'C', 'D'],
            correctOptionIndex: 0,
            topic: 'Percentage'
          }
        ],
        createdAt: '2026-11-01'
      }
    ],
    paperAttempts: [
      {
        id: 1,
        paperId: 1,
        mockId: 1,
        questionId: 'q1',
        sectionId: 'quant',
        topic: 'Percentage',
        selected: 0,
        correct: true,
        timeSpentSeconds: 45,
        attemptedAt: '2026-11-01T10:00:00.000Z'
      }
    ],
    tasks: [],
    profiles: [],
    images: [],
    importBatches: []
  };

  describe('createBackupPayload (Export)', () => {
    it('exports every Dexie table in a single atomic read transaction', async () => {
      await db.mocks.add(validSampleBackup.mocks[0]);
      await db.mistakes.add(validSampleBackup.mistakes[0]);
      await db.papers.add(validSampleBackup.papers[0]);
      await db.paperAttempts.add(validSampleBackup.paperAttempts[0]);

      const payload = await createBackupPayload();

      expect(payload.version).toBe(BACKUP_SCHEMA_VERSION);
      expect(payload.settings).toBeDefined();
      expect(payload.mocks.length).toBe(1);
      expect(payload.mocks[0].name).toBe('Mock Test 01');
      expect(payload.mistakes.length).toBe(1);
      expect(payload.mistakes[0].topic).toBe('Percentage');
      expect(payload.papers.length).toBe(1);
      expect(payload.paperAttempts.length).toBe(1);
      expect(Array.isArray(payload.tasks)).toBe(true);
      expect(Array.isArray(payload.profiles)).toBe(true);
      expect(Array.isArray(payload.images)).toBe(true);
      expect(Array.isArray(payload.importBatches)).toBe(true);
    });
  });

  describe('validateBackup (Strict Validation)', () => {
    it('accepts a valid full backup payload', () => {
      const json = JSON.stringify(validSampleBackup);
      const parsed = validateBackup(json);
      expect(parsed.version).toBe(BACKUP_SCHEMA_VERSION);
      expect(parsed.mocks.length).toBe(1);
      expect(parsed.mistakes.length).toBe(1);
    });

    it('rejects corrupt or malformed JSON without modifying data', () => {
      expect(() => validateBackup('{ malformed json ')).toThrow(/parsed/);
      expect(() => validateBackup('12345')).toThrow(/expected a JSON object/);
      expect(() => validateBackup('[]')).toThrow(/expected a JSON object/);
    });

    it('rejects unsupported schema version', () => {
      const badVersion = { ...validSampleBackup, version: 99 };
      expect(() => validateBackup(JSON.stringify(badVersion))).toThrow(/Unsupported backup version/);
    });

    it('rejects missing or invalid settings', () => {
      const noSettings = { ...validSampleBackup, settings: undefined as any };
      expect(() => validateBackup(JSON.stringify(noSettings))).toThrow(/missing valid settings/);

      const emptySections = { ...validSampleBackup, settings: { ...DEFAULT_SETTINGS, sections: [] } };
      expect(() => validateBackup(JSON.stringify(emptySections))).toThrow(/missing valid settings/);
    });

    it('rejects non-array collections or malformed records', () => {
      const badMocks = { ...validSampleBackup, mocks: 'not-an-array' as any };
      expect(() => validateBackup(JSON.stringify(badMocks))).toThrow(/must be an array/);

      const corruptRecord = { ...validSampleBackup, mocks: ['not-an-object'] as any };
      expect(() => validateBackup(JSON.stringify(corruptRecord))).toThrow(/must be a valid object/);
    });

    it('rejects empty backup containing 0 user records', () => {
      expect(() => validateBackup('')).toThrow(/empty/);
      expect(() => validateBackup('   ')).toThrow(/empty/);

      const zeroRecords: BackupPayload = {
        version: BACKUP_SCHEMA_VERSION,
        exportedAt: '2026-11-04T12:00:00.000Z',
        settings: DEFAULT_SETTINGS,
        mocks: [],
        mistakes: [],
        papers: [],
        paperAttempts: [],
        tasks: [],
        profiles: [],
        images: [],
        importBatches: []
      };
      expect(() => validateBackup(JSON.stringify(zeroRecords))).toThrow(/contains no user records/);
    });
  });

  describe('importDataFromJson & applyBackup (Atomic Transaction & Rollback)', () => {
    it('corrupt or empty backup NEVER deletes or wipes existing data', async () => {
      // Seed existing data
      await db.mocks.add(validSampleBackup.mocks[0]);
      await db.mistakes.add(validSampleBackup.mistakes[0]);

      expect(await db.mocks.count()).toBe(1);
      expect(await db.mistakes.count()).toBe(1);

      // Attempt corrupt backup
      await expect(importDataFromJson('{ broken json', 'replace', false)).rejects.toThrow();

      // Verify data is completely intact
      expect(await db.mocks.count()).toBe(1);
      expect(await db.mistakes.count()).toBe(1);

      // Attempt empty backup
      await expect(importDataFromJson('', 'replace', false)).rejects.toThrow();
      expect(await db.mocks.count()).toBe(1);
      expect(await db.mistakes.count()).toBe(1);

      // Attempt zero-record payload
      const emptyPayload = JSON.stringify({
        version: BACKUP_SCHEMA_VERSION,
        settings: DEFAULT_SETTINGS,
        mocks: [],
        mistakes: [],
        papers: [],
        paperAttempts: [],
        tasks: [],
        profiles: [],
        images: [],
        importBatches: []
      });
      await expect(importDataFromJson(emptyPayload, 'replace', false)).rejects.toThrow(/contains no user records/);
      expect(await db.mocks.count()).toBe(1);
      expect(await db.mistakes.count()).toBe(1);
    });

    it('requests user confirmation before replace restore and aborts if declined', async () => {
      await db.mocks.add(validSampleBackup.mocks[0]);

      // Mock user declining confirmation
      vi.spyOn(window, 'confirm').mockReturnValue(false);

      const json = JSON.stringify(validSampleBackup);
      await expect(importDataFromJson(json, 'replace', true)).rejects.toThrow(/cancelled/);

      // Data is untouched
      expect(await db.mocks.count()).toBe(1);
    });

    it('applies replace mode in an atomic transaction when confirmed', async () => {
      await db.mocks.add({ ...validSampleBackup.mocks[0], name: 'Old Mock' });

      vi.spyOn(window, 'confirm').mockReturnValue(true);

      const json = JSON.stringify(validSampleBackup);
      const res = await importDataFromJson(json, 'replace', true);

      expect(res.mocks).toBe(1);
      expect(res.mistakes).toBe(1);

      const currentMocks = await db.mocks.toArray();
      expect(currentMocks.length).toBe(1);
      expect(currentMocks[0].name).toBe('Mock Test 01');
    });

    it('applies merge mode preserving non-conflicting records', async () => {
      await db.mocks.add({ ...validSampleBackup.mocks[0], id: 10, name: 'Existing Mock 10' });

      const json = JSON.stringify(validSampleBackup);
      const res = await importDataFromJson(json, 'merge', false);

      expect(res.mode).toBe('merge');
      const allMocks = await db.mocks.toArray();
      expect(allMocks.length).toBe(2);
      expect(allMocks.some((m) => m.name === 'Existing Mock 10')).toBe(true);
      expect(allMocks.some((m) => m.name === 'Mock Test 01')).toBe(true);
    });
  });
});
