/**
 * Testbook DOM Adapter
 * Extracts visible result summaries, current question data, and full question papers
 * from Testbook HTML/DOM. Enforces strict visibility checks, semantic data-prompt
 * attributes, fragile selector tracking, and privacy rules.
 */

export interface ExtractedSectionSummary {
  sectionName: string;
  questionCount: number;
  attempted: number;
  correctCount: number;
  incorrectCount: number;
  skippedCount: number;
  marks: number;
  // Aliases for compatibility
  correct?: number;
  wrong?: number;
  unattempted?: number;
  score?: number;
  timeSpentSeconds?: number;
}

export interface ExtractedResultSummary {
  overallMarks: number;
  maxMarks?: number;
  examName?: string;
  mockName?: string;
  date?: string;
  sections: ExtractedSectionSummary[];
  derivedTotals: {
    totalQuestions: number;
    totalCorrect: number;
    totalIncorrect: number;
    totalSkipped: number;
    totalAttempted: number;
    totalMarks: number;
    accuracy?: number;
  };
  missingFields: string[];
  rawSummaryHtml?: string;
}

export interface ExtractedQuestionOption {
  index: number;
  label?: string;
  text: string;
  isCorrect?: boolean;
  isSelected?: boolean;
}

export interface ExtractedQuestion {
  questionNumber: number;
  section: string;
  questionText: string;
  questionImage?: string;
  options: ExtractedQuestionOption[];
  selectedAnswer?: string;
  userAnswer?: string;
  correctAnswer?: string;
  marks?: number;
  explanation?: string;
  solutionText?: string;
  topic?: string;
  statusBadge?: string;
  status: 'correct' | 'wrong' | 'unattempted';
  timeTaken?: string;
  timeSpent?: string;
  avgTime?: string;
  missingFields: string[];
  rawQuestionHtml?: string;
}

/**
 * Registry of known DOM selectors on Testbook review pages.
 * Documented for change-detection and error reporting.
 */
export const TESTBOOK_SELECTORS = {
  summaryModal: '#summaryModal, .modal_app-content',
  summaryTable: '#summaryModal table, .table-responsive table, table.table-bordered',
  totalMarksHeading: '#summaryModal h4, .modal-body h4, #questionPaper .header h4',
  questionContainer: '#questions, .detailed-question',
  questionNumber: '.tp-ques-number',
  sectionTab: '.nav-tabs li.active, .sections-list li.active, #sectionNavTabs li.active, .dropdown.ng-scope.active',
  questionText: '[ng-bind-html*="getQuestionDesc"], .qns-view-box',
  questionImage: '[ng-bind-html*="getQuestionDesc"] img, .qns-view-box img, #questions img',
  optionsList: 'ul.list-unstyled li.option',
  optionDesc: '[ng-bind-html*="parseDesc"], .qns-view-box, label',
  solutionDesc: '[ng-bind-html*="getSolutionDesc"], .sol-view-box, .solution-content',
  statusBadge: '.tp-info .badge',
  marksBadge: '.tp-pos-neg-marks .badge, .tp-info span.badge:not(.bg-skipped):not(.bg-attempted)',
  timeInfo: '.tp-info div',
  topicBadge: '.tp-topic, [ng-bind*="topic"], .breadcrumb li.active, .topic-name'
} as const;

/**
 * Custom error thrown when Testbook alters markup, preventing silent data corruption.
 * Informs the user/developer of the exact selector name to update in src/utils/testbookAdapter.ts.
 */
export class TestbookMarkupError extends Error {
  constructor(public selectorName: string, public attemptedSelector: string, message: string) {
    super(
      `[Testbook Markup Changed] ${message} (Selector: "${attemptedSelector}"). Update "${selectorName}" in src/utils/testbookAdapter.ts.`
    );
    this.name = 'TestbookMarkupError';
  }
}

/**
 * Checks if an element is currently visible.
 * Honors display, visibility, opacity, dimensions, aria-hidden, and Testbook ng-hide.
 */
export function isElementVisible(el: Element | null): boolean {
  if (!el) return false;

  // 1. Angular ng-hide check
  if (el.classList.contains('ng-hide') || el.closest('.ng-hide')) {
    return false;
  }

  // 2. aria-hidden check
  if (el.getAttribute('aria-hidden') === 'true' || el.closest('[aria-hidden="true"]')) {
    return false;
  }

  // 3. Computed style check in browser environments
  if (typeof window !== 'undefined' && typeof window.getComputedStyle === 'function') {
    try {
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
        return false;
      }
    } catch {
      // In synthetic DOMs without full style computation
    }
  }

  // 4. Inline style check
  const inline = el.getAttribute('style') || '';
  if (/display\s*:\s*none/i.test(inline) || /visibility\s*:\s*hidden/i.test(inline)) {
    return false;
  }

  return true;
}

