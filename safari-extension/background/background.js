/**
 * StudyBridge Background Service Worker / Script
 * Manages selection extraction, pending transfer queue with TTL,
 * Study App tab discovery, and context-menu integration.
 */

const DEFAULT_APP_URL = 'http://127.0.0.1:5173';
const TRANSFER_TTL_MS = 120_000; // 2 minutes expiration
const MAX_PAYLOAD_SIZE = 500_000; // 500 KB limit

// Temporary in-memory pending transfer queue (id -> { payload, expiresAt })
const pendingTransfers = new Map();

// Deduplication ledger of successfully delivered transfer IDs (id -> timestamp)
const deliveredIds = new Map();

// Active scanner state ledger
let activeScanState = {
  status: 'idle', // 'idle' | 'running' | 'paused' | 'completed' | 'cancelled'
  tabId: null,
  current: 0,
  total: 0,
  section: '',
  percent: 0,
  startedAt: null
};

/**
 * Periodically purge expired transfers and aged deduplication entries.
 */
function cleanupQueues() {
  const now = Date.now();
  for (const [id, entry] of pendingTransfers.entries()) {
    if (entry.expiresAt <= now) {
      pendingTransfers.delete(id);
    }
  }
  for (const [id, deliveredAt] of deliveredIds.entries()) {
    if (now - deliveredAt > 600_000) {
      deliveredIds.delete(id);
    }
  }
}
setInterval(cleanupQueues, 30_000);

/**
 * Retrieves configured Study Application URL.
 */
async function getAppUrl() {
  try {
    const res = await chrome.storage.local.get(['studyAppUrl']);
    return res.studyAppUrl || DEFAULT_APP_URL;
  } catch (e) {
    return DEFAULT_APP_URL;
  }
}

/**
 * Checks whether a given URL is an allowed Testbook or test page.
 */
function isAllowedSourceUrl(url) {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    // Allow Testbook domains and localhost/127.0.0.1 for local test environments
    return (
      host === 'testbook.com' ||
      host.endsWith('.testbook.com') ||
      host === 'localhost' ||
      host === '127.0.0.1'
    );
  } catch (e) {
    return false;
  }
}

/**
 * Helper to get currently active tab in current window.
 */
async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs && tabs.length > 0 ? tabs[0] : null;
}

/**
 * Captures currently selected text from a tab using activeTab / scripting.
 * Strictly captures user-selected text only; never reads full document or sensitive DOM elements.
 */
