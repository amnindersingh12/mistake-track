export type ResultType = 'Wrong' | 'Left unattempted' | 'Correct-but-slow';
export type MistakeStatus = 'New' | 'Active' | 'Reviewing' | 'Mastered' | 'inbox';
export type Difficulty = 'Easy' | 'Medium' | 'Hard';
export type AttemptType = 'mock' | 'pyq' | 'memory-based';
export type QuestionType = 'MCQ' | 'MSQ' | 'NAT' | 'descriptive';

export const CS_ERROR_TYPES = [
  'Concept gap',
  'Trace/execution error',
  'Misread constraint',
  'Missed MSQ option',
  'NAT calculation slip',
  'Formula/definition forgotten',
  'Time pressure',
  'Blind guess',
  'Overthinking',
  'Trick not known',
  'Calculation / algebra error',
  'Silly slip / bubbling mistake',
  'Unclassified'
] as const;

export type CSErrorType = typeof CS_ERROR_TYPES[number];

export type UserRank = 'Aspirant' | 'Novice Scholar' | 'Code Ninja' | 'Special Grade Candidate' | 'GATE/Officer Topper' | 'Rookie' | 'Apprentice' | 'Adept' | 'Ace' | 'Legend';

export function calculateUserRank(masteredCountOrXp: number): { rank: UserRank; nextTarget: number; progress: number } {
  if (masteredCountOrXp >= 1000) return { rank: 'GATE/Officer Topper', nextTarget: 1000, progress: 100 };
  if (masteredCountOrXp >= 500) return { rank: 'Special Grade Candidate', nextTarget: 1000, progress: Math.round(((masteredCountOrXp - 500) / 500) * 100) };
  if (masteredCountOrXp >= 250) return { rank: 'Code Ninja', nextTarget: 500, progress: Math.round(((masteredCountOrXp - 250) / 250) * 100) };
  if (masteredCountOrXp >= 100) return { rank: 'Novice Scholar', nextTarget: 250, progress: Math.round(((masteredCountOrXp - 100) / 150) * 100) };
  return { rank: 'Aspirant', nextTarget: 100, progress: Math.round((masteredCountOrXp / 100) * 100) };
}

export interface SectionConfig {
  id: string;
  name: string;
  totalQuestions: number;
  marksPerCorrect: number;
  negativeMark: number;
  timeLimitMinutes: number;
  sectionalCutoff: number;
  topics: string[];
}

export interface ExamSettings {
  id: string; // 'current'
  examName: string;
  totalTimeMinutes: number;
  targetScore: number;
  overallCutoff: number;
  sections: SectionConfig[];
  errorTypes: string[];
}

export interface SectionPerformance {
  sectionId: string;
  sectionName: string;
  attempted: number;
  correct: number;
  wrong: number;
  timeSpentSeconds: number;
  // Computed:
  unattempted: number;
  netScore: number;
  accuracy: number; // in % (0 - 100)
  marksLostNegative: number;
}

export interface MockTest {
  id?: number;
  examId?: string;
  stage?: string;
  name: string;
  date: string; // YYYY-MM-DD
  source: string;
  attemptType: AttemptType;
  paperId?: number;
  overallRank?: number;
  overallPercentile?: number;
  sections: SectionPerformance[];
  totalAttempted: number;
  totalCorrect: number;
  totalWrong: number;
  totalUnattempted: number;
  totalNetScore: number;
  overallAccuracy: number;
  totalMarksLostNegative: number;
  totalTimeSpentSeconds: number;
  screenshot?: string;
  notes?: string;
}

export interface ReviewLog {
  date: string;
  result: 'got-it' | 'still-wrong';
}

export interface MistakeEntry {
  id?: number;
  examId?: string;
  stage?: string;
  mockId?: number;
  mockName: string;
  attemptType?: AttemptType;
  paperId?: number;
  questionId?: string;
  sectionId: string;
  sectionName: string;
  topic: string;
  subtopic?: string;
  questionNumber: number;
  questionText: string;
  questionImage?: string; // Data URL Base64 or image key
  imageId?: number;
  questionType?: QuestionType;
  marks?: number;
  natTolerance?: number;
  natAnswer?: number;
  correctNatAnswer?: { min: number; max: number } | number;
  msqSelectedOptions?: string[];
  msqCorrectOptions?: string[];
  msqWrongOptions?: string[];
  msqMissedOptions?: string[];
  linkedNoteIds?: number[];
  linkedPatternIds?: number[];
  linkedPyqIds?: number[];
  myAnswer: string;
  correctAnswer: string;
  resultType: ResultType;
  errorTypes: string[];
  timeSpentSeconds: number;
  idealTimeSeconds: number;
  timeSpent?: number;
  idealTime?: number;
  whatWentWrong: string;
  correctSolution: string;
  betterApproach: string;
  ruleToRemember: string;
  difficulty: Difficulty;
  tags: string[];
  status: MistakeStatus;
  needsReview?: boolean;
  reviewReason?: string;
  // Inbox fields:
  source?: string;
  importedAt?: string;
  batchId?: number;
  // Spaced repetition:
  interval: number; // 0, 1, 3, 7, 14, 30
  consecutiveCorrect: number;
  lastReviewedAt?: string;
  nextReviewDate: string; // YYYY-MM-DD
  history: ReviewLog[];
  createdAt: string;
}

