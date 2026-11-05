import { describe, it, expect } from 'vitest';
import {
  getCanonicalTopics,
  findTopic,
  getTopicsByCategory,
  getTopicsForExam,
  getCrossExamOverlap,
  getTopicOverlapDetails,
  getOverlapTaxonomySummary,
  computeCombinedTopicMastery,
  computeAllTopicsMastery,
  SUPPORTED_EXAMS
} from './topicGraph';
import { CanonicalTopic, SyllabusProgress, MistakeEntry } from '../types';

describe('Shared Topic Graph & Cross-Exam Overlap', () => {
  it('retrieves default canonical topics across Core CS, IT-officer, and Common categories', () => {
    const topics = getCanonicalTopics();
    expect(topics.length).toBeGreaterThanOrEqual(23);

    const coreCS = getTopicsByCategory('Core CS', topics);
    const itOfficer = getTopicsByCategory('IT-officer', topics);
    const common = getTopicsByCategory('Common', topics);

    expect(coreCS.length).toBeGreaterThan(0);
    expect(itOfficer.length).toBeGreaterThan(0);
    expect(common.length).toBeGreaterThan(0);
  });

  it('finds topics by id or name case-insensitively', () => {
    const byId = findTopic('dbms');
    expect(byId).toBeDefined();
    expect(byId?.name).toBe('Databases');

    const byName = findTopic('operating systems');
    expect(byName).toBeDefined();
    expect(byName?.id).toBe('os');
  });

  it('filters topics by exam tags', () => {
    const gateTopics = getTopicsForExam('gate-cs');
    const sebiTopics = getTopicsForExam('sebi-it');
    const ibpsTopics = getTopicsForExam('ibps-so-it');

    expect(gateTopics.length).toBeGreaterThan(0);
    expect(sebiTopics.length).toBeGreaterThan(0);
    expect(ibpsTopics.length).toBeGreaterThan(0);

    // Discrete math is gate-cs only
    expect(gateTopics.some(t => t.id === 'discrete_math')).toBe(true);
    expect(sebiTopics.some(t => t.id === 'discrete_math')).toBe(false);

    // Databases is in all three
    expect(gateTopics.some(t => t.id === 'dbms')).toBe(true);
    expect(sebiTopics.some(t => t.id === 'dbms')).toBe(true);
    expect(ibpsTopics.some(t => t.id === 'dbms')).toBe(true);
  });

  it('identifies 3-way Golden Core topics shared by GATE CS, SEBI IT, and IBPS SO IT', () => {
    const commonAllThree = getCrossExamOverlap(['gate-cs', 'sebi-it', 'ibps-so-it']);
    const ids = commonAllThree.map(t => t.id);

    expect(ids).toContain('coa');
    expect(ids).toContain('prog_ds');
    expect(ids).toContain('algorithms');
    expect(ids).toContain('os');
    expect(ids).toContain('dbms');
    expect(ids).toContain('cn');

    // Discrete math shouldn't be in 3-way overlap
    expect(ids).not.toContain('discrete_math');
  });

  it('calculates overlap details and percentages for a topic', () => {
    const details = getTopicOverlapDetails('algorithms');
    expect(details.overlapCount).toBe(3);
    expect(details.isCommonAcrossAll).toBe(true);
    expect(details.overlapPercentage).toBe(100);
    expect(details.subtopicCount).toBeGreaterThan(2);

    const discreteDetails = getTopicOverlapDetails('discrete_math');
    expect(discreteDetails.overlapCount).toBe(1);
    expect(discreteDetails.isCommonAcrossAll).toBe(false);
  });

  it('produces a full taxonomy summary across exams and categories', () => {
    const summary = getOverlapTaxonomySummary();
    expect(summary.totalTopics).toBeGreaterThanOrEqual(23);
    expect(summary.allThreeCount).toBeGreaterThanOrEqual(6);
    expect(summary.goldenCoreTopics.length).toBe(summary.allThreeCount);
    expect(summary.examBreakdown['gate-cs'].total).toBeGreaterThan(0);
    expect(summary.examBreakdown['sebi-it'].total).toBeGreaterThan(0);
    expect(summary.examBreakdown['ibps-so-it'].total).toBeGreaterThan(0);
  });
});