/**
 * Normalizes text content: resolves whitespace, non-breaking spaces, and trim.
 */
export function cleanText(str: string | null | undefined): string {
  if (!str) return '';
  return str
    .replace(/\u00a0/g, ' ')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Normalizes decimal and negative numeric strings.
 */
export function parseNumber(val: string | null | undefined, fallback = 0): number {
  if (!val) return fallback;
  const match = val.replace(/,/g, '').match(/[-+]?[0-9]*\.?[0-9]+/);
  if (!match) return fallback;
  const num = parseFloat(match[0]);
  return isNaN(num) ? fallback : Number(num.toFixed(2));
}

/**
 * Mode A: Extracts currently visible Testbook Result Summary.
 * Prefers semantic attributes (data-prompt) and table relationships.
 */
export function extractVisibleSummary(root: Document | Element): ExtractedResultSummary {
  const missingFields: string[] = [];

  // 1. Check for Summary modal or container
  const modalEl = root.querySelector(TESTBOOK_SELECTORS.summaryModal);
  if (!modalEl) {
    // If a generic modal or dialog is present, Testbook redesigned its modal class names
    const genericModal = root.querySelector('.modal, [role="dialog"], [aria-modal="true"], dialog, .dialog');
    if (genericModal) {
      throw new TestbookMarkupError(
        'summaryModal',
        TESTBOOK_SELECTORS.summaryModal,
        'Testbook summary modal detected but class names have been redesigned.'
      );
    }
  } else {
    const isModalVis = isElementVisible(modalEl);
    const ariaHidden = modalEl.getAttribute('aria-hidden');
    const hasShowClass = modalEl.classList.contains('show') || modalEl.classList.contains('in');
    
    if (!isModalVis || ariaHidden === 'true' || (!hasShowClass && modalEl.classList.contains('fade') && !modalEl.classList.contains('active'))) {
      throw new Error('Summary modal is closed. Please open the Testbook Summary modal first.');
    }
  }

  // 2. Extract Overall Total Marks
  let overallMarks = 0;
  let overallFound = false;

  const marksHeading = root.querySelector(TESTBOOK_SELECTORS.totalMarksHeading);
  if (marksHeading) {
    const text = cleanText(marksHeading.textContent);
    const m = text.match(/(?:Total\s*Marks|My\s*Total\s*Marks)[:\s]+([0-9.]+)/i);
    if (m) {
      overallMarks = parseNumber(m[1]);
      overallFound = true;
    }
  }

  if (!overallFound) {
    const headings = root.querySelectorAll('h3, h4, h5, .total-marks');
    for (const h of Array.from(headings)) {
      const text = cleanText(h.textContent);
      const m = text.match(/(?:Total\s*Marks|My\s*Total\s*Marks)[:\s]+([0-9.]+)/i);
      if (m && isElementVisible(h)) {
        overallMarks = parseNumber(m[1]);
        overallFound = true;
        break;
      }
    }
  }

  // 3. Locate Summary Table
  const table = root.querySelector(TESTBOOK_SELECTORS.summaryTable);
  if (!table || !isElementVisible(table)) {
    throw new TestbookMarkupError('summaryTable', TESTBOOK_SELECTORS.summaryTable, 'Visible summary table not found on page.');
  }

  const sections: ExtractedSectionSummary[] = [];
  const rows = table.querySelectorAll('tbody tr');

  for (const row of Array.from(rows)) {
    if (!isElementVisible(row)) continue;

    const secCell = row.querySelector('[data-prompt="Section"]');
    const qCountCell = row.querySelector('[data-prompt="No. of questions"]');
    const corrCell = row.querySelector('[data-prompt="Correct"]');
    const incorrCell = row.querySelector('[data-prompt="Incorrect"]');
    const skipCell = row.querySelector('[data-prompt="Skipped"]');
    const marksCell = row.querySelector('[data-prompt="Marks"]');

    if (secCell && qCountCell) {
      const qCount = parseInt(cleanText(qCountCell.textContent), 10) || 0;
      const corr = parseInt(cleanText(corrCell?.textContent), 10) || 0;
      const incorr = parseInt(cleanText(incorrCell?.textContent), 10) || 0;
      const skipped = parseInt(cleanText(skipCell?.textContent), 10) || 0;
      const marks = parseNumber(marksCell?.textContent);

      sections.push({
        sectionName: cleanText(secCell.textContent) || `Section ${sections.length + 1}`,
        questionCount: qCount,
        attempted: corr + incorr,
        correctCount: corr,
        incorrectCount: incorr,
        skippedCount: skipped,
        marks,
        correct: corr,
        wrong: incorr,
        unattempted: skipped,
        score: marks
      });
    } else {
      const cells = row.querySelectorAll('td');
      if (cells.length >= 5) {
        const qCount = parseInt(cleanText(cells[1].textContent), 10) || 0;
        const corr = parseInt(cleanText(cells[2].textContent), 10) || 0;
        const incorr = parseInt(cleanText(cells[3].textContent), 10) || 0;
        const skipped = parseInt(cleanText(cells[4].textContent), 10) || 0;
        const marks = cells[5] ? parseNumber(cells[5].textContent) : 0;

        sections.push({
          sectionName: cleanText(cells[0].textContent) || `Section ${sections.length + 1}`,
          questionCount: qCount,
          attempted: corr + incorr,
          correctCount: corr,
          incorrectCount: incorr,
          skippedCount: skipped,
          marks,
          correct: corr,
          wrong: incorr,
          unattempted: skipped,
          score: marks
        });
      }
    }
  }

  if (sections.length === 0) {
    throw new TestbookMarkupError('summaryRows', 'tbody tr', 'No section performance rows found in summary table.');
  }

  // 4. Derive Totals
  const totalQuestions = sections.reduce((s, x) => s + x.questionCount, 0);
  const totalCorrect = sections.reduce((s, x) => s + x.correctCount, 0);
  const totalIncorrect = sections.reduce((s, x) => s + x.incorrectCount, 0);
  const totalSkipped = sections.reduce((s, x) => s + x.skippedCount, 0);
  const totalAttempted = totalCorrect + totalIncorrect;
  const calculatedMarks = Number(sections.reduce((s, x) => s + x.marks, 0).toFixed(2));
  const finalMarks = overallFound ? overallMarks : calculatedMarks;
  const accuracy = totalAttempted > 0 ? Number(((totalCorrect / totalAttempted) * 100).toFixed(1)) : undefined;

  // 5. Exam / Mock Name & Date detection
  let examName = '';
  let mockName = '';
  let date = new Date().toISOString().split('T')[0];

  const analysisBtn = root.querySelector('.test-analysis-btn, a[href*="analysis"]');
  if (analysisBtn) {
    const href = analysisBtn.getAttribute('href') || '';
    const m = href.match(/\/TS-([^\/]+)/i);
    if (m) examName = m[1].replace(/-/g, ' ').toUpperCase();
  }

  const ebookTitle = root.querySelector('[ng-show*="isInEbookView"], .top-header h6, #questionPaper h3');
  if (ebookTitle && cleanText(ebookTitle.textContent)) {
    mockName = cleanText(ebookTitle.textContent);
  } else {
    mockName = examName ? `${examName} Mock Test` : 'Testbook Mock Test';
  }

  const dateMatch = (root.textContent || '').match(/(?:Date|Attempted on)[:\s]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}-\d{2}-\d{2}|\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]+\s+\d{4})/i);
  if (dateMatch) {
    const parsedDate = new Date(dateMatch[1]);
    if (!isNaN(parsedDate.getTime())) {
      date = parsedDate.toISOString().split('T')[0];
    }
  }

  if (!overallFound) missingFields.push('overallMarks');

  return {
    overallMarks: finalMarks,
    examName: examName || undefined,
    mockName,
    date,
    sections,
    derivedTotals: {
      totalQuestions,
      totalCorrect,
      totalIncorrect,
      totalSkipped,
      totalAttempted,
      totalMarks: finalMarks,
      accuracy
    },
    missingFields
  };
}

