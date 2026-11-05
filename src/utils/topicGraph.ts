import { CanonicalTopic, TopicCategory, SyllabusProgress, SyllabusStatus, MistakeEntry } from '../types';
import { DEFAULT_CANONICAL_TOPICS, db } from '../db/db';

export interface ExamMeta {
  id: string;
  name: string;
  shortName: string;
  color: string;
  badgeBg: string;
  badgeText: string;
  border: string;
}

export const SUPPORTED_EXAMS: Record<string, ExamMeta> = {
  'gate-cs': {
    id: 'gate-cs',
    name: 'GATE CS (2027)',
    shortName: 'GATE CS',
    color: '#6366f1',
    badgeBg: 'bg-indigo-950/70',
    badgeText: 'text-indigo-300',
    border: 'border-indigo-600/40'
  },
  'sebi-it': {
    id: 'sebi-it',
    name: 'SEBI Grade A (IT)',
    shortName: 'SEBI IT',
    color: '#10b981',
    badgeBg: 'bg-emerald-950/70',
    badgeText: 'text-emerald-300',
    border: 'border-emerald-600/40'
  },
  'ibps-so-it': {
    id: 'ibps-so-it',
    name: 'IBPS SO (IT Officer)',
    shortName: 'IBPS SO IT',
    color: '#f59e0b',
    badgeBg: 'bg-amber-950/70',
    badgeText: 'text-amber-300',
    border: 'border-amber-600/40'
  }
};

export interface TopicOverlapDetails {
  topic: CanonicalTopic;
  allTestedExams: string[];
  overlapCount: number;
  isCommonAcrossAll: boolean;
  overlapPercentage: number;
  subtopicCount: number;
  otherExamsTesting: string[];
}

export interface CombinedTopicMastery {
  topicId: string;
  topicName: string;
  category: TopicCategory;
  subtopics: string[];
  testedExams: string[];
  masteryScore: number; // 0 - 100
  status: 'Not started' | 'In progress' | 'Mastered';
  syllabusStatuses: Record<string, SyllabusStatus>;
  confidenceAvg: number;
  totalMistakes: number;
  activeMistakes: number;
  masteredMistakes: number;
  pyqsSolved: number;
  totalPyqs: number;
  reason: string;
}

export interface OverlapTaxonomySummary {
  totalTopics: number;
  categoryCounts: Record<TopicCategory, number>;
  crossExamTopicsCount: number;
  allThreeCount: number;
  goldenCoreTopics: CanonicalTopic[];
  examBreakdown: Record<string, { total: number; exclusive: number; shared: number }>;
}

/**
 * Returns canonical topics, defaulting to DEFAULT_CANONICAL_TOPICS.
 */
export function getCanonicalTopics(topics?: CanonicalTopic[]): CanonicalTopic[] {
  return topics && topics.length > 0 ? topics : DEFAULT_CANONICAL_TOPICS;
}

/**
 * Retrieves a canonical topic by ID or case-insensitive name.
 */
export function findTopic(query: string, topics?: CanonicalTopic[]): CanonicalTopic | undefined {
  const all = getCanonicalTopics(topics);
  const q = query.trim().toLowerCase();
  return all.find(t => t.id.toLowerCase() === q || t.name.toLowerCase() === q);
}

/**
 * Filters topics by category.
 */
export function getTopicsByCategory(category: TopicCategory, topics?: CanonicalTopic[]): CanonicalTopic[] {
  return getCanonicalTopics(topics).filter(t => t.category === category);
}

/**
 * Returns all topics that are tested in a given exam.
 */
export function getTopicsForExam(examId: string, topics?: CanonicalTopic[]): CanonicalTopic[] {
  return getCanonicalTopics(topics).filter(t => 
    t.examTags.includes(examId) || t.overlapExams.includes(examId)
  );
}

/**
 * Returns topics tested in at least 2 exams, or in all specified exams.
 */
export function getCrossExamOverlap(examFilter?: string[], topics?: CanonicalTopic[]): CanonicalTopic[] {
  const all = getCanonicalTopics(topics);
  if (!examFilter || examFilter.length === 0) {
    return all.filter(t => (t.overlapExams || t.examTags).length > 1);
  }
  return all.filter(t => {
    const tested = t.overlapExams?.length ? t.overlapExams : t.examTags;
    return examFilter.every(exam => tested.includes(exam));
  });
}

