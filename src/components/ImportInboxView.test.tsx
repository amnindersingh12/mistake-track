import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import 'fake-indexeddb/auto';
import { db } from '../db/db';
import { ImportInboxView } from './ImportInboxView';

describe('ImportInboxView Component Tests', () => {
  beforeEach(async () => {
    await db.mocks.clear();
    await db.mistakes.clear();
  });

  it('renders initial empty inbox state with fixture loading button', () => {
    render(<ImportInboxView />);
    expect(screen.getByText('Import Inbox')).toBeDefined();
    expect(screen.getByText('Inbox Zero!')).toBeDefined();
    expect(screen.getByText('Test with Sample Fixture')).toBeDefined();
  });

  it('displays duplicate mock warning if mock already exists in db.mocks', async () => {
    await db.mocks.add({
      name: 'TNPSC Group 1 Prelims Mock 01',
      date: '2026-11-04',
      source: 'Testbook',
      attemptType: 'mock',
      sections: [],
      totalAttempted: 76,
      totalCorrect: 57,
      totalWrong: 19,
      totalUnattempted: 54,
      totalNetScore: 85.93,
      overallAccuracy: 75.0,
      totalMarksLostNegative: 0,
      totalTimeSpentSeconds: 3600
    });

    render(
      <ImportInboxView
        initialPayload={{
          id: 'test-1',
          text: 'mock',
          source: { platform: 'Testbook', url: '', title: '' },
          capturedAt: '2026-11-04T10:00:00Z',
          scanData: {
            mockName: 'TNPSC Group 1 Prelims Mock 01',
            totalQuestions: 130,
            sections: [],
            questions: [
              {
                questionNumber: 1,
                section: 'Paper 1',
                questionText: 'Test Question 1',
                options: [],
                statusBadge: 'Wrong',
                solutionStatus: 'captured'
              }
            ]
          }
        }}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Duplicate Mock Detected/i)).toBeDefined();
    });
  });
});