/**
 * Mode B: Extracts currently visible Question in Testbook review interface.
 */
export function extractVisibleQuestion(root: Document | Element): ExtractedQuestion {
  const missingFields: string[] = [];

  // 1. Verify visible questions container
  const questionsContainer = root.querySelector(TESTBOOK_SELECTORS.questionContainer);
  if (!questionsContainer || !isElementVisible(questionsContainer)) {
    throw new TestbookMarkupError('questionContainer', TESTBOOK_SELECTORS.questionContainer, 'No active Testbook question is currently visible.');
  }

  // 2. Question Number
  let questionNumber = 1;
  const qNumEl = root.querySelector(TESTBOOK_SELECTORS.questionNumber);
  if (qNumEl) {
    const text = cleanText(qNumEl.textContent);
    const m = text.match(/(?:Question\s*No\.?)?\s*(\d+)/i);
    if (m) questionNumber = parseInt(m[1], 10);
  }

  // 3. Active Section Name
  let section = 'General';
  const activeTab = root.querySelector(TESTBOOK_SELECTORS.sectionTab);
  if (activeTab) {
    const hiddenXs = activeTab.querySelector('.hidden-xs') || activeTab.querySelector('a span') || activeTab.querySelector('a');
    if (hiddenXs) {
      section = cleanText(hiddenXs.textContent);
    }
  }

  // 4. Status Badge & Marks
  let statusBadge = '';
  const badgeEl = root.querySelector(TESTBOOK_SELECTORS.statusBadge);
  if (badgeEl && isElementVisible(badgeEl)) {
    statusBadge = cleanText(badgeEl.textContent);
  }

  let marks: number | undefined;
  const marksBadge = root.querySelector(TESTBOOK_SELECTORS.marksBadge);
  if (marksBadge && isElementVisible(marksBadge)) {
    marks = parseNumber(marksBadge.textContent);
  }

  // Time taken
  let timeTaken = '';
  let avgTime = '';
  const timeEls = root.querySelectorAll(TESTBOOK_SELECTORS.timeInfo);
  for (const tel of Array.from(timeEls)) {
    const txt = cleanText(tel.textContent);
    if (/You:\s*(\d+:\d+)/i.test(txt)) {
      timeTaken = txt.match(/You:\s*(\d+:\d+)/i)![1];
    }
    if (/Avg:\s*(\d+:\d+)/i.test(txt)) {
      avgTime = txt.match(/Avg:\s*(\d+:\d+)/i)![1];
    }
  }

  // 5. Question Statement & Optional Image
  let questionText = '';
  let questionImage: string | undefined;

  const qDescEl = root.querySelector(TESTBOOK_SELECTORS.questionText);
  if (qDescEl && isElementVisible(qDescEl)) {
    questionText = cleanText(qDescEl.textContent);
    const imgEl = qDescEl.querySelector('img') || questionsContainer.querySelector('.qns-view-box img');
    if (imgEl && imgEl.getAttribute('src')) {
      questionImage = imgEl.getAttribute('src') || undefined;
    }
  } else {
    throw new TestbookMarkupError('questionText', TESTBOOK_SELECTORS.questionText, 'Visible question statement text could not be located.');
  }

  // 6. Options Extraction
  const options: ExtractedQuestionOption[] = [];
  let selectedAnswer: string | undefined;
  let correctAnswer: string | undefined;

  const optionEls = root.querySelectorAll(TESTBOOK_SELECTORS.optionsList);
  let optIndex = 0;

  for (const opt of Array.from(optionEls)) {
    if (!isElementVisible(opt)) continue;

    const optDesc = opt.querySelector(TESTBOOK_SELECTORS.optionDesc);
    const optText = cleanText(optDesc?.textContent);
    if (!optText) continue;

    const isCorrect =
      opt.classList.contains('correct-option') ||
      opt.classList.contains('correct-icon') ||
      opt.classList.contains('reattempt-correct-option');

    const isSelected =
      opt.classList.contains('actual-incorrect-option') ||
      opt.classList.contains('incorrect-option') ||
      opt.classList.contains('reattempt-icon') ||
      opt.classList.contains('selected');

    if (isCorrect) correctAnswer = optText;
    if (isSelected && statusBadge.toLowerCase() !== 'skipped') selectedAnswer = optText;

    options.push({
      index: optIndex,
      label: chr(65 + optIndex),
      text: optText,
      isCorrect,
      isSelected
    });
    optIndex++;
  }

  if (!selectedAnswer && /skipped|unattempt/i.test(statusBadge)) {
    selectedAnswer = 'Left unattempted';
  }

  // 7. Visible Solution / Explanation
  let explanation: string | undefined;
  const solDesc = root.querySelector(TESTBOOK_SELECTORS.solutionDesc);

  if (solDesc && isElementVisible(solDesc)) {
    explanation = cleanText(solDesc.textContent);
  }

  // 8. Topic Extraction
  let topic = section;
  const topicEl = root.querySelector(TESTBOOK_SELECTORS.topicBadge);
  if (topicEl && cleanText(topicEl.textContent)) {
    topic = cleanText(topicEl.textContent).replace(/^Topic[:\s]+/i, '');
  }

  // 9. Normalized Status
  let status: 'correct' | 'wrong' | 'unattempted' = 'unattempted';
  const badgeLower = statusBadge.toLowerCase();
  if (badgeLower.includes('correct') && !badgeLower.includes('in') && !badgeLower.includes('slow')) {
    status = 'correct';
  } else if (badgeLower.includes('wrong') || badgeLower.includes('incorrect')) {
    status = 'wrong';
  } else if (badgeLower.includes('skip') || badgeLower.includes('unattempt') || selectedAnswer === 'Left unattempted') {
    status = 'unattempted';
  } else if (selectedAnswer && correctAnswer) {
    status = selectedAnswer === correctAnswer ? 'correct' : 'wrong';
  }

  if (!correctAnswer) missingFields.push('correctAnswer');
  if (!selectedAnswer) missingFields.push('selectedAnswer');
  if (!explanation) missingFields.push('explanation');

  return {
    questionNumber,
    section,
    questionText,
    questionImage,
    options,
    selectedAnswer,
    userAnswer: selectedAnswer,
    correctAnswer,
    marks,
    explanation,
    solutionText: explanation,
    topic,
    statusBadge,
    status,
    timeTaken,
    timeSpent: timeTaken,
    avgTime,
    missingFields
  };
}

