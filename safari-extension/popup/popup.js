/**
 * StudyBridge Popup Logic V2
 * Controls Mode A (Result Summary), Mode B (Current Question), and Mode C (Selection).
 * Inspects active tab, displays Dusk manga indicators, and triggers transfers.
 */

document.addEventListener('DOMContentLoaded', () => {
  const connBadge = document.getElementById('conn-badge');
  const connText = document.getElementById('conn-text');
  const sourceBadge = document.getElementById('source-badge');
  const sourceText = document.getElementById('source-text');
  const pageTitleEl = document.getElementById('page-title');
  const reviewContextEl = document.getElementById('review-context');
  const selectionCountEl = document.getElementById('selection-count');

  const summaryBtn = document.getElementById('import-summary-btn');
  const summaryHint = document.getElementById('summary-hint');
  const questionBtn = document.getElementById('import-question-btn');
  const questionHint = document.getElementById('question-hint');
  const selectionBtn = document.getElementById('import-selection-btn');
  const selectionHint = document.getElementById('selection-hint');

  const statusAlert = document.getElementById('status-alert');
  const toggleSettingsBtn = document.getElementById('toggle-settings');
  const settingsBox = document.getElementById('settings-box');
  const appUrlInput = document.getElementById('app-url-input');
  const saveSettingsBtn = document.getElementById('save-settings-btn');

  let currentTabState = null;

  function showAlert(msg, isSuccess = true) {
    statusAlert.textContent = msg;
    statusAlert.className = `status-alert ${isSuccess ? 'success' : 'error'}`;
    statusAlert.classList.remove('hidden');
  }

  function hideAlert() {
    statusAlert.classList.add('hidden');
  }

  function setBadge(el, textEl, type, label) {
    el.className = `badge badge-${type}`;
    textEl.textContent = label;
  }

  // Load status from background worker
  function refreshStatus() {
    chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (res) => {
      if (chrome.runtime.lastError || !res || !res.success) {
        setBadge(connBadge, connText, 'danger', 'Extension error');
        setBadge(sourceBadge, sourceText, 'danger', 'Unable to inspect');
        showAlert(chrome.runtime.lastError?.message || 'Background worker inactive', false);
        return;
      }

      currentTabState = res;

      // 1. Connection status
      if (res.isAppConnected) {
        setBadge(connBadge, connText, 'success', 'Connected');
      } else {
        setBadge(connBadge, connText, 'warning', 'App not running');
      }

      // 2. Source status
      pageTitleEl.textContent = res.pageTitle || 'Unknown Page';
      pageTitleEl.title = res.pageTitle || '';

      const chars = res.selectedChars || 0;
      selectionCountEl.textContent = `${chars} char${chars === 1 ? '' : 's'}`;

      if (!res.isTestbook) {
        setBadge(sourceBadge, sourceText, 'danger', 'Unsupported site');
        reviewContextEl.textContent = 'Not Testbook';
        summaryBtn.disabled = true;
        questionBtn.disabled = true;
        selectionBtn.disabled = true;
        return;
      }

      // Review context display
      if (res.isQuestionVisible) {
        reviewContextEl.textContent = `Q${res.questionNumber || 1} (${res.section || 'General'})`;
        setBadge(sourceBadge, sourceText, 'success', 'Question review');
      } else if (res.isSummaryVisible) {
        reviewContextEl.textContent = 'Summary Open';
        setBadge(sourceBadge, sourceText, 'success', 'Summary table');
      } else if (res.isSummaryModalClosed) {
        reviewContextEl.textContent = 'Modal Closed';
        setBadge(sourceBadge, sourceText, 'warning', 'Summary closed');
      } else {
        reviewContextEl.textContent = 'Ready';
        setBadge(sourceBadge, sourceText, 'neutral', 'Testbook ready');
      }

      // Mode A: Summary Button
      if (res.isSummaryVisible) {
        summaryBtn.disabled = false;
        summaryHint.textContent = 'Visible summary table detected';
      } else if (res.isSummaryModalClosed) {
        summaryBtn.disabled = false;
        summaryHint.textContent = 'Modal closed — click to view requirement';
      } else {
        summaryBtn.disabled = false;
        summaryHint.textContent = 'Click to read visible summary table';
      }

      // Mode B: Question Button
      if (res.isQuestionVisible) {
        questionBtn.disabled = false;
        questionHint.textContent = `Q${res.questionNumber || 1} (${res.section || 'General'}) ready`;
      } else {
        questionBtn.disabled = true;
        questionHint.textContent = 'No question review visible';
      }

      // Mode C: Selection Button
      if (chars > 0) {
        selectionBtn.disabled = false;
        selectionHint.textContent = `${chars} chars highlighted`;
      } else {
        selectionBtn.disabled = true;
        selectionHint.textContent = 'Highlight text on page first';
      }

      if (res.appUrl) {
        appUrlInput.value = res.appUrl;
      }
    });
  }

  // Trigger Capture for specified mode
  function triggerCapture(mode, buttonEl, originalHtml) {
    hideAlert();
    buttonEl.disabled = true;
    buttonEl.innerHTML = '<span>⏳ Transferring...</span>';

    chrome.runtime.sendMessage({ type: 'CAPTURE_MODE', mode }, (res) => {
      buttonEl.innerHTML = originalHtml;
      buttonEl.disabled = false;

      if (chrome.runtime.lastError || !res || !res.success) {
        showAlert(res?.error || chrome.runtime.lastError?.message || 'Transfer failed.', false);
        return;
      }

      if (mode === 'summary') {
        showAlert('✓ Transferred result summary to Study App preview!');
      } else if (mode === 'question') {
        showAlert('✓ Transferred current question to Mistake Log preview!');
      } else {
        showAlert(`✓ Transferred ${res.charCount || ''} chars to Study App!`);
      }

      refreshStatus();
    });
  }

  // Mode A Click: Summary
  summaryBtn.addEventListener('click', () => {
    if (currentTabState?.isSummaryModalClosed) {
      showAlert('Summary modal is closed. Please open the Summary modal on Testbook first.', false);
      return;
    }
    triggerCapture('summary', summaryBtn, summaryBtn.innerHTML);
  });

  // Mode B Click: Question
  questionBtn.addEventListener('click', () => {
    triggerCapture('question', questionBtn, questionBtn.innerHTML);
  });

  // Mode C Click: Selection
  selectionBtn.addEventListener('click', () => {
    triggerCapture('selection', selectionBtn, selectionBtn.innerHTML);
  });

  // Toggle Settings Panel
  toggleSettingsBtn.addEventListener('click', () => {
    settingsBox.classList.toggle('hidden');
  });

  // Save Settings
  saveSettingsBtn.addEventListener('click', () => {
    const url = appUrlInput.value.trim();
    if (!url) return;

    chrome.runtime.sendMessage({ type: 'SET_CONFIG', appUrl: url }, (res) => {
      if (res && res.success) {
        showAlert('Study App URL updated successfully!');
        setTimeout(hideAlert, 2000);
      } else {
        showAlert(res?.error || 'Failed to update configuration.', false);
      }
    });
  });

  // Initial inspection
  refreshStatus();
});
