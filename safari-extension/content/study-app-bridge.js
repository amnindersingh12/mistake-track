/**
 * StudyBridge Content Script Bridge
 * Injected on the local Study Application page (localhost / 127.0.0.1).
 * Relays transfer payloads from the extension to the web application via window.postMessage.
 */

(() => {
  // Only run in top window
  if (window.top !== window) return;

  const BRIDGE_SOURCE = 'STUDYBRIDGE_EXTENSION_CONTENT_SCRIPT';
  const api = typeof chrome !== 'undefined' && chrome.runtime ? chrome : typeof browser !== 'undefined' && browser.runtime ? browser : null;

  // 1. Announce readiness to the extension background script
  if (api && api.runtime && typeof api.runtime.sendMessage === 'function') {
    try {
      api.runtime.sendMessage({
        type: 'STUDYBRIDGE_TAB_READY',
        url: window.location.href,
        origin: window.location.origin
      }).catch(() => {
        // Ignore background sleep
      });
    } catch (e) {
      // Background might not be listening yet
    }
  }

  // 2. Listen for messages from the extension background script
  if (api && api.runtime && api.runtime.onMessage && typeof api.runtime.onMessage.addListener === 'function') {
    api.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (!message || typeof message !== 'object') return false;

      if (message.type === 'STUDYBRIDGE_PING') {
        sendResponse({ status: 'ready', origin: window.location.origin, version: 1 });
        return false;
      }

      if (message.type === 'STUDYBRIDGE_IMPORT') {
        const payload = message.payload;
        if (!payload || !payload.id) {
          sendResponse({ success: false, error: 'Malformed import payload' });
          return false;
        }

        // Relay payload safely into web application context
        window.postMessage(
          {
            schemaVersion: 1,
            type: 'STUDYBRIDGE_IMPORT',
            source: BRIDGE_SOURCE,
            payload
          },
          window.location.origin
        );

        sendResponse({ success: true, forwardedToPage: true, transferId: payload.id });
        return false;
      }

      return false;
    });
  }

  // 3. Listen for acknowledgements from the Study Application
  window.addEventListener('message', (event) => {
    // Security check: ensure origin matches current origin
    if (event.origin !== window.location.origin) return;

    const data = event.data;
    if (!data || typeof data !== 'object') return;

    if (data.type === 'STUDYBRIDGE_IMPORT_ACK' && api && api.runtime && typeof api.runtime.sendMessage === 'function') {
      try {
        api.runtime.sendMessage({
          type: 'STUDYBRIDGE_IMPORT_ACK',
          id: data.id,
          status: data.status,
          error: data.error
        }).catch(() => {});
      } catch (e) {
        // Safe catch
      }
    }
  });
})();
