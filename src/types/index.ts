export type ResultType = 'Wrong' | 'Left unattempted' | 'Correct-but-slow';
export type MistakeStatus = 'New' | 'Active' | 'Reviewing' | 'Mastered' | 'inbox';
export type Difficulty = 'Easy' | 'Medium' | 'Hard';
export type AttemptType = 'mock' | 'pyq' | 'memory-based';

export type UserRank = 'Rookie' | 'Apprentice' | 'Adept' | 'Ace' | 'Legend';

export function calculateUserRank(masteredCount: number): { rank: UserRank; nextTarget: number; progress: number } {
  if (masteredCount >= 50) return { rank: 'Legend', nextTarget: 50, progress: 100 };
  if (masteredCount >= 25) return { rank: 'Ace', nextTarget: 50, progress: Math.round(((masteredCount - 25) / 25) * 100) };
  if (masteredCount >= 10) return { rank: 'Adept', nextTarget: 25, progress: Math.round(((masteredCount - 10) / 15) * 100) };
  if (masteredCount >= 3) return { rank: 'Apprentice', nextTarget: 10, progress: Math.round(((masteredCount - 3) / 7) * 100) };
  return { rank: 'Rookie', nextTarget: 3, progress: Math.round((masteredCount / 3) * 100) };
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

export interface ExamProfile {
  id: string;
  name: string;
  examName: string;
  totalTimeMinutes: number;
  targetScore: number;
  overallCutoff: number;
  sections: SectionConfig[];
  errorTypes: string[];
  isDefault?: boolean;
  createdAt: string;
  updatedAt?: string;
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
