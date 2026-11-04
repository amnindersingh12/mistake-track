import { describe, it, expect } from 'vitest';
import { validateMockSections, MockSectionValidationInput } from './mockValidation';

describe('validateMockSections', () => {
  const baseInput: MockSectionValidationInput = {
    sectionId: 'quant',
    sectionName: 'Quantitative Aptitude',
    attempted: 25,
    correct: 20,
    wrong: 5,
    timeMinutes: 20,
    totalQuestions: 35
  };

  it('passes when section inputs are valid', () => {
    const errors = validateMockSections([baseInput]);
    expect(Object.keys(errors)).toHaveLength(0);
  });

  it('fails when attempted exceeds total questions', () => {
    const errors = validateMockSections([{ ...baseInput, attempted: 36, correct: 30, wrong: 6 }]);
    expect(errors['quant.attempted']).toContain('Cannot exceed 35 questions');
  });

  it('fails when correct exceeds attempted', () => {
    const errors = validateMockSections([{ ...baseInput, correct: 26, wrong: 0, attempted: 25 }]);
    expect(errors['quant.correct']).toBe('Correct cannot exceed attempted.');
  });

  it('fails when attempted does not equal correct + wrong', () => {
    const errors = validateMockSections([{ ...baseInput, attempted: 25, correct: 20, wrong: 2 }]);
    expect(errors['quant.wrong']).toBe('Attempted must equal correct + wrong.');
  });

  it('fails when values are negative', () => {
    const errors = validateMockSections([{ ...baseInput, attempted: -1 }]);
    expect(errors['quant.attempted']).toBe('Must be zero or greater.');
  });

  it('fails when question counts are not integers', () => {
    const errors = validateMockSections([{ ...baseInput, attempted: 20.5, correct: 15.5, wrong: 5 }]);
    expect(errors['quant.attempted']).toBe('Question counts must be whole numbers.');
  });

  it('fails when time exceeds max allowed limit', () => {
    const errors = validateMockSections([{ ...baseInput, timeMinutes: 350 }]);
    expect(errors['quant.timeMinutes']).toContain('Cannot exceed 300 minutes');
  });
});