/**
 * Computes overlap details for a specific topic.
 */
export function getTopicOverlapDetails(topicOrId: string | CanonicalTopic, topics?: CanonicalTopic[]): TopicOverlapDetails {
  const topic = typeof topicOrId === 'string' ? findTopic(topicOrId, topics) : topicOrId;
  if (!topic) {
    throw new Error(`Topic not found: ${topicOrId}`);
  }

  const allExams = Object.keys(SUPPORTED_EXAMS);
  const tested = topic.overlapExams?.length ? topic.overlapExams : topic.examTags;
  const overlapCount = tested.length;
  const isCommonAcrossAll = allExams.every(e => tested.includes(e));
  const overlapPercentage = Math.round((overlapCount / allExams.length) * 100);

  return {
    topic,
    allTestedExams: tested,
    overlapCount,
    isCommonAcrossAll,
    overlapPercentage,
    subtopicCount: topic.subtopics.length,
    otherExamsTesting: tested
  };
}

/**
 * Computes the taxonomy summary across all 3 exams and categories.
 */
export function getOverlapTaxonomySummary(topics?: CanonicalTopic[]): OverlapTaxonomySummary {
  const all = getCanonicalTopics(topics);
  const allExamIds = Object.keys(SUPPORTED_EXAMS);

  const categoryCounts: Record<TopicCategory, number> = {
    'Core CS': 0,
    'IT-officer': 0,
    'Common': 0
  };

  const goldenCore: CanonicalTopic[] = [];
  let crossExamCount = 0;

  const examBreakdown: Record<string, { total: number; exclusive: number; shared: number }> = {};
  for (const id of allExamIds) {
    examBreakdown[id] = { total: 0, exclusive: 0, shared: 0 };
  }

  for (const t of all) {
    categoryCounts[t.category] = (categoryCounts[t.category] || 0) + 1;
    const tested = t.overlapExams?.length ? t.overlapExams : t.examTags;

    if (tested.length > 1) {
      crossExamCount++;
    }

    const isAllThree = allExamIds.every(id => tested.includes(id));
    if (isAllThree) {
      goldenCore.push(t);
    }

    for (const eid of tested) {
      if (examBreakdown[eid]) {
        examBreakdown[eid].total++;
        if (tested.length === 1) {
          examBreakdown[eid].exclusive++;
        } else {
          examBreakdown[eid].shared++;
        }
      }
    }
  }

  return {
    totalTopics: all.length,
    categoryCounts,
    crossExamTopicsCount: crossExamCount,
    allThreeCount: goldenCore.length,
    goldenCoreTopics: goldenCore,
    examBreakdown
  };
}

/**
 * Computes combined topic mastery across exams from syllabusProgress and mistakes.
 * Evidence-based: incorporates syllabus completion status, confidence scores,
 * active vs resolved mistakes, and PYQ progress.
 */
