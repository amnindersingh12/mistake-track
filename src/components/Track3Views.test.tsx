import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { OverlapMap } from './OverlapMap';
import { SyllabusView } from './SyllabusView';
import { PYQView } from './PYQView';

describe('Track 3 UI Components Rendering', () => {
  it('renders OverlapMap with canonical topic categories and golden core indicator', () => {
    const { container } = render(<OverlapMap />);
    expect(screen.getByText(/Cross-Exam Syllabus Overlap & Topic Graph/i)).toBeDefined();
    expect(screen.getByText(/3-Way Golden Core/i)).toBeDefined();
    expect(screen.getByText(/Core CS Foundation/i)).toBeDefined();
  });

  it('renders SyllabusView with exam tabs and 3-state mastery controls', () => {
    const { container } = render(<SyllabusView initialExamId="gate-cs" />);
    expect(screen.getByText(/Syllabus Tracker/i)).toBeDefined();
    expect(screen.getByText(/Overall Syllabus/i)).toBeDefined();
    expect(screen.getByText(/GATE CS/i)).toBeDefined();
  });

  it('renders PYQView with bank stats, filters, and question renderer', () => {
    const { container } = render(<PYQView />);
    expect(screen.getByText(/Previous Year Questions \(PYQ\) Bank/i)).toBeDefined();
    expect(screen.getByText(/1st-Attempt Accuracy/i)).toBeDefined();
    expect(screen.getByText(/Attempt Coverage/i)).toBeDefined();
  });
});
