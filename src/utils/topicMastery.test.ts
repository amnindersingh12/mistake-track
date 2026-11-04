import { describe, it, expect } from 'vitest';
import { calculateTopicMastery } from './topicMastery';
import { SectionConfig, MistakeEntry, PaperTest } from '../types';

describe('Evidence-Based Topic Mastery Matrix', () => {
  const mockSections: SectionConfig[] = [
    {
      id: 'quant',
      name: 'Quantitative Aptitude',
      totalQuestions: 35,
      marksPerCorrect: 1,
      negativeMark: 0.25,
      timeLimitMinutes: 20,
      sectionalCutoff: 10,
      topics: ['Percentage', 'Profit & Loss', 'Number System', 'Simplification']
    }
  ];

  it('assigns "Not studied" when zero evidence exists', () => {
    const matrix = calculateTopicMastery(mockSections, [], [], []);
    const percentage = matrix.allTopics.find(t => t.topic === 'Percentage');
    expect(percentage).toBeDefined();
    expect(percentage?.status).toBe('Not studied');
    expect(percentage?.evidenceCount).toBe(0);
    expect(matrix.countsByStatus['Not studied']).toBe(4);
  });

  it('assigns "Weak" when unresolved mistakes are 2 or more', () => {
    const mistakes: MistakeEntry[] = [
      {
        mockId: 1,
        mockName: 'Mock 1',
        sectionId: 'quant',
        sectionName: 'Quantitative Aptitude',
        topic: 'Percentage',
        questionNumber: 5,
        questionText: 'Find 20% of 400',
        myAnswer: '70',
        correctAnswer: '80',
        resultType: 'Wrong',
        errorTypes: ['Calculation mistake'],
        timeSpentSeconds: 40,
        idealTimeSeconds: 30,
        whatWentWrong: 'Multiplication error',
        correctSolution: '400 * 0.2 = 80',
        betterApproach: 'Divide by 5',
        ruleToRemember: '20% = 1/5',
        difficulty: 'Easy',
        tags: [],
        status: 'Reviewing',
        interval: 1,
        consecutiveCorrect: 0,
        nextReviewDate: '2026-11-05',
        history: [],
        createdAt: '2026-11-01'
      },
      {
        mockId: 2,
        mockName: 'Mock 2',
        sectionId: 'quant',
        sectionName: 'Quantitative Aptitude',
        topic: 'Percentage',
        questionNumber: 12,
        questionText: 'Price increases by 25%',
        myAnswer: '150',
        correctAnswer: '125',
        resultType: 'Wrong',
        errorTypes: ['Misread question'],
        timeSpentSeconds: 50,
        idealTimeSeconds: 35,
        whatWentWrong: 'Did not notice base price',
        correctSolution: '100 * 1.25 = 125',
        betterApproach: 'Fraction multiplier 5/4',
        ruleToRemember: '+25% = 5/4',
        difficulty: 'Medium',
        tags: [],
        status: 'Reviewing',
        interval: 1,
        consecutiveCorrect: 0,
        nextReviewDate: '2026-11-05',
        history: [],
        createdAt: '2026-11-02'
      }
    ];

    const matrix = calculateTopicMastery(mockSections, [], mistakes, []);
    const percentage = matrix.allTopics.find(t => t.topic === 'Percentage');
    expect(percentage?.status).toBe('Weak');
    expect(percentage?.unresolvedMistakes).toBe(2);
    expect(matrix.weakTopics.some(t => t.topic === 'Percentage')).toBe(true);
  });

  it('assigns "Improving" when previous mistakes are mastered via spaced repetition', () => {
    const mistakes: MistakeEntry[] = [
      {
        mockId: 1,
        mockName: 'Mock 1',
        sectionId: 'quant',
        sectionName: 'Quantitative Aptitude',
        topic: 'Profit & Loss',
        questionNumber: 3,
        questionText: 'Cost price problem',
        myAnswer: '200',
        correctAnswer: '240',
        resultType: 'Wrong',
        errorTypes: ['Formula forgotten'],
        timeSpentSeconds: 60,
        idealTimeSeconds: 40,
        whatWentWrong: 'Used selling price in denominator',
        correctSolution: 'Profit = (SP - CP) / CP * 100',
        betterApproach: 'Ratio method',
        ruleToRemember: 'Always base on CP',
        difficulty: 'Medium',
        tags: [],
        status: 'Mastered',
        interval: 14,
        consecutiveCorrect: 3,
        nextReviewDate: '2026-11-20',
        history: [{ date: '2026-11-03', result: 'got-it' }],
        createdAt: '2026-10-20'
      },
      {
        mockId: 2,
        mockName: 'Mock 2',
        sectionId: 'quant',
        sectionName: 'Quantitative Aptitude',
        topic: 'Profit & Loss',
        questionNumber: 8,
        questionText: 'Discount problem',
        myAnswer: '10%',
        correctAnswer: '15%',
        resultType: 'Wrong',
        errorTypes: ['Silly/careless'],
        timeSpentSeconds: 45,
        idealTimeSeconds: 30,
        whatWentWrong: 'Calculation rush',
        correctSolution: 'Direct subtraction',
        betterApproach: 'Successive discount formula',
        ruleToRemember: 'd1 + d2 - d1*d2/100',
        difficulty: 'Easy',
        tags: [],
        status: 'Mastered',
        interval: 14,
        consecutiveCorrect: 3,
        nextReviewDate: '2026-11-20',
        history: [{ date: '2026-11-03', result: 'got-it' }],
        createdAt: '2026-10-25'
      }
    ];

    const matrix = calculateTopicMastery(mockSections, [], mistakes, []);
    const pl = matrix.allTopics.find(t => t.topic === 'Profit & Loss');
    expect(pl?.status).toBe('Improving');
    expect(pl?.masteredMistakes).toBe(2);
  });

  it('assigns "Strong" only when sufficient sample volume and high accuracy exist', () => {
    // 8 questions in paper for Simplification, all solved without mistakes
    const paper: PaperTest = {
      id: 1,
      examName: 'SBI PO Prelims 2023',
      year: 2023,
      isMemoryBased: false,
      totalTimeMinutes: 20,
      sections: mockSections,
      createdAt: '2026-11-01',
      questions: Array.from({ length: 8 }, (_, idx) => ({
        id: `q${idx + 1}`,
        sectionId: 'quant',
        questionNumber: idx + 1,
        text: `Simplification question ${idx + 1}`,
        options: ['10', '20', '30', '40'],
        correctOptionIndex: 0,
        topic: 'Simplification'
      }))
    };

    const matrix = calculateTopicMastery(mockSections, [], [], [paper]);
    const simp = matrix.allTopics.find(t => t.topic === 'Simplification');
    expect(simp?.status).toBe('Strong');
    expect(simp?.accuracy).toBe(100);
    expect(simp?.totalAttempted).toBe(8);
  });

  it('assigns "Learning" when sample volume is small (< 5)', () => {
    const paper: PaperTest = {
      id: 1,
      examName: 'SBI PO Prelims 2023',
      year: 2023,
      isMemoryBased: false,
      totalTimeMinutes: 20,
      sections: mockSections,
      createdAt: '2026-11-01',
      questions: [
        {
          id: 'q1',
          sectionId: 'quant',
          questionNumber: 1,
          text: 'Number system question 1',
          options: ['2', '3', '5', '7'],
          correctOptionIndex: 0,
          topic: 'Number System'
        }
      ]
    };

    const matrix = calculateTopicMastery(mockSections, [], [], [paper]);
    const ns = matrix.allTopics.find(t => t.topic === 'Number System');
    // Only 1 attempt: not enough to confirm strong, so it is Learning
    expect(ns?.status).toBe('Learning');
    expect(ns?.totalAttempted).toBe(1);
  });
});

