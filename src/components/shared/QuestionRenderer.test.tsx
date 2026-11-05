import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  QuestionRenderer,
  checkNatAnswer,
  renderFormattedContent,
  CodeBlock,
  QuestionRendererErrorBoundary
} from './QuestionRenderer';

describe('QuestionRenderer - Math, Code, Diagrams, MSQ & NAT', () => {
  it('renders inline and display math using KaTeX', () => {
    const raw = 'Given $E = mc^2$, find the value of $$\\sum_{i=1}^n i = \\frac{n(n+1)}{2}$$';
    const { container } = render(<div>{renderFormattedContent(raw)}</div>);

    // Should contain katex classes
    const katexElements = container.querySelectorAll('.katex');
    expect(katexElements.length).toBeGreaterThanOrEqual(2);

    // Verify display mode container is present
    const displayElement = container.querySelector('.katex-display, .my-3');
    expect(displayElement).toBeInTheDocument();
  });

  it('renders error boundary fallback safely when math is malformed without crashing', () => {
    // Malformed math string
    const malformed = 'Solve $$\\invalidcommand{unclosed$$';
    const { container } = render(
      <QuestionRendererErrorBoundary>
        <div>{renderFormattedContent(malformed)}</div>
      </QuestionRendererErrorBoundary>
    );

    // Should render without throwing React error
    expect(container).toBeInTheDocument();
  });

  it('renders monospace code blocks with syntax highlighting and copy button', () => {
    const codeSample = '```python\ndef solve_problem(n):\n    # Calculate factorial\n    if n <= 1:\n        return 1\n    return n * solve_problem(n - 1)\n```';
    render(<div>{renderFormattedContent(codeSample)}</div>);

    expect(screen.getByText(/PYTHON/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Copy/i })).toBeInTheDocument();
    expect(screen.getAllByText(/solve_problem/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/# Calculate factorial/i)).toBeInTheDocument();
  });

  it('renders inline code with monospace styling', () => {
    const textWithInline = 'Use the `Array.prototype.map()` method in JavaScript.';
    render(<div>{renderFormattedContent(textWithInline)}</div>);

    const inlineCode = screen.getByText('Array.prototype.map()');
    expect(inlineCode.tagName).toBe('CODE');
    expect(inlineCode).toHaveClass('font-mono');
  });

  it('supports image zoom / lightbox preview for question diagrams', () => {
    const sampleImage = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    render(
      <QuestionRenderer
        text="Refer to the graph below:"
        image={sampleImage}
      />
    );

    // Thumbnail is rendered
    const img = screen.getByAltText('Question Diagram');
    expect(img).toBeInTheDocument();

    // Click zoom button to open modal
    const zoomBtn = screen.getByRole('button', { name: /Click to Zoom Diagram/i });
    fireEvent.click(zoomBtn);

    // Lightbox modal should now be open with zoom percentage and controls
    expect(screen.getByText(/Diagram Zoom Preview \(100%\)/i)).toBeInTheDocument();
    expect(screen.getByTitle('Zoom In')).toBeInTheDocument();
    expect(screen.getByTitle('Zoom Out')).toBeInTheDocument();
    expect(screen.getByTitle('Reset Zoom')).toBeInTheDocument();

    // Test Zoom In
    fireEvent.click(screen.getByTitle('Zoom In'));
    expect(screen.getByText(/Diagram Zoom Preview \(125%\)/i)).toBeInTheDocument();

    // Close zoom modal
    fireEvent.click(screen.getByTitle('Close'));
    expect(screen.queryByText(/Diagram Zoom Preview/i)).not.toBeInTheDocument();
  });

  it('normalizes options to 2-5 choices and maps labels A-D for MCQ', () => {
    const rawOptions = [
      'A. Quick sort',
      'B. Merge sort',
      'C. Bubble sort',
      'D. Heap sort'
    ];

    render(
      <QuestionRenderer
        text="Which sorting algorithm has worst case O(n log n) time complexity?"
        options={rawOptions}
        questionType="MCQ"
        selectedOption="Bubble sort"
        correctOption="Merge sort"
        showSolution={true}
      />
    );

    // Options normalized without prefix "A.", "B."
    expect(screen.getByText('Merge sort')).toBeInTheDocument();
    expect(screen.getByText('Bubble sort')).toBeInTheDocument();

    // Labels A, B, C, D rendered
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('B')).toBeInTheDocument();
    expect(screen.getByText('C')).toBeInTheDocument();
    expect(screen.getByText('D')).toBeInTheDocument();

    // In solution mode: Merge sort is Correct, Bubble sort is Wrong Pick
    expect(screen.getByText('Correct')).toBeInTheDocument();
    expect(screen.getByText('Wrong Pick')).toBeInTheDocument();
  });

  it('visibly highlights wrong picks and missed options for MSQ', () => {
    const options = [
      'Option A: Regular grammar',
      'Option B: Context-free grammar',
      'Option C: Context-sensitive grammar',
      'Option D: Unrestricted grammar'
    ];

    render(
      <QuestionRenderer
        text="Which grammars are recognizable by a Turing machine?"
        options={options}
        questionType="MSQ"
        selectedOption={['Option A: Regular grammar', 'Option C: Context-sensitive grammar']}
        correctOption={['Option A: Regular grammar', 'Option B: Context-free grammar', 'Option C: Context-sensitive grammar', 'Option D: Unrestricted grammar']}
        msqWrongOptions={[]}
        msqMissedOptions={['Context-free grammar', 'Unrestricted grammar']}
        showSolution={true}
      />
    );

    // Header has MSQ badge
    expect(screen.getByText(/MSQ \(Multiple Select\)/i)).toBeInTheDocument();
    expect(screen.getByText(/One or more options correct/i)).toBeInTheDocument();

    // Should indicate Correct Pick for A & C
    const correctPicks = screen.getAllByText(/Correct Pick/i);
    expect(correctPicks.length).toBeGreaterThanOrEqual(1);

    // Should indicate Missed Option for B and D
    const missedBadges = screen.getAllByText(/Missed Option/i);
    expect(missedBadges.length).toBeGreaterThanOrEqual(1);
  });

  it('correctly checks NAT answers against tolerance ranges and displays verification', () => {
    // 1. Test checkNatAnswer helper directly
    // Case A: Number with tolerance
    const res1 = checkNatAnswer(45.5, 45, 1.0);
    expect(res1?.isCorrect).toBe(true);
    expect(res1?.targetMin).toBe(44);
    expect(res1?.targetMax).toBe(46);

    const res2 = checkNatAnswer(47.2, 45, 1.0);
    expect(res2?.isCorrect).toBe(false);

    // Case B: Min-Max range object
    const res3 = checkNatAnswer(10.5, { min: 10, max: 12 });
    expect(res3?.isCorrect).toBe(true);

    const res4 = checkNatAnswer(13.1, { min: 10, max: 12 });
    expect(res4?.isCorrect).toBe(false);

    // 2. Test QuestionRenderer NAT rendering
    const onNatChange = vi.fn();
    const { rerender } = render(
      <QuestionRenderer
        text="Find the average seek time in milliseconds."
        questionType="NAT"
        natAnswer={45.5}
        correctNatAnswer={45}
        natTolerance={1.0}
        showSolution={true}
        isInteractive={true}
        onNatAnswerChange={onNatChange}
      />
    );

    expect(screen.getByText(/NAT \(Numerical Answer\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Within Acceptable Range \(Correct\)/i)).toBeInTheDocument();
    expect(screen.getByText(/45 \(±1\) → \[44 to 46\]/i)).toBeInTheDocument();

    // Rerender with out-of-range answer
    rerender(
      <QuestionRenderer
        text="Find the average seek time in milliseconds."
        questionType="NAT"
        natAnswer={52.0}
        correctNatAnswer={45}
        natTolerance={1.0}
        showSolution={true}
      />
    );

    expect(screen.getByText(/Outside Tolerance Range \(Incorrect\)/i)).toBeInTheDocument();
  });

  it('renders descriptive questions with user answer and solution', () => {
    render(
      <QuestionRenderer
        text="Explain Dijkstra's algorithm and its complexity with an adjacency list."
        questionType="descriptive"
        selectedOption="Dijkstra uses a min-heap priority queue with $O((V + E) \log V)$."
        solution="The algorithm maintains distances in a priority queue. Each edge relaxation takes $O(\log V)$."
        showSolution={true}
      />
    );

    expect(screen.getByText(/Descriptive \/ Subjective/i)).toBeInTheDocument();
    expect(screen.getByText(/Candidate Response:/i)).toBeInTheDocument();
    expect(screen.getByText(/Verified Solution & Explanation/i)).toBeInTheDocument();
  });
});