export function computeCombinedTopicMastery(
  topic: CanonicalTopic,
  progressList: SyllabusProgress[] = [],
  mistakesList: (Partial<MistakeEntry> & { topic?: string; status?: string })[] = []
): CombinedTopicMastery {
  const tested = topic.overlapExams?.length ? topic.overlapExams : topic.examTags;
  
  // Find all syllabus progress items matching this topic ID
  const relevantProgress = progressList.filter(p => p.topicId === topic.id);
  const syllabusStatuses: Record<string, SyllabusStatus> = {};
  let totalConfidence = 0;
  let pyqsSolved = 0;
  let totalPyqs = 0;

  for (const p of relevantProgress) {
    syllabusStatuses[p.examId] = p.status;
    totalConfidence += p.confidence || 0;
    pyqsSolved += p.pyqsSolved || 0;
    totalPyqs += p.totalPyqs || 0;
  }

  // Count mistakes matching topic (case-insensitive on name or id)
  const topicNameLower = topic.name.toLowerCase();
  const topicIdLower = topic.id.toLowerCase();
  const relevantMistakes = mistakesList.filter(m => {
    const mTopic = (m.topic || '').trim().toLowerCase();
    return mTopic === topicNameLower || mTopic === topicIdLower;
  });

  const totalMistakes = relevantMistakes.length;
  const activeMistakes = relevantMistakes.filter(m => m.status !== 'Mastered').length;
  const masteredMistakes = relevantMistakes.filter(m => m.status === 'Mastered').length;

  // Calculate score
  let baseScore = 0;
  const progressCount = relevantProgress.length;

  if (progressCount > 0) {
    let progressScore = 0;
    for (const p of relevantProgress) {
      if (p.status === 'mastered') {
        progressScore += 100;
      } else if (p.status === 'in_progress') {
        progressScore += 50;
      }
    }
    const avgProgress = progressScore / progressCount;
    const avgConf = totalConfidence / progressCount;
    // Weighted combination of status and confidence
    baseScore = avgConf > 0 ? (avgProgress * 0.7 + avgConf * 0.3) : avgProgress;
  }

  // PYQ impact: bonus if solved
  if (totalPyqs > 0) {
    const pyqRatio = Math.min(1, pyqsSolved / totalPyqs);
    baseScore = Math.max(baseScore, pyqRatio * 100);
  }

  // Mistake penalty/bonus
  // Unresolved mistakes penalize mastery (-10 each, capped at -40)
  const penalty = Math.min(40, activeMistakes * 10);
  // Mastered mistakes demonstrate recovery (+5 each, capped at +15)
  const recoveryBonus = Math.min(15, masteredMistakes * 5);

  let finalScore = Math.round(Math.max(0, Math.min(100, baseScore - penalty + recoveryBonus)));

  // If there are unresolved mistakes, cap mastery score at 75
  if (activeMistakes > 0 && finalScore > 75) {
    finalScore = 75;
  }

  // Determine overall status
  let status: 'Not started' | 'In progress' | 'Mastered' = 'Not started';
  let reason = 'No study activity or mistakes recorded.';

  const hasAnyProgress = progressCount > 0 && relevantProgress.some(p => p.status !== 'not_started');
  const hasActivity = hasAnyProgress || totalMistakes > 0 || pyqsSolved > 0;

  if (finalScore >= 80 && activeMistakes === 0 && hasActivity) {
    status = 'Mastered';
    reason = `Mastered across tracked exams with zero unresolved mistakes (${masteredMistakes} mastered).`;
  } else if (hasActivity || finalScore > 0) {
    status = 'In progress';
    if (activeMistakes > 0) {
      reason = `${activeMistakes} active mistake(s) pending review; current mastery at ${finalScore}%.`;
    } else {
      reason = `In progress with ${finalScore}% overall mastery score.`;
    }
  }

  return {
    topicId: topic.id,
    topicName: topic.name,
    category: topic.category,
    subtopics: topic.subtopics,
    testedExams: tested,
    masteryScore: finalScore,
    status,
    syllabusStatuses,
    confidenceAvg: progressCount > 0 ? Math.round(totalConfidence / progressCount) : 0,
    totalMistakes,
    activeMistakes,
    masteredMistakes,
    pyqsSolved,
    totalPyqs,
    reason
  };
}

/**
 * Calculates combined mastery for all canonical topics.
 */
export function computeAllTopicsMastery(
  topics?: CanonicalTopic[],
  progressList: SyllabusProgress[] = [],
  mistakesList: (Partial<MistakeEntry> & { topic?: string; status?: string })[] = []
): CombinedTopicMastery[] {
  const all = getCanonicalTopics(topics);
  return all.map(t => computeCombinedTopicMastery(t, progressList, mistakesList));
}

/**
 * Async helper to fetch topics, syllabus progress, and mistakes from Dexie db.
 */
export async function fetchCombinedMasteryFromDb(
  dbInstance = db
): Promise<CombinedTopicMastery[]> {
  const [dbTopics, progress, mistakes] = await Promise.all([
    dbInstance.topics.toArray(),
    dbInstance.syllabusProgress.toArray(),
    dbInstance.mistakes.toArray()
  ]);
  const topics = dbTopics.length > 0 ? dbTopics : DEFAULT_CANONICAL_TOPICS;
  return computeAllTopicsMastery(topics, progress, mistakes);
}
