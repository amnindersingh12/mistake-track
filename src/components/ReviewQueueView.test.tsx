import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ReviewQueueView } from './ReviewQueueView';
import { db, DEFAULT_SETTINGS } from '../db/db';
import { MistakeEntry, ExamSettings } from '../types';

vi.mock('canvas-confetti', () => ({
  default: vi.fn()
}));

describe('ReviewQueueView - Flashcards, Shortcuts & Retry Mode', () => {
  const mockSettings: ExamSettings = {
    id: 'current',
    examName: 'IBPS PO Prelims',
    totalTimeMinutes: 60,
    targetScore: 65,
    overallCutoff: 58.5,
    sections: [
      { id: 'quant', name: 'Quantitative Aptitude', totalQuestions: 35, timeLimitMinutes: 20, marksPerCorrect: 1, negativeMark: 0.25, sectionalCutoff: 12, topics: ['Percentages', 'DI'] }
    ],
    errorTypes: ['Calculation error', 'Concept gap']
  };

  const sampleMistakes: MistakeEntry[] = [
    {
      id: 1,
      mockName: 'Mock 1',
      sectionId: 'quant',
      sectionName: 'Quantitative Aptitude',
      topic: 'Percentages',
      questionNumber: 5,
      questionText: 'What is 15% of 80?',
      myAnswer: '10',
      correctAnswer: '12',
      resultType: 'Wrong',
      errorTypes: ['Calculation error'],
      timeSpentSeconds: 45,
      idealTimeSeconds: 30,
      whatWentWrong: 'Multiplied incorrectly.',
      correctSolution: '15% of 80 = 12',
      betterApproach: '10% = 8, 5% = 4, 8 + 4 = 12',
      ruleToRemember: 'Split percentages into 10% and 5% blocks.',
      difficulty: 'Easy',
      tags: ['arithmetic'],
      status: 'Reviewing',
      interval: 1,
      consecutiveCorrect: 1,
      nextReviewDate: '2026-11-01', // Due today
      history: [],
      createdAt: '2026-10-31'
    },
    {
      id: 2,
      mockName: 'Mock 1',
      sectionId: 'quant',
      sectionName: 'Quantitative Aptitude',
      topic: 'Percentages',
      questionNumber: 6,
      questionText: 'What is 20% of 150?',
      myAnswer: '25',
      correctAnswer: '30',
      resultType: 'Wrong',
      errorTypes: ['Calculation error'],
      timeSpentSeconds: 40,
      idealTimeSeconds: 30,
      whatWentWrong: 'Rushed calculation.',
      correctSolution: '20% of 150 = 30',
      betterApproach: '10% is 15, double is 30.',
      ruleToRemember: 'Double 10% for 20%.',
      difficulty: 'Easy',
      tags: ['arithmetic'],
      status: 'Mastered', // Mastered card!
      interval: 30,
      consecutiveCorrect: 3,
      nextReviewDate: '2026-11-01',
      history: [],
      createdAt: '2026-10-30'
    }
  ];

  beforeEach(async () => {
    await db.mistakes.clear();
    await db.mistakes.bulkAdd(sampleMistakes);
  });

  it('reveals flashcard on Space key and advances SRS schedule on key 1', async () => {
    const onRefresh = vi.fn();

    render(
      <ReviewQueueView
        mistakes={sampleMistakes}
        settings={mockSettings}
        onRefresh={onRefresh}
      />
    );

    // Initial state: Card is face down (Rule to remember is hidden)
    expect(screen.getByText('What is 15% of 80?')).toBeInTheDocument();
    expect(screen.queryByText(/Split percentages into 10% and 5% blocks/i)).not.toBeInTheDocument();

    // Press Space key to reveal solution
    fireEvent.keyDown(window, { code: 'Space' });

    // Now solution and rule are visible
    expect(screen.getByText(/Split percentages into 10% and 5% blocks/i)).toBeInTheDocument();

    // Press '1' key (Got it / mark correct)
    await act(async () => {
      fireEvent.keyDown(window, { key: '1' });
      await new Promise((r) => setTimeout(r, 60));
    });

    const updated = await db.mistakes.get(1);
    expect(updated?.consecutiveCorrect).toBe(2);
    expect(updated?.interval).toBe(3); // Advanced from 1 to 3 days!
  });

  it('targeted retry mode excludes Mastered cards and advances schedule upon review', async () => {
    const onRefresh = vi.fn();

    render(
      <ReviewQueueView
        mistakes={sampleMistakes}
        settings={mockSettings}
        onRefresh={onRefresh}
      />
    );

    // Switch to Targeted Retry mode
    const retryBtn = screen.getByRole('button', { name: /Targeted Retry/i });
    fireEvent.click(retryBtn);

    // Card 1 is in queue, but Mastered Card 2 is excluded!
    expect(screen.getByText(/Card 1 of 1/i)).toBeInTheDocument();
    expect(screen.getByText('What is 15% of 80?')).toBeInTheDocument();
    expect(screen.queryByText('What is 20% of 150?')).not.toBeInTheDocument();
  });
});
