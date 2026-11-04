import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { JSDOM } from 'jsdom';
import {
  extractVisibleSummary,
  extractVisibleQuestion,
  extractQuestionPaperDOM,
  isElementVisible,
  TestbookMarkupError
} from './testbookAdapter';

describe('Testbook DOM Adapter - sampletestbook.html Full Regression Suite', () => {
  const htmlPath = path.resolve(__dirname, '../../sampletestbook.html');
  const sampleHtml = fs.readFileSync(htmlPath, 'utf8');

  describe('Mode A: Import Result Summary', () => {
    it('rejects extraction when Summary modal is closed (aria-hidden=true)', () => {
      const dom = new JSDOM(sampleHtml);
      const doc = dom.window.document;
      expect(() => extractVisibleSummary(doc)).toThrow('Summary modal is closed');
    });

    it('throws TestbookMarkupError with exact selector name when modal class names are redesigned', () => {
      // Simulate Testbook redesigning modal classes (generic dialog exists without #summaryModal or .modal_app-content)
      const dom = new JSDOM('<div class="modal redesigned-summary-dialog" role="dialog"><div class="modal-content"><p>Scorecard</p></div></div>');
      const doc = dom.window.document;

      try {
        extractVisibleSummary(doc);
        expect.unreachable('Should have thrown TestbookMarkupError');
      } catch (err) {
        expect(err).toBeInstanceOf(TestbookMarkupError);
        const markupErr = err as TestbookMarkupError;
        expect(markupErr.selectorName).toBe('summaryModal');
        expect(markupErr.attemptedSelector).toBe('#summaryModal, .modal_app-content');
        expect(markupErr.message).toContain('[Testbook Markup Changed]');
        expect(markupErr.message).toContain('Update "summaryModal" in src/utils/testbookAdapter.ts');
      }
    });

    it('throws TestbookMarkupError with exact selector name when summaryTable is missing in opened modal', () => {
      const dom = new JSDOM('<div id="summaryModal" class="modal in"><div class="modal-body"><h4>Total Marks: 50</h4><p>No table</p></div></div>');
      const doc = dom.window.document;

      try {
        extractVisibleSummary(doc);
        expect.unreachable('Should have thrown TestbookMarkupError');
      } catch (err) {
        expect(err).toBeInstanceOf(TestbookMarkupError);
        const markupErr = err as TestbookMarkupError;
        expect(markupErr.selectorName).toBe('summaryTable');
        expect(markupErr.message).toContain('Update "summaryTable" in src/utils/testbookAdapter.ts');
      }
    });

    it('extracts exact expected summary metrics when modal is opened by user', () => {
      const dom = new JSDOM(sampleHtml);
      const doc = dom.window.document;

      const modal = doc.querySelector('#summaryModal')!;
      modal.removeAttribute('aria-hidden');
      modal.classList.add('in');

      const summary = extractVisibleSummary(doc);

      expect(summary.overallMarks).toBe(85.93);
      expect(summary.sections).toHaveLength(2);

      const paper1 = summary.sections[0];
      expect(paper1.sectionName).toBe('Paper 1');
      expect(paper1.questionCount).toBe(80);
      expect(paper1.correctCount).toBe(27);
      expect(paper1.incorrectCount).toBe(9);
      expect(paper1.skippedCount).toBe(44);
      expect(paper1.attempted).toBe(36);
      expect(paper1.marks).toBe(30.93);

      const paper2 = summary.sections[1];
      expect(paper2.sectionName).toBe('Paper 2');
      expect(paper2.questionCount).toBe(50);
      expect(paper2.correctCount).toBe(30);
      expect(paper2.incorrectCount).toBe(10);
      expect(paper2.skippedCount).toBe(10);
      expect(paper2.attempted).toBe(40);
      expect(paper2.marks).toBe(55);

      expect(summary.derivedTotals.totalQuestions).toBe(130);
      expect(summary.derivedTotals.totalCorrect).toBe(57);
      expect(summary.derivedTotals.totalIncorrect).toBe(19);
      expect(summary.derivedTotals.totalSkipped).toBe(54);
      expect(summary.derivedTotals.totalAttempted).toBe(76);
      expect(summary.derivedTotals.totalMarks).toBe(85.93);
      expect(summary.derivedTotals.accuracy).toBe(75.0);
    });
  });

  describe('Mode B: Import Current Question', () => {
    it('extracts currently visible question, options, correct answer, status and solution', () => {
      const dom = new JSDOM(sampleHtml);
      const doc = dom.window.document;

      const q = extractVisibleQuestion(doc);

      expect(q.questionNumber).toBe(1);
      expect(q.section).toBe('Paper 1');
      expect(q.questionText).toContain('Tamil Nadu (TN) recently received six additional Geographical Indication');
      expect(q.options).toHaveLength(5);
      expect(q.options[3].text).toContain('Puliyankudi Acid Lime');
      expect(q.options[3].isCorrect).toBe(true);

      expect(q.correctAnswer).toBe('Puliyankudi Acid Lime, Panruti Cashew, and Virudhunagar Samba Vathal');
      expect(q.selectedAnswer).toBe('Left unattempted');
      expect(q.status).toBe('unattempted');

      expect(q.explanation).toBeDefined();
      expect(q.explanation).toContain('The correct answer is Puliyankudi Acid Lime');
    });

    it('throws TestbookMarkupError when question text container is missing', () => {
      const dom = new JSDOM('<div id="questions"><div class="detailed-question"></div></div>');
      const doc = dom.window.document;
      expect(() => extractVisibleQuestion(doc)).toThrow(TestbookMarkupError);
    });
  });

  describe('Question Paper Bulk Extraction', () => {
    it('extracts all 130 questions from sampletestbook.html #questionPaper', () => {
      const dom = new JSDOM(sampleHtml);
      const doc = dom.window.document;

      const questions = extractQuestionPaperDOM(doc);
      expect(questions.length).toBe(130);

      const paper1Questions = questions.filter(q => q.section.includes('Paper 1'));
      const paper2Questions = questions.filter(q => q.section.includes('Paper 2'));

      expect(paper1Questions.length).toBe(80);
      expect(paper2Questions.length).toBe(50);
      expect(questions[0].questionText).toContain('Tamil Nadu');
    });
  });
});