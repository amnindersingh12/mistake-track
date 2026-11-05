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

  const DEVANAGARI = /[\u0900-\u097F]/;
  const LABEL = /^\(?([A-Ea-e]|[1-5])[\).:\-]\s+/;

  function normalizeOptionsRaw(raw) {
    let cleaned = (raw || [])
      .map((o) => (o || '').normalize('NFKC').replace(/\s+/g, ' ').trim().replace(LABEL, '').trim())
      .filter(Boolean);

    const english = cleaned.filter((o) => !DEVANAGARI.test(o));
    if (english.length >= 2 && english.length < cleaned.length) cleaned = english;

    const seen = new Set();
    const options = cleaned.filter((o) => {
      const key = o.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const needsReview = options.length < 2 || options.length > 5;
    return { options, needsReview, reason: needsReview ? `${options.length} options found, expected 2 to 5` : undefined };
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

  function inPageTestbookExport() {
    (async function exportTestbookMock() {
      "use strict";

      const VERSION = "1.0";
      const LANG = "en";

      const textOf = html => {
        if (!html) return "";
        const doc = new DOMParser().parseFromString(String(html), "text/html");
        return (doc.body.textContent || "").replace(/\s+/g, " ").trim();
      };

      const htmlOf = value => {
        if (typeof value === "string") return value;
        if (!value || typeof value !== "object") return "";
        return String(value.html ?? value.value ?? value.description ?? value.text ?? "");
      };

      const safeClone = (value, seen = new WeakSet(), depth = 0) => {
        if (value === null || value === undefined) return value;
        if (typeof value !== "object") {
          return typeof value === "function" ? undefined : value;
        }
        if (depth > 8) return "[Max depth]";
        if (seen.has(value)) return "[Circular reference]";
        seen.add(value);
        let output;
        if (Array.isArray(value)) {
          output = value.map(v => safeClone(v, seen, depth + 1));
        } else {
          output = {};
          for (const key of Object.keys(value)) {
            if (key.startsWith("$$") || key.startsWith("$")) continue;
            try {
              const v = value[key];
              if (typeof v === "function") continue;
              output[key] = safeClone(v, seen, depth + 1);
            } catch (_) {}
          }
        }
        seen.delete(value);
        return output;
      };

      const asArray = value => {
        if (Array.isArray(value)) return value;
        if (value && typeof value === "object") return Object.values(value);
        return [];
      };

      const labelOf = value => {
        if (typeof value === "string") return value;
        if (typeof value === "number") return String(value);
        if (value && typeof value === "object") {
          return value.name ?? value.title ?? value.label ?? value.value ?? null;
        }
        return null;
      };

      function findTestScope() {
        if (!window.angular) return null;
        const found = new Set();
        function walk(scope) {
          if (!scope || found.has(scope)) return;
          found.add(scope);
          for (let child = scope.$$childHead; child; child = child.$$nextSibling) {
            walk(child);
          }
        }
        try {
          const app = document.querySelector("[ng-app]") || document.body;
          const injector = angular.element(app).injector();
          if (injector) walk(injector.get("$rootScope"));
        } catch (_) {}

        const elements = document.querySelectorAll(
          "[ng-view], [ng-controller], [ng-repeat*='section in test.sections'], #questions, #questionPaper"
        );
        for (const element of elements) {
          try {
            let scope = angular.element(element).scope();
            while (scope) {
              found.add(scope);
              scope = scope.$parent;
            }
          } catch (_) {}
        }

        const candidates = [...found].filter(scope =>
          scope.test && Array.isArray(scope.test.sections) && typeof scope.getQuestionDesc === "function"
        );
        candidates.sort((a, b) => {
          const score = s =>
            (typeof s.getOptions === "function" ? 5 : 0) +
            (typeof s.getSolutionDesc === "function" ? 5 : 0) +
            (typeof s.isCorrectOption === "function" ? 3 : 0);
          return score(b) - score(a);
        });
        return candidates[0] || null;
      }

      const scope = findTestScope();
      const pageTitle = document.querySelector(".test-top-bar h6")?.textContent.trim() || document.title || "Mock Test";
      const testUrl = location.href;

      function domFallback() {
        const root = document.querySelector("#questionPaper");
        if (!root) return null;
        const body = root.querySelector(".body-inner");
        if (!body) return null;
        const sections = [];
        for (const sectionEl of body.children) {
          const heading = sectionEl.querySelector("h4");
          if (!heading) continue;
          const questions = [];
          const rows = sectionEl.querySelectorAll("li[ng-repeat*='question in section.questions']");
          for (const [i, row] of [...rows].entries()) {
            const qEl = row.querySelector("[ng-bind-html*='getQuestionDesc']");
            if (!qEl) continue;
            const rawOptTexts = [...row.querySelectorAll("ol li[ng-repeat*='option in getOptions']")].map((el) => textOf(el.innerHTML));
            const norm = normalizeOptionsRaw(rawOptTexts);
            const options = norm.options.map((text, index) => ({
              label: String.fromCharCode(65 + index),
              text,
              html: text
            }));
            questions.push({
              number: i + 1,
              question: textOf(qEl.innerHTML),
              questionHtml: qEl.innerHTML,
              options,
              correctAnswer: null,
              solution: null,
              solutionHtml: null,
              subject: null,
              topic: null,
              extractionMode: "DOM fallback"
            });
          }
          sections.push({
            sectionName: heading.textContent.trim(),
            questions
          });
        }
        return sections;
      }

      function findMetadata(question, section, test, keys) {
        for (const obj of [question, section, test]) {
          if (!obj || typeof obj !== "object") continue;
          for (const key of keys) {
            const value = labelOf(obj[key]);
            if (value !== null && value !== "") return value;
          }
        }
        return null;
      }

      const subjectKeys = ["subjectName", "subject_name", "subjectTitle", "subject_title", "subject"];
      const topicKeys = ["topicName", "topic_name", "topic", "chapterName", "chapter_name", "chapter", "subTopicName", "sub_topic", "subTopic", "unitName"];

      function trueFlag(value) {
        return value === true || value === 1 || ["true", "1", "yes", "correct"].includes(String(value).toLowerCase());
      }

      function hasCorrectFlag(obj, depth = 0) {
        if (!obj || typeof obj !== "object" || depth > 3) return false;
        for (const [key, value] of Object.entries(obj)) {
          if (/^(is_?correct|correct|is_?right|is_?answer)$/i.test(key) && trueFlag(value)) return true;
          if (value && typeof value === "object" && hasCorrectFlag(value, depth + 1)) return true;
        }
        return false;
      }

      function checkCorrectByTestbookFunction(options, sectionNo, questionNo) {
        if (!scope || typeof scope.isCorrectOption !== "function") return [];
        const hadOwn = Object.prototype.hasOwnProperty.call(scope, "currentQuestion");
        const previous = scope.currentQuestion;
        try {
          scope.currentQuestion = Object.assign({}, previous && typeof previous === "object" ? previous : {}, { sSNo: sectionNo, qSNo: questionNo });
          return options
            .map((option, index) => {
              try {
                return scope.isCorrectOption.call(scope, option) ? index : -1;
              } catch (_) {
                return -1;
              }
            })
            .filter(index => index >= 0);
        } catch (_) {
          return [];
        } finally {
          if (hadOwn) scope.currentQuestion = previous;
          else delete scope.currentQuestion;
        }
      }

      function checkAttemptedByTestbookFunction(options, sectionNo, questionNo) {
        if (!scope || typeof scope.firstAttemptedOption !== "function") return -1;
        const hadOwn = Object.prototype.hasOwnProperty.call(scope, "currentQuestion");
        const previous = scope.currentQuestion;
        try {
          scope.currentQuestion = Object.assign({}, previous && typeof previous === "object" ? previous : {}, { sSNo: sectionNo, qSNo: questionNo });
          for (let i = 0; i < options.length; i++) {
            try {
              if (scope.firstAttemptedOption.call(scope, options[i])) return i;
            } catch (_) {}
          }
          return -1;
        } catch (_) {
          return -1;
        } finally {
          if (hadOwn) scope.currentQuestion = previous;
          else delete scope.currentQuestion;
        }
      }

      function inferFromSolution(solution, options) {
        const normalizedSolution = textOf(solution).toLowerCase().replace(/\s+/g, " ");
        if (!normalizedSolution) return [];
        const matches = options
          .map((option, index) => ({ index, text: option.text.toLowerCase().trim() }))
          .filter(option => option.text.length >= 7 && normalizedSolution.includes(option.text));
        if (matches.length === 1) return [matches[0].index];
        const match = normalizedSolution.match(/(?:correct answer|answer)\s*(?:is|:)?\s*(?:option\s*)?\(?([a-e])\)?/i);
        if (match) return [match[1].toLowerCase().charCodeAt(0) - 97];
        return [];
      }

      async function extractTest() {
        const test = scope.test;
        const sections = [];
        let totalQuestions = 0;
        const sourceSections = asArray(test.sections);

        for (let si = 0; si < sourceSections.length; si++) {
          const section = sourceSections[si];
          const questions = asArray(section.questions).filter(q => q && q.isShow !== false);
          const exportedQuestions = [];

          for (let qi = 0; qi < questions.length; qi++) {
            const q = questions[qi];
            const sectionNo = si + 1;
            const questionNo = Number.isFinite(Number(q.index)) ? Number(q.index) + 1 : qi + 1;

            let questionHtml = "";
            let solutionHtml = "";
            let rawOptions = [];

            try {
              questionHtml = (await Promise.resolve(scope.getQuestionDesc(sectionNo, questionNo, LANG))) || "";
            } catch (_) {}
            try {
              solutionHtml = (await Promise.resolve(typeof scope.getSolutionDesc === "function" ? scope.getSolutionDesc(sectionNo, questionNo, LANG) : "")) || "";
            } catch (_) {}
            try {
              rawOptions = (await Promise.resolve(typeof scope.getOptions === "function" ? scope.getOptions(q) : (q.options || q.answers || []))) || [];
            } catch (_) {
              rawOptions = q.options || q.answers || [];
            }

            rawOptions = asArray(rawOptions);
            const options = rawOptions.map((option, index) => {
              const value = option && typeof option === "object" ? (option.value ?? option.text ?? option.description ?? option.name ?? "") : option;
              const html = htmlOf(value);
              return { label: String.fromCharCode(65 + index), text: textOf(html), html, raw: safeClone(option) };
            });

            if (!questionHtml) {
              questionHtml = q.description || q.questionText || q.question || q.desc || "";
            }

            let correctIndices = checkCorrectByTestbookFunction(rawOptions, sectionNo, questionNo);
            let answerSource = correctIndices.length ? "Testbook isCorrectOption()" : null;

            if (!correctIndices.length) {
              correctIndices = rawOptions.map((option, index) => (hasCorrectFlag(option) ? index : -1)).filter(index => index >= 0);
              if (correctIndices.length) answerSource = "Option data";
            }
            if (!correctIndices.length) {
              correctIndices = inferFromSolution(solutionHtml, options);
              if (correctIndices.length) answerSource = "Solution text match";
            }

            const correctAnswers = correctIndices.filter(index => options[index]).map(index => options[index]);

            let attemptedIndex = checkAttemptedByTestbookFunction(rawOptions, sectionNo, questionNo);
            let selectedAnswer = null;
            if (attemptedIndex >= 0 && options[attemptedIndex]) {
              selectedAnswer = options[attemptedIndex].text;
              options[attemptedIndex].isSelected = true;
            }

            exportedQuestions.push({
              questionNumber: questionNo,
              questionId: q._id || q.id || null,
              subject: findMetadata(q, section, test, subjectKeys),
              topic: findMetadata(q, section, test, topicKeys),
              section: labelOf(section.title) || labelOf(section.name) || `Section ${sectionNo}`,
              question: textOf(questionHtml),
              questionHtml: htmlOf(questionHtml),
              options,
              selectedAnswer,
              correctAnswer: correctAnswers.length ? correctAnswers.map(o => ({ label: o.label, text: o.text })) : null,
              answerSource,
              solution: textOf(solutionHtml),
              solutionHtml: htmlOf(solutionHtml),
              solutionAvailable: !!textOf(solutionHtml),
              marks: q.marks ?? q.maxMarks ?? null,
              questionType: q.questionType ?? q.type ?? null,
              rawQuestion: safeClone(q)
            });
            totalQuestions++;
          }

          sections.push({
            sectionNumber: si + 1,
            sectionName: labelOf(section.title) || labelOf(section.name) || `Section ${si + 1}`,
            subject: findMetadata(section, test, null, subjectKeys),
            questionCount: exportedQuestions.length,
            questions: exportedQuestions,
            rawSection: safeClone(section)
          });
        }

        return { sections, totalQuestions };
      }

      let extracted;
      if (scope) {
        extracted = await extractTest();
      } else {
        extracted = { sections: domFallback() || [] };
        extracted.totalQuestions = extracted.sections.reduce((sum, s) => sum + s.questions.length, 0);
      }

      if (!extracted.sections.length || !extracted.totalQuestions) {
        throw new Error("No questions found. Open completed test's Question Paper or Solution page and retry.");
      }

      const data = {
        exporter: "Testbook Mock Test Exporter",
        exporterVersion: VERSION,
        exportedAt: new Date().toISOString(),
        test: {
          title: pageTitle,
          url: testUrl,
          testId: testUrl.match(/\/tests\/([^/?]+)/)?.[1] || null,
          totalSections: extracted.sections.length,
          totalQuestions: extracted.totalQuestions
        },
        sections: extracted.sections,
        exportSummary: {
          sections: extracted.sections.length,
          questions: extracted.totalQuestions,
          solutionsAvailable: 0,
          answersIdentified: 0
        }
      };

      for (const section of data.sections) {
        for (const q of section.questions) {
          if (q.solutionAvailable) data.exportSummary.solutionsAvailable++;
          if (q.correctAnswer) data.exportSummary.answersIdentified++;
        }
      }

      try {
        const filename = (pageTitle.replace(/[^a-z0-9_-]+/gi, "_") || "mock_test") + "_FULL_EXPORT.json";
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      } catch (_) {}

      window.TESTBOOK_LAST_EXPORT = data;
      return data;
    })().then(data => {
      window.postMessage({ type: '__STUDYBRIDGE_ANGULAR_EXPORT_COMPLETE__', data }, '*');
    }).catch(err => {
      window.postMessage({ type: '__STUDYBRIDGE_ANGULAR_EXPORT_FAIL__', error: err.message }, '*');
    });
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
      } catch {
        // Suppress state restore warning in production
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
      } catch {
        // Suppress background scrape error; fallback to DOM traversal
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

      const qContainer = document.querySelector('#questions, .detailed-question') || document;
      const optionEls = qContainer.querySelectorAll('ul.list-unstyled li.option');
      const rawOptions = [];

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

        rawOptions.push({
          text: optText,
          isCorrect,
          isSelected
        });
      }

      const normalized = normalizeOptionsRaw(rawOptions.map((o) => o.text));
      let selectedAnswer = undefined;
      let correctAnswer = undefined;

      const options = normalized.options.map((optText, idx) => {
        const orig = rawOptions.find((o) => o.text.toLowerCase().includes(optText.toLowerCase()) || optText.toLowerCase().includes(o.text.toLowerCase()));
        const isCorrect = orig ? orig.isCorrect : false;
        const isSelected = orig ? orig.isSelected : false;
        if (isCorrect) correctAnswer = optText;
        if (isSelected && statusBadge.toLowerCase() !== 'skipped') selectedAnswer = optText;

        return {
          index: idx,
          label: String.fromCharCode(65 + idx),
          text: optText,
          isCorrect,
          isSelected
        };
      });

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
        isMistakeCandidate: Boolean(isMistake),
        needsReview: normalized.needsReview,
        reviewReason: normalized.reason
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

    executeAngularExporterInPage() {
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          window.removeEventListener('message', onMsg);
          resolve(null);
        }, 15000);

        function onMsg(ev) {
          if (ev.source !== window || !ev.data) return;
          if (ev.data.type === '__STUDYBRIDGE_ANGULAR_EXPORT_COMPLETE__') {
            clearTimeout(timeout);
            window.removeEventListener('message', onMsg);
            resolve(ev.data.data);
          } else if (ev.data.type === '__STUDYBRIDGE_ANGULAR_EXPORT_FAIL__') {
            clearTimeout(timeout);
            window.removeEventListener('message', onMsg);
            resolve(null);
          }
        }

        window.addEventListener('message', onMsg);

        try {
          const scriptEl = document.createElement('script');
          scriptEl.setAttribute('type', 'text/javascript');
          scriptEl.textContent = '(' + inPageTestbookExport.toString() + ')();';
          (document.head || document.documentElement).appendChild(scriptEl);
          scriptEl.remove();
        } catch {
          clearTimeout(timeout);
          window.removeEventListener('message', onMsg);
          resolve(null);
        }
      });
    }

    convertExportToScanResult(exportData, summary, startTime) {
      const allQuestions = [];
      const sections = [];

      for (const sec of exportData.sections || []) {
        let secCorrect = 0;
        let secIncorrect = 0;
        let secSkipped = 0;
        let secMarks = 0;

        for (const q of sec.questions || []) {
          const correctText = q.correctAnswer && q.correctAnswer[0]?.text ? cleanText(q.correctAnswer[0].text) : '';
          const correctLabel = (q.correctAnswer && q.correctAnswer[0]?.label) || '';

          const mappedOptions = (q.options || []).map((opt, idx) => {
            const optText = cleanText(opt.text || opt.html || '');
            const isOptCorrect = opt.label === correctLabel || optText === correctText;
            const isOptSelected = Boolean(opt.isSelected || (q.selectedAnswer && cleanText(q.selectedAnswer) === optText));
            return {
              index: idx,
              text: optText,
              isCorrect: isOptCorrect,
              isSelected: isOptSelected
            };
          });

          let selectedText = q.selectedAnswer ? cleanText(q.selectedAnswer) : undefined;
          let isCorrect = false;
          let isWrong = false;
          let isSkipped = true;

          if (selectedText && selectedText !== 'Left unattempted') {
            isSkipped = false;
            if (selectedText === correctText) {
              isCorrect = true;
            } else {
              isWrong = true;
            }
          }

          const qMarks = q.marks !== null && q.marks !== undefined ? q.marks : (q.rawQuestion?.posMarks || 1);
          const negMarks = q.rawQuestion?.negMarks || 0.25;

          if (isCorrect) {
            secCorrect++;
            secMarks += qMarks;
          } else if (isWrong) {
            secIncorrect++;
            secMarks -= negMarks;
          } else {
            secSkipped++;
          }

          const statusBadge = isCorrect ? 'Correct' : isWrong ? 'Wrong' : 'Skipped';

          allQuestions.push({
            questionNumber: q.questionNumber,
            section: q.section || sec.sectionName || 'General',
            questionText: cleanText(q.question),
            options: mappedOptions,
            selectedAnswer: selectedText || (isSkipped ? 'Left unattempted' : undefined),
            correctAnswer: correctText,
            marks: qMarks,
            explanation: cleanText(q.solution),
            topic: q.topic || q.subject || undefined,
            statusBadge,
            solutionStatus: q.solutionAvailable ? 'captured' : 'unavailable',
            isMistakeCandidate: isWrong || isSkipped
          });
        }

        sections.push({
          sectionName: sec.sectionName || `Section ${sections.length + 1}`,
          questionCount: sec.questionCount || (sec.questions || []).length,
          correctCount: secCorrect,
          incorrectCount: secIncorrect,
          skippedCount: secSkipped,
          marks: Number(secMarks.toFixed(2))
        });
      }

      const overallScore = summary?.overallMarks || Number(sections.reduce((acc, s) => acc + s.marks, 0).toFixed(2));

      return {
        examName: exportData.test?.title || summary?.examName || document.title,
        mockName: exportData.test?.title || summary?.mockName || document.title || 'Testbook Mock Test',
        overallScore,
        sections: summary?.sections?.length ? summary.sections : sections,
        totalQuestions: exportData.totalQuestions || allQuestions.length,
        questions: allQuestions,
        scanDurationMs: Date.now() - startTime
      };
    }

    async startScan() {
      if (this.status === 'running') return;
      this.status = 'running';
      this.scannedQuestions = [];
      const startTime = Date.now();

      this.captureUserState();

      // 1. Extract visible summary
      const summary = this.extractSummary();

      // 1.5 Fast-path: Execute in-page Angular Scope Test Exporter (direct data model access)
      try {
        this.sendProgress(0, 130, 'Detecting Testbook Angular model...', 0);
        const angularExport = await this.executeAngularExporterInPage();
        if (
          angularExport &&
          Array.isArray(angularExport.sections) &&
          angularExport.sections.length > 0 &&
          angularExport.totalQuestions > 0
        ) {
          const finalResult = this.convertExportToScanResult(angularExport, summary, startTime);
          await this.restoreUserState();
          this.status = 'completed';
          if (api && api.runtime) {
            api.runtime.sendMessage({
              type: 'SCAN_COMPLETED',
              result: finalResult
            }).catch(() => {});
          }
          return finalResult;
        }
      } catch {
        // Fall back to DOM palette traversal if in-page extraction fails
      }

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

