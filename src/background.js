/**
 * Background service worker - per-tab toggle management
 * No persistence, no storage. Tabs start disabled by default.
 */

const enabledTabs = new Set();

// Toggle on icon click
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;

  if (enabledTabs.has(tab.id)) {
    enabledTabs.delete(tab.id);
    chrome.action.setBadgeText({ tabId: tab.id, text: '' });
    // Tell content script to disable
    chrome.tabs.sendMessage(tab.id, { type: 'INSPECTOR_TOGGLE', enabled: false }).catch(() => {});
  } else {
    enabledTabs.add(tab.id);
    chrome.action.setBadgeText({ tabId: tab.id, text: 'ON' });
    chrome.action.setBadgeBackgroundColor({ tabId: tab.id, color: '#4CAF50' });
    // Tell content script to enable
    chrome.tabs.sendMessage(tab.id, { type: 'INSPECTOR_TOGGLE', enabled: true }).catch(() => {});
  }
});

// Clean up when tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  enabledTabs.delete(tabId);
});

// Clean up when tab navigates to new page
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'loading') {
    enabledTabs.delete(tabId);
    chrome.action.setBadgeText({ tabId, text: '' });
  }
});

// Respond to content script asking if it should be enabled
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'INSPECTOR_CHECK' && sender.tab?.id) {
    sendResponse({ enabled: enabledTabs.has(sender.tab.id) });
  }
});
