/**
 * Content script loader - dynamically imports the main module
 */
(async function() {
  try {
    const moduleUrl = chrome.runtime.getURL('src/content.js');
    await import(moduleUrl);
  } catch (error) {
    console.error('[HoverComp] Failed to load content module:', error);
  }
})();
