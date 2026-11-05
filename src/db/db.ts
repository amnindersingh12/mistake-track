import Dexie, { Table } from 'dexie';
import {
  ExamSettings,
  MockTest,
  MistakeEntry,
  PaperTest,
  PaperAttempt,
  CompressedImage,
  ImportBatch,
  StudyTask,
  ExamProfile,
  SectionConfig
} from '../types';

export const DEFAULT_QUANT_TOPICS = [
  'Percentage',
  'Profit & Loss',
  'SI/CI',
  'Ratio',
  'Average',
  'Mixture',
  'Time & Work',
  'Time Speed Distance',
  'Number System',
  'Algebra',
  'Geometry/Mensuration',
  'Probability/P&C',
  'Data Interpretation',
  'Simplification/Approximation',
  'Number Series',
  'Quadratic equations'
];

export const DEFAULT_REASONING_TOPICS = [
  'Syllogism',
  'Seating Arrangement',
  'Puzzles',
  'Blood Relations',
  'Direction Sense',
  'Coding-Decoding',
  'Inequality',
  'Order & Ranking',
  'Input-Output',
  'Data Sufficiency',
  'Logical/Verbal reasoning',
  'Series'
];

export const DEFAULT_ENGLISH_TOPICS = [
  'Reading Comprehension',
  'Cloze Test',
  'Error Spotting',
  'Sentence Improvement',
  'Para Jumbles',
  'Fill in the Blanks',
  'Vocabulary (synonyms/antonyms/idioms)',
  'Para Completion'
];

export const DEFAULT_CS_TOPICS = [
  'Data Structures',
  'Algorithms',
  'Operating Systems',
  'DBMS',
  'Computer Networks',
  'Theory of Computation',
  'Compiler Design',
  'Digital Logic',
  'Computer Architecture',
  'Software Engineering',
  'Discrete Mathematics',
  'Programming (C/C++/Python)'
];

export const DEFAULT_GENERAL_AWARENESS_TOPICS = [
  'Current Affairs',
  'Banking & Financial Awareness',
  'Static GK',
  'History',
  'Polity & Constitution',
  'Geography',
  'Economics',
  'General Science'
];

export const DEFAULT_ERROR_TYPES = [
  'Concept gap',
  'Formula forgotten',
  'Calculation mistake',
  'Misread question',
  'Silly/careless',
  'Time pressure rush',
  'Guessed (no basis)',
  'Did not know the shortcut',
  'Overthinking',
  'Vocabulary gap',
  'Grammar rule gap',
  'Wrong option selected',
  'Left easy question'
];

