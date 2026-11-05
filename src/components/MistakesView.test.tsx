import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import { MistakesView } from './MistakesView';
import { db, DEFAULT_SETTINGS } from '../db/db';
import { MistakeEntry, ExamSettings, MockTest } from '../types';

describe('MistakesView - Capture, Filters, Review State & Sorting', () => {
  const mockSettings: ExamSettings = {
    id: 'current',
    examName: 'IBPS PO Prelims',
    totalTimeMinutes: 60,
    targetScore: 65,
    overallCutoff: 58.5,
    sections: [
      { id: 'quant', name: 'Quantitative Aptitude', totalQuestions: 35, timeLimitMinutes: 20, marksPerCorrect: 1, negativeMark: 0.25, sectionalCutoff: 12, topics: ['Percentages', 'DI'] },
      { id: 'reasoning', name: 'Reasoning Ability', totalQuestions: 35, timeLimitMinutes: 20, marksPerCorrect: 1, negativeMark: 0.25, sectionalCutoff: 14, topics: ['Puzzles', 'Syllogism'] }
    ],
    errorTypes: ['Calculation error', 'Concept gap', 'Formula forgotten']
  };

  const sampleMocks: MockTest[] = [
    {
      id: 10,
      name: 'Testbook Mock 01',
      date: '2026-11-01',
      source: 'Testbook',
      attemptType: 'mock',
      sections: [],
      totalAttempted: 50,
      totalCorrect: 40,
      totalWrong: 10,
      totalUnattempted: 50,
      totalNetScore: 37.5,
      overallAccuracy: 80,
      totalMarksLostNegative: 2.5,
      totalTimeSpentSeconds: 3600
    }
  ];

  const sampleMistakes: MistakeEntry[] = [
    {
      id: 1,
      mockId: 10,
      mockName: 'Testbook Mock 01',
      sectionId: 'quant',
      sectionName: 'Quantitative Aptitude',
      topic: 'Percentages',
      subtopic: 'Successive Change',
      questionNumber: 12,
      questionText: 'Population increased by 10% then decreased by 10%.',
      myAnswer: 'No change',
      correctAnswer: 'Net 1% decrease',
      resultType: 'Wrong',
      errorTypes: ['Formula forgotten'],
      timeSpentSeconds: 90,
      idealTimeSeconds: 40,
      whatWentWrong: 'Thought +10% and -10% cancel out.',
      correctSolution: 'x + y + xy/100 = 10 - 10 - 100/100 = -1%.',
      betterApproach: 'Apply net change formula directly.',
      ruleToRemember: 'Equal increase and decrease always yields a net loss of x^2/100 %.',
      difficulty: 'Hard',
      tags: ['percentages', 'algebra'],
      status: 'Reviewing',
      interval: 7,
      consecutiveCorrect: 2,
      lastReviewedAt: '2026-11-02',
      nextReviewDate: '2026-11-09',
      history: [],
      createdAt: '2026-11-04'
    },
    {
      id: 2,
      mockName: 'Testbook Mock 01',
      sectionId: 'reasoning',
      sectionName: 'Reasoning Ability',
      topic: 'Syllogism',
      questionNumber: 22,
      questionText: 'Some cats are dogs. All dogs are birds.',
      myAnswer: 'Conclusion II follows',
      correctAnswer: 'Both I and II follow',
      resultType: 'Wrong',
      errorTypes: ['Unclassified'],
      timeSpentSeconds: 40,
      idealTimeSeconds: 35,
      whatWentWrong: 'Missed Venn intersection.',
      correctSolution: 'Overlap implies sub-conclusion.',
      betterApproach: 'Draw 2-circle Venn diagram.',
      ruleToRemember: 'Some + All = Some.',
      difficulty: 'Easy',
      tags: ['syllogism'],
      status: 'New',
      interval: 1,
      consecutiveCorrect: 0,
      nextReviewDate: '2026-11-03',
      history: [],
      createdAt: '2026-11-03'
    }
  ];

  beforeEach(async () => {
    await db.mocks.clear();
    await db.mistakes.clear();
    await db.mocks.bulkAdd(sampleMocks);
    await db.mistakes.bulkAdd(sampleMistakes);
  });

  it('filters mistakes by section, status, tags, and sorts by time spent', () => {
    const onRefresh = vi.fn();
    render(
      <MistakesView
        mistakes={sampleMistakes}
        mocks={sampleMocks}
        settings={mockSettings}
        onRefresh={onRefresh}
      />
    );

    // Initial view: both mistakes present
    expect(screen.getByText(/Population increased by 10%/i)).toBeInTheDocument();
    expect(screen.getByText(/Some cats are dogs/i)).toBeInTheDocument();

    // Filter by Section: Reasoning Ability
    const sectionSelect = screen.getByRole('combobox', { name: /Filter by section/i });
    fireEvent.change(sectionSelect, { target: { value: 'reasoning' } });

    expect(screen.queryByText(/Population increased by 10%/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Some cats are dogs/i)).toBeInTheDocument();

    // Reset section filter and filter by Tag: algebra
    fireEvent.change(sectionSelect, { target: { value: 'all' } });
    const tagSelect = screen.getByRole('combobox', { name: /Filter by tag/i });
    fireEvent.change(tagSelect, { target: { value: 'algebra' } });

    expect(screen.getByText(/Population increased by 10%/i)).toBeInTheDocument();
    expect(screen.queryByText(/Some cats are dogs/i)).not.toBeInTheDocument();
  });

  it('defaults unset error types to Unclassified without silent Concept gap', async () => {
    const onRefresh = vi.fn();
    render(
      <MistakesView
        mistakes={sampleMistakes}
        mocks={sampleMocks}
        settings={mockSettings}
        onRefresh={onRefresh}
      />
    );

    // Click Log Mistake button
    const addBtn = screen.getByRole('button', { name: /Log Mistake/i });
    fireEvent.click(addBtn);

    // Verify modal is open and shows Unclassified
    expect(screen.getByText(/Root-Cause Error Types \(Unclassified\)/i)).toBeInTheDocument();

    // Fill required fields
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. Option B/i), { target: { value: 'Wrong opt' } });
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. Option C/i), { target: { value: 'Correct opt' } });
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. Misread 72 km\/h/i), { target: { value: 'Calculated wrong.' } });
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. Speed in km\/h/i), { target: { value: 'Always check signs.' } });

    // Submit form without choosing any error type buttons
    const submitBtn = screen.getByRole('button', { name: /Save Mistake/i });
    await act(async () => {
      fireEvent.click(submitBtn);
      await new Promise((r) => setTimeout(r, 60));
    });

    const mistakes = await db.mistakes.toArray();
    const created = mistakes.find((m) => m.ruleToRemember === 'Always check signs.');
    expect(created).toBeDefined();
    expect(created?.errorTypes).toEqual(['Unclassified']);
  });

  it('editing mistake preserves review state unless Reset schedule is checked', async () => {
    const onRefresh = vi.fn();
    render(
      <MistakesView
        mistakes={sampleMistakes}
        mocks={sampleMocks}
        settings={mockSettings}
        onRefresh={onRefresh}
      />
    );

    // Click Edit on Mistake #1 (which is first in list: Nov 04 vs Nov 03)
    const editBtns = screen.getAllByRole('button', { name: /Edit Mistake/i });
    await act(async () => {
      fireEvent.click(editBtns[0]);
    });

    // Change Rule to remember without ticking reset schedule
    const ruleInput = screen.getByDisplayValue('Equal increase and decrease always yields a net loss of x^2/100 %.');
    fireEvent.change(ruleInput, { target: { value: 'Updated rule text.' } });

    const submitBtn = screen.getByRole('button', { name: /Save Mistake/i });
    await act(async () => {
      fireEvent.click(submitBtn);
      await new Promise((r) => setTimeout(r, 60));
    });

    const updated = await db.mistakes.get(1);
    expect(updated?.ruleToRemember).toBe('Updated rule text.');
    // Review schedule preserved!
    expect(updated?.interval).toBe(7);
    expect(updated?.consecutiveCorrect).toBe(2);
    expect(updated?.status).toBe('Reviewing');
  });

  it('quick-add mistake creates mistake entry with Unclassified fallback and advances counter', async () => {
    const onRefresh = vi.fn();
    render(
      <MistakesView
        mistakes={sampleMistakes}
        mocks={sampleMocks}
        settings={mockSettings}
        onRefresh={onRefresh}
        isQuickAddOpenDirectly={true}
      />
    );

    // Quick add dialog is open
    expect(screen.getByText(/Quick Log Mistake/i)).toBeInTheDocument();

    // Type quick rule
    const ruleInput = screen.getByPlaceholderText(/e\.g\. In successive discounts apply AB rule/i);
    fireEvent.change(ruleInput, { target: { value: 'Quick rule for ratio.' } });

    // Click Quick-Save button
    const quickSaveBtn = screen.getByRole('button', { name: /Log & Next/i });
    await act(async () => {
      fireEvent.click(quickSaveBtn);
      await new Promise((r) => setTimeout(r, 60));
    });

    const mistakes = await db.mistakes.toArray();
    const quickCreated = mistakes.find((m) => m.ruleToRemember === 'Quick rule for ratio.');
    expect(quickCreated).toBeDefined();
    expect(quickCreated?.errorTypes).toEqual(['Unclassified']);
    expect(quickCreated?.status).toBe('New');
  });

  it('filters mistakes by question type (MCQ, MSQ, NAT, descriptive)', () => {
    const onRefresh = vi.fn();
    const typedMistakes: MistakeEntry[] = [
      {
        ...sampleMistakes[0],
        id: 101,
        questionType: 'MCQ',
        questionText: 'Which data structure is LIFO?'
      },
      {
        ...sampleMistakes[0],
        id: 102,
        questionType: 'MSQ',
        questionText: 'Select all NP-complete problems in the following list.'
      },
      {
        ...sampleMistakes[0],
        id: 103,
        questionType: 'NAT',
        questionText: 'Calculate the total number of page faults with FIFO.'
      }
    ];

    render(
      <MistakesView
        mistakes={typedMistakes}
        mocks={sampleMocks}
        settings={mockSettings}
        onRefresh={onRefresh}
      />
    );

    // Initial: all visible
    expect(screen.getByText(/Which data structure is LIFO\?/i)).toBeInTheDocument();
    expect(screen.getByText(/Select all NP-complete problems/i)).toBeInTheDocument();
    expect(screen.getByText(/Calculate the total number of page faults/i)).toBeInTheDocument();

    // Filter by MSQ
    const qTypeSelect = screen.getByRole('combobox', { name: /Filter by question type/i });
    fireEvent.change(qTypeSelect, { target: { value: 'MSQ' } });

    expect(screen.queryByText(/Which data structure is LIFO\?/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Select all NP-complete problems/i)).toBeInTheDocument();
    expect(screen.queryByText(/Calculate the total number of page faults/i)).not.toBeInTheDocument();

    // Filter by NAT
    fireEvent.change(qTypeSelect, { target: { value: 'NAT' } });
    expect(screen.queryByText(/Select all NP-complete problems/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Calculate the total number of page faults/i)).toBeInTheDocument();
  });

  it('renders CS_ERROR_TYPES as selectable pills and saves multi-selected error types', async () => {
    const onRefresh = vi.fn();
    render(
      <MistakesView
        mistakes={sampleMistakes}
        mocks={sampleMocks}
        settings={mockSettings}
        onRefresh={onRefresh}
      />
    );

    // Open Full Add Modal
    const addBtn = screen.getByRole('button', { name: /Log Mistake/i });
    fireEvent.click(addBtn);

    // Verify CS error type pills are present
    expect(screen.getByRole('button', { name: /\+ Trace\/execution error/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /\+ Misread constraint/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /\+ Missed MSQ option/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /\+ NAT calculation slip/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /\+ Overthinking/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /\+ Trick not known/i })).toBeInTheDocument();

    // Multi-select error types: click "Trace/execution error" and "Misread constraint"
    fireEvent.click(screen.getByRole('button', { name: /\+ Trace\/execution error/i }));
    fireEvent.click(screen.getByRole('button', { name: /\+ Misread constraint/i }));

    // Both should now show checked
    expect(screen.getByRole('button', { name: /✓ Trace\/execution error/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /✓ Misread constraint/i })).toBeInTheDocument();

    // Fill form and save
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. Option B/i), { target: { value: 'Stack' } });
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. Option C/i), { target: { value: 'Queue' } });
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. Misread 72 km\/h/i), { target: { value: 'Traced loop bounds wrongly.' } });
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. Speed in km\/h/i), { target: { value: 'Always check strict vs non-strict inequalities.' } });

    const submitBtn = screen.getByRole('button', { name: /Save Mistake/i });
    await act(async () => {
      fireEvent.click(submitBtn);
      await new Promise((r) => setTimeout(r, 60));
    });

    const mistakes = await db.mistakes.toArray();
    const saved = mistakes.find((m) => m.ruleToRemember === 'Always check strict vs non-strict inequalities.');
    expect(saved).toBeDefined();
    expect(saved?.errorTypes).toContain('Trace/execution error');
    expect(saved?.errorTypes).toContain('Misread constraint');
  });

  it('saves and renders MSQ with QuestionRenderer diagnostics', async () => {
    const onRefresh = vi.fn();
    render(
      <MistakesView
        mistakes={sampleMistakes}
        mocks={sampleMocks}
        settings={mockSettings}
        onRefresh={onRefresh}
      />
    );

    // Open Full Add Modal
    const addBtn = screen.getByRole('button', { name: /Log Mistake/i });
    fireEvent.click(addBtn);

    // Choose Question Type: MSQ
    const qTypeSelect = screen.getByRole('combobox', { name: /^Question Type$/i });
    fireEvent.change(qTypeSelect, { target: { value: 'MSQ' } });

    // Diagnostic fields appear
    expect(screen.getByText(/MSQ Option Diagnostics/i)).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. Option B, Option D/i), { target: { value: 'Option C' } });
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. Option A/i), { target: { value: 'Option B' } });

    // Fill required fields
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. Option B \(45 km\/h\)/i), { target: { value: 'A, C' } });
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. Option C \(54 km\/h\)/i), { target: { value: 'A, B' } });
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. Misread 72 km\/h/i), { target: { value: 'Missed option B.' } });
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. Speed in km\/h/i), { target: { value: 'Verify each MSQ option independently.' } });

    const submitBtn = screen.getByRole('button', { name: /Save Mistake/i });
    await act(async () => {
      fireEvent.click(submitBtn);
      await new Promise((r) => setTimeout(r, 60));
    });

    const mistakes = await db.mistakes.toArray();
    const msqEntry = mistakes.find((m) => m.ruleToRemember === 'Verify each MSQ option independently.');
    expect(msqEntry).toBeDefined();
    expect(msqEntry?.questionType).toBe('MSQ');
    expect(msqEntry?.msqWrongOptions).toEqual(['Option C']);
    expect(msqEntry?.msqMissedOptions).toEqual(['Option B']);
  });
});
