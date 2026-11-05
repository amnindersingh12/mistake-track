import { describe, it, expect } from 'vitest';
import { planMistakeRepairs } from './repairMistakes';
import { MistakeEntry } from '../types';

describe('planMistakeRepairs', () => {
  it('repairs a mistake with 9 options (mixed English and Hindi duplicates)', () => {
    const rawMistake: MistakeEntry = {
      id: 1,
      mockName: 'SEBI IT Mock 1',
      sectionId: 'cs',
      sectionName: 'Computer Science',
      topic: 'DBMS',
      questionNumber: 1,
      questionText: `Which normal form eliminates partial dependency?

Options:
1. First Normal Form
2. Second Normal Form [Correct]
3. Third Normal Form
4. BCNF
5. None of the above
6. प्रथम सामान्य रूप
7. द्वितीय सामान्य रूप
8. तृतीय सामान्य रूप
9. इनमें से कोई नहीं`,
      myAnswer: '1. First Normal Form',
      correctAnswer: '2. Second Normal Form',
      resultType: 'Wrong',
      errorTypes: ['Concept gap'],
      timeSpentSeconds: 40,
      idealTimeSeconds: 30,
      whatWentWrong: 'Chose 1NF',
      correctSolution: '2NF removes partial dependency.',
      betterApproach: '',
      ruleToRemember: '2NF = 1NF + no partial dependency',
      difficulty: 'Medium',
      tags: ['dbms'],
      status: 'New',
      interval: 1,
      consecutiveCorrect: 0,
      nextReviewDate: '2026-11-06',
      createdAt: '2026-11-05',
      history: []
    };

    const plan = planMistakeRepairs([rawMistake]);
    expect(plan.totalScanned).toBe(1);
    expect(plan.affectedCount).toBe(1);
    expect(plan.previews.length).toBe(1);

    const repaired = plan.repairedRecords[0];
    expect(repaired.needsReview).toBe(false);
    expect(repaired.correctAnswer).toBe('Second Normal Form');
    expect(repaired.myAnswer).toBe('First Normal Form');

    // Check that questionText only has the 5 English options
    expect(repaired.questionText).toContain('A. First Normal Form [Selected]');
    expect(repaired.questionText).toContain('B. Second Normal Form [Correct]');
    expect(repaired.questionText).toContain('C. Third Normal Form');
    expect(repaired.questionText).toContain('D. BCNF');
    expect(repaired.questionText).toContain('E. None of the above');
    expect(repaired.questionText).not.toContain('सामान्य रूप');

    // Run a second time: Must be completely idempotent!
    const plan2 = planMistakeRepairs([repaired]);
    expect(plan2.affectedCount).toBe(0);
    expect(plan2.repairedRecords[0]).toEqual(repaired);
  });

  it('flags as needsReview and routes to inbox if remaining options count < 2 or > 5', () => {
    const rawMistake: MistakeEntry = {
      id: 2,
      mockName: 'SEBI IT Mock 2',
      sectionId: 'cs',
      sectionName: 'Computer Science',
      topic: 'OS',
      questionNumber: 2,
      questionText: `What is a semaphore?

Options:
1. Synchronization tool`,
      myAnswer: '1. Synchronization tool',
      correctAnswer: '1. Synchronization tool',
      resultType: 'Correct-but-slow',
      errorTypes: ['Concept gap'],
      timeSpentSeconds: 60,
      idealTimeSeconds: 30,
      whatWentWrong: '',
      correctSolution: '',
      betterApproach: '',
      ruleToRemember: '',
      difficulty: 'Medium',
      tags: ['os'],
      status: 'New',
      interval: 1,
      consecutiveCorrect: 0,
      nextReviewDate: '2026-11-06',
      createdAt: '2026-11-05',
      history: []
    };

    const plan = planMistakeRepairs([rawMistake]);
    expect(plan.affectedCount).toBe(1);
    const repaired = plan.repairedRecords[0];
    expect(repaired.needsReview).toBe(true);
    expect(repaired.status).toBe('inbox');
    expect(repaired.reviewReason).toContain('1 options found, expected 2 to 5');
  });

  it('leaves already clean mistakes unaffected (safe to run repeatedly)', () => {
    const cleanMistake: MistakeEntry = {
      id: 3,
      mockName: 'IBPS SO IT Mock',
      sectionId: 'cs',
      sectionName: 'Computer Science',
      topic: 'Networks',
      questionNumber: 3,
      questionText: `Which layer is responsible for routing?

Options:
A. Physical Layer
B. Data Link Layer
C. Network Layer [Correct]
D. Transport Layer [Selected]`,
      myAnswer: 'Transport Layer',
      correctAnswer: 'Network Layer',
      resultType: 'Wrong',
      errorTypes: ['Concept gap'],
      timeSpentSeconds: 25,
      idealTimeSeconds: 20,
      whatWentWrong: '',
      correctSolution: '',
      betterApproach: '',
      ruleToRemember: '',
      difficulty: 'Easy',
      tags: ['networking'],
      status: 'New',
      interval: 1,
      consecutiveCorrect: 0,
      nextReviewDate: '2026-11-06',
      createdAt: '2026-11-05',
      history: [],
      needsReview: false
    };

    const plan = planMistakeRepairs([cleanMistake]);
    expect(plan.affectedCount).toBe(0);
    expect(plan.previews.length).toBe(0);
  });
});