export const DEFAULT_PROFILES: ExamProfile[] = [
  {
    id: 'competitive-cs',
    name: 'Competitive Exam (CS)',
    examName: 'Competitive Exam',
    totalTimeMinutes: 120,
    targetScore: 100,
    overallCutoff: 60,
    isDefault: true,
    createdAt: new Date().toISOString(),
    errorTypes: [...DEFAULT_ERROR_TYPES],
    sections: [
      {
        id: 'quant',
        name: 'Quantitative Aptitude',
        totalQuestions: 25,
        marksPerCorrect: 1.0,
        negativeMark: 0.25,
        timeLimitMinutes: 30,
        sectionalCutoff: 10,
        topics: [...DEFAULT_QUANT_TOPICS]
      },
      {
        id: 'reasoning',
        name: 'Reasoning',
        totalQuestions: 25,
        marksPerCorrect: 1.0,
        negativeMark: 0.25,
        timeLimitMinutes: 30,
        sectionalCutoff: 10,
        topics: [...DEFAULT_REASONING_TOPICS]
      },
      {
        id: 'english',
        name: 'English',
        totalQuestions: 25,
        marksPerCorrect: 1.0,
        negativeMark: 0.25,
        timeLimitMinutes: 20,
        sectionalCutoff: 8,
        topics: [...DEFAULT_ENGLISH_TOPICS]
      },
      {
        id: 'cs',
        name: 'Computer Science',
        totalQuestions: 25,
        marksPerCorrect: 1.0,
        negativeMark: 0.25,
        timeLimitMinutes: 40,
        sectionalCutoff: 10,
        topics: [...DEFAULT_CS_TOPICS]
      }
    ]
  },
  {
    id: 'sbi-po',
    name: 'SBI PO Prelims',
    examName: 'SBI PO Prelims',
    totalTimeMinutes: 60,
    targetScore: 65,
    overallCutoff: 58.5,
    isDefault: true,
    createdAt: new Date().toISOString(),
    errorTypes: [...DEFAULT_ERROR_TYPES],
    sections: [
      {
        id: 'quant',
        name: 'Quantitative Aptitude',
        totalQuestions: 35,
        marksPerCorrect: 1.0,
        negativeMark: 0.25,
        timeLimitMinutes: 20,
        sectionalCutoff: 10,
        topics: [...DEFAULT_QUANT_TOPICS]
      },
      {
        id: 'reasoning',
        name: 'Reasoning Ability',
        totalQuestions: 35,
        marksPerCorrect: 1.0,
        negativeMark: 0.25,
        timeLimitMinutes: 20,
        sectionalCutoff: 12,
        topics: [...DEFAULT_REASONING_TOPICS]
      },
      {
        id: 'english',
        name: 'English Language',
        totalQuestions: 30,
        marksPerCorrect: 1.0,
        negativeMark: 0.25,
        timeLimitMinutes: 20,
        sectionalCutoff: 10,
        topics: [...DEFAULT_ENGLISH_TOPICS]
      }
    ]
  },
  {
    id: 'ibps-po',
    name: 'IBPS PO Prelims',
    examName: 'IBPS PO Prelims',
    totalTimeMinutes: 60,
    targetScore: 62,
    overallCutoff: 54.0,
    createdAt: new Date().toISOString(),
    errorTypes: [...DEFAULT_ERROR_TYPES],
    sections: [
      {
        id: 'quant',
        name: 'Quantitative Aptitude',
        totalQuestions: 35,
        marksPerCorrect: 1.0,
        negativeMark: 0.25,
        timeLimitMinutes: 20,
        sectionalCutoff: 9,
        topics: [...DEFAULT_QUANT_TOPICS]
      },
      {
        id: 'reasoning',
        name: 'Reasoning Ability',
        totalQuestions: 35,
        marksPerCorrect: 1.0,
        negativeMark: 0.25,
        timeLimitMinutes: 20,
        sectionalCutoff: 10,
        topics: [...DEFAULT_REASONING_TOPICS]
      },
      {
        id: 'english',
        name: 'English Language',
        totalQuestions: 30,
        marksPerCorrect: 1.0,
        negativeMark: 0.25,
        timeLimitMinutes: 20,
        sectionalCutoff: 9.5,
        topics: [...DEFAULT_ENGLISH_TOPICS]
      }
    ]
  },
  {
    id: 'ssc-cgl',
    name: 'SSC CGL Tier 1',
    examName: 'SSC CGL Tier 1',
    totalTimeMinutes: 60,
    targetScore: 155,
    overallCutoff: 140,
    createdAt: new Date().toISOString(),
    errorTypes: [...DEFAULT_ERROR_TYPES],
    sections: [
      {
        id: 'reasoning',
        name: 'General Intelligence & Reasoning',
        totalQuestions: 25,
        marksPerCorrect: 2.0,
        negativeMark: 0.5,
        timeLimitMinutes: 15,
        sectionalCutoff: 30,
        topics: [...DEFAULT_REASONING_TOPICS]
      },
      {
        id: 'ga',
        name: 'General Awareness',
        totalQuestions: 25,
        marksPerCorrect: 2.0,
        negativeMark: 0.5,
        timeLimitMinutes: 10,
        sectionalCutoff: 20,
        topics: [...DEFAULT_GENERAL_AWARENESS_TOPICS]
      },
      {
        id: 'quant',
        name: 'Quantitative Aptitude',
        totalQuestions: 25,
        marksPerCorrect: 2.0,
        negativeMark: 0.5,
        timeLimitMinutes: 20,
        sectionalCutoff: 30,
        topics: [...DEFAULT_QUANT_TOPICS]
      },
      {
        id: 'english',
        name: 'English Comprehension',
        totalQuestions: 25,
        marksPerCorrect: 2.0,
        negativeMark: 0.5,
        timeLimitMinutes: 15,
        sectionalCutoff: 30,
        topics: [...DEFAULT_ENGLISH_TOPICS]
      }
    ]
  }
];

