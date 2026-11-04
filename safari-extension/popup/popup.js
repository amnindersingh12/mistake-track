/**
 * StudyBridge Popup Logic V4
 * Controls One-Click Full Mock Scanner, Result Summary, Current Question, and Selection.
 */

document.addEventListener('DOMContentLoaded', () => {
  const connBadge = document.getElementById('conn-badge');
  const connText = document.getElementById('conn-text');
  const sourceBadge = document.getElementById('source-badge');
  const sourceText = document.getElementById('source-text');
  const pageTitleEl = document.getElementById('page-title');
  const reviewContextEl = document.getElementById('review-context');
  const selectionCountEl = document.getElementById('selection-count');

  // Full Mock Scanner Elements
  const scanEntireMockBtn = document.getElementById('scan-entire-mock-btn');
  const fullMockHint = document.getElementById('full-mock-hint');
  const scanProgressCard = document.getElementById('scan-progress-card');
  const scanSectionBadge = document.getElementById('scan-section-badge');
  const scanQuestionCounter = document.getElementById('scan-question-counter');
  const scanPercentText = document.getElementById('scan-percent-text');
  const scanProgressFill = document.getElementById('scan-progress-fill');
  const scanPauseResumeBtn = document.getElementById('scan-pause-resume-btn');
  const pauseResumeIcon = document.getElementById('pause-resume-icon');
  const pauseResumeLabel = document.getElementById('pause-resume-label');
  const scanCancelBtn = document.getElementById('scan-cancel-btn');

  // Standard Action Buttons
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
  let isScanning = false;
  let isPaused = false;

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

  function updateScanUi(current, total, section, percent, status) {
    scanProgressCard.classList.remove('hidden');
    scanQuestionCounter.textContent = `Q ${current || 0} / ${total || 130}`;
    scanPercentText.textContent = `${percent || 0}%`;
    scanProgressFill.style.width = `${Math.min(100, Math.max(0, percent || 0))}%`;
    scanSectionBadge.textContent = section || 'General';

    if (status === 'paused') {
      isPaused = true;
      pauseResumeIcon.textContent = '▶';
      pauseResumeLabel.textContent = 'Resume';
      scanPauseResumeBtn.className = 'manga-btn ctrl-btn ctrl-resume';
    } else {
      isPaused = false;
      pauseResumeIcon.textContent = '⏸';
      pauseResumeLabel.textContent = 'Pause';
      scanPauseResumeBtn.className = 'manga-btn ctrl-btn ctrl-pause';
    }
  }

  function hideScanUi() {
    scanProgressCard.classList.add('hidden');
    scanEntireMockBtn.disabled = !currentTabState?.isTestbook;
    isScanning = false;
    isPaused = false;
  }

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
        scanEntireMockBtn.disabled = true;
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

      // Full Mock Scanner Button
      scanEntireMockBtn.disabled = false;
      fullMockHint.textContent = 'Ready to scan full 130+ question paper';

      // Summary Button
      summaryBtn.disabled = false;

      // Question Button
      if (res.isQuestionVisible) {
        questionBtn.disabled = false;
        questionHint.textContent = `Q${res.questionNumber || 1} (${res.section || 'General'}) ready`;
      } else {
        questionBtn.disabled = true;
        questionHint.textContent = 'No question review visible';
      }

      // Selection Button
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

      // Check if scan is already active in background
      if (res.scanStatus && (res.scanStatus.status === 'running' || res.scanStatus.status === 'paused')) {
        isScanning = true;
        scanEntireMockBtn.disabled = true;
        const s = res.scanStatus;
        updateScanUi(s.current, s.total, s.section, s.percent, s.status);
      }
    });
  }

  // Handle Full Mock Scan Click
  scanEntireMockBtn.addEventListener('click', () => {
    hideAlert();
    isScanning = true;
    scanEntireMockBtn.disabled = true;
    updateScanUi(0, 130, 'Starting scan...', 0, 'running');

    chrome.runtime.sendMessage({ type: 'SCAN_FULL_MOCK' }, (res) => {
      if (chrome.runtime.lastError || !res || !res.success) {
        hideScanUi();
        showAlert(res?.error || chrome.runtime.lastError?.message || 'Failed to start full mock scan.', false);
      }
    });
  });

  // Handle Pause / Resume Click
  scanPauseResumeBtn.addEventListener('click', () => {
    if (isPaused) {
      chrome.runtime.sendMessage({ type: 'SCAN_RESUME' }, () => {
        isPaused = false;
        pauseResumeIcon.textContent = '⏸';
        pauseResumeLabel.textContent = 'Pause';
        scanPauseResumeBtn.className = 'manga-btn ctrl-btn ctrl-pause';
      });
    } else {
      chrome.runtime.sendMessage({ type: 'SCAN_PAUSE' }, () => {
        isPaused = true;
        pauseResumeIcon.textContent = '▶';
        pauseResumeLabel.textContent = 'Resume';
        scanPauseResumeBtn.className = 'manga-btn ctrl-btn ctrl-resume';
      });
    }
  });

  // Handle Cancel Click
  scanCancelBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'SCAN_CANCEL' }, () => {
      hideScanUi();
      showAlert('Full Mock Scan was cancelled.', false);
    });
  });

  // Listen for real-time progress broadcast messages from background
  chrome.runtime.onMessage.addListener((msg) => {
    if (!msg || typeof msg !== 'object') return;

    if (msg.type === 'SCAN_PROGRESS') {
      updateScanUi(msg.current, msg.total, msg.section, msg.percent, msg.status);
    } else if (msg.type === 'SCAN_COMPLETED') {
      hideScanUi();
      showAlert('✓ Full Mock Scan complete! Delivered to Study App.');
      refreshStatus();
    } else if (msg.type === 'SCAN_CANCELLED') {
      hideScanUi();
      showAlert('Scan cancelled.', false);
      refreshStatus();
    } else if (msg.type === 'SCAN_ERROR') {
      hideScanUi();
      showAlert(msg.error || 'Scanner encountered an error.', false);
      refreshStatus();
    }
  });

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

  summaryBtn.addEventListener('click', () => {
    triggerCapture('summary', summaryBtn, summaryBtn.innerHTML);
  });

  questionBtn.addEventListener('click', () => {
    triggerCapture('question', questionBtn, questionBtn.innerHTML);
  });

  selectionBtn.addEventListener('click', () => {
    triggerCapture('selection', selectionBtn, selectionBtn.innerHTML);
  });

  toggleSettingsBtn.addEventListener('click', () => {
    settingsBox.classList.toggle('hidden');
  });

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

  refreshStatus();
});
