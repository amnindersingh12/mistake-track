import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NotesView } from './NotesView';
import { PatternsView, DEFAULT_PATTERN_ARCHETYPES } from './PatternsView';
import { CheatSheetView } from './CheatSheetView';
import { db } from '../db/db';
import { StudyNote, Pattern, MistakeEntry, ExamSettings } from '../types';

describe('Notes & Pattern Book deliverables', () => {
  const mockSettings: ExamSettings = {
    id: 'current',
    examName: 'GATE CS 2026',
    totalTimeMinutes: 180,
    targetScore: 75,
    overallCutoff: 30,
    sections: [
      {
        id: 'cs',
        name: 'Computer Science',
        totalQuestions: 65,
        timeLimitMinutes: 180,
        marksPerCorrect: 1,
        negativeMark: 0.33,
        sectionalCutoff: 25,
        topics: ['Theory of Computation', 'Databases', 'Computer Networks']
      }
    ],
    errorTypes: ['Concept gap', 'Calculation error']
  };

  const sampleMistakes: MistakeEntry[] = [
    {
      id: 101,
      mockName: 'GATE Mock 1',
      sectionId: 'cs',
      sectionName: 'Computer Science',
      topic: 'Theory of Computation',
      questionNumber: 3,
      questionText: 'Number of states in minimal DFA for substring "010"?',
      myAnswer: '3',
      correctAnswer: '4',
      resultType: 'Wrong',
      errorTypes: ['Concept gap'],
      timeSpentSeconds: 120,
      idealTimeSeconds: 90,
      whatWentWrong: 'Forgot to include the absorbing trap state.',
      correctSolution: '4 states required: q0 (empty), q1 ("0"), q2 ("01"), q3 ("010" accepting).',
      betterApproach: 'For substring length k, minimal DFA has k + 1 states.',
      ruleToRemember: 'Minimal DFA for substring w requires length(w) + 1 states.',
      difficulty: 'Medium',
      tags: ['toc', 'dfa'],
      status: 'Reviewing',
      interval: 1,
      consecutiveCorrect: 0,
      nextReviewDate: '2026-11-05',
      history: [],
      createdAt: '2026-11-01'
    }
  ];

  beforeEach(async () => {
    await db.notes.clear();
    await db.patterns.clear();
    await db.mistakes.clear();
    await db.mistakes.bulkAdd(sampleMistakes);
  });

  describe('NotesView', () => {
    it('renders notes, supports rich math, and creates new note with two-way links', async () => {
      const sampleNote: StudyNote = {
        id: 1,
        title: 'Mastering DFA Minimal States',
        topicId: 'toc',
        subtopic: 'Finite Automata',
        content: 'Formula: $$k + 1$$ states for string $w$ of length $k$.\n```python\n# DFA transition\n```',
        tags: ['toc', 'automata'],
        linkedMistakeIds: [101],
        linkedPyqIds: [],
        linkedPatternIds: [],
        createdAt: '2026-11-01T00:00:00Z',
        updatedAt: '2026-11-01T00:00:00Z'
      };

      await db.notes.add(sampleNote);

      render(<NotesView />);

      await waitFor(() => {
        expect(screen.getAllByText('Mastering DFA Minimal States').length).toBeGreaterThanOrEqual(1);
      });

      // Verify linked mistake is displayed
      expect(screen.getByText(/Linked Mistakes \(1\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Number of states in minimal DFA for substring "010"\?/i)).toBeInTheDocument();

      // Open new note modal
      const newNoteBtn = screen.getByRole('button', { name: /New Note/i });
      fireEvent.click(newNoteBtn);

      expect(screen.getByText('Create New Topic Note')).toBeInTheDocument();
      const titleInput = screen.getByPlaceholderText(/e\.g\. Dijkstra vs Bellman-Ford/i);
      fireEvent.change(titleInput, { target: { value: 'B-Tree Order Rules' } });

      const saveBtn = screen.getByRole('button', { name: /Save Note/i });
      fireEvent.click(saveBtn);

      await waitFor(async () => {
        const savedNotes = await db.notes.toArray();
        expect(savedNotes.some((n) => n.title === 'B-Tree Order Rules')).toBe(true);
      });
    });
  });

  describe('PatternsView', () => {
    it('loads archetype presets and renders recurring question archetypes and traps', async () => {
      render(<PatternsView />);

      const seedBtns = await screen.findAllByRole('button', { name: /Load Common Archetypes/i });
      fireEvent.click(seedBtns[0]);

      await waitFor(() => {
        expect(screen.getByText('DFA minimal states with substring constraint')).toBeInTheDocument();
        expect(screen.getByText('2PL serializability check')).toBeInTheDocument();
        expect(screen.getByText('Subnetting host calculation with CIDR')).toBeInTheDocument();
      });

      // Check standard trick/trap rendering
      expect(screen.getByText(/For substring of length/i)).toBeInTheDocument();
      expect(screen.getByText(/Always subtract 2 for usable hosts/i)).toBeInTheDocument();

      const dbPatterns = await db.patterns.toArray();
      expect(dbPatterns.length).toBe(3);
    });

    it('allows adding a new pattern archetype and persisting in db.patterns', async () => {
      render(<PatternsView />);

      const addBtn = await screen.findByRole('button', { name: /Add Pattern/i });
      fireEvent.click(addBtn);

      expect(screen.getByText('Add Question Archetype')).toBeInTheDocument();
      const titleInput = screen.getByPlaceholderText(/e\.g\. Subnetting host calculation with CIDR/i);
      fireEvent.change(titleInput, { target: { value: 'Pipelining CPI with Branch Penalty' } });

      const trapInput = screen.getByPlaceholderText(/What is the common trap/i);
      fireEvent.change(trapInput, { target: { value: 'Branch penalty stalls = (Penalty cycles) * (Branch frequency)' } });

      const saveBtn = screen.getByRole('button', { name: /Save Pattern/i });
      fireEvent.click(saveBtn);

      await waitFor(async () => {
        const patterns = await db.patterns.toArray();
        expect(patterns.some((p) => p.title === 'Pipelining CPI with Branch Penalty')).toBe(true);
      });
    });
  });

  describe('CheatSheetView with Pattern Book Integration', () => {
    it('integrates Pattern Book formulas and tricks alongside Rules to Remember', async () => {
      const samplePattern: Pattern = {
        id: 1,
        title: 'CIDR Subnet Mask Calculation',
        topicId: 'cn',
        description: 'Usable host addresses in /26 network',
        trickOrTrap: '2^(32-26) - 2 = 62 usable hosts.',
        linkedMistakeIds: [],
        linkedPyqIds: [],
        createdAt: '2026-11-01',
        updatedAt: '2026-11-01'
      };

      await db.patterns.add(samplePattern);

      render(
        <CheatSheetView
          mistakes={sampleMistakes}
          settings={mockSettings}
          patterns={[samplePattern]}
        />
      );

      // Verify Pattern Book Archetypes section
      expect(screen.getByText('Pattern Book — Standard Question Archetypes & Traps')).toBeInTheDocument();
      expect(screen.getByText('CIDR Subnet Mask Calculation')).toBeInTheDocument();
      expect(screen.getByText(/2\^\(32-26\) - 2 = 62 usable hosts/i)).toBeInTheDocument();

      // Verify Rule to Remember from mistakes
      expect(screen.getByText(/Minimal DFA for substring w requires length\(w\) \+ 1 states/i)).toBeInTheDocument();

      // Filter by Patterns only
      const patternsFilterBtn = screen.getByRole('button', { name: /Patterns \(1\)/i });
      fireEvent.click(patternsFilterBtn);

      expect(screen.getByText('CIDR Subnet Mask Calculation')).toBeInTheDocument();
      expect(screen.queryByText(/Minimal DFA for substring w requires length/i)).not.toBeInTheDocument();
    });
  });
});