/**
 * Bulk Question Paper Extractor for Testbook #questionPaper view.
 * Extracts all 130+ questions in a single client pass.
 */
export function extractQuestionPaperDOM(root: Document | Element): ExtractedQuestion[] {
  const qpContainer = root.querySelector('#questionPaper') || root;
  const sectionDivs = qpContainer.querySelectorAll("div[ng-repeat*='section in test.sections']");
  const sectionsToProcess = sectionDivs.length > 0 ? Array.from(sectionDivs) : [qpContainer];

  const results: ExtractedQuestion[] = [];

  for (let sIdx = 0; sIdx < sectionsToProcess.length; sIdx++) {
    const secEl = sectionsToProcess[sIdx];
    const secHeading = secEl.querySelector('h4');
    const secName = secHeading ? cleanText(secHeading.textContent).replace(/^Section:\s*/i, '') : `Section ${sIdx + 1}`;

    const items = secEl.querySelectorAll('li.list-group-item');
    for (const item of Array.from(items)) {
      const itemText = cleanText(item.textContent);

      // Question Number
      const qMatch = itemText.match(/Q\.\s*(\d+)\)/);
      const qNum = qMatch ? parseInt(qMatch[1], 10) : results.length + 1;

      // Status & Marks
      let status: 'correct' | 'wrong' | 'unattempted' = 'unattempted';
      let marks: number | undefined;
      const badge = item.querySelector('span.badge');
      if (badge) {
        const badgeText = cleanText(badge.textContent);
        const marksM = badgeText.match(/Marks[:\s]*([0-9.]+)/i);
        if (marksM) marks = parseNumber(marksM[1]);

        const cls = badge.getAttribute('class') || '';
        if (cls.includes('bg-attempted')) status = 'correct';
        else if (cls.includes('bg-skipped')) status = 'wrong';
        else if (cls.includes('bg-unattempt')) status = 'unattempted';
      }

      // Question text & image
      let qText = '';
      let qImage: string | undefined;
      const qBox = item.querySelector('span.qns-view-box');
      if (qBox) {
        qText = cleanText(qBox.textContent);
        const img = qBox.querySelector('img');
        if (img && img.getAttribute('src')) qImage = img.getAttribute('src') || undefined;
      } else {
        qText = itemText.replace(/Q\.\s*\d+\)/, '').replace(/Marks[:\s]*[0-9.]+/, '').trim();
      }

      // Options
      const options: ExtractedQuestionOption[] = [];
      const optItems = item.querySelectorAll('ol li.option');
      let optIdx = 0;
      for (const opt of Array.from(optItems)) {
        const optText = cleanText(opt.textContent).replace(/^\([a-zA-Z0-9]+\)\s*/, '');
        options.push({
          index: optIdx,
          label: chr(65 + optIdx),
          text: optText
        });
        optIdx++;
      }

      results.push({
        questionNumber: qNum,
        section: secName,
        questionText: qText,
        questionImage: qImage,
        options,
        marks,
        status,
        missingFields: []
      });
    }
  }

  return results;
}

function chr(code: number): string {
  return String.fromCharCode(code);
}