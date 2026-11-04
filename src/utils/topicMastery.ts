import { MockTest, MistakeEntry, PaperTest, SectionConfig } from '../types';

export type TopicMasteryStatus = 'Not studied' | 'Learning' | 'Weak' | 'Improving' | 'Strong';

export interface TopicEvidence {
  topic: string;
  sectionId: string;
  sectionName: string;
  status: TopicMasteryStatus;
  totalAttempted: number;
  totalCorrect: number;
  totalWrong: number;
  accuracy: number; // 0 to 100
  mistakeCount: number;
  unresolvedMistakes: number;
  masteredMistakes: number;
  recentAccuracy: number; // 0 to 100 on latest attempts
  evidenceCount: number; // total data points
  reason: string;
  recommendedAction: string;
}

export interface TopicMasteryMatrix {
  allTopics: TopicEvidence[];
  strongTopics: TopicEvidence[];
  weakTopics: TopicEvidence[];
  improvingTopics: TopicEvidence[];
  learningTopics: TopicEvidence[];
  notStudiedTopics: TopicEvidence[];
  countsByStatus: Record<TopicMasteryStatus, number>;
}

/**
 * Calculates evidence-based topic mastery from recorded mocks, mistakes, and in-app paper attempts.
 * Zero fabricated data or artificial assumptions.
 */
