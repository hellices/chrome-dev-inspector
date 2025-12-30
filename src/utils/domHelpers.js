/**
 * DOM manipulation helper functions
 */

/**
 * Get XPath for an element
 * @param {HTMLElement} element - The element to get XPath for
 * @returns {string|null} XPath string or null
 */
export function getXPath(element) {
  if (element.id) {
    return `//*[@id="${element.id}"]`;
  }

  const parts = [];
  while (element && element.nodeType === Node.ELEMENT_NODE) {
    let index = 0;
    let sibling = element.previousSibling;
    while (sibling) {
      if (sibling.nodeType === Node.ELEMENT_NODE && sibling.nodeName === element.nodeName) {
        index++;
      }
      sibling = sibling.previousSibling;
    }

    const tagName = element.nodeName.toLowerCase();
    const pathIndex = index ? `[${index + 1}]` : '';
    parts.unshift(tagName + pathIndex);

    element = element.parentNode;
  }

  return parts.length ? '/' + parts.join('/') : null;
}

/**
 * Escape HTML special characters
 * @param {string} text - Text to escape
 * @returns {string} Escaped HTML
 */
export function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Inject a script into the page
 * @param {string} scriptUrl - URL of the script to inject
 */
export function injectScript(scriptUrl) {
  const script = document.createElement('script');
  script.src = scriptUrl;
  script.onload = function () {
    this.remove();
  };
  (document.head || document.documentElement).appendChild(script);
}

/**
 * Find element by XPath
 * @param {string} xpath - XPath string
 * @returns {HTMLElement|null} Found element or null
 */
export function findElementByXPath(xpath) {
  try {
    if (xpath) {
      return document.evaluate(
        xpath,
        document,
        null,
        XPathResult.FIRST_ORDERED_NODE_TYPE,
        null
      ).singleNodeValue;
    }
  } catch (e) {
    console.error('Error resolving element:', e);
  }
  return null;
}
