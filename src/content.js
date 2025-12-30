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
  updatePanelContent 
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
  currentTarget: null,
  lastHoverTime: 0,
  isPinned: false,
  pinnedPosition: null,
  expandedSections: { ...DEFAULT_EXPANDED_SECTIONS }
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
  
  function updateOverlay(element, componentInfo, mouseX, mouseY) {
    if (!state.overlay) {
      state.overlay = createOverlay();
    }

    if (!componentInfo) {
      if (!state.isPinned) {
        hideOverlay(state.overlay);
      }
      return;
    }

    // Add CSS info to component info
    if (element instanceof HTMLElement) {
      componentInfo.css = getCSSInfo(element);
    }

    showOverlay(state.overlay, element);
    
    const panel = getPanel(state.overlay);
    if (!panel) return;

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
    }
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

    document.addEventListener('mousemove', handleMouseMove, true);
    document.addEventListener('click', handleClick, true);
    document.addEventListener('mouseout', handleMouseOut);
    document.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('message', messageHandler);

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