export interface PaperQuestion {
  id: string;
  sectionId: string;
  questionNumber: number;
  text: string;
  image?: string;
  options: string[];
  correctOptionIndex: number;
  solution?: string;
  shortcut?: string;
  topic?: string;
}

export interface PaperAttempt {
  id?: number;
  paperId: number;
  mockId?: number;
  questionId: string;
  sectionId?: string;
  topic?: string;
  selected: number | null;
  correct: boolean;
  timeSpentSeconds: number;
  timeSpent?: number;
  attemptedAt: string; // ISO timestamp
}

export interface CompressedImage {
  id?: number;
  dataUrl: string;
  mimeType: string;
  width?: number;
  height?: number;
  sizeBytes?: number;
  createdAt: string;
}

export interface ImportBatch {
  id?: number;
  source: string;
  importedAt: string;
  mockId?: number;
  mockName?: string;
  totalQuestions: number;
  untriagedCount: number;
  status: 'pending' | 'partially-triaged' | 'triaged' | 'discarded';
  notes?: string;
}

export interface PaperTest {
  id?: number;
  examId?: string;
  stage?: string;
  examName: string;
  year: number;
  shift?: string;
  isMemoryBased: boolean;
  sourceNote?: string;
  totalTimeMinutes: number;
  sections: SectionConfig[];
  questions: PaperQuestion[];
  createdAt: string;
}

export interface PlannerInput {
  targetScore: number;
  accuracyPercent: number;
  marksPerCorrect: number;
  negativeMark: number;
  maxQuestions?: number;
}

export interface PlannerResult {
  attemptsNeeded: number;
  isAchievable: boolean;
  expectedScorePerAttempt: number;
  breakEvenAccuracyPercent: number;
  explanation: string;
  curveData: Array<{
    attempts: number;
    scoreCurrent: number;
    scoreMinus10: number;
    scorePlus10: number;
  }>;
}

export interface WhatIfSectionInput {
  sectionId: string;
  sectionName: string;
  attempts: number;
  accuracyPercent: number;
  totalQuestions: number;
  marksPerCorrect: number;
  negativeMark: number;
  cutoff: number;
}

export interface WhatIfResult {
  sections: Array<{
    sectionId: string;
    sectionName: string;
    projectedNetScore: number;
    passedCutoff: boolean;
    cutoff: number;
  }>;
  totalScore: number;
  passedOverallCutoff: boolean;
  hitTargetScore: boolean;
}

export type TaskPriority = 'High' | 'Medium' | 'Low';