export const DEFAULT_SETTINGS: ExamSettings = {
  id: 'current',
  examName: DEFAULT_PROFILES[0].examName,
  totalTimeMinutes: DEFAULT_PROFILES[0].totalTimeMinutes,
  targetScore: DEFAULT_PROFILES[0].targetScore,
  overallCutoff: DEFAULT_PROFILES[0].overallCutoff,
  sections: DEFAULT_PROFILES[0].sections,
  errorTypes: DEFAULT_PROFILES[0].errorTypes
};

export class MistakeNotebookDatabase extends Dexie {
  settings!: Table<ExamSettings, string>;
  mocks!: Table<MockTest, number>;
  mistakes!: Table<MistakeEntry, number>;
  papers!: Table<PaperTest, number>;
  paperAttempts!: Table<PaperAttempt, number>;
  images!: Table<CompressedImage, number>;
  importBatches!: Table<ImportBatch, number>;
  tasks!: Table<StudyTask, number>;
  profiles!: Table<ExamProfile, string>;

  constructor() {
    super('MistakeNotebookDB');

    this.version(1).stores({
      settings: 'id',
      mocks: '++id, name, date, source, totalNetScore, overallAccuracy',
      mistakes: '++id, mockId, sectionId, topic, resultType, status, interval, nextReviewDate, createdAt'
    });

    this.version(2).stores({
      settings: 'id',
      mocks: '++id, name, date, source, attemptType, totalNetScore, overallAccuracy',
      mistakes: '++id, mockId, paperId, sectionId, topic, resultType, status, interval, nextReviewDate, createdAt',
      papers: '++id, examName, year, isMemoryBased, createdAt'
    });

    this.version(3).stores({
      settings: 'id',
      mocks: '++id, name, date, source, attemptType, totalNetScore, overallAccuracy',
      mistakes: '++id, mockId, paperId, sectionId, topic, resultType, status, interval, nextReviewDate, createdAt',
      papers: '++id, examName, year, isMemoryBased, createdAt',
      tasks: '++id, dueDate, isCompleted, priority, subject, topic, createdAt',
      profiles: 'id, name, isDefault, createdAt'
    }).upgrade(async tx => {
      const profilesTable = tx.table('profiles');
      const count = await profilesTable.count();
      if (count === 0) {
        await profilesTable.bulkPut(DEFAULT_PROFILES);
      }
    });

    this.version(4).stores({
      settings: 'id',
      mocks: '++id, name, date, source, attemptType, totalNetScore, overallAccuracy',
      mistakes: '++id, mockId, paperId, questionId, sectionId, topic, subtopic, resultType, status, batchId, interval, nextReviewDate, createdAt',
      papers: '++id, examName, year, isMemoryBased, createdAt',
      paperAttempts: '++id, paperId, mockId, questionId, selected, correct, timeSpentSeconds, attemptedAt',
      images: '++id, mimeType, createdAt',
      importBatches: '++id, source, status, importedAt',
      tasks: '++id, dueDate, isCompleted, priority, subject, topic, createdAt',
      profiles: 'id, name, isDefault, createdAt'
    }).upgrade(async tx => {
      const mocks = await tx.table('mocks').toArray();
      const mockIds = new Set(mocks.map((m: { id?: number }) => m.id));
      const mistakes = await tx.table('mistakes').toArray();
      const migrated = mistakes.map((mistake: MistakeEntry) => {
        const next: any = { ...mistake };
        if (next.mockId !== undefined && !mockIds.has(next.mockId)) {
          delete next.mockId;
        }
        if (next.mockId === undefined && (!next.mockName || next.mockName === 'Mock Test')) {
          next.mockName = 'External / unlinked';
        }
        if (!Array.isArray(next.errorTypes)) {
          next.errorTypes = next.errorType ? [next.errorType] : ['Unclassified'];
        }
        if (!Array.isArray(next.tags)) {
          next.tags = ['user-logged'];
        }
        return next;
      });
      if (migrated.length > 0) {
        await tx.table('mistakes').bulkPut(migrated);
      }
    });
  }
}

