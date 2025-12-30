/**
 * Content script for HoverComp Dev Inspector - Refactored
 * Handles hover events, overlay rendering, and communication with inpage script
 */

import { THROTTLE_MS, TOGGLE_SHORTCUT, DEFAULT_EXPANDED_SECTIONS } from './config/constants.js';
import { getXPath, injectScript, escapeHtml } from './utils/domHelpers.js';
import { createContentMessageHandler, requestComponentInfo, invalidateCache } from './utils/messageHandler.js';
import { calculatePanelPosition, adjustPanelPosition, applyPanelPosition } from './utils/panelPosition.js';
import { formatComponentInfo } from './utils/formatters.js';
import { getCSSInfo } from './utils/cssHelper.js';
import { 
  createOverlay, 
  showOverlay, 
  hideOverlay, 
  getPanel, 
  updatePanelContent,
  createReactOverlay,
  showReactOverlay,
  hideReactOverlay
} from './overlay/overlayManager.js';
import {
  setupEditableHookHandlers,
  setupEditableStateHandlers,
  setupClassToggleHandlers,
  setupStyleToggleHandlers,
  setupComputedStyleHandlers,
  setupToggleSectionHandlers,
  restoreExpandedSections
} from './overlay/eventHandlers.js';
import {
  setupAddClassHandlers,
  setupAddStyleHandlers
} from './overlay/advancedHandlers.js';

// ============================================================================
// State Management
// ============================================================================

const state = {
  isEnabled: true,
  overlay: null,
  reactOverlay: null,
  currentTarget: null,
  lastHoverTime: 0,
  isPinned: false,
  pinnedPosition: null,
  expandedSections: { ...DEFAULT_EXPANDED_SECTIONS },
  currentUrl: window.location.href
};