export interface StudyTask {
  id?: number;
  title: string;
  description?: string;
  subject: string;
  topic?: string;
  priority: TaskPriority;
  plannedDurationMinutes: number;
  actualDurationMinutes?: number;
  dueDate: string; // YYYY-MM-DD
  isCompleted: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface QuestionTypeMarkingRule {
  questionType: QuestionType;
  marks: number;
  negativeMarks: number;
  allowPartialCredit?: boolean;
  natTolerance?: number;
}

export interface ExamStage {
  id: string;
  name: string;
  durationMinutes: number;
  totalMarks: number;
  cutoffMarks?: number;
  sections: SectionConfig[];
  markingRules: QuestionTypeMarkingRule[];
  isUnverified?: boolean;
}

export interface ExamProfile {
  id: string;
  name: string;
  examName: string;
  targetYear?: number;
  stages: ExamStage[];
  sourceUrl?: string;
  unverifiedFields: string[];
  isDefault?: boolean;
  createdAt: string;
  updatedAt?: string;
  // Legacy / fallback fields:
  totalTimeMinutes?: number;
  targetScore?: number;
  overallCutoff?: number;
  sections?: SectionConfig[];
  errorTypes?: string[];
}

export type TopicCategory = 'Core CS' | 'IT-officer' | 'Common';

export interface CanonicalTopic {
  id: string;
  name: string;
  category: TopicCategory;
  subtopics: string[];
  examTags: string[];
  overlapExams: string[];
  weightage?: Record<string, number>;
}

export type SyllabusStatus = 'not_started' | 'in_progress' | 'mastered';

export interface SyllabusProgress {
  id?: number;
  examId: string;
  stage: string;
  topicId: string;
  status: SyllabusStatus;
  confidence: number;
  lastRevised?: string;
  pyqsSolved: number;
  totalPyqs: number;
  updatedAt: string;
}

export interface PYQ {
  id?: number;
  examId: string;
  year: number;
  stage: string;
  shift?: string;
  topicId: string;
  subtopic?: string;
  questionNumber: number;
  questionText: string;
  questionImage?: string;
  questionType: QuestionType;
  marks: number;
  negativeMarks?: number;
  options?: string[];
  correctAnswer: string;
  natAnswerRange?: { min: number; max: number };
  solutionText?: string;
  source: 'official' | 'memory-based';
  sourceUrl?: string;
  isUnverified?: boolean;
  firstAttemptCorrect?: boolean;
  attemptedCount: number;
  createdAt: string;
}

export interface StudyNote {
  id?: number;
  title: string;
  topicId: string;
  subtopic?: string;
  content: string; // Markdown + KaTeX + code
  tags: string[];
  linkedMistakeIds: number[];
  linkedPyqIds: number[];
  linkedPatternIds: number[];
  createdAt: string;
  updatedAt: string;
}

export interface Pattern {
  id?: number;
  title: string;
  topicId: string;
  description: string;
  trickOrTrap: string;
  linkedMistakeIds: number[];
  linkedPyqIds: number[];
  createdAt: string;
  updatedAt: string;
}

export type StudySessionType = 'reading' | 'practice' | 'mock' | 'review';

export interface StudySession {
  id?: number;
  topicId?: string;
  examId?: string;
  type: StudySessionType;
  durationMinutes: number;
  startedAt: string;
  endedAt: string;
  notes?: string;
}

export interface AvailabilityPhase {
  id?: number;
  name: 'regular' | 'intensive' | 'last-month' | string;
  startDate: string;
  endDate: string;
  targetHoursPerWeek: number;
  dailyHoursAllocation: Record<string, number>;
  weekendMockSlotHours: number;
  isCurrent?: boolean;
}

export type QuestType = 'daily' | 'weekly' | 'boss';

export interface Quest {
  id: string;
  type: QuestType;
  title: string;
  description: string;
  target: number;
  current: number;
  xpReward: number;
  completed: boolean;
  expiresAt: string;
}

export interface UserXPState {
  id: string; // 'current'
  totalXp: number;
  currentLevel: number;
  rankTitle: string;
  currentStreak: number;
  streakFreezesAvailable: number;
  lastActiveDate: string;
  updatedAt: string;
}

export interface SkillTreeNode {
  id: string;
  subject: string;
  title: string;
  level: number;
  prerequisites: string[];
  status: 'locked' | 'unlocked' | 'in_progress' | 'mastered';
}

export interface StudyBridgeSourceMetadata {
  platform: string;
  url: string;
  title: string;
}

export type StudyBridgeMode = 'summary' | 'question' | 'selection' | 'fullscan';

export interface ScannedQuestionOption {
  index: number;
  text: string;
  isCorrect?: boolean;
  isSelected?: boolean;
}

export interface ScannedQuestion {
  questionNumber: number;
  section: string;
  questionText: string;
  questionImage?: string;
  options: ScannedQuestionOption[];
  selectedAnswer?: string;
  correctAnswer?: string;
  marks?: number;
  explanation?: string;
  topic?: string;
  statusBadge?: string;
  timeTaken?: string;
  avgTime?: string;
  solutionStatus: 'captured' | 'unavailable' | 'failed';
  isMistakeCandidate?: boolean;
  needsReview?: boolean;
  reviewReason?: string;
}

export interface FullMockScanResult {
  examName?: string;
  mockName?: string;
  overallScore?: number;
  maxScore?: number;
  sections: Array<{
    sectionName: string;
    questionCount: number;
    correctCount: number;
    incorrectCount: number;
    skippedCount: number;
    marks: number;
  }>;
  totalQuestions: number;
  questions: ScannedQuestion[];
  scanDurationMs?: number;
}

export interface StudyBridgeImportPayload {
  id: string;
  mode?: StudyBridgeMode;
  text: string;
  source: StudyBridgeSourceMetadata;
  capturedAt: string;
  summaryData?: any;
  questionData?: any;
  scanData?: FullMockScanResult;
}

export interface StudyBridgeImportMessage {
  schemaVersion: 1;
  type: 'STUDYBRIDGE_IMPORT';
  payload: StudyBridgeImportPayload;
}

export interface StudyBridgeAckMessage {
  type: 'STUDYBRIDGE_IMPORT_ACK';
  id: string;
  status: 'received' | 'saved' | 'cancelled' | 'error';
  error?: string;
}