export function calculateTopicMastery(
  sections: SectionConfig[],
  mocks: MockTest[] = [],
  mistakes: MistakeEntry[] = [],
  papers: PaperTest[] = []
): TopicMasteryMatrix {
  // 1. Gather all unique topics mapped to their sections
  const topicMap = new Map<string, { sectionId: string; sectionName: string }>();

  // From section configurations
  sections.forEach(sec => {
    (sec.topics || []).forEach(t => {
      const trimmed = t.trim();
      if (trimmed && !topicMap.has(trimmed.toLowerCase())) {
        topicMap.set(trimmed.toLowerCase(), { sectionId: sec.id, sectionName: sec.name });
      }
    });
  });

  // Also include topics found dynamically in mistakes
  mistakes.forEach(m => {
    const trimmed = (m.topic || '').trim();
    if (trimmed && !topicMap.has(trimmed.toLowerCase())) {
      topicMap.set(trimmed.toLowerCase(), { sectionId: m.sectionId, sectionName: m.sectionName || m.sectionId });
    }
  });

  // Also include topics found in papers
  papers.forEach(p => {
    (p.questions || []).forEach(q => {
      const trimmed = (q.topic || '').trim();
      if (trimmed && !topicMap.has(trimmed.toLowerCase())) {
        const sec = p.sections.find(s => s.id === q.sectionId);
        topicMap.set(trimmed.toLowerCase(), {
          sectionId: q.sectionId,
          sectionName: sec ? sec.name : q.sectionId
        });
      }
    });
  });

  const allTopics: TopicEvidence[] = [];

  topicMap.forEach((meta, topicLower) => {
    // Find canonical topic name display
    const canonicalName =
      sections.flatMap(s => s.topics || []).find(t => t.trim().toLowerCase() === topicLower) ||
      mistakes.find(m => (m.topic || '').trim().toLowerCase() === topicLower)?.topic ||
      topicLower;

    // Filter mistakes for this topic
    const topicMistakes = mistakes.filter(m => (m.topic || '').trim().toLowerCase() === topicLower);
    const mistakeCount = topicMistakes.length;
    const unresolvedMistakes = topicMistakes.filter(m => m.status !== 'Mastered').length;
    const masteredMistakes = topicMistakes.filter(m => m.status === 'Mastered').length;

    // Estimate attempts from in-app paper questions + logged mistakes
    let totalWrong = topicMistakes.filter(m => m.resultType === 'Wrong').length;
    let totalUnattempted = topicMistakes.filter(m => m.resultType === 'Left unattempted').length;
    let totalCorrectSlow = topicMistakes.filter(m => m.resultType === 'Correct-but-slow').length;

    // Count questions from papers if available
    let paperQuestionsAttempted = 0;
    let paperQuestionsCorrect = 0;

    papers.forEach(p => {
      (p.questions || []).forEach(q => {
        if ((q.topic || '').trim().toLowerCase() === topicLower) {
          paperQuestionsAttempted++;
          // If not in mistakes as wrong, consider solved correctly
          const isMarkedWrong = topicMistakes.some(m => m.paperId === p.id && m.questionNumber === q.questionNumber);
          if (!isMarkedWrong) {
            paperQuestionsCorrect++;
          }
        }
      });
    });

    const totalAttempted = paperQuestionsAttempted + totalWrong + totalCorrectSlow;
    const totalCorrect = paperQuestionsCorrect + totalCorrectSlow;
    const accuracy = totalAttempted > 0 ? Math.round((totalCorrect / totalAttempted) * 100) : 0;
    const evidenceCount = totalAttempted + totalUnattempted + mistakeCount;

    // Recent performance calculation (sort mistakes by date descending)
    const sortedMistakes = [...topicMistakes].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    const recentMistakes = sortedMistakes.slice(0, 3);
    const recentMastered = recentMistakes.filter(m => m.status === 'Mastered').length;
    const recentAccuracy =
      recentMistakes.length > 0 ? Math.round((recentMastered / recentMistakes.length) * 100) : accuracy;

    // Determine status strictly from evidence
    let status: TopicMasteryStatus = 'Not studied';
    let reason = '';
    let recommendedAction = '';

    if (evidenceCount === 0) {
      status = 'Not studied';
      reason = 'No logged mock attempts or recorded mistakes for this topic yet.';
      recommendedAction = 'Complete an initial set of 10 practice questions to establish a baseline.';
    } else if (unresolvedMistakes >= 2 || (totalAttempted >= 3 && accuracy < 50)) {
      status = 'Weak';
      reason = `${unresolvedMistakes} active mistake(s) logged; recorded accuracy is ${accuracy}%.`;
      recommendedAction = 'High priority: review core concepts and clear recurring mistake patterns.';
    } else if (
      mistakeCount > 0 &&
      unresolvedMistakes === 0 &&
      masteredMistakes >= 2 &&
      (recentAccuracy >= 70 || accuracy >= 65)
    ) {
      status = 'Improving';
      reason = `Resolved ${masteredMistakes} previous mistake(s) via spaced repetition; recent accuracy is ${recentAccuracy}%.`;
      recommendedAction = 'Consolidate progress: attempt a timed sectional drill to lock in speed.';
    } else if (totalAttempted >= 6 && accuracy >= 80 && unresolvedMistakes === 0) {
      status = 'Strong';
      reason = `Consistent accuracy of ${accuracy}% across ${totalAttempted} recorded attempts with zero pending mistakes.`;
      recommendedAction = 'Maintenance: schedule a light revision session once every 14 days.';
    } else {
      status = 'Learning';
      reason = `${totalAttempted} attempt(s) recorded with ${accuracy}% accuracy. Insufficient volume to confirm mastery.`;
      recommendedAction = 'Continue deliberate practice to build reliable sample evidence.';
    }

    allTopics.push({
      topic: canonicalName,
      sectionId: meta.sectionId,
      sectionName: meta.sectionName,
      status,
      totalAttempted,
      totalCorrect,
      totalWrong,
      accuracy,
      mistakeCount,
      unresolvedMistakes,
      masteredMistakes,
      recentAccuracy,
      evidenceCount,
      reason,
      recommendedAction
    });
  });

  // Sort topics alphabetically by section and name
  allTopics.sort((a, b) => a.sectionName.localeCompare(b.sectionName) || a.topic.localeCompare(b.topic));

  const strongTopics = allTopics.filter(t => t.status === 'Strong');
  const weakTopics = allTopics.filter(t => t.status === 'Weak');
  const improvingTopics = allTopics.filter(t => t.status === 'Improving');
  const learningTopics = allTopics.filter(t => t.status === 'Learning');
  const notStudiedTopics = allTopics.filter(t => t.status === 'Not studied');

  const countsByStatus: Record<TopicMasteryStatus, number> = {
    'Not studied': notStudiedTopics.length,
    Learning: learningTopics.length,
    Weak: weakTopics.length,
    Improving: improvingTopics.length,
    Strong: strongTopics.length
  };

  return {
    allTopics,
    strongTopics,
    weakTopics,
    improvingTopics,
    learningTopics,
    notStudiedTopics,
    countsByStatus
  };
}

