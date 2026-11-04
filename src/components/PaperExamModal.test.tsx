import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { PaperExamModal } from './PaperExamModal';
import { db } from '../db/db';
import { PaperTest, ExamSettings } from '../types';

describe('PaperExamModal - Correctness & Idempotency', () => {
  const mockSettings: ExamSettings = {
    id: 'current',
    examName: 'IBPS PO Prelims',
    totalTimeMinutes: 60,
    targetScore: 70,
    overallCutoff: 50,
    sections: [
      { id: 'quant', name: 'Quantitative Aptitude', totalQuestions: 35, timeLimitMinutes: 20, marksPerCorrect: 1, negativeMark: 0.25, sectionalCutoff: 12, topics: ['DI'] }
    ],
    errorTypes: ['Calculation error', 'Concept gap']
  };

  const samplePaper: PaperTest = {
    id: 101,
    examName: 'SBI PO Prelims',
    year: 2024,
    shift: 'Shift 1',
    isMemoryBased: false,
    totalTimeMinutes: 20,
    sections: mockSettings.sections,
    questions: [
      {
        id: 'q1',
        sectionId: 'quant',
        questionNumber: 1,
        text: 'What is 2 + 2?',
        options: ['2', '3', '4', '5'],
        correctOptionIndex: 2,
        topic: 'Arithmetic',
        solution: '2 + 2 = 4'
      },
      {
        id: 'q2',
        sectionId: 'quant',
        questionNumber: 2,
        text: 'What is 3 * 3?',
        options: ['6', '8', '9', '12'],
        correctOptionIndex: 2,
        topic: 'Arithmetic',
        solution: '3 * 3 = 9'
      }
    ],
    createdAt: '2026-11-01'
  };

  beforeEach(async () => {
    await db.mocks.clear();
    await db.mistakes.clear();
    await db.paperAttempts.clear();
  });

  it('prevents duplicate mock creation on timeout or double submission in Strict Mode', async () => {
    const onFinished = vi.fn();
    const onClose = vi.fn();

    // With totalTimeMinutes: 0, secondsRemaining is 0 on mount, triggering timeout submission
    const timedOutPaper: PaperTest = {
      ...samplePaper,
      id: 999,
      totalTimeMinutes: 0
    };

    render(
      <React.StrictMode>
        <PaperExamModal
          isOpen={true}
          paper={timedOutPaper}
          settings={mockSettings}
          onClose={onClose}
          onFinished={onFinished}
        />
      </React.StrictMode>
    );

    // Give microtasks and Dexie transaction time to complete
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 80));
    });

    const mocks = await db.mocks.toArray();
    expect(mocks.length).toBe(1);
    expect(onFinished).toHaveBeenCalledTimes(1);
  });

  it('formats shift strings correctly without "Shift Shift 1" duplication', async () => {
    const paperWithShift: PaperTest = {
      ...samplePaper,
      id: 102,
      shift: 'Shift 2'
    };

    const onFinished = vi.fn();
    const onClose = vi.fn();

    render(
      <PaperExamModal
        isOpen={true}
        paper={paperWithShift}
        settings={mockSettings}
        onClose={onClose}
        onFinished={onFinished}
      />
    );

    // Click submit button in header
    const submitBtn = screen.getByRole('button', { name: /Submit Paper/i });
    fireEvent.click(submitBtn);

    // Click confirm submit in dialog
    const confirmBtn = screen.getByRole('button', { name: /Confirm Submit/i });
    await act(async () => {
      fireEvent.click(confirmBtn);
      await new Promise((resolve) => setTimeout(resolve, 80));
    });

    const mocks = await db.mocks.toArray();
    expect(mocks.length).toBe(1);
    expect(mocks[0].name).not.toContain('Shift Shift');
    expect(mocks[0].name).toContain('Shift 2');
  });

  it('accurately computes unattempted question counts and logs mistakes with Unclassified', async () => {
    const onFinished = vi.fn();
    const onClose = vi.fn();

    render(
      <PaperExamModal
        isOpen={true}
        paper={samplePaper}
        settings={mockSettings}
        onClose={onClose}
        onFinished={onFinished}
      />
    );

    // Answer Q1 with WRONG answer (Option 0: '2', while correct is Option 2: '4')
    const optionA = screen.getByRole('button', { name: /A2 1/i });
    fireEvent.click(optionA);

    // Leave Q2 unattempted
    const submitBtn = screen.getByRole('button', { name: /Submit Paper/i });
    fireEvent.click(submitBtn);

    const confirmBtn = screen.getByRole('button', { name: /Confirm Submit/i });
    await act(async () => {
      fireEvent.click(confirmBtn);
      await new Promise((resolve) => setTimeout(resolve, 80));
    });

    const mocks = await db.mocks.toArray();
    expect(mocks.length).toBe(1);
    expect(mocks[0].totalAttempted).toBe(1);
    expect(mocks[0].totalWrong).toBe(1);
    expect(mocks[0].totalUnattempted).toBe(1);
    expect(mocks[0].sections[0].unattempted).toBe(1);

    const mistakes = await db.mistakes.toArray();
    expect(mistakes.length).toBe(1);
    expect(mistakes[0].errorTypes).toEqual(['Unclassified']);
  });
});
