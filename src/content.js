/**
 * Content script for HoverComp Dev Inspector - Refactored and Modularized
 * Main entry point that coordinates modules
 */

import { injectScript } from './utils/domHelpers.js';
import { createContentMessageHandler, requestComponentInfo } from './utils/messageHandler.js';
import { hideOverlay, hideReactOverlay, hideVueOverlay } from './overlay/overlayManager.js';
import { state, resetOverlayState, toggleEnabled } from './content/state.js';
import {
  updateDetectedFrameworksState,
} from './content/modeSelector.js';
import { monitorUrlChanges } from './content/urlMonitor.js';
import { showWelcomeTipIfFirstTime } from './content/welcomeTip.js';
import { updateOverlay, updateOverlayOnScroll } from './content/overlayController.js';
import {
  handleMouseMove,
  handleClick,
  handleMouseOut,
  handleScroll,
  handleKeyDown,
  handleBeforeUnload,
} from './content/contentEventHandlers.js';

// ============================================================================
// Helper Functions
// ============================================================================

const hideOverlayFns = { hideOverlay, hideReactOverlay, hideVueOverlay };

function injectInPageScript() {
  const scriptUrl = chrome.runtime.getURL('src/inpage.js');
  injectScript(scriptUrl);
}

/**
 * Wrapper for updateOverlay that passes state
 */
function updateOverlayWrapper(element, componentInfo, mouseX, mouseY, reactComponentXPath) {
  updateOverlay(element, componentInfo, mouseX, mouseY, reactComponentXPath, state, requestComponentInfo);
}

// ============================================================================
// Message Handler & Initialization
// ============================================================================

const messageHandler = createContentMessageHandler(updateOverlayWrapper, () => state.currentTarget);

function init() {
  injectInPageScript();
  monitorUrlChanges(state, resetOverlayState, hideOverlay, hideReactOverlay, hideVueOverlay);

  // Show welcome tip for first-time users
  showWelcomeTipIfFirstTime();

  // Detect frameworks on page - multiple attempts for SPAs
  setTimeout(() => {
    updateDetectedFrameworksState(state);
  }, 1000);
  
  setTimeout(() => {
    updateDetectedFrameworksState(state);
  }, 3000);
  
  // Re-detect on DOM changes (for SPAs)
  const observer = new MutationObserver(() => {
    updateDetectedFrameworksState(state);
  });
  
  // Start observing after initial load
  setTimeout(() => {
    observer.observe(document.body, { 
      childList: true, 
      subtree: true 
    });
    
    // Stop observing after 60 seconds to avoid performance issues while still supporting SPAs
    setTimeout(() => observer.disconnect(), 60000);
  }, 500);

  // Setup event listeners with proper bindings
  document.addEventListener('mousemove', (e) => handleMouseMove(e, state, hideOverlayFns), true);
  document.addEventListener('click', (e) => handleClick(e, state), true);
  document.addEventListener('mouseout', (e) => handleMouseOut(e, state, hideOverlayFns));
  document.addEventListener('keydown', (e) => handleKeyDown(e, state, toggleEnabled, hideOverlayFns), true);
  document.addEventListener('scroll', () => handleScroll(state, resetOverlayState, updateOverlayOnScroll, hideOverlayFns), true);
  window.addEventListener('scroll', () => handleScroll(state, resetOverlayState, updateOverlayOnScroll, hideOverlayFns), true);
  window.addEventListener('message', messageHandler);
  window.addEventListener('beforeunload', () => handleBeforeUnload(resetOverlayState, hideOverlayFns));

  console.log('[HoverComp Dev Inspector] Content script loaded');
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Export for testing
export { updateOverlayWrapper as updateOverlay, toggleEnabled, handleMouseMove };

