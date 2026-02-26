/**
 * Content script loader - checks with background before loading inspector
 * Listens for toggle messages from background service worker
 */
(async function () {
  let loaded = false;

  async function loadInspector() {
    if (loaded) return;
    try {
      const moduleUrl = chrome.runtime.getURL('src/content.js');
      await import(moduleUrl);
      loaded = true;
    } catch (error) {
      // Silent fail
    }
  }

  function disableInspector() {
    if (!loaded) return;
    // Dispatch a custom event that content.js listens to
    window.dispatchEvent(new CustomEvent('inspector-disable'));
  }

  function enableInspector() {
    if (!loaded) {
      loadInspector();
      return;
    }
    window.dispatchEvent(new CustomEvent('inspector-enable'));
  }

  // Listen for toggle from background
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'INSPECTOR_TOGGLE') {
      if (message.enabled) {
        enableInspector();
      } else {
        disableInspector();
      }
    }
  });

  // Check initial state
  try {
    const response = await chrome.runtime.sendMessage({ type: 'INSPECTOR_CHECK' });
    if (response?.enabled) {
      loadInspector();
    }
  } catch {
    // Extension context may not be ready
  }
})();
