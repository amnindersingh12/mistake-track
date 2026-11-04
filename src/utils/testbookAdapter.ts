/**
 * Testbook DOM Adapter
 * Extracts visible result summaries and current question data from Testbook HTML/DOM.
 * Enforces strict visibility checks, semantic data-prompt attributes, and privacy rules.
 */

export interface ExtractedSectionSummary {
  sectionName: string;
  questionCount: number;
  correctCount: number;
  incorrectCount: number;
  skippedCount: number;
  marks: number;
}

export interface ExtractedResultSummary {
  overallMarks: number;
  maxMarks?: number;
  examName?: string;
  mockName?: string;
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
  correctAnswer?: string;
  marks?: number;
  explanation?: string;
  topic?: string;
  statusBadge?: string;
  timeTaken?: string;
  avgTime?: string;
  missingFields: string[];
  rawQuestionHtml?: string;
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
    .replace(/\u00a0/g, ' ') // &nbsp;
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
  const modalEl = root.querySelector('#summaryModal') || root.querySelector('.modal_app-content');
  if (modalEl) {
    const isModalVisible = isElementVisible(modalEl);
    const ariaHidden = modalEl.getAttribute('aria-hidden');
    const hasShowClass = modalEl.classList.contains('show') || modalEl.classList.contains('in');
    
    // In Testbook, closed modal has aria-hidden="true" or lacks .show/.in
    if (!isModalVisible || ariaHidden === 'true' || (!hasShowClass && modalEl.classList.contains('fade') && !modalEl.classList.contains('active'))) {
      throw new Error('Summary modal is closed. Please open the Testbook Summary modal first.');
    }
  }

  // 2. Extract Overall Total Marks
  let overallMarks = 0;
  let overallFound = false;

  // Search inside summary container or document
  const marksHeading =
    root.querySelector('#summaryModal h4') ||
    root.querySelector('.modal-body h4') ||
    root.querySelector('#questionPaper .header h4');

  if (marksHeading) {
    const text = cleanText(marksHeading.textContent);
    const m = text.match(/(?:Total\s*Marks|My\s*Total\s*Marks)[:\s]+([0-9.]+)/i);
    if (m) {
      overallMarks = parseNumber(m[1]);
      overallFound = true;
    }
  }