async function captureSelectionFromTab(tab) {
  if (!tab || !tab.id) {
    throw new Error('No active tab identified.');
  }

  if (!isAllowedSourceUrl(tab.url)) {
    throw new Error('Active page is not a Testbook analysis page.');
  }

  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      const sel = window.getSelection();
      return sel ? sel.toString().trim() : '';
    }
  });

  const selectedText = results && results[0] ? results[0].result : '';
  if (!selectedText) {
    throw new Error('No text selected. Please highlight text on the Testbook page first.');
  }

  if (selectedText.length > MAX_PAYLOAD_SIZE) {
    throw new Error(`Selected text is too large (${selectedText.length} bytes, limit is 500 KB).`);
  }

  return {
    id: `sb-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    text: selectedText,
    source: {
      platform: 'Testbook',
      url: tab.url || '',
      title: tab.title || 'Testbook Analysis'
    },
    capturedAt: new Date().toISOString()
  };
}

/**
 * Finds an open tab for the Study Application.
 */
async function findStudyAppTab() {
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (!tab.url) continue;
    try {
      const u = new URL(tab.url);
      if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') {
        return tab;
      }
    } catch (e) {
      // Ignore invalid URLs
    }
  }
  return null;
}

/**
 * Delivers or queues a transfer payload to the Study Application.
 */
async function deliverPayload(payload) {
  if (deliveredIds.has(payload.id)) {
    return { success: true, message: 'Transfer already processed.', transferId: payload.id };
  }

  const existingTab = await findStudyAppTab();
  if (existingTab && existingTab.id) {
    // Focus existing Study App tab
    try {
      await chrome.tabs.update(existingTab.id, { active: true });
      if (existingTab.windowId) {
        await chrome.windows.update(existingTab.windowId, { focused: true });
      }
    } catch (e) {
      // Non-fatal
    }

    // Send payload to content script bridge
    try {
      await chrome.tabs.sendMessage(existingTab.id, {
        schemaVersion: 1,
        type: 'STUDYBRIDGE_IMPORT',
        payload
      });
      deliveredIds.set(payload.id, Date.now());
      return { success: true, deliveredDirectly: true, transferId: payload.id };
    } catch (sendErr) {
      // Tab might have been in the middle of navigating; queue as fallback
      pendingTransfers.set(payload.id, {
        payload,
        expiresAt: Date.now() + TRANSFER_TTL_MS
      });
      return { success: true, queued: true, transferId: payload.id };
    }
  }

  // Study App is not open: queue payload and open configured URL
  const appUrl = await getAppUrl();
  pendingTransfers.set(payload.id, {
    payload,
    expiresAt: Date.now() + TRANSFER_TTL_MS
  });

  await chrome.tabs.create({ url: appUrl, active: true });
  return { success: true, openedNewTab: true, queued: true, transferId: payload.id };
}

// -----------------------------------------------------------------------------
// Setup Context Menu Action
// -----------------------------------------------------------------------------
function setupContextMenu() {
  if (!chrome.contextMenus) return;
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'studybridge-send-selection',
      title: 'Send selected text to Study App',
      contexts: ['selection']
    });
  });
}

chrome.runtime.onInstalled.addListener(() => {
  setupContextMenu();
});
chrome.runtime.onStartup?.addListener(() => {
  setupContextMenu();
});

if (chrome.contextMenus && chrome.contextMenus.onClicked) {
  chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId !== 'studybridge-send-selection') return;
    if (!tab) return;

    try {
      let selectedText = info.selectionText ? info.selectionText.trim() : '';
      if (!selectedText) {
        const captured = await captureSelectionFromTab(tab);
        selectedText = captured.text;
      }

      if (!selectedText) return;

      const payload = {
        id: `sb-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        text: selectedText,
        source: {
          platform: 'Testbook',
          url: tab.url || '',
          title: tab.title || 'Testbook Analysis'
        },
        capturedAt: new Date().toISOString()
      };

      await deliverPayload(payload);
    } catch {
      // Suppress transfer error in production
    }
  });
}

// Auto-scan on extension icon click (bypasses popup)
const actionApi = (typeof browser !== 'undefined' && browser.action) ? browser.action
  : (typeof chrome !== 'undefined' && chrome.action) ? chrome.action
  : (typeof chrome !== 'undefined' && chrome.browserAction) ? chrome.browserAction
  : null;

if (actionApi && actionApi.onClicked) {
  actionApi.onClicked.addListener(async (tab) => {
    if (!tab || !tab.id) return;
    if (!isAllowedSourceUrl(tab.url)) {
      // Not on Testbook — ignore
      return;
    }

    // Already scanning? don't start again
    if (activeScanState.status === 'running' || activeScanState.status === 'paused') return;

    activeScanState = {
      status: 'running',
      tabId: tab.id,
      current: 0,
      total: 130,
      section: 'Initializing...',
      percent: 0,
      startedAt: Date.now()
    };

    try {
      await requestFromTab(tab.id, 'START_FULL_SCAN');
    } catch (err) {
      activeScanState.status = 'idle';
    }
  });
}

/**
 * Communicates with testbook-adapter content script on active tab,
 * injecting it on-demand if the tab was loaded before extension start.
 */
async function requestFromTab(tabId, messageType) {
  try {
    const res = await chrome.tabs.sendMessage(tabId, { type: messageType });
    if (res) return res;
  } catch (e) {
    // Content script might not be injected yet
  }

  // Fallback: inject content/testbook-adapter.js and content/full-mock-scanner.js on-demand
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['content/testbook-adapter.js', 'content/full-mock-scanner.js']
  });

  return await chrome.tabs.sendMessage(tabId, { type: messageType });
}

