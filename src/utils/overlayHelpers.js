/**
 * Overlay helper utilities
 */

/**
 * Get framework note HTML for non-framework elements
 * @param {Array<string>} detectedFrameworks - List of detected frameworks
 * @returns {string} Framework note HTML
 */
export function getFrameworkNote(detectedFrameworks) {
  if (detectedFrameworks.includes('react')) {
    return `<div style="background: rgba(97, 218, 251, 0.1); padding: 8px; margin-bottom: 12px; border-radius: 6px; border-left: 3px solid #61dafb;">
        <div style="color: #61dafb; font-weight: bold; margin-bottom: 4px;">⚛️ React Detected on Page</div>
        <div style="color: #ccc; font-size: 10px;">This element is not a React component. Showing HTML info.</div>
      </div>`;
  } else if (detectedFrameworks.includes('vue3') || detectedFrameworks.includes('vue2')) {
    return `<div style="background: rgba(66, 184, 131, 0.1); padding: 8px; margin-bottom: 12px; border-radius: 6px; border-left: 3px solid #42b883;">
        <div style="color: #42b883; font-weight: bold; margin-bottom: 4px;">💚 Vue Detected on Page</div>
        <div style="color: #ccc; font-size: 10px;">This element is not a Vue component. Showing HTML info.</div>
      </div>`;
  } else if (detectedFrameworks.includes('svelte')) {
    return `<div style="background: rgba(255, 62, 0, 0.1); padding: 8px; margin-bottom: 12px; border-radius: 6px; border-left: 3px solid #ff3e00;">
        <div style="color: #ff3e00; font-weight: bold; margin-bottom: 4px;">🔥 Svelte Detected on Page</div>
        <div style="color: #ccc; font-size: 10px;">Production build or plain HTML element. Showing HTML info.</div>
      </div>`;
  }
  return '';
}

/**
 * Show framework-specific overlay
 * @param {string} framework - Framework name
 * @param {string} reactComponentXPath - XPath for React component
 * @param {HTMLElement} element - Target element
 * @param {Object} overlays - Object containing overlay elements
 */
export function showFrameworkOverlay(framework, reactComponentXPath, element, overlays) {
  const { reactOverlay, vueOverlay, showReactOverlay, showComponentOverlay, hideReactOverlay, hideVueOverlay } = overlays;

  if (framework === 'react' && reactComponentXPath) {
    try {
      const reactElement = document.evaluate(
        reactComponentXPath,
        document,
        null,
        XPathResult.FIRST_ORDERED_NODE_TYPE,
        null
      ).singleNodeValue;

      if (reactElement && reactElement !== element) {
        showReactOverlay(reactOverlay, reactElement);
      } else {
        hideReactOverlay(reactOverlay);
      }
    } catch (e) {
      console.error('[HoverComp] Error showing React overlay:', e);
      hideReactOverlay(reactOverlay);
    }
    hideVueOverlay(vueOverlay);
  } else if (framework === 'vue 2' || framework === 'vue 3') {
    showComponentOverlay(vueOverlay, element);
    hideReactOverlay(reactOverlay);
  } else if (framework === 'svelte') {
    showComponentOverlay(vueOverlay, element);
    hideReactOverlay(reactOverlay);
  } else {
    hideReactOverlay(reactOverlay);
    hideVueOverlay(vueOverlay);
  }
}

/**
 * Update React overlay position on scroll
 * @param {HTMLElement} panel - Panel element
 * @param {HTMLElement} reactOverlay - React overlay element
 * @param {Function} showReactOverlay - Function to show React overlay
 */
export function updateReactOverlayPosition(panel, reactOverlay, showReactOverlay) {
  if (reactOverlay?.style.display !== 'none') {
    const reactXPath = panel?.dataset?.reactComponentXPath;
    if (reactXPath) {
      try {
        const reactElement = document.evaluate(
          reactXPath,
          document,
          null,
          XPathResult.FIRST_ORDERED_NODE_TYPE,
          null
        ).singleNodeValue;
        if (reactElement) {
          showReactOverlay(reactOverlay, reactElement);
        }
      } catch (e) {
        // Ignore
      }
    }
  }
}
