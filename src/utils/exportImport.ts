import { Table } from 'dexie';
import { db, DEFAULT_SETTINGS } from '../db/db';
import {
  CompressedImage,
  ExamProfile,
  ExamSettings,
  ImportBatch,
  MistakeEntry,
  MockTest,
  PaperAttempt,
  PaperTest,
  StudyTask
} from '../types';

export const BACKUP_SCHEMA_VERSION = 4;

export interface BackupImage {
  key?: string;
  ownerType?: 'mock' | 'mistake' | 'paper';
  ownerId?: number;
  field?: string;
  dataUrl: string;
  mimeType?: string;
}

export interface BackupPayload {
  version: number;
  exportedAt: string;
  settings: ExamSettings;
  mocks: MockTest[];
  mistakes: MistakeEntry[];
  papers: PaperTest[];
  paperAttempts: PaperAttempt[];
  tasks: StudyTask[];
  profiles: ExamProfile[];
  images: (CompressedImage | BackupImage)[];
  importBatches: ImportBatch[];
}

export interface BackupSummary {
  mocks: number;
  mistakes: number;
  papers: number;
  paperQuestions: number;
  paperAttempts: number;
  tasks: number;
  profiles: number;
  images: number;
  importBatches: number;
  mockCount: number;
  mistakeCount: number;
}

export type RestoreMode = 'replace' | 'merge';

export interface RestoreResult extends BackupSummary {
  mode: RestoreMode;
}

/**
 * Creates full backup payload in a single atomic read transaction across all 9 Dexie tables.
 */
export async function createBackupPayload(): Promise<BackupPayload> {
  const tables = [
    db.settings,
    db.mocks,
    db.mistakes,
    db.papers,
    db.paperAttempts,
    db.images,
    db.importBatches,
    db.tasks,
    db.profiles
  ];

  return await db.transaction('r', tables, async () => {
    const rawSettings = await db.settings.get('current');
    const settings = rawSettings || DEFAULT_SETTINGS;

    const [mocks, mistakes, papers, paperAttempts, images, importBatches, tasks, profiles] =
      await Promise.all([
        db.mocks.toArray(),
        db.mistakes.toArray(),
        db.papers.toArray(),
        db.paperAttempts.toArray(),
        db.images.toArray(),
        db.importBatches.toArray(),
        db.tasks.toArray(),
        db.profiles.toArray()
      ]);

    return {
      version: BACKUP_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      settings,
      mocks,
      mistakes,
      papers,
      paperAttempts,
      tasks,
      profiles,
      images,
      importBatches
    };
  });
}

export function summarizeBackup(payload: BackupPayload): BackupSummary {
  const mocks = payload.mocks.length;
  const mistakes = payload.mistakes.length;
  return {
    mocks,
    mistakes,
    papers: payload.papers.length,
    paperQuestions: payload.papers.reduce((count, paper) => count + (paper.questions || []).length, 0),
    paperAttempts: payload.paperAttempts.length,
    tasks: payload.tasks.length,
    profiles: payload.profiles.length,
    images: payload.images.length,
    importBatches: (payload.importBatches || []).length,
    mockCount: mocks,
    mistakeCount: mistakes
  };
}

function normalizeArray<T>(value: unknown, field: string): T[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    throw new Error(`Invalid backup: "${field}" must be an array.`);
  }
  for (let i = 0; i < value.length; i++) {
    const item = value[i];
    if (!item || typeof item !== 'object') {
      throw new Error(`Invalid backup: item ${i} in "${field}" must be a valid object.`);
    }
  }
  return value as T[];
}

/**
 * Validates a backup before any database operation. Empty, partial, or malformed JSON
 * is rejected here and therefore can never clear or modify user data.
 */
export function validateBackup(jsonContent: string): BackupPayload {
  if (!jsonContent || typeof jsonContent !== 'string' || !jsonContent.trim()) {
    throw new Error('Invalid JSON backup file: empty content.');
  }

  let raw: unknown;
  try {
    raw = JSON.parse(jsonContent);
  } catch {
    throw new Error('Invalid JSON backup file: the file could not be parsed.');
  }

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('Invalid backup file: expected a JSON object.');
  }

  const data = raw as Record<string, unknown>;
  const version = Number(data.version);
  if (!Number.isInteger(version) || version < 1 || version > BACKUP_SCHEMA_VERSION) {
    throw new Error(`Unsupported backup version. Expected 1-${BACKUP_SCHEMA_VERSION}.`);
  }

  const settings = data.settings as ExamSettings | undefined;
  if (
    !settings ||
    typeof settings !== 'object' ||
    !Array.isArray(settings.sections) ||
    settings.sections.length === 0
  ) {
    throw new Error('Invalid backup: missing valid settings and section data.');
  }

  const mocks = normalizeArray<MockTest>(data.mocks, 'mocks');
  const mistakes = normalizeArray<MistakeEntry>(data.mistakes, 'mistakes');
  const papers = normalizeArray<PaperTest>(data.papers, 'papers');
  const paperAttempts = normalizeArray<PaperAttempt>(data.paperAttempts, 'paperAttempts');
  const tasks = normalizeArray<StudyTask>(data.tasks, 'tasks');
  const profiles = normalizeArray<ExamProfile>(data.profiles, 'profiles');
  const images = normalizeArray<CompressedImage | BackupImage>(data.images, 'images');
  const importBatches = normalizeArray<ImportBatch>(data.importBatches, 'importBatches');

  const totalRecords =
    mocks.length +
    mistakes.length +
    papers.length +
    paperAttempts.length +
    tasks.length +
    profiles.length +
    images.length +
    importBatches.length;

  if (totalRecords === 0) {
    throw new Error('Backup contains no user records. Nothing was deleted.');
  }

  return {
    version,
    exportedAt: typeof data.exportedAt === 'string' ? data.exportedAt : new Date().toISOString(),
    settings,
    mocks,
    mistakes,
    papers,
    paperAttempts,
    tasks,
    profiles,
    images,
    importBatches
  };
}

