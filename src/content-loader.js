/**
 * Content script loader - dynamically imports the main module
 */
(async function () {
  try {
    const moduleUrl = chrome.runtime.getURL('src/content.js');
    await import(moduleUrl);
  } catch (error) {
    // Silent fail - module loading errors are typically permission issues
  }
})();
