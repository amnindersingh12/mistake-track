export type MockValidationErrors = Record<string, string>;

export interface MockSectionValidationInput {
  sectionId: string;
  sectionName: string;
  attempted: number;
  correct: number;
  wrong: number;
  timeMinutes?: number;
  totalQuestions?: number;
}

export function validateMockSections(
  sections: MockSectionValidationInput[]
): Record<string, string> {
  const errors: Record<string, string> = {};

  for (const sec of sections) {
    const id = sec.sectionId;

    // Whole numbers check
    if (!Number.isInteger(sec.attempted) || !Number.isInteger(sec.correct) || !Number.isInteger(sec.wrong)) {
      errors[`${id}.attempted`] = 'Question counts must be whole numbers.';
      continue;
    }

    // Negative check
    if (sec.attempted < 0 || sec.correct < 0 || sec.wrong < 0) {
      errors[`${id}.attempted`] = 'Must be zero or greater.';
      continue;
    }

    // Attempted <= totalQuestions
    if (sec.totalQuestions !== undefined && sec.attempted > sec.totalQuestions) {
      errors[`${id}.attempted`] = `Cannot exceed ${sec.totalQuestions} questions.`;
    }

    // Correct <= attempted
    if (sec.correct > sec.attempted) {
      errors[`${id}.correct`] = 'Correct cannot exceed attempted.';
    }

    // Attempted === correct + wrong
    if (sec.attempted !== sec.correct + sec.wrong) {
      errors[`${id}.wrong`] = 'Attempted must equal correct + wrong.';
    }

    // Time limit
    if (sec.timeMinutes !== undefined && sec.timeMinutes > 300) {
      errors[`${id}.timeMinutes`] = 'Cannot exceed 300 minutes.';
    }
  }

  return errors;
}