async function mergeByStableId<T extends { id?: number | string }>(
  table: Table<T, any>,
  rows: T[]
): Promise<void> {
  if (rows.length === 0) return;
  const existing = await table.toArray();
  const existingIds = new Set(existing.map((row) => row.id).filter((id) => id !== undefined));
  const additions = rows.filter((row) => row.id === undefined || !existingIds.has(row.id));
  if (additions.length > 0) {
    await table.bulkAdd(additions);
  }
}

async function mergeMocks(rows: MockTest[]): Promise<void> {
  if (rows.length === 0) return;
  const existing = await db.mocks.toArray();
  const existingIds = new Set(existing.map((m) => m.id).filter((id) => id !== undefined));
  const existingKeys = new Set(
    existing.map((m) => `${m.name.trim().toLowerCase()}::${m.date}::${m.attemptType || 'mock'}`)
  );

  const additions = rows.filter((m) => {
    if (m.id !== undefined && existingIds.has(m.id)) return false;
    const key = `${m.name.trim().toLowerCase()}::${m.date}::${m.attemptType || 'mock'}`;
    if (existingKeys.has(key)) return false;
    existingKeys.add(key);
    return true;
  });

  if (additions.length > 0) {
    await db.mocks.bulkAdd(additions);
  }
}

async function mergeMistakes(rows: MistakeEntry[]): Promise<void> {
  if (rows.length === 0) return;
  const existing = await db.mistakes.toArray();
  const existingIds = new Set(existing.map((m) => m.id).filter((id) => id !== undefined));
  const existingKeys = new Set(
    existing.map((m) => `${m.questionText.trim().toLowerCase()}::${m.questionNumber}::${m.mockName || m.paperId || 'unlinked'}`)
  );

  const additions = rows.filter((m) => {
    if (m.id !== undefined && existingIds.has(m.id)) return false;
    const key = `${m.questionText.trim().toLowerCase()}::${m.questionNumber}::${m.mockName || m.paperId || 'unlinked'}`;
    if (existingKeys.has(key)) return false;
    existingKeys.add(key);
    return true;
  });

  if (additions.length > 0) {
    await db.mistakes.bulkAdd(additions);
  }
}

/**
 * Applies a validated backup in a single atomic Dexie transaction across all tables.
 * Any error triggers full rollback, preserving original data intact.
 */
export async function applyBackup(
  payload: BackupPayload,
  mode: RestoreMode = 'replace'
): Promise<RestoreResult> {
  const summary = summarizeBackup(payload);
  const tables = [
    db.settings,
    db.mocks,
    db.mistakes,
    db.papers,
    db.paperAttempts,
    db.images,
    db.importBatches,
    db.tasks,
    db.profiles
  ];

  await db.transaction('rw', tables, async () => {
    if (mode === 'replace') {
      await Promise.all([
        db.mocks.clear(),
        db.mistakes.clear(),
        db.papers.clear(),
        db.paperAttempts.clear(),
        db.images.clear(),
        db.importBatches.clear(),
        db.tasks.clear(),
        db.profiles.clear()
      ]);
      await db.settings.put(payload.settings);
      if (payload.profiles.length > 0) await db.profiles.bulkPut(payload.profiles);
      if (payload.mocks.length > 0) await db.mocks.bulkPut(payload.mocks);
      if (payload.mistakes.length > 0) await db.mistakes.bulkPut(payload.mistakes);
      if (payload.papers.length > 0) await db.papers.bulkPut(payload.papers);
      if (payload.paperAttempts.length > 0) await db.paperAttempts.bulkPut(payload.paperAttempts);
      if (payload.images.length > 0) await db.images.bulkPut(payload.images as CompressedImage[]);
      if (payload.importBatches.length > 0) await db.importBatches.bulkPut(payload.importBatches);
      if (payload.tasks.length > 0) await db.tasks.bulkPut(payload.tasks);
    } else {
      await db.settings.put(payload.settings);
      await mergeByStableId(db.profiles, payload.profiles);
      await mergeMocks(payload.mocks);
      await mergeMistakes(payload.mistakes);
      await mergeByStableId(db.papers, payload.papers);
      await mergeByStableId(db.paperAttempts, payload.paperAttempts);
      await mergeByStableId(db.images as Table<any, any>, payload.images);
      await mergeByStableId(db.importBatches, payload.importBatches);
      await mergeByStableId(db.tasks, payload.tasks);
    }
  });

  return { ...summary, mode };
}

