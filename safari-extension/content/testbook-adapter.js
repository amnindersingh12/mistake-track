/**
 * StudyBridge Testbook Adapter Content Script
 * Executes strictly on explicit user action from the extension popup.
 * Extracts visible result summaries, visible question reviews, or user-selected text.
 * Strictly respects visibility (computed style, aria-hidden, ng-hide).
 * Zero crawling, zero hidden DOM scraping, zero credential/token access.
 */

(() => {
  // Prevent duplicate registration if injected multiple times
  if (window.__studybridge_testbook_adapter_installed__) return;
  window.__studybridge_testbook_adapter_installed__ = true;

  /**
   * Visibility check: honors computed styles, dimensions, aria-hidden, and Testbook ng-hide.
   */
  function isElementVisible(el) {
    if (!el) return false;

    // 1. Angular ng-hide check
    if (el.classList.contains('ng-hide') || el.closest('.ng-hide')) {
      return false;
    }

    // 2. aria-hidden check
    if (el.getAttribute('aria-hidden') === 'true' || el.closest('[aria-hidden="true"]')) {
      return false;
    }

    // 3. Computed style check
    try {
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
        return false;
      }
    } catch (e) {
      // In environments where getComputedStyle is unavailable
    }

    // 4. Inline style check
    const inline = el.getAttribute('style') || '';
    if (/display\s*:\s*none/i.test(inline) || /visibility\s*:\s*hidden/i.test(inline)) {
      return false;
    }

    return true;
  }

  function cleanText(str) {
    if (!str) return '';
    return str.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function parseNumber(str) {
    if (!str) return 0;
    const cleaned = cleanText(str).replace(/[^0-9.-]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  }

  /**
   * Mode A: Extract Visible Summary Table
   */
  function extractVisibleSummary() {
    const missingFields = [];

    // Verify modal visibility if summary is inside a modal
    const summaryModal = document.querySelector('#summaryModal, .modal.summary-modal');
    if (summaryModal) {
      if (summaryModal.getAttribute('aria-hidden') === 'true' || !isElementVisible(summaryModal)) {
        throw new Error('Summary modal is closed. Please open the Summary modal on Testbook first.');
      }
    }

    // Overall Marks
    let overallMarks = 0;
    let overallFound = false;
    const marksHeading =
      document.querySelector('#summaryModal h4') ||
      document.querySelector('.modal-title') ||
      document.querySelector('.overall-score');

    if (marksHeading) {
      const text = cleanText(marksHeading.textContent);
      const m = text.match(/(?:Total\s*Marks|My\s*Total\s*Marks)[:\s]+([0-9.]+)/i);
      if (m) {
        overallMarks = parseNumber(m[1]);
        overallFound = true;
      }
    }

    if (!overallFound) {
      const headings = document.querySelectorAll('h3, h4, h5, .total-marks');
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

    // Locate Summary Table
    const table =
      document.querySelector('#summaryModal table') ||
      document.querySelector('.table-responsive table') ||
      document.querySelector('table.table-bordered');

    if (!table || !isElementVisible(table)) {
      throw new Error('Visible Testbook summary table not found on page.');
    }

    const sections = [];
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
        sections.push({
          sectionName: cleanText(secCell.textContent) || `Section ${sections.length + 1}`,
          questionCount: parseInt(cleanText(qCountCell.textContent), 10) || 0,
          correctCount: parseInt(cleanText(corrCell ? corrCell.textContent : ''), 10) || 0,
          incorrectCount: parseInt(cleanText(incorrCell ? incorrCell.textContent : ''), 10) || 0,
          skippedCount: parseInt(cleanText(skipCell ? skipCell.textContent : ''), 10) || 0,
          marks: parseNumber(marksCell ? marksCell.textContent : '')
        });
      } else {
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

    const totalQuestions = sections.reduce((s, x) => s + x.questionCount, 0);
    const totalCorrect = sections.reduce((s, x) => s + x.correctCount, 0);
    const totalIncorrect = sections.reduce((s, x) => s + x.incorrectCount, 0);
    const totalSkipped = sections.reduce((s, x) => s + x.skippedCount, 0);
    const totalAttempted = totalCorrect + totalIncorrect;
    const calculatedMarks = Number(sections.reduce((s, x) => s + x.marks, 0).toFixed(2));
    const finalMarks = overallFound ? overallMarks : calculatedMarks;
    const accuracy = totalAttempted > 0 ? Number(((totalCorrect / totalAttempted) * 100).toFixed(1)) : undefined;

    let examName = '';
    let mockName = '';

    const analysisBtn = document.querySelector('.test-analysis-btn, a[href*="analysis"]');
    if (analysisBtn) {
      const href = analysisBtn.getAttribute('href') || '';
      const m = href.match(/\/TS-([^\/]+)/i);
      if (m) examName = m[1].replace(/-/g, ' ').toUpperCase();
    }

    const ebookTitle = document.querySelector('[ng-show*="isInEbookView"]');
    if (ebookTitle && cleanText(ebookTitle.textContent)) {
      mockName = cleanText(ebookTitle.textContent);
    } else {
      mockName = examName ? `${examName} Mock Test` : (document.title || 'Testbook Mock Test');
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
   * Mode B: Extract Visible Question Review
   */
  function extractVisibleQuestion() {
    const missingFields = [];

    const questionsContainer = document.querySelector('#questions') || document.querySelector('.detailed-question');
    if (!questionsContainer || !isElementVisible(questionsContainer)) {
      throw new Error('No active Testbook question is currently visible.');
    }

    let questionNumber = 1;
    const qNumEl = document.querySelector('.tp-ques-number');
    if (qNumEl) {
      const text = cleanText(qNumEl.textContent);
      const m = text.match(/(?:Question\s*No\.?)?\s*(\d+)/i);
      if (m) questionNumber = parseInt(m[1], 10);
    }

    let section = 'General';
    const activeTab = document.querySelector('.nav-tabs li.active, .sections-list li.active, .dropdown.ng-scope.active');
    if (activeTab) {
      const hiddenXs = activeTab.querySelector('.hidden-xs') || activeTab.querySelector('a');
      if (hiddenXs) {
        section = cleanText(hiddenXs.textContent);
      }
    }

    let statusBadge = '';
    const badgeEl = document.querySelector('.tp-info .badge');
    if (badgeEl && isElementVisible(badgeEl)) {
      statusBadge = cleanText(badgeEl.textContent);
    }

    let marks = undefined;
    const marksBadge = document.querySelector('.tp-pos-neg-marks .badge, .tp-info span.badge:not(.bg-skipped):not(.bg-attempted)');
    if (marksBadge && isElementVisible(marksBadge)) {
      marks = parseNumber(marksBadge.textContent);
    }

    let timeTaken = '';
    let avgTime = '';
    const timeEls = document.querySelectorAll('.tp-info div');
    for (const tel of Array.from(timeEls)) {
      const txt = cleanText(tel.textContent);
      if (/You:\s*(\d+:\d+)/i.test(txt)) {
        timeTaken = txt.match(/You:\s*(\d+:\d+)/i)[1];
      }
      if (/Avg:\s*(\d+:\d+)/i.test(txt)) {
        avgTime = txt.match(/Avg:\s*(\d+:\d+)/i)[1];
      }
    }

    let questionText = '';
    const qDescEl = document.querySelector('[ng-bind-html*="getQuestionDesc"], .qns-view-box');
    if (qDescEl && isElementVisible(qDescEl)) {
      questionText = cleanText(qDescEl.textContent);
    } else {
      throw new Error('Visible question statement text could not be located.');
    }

    const options = [];
    let selectedAnswer = undefined;
    let correctAnswer = undefined;

    const optionEls = document.querySelectorAll('ul.list-unstyled li.option');
    let optIndex = 0;

    for (const opt of Array.from(optionEls)) {
      if (!isElementVisible(opt)) continue;

      const optDesc = opt.querySelector('[ng-bind-html*="parseDesc"], .qns-view-box, label');
      const optText = cleanText(optDesc ? optDesc.textContent : '');
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

    if (!selectedAnswer && /skipped|unattempt/i.test(statusBadge)) {
      selectedAnswer = 'Left unattempted';
    }

    // Visible Solution / Explanation (Only when actually displayed)
    let explanation = undefined;
    const solDesc =
      document.querySelector('[ng-bind-html*="getSolutionDesc"]') ||
      document.querySelector('.sol-view-box') ||
      document.querySelector('.solution-content');

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

  /**
   * Inspect current Testbook page state for extension popup
   */
  function inspectPage() {
    let isSummaryVisible = false;
    let isSummaryModalClosed = false;

    const summaryModal = document.querySelector('#summaryModal, .modal.summary-modal');
    if (summaryModal) {
      if (summaryModal.getAttribute('aria-hidden') === 'true' || !isElementVisible(summaryModal)) {
        isSummaryModalClosed = true;
      } else {
        isSummaryVisible = true;
      }
    } else {
      const summaryTable = document.querySelector('[data-prompt="Section"], .table-responsive table');
      if (summaryTable && isElementVisible(summaryTable)) {
        isSummaryVisible = true;
      }
    }

    let isQuestionVisible = false;
    let questionNumber = undefined;
    let section = undefined;

    const questionsContainer = document.querySelector('#questions, .detailed-question');
    if (questionsContainer && isElementVisible(questionsContainer)) {
      isQuestionVisible = true;
      const qNumEl = document.querySelector('.tp-ques-number');
      if (qNumEl) {
        const m = cleanText(qNumEl.textContent).match(/(\d+)/);
        if (m) questionNumber = parseInt(m[1], 10);
      }
      const activeTab = document.querySelector('.nav-tabs li.active, .dropdown.ng-scope.active');
      if (activeTab) {
        section = cleanText(activeTab.textContent);
      }
    }

    const sel = window.getSelection();
    const selectedText = sel ? sel.toString().trim() : '';

    return {
      isTestbook: true,
      pageTitle: document.title || '',
      url: window.location.href,
      isSummaryVisible,
      isSummaryModalClosed,
      isQuestionVisible,
      questionNumber,
      section,
      selectedChars: selectedText.length
    };
  }

  // Listen for messages from background / popup
  const api = typeof chrome !== 'undefined' && chrome.runtime ? chrome : typeof browser !== 'undefined' && browser.runtime ? browser : null;
  if (api && api.onMessage && typeof api.onMessage.addListener === 'function') {
    api.onMessage.addListener((msg, sender, sendResponse) => {
      if (!msg || typeof msg !== 'object') return false;

      if (msg.type === 'TESTBOOK_INSPECT') {
        try {
          const state = inspectPage();
          sendResponse({ success: true, ...state });
        } catch (e) {
          sendResponse({ success: false, error: e.message });
        }
        return false;
      }

      if (msg.type === 'EXTRACT_SUMMARY') {
        try {
          const summary = extractVisibleSummary();
          sendResponse({ success: true, summary });
        } catch (e) {
          sendResponse({ success: false, error: e.message });
        }
        return false;
      }

      if (msg.type === 'EXTRACT_QUESTION') {
        try {
          const question = extractVisibleQuestion();
          sendResponse({ success: true, question });
        } catch (e) {
          sendResponse({ success: false, error: e.message });
        }
        return false;
      }

      if (msg.type === 'EXTRACT_SELECTION') {
        try {
          const sel = window.getSelection();
          const text = sel ? sel.toString().trim() : '';
          sendResponse({ success: true, text });
        } catch (e) {
          sendResponse({ success: false, error: e.message });
        }
        return false;
      }

      return false;
    });
  }

  // Also expose on window for scripting fallback
  window.__studybridge_extractVisibleSummary = extractVisibleSummary;
  window.__studybridge_extractVisibleQuestion = extractVisibleQuestion;
  window.__studybridge_inspectPage = inspectPage;
})();