// ============================================================================
// Initialization
// ============================================================================
  
  function injectInPageScript() {
    const scriptUrl = chrome.runtime.getURL('src/inpage.js');
    injectScript(scriptUrl);
  }

  // ============================================================================
  // Overlay Management
  // ============================================================================
  
  function updateOverlay(element, componentInfo, mouseX, mouseY, reactComponentXPath) {
    if (!state.overlay) {
      state.overlay = createOverlay();
    }
    if (!state.reactOverlay) {
      state.reactOverlay = createReactOverlay();
    }

    if (!componentInfo) {
      if (!state.isPinned) {
        hideOverlay(state.overlay);
        hideReactOverlay(state.reactOverlay);
      }
      return;
    }

    // Add CSS info to component info
    if (element instanceof HTMLElement) {
      componentInfo.css = getCSSInfo(element);
    }

    // Show DOM overlay for the hovered element
    showOverlay(state.overlay, element);
    
    // Show React component overlay if available
    if (reactComponentXPath) {
      try {
        const reactElement = document.evaluate(
          reactComponentXPath,
          document,
          null,
          XPathResult.FIRST_ORDERED_NODE_TYPE,
          null
        ).singleNodeValue;
        
        if (reactElement && reactElement !== element) {
          showReactOverlay(state.reactOverlay, reactElement);
        } else {
          hideReactOverlay(state.reactOverlay);
        }
      } catch (e) {
        console.error('[HoverComp] Error showing React overlay:', e);
        hideReactOverlay(state.reactOverlay);
      }
    } else {
      hideReactOverlay(state.reactOverlay);
    }
    
    const panel = getPanel(state.overlay);
    if (!panel) return;
    
    // Store reactComponentXPath in panel for scroll updates
    if (reactComponentXPath) {
      panel.dataset.reactComponentXPath = reactComponentXPath;
    } else {
      delete panel.dataset.reactComponentXPath;
    }

    // Position panel
    if (state.isPinned && state.pinnedPosition) {
      applyPanelPosition(panel, state.pinnedPosition, true);
    } else if (mouseX && mouseY) {
      const panelRect = panel.getBoundingClientRect();
      const position = calculatePanelPosition(mouseX, mouseY, panelRect);
      applyPanelPosition(panel, position, false);
      setTimeout(() => adjustPanelPosition(panel), 50);
    }

    // Update content
    const html = formatComponentInfo(componentInfo, state.isPinned);
    updatePanelContent(panel, html);

    // Setup event handlers
    setupAllEventHandlers(panel, element);

    // Restore expanded sections
    restoreExpandedSections(panel, state.expandedSections);

    // Adjust position after content is rendered
    setTimeout(() => adjustPanelPosition(panel), 100);
  }

  function setupAllEventHandlers(panel, element) {
    const refreshOverlay = (el) => {
      invalidateCache(el);
      setTimeout(() => requestComponentInfo(el), 10);
    };

    setupEditableHookHandlers(panel, element);
    setupEditableStateHandlers(panel, element);
    setupClassToggleHandlers(panel, element, refreshOverlay);
    setupStyleToggleHandlers(panel, element, refreshOverlay);
    setupComputedStyleHandlers(panel, element);
    setupAddClassHandlers(panel, element, refreshOverlay);
    setupAddStyleHandlers(panel, element, refreshOverlay);
    setupToggleSectionHandlers(panel, state.expandedSections, () => {
      adjustPanelPosition(panel);
      if (state.isPinned && panel) {
        state.pinnedPosition = {
          x: parseInt(panel.style.left),
          y: parseInt(panel.style.top)
        };
      }
    });
  }

  // ============================================================================
  // Event Handlers
  // ============================================================================
  
  function handleMouseMove(event) {
    if (!state.isEnabled || state.isPinned) return;

    const mouseX = event.clientX;
    const mouseY = event.clientY;
    const target = event.target;

    if (!target || target === state.overlay || state.overlay?.contains(target)) {
      return;
    }

    // Update panel position even if same target (follow mouse)
    if (state.currentTarget && state.overlay?.style.display !== 'none') {
      const panel = getPanel(state.overlay);
      if (panel) {
        const panelRect = panel.getBoundingClientRect();
        const position = calculatePanelPosition(mouseX, mouseY, panelRect);
        applyPanelPosition(panel, position, false);
      }
    }

    // Throttle component info requests
    const now = Date.now();
    if (now - state.lastHoverTime < THROTTLE_MS) return;
    state.lastHoverTime = now;

    if (state.currentTarget === target) return;

    state.currentTarget = target;
    
    // Store mouse position for overlay positioning
    state.currentTarget._mouseX = mouseX;
    state.currentTarget._mouseY = mouseY;

    requestComponentInfo(target);
  }

  function handleClick(event) {
    if (!state.isEnabled || !event.altKey) return;
    
    event.preventDefault();
    event.stopPropagation();
    
    if (state.isPinned) {
      // Unpin
      state.isPinned = false;
      state.pinnedPosition = null;
      console.log('[HoverComp] Unpinned');
    } else {
      // Pin at current position
      if (state.overlay?.style.display !== 'none') {
        const panel = getPanel(state.overlay);
        if (panel) {
          state.isPinned = true;
          state.pinnedPosition = {
            x: parseInt(panel.style.left),
            y: parseInt(panel.style.top)
          };
          console.log('[HoverComp] Pinned at', state.pinnedPosition);
        }
      }
    }
    
    // Refresh overlay to show pinned state
    if (state.currentTarget) {
      requestComponentInfo(state.currentTarget);
    }
  }

  function handleMouseOut(event) {
    if (state.isPinned) return;
    if (!event.relatedTarget || event.relatedTarget === document.documentElement) {
      hideOverlay(state.overlay);
      hideReactOverlay(state.reactOverlay);
    }
  }

  function handleScroll() {
    // Check if current target still exists in DOM
    if (state.currentTarget && !document.body.contains(state.currentTarget)) {
      resetOverlayState();
      return;
    }
    
    // Update overlay positions on scroll
    if (state.currentTarget && state.overlay?.style.display !== 'none') {
      const element = state.currentTarget;
      showOverlay(state.overlay, element);
      
      // Also update React overlay if it's visible
      if (state.reactOverlay?.style.display !== 'none') {
        const panel = getPanel(state.overlay);
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
              showReactOverlay(state.reactOverlay, reactElement);
            }
          } catch (e) {
            // Ignore
          }
        }
      }
    }
  }

  function resetOverlayState() {
    console.log('[HoverComp] Resetting overlay state - isPinned was:', state.isPinned);
    state.isPinned = false;
    state.pinnedPosition = null;
    state.currentTarget = null;
    hideOverlay(state.overlay);
    hideReactOverlay(state.reactOverlay);
    console.log('[HoverComp] Reset complete - isPinned now:', state.isPinned);
  }

  function handleUrlChange() {
    const newUrl = window.location.href;
    if (newUrl !== state.currentUrl) {
      console.log('[HoverComp] URL changed from', state.currentUrl, 'to', newUrl);
      console.log('[HoverComp] Pinned state:', state.isPinned);
      state.currentUrl = newUrl;
      if (state.isPinned) {
        console.log('[HoverComp] Unpinning and resetting overlay');
        resetOverlayState();
      } else {
        console.log('[HoverComp] Hiding overlay (not pinned)');
        // For non-pinned state, just hide the overlay
        hideOverlay(state.overlay);
        hideReactOverlay(state.reactOverlay);
        state.currentTarget = null;
      }
    }
  }

  function monitorUrlChanges() {
    // Monitor pushState and replaceState
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;
    
    history.pushState = function(...args) {
      const result = originalPushState.apply(this, args);
      setTimeout(() => handleUrlChange(), 0);
      return result;
    };
    
    history.replaceState = function(...args) {
      const result = originalReplaceState.apply(this, args);
      setTimeout(() => handleUrlChange(), 0);
      return result;
    };
    
    // Monitor popstate (back/forward buttons)
    window.addEventListener('popstate', () => {
      setTimeout(() => handleUrlChange(), 0);
    });
    
    // Monitor hash changes
    window.addEventListener('hashchange', () => {
      setTimeout(() => handleUrlChange(), 0);
    });
    
    // Periodic check for URL changes (fallback for edge cases)
    setInterval(() => {
      handleUrlChange();
    }, 500);
    
    // Monitor DOM mutations that might indicate navigation
    const observer = new MutationObserver(() => {
      handleUrlChange();
    });
    
    // Observe title changes (common during navigation)
    const titleElement = document.querySelector('title');
    if (titleElement) {
      observer.observe(titleElement, { childList: true, characterData: true, subtree: true });
    }
  }

  function handleBeforeUnload() {
    // Reset pinned state on page navigation
    resetOverlayState();
  }

  function handleKeyDown(event) {
    const { altKey, shiftKey, code } = TOGGLE_SHORTCUT;
    if (event.altKey === altKey && event.shiftKey === shiftKey && event.code === code) {
      event.preventDefault();
      toggleEnabled();
    }
  }

  function toggleEnabled() {
    state.isEnabled = !state.isEnabled;
    if (!state.isEnabled) {
      hideOverlay(state.overlay);
      hideReactOverlay(state.reactOverlay);
      state.isPinned = false;
      state.pinnedPosition = null;
    }
    console.log(`[HoverComp Dev Inspector] ${state.isEnabled ? 'Enabled' : 'Disabled'}`);
  }

  // ============================================================================
  // Message Handler
  // ============================================================================
  
  const messageHandler = createContentMessageHandler(
    updateOverlay,
    () => state.currentTarget
  );

  // ============================================================================
  // Initialization
  // ============================================================================
  
  function init() {
    injectInPageScript();
    monitorUrlChanges();

    document.addEventListener('mousemove', handleMouseMove, true);
    document.addEventListener('click', handleClick, true);
    document.addEventListener('mouseout', handleMouseOut);
    document.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('scroll', handleScroll, true);
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('message', messageHandler);
    window.addEventListener('beforeunload', handleBeforeUnload);

  console.log('[HoverComp Dev Inspector] Content script loaded');
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Export for testing
export { updateOverlay, toggleEnabled, handleMouseMove };
