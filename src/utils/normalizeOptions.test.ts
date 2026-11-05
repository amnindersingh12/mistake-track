import { describe, it, expect } from 'vitest';
import { normalizeOptions, normalizeOptionObjects } from './normalizeOptions';

describe('normalizeOptions', () => {
  it('handles duplicate options by deduping preserving order', () => {
    const raw = ['Option 1', 'Option 2', 'Option 1', 'Option 3'];
    const res = normalizeOptions(raw);
    expect(res.options).toEqual(['Option 1', 'Option 2', 'Option 3']);
    expect(res.needsReview).toBe(false);
  });

  it('strips "A)", "(b)", "1." labels properly', () => {
    const raw = ['A) First option', '(b) Second option', '1. Third option', 'D. Fourth option'];
    const res = normalizeOptions(raw);
    expect(res.options).toEqual(['First option', 'Second option', 'Third option', 'Fourth option']);
    expect(res.needsReview).toBe(false);
  });

  it('drops Hindi duplicates when English and Hindi are mixed', () => {
    const raw = [
      'Delhi',
      'Mumbai',
      'Kolkata',
      'Chennai',
      'दिल्ली',
      'मुंबई',
      'कोलकाता',
      'चेन्नई'
    ];
    const res = normalizeOptions(raw);
    expect(res.options).toEqual(['Delhi', 'Mumbai', 'Kolkata', 'Chennai']);
    expect(res.needsReview).toBe(false);
  });

  it('accepts valid 4 options without review', () => {
    const raw = ['A', 'B', 'C', 'D'];
    const res = normalizeOptions(raw);
    expect(res.options).toHaveLength(4);
    expect(res.needsReview).toBe(false);
  });

  it('accepts valid 5 options without review', () => {
    const raw = ['A', 'B', 'C', 'D', 'E'];
    const res = normalizeOptions(raw);
    expect(res.options).toHaveLength(5);
    expect(res.needsReview).toBe(false);
  });

  it('flags 9 options as needsReview', () => {
    const raw = ['Opt 1', 'Opt 2', 'Opt 3', 'Opt 4', 'Opt 5', 'Opt 6', 'Opt 7', 'Opt 8', 'Opt 9'];
    const res = normalizeOptions(raw);
    expect(res.options).toHaveLength(9);
    expect(res.needsReview).toBe(true);
    expect(res.reason).toContain('9 options found');
  });

  it('flags 1 option as needsReview', () => {
    const raw = ['Only one option'];
    const res = normalizeOptions(raw);
    expect(res.options).toHaveLength(1);
    expect(res.needsReview).toBe(true);
    expect(res.reason).toContain('1 options found');
  });

  it('normalizes option objects preserving selection and correctness', () => {
    const raw = [
      { text: 'A) Opt 1', isCorrect: false, isSelected: true },
      { text: 'B) Opt 2', isCorrect: true, isSelected: false },
      { text: 'Opt 1', isCorrect: false, isSelected: false },
      { text: 'C) Opt 3', isCorrect: false, isSelected: false }
    ];
    const res = normalizeOptionObjects(raw);
    expect(res.options).toHaveLength(3);
    expect(res.options[0]).toEqual({ index: 0, label: 'A', text: 'Opt 1', isCorrect: false, isSelected: true });
    expect(res.options[1]).toEqual({ index: 1, label: 'B', text: 'Opt 2', isCorrect: true, isSelected: false });
    expect(res.options[2]).toEqual({ index: 2, label: 'C', text: 'Opt 3', isCorrect: false, isSelected: false });
    expect(res.needsReview).toBe(false);
  });
});