export const db = new MistakeNotebookDatabase();

/**
 * Ensures initial default settings and profiles exist.
 * Preserves all user entered mocks, mistakes, papers, and tasks.
 */
export function extractExamNameFromMock(mockName: string): string {
  if (!mockName) return '';
  const cleaned = mockName
    .replace(/(?:[-_:\s]+)?(?:Mock(?:\s*Test)?|Test|Full\s*Mock|Paper)\s*#?\d+.*$/i, '')
    .replace(/\s*-\s*$/, '')
    .trim();
  return cleaned || mockName;
}

export async function ensureSettings(): Promise<ExamSettings> {
  const current = await db.settings.get('current');
  
  // Also ensure profiles exist
  const profileCount = await db.profiles.count();
  if (profileCount === 0) {
    await db.profiles.bulkPut(DEFAULT_PROFILES);
  }

  if (!current) {
    await db.settings.put(DEFAULT_SETTINGS);
    return DEFAULT_SETTINGS;
  }

  let modified = false;

  // Ensure CS section is present
  if (!current.sections.some((s) => s.id === 'cs')) {
    current.sections.push({
      id: 'cs',
      name: 'Computer Science',
      totalQuestions: 25,
      marksPerCorrect: 1.0,
      negativeMark: 0.25,
      timeLimitMinutes: 40,
      sectionalCutoff: 10,
      topics: [...DEFAULT_CS_TOPICS]
    });
    modified = true;
  }

  // If there are recorded mocks, adapt exam name from latest mock if currently default
  try {
    const latestMock = await db.mocks.orderBy('date').last();
    if (latestMock?.name) {
      const derived = extractExamNameFromMock(latestMock.name);
      if (derived && derived.length > 2 && (current.examName === 'SBI PO Prelims' || current.examName === 'Competitive Exam')) {
        current.examName = derived;
        modified = true;
      }
    }
  } catch {
    // Ignore mock read error during migration
  }

  if (modified) {
    await db.settings.put(current);
  }

  return current;
}

/**
 * Switch the active exam profile without touching mocks or mistakes.
 */
export async function switchProfile(profileId: string): Promise<ExamSettings> {
  const profile = await db.profiles.get(profileId);
  if (!profile) {
    throw new Error(`Profile with id "${profileId}" not found`);
  }

  const updatedSettings: ExamSettings = {
    id: 'current',
    examName: profile.examName,
    totalTimeMinutes: profile.totalTimeMinutes,
    targetScore: profile.targetScore,
    overallCutoff: profile.overallCutoff,
    sections: profile.sections,
    errorTypes: profile.errorTypes
  };

  await db.settings.put(updatedSettings);
  return updatedSettings;
}

/**
 * Clears user data completely.
 */
export async function clearAllUserData(): Promise<void> {
  await db.mistakes.clear();
  await db.mocks.clear();
  await db.papers.clear();
  await db.paperAttempts.clear();
  await db.images.clear();
  await db.importBatches.clear();
  await db.tasks.clear();
  await db.settings.put(DEFAULT_SETTINGS);
}
