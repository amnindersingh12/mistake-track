import { describe, it, expect, vi } from 'vitest';
import {
  escapeCsvField,
  formatAnkiFront,
  formatAnkiBack,
  exportMistakesToAnkiCsv,
  downloadAnkiCsv
} from './ankiExport';
import { MistakeEntry } from '../types';

describe('ankiExport utilities', () => {
  const sampleMistake: MistakeEntry = {
    id: 1,
    mockName: 'Gate Mock 2026',
    sectionId: 'cs_algo',
    sectionName: 'Algorithms',
    topic: 'Graph Algorithms',
    questionNumber: 14,
    questionText: 'What is the time complexity of Dijkstra with Fibonacci heap?\n```code\nO(V log V + E)\n```',
    questionImage: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    myAnswer: 'O(E log V)',
    correctAnswer: 'O(V log V + E)',
    resultType: 'Wrong',
    errorTypes: ['Concept gap'],
    timeSpentSeconds: 90,
    idealTimeSeconds: 60,
    whatWentWrong: 'Confused binary heap with Fibonacci heap.',
    correctSolution: 'Fibonacci heap decrease-key is amortized O(1). Thus total is O(V log V + E).',
    betterApproach: 'Remember Fibonacci heap has O(1) amortized decrease key.',
    ruleToRemember: 'Fib heap Dijkstra = O(V log V + E), Binary heap = O(E log V).',
    difficulty: 'Medium',
    tags: ['dijkstra', 'graphs'],
    status: 'Reviewing',
    interval: 1,
    consecutiveCorrect: 0,
    nextReviewDate: '2026-11-05',
    history: [],
    createdAt: '2026-11-01'
  };

  describe('escapeCsvField', () => {
    it('leaves plain text unquoted', () => {
      expect(escapeCsvField('hello world')).toBe('hello world');
    });

    it('quotes strings with commas or newlines', () => {
      expect(escapeCsvField('hello, world')).toBe('"hello, world"');
      expect(escapeCsvField('line1\nline2')).toBe('"line1\nline2"');
    });

    it('escapes quotes by doubling them', () => {
      expect(escapeCsvField('say "hello"')).toBe('"say ""hello"""');
    });
  });

  describe('formatAnkiFront', () => {
    it('formats front with section, topic, question text, code block, and image', () => {
      const front = formatAnkiFront(sampleMistake);
      expect(front).toContain('Algorithms • Graph Algorithms');
      expect(front).toContain('What is the time complexity');
      expect(front).toContain('<pre><code>O(V log V + E)</code></pre>');
      expect(front).toContain('<img src="data:image/png;base64');
    });
  });

  describe('formatAnkiBack', () => {
    it('formats back with answer, solution, approach, and rule to remember', () => {
      const back = formatAnkiBack(sampleMistake);
      expect(back).toContain('Correct Answer:');
      expect(back).toContain('O(V log V + E)');
      expect(back).toContain('Solution:');
      expect(back).toContain('Fibonacci heap decrease-key is amortized O(1)');
      expect(back).toContain('Approach / Shortcut:');
      expect(back).toContain('Rule to Remember:');
      expect(back).toContain('Fib heap Dijkstra = O(V log V + E)');
    });
  });

  describe('exportMistakesToAnkiCsv', () => {
    it('generates valid CSV with header and mistake rows', () => {
      const csv = exportMistakesToAnkiCsv([sampleMistake]);
      const lines = csv.split('\r\n');
      expect(lines[0]).toBe('Front,Back,Tags');
      expect(lines.length).toBeGreaterThanOrEqual(2);
      expect(csv).toContain('StudyBridge');
      expect(csv).toContain('Algorithms');
      expect(csv).toContain('Graph_Algorithms');
    });
  });

  describe('downloadAnkiCsv', () => {
    it('creates and clicks a download link in browser environment', () => {
      const mockLink = {
        setAttribute: vi.fn(),
        click: vi.fn()
      } as unknown as HTMLAnchorElement;

      const appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation(() => mockLink);
      const removeChildSpy = vi.spyOn(document.body, 'removeChild').mockImplementation(() => mockLink);
      const createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue(mockLink);

      // Mock URL.createObjectURL and revokeObjectURL
      globalThis.URL.createObjectURL = vi.fn().mockReturnValue('blob:test');
      globalThis.URL.revokeObjectURL = vi.fn();

      downloadAnkiCsv([sampleMistake], 'custom-deck.csv');

      expect(createElementSpy).toHaveBeenCalledWith('a');
      expect(mockLink.setAttribute).toHaveBeenCalledWith('download', 'custom-deck.csv');
      expect(mockLink.click).toHaveBeenCalled();

      appendChildSpy.mockRestore();
      removeChildSpy.mockRestore();
      createElementSpy.mockRestore();
    });
  });
});