  if (!overallFound) {
    // Fallback scan across all headings
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
  const table =
    root.querySelector('#summaryModal table') ||
    root.querySelector('.table-responsive table') ||
    root.querySelector('table.table-bordered');

  if (!table || !isElementVisible(table)) {
    throw new Error('Visible Testbook summary table not found on page.');
  }

  const sections: ExtractedSectionSummary[] = [];
  const rows = table.querySelectorAll('tbody tr');

  for (const row of Array.from(rows)) {
    if (!isElementVisible(row)) continue;

    // A. Prefer data-prompt attributes
    const secCell = row.querySelector('[data-prompt="Section"]');
    const qCountCell = row.querySelector('[data-prompt="No. of questions"]');
    const corrCell = row.querySelector('[data-prompt="Correct"]');
    const incorrCell = row.querySelector('[data-prompt="Incorrect"]');
    const skipCell = row.querySelector('[data-prompt="Skipped"]');
    const marksCell = row.querySelector('[data-prompt="Marks"]');

    if (secCell && qCountCell) {
      sections.push({
        sectionName: cleanText(secCell.textContent) || `Section ${sections.length + 1}`,
        questionCount: parseInt(cleanText(qCountCell.textContent), 10) || 0,
        correctCount: parseInt(cleanText(corrCell?.textContent), 10) || 0,
        incorrectCount: parseInt(cleanText(incorrCell?.textContent), 10) || 0,
        skippedCount: parseInt(cleanText(skipCell?.textContent), 10) || 0,
        marks: parseNumber(marksCell?.textContent)
      });
    } else {
      // B. Fallback to column index mapping from table headers
      const cells = row.querySelectorAll('td');
      if (cells.length >= 5) {
        sections.push({
          sectionName: cleanText(cells[0].textContent) || `Section ${sections.length + 1}`,
          questionCount: parseInt(cleanText(cells[1].textContent), 10) || 0,
          correctCount: parseInt(cleanText(cells[2].textContent), 10) || 0,
          incorrectCount: parseInt(cleanText(cells[3].textContent), 10) || 0,
          skippedCount: parseInt(cleanText(cells[4].textContent), 10) || 0,
          marks: cells[5] ? parseNumber(cells[5].textContent) : 0
        });
      }
    }
  }

  if (sections.length === 0) {
    throw new Error('No section performance rows found in summary table.');
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

  // 5. Exam / Mock Name detection
  let examName = '';
  let mockName = '';

  const analysisBtn = root.querySelector('.test-analysis-btn, a[href*="analysis"]');
  if (analysisBtn) {
    const href = analysisBtn.getAttribute('href') || '';
    const m = href.match(/\/TS-([^\/]+)/i);
    if (m) examName = m[1].replace(/-/g, ' ').toUpperCase();
  }

  const ebookTitle = root.querySelector('[ng-show*="isInEbookView"]');
  if (ebookTitle && cleanText(ebookTitle.textContent)) {
    mockName = cleanText(ebookTitle.textContent);
  } else {
    mockName = examName ? `${examName} Mock Test` : 'Testbook Mock Test';
  }

  if (!overallFound) missingFields.push('overallMarks');

  return {
    overallMarks: finalMarks,
    examName: examName || undefined,
    mockName,
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
  const questionsContainer = root.querySelector('#questions') || root.querySelector('.detailed-question');
  if (!questionsContainer || !isElementVisible(questionsContainer)) {
    throw new Error('No active Testbook question is currently visible.');
  }

  // 2. Question Number
  let questionNumber = 1;
  const qNumEl = root.querySelector('.tp-ques-number');
  if (qNumEl) {
    const text = cleanText(qNumEl.textContent);
    const m = text.match(/(?:Question\s*No\.?)?\s*(\d+)/i);
    if (m) questionNumber = parseInt(m[1], 10);
  }

  // 3. Active Section Name
  let section = 'General';
  const activeTab = root.querySelector('.nav-tabs li.active, .sections-list li.active, .dropdown.ng-scope.active');
  if (activeTab) {
    const hiddenXs = activeTab.querySelector('.hidden-xs') || activeTab.querySelector('a');
    if (hiddenXs) {
      section = cleanText(hiddenXs.textContent);
    }
  }

  // 4. Status Badge & Marks
  let statusBadge = '';
  const badgeEl = root.querySelector('.tp-info .badge');
  if (badgeEl && isElementVisible(badgeEl)) {
    statusBadge = cleanText(badgeEl.textContent);
  }

  let marks: number | undefined;
  const marksBadge = root.querySelector('.tp-pos-neg-marks .badge, .tp-info span.badge:not(.bg-skipped):not(.bg-attempted)');
  if (marksBadge && isElementVisible(marksBadge)) {
    marks = parseNumber(marksBadge.textContent);
  }

  // Time taken
  let timeTaken = '';
  let avgTime = '';
  const timeEls = root.querySelectorAll('.tp-info div');
  for (const tel of Array.from(timeEls)) {
    const txt = cleanText(tel.textContent);
    if (/You:\s*(\d+:\d+)/i.test(txt)) {
      timeTaken = txt.match(/You:\s*(\d+:\d+)/i)![1];
    }
    if (/Avg:\s*(\d+:\d+)/i.test(txt)) {
      avgTime = txt.match(/Avg:\s*(\d+:\d+)/i)![1];
    }
  }

  // 5. Question Statement
  let questionText = '';
  const qDescEl = root.querySelector('[ng-bind-html*="getQuestionDesc"], .qns-view-box');
  if (qDescEl && isElementVisible(qDescEl)) {
    questionText = cleanText(qDescEl.textContent);
  } else {
    throw new Error('Visible question statement text could not be located.');
  }

  // 6. Options Extraction
  const options: ExtractedQuestionOption[] = [];
  let selectedAnswer: string | undefined;
  let correctAnswer: string | undefined;

  const optionEls = root.querySelectorAll('ul.list-unstyled li.option');
  let optIndex = 0;

  for (const opt of Array.from(optionEls)) {
    if (!isElementVisible(opt)) continue;

    const optDesc = opt.querySelector('[ng-bind-html*="parseDesc"], .qns-view-box, label');
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
      index: optIndex++,
      text: optText,
      isCorrect,
      isSelected
    });
  }

  // If user skipped/unattempted
  if (!selectedAnswer && /skipped|unattempt/i.test(statusBadge)) {
    selectedAnswer = 'Left unattempted';
  }

  // 7. Visible Solution / Explanation (Only when actually displayed)
  let explanation: string | undefined;
  const solDesc =
    root.querySelector('[ng-bind-html*="getSolutionDesc"]') ||
    root.querySelector('.sol-view-box') ||
    root.querySelector('.solution-content');

  if (solDesc && isElementVisible(solDesc)) {
    explanation = cleanText(solDesc.textContent);
  }

  if (!correctAnswer) missingFields.push('correctAnswer');
  if (!selectedAnswer) missingFields.push('selectedAnswer');
  if (!explanation) missingFields.push('explanation');

  return {
    questionNumber,
    section,
    questionText,
    options,
    selectedAnswer,
    correctAnswer,
    marks,
    explanation,
    statusBadge,
    timeTaken,
    avgTime,
    missingFields
  };
}
