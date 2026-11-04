import { MockTest, MistakeEntry, PaperAttempt, PaperTest, SectionConfig } from '../types';

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
  papers: PaperTest[] = [],
  paperAttempts: PaperAttempt[] = []
): TopicMasteryMatrix {
  // 1. Gather all unique topics mapped to their sections
  const topicMap = new Map<string, { sectionId: string; sectionName: string }>();

  // From section configurations
  sections.forEach((sec) => {
    (sec.topics || []).forEach((t) => {
      const trimmed = t.trim();
      if (trimmed && !topicMap.has(trimmed.toLowerCase())) {
        topicMap.set(trimmed.toLowerCase(), { sectionId: sec.id, sectionName: sec.name });
      }
    });
  });

  // Also include topics found dynamically in mistakes
  mistakes.forEach((m) => {
    const trimmed = (m.topic || '').trim();
    if (trimmed && !topicMap.has(trimmed.toLowerCase())) {
      topicMap.set(trimmed.toLowerCase(), { sectionId: m.sectionId, sectionName: m.sectionName || m.sectionId });
    }
  });

  // Also include topics found in papers
  papers.forEach((p) => {
    (p.questions || []).forEach((q) => {
      const trimmed = (q.topic || '').trim();
      if (trimmed && !topicMap.has(trimmed.toLowerCase())) {
        const sec = p.sections.find((s) => s.id === q.sectionId);
        topicMap.set(trimmed.toLowerCase(), {
          sectionId: q.sectionId,
          sectionName: sec ? sec.name : q.sectionId
        });
      }
    });
  });

  const allTopics: TopicEvidence[] = [];

  topicMap.forEach((meta, topicLower) => {
    // Canonical topic name display
    const canonicalName =
      sections.flatMap((s) => s.topics || []).find((t) => t.trim().toLowerCase() === topicLower) ||
      mistakes.find((m) => (m.topic || '').trim().toLowerCase() === topicLower)?.topic ||
      papers.flatMap((p) => p.questions || []).find((q) => (q.topic || '').trim().toLowerCase() === topicLower)?.topic ||
      topicLower;

    // Filter mistakes for this topic
    const topicMistakes = mistakes.filter((m) => (m.topic || '').trim().toLowerCase() === topicLower);
    const mistakeCount = topicMistakes.length;
    const unresolvedMistakes = topicMistakes.filter((m) => m.status !== 'Mastered').length;
    const masteredMistakes = topicMistakes.filter((m) => m.status === 'Mastered').length;

    // Paper questions for this topic across all papers
    const topicPaperQuestions: Array<{ paper: PaperTest; questionId: string; questionNumber: number }> = [];
    papers.forEach((p) => {
      (p.questions || []).forEach((q) => {
        if ((q.topic || '').trim().toLowerCase() === topicLower) {
          topicPaperQuestions.push({ paper: p, questionId: q.id, questionNumber: q.questionNumber });
        }
      });
    });

    // Explicit paper attempts for this topic
    const topicAttempts = paperAttempts.filter((attempt) => {
      if (attempt.topic && attempt.topic.trim().toLowerCase() === topicLower) return true;
      const paper = papers.find((p) => p.id === attempt.paperId);
      const question = paper?.questions.find((q) => q.id === attempt.questionId);
      return (question?.topic || '').trim().toLowerCase() === topicLower;
    });

    const coveredKeys = new Set(topicAttempts.map((a) => `${a.paperId}:${a.questionId}`));

    let paperQuestionsAttempted = 0;
    let paperQuestionsCorrect = 0;
    let paperQuestionsWrong = 0;
    let paperQuestionsUnattempted = 0;

    for (const a of topicAttempts) {
      if (a.selected !== null) {
        paperQuestionsAttempted++;
        if (a.correct) {
          paperQuestionsCorrect++;
        } else {
          paperQuestionsWrong++;
        }
      } else {
        paperQuestionsUnattempted++;
      }
    }

    // For paper questions without explicit paperAttempts entry (e.g. tests calling calculateTopicMastery without paperAttempts)
    for (const { paper, questionId, questionNumber } of topicPaperQuestions) {
      const key = `${paper.id}:${questionId}`;
      if (!coveredKeys.has(key)) {
        const m = topicMistakes.find(
          (mistake) =>
            mistake.paperId === paper.id &&
            (mistake.questionId === questionId || mistake.questionNumber === questionNumber)
        );
        if (m) {
          if (m.resultType === 'Wrong') {
            paperQuestionsAttempted++;
            paperQuestionsWrong++;
          } else if (m.resultType === 'Left unattempted') {
            paperQuestionsUnattempted++;
          } else if (m.resultType === 'Correct-but-slow') {
            paperQuestionsAttempted++;
            paperQuestionsCorrect++;
          }
        } else {
          // Solved correctly without mistake
          paperQuestionsAttempted++;
          paperQuestionsCorrect++;
        }
      }
    }

    // Non-paper mistakes (from mock tests or external imports not tied to paper questions)
    const nonPaperMistakes = topicMistakes.filter(
      (m) =>
        !m.paperId ||
        (!coveredKeys.has(`${m.paperId}:${m.questionId}`) &&
          !topicPaperQuestions.some((pq) => pq.paper.id === m.paperId))
    );

    const nonPaperWrong = nonPaperMistakes.filter((m) => m.resultType === 'Wrong').length;
    const nonPaperUnattempted = nonPaperMistakes.filter((m) => m.resultType === 'Left unattempted').length;
    const nonPaperCorrectSlow = nonPaperMistakes.filter((m) => m.resultType === 'Correct-but-slow').length;

    const totalAttempted = paperQuestionsAttempted + nonPaperWrong + nonPaperCorrectSlow;
    const totalCorrect = paperQuestionsCorrect + nonPaperCorrectSlow;
    const totalWrong = paperQuestionsWrong + nonPaperWrong;
    const totalUnattempted = paperQuestionsUnattempted + nonPaperUnattempted;

    const accuracy = totalAttempted > 0 ? Math.round((totalCorrect / totalAttempted) * 100) : 0;
    const evidenceCount = totalAttempted + totalUnattempted;

    // Recent performance calculation (sort mistakes by date descending)
    const sortedMistakes = [...topicMistakes].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    const recentMistakes = sortedMistakes.slice(0, 3);
    const recentMastered = recentMistakes.filter((m) => m.status === 'Mastered').length;
    const recentAccuracy =
      recentMistakes.length > 0 ? Math.round((recentMastered / recentMistakes.length) * 100) : accuracy;

    // Determine status strictly from evidence across all 5 states
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

  const strongTopics = allTopics.filter((t) => t.status === 'Strong');
  const weakTopics = allTopics.filter((t) => t.status === 'Weak');
  const improvingTopics = allTopics.filter((t) => t.status === 'Improving');
  const learningTopics = allTopics.filter((t) => t.status === 'Learning');
  const notStudiedTopics = allTopics.filter((t) => t.status === 'Not studied');

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