/**
 * Validates and restores backup JSON. When in replace mode, requests user confirmation
 * if confirm = true and window.confirm is available.
 */
export async function importDataFromJson(
  jsonContent: string,
  mode: RestoreMode = 'replace',
  confirm: boolean = true
): Promise<RestoreResult> {
  const payload = validateBackup(jsonContent);

  if (mode === 'replace' && confirm) {
    if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
      const ok = window.confirm(
        'Warning: Restoring this backup will replace existing data. Do you want to proceed?'
      );
      if (!ok) {
        throw new Error('Restore cancelled by user.');
      }
    }
  }

  return applyBackup(payload, mode);
}

function downloadFile(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8;` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function exportAllDataAsJson(): Promise<void> {
  const payload = await createBackupPayload();
  downloadFile(
    `mistake_notebook_backup_${new Date().toISOString().split('T')[0]}.json`,
    JSON.stringify(payload, null, 2),
    'application/json'
  );
}

function escapeCsv(value: unknown): string {
  if (value === null || value === undefined) return '""';
  return `"${String(value).replace(/"/g, '""')}"`;
}

export function buildMistakesCsv(mistakes: MistakeEntry[]): string {
  const headers = [
    'ID',
    'Mock Name',
    'Paper ID',
    'Section',
    'Topic',
    'Subtopic',
    'Q No',
    'Result Type',
    'Error Types',
    'Difficulty',
    'Status',
    'Rule to Remember',
    'What Went Wrong',
    'My Answer',
    'Correct Answer',
    'Time Spent (s)',
    'Ideal Time (s)',
    'Created Date'
  ];

  const rows = mistakes.map((m) => [
    m.id ?? '',
    escapeCsv(m.mockName),
    m.paperId ?? '',
    escapeCsv(m.sectionName),
    escapeCsv(m.topic),
    escapeCsv(m.subtopic || ''),
    m.questionNumber,
    escapeCsv(m.resultType),
    escapeCsv(m.errorTypes.join('; ')),
    escapeCsv(m.difficulty),
    escapeCsv(m.status),
    escapeCsv(m.ruleToRemember),
    escapeCsv(m.whatWentWrong),
    escapeCsv(m.myAnswer),
    escapeCsv(m.correctAnswer),
    m.timeSpentSeconds,
    m.idealTimeSeconds,
    escapeCsv(m.createdAt)
  ]);

  return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
}

export function buildMocksCsv(mocks: MockTest[]): string {
  const headers = [
    'ID',
    'Name',
    'Date',
    'Source',
    'Attempt Type',
    'Paper ID',
    'Attempted',
    'Correct',
    'Wrong',
    'Unattempted',
    'Net Score',
    'Accuracy',
    'Marks Lost to Negative',
    'Time (s)'
  ];

  const rows = mocks.map((m) => [
    m.id ?? '',
    escapeCsv(m.name),
    escapeCsv(m.date),
    escapeCsv(m.source),
    escapeCsv(m.attemptType),
    m.paperId ?? '',
    m.totalAttempted,
    m.totalCorrect,
    m.totalWrong,
    m.totalUnattempted,
    m.totalNetScore,
    m.overallAccuracy,
    m.totalMarksLostNegative,
    m.totalTimeSpentSeconds
  ]);

  return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
}

export function buildPapersCsv(papers: PaperTest[]): string {
  const headers = [
    'ID',
    'Exam Name',
    'Year',
    'Shift',
    'Paper Type',
    'Total Time (min)',
    'Questions',
    'Source Note',
    'Created At'
  ];

  const rows = papers.map((paper) => [
    paper.id ?? '',
    escapeCsv(paper.examName),
    paper.year,
    escapeCsv(paper.shift || ''),
    escapeCsv(paper.isMemoryBased ? 'Memory-Based' : 'PYQ'),
    paper.totalTimeMinutes,
    paper.questions.length,
    escapeCsv(paper.sourceNote || ''),
    escapeCsv(paper.createdAt)
  ]);

  return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
}

export function exportMistakesAsCsv(mistakes: MistakeEntry[]): void {
  downloadFile(
    `mistakes_log_${new Date().toISOString().split('T')[0]}.csv`,
    buildMistakesCsv(mistakes),
    'text/csv'
  );
}

export function exportMocksAsCsv(mocks: MockTest[]): void {
  downloadFile(
    `mock_log_${new Date().toISOString().split('T')[0]}.csv`,
    buildMocksCsv(mocks),
    'text/csv'
  );
}

export function exportPapersAsCsv(papers: PaperTest[]): void {
  downloadFile(
    `papers_library_${new Date().toISOString().split('T')[0]}.csv`,
    buildPapersCsv(papers),
    'text/csv'
  );
}
