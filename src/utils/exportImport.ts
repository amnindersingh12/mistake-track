import { db, ensureSettings } from '../db/db';
import { MistakeEntry, MockTest, ExamSettings } from '../types';

export interface BackupPayload {
  version: number;
  exportedAt: string;
  settings: ExamSettings;
  mocks: MockTest[];
  mistakes: MistakeEntry[];
}

export async function exportAllDataAsJson(): Promise<void> {
  const settings = await ensureSettings();
  const mocks = await db.mocks.toArray();
  const mistakes = await db.mistakes.toArray();

  const payload: BackupPayload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    settings,
    mocks,
    mistakes
  };

  const jsonString = JSON.stringify(payload, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `mistake_notebook_backup_${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function importDataFromJson(jsonContent: string): Promise<{ mockCount: number; mistakeCount: number }> {
  const data = JSON.parse(jsonContent) as BackupPayload;

  if (!data || !Array.isArray(data.mocks) || !Array.isArray(data.mistakes)) {
    throw new Error('Invalid backup file structure: missing mocks or mistakes tables.');
  }

  await db.transaction('rw', db.settings, db.mocks, db.mistakes, async () => {
    if (data.settings) {
      await db.settings.put(data.settings);
    }
    await db.mocks.clear();
    await db.mistakes.clear();

    if (data.mocks.length > 0) {
      await db.mocks.bulkAdd(data.mocks);
    }
    if (data.mistakes.length > 0) {
      await db.mistakes.bulkAdd(data.mistakes);
    }
  });

  return {
    mockCount: data.mocks.length,
    mistakeCount: data.mistakes.length
  };
}

export function exportMistakesAsCsv(mistakes: MistakeEntry[]): void {
  const headers = [
    'ID',
    'Mock Name',
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

  const escapeCsv = (str: unknown) => {
    if (str === null || str === undefined) return '""';
    const s = String(str).replace(/"/g, '""');
    return `"${s}"`;
  };

  const rows = mistakes.map((m) => [
    m.id ?? '',
    escapeCsv(m.mockName),
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

  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `mistakes_log_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

