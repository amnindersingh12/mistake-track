import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { JSDOM } from 'jsdom';
import {
  extractVisibleSummary,
  extractVisibleQuestion,
  isElementVisible
} from './testbookAdapter';

describe('Testbook DOM Adapter - sampletestbook.html Regression Tests', () => {
  const htmlPath = path.resolve(__dirname, '../../sampletestbook.html');
  const sampleHtml = fs.readFileSync(htmlPath, 'utf8');

  describe('Mode A: Import Result Summary', () => {
    it('rejects extraction when Summary modal is closed (aria-hidden=true)', () => {
      const dom = new JSDOM(sampleHtml);
      const doc = dom.window.document;

      // In the raw fixture, #summaryModal is closed (aria-hidden="true" and no .show/.in)
      expect(() => extractVisibleSummary(doc)).toThrow('Summary modal is closed');
    });

    it('extracts exact expected summary metrics when modal is opened by user', () => {
      const dom = new JSDOM(sampleHtml);
      const doc = dom.window.document;

      // Simulate user opening the summary modal in Testbook
      const modal = doc.querySelector('#summaryModal')!;
      modal.removeAttribute('aria-hidden');
      modal.classList.add('in'); // Bootstrap 3 / Angular modal active state

      const summary = extractVisibleSummary(doc);

      // 1. Overall Marks
      expect(summary.overallMarks).toBe(85.93);

      // 2. Sections
      expect(summary.sections).toHaveLength(2);

      const paper1 = summary.sections[0];
      expect(paper1.sectionName).toBe('Paper 1');
      expect(paper1.questionCount).toBe(80);
      expect(paper1.correctCount).toBe(27);
      expect(paper1.incorrectCount).toBe(9);
      expect(paper1.skippedCount).toBe(44);
      expect(paper1.marks).toBe(30.93);

      const paper2 = summary.sections[1];
      expect(paper2.sectionName).toBe('Paper 2');
      expect(paper2.questionCount).toBe(50);
      expect(paper2.correctCount).toBe(30);
      expect(paper2.incorrectCount).toBe(10);
      expect(paper2.skippedCount).toBe(10);
      expect(paper2.marks).toBe(55);

      // 3. Derived Totals
      expect(summary.derivedTotals.totalQuestions).toBe(130);
      expect(summary.derivedTotals.totalCorrect).toBe(57);
      expect(summary.derivedTotals.totalIncorrect).toBe(19);
      expect(summary.derivedTotals.totalSkipped).toBe(54);
      expect(summary.derivedTotals.totalAttempted).toBe(76);
      expect(summary.derivedTotals.totalMarks).toBe(85.93);
      expect(summary.derivedTotals.accuracy).toBe(75.0); // (57 / 76) * 100
    });
  });

  describe('Mode B: Import Current Question', () => {
    it('extracts currently visible question, options, correct answer and solution', () => {
      const dom = new JSDOM(sampleHtml);
      const doc = dom.window.document;

      const q = extractVisibleQuestion(doc);

      // Question metadata
      expect(q.questionNumber).toBe(1);
      expect(q.section).toBe('Paper 1');
      expect(q.questionText).toContain('Tamil Nadu (TN) recently received six additional Geographical Indication');

      // Options
      expect(q.options).toHaveLength(5);
      expect(q.options[0].text).toContain('Rameswaram Fish');
      expect(q.options[3].text).toContain('Puliyankudi Acid Lime, Panruti Cashew');
      expect(q.options[3].isCorrect).toBe(true);

      // Answers
      expect(q.correctAnswer).toBe('Puliyankudi Acid Lime, Panruti Cashew, and Virudhunagar Samba Vathal');
      expect(q.selectedAnswer).toBe('Left unattempted'); // status badge was Skipped

      // Visible Solution
      expect(q.explanation).toBeDefined();
      expect(q.explanation).toContain('The correct answer is Puliyankudi Acid Lime');
      expect(q.explanation).toContain('Key Points');
    });

    it('does not extract hidden explanation when solution panel is closed/ng-hide', () => {
      const dom = new JSDOM(sampleHtml);
      const doc = dom.window.document;

      // Hide all solution containers as when user has not clicked View Solution
      doc.querySelectorAll('div[ng-show*="isSolutionVisible"]').forEach(el => el.classList.add('ng-hide'));

      const q = extractVisibleQuestion(doc);
      expect(q.explanation).toBeUndefined();
      expect(q.missingFields).toContain('explanation');
    });
  });

  describe('Visibility check utility', () => {
    it('detects ng-hide and aria-hidden elements as not visible', () => {
      const dom = new JSDOM('<div id="p"><div id="c" class="ng-hide">hidden</div><div id="d" aria-hidden="true">aria</div></div>');
      const doc = dom.window.document;

      expect(isElementVisible(doc.querySelector('#c'))).toBe(false);
      expect(isElementVisible(doc.querySelector('#d'))).toBe(false);
      expect(isElementVisible(doc.querySelector('#p'))).toBe(true);
    });
  });
});