describe('Combined Topic Mastery Calculation', () => {
  const dummyTopic: CanonicalTopic = {
    id: 'dbms',
    name: 'Databases',
    category: 'Core CS',
    subtopics: ['SQL', 'Normalization', 'Indexing'],
    examTags: ['gate-cs', 'sebi-it', 'ibps-so-it'],
    overlapExams: ['gate-cs', 'sebi-it', 'ibps-so-it']
  };

  it('assigns "Not started" when zero activity and no progress exist', () => {
    const mastery = computeCombinedTopicMastery(dummyTopic, [], []);
    expect(mastery.masteryScore).toBe(0);
    expect(mastery.status).toBe('Not started');
    expect(mastery.totalMistakes).toBe(0);
  });

  it('computes combined mastery when syllabus progress is recorded across multiple exams', () => {
    const progress: SyllabusProgress[] = [
      {
        examId: 'gate-cs',
        stage: 'cbt',
        topicId: 'dbms',
        status: 'mastered',
        confidence: 90,
        pyqsSolved: 10,
        totalPyqs: 10,
        updatedAt: '2026-11-01'
      },
      {
        examId: 'sebi-it',
        stage: 'phase-2',
        topicId: 'dbms',
        status: 'in_progress',
        confidence: 60,
        pyqsSolved: 5,
        totalPyqs: 10,
        updatedAt: '2026-11-01'
      }
    ];

    const mastery = computeCombinedTopicMastery(dummyTopic, progress, []);
    expect(mastery.status).toBe('In progress');
    expect(mastery.masteryScore).toBeGreaterThanOrEqual(70);
    expect(mastery.syllabusStatuses['gate-cs']).toBe('mastered');
    expect(mastery.syllabusStatuses['sebi-it']).toBe('in_progress');
    expect(mastery.pyqsSolved).toBe(15);
  });

  it('penalizes mastery score and prevents "Mastered" status when unresolved mistakes exist', () => {
    const progress: SyllabusProgress[] = [
      {
        examId: 'gate-cs',
        stage: 'cbt',
        topicId: 'dbms',
        status: 'mastered',
        confidence: 95,
        pyqsSolved: 10,
        totalPyqs: 10,
        updatedAt: '2026-11-01'
      }
    ];

    const mistakes: (Partial<MistakeEntry> & { topic: string; status: any })[] = [
      {
        mockId: 1,
        topic: 'Databases',
        sectionId: 'cs',
        questionNumber: 1,
        questionText: 'Which normal form eliminates partial dependency?',
        myAnswer: '1NF',
        correctAnswer: '2NF',
        resultType: 'Wrong',
        status: 'Active',
        tags: [],
        createdAt: '2026-11-02'
      },
      {
        mockId: 1,
        topic: 'dbms',
        sectionId: 'cs',
        questionNumber: 2,
        questionText: 'B+ tree leaf nodes are connected via linked list.',
        myAnswer: 'False',
        correctAnswer: 'True',
        resultType: 'Wrong',
        status: 'Reviewing',
        tags: [],
        createdAt: '2026-11-02'
      }
    ];

    const mastery = computeCombinedTopicMastery(dummyTopic, progress, mistakes);
    expect(mastery.activeMistakes).toBe(2);
    // Unresolved mistakes cap mastery score at 75 and prevent "Mastered"
    expect(mastery.status).toBe('In progress');
    expect(mastery.masteryScore).toBeLessThanOrEqual(75);
  });

  it('awards mastery when syllabus is mastered, confidence is high, and mistakes are resolved', () => {
    const progress: SyllabusProgress[] = [
      {
        examId: 'gate-cs',
        stage: 'cbt',
        topicId: 'dbms',
        status: 'mastered',
        confidence: 90,
        pyqsSolved: 20,
        totalPyqs: 20,
        updatedAt: '2026-11-01'
      }
    ];

    const mistakes: (Partial<MistakeEntry> & { topic: string; status: any })[] = [
      {
        mockId: 1,
        topic: 'Databases',
        sectionId: 'cs',
        questionNumber: 1,
        questionText: 'SQL query',
        myAnswer: 'A',
        correctAnswer: 'B',
        resultType: 'Wrong',
        status: 'Mastered', // Resolved via SRS!
        tags: [],
        createdAt: '2026-11-01'
      }
    ];

    const mastery = computeCombinedTopicMastery(dummyTopic, progress, mistakes);
    expect(mastery.activeMistakes).toBe(0);
    expect(mastery.masteredMistakes).toBe(1);
    expect(mastery.masteryScore).toBeGreaterThanOrEqual(80);
    expect(mastery.status).toBe('Mastered');
  });

  it('computes mastery for all topics in batch', () => {
    const all = computeAllTopicsMastery();
    expect(all.length).toBeGreaterThanOrEqual(23);
    for (const item of all) {
      expect(item.topicId).toBeDefined();
      expect(item.masteryScore).toBeGreaterThanOrEqual(0);
      expect(item.masteryScore).toBeLessThanOrEqual(100);
    }
  });
});