// -----------------------------------------------------------------------------
// Extension Message Dispatcher
// -----------------------------------------------------------------------------
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message !== 'object') return false;

  // 1. Content Script ready notification from newly opened Study App tab
  if (message.type === 'STUDYBRIDGE_TAB_READY') {
    cleanupQueues();
    if (pendingTransfers.size > 0 && sender.tab && sender.tab.id) {
      const tabId = sender.tab.id;
      // Deliver the oldest valid pending transfer
      const [id, entry] = Array.from(pendingTransfers.entries())[0];
      chrome.tabs.sendMessage(tabId, {
        schemaVersion: 1,
        type: 'STUDYBRIDGE_IMPORT',
        payload: entry.payload
      }).then(() => {
        pendingTransfers.delete(id);
        deliveredIds.set(id, Date.now());
      }).catch(() => {});
    }
    sendResponse({ ack: true });
    return false;
  }

  // 2. Acknowledgement from Study App
  if (message.type === 'STUDYBRIDGE_IMPORT_ACK') {
    if (message.id) {
      pendingTransfers.delete(message.id);
      deliveredIds.set(message.id, Date.now());
    }
    sendResponse({ ack: true });
    return false;
  }

  // 3. Popup: Get Status
  if (message.type === 'GET_STATUS') {
    (async () => {
      try {
        const tab = await getActiveTab();
        const appTab = await findStudyAppTab();
        const appUrl = await getAppUrl();

        let isTestbook = false;
        let isSummaryVisible = false;
        let isSummaryModalClosed = false;
        let isQuestionVisible = false;
        let questionNumber = null;
        let section = null;
        let selectedChars = 0;
        let pageTitle = '';
        let tabUrl = '';

        if (tab && tab.url) {
          isTestbook = isAllowedSourceUrl(tab.url);
          pageTitle = tab.title || '';
          tabUrl = tab.url;

          if (isTestbook && tab.id) {
            try {
              const res = await requestFromTab(tab.id, 'TESTBOOK_INSPECT');
              if (res && res.success) {
                isSummaryVisible = Boolean(res.isSummaryVisible);
                isSummaryModalClosed = Boolean(res.isSummaryModalClosed);
                isQuestionVisible = Boolean(res.isQuestionVisible);
                questionNumber = res.questionNumber || null;
                section = res.section || null;
                selectedChars = res.selectedChars || 0;
              }
            } catch (e) {
              // Permission or script injection limitation
            }
          }
        }

        sendResponse({
          success: true,
          isTestbook,
          isSummaryVisible,
          isSummaryModalClosed,
          isQuestionVisible,
          questionNumber,
          section,
          selectedChars,
          pageTitle,
          tabUrl,
          isAppConnected: Boolean(appTab),
          appUrl,
          pendingCount: pendingTransfers.size,
          scanStatus: activeScanState
        });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true; // Keep channel open for async response
  }

  // 4. Popup: Capture Mode (summary, question, or selection)
  if (message.type === 'CAPTURE_MODE' || message.type === 'CAPTURE_AND_SEND') {
    (async () => {
      try {
        const tab = await getActiveTab();
        if (!tab || !tab.id) throw new Error('No active tab detected.');
        if (!isAllowedSourceUrl(tab.url)) {
          throw new Error('Active page is not a Testbook analysis page.');
        }

        const mode = message.mode || (message.type === 'CAPTURE_AND_SEND' ? 'selection' : 'summary');
        let payload = null;

        if (mode === 'summary') {
          const res = await requestFromTab(tab.id, 'EXTRACT_SUMMARY');
          if (!res || !res.success) {
            throw new Error(res?.error || 'Failed to extract visible summary.');
          }
          const s = res.summary;
          const textSummary = `Testbook Result Summary: ${s.mockName || 'Mock Test'}\nTotal Marks: ${s.overallMarks}\nSections:\n${s.sections.map((sec) => `${sec.sectionName}: Qs ${sec.questionCount}, Correct ${sec.correctCount}, Incorrect ${sec.incorrectCount}, Skipped ${sec.skippedCount}, Marks ${sec.marks}`).join('\n')}`;

          payload = {
            id: `sb-sum-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            mode: 'summary',
            text: textSummary,
            summaryData: s,
            source: {
              platform: 'Testbook',
              url: tab.url || '',
              title: tab.title || s.mockName || 'Testbook Result Summary'
            },
            capturedAt: new Date().toISOString()
          };
        } else if (mode === 'question') {
          const res = await requestFromTab(tab.id, 'EXTRACT_QUESTION');
          if (!res || !res.success) {
            throw new Error(res?.error || 'Failed to extract current question.');
          }
          const q = res.question;
          const textQuestion = `Question ${q.questionNumber} (${q.section})\n${q.questionText}\n\nCorrect Answer: ${q.correctAnswer || 'N/A'}\nYour Answer: ${q.selectedAnswer || 'N/A'}${q.explanation ? '\n\nExplanation:\n' + q.explanation : ''}`;

          payload = {
            id: `sb-q-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            mode: 'question',
            text: textQuestion,
            questionData: q,
            source: {
              platform: 'Testbook',
              url: tab.url || '',
              title: tab.title || `Question ${q.questionNumber} Review`
            },
            capturedAt: new Date().toISOString()
          };
        } else {
          // Mode C: Selection
          const captured = await captureSelectionFromTab(tab);
          payload = {
            ...captured,
            mode: 'selection'
          };
        }

        const result = await deliverPayload(payload);
        sendResponse({
          success: true,
          mode,
          ...result,
          charCount: payload.text.length
        });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }

  // 5. Full Mock Scanner Commands
  if (message.type === 'SCAN_FULL_MOCK') {
    (async () => {
      try {
        const tab = await getActiveTab();
        if (!tab || !tab.id) throw new Error('No active tab detected.');
        if (!isAllowedSourceUrl(tab.url)) {
          throw new Error('Active page is not a Testbook analysis page.');
        }

        activeScanState = {
          status: 'running',
          tabId: tab.id,
          current: 0,
          total: 130,
          section: 'Initializing...',
          percent: 0,
          startedAt: Date.now()
        };

        const res = await requestFromTab(tab.id, 'START_FULL_SCAN');
        sendResponse({ success: true, ...res });
      } catch (err) {
        activeScanState.status = 'idle';
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }

  if (message.type === 'SCAN_PAUSE') {
    (async () => {
      try {
        if (activeScanState.tabId) {
          activeScanState.status = 'paused';
          await chrome.tabs.sendMessage(activeScanState.tabId, { type: 'SCAN_PAUSE' });
        }
        sendResponse({ success: true, status: 'paused' });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }

  if (message.type === 'SCAN_RESUME') {
    (async () => {
      try {
        if (activeScanState.tabId) {
          activeScanState.status = 'running';
          await chrome.tabs.sendMessage(activeScanState.tabId, { type: 'SCAN_RESUME' });
        }
        sendResponse({ success: true, status: 'running' });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }

  if (message.type === 'SCAN_CANCEL') {
    (async () => {
      try {
        if (activeScanState.tabId) {
          activeScanState.status = 'cancelled';
          await chrome.tabs.sendMessage(activeScanState.tabId, { type: 'SCAN_CANCEL' });
        }
        activeScanState.status = 'idle';
        sendResponse({ success: true, status: 'cancelled' });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }

  // 6. Broadcast progress and completion events from content script to popup and app
  if (message.type === 'SCAN_PROGRESS') {
    activeScanState.current = message.current || activeScanState.current;
    activeScanState.total = message.total || activeScanState.total;
    activeScanState.section = message.section || activeScanState.section;
    activeScanState.percent = message.percent || activeScanState.percent;
    activeScanState.status = message.status || activeScanState.status;

    // Relay to popup if open
    chrome.runtime.sendMessage(message).catch(() => {});
    sendResponse({ ack: true });
    return false;
  }

  if (message.type === 'SCAN_COMPLETED') {
    activeScanState.status = 'completed';
    (async () => {
      try {
        const scanResult = message.result;
        const tab = await getActiveTab();

        const payload = {
          id: `sb-mock-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          mode: 'fullscan',
          text: `StudyBridge Full Mock Scan: ${scanResult?.mockName || 'Testbook Mock Test'}\nQuestions: ${scanResult?.totalQuestions || 0}\nScore: ${scanResult?.overallScore || 0}`,
          source: {
            platform: 'Testbook',
            url: tab?.url || '',
            title: tab?.title || scanResult?.mockName || 'Testbook Full Mock'
          },
          capturedAt: new Date().toISOString(),
          scanData: scanResult
        };

        await deliverPayload(payload);
        activeScanState.status = 'idle';
        chrome.runtime.sendMessage({ type: 'SCAN_COMPLETED', result: scanResult }).catch(() => {});
      } catch {
        // Delivery failed
      }
    })();
    sendResponse({ ack: true });
    return false;
  }

  if (message.type === 'SCAN_CANCELLED' || message.type === 'SCAN_ERROR') {
    activeScanState.status = 'idle';
    chrome.runtime.sendMessage(message).catch(() => {});
    sendResponse({ ack: true });
    return false;
  }

  // 7. Settings: Update App URL
  if (message.type === 'SET_CONFIG') {
    (async () => {
      try {
        if (message.appUrl && typeof message.appUrl === 'string') {
          await chrome.storage.local.set({ studyAppUrl: message.appUrl.trim() });
          sendResponse({ success: true });
        } else {
          sendResponse({ success: false, error: 'Invalid URL' });
        }
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }

  return false;
});

