/**
 * StudyBridge Full Mock Scanner Content Script (V4)
 * Executes one-click full mock scanning on Testbook analysis pages.
 * Preserves user state (active question, tab, scroll), scans summary table,
 * checks Question Paper view / Scrapling service, traverses question palette,
 * triggers solution view, and streams progress with pause/resume/cancel support.
 */

(() => {
  if (window.__studybridge_full_mock_scanner_installed__) return;
  window.__studybridge_full_mock_scanner_installed__ = true;

  const api =
    typeof chrome !== 'undefined' && chrome.runtime
      ? chrome
      : typeof browser !== 'undefined' && browser.runtime
      ? browser
      : null;

  const SCRAPLING_ENDPOINT = 'http://localhost:8787/parse/question-paper';

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

  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function isElementVisible(el) {
    if (!el) return false;
    if (el.classList.contains('ng-hide') || el.closest('.ng-hide')) return false;
    if (el.getAttribute('aria-hidden') === 'true' || el.closest('[aria-hidden="true"]')) return false;
    try {
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
        return false;
      }
    } catch (e) {}
    const inline = el.getAttribute('style') || '';
    if (/display\s*:\s*none/i.test(inline) || /visibility\s*:\s*hidden/i.test(inline)) {
      return false;
    }
    return true;
  }

  class FullMockScanner {
    constructor() {
      this.status = 'idle'; // 'idle' | 'running' | 'paused' | 'cancelled' | 'completed'
      this.scannedQuestions = [];
      this.currentIndex = 0;
      this.totalQuestions = 0;
      this.savedState = null;
      this.resumeResolver = null;
    }

    captureUserState() {
      const qNumEl = document.querySelector('.tp-ques-number');
      let currentQNum = null;
      if (qNumEl) {
        const m = cleanText(qNumEl.textContent).match(/(\d+)/);
        if (m) currentQNum = parseInt(m[1], 10);
      }

      this.savedState = {
        scrollX: window.scrollX || window.pageXOffset || 0,
        scrollY: window.scrollY || window.pageYOffset || 0,
        currentQNum
      };
    }

    async restoreUserState() {
      if (!this.savedState) return;

      try {
        // Return to normal questions tab if left in Question Paper view
        const qTabBtn = document.querySelector(
          '[ng-click*="setTab"][ng-click*="question"], a[href="#questions"]'
        );
        if (qTabBtn) {
          qTabBtn.click();
          await delay(250);
        }

        // Restore original active question
        if (this.savedState.currentQNum) {
          const paletteItems = document.querySelectorAll(
            'li[ng-click*="sideBarItemClicked"], .ques-num-list li'
          );
          for (const item of Array.from(paletteItems)) {
            if (cleanText(item.textContent) === String(this.savedState.currentQNum)) {
              item.click();
              await delay(200);
              break;
            }
          }
        }

        // Restore scroll position
        window.scrollTo(this.savedState.scrollX, this.savedState.scrollY);
      } catch (e) {
        console.warn('StudyBridge: state restore warning:', e);
      }
    }

    extractSummary() {
      if (typeof window.__studybridge_extractVisibleSummary === 'function') {
        try {
          return window.__studybridge_extractVisibleSummary();
        } catch (e) {}
      }

      let overallMarks = 0;
      const marksEl =
        document.querySelector('#summaryModal h4') ||
        document.querySelector('.modal-title') ||
        document.querySelector('.overall-score');
      if (marksEl) {
        const m = cleanText(marksEl.textContent).match(/(?:Total\s*Marks|Score)[:\s]+([0-9.]+)/i);
        if (m) overallMarks = parseNumber(m[1]);
      }

      const sections = [];
      const rows = document.querySelectorAll('#summaryModal table tbody tr, .table-responsive table tbody tr');
      for (const row of Array.from(rows)) {
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
        }
      }

      let examName = '';
      const analysisBtn = document.querySelector('.test-analysis-btn, a[href*="analysis"]');
      if (analysisBtn) {
        const href = analysisBtn.getAttribute('href') || '';
        const m = href.match(/\/TS-([^\/]+)/i);
        if (m) examName = m[1].replace(/-/g, ' ').toUpperCase();
      }

      return {
        overallMarks,
        examName: examName || undefined,
        mockName: document.title || 'Testbook Mock Test',
        sections
      };
    }

    async tryFetchQuestionPaperScrapling() {
      try {
        const qPaperBtn = document.querySelector(
          '[ng-click*="setTab"][ng-click*="qpaper"], a[href="#questionPaper"]'
        );

        if (qPaperBtn) {
          qPaperBtn.click();
          await delay(400);
        }

        const qPaperContainer = document.querySelector('#questionPaper, .qpaper-view, .question-paper-body');
        if (!qPaperContainer) {
          return null;
        }

        const html = qPaperContainer.innerHTML;
        if (!html || html.length < 100) return null;

        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 2500);

          const resp = await fetch(SCRAPLING_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ html }),
            signal: controller.signal
          });
          clearTimeout(timeoutId);

          if (resp.ok) {
            const data = await resp.json();
            if (Array.isArray(data)) return data;
            if (data && Array.isArray(data.questions)) {
              return data.questions;
            }
          }
        } catch (err) {
          // Scrapling service offline or unreachable; fall back to DOM palette traversal
        }
      } catch (err) {
        console.warn('StudyBridge: tryFetchQuestionPaperScrapling error:', err);
      } finally {
        try {
          // Toggle back to questions view
          const qTabBtn = document.querySelector(
            '[ng-click*="setTab"][ng-click*="question"], a[href="#questions"]'
          );
          if (qTabBtn) {
            qTabBtn.click();
            await delay(250);
          }
        } catch (e) {
          // Ignore toggle error
        }
      }

      return null;
    }

    extractCurrentQuestionData(qNumberFallback, sectionFallback) {
      let questionNumber = qNumberFallback;
      const qNumEl = document.querySelector('.tp-ques-number');
      if (qNumEl) {
        const m = cleanText(qNumEl.textContent).match(/(?:Question\s*No\.?)?\s*(\d+)/i);
        if (m) questionNumber = parseInt(m[1], 10);
      }

      let section = sectionFallback;
      const activeTab = document.querySelector(
        '.nav-tabs li.active, .sections-list li.active, .dropdown.ng-scope.active'
      );
      if (activeTab) {
        const textEl = activeTab.querySelector('.hidden-xs') || activeTab.querySelector('a') || activeTab;
        const sTxt = cleanText(textEl.textContent);
        if (sTxt) section = sTxt;
      }

      let statusBadge = '';
      const badgeEl = document.querySelector('.tp-info .badge');
      if (badgeEl && isElementVisible(badgeEl)) {
        statusBadge = cleanText(badgeEl.textContent);
      }

      let marks = undefined;
      const marksBadge = document.querySelector('.tp-pos-neg-marks .badge');
      if (marksBadge && isElementVisible(marksBadge)) {
        marks = parseNumber(marksBadge.textContent);
      }

      let timeTaken = '';
      let avgTime = '';
      const timeEls = document.querySelectorAll('.tp-info div');
      for (const tel of Array.from(timeEls)) {
        const txt = cleanText(tel.textContent);
        if (/You:\s*(\d+:\d+)/i.test(txt)) timeTaken = txt.match(/You:\s*(\d+:\d+)/i)[1];
        if (/Avg:\s*(\d+:\d+)/i.test(txt)) avgTime = txt.match(/Avg:\s*(\d+:\d+)/i)[1];
      }

      let questionText = '';
      const qDescEl = document.querySelector('[ng-bind-html*="getQuestionDesc"], .qns-view-box');
      if (qDescEl) {
        questionText = cleanText(qDescEl.textContent);
      }

      const qImg = document.querySelector('#questions img, .detailed-question img');
      const questionImage = qImg ? qImg.src : undefined;

      const options = [];
      let selectedAnswer = undefined;
      let correctAnswer = undefined;

      const optionEls = document.querySelectorAll('ul.list-unstyled li.option');
      let optIdx = 0;
      for (const opt of Array.from(optionEls)) {
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
          index: optIdx++,
          text: optText,
          isCorrect,
          isSelected
        });
      }

      if (!selectedAnswer && /skipped|unattempt/i.test(statusBadge)) {
        selectedAnswer = 'Left unattempted';
      }

      let explanation = undefined;
      const solDesc = document.querySelector(
        '[ng-bind-html*="getSolutionDesc"], .sol-view-box, .solution-content'
      );
      if (solDesc && isElementVisible(solDesc)) {
        explanation = cleanText(solDesc.textContent);
      }

      const isMistake =
        /incorrect|wrong|skipped/i.test(statusBadge) ||
        (selectedAnswer && correctAnswer && selectedAnswer !== correctAnswer);

      return {
        questionNumber,
        section,
        questionText,
        questionImage,
        options,
        selectedAnswer,
        correctAnswer,
        marks,
        explanation,
        statusBadge,
        timeTaken,
        avgTime,
        solutionStatus: explanation ? 'captured' : 'unavailable',
        isMistakeCandidate: Boolean(isMistake)
      };
    }

    sendProgress(current, total, section, questionNumber) {
      if (!api || !api.runtime) return;
      const percent = total > 0 ? Math.round((current / total) * 100) : 0;
      try {
        api.runtime.sendMessage({
          type: 'SCAN_PROGRESS',
          current,
          total,
          section: section || 'Mock Scan',
          questionNumber: questionNumber || current,
          percent,
          status: this.status
        }).catch(() => {});
      } catch (e) {}
    }

    async checkPause() {
      if (this.status !== 'paused') return;
      await new Promise((resolve) => {
        this.resumeResolver = resolve;
      });
      this.resumeResolver = null;
    }

    pause() {
      if (this.status === 'running') {
        this.status = 'paused';
        this.sendProgress(this.currentIndex + 1, this.totalQuestions, 'Paused', this.currentIndex + 1);
        return true;
      }
      return false;
    }

    resume() {
      if (this.status === 'paused') {
        this.status = 'running';
        if (this.resumeResolver) {
          this.resumeResolver();
        }
        return true;
      }
      return false;
    }

    cancel() {
      this.status = 'cancelled';
      if (this.resumeResolver) {
        this.resumeResolver();
      }
    }

    async startScan() {
      if (this.status === 'running') return;
      this.status = 'running';
      this.scannedQuestions = [];
      const startTime = Date.now();

      this.captureUserState();

      // 1. Extract visible summary
      const summary = this.extractSummary();

      // 2. Try bulk extraction via Question Paper / Scrapling
      const bulkQs = await this.tryFetchQuestionPaperScrapling();
      const bulkMap = new Map();
      if (bulkQs && Array.isArray(bulkQs)) {
        for (const bq of bulkQs) {
          if (bq && bq.questionNumber) {
            bulkMap.set(bq.questionNumber, bq);
          }
        }
      }

      // 3. Collect palette items
      const paletteItems = Array.from(
        document.querySelectorAll('li[ng-click*="sideBarItemClicked"], .ques-num-list li')
      );
      this.totalQuestions = paletteItems.length || 130;

      // 4. Traverse questions
      for (let i = 0; i < paletteItems.length; i++) {
        this.currentIndex = i;

        if (this.status === 'cancelled') {
          break;
        }

        await this.checkPause();
        if (this.status === 'cancelled') break;

        const item = paletteItems[i];
        const itemText = cleanText(item.textContent);
        const qNum = parseInt(itemText, 10) || i + 1;

        // Click question in palette
        item.click();
        await delay(120);

        // Determine current section
        let sectionName = 'General';
        const activeTab = document.querySelector('.nav-tabs li.active, .dropdown.ng-scope.active');
        if (activeTab) {
          const sText = cleanText(activeTab.textContent);
          if (sText) sectionName = sText;
        }

        this.sendProgress(i + 1, this.totalQuestions, sectionName, qNum);

        // Trigger View Solution if explanation is not visible
        const existingSol = document.querySelector(
          '[ng-bind-html*="getSolutionDesc"], .sol-view-box, .solution-content'
        );
        if (!existingSol || !isElementVisible(existingSol)) {
          const solBtn = document.querySelector(
            'button[ng-click*="toggleViewSolution"], [ng-click*="viewSolution"], .btn-view-solution'
          );
          if (solBtn && isElementVisible(solBtn)) {
            solBtn.click();
            await delay(180);
          }
        }

        // Extract question data
        const qData = this.extractCurrentQuestionData(qNum, sectionName);

        // Merge with bulk Scrapling data if available
        if (bulkMap.has(qNum)) {
          const bq = bulkMap.get(qNum);
          if (!qData.explanation && bq.solution) qData.explanation = bq.solution;
          if (!qData.questionText && bq.question) qData.questionText = bq.question;
        }

        this.scannedQuestions.push(qData);
      }

      const isCompleted = this.status !== 'cancelled';
      this.status = isCompleted ? 'completed' : 'cancelled';

      await this.restoreUserState();

      const finalResult = {
        examName: summary?.examName || document.title,
        mockName: summary?.mockName || document.title || 'Testbook Mock Test',
        overallScore: summary?.overallMarks || 0,
        sections: summary?.sections || [],
        totalQuestions: this.scannedQuestions.length,
        questions: this.scannedQuestions,
        scanDurationMs: Date.now() - startTime
      };

      if (api && api.runtime) {
        if (isCompleted) {
          api.runtime.sendMessage({
            type: 'SCAN_COMPLETED',
            result: finalResult
          }).catch(() => {});
        } else {
          api.runtime.sendMessage({
            type: 'SCAN_CANCELLED',
            partialResult: finalResult
          }).catch(() => {});
        }
      }

      return finalResult;
    }
  }

  const scannerInstance = new FullMockScanner();
  window.__studybridge_full_mock_scanner__ = scannerInstance;

  // Listen for control messages from background
  if (api && api.runtime && api.runtime.onMessage) {
    api.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      if (!msg || typeof msg !== 'object') return false;

      if (msg.type === 'START_FULL_SCAN') {
        scannerInstance.startScan().catch((err) => {
          console.error('StudyBridge Scanner error:', err);
          if (api.runtime) {
            api.runtime.sendMessage({ type: 'SCAN_ERROR', error: err.message }).catch(() => {});
          }
        });
        sendResponse({ success: true, status: 'started' });
        return false;
      }

      if (msg.type === 'SCAN_PAUSE') {
        const ok = scannerInstance.pause();
        sendResponse({ success: ok, status: scannerInstance.status });
        return false;
      }

      if (msg.type === 'SCAN_RESUME') {
        const ok = scannerInstance.resume();
        sendResponse({ success: ok, status: scannerInstance.status });
        return false;
      }

      if (msg.type === 'SCAN_CANCEL') {
        scannerInstance.cancel();
        sendResponse({ success: true, status: 'cancelled' });
        return false;
      }

      if (msg.type === 'GET_SCAN_STATUS') {
        sendResponse({
          success: true,
          status: scannerInstance.status,
          current: scannerInstance.currentIndex + 1,
          total: scannerInstance.totalQuestions,
          scannedCount: scannerInstance.scannedQuestions.length
        });
        return false;
      }

      return false;
    });
  }
})();

