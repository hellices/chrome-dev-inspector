/**
 * Content script for HoverComp Dev Inspector
 * Handles hover events, overlay rendering, and communication with inpage script
 */

(function () {
  'use strict';

  // State
  let isEnabled = true;
  let overlay = null;
  let currentTarget = null;
  let lastHoverTime = 0;
  const THROTTLE_MS = 50;

  // Inject inpage script
  function injectInPageScript() {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('src/inpage.js');
    script.onload = function () {
      this.remove();
    };
    (document.head || document.documentElement).appendChild(script);
  }

  // Create overlay element
  function createOverlay() {
    const div = document.createElement('div');
    div.id = 'hovercomp-overlay';
    div.className = 'hovercomp-overlay';
    div.style.cssText = `
      position: fixed;
      z-index: 2147483647;
      pointer-events: none;
      display: none;
      background: rgba(0, 123, 255, 0.1);
      border: 2px solid rgba(0, 123, 255, 0.8);
      box-sizing: border-box;
    `;

    const label = document.createElement('div');
    label.className = 'hovercomp-label';
    label.style.cssText = `
      position: absolute;
      top: -1px;
      left: -1px;
      transform: translateY(-100%);
      background: rgba(0, 123, 255, 0.95);
      color: white;
      padding: 4px 8px;
      font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
      font-size: 12px;
      line-height: 1.4;
      border-radius: 3px 3px 0 0;
      white-space: nowrap;
      max-width: 400px;
      overflow: hidden;
      text-overflow: ellipsis;
    `;

    div.appendChild(label);
    document.body.appendChild(div);
    return div;
  }

  // Get XPath for an element
  function getXPath(element) {
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

  // Update overlay position and content
  function updateOverlay(element, componentInfo) {
    if (!overlay) {
      overlay = createOverlay();
    }

    if (!componentInfo) {
      overlay.style.display = 'none';
      return;
    }

    const rect = element.getBoundingClientRect();
    overlay.style.display = 'block';
    overlay.style.top = `${rect.top}px`;
    overlay.style.left = `${rect.left}px`;
    overlay.style.width = `${rect.width}px`;
    overlay.style.height = `${rect.height}px`;

    const label = overlay.querySelector('.hovercomp-label');
    const detailText = componentInfo.detail ? ` (${componentInfo.detail})` : '';
    label.textContent = `${componentInfo.framework}: ${componentInfo.name}${detailText}`;
  }

  // Hide overlay
  function hideOverlay() {
    if (overlay) {
      overlay.style.display = 'none';
    }
    currentTarget = null;
  }

  // Handle hover events (throttled)
  function handleMouseMove(event) {
    if (!isEnabled) return;

    const now = Date.now();
    if (now - lastHoverTime < THROTTLE_MS) return;
    lastHoverTime = now;

    const target = event.target;
    if (!target || target === overlay || overlay?.contains(target)) {
      return;
    }

    if (currentTarget === target) {
      return;
    }

    currentTarget = target;
    const xpath = getXPath(target);

    // Request component info from inpage script
    window.postMessage(
      {
        type: 'GET_COMPONENT_INFO',
        targetPath: xpath,
      },
      '*'
    );
  }

  // Handle component info response
  function handleComponentInfoResponse(event) {
    if (event.source !== window) return;
    if (event.data.type !== 'COMPONENT_INFO_RESPONSE') return;

    const { componentInfo } = event.data;

    if (currentTarget && isEnabled) {
      updateOverlay(currentTarget, componentInfo);
    }
  }

  // Toggle extension on/off
  function toggleEnabled() {
    isEnabled = !isEnabled;
    if (!isEnabled) {
      hideOverlay();
    }
    console.log(`[HoverComp Dev Inspector] ${isEnabled ? 'Enabled' : 'Disabled'}`);
  }

  // Keyboard shortcut handler (Alt+Shift+C)
  function handleKeyDown(event) {
    if (event.altKey && event.shiftKey && event.code === 'KeyC') {
      event.preventDefault();
      toggleEnabled();
    }
  }

  // Initialize
  function init() {
    // Inject inpage script
    injectInPageScript();

    // Set up event listeners
    document.addEventListener('mousemove', handleMouseMove, true);
    document.addEventListener('mouseout', (event) => {
      if (!event.relatedTarget || event.relatedTarget === document.documentElement) {
        hideOverlay();
      }
    });
    window.addEventListener('message', handleComponentInfoResponse);
    document.addEventListener('keydown', handleKeyDown, true);

    console.log('[HoverComp Dev Inspector] Content script loaded');
  }

  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Export for testing
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      getXPath,
      updateOverlay,
      hideOverlay,
      toggleEnabled,
      handleMouseMove,
    };
  }
})();
