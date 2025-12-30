/**
 * Content script for HoverComp Dev Inspector - Refactored
 * Handles hover events, overlay rendering, and communication with inpage script
 */

import { THROTTLE_MS, TOGGLE_SHORTCUT, DEFAULT_EXPANDED_SECTIONS, OVERLAY_Z_INDEX } from './config/constants.js';
import { getXPath, injectScript, escapeHtml } from './utils/domHelpers.js';
import { createContentMessageHandler, requestComponentInfo, invalidateCache } from './utils/messageHandler.js';
import { calculatePanelPosition, adjustPanelPosition, applyPanelPosition } from './utils/panelPosition.js';
import { formatComponentInfo } from './utils/formatters.js';
import { getCSSInfo } from './utils/cssHelper.js';
import { getHtmlElementInfo, formatHtmlElementInfo } from './utils/htmlHelpers.js';
import { detectComponent } from './utils/frameworkDetect.js';
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
  restoreExpandedSections,
  setupEditableTextContentHandler,
  setupEditableAttributeHandlers,
  setupHtmlClassToggleHandlers,
  setupHtmlStyleToggleHandlers
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
  currentUrl: window.location.href,
  inspectionMode: 'auto', // 'auto', 'react', 'html', 'vue', etc.
  detectedFrameworks: [] // List of detected frameworks on the page
};

// ============================================================================
// Framework Detection & Mode Management
// ============================================================================

  function detectFrameworksOnPage() {
    const frameworks = [];
    
    // Check for React
    if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__?.renderers) {
      frameworks.push('react');
    }
    
    // Check for Vue 2
    if (window.Vue || document.querySelector('[data-v-]')) {
      frameworks.push('vue2');
    }
    
    // Check for Vue 3
    if (window.__VUE__ || document.querySelector('[data-v-app]')) {
      frameworks.push('vue3');
    }
    
    // Check for Angular
    if (window.ng || window.getAllAngularRootElements) {
      frameworks.push('angular');
    }
    
    return frameworks;
  }

  function updateDetectedFrameworks() {
    state.detectedFrameworks = detectFrameworksOnPage();
    console.log('[HoverComp] Detected frameworks:', state.detectedFrameworks);
    
    // Update mode selector UI if it exists
    updateModeSelector();
  }

  function setInspectionMode(mode) {
    const validModes = ['auto', 'html', ...state.detectedFrameworks];
    if (validModes.includes(mode)) {
      state.inspectionMode = mode;
      console.log('[HoverComp] Inspection mode set to:', mode);
      
      // Update UI
      updateModeSelector();
      
      // Refresh current overlay if present
      if (state.currentTarget) {
        requestComponentInfo(state.currentTarget, state.inspectionMode);
      }
      
      return true;
    }
    return false;
  }

  function createModeSelector() {
    // Remove existing selector if present
    const existing = document.getElementById('hovercomp-mode-selector');
    if (existing) {
      existing.remove();
    }
    
    const selector = document.createElement('div');
    selector.id = 'hovercomp-mode-selector';
    selector.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      z-index: ${OVERLAY_Z_INDEX + 1};
      background: rgba(20, 20, 20, 0.95);
      color: white;
      padding: 12px 16px;
      border-radius: 8px;
      font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
      font-size: 11px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      display: none;
    `;
    
    // Build selector HTML
    let html = `<div style="font-weight: bold; margin-bottom: 8px; color: #61dafb;">🔍 Inspection Mode</div>`;
    html += `<div style="display: flex; flex-direction: column; gap: 6px;">`;
    
    // Auto mode (always available)
    html += `<label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">`;
    html += `<input type="radio" name="inspection-mode" value="auto" ${state.inspectionMode === 'auto' ? 'checked' : ''} style="accent-color: #61dafb;">`;
    html += `<span>Auto (Framework First)</span>`;
    html += `</label>`;
    
    // Framework modes (only if detected)
    if (state.detectedFrameworks.includes('react')) {
      html += `<label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">`;
      html += `<input type="radio" name="inspection-mode" value="react" ${state.inspectionMode === 'react' ? 'checked' : ''} style="accent-color: #61dafb;">`;
      html += `<span style="color: #61dafb;">⚛️ React Mode</span>`;
      html += `</label>`;
    }
    
    if (state.detectedFrameworks.includes('vue2') || state.detectedFrameworks.includes('vue3')) {
      const vueMode = state.detectedFrameworks.includes('vue3') ? 'vue3' : 'vue2';
      html += `<label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">`;
      html += `<input type="radio" name="inspection-mode" value="${vueMode}" ${state.inspectionMode === vueMode ? 'checked' : ''} style="accent-color: #42b883;">`;
      html += `<span style="color: #42b883;">💚 Vue Mode</span>`;
      html += `</label>`;
    }
    
    if (state.detectedFrameworks.includes('angular')) {
      html += `<label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">`;
      html += `<input type="radio" name="inspection-mode" value="angular" ${state.inspectionMode === 'angular' ? 'checked' : ''} style="accent-color: #dd0031;">`;
      html += `<span style="color: #dd0031;">🅰️ Angular Mode</span>`;
      html += `</label>`;
    }
    
    // HTML mode (always available)
    html += `<label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">`;
    html += `<input type="radio" name="inspection-mode" value="html" ${state.inspectionMode === 'html' ? 'checked' : ''} style="accent-color: #ff9800;">`;
    html += `<span style="color: #ff9800;">📄 HTML Mode</span>`;
    html += `</label>`;
    
    html += `</div>`;
    html += `<div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.1); color: #666; font-size: 9px;">`;
    html += `Press Alt+Shift+M to toggle`;
    html += `</div>`;
    
    selector.innerHTML = html;
    
    // Add event listeners
    selector.querySelectorAll('input[name="inspection-mode"]').forEach(input => {
      input.addEventListener('change', (e) => {
        setInspectionMode(e.target.value);
      });
    });
    
    document.body.appendChild(selector);
    return selector;
  }

  function updateModeSelector() {
    const selector = document.getElementById('hovercomp-mode-selector');
    if (selector) {
      // Recreate to update options
      createModeSelector();
    }
  }

  function toggleModeSelector() {
    let selector = document.getElementById('hovercomp-mode-selector');
    if (!selector) {
      selector = createModeSelector();
    }
    
    if (selector.style.display === 'none' || !selector.style.display) {
      selector.style.display = 'block';
    } else {
      selector.style.display = 'none';
    }
  }

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

    // If HTML mode is forced, use HTML element info
    if (state.inspectionMode === 'html' && element instanceof HTMLElement) {
      const htmlInfo = getHtmlElementInfo(element);
      if (htmlInfo) {
        showOverlay(state.overlay, element);
        hideReactOverlay(state.reactOverlay);
        
        const panel = getPanel(state.overlay);
        if (panel) {
          // Position panel
          if (state.isPinned && state.pinnedPosition) {
            applyPanelPosition(panel, state.pinnedPosition, true);
          } else if (mouseX && mouseY) {
            const panelRect = panel.getBoundingClientRect();
            const position = calculatePanelPosition(mouseX, mouseY, panelRect);
            applyPanelPosition(panel, position, false);
            setTimeout(() => adjustPanelPosition(panel), 50);
          }

          // Update content with HTML mode formatter
          const html = formatHtmlElementInfo(htmlInfo, state.isPinned);
          updatePanelContent(panel, html);

          // Setup event handlers
          setupAllEventHandlers(panel, element);
          restoreExpandedSections(panel, state.expandedSections);
          setTimeout(() => adjustPanelPosition(panel), 100);
        }
        return;
      }
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
      setTimeout(() => requestComponentInfo(el, state.inspectionMode), 10);
    };

    // HTML mode handlers
    if (state.inspectionMode === 'html') {
      setupEditableTextContentHandler(panel, element);
      setupEditableAttributeHandlers(panel, element, refreshOverlay);
      setupClassToggleHandlers(panel, element, refreshOverlay); // Use standard handler
      setupStyleToggleHandlers(panel, element, refreshOverlay); // Use standard handler
      setupComputedStyleHandlers(panel, element); // Add computed styles handler
      setupAddClassHandlers(panel, element, refreshOverlay);
      setupAddStyleHandlers(panel, element, refreshOverlay);
    } else {
      // Framework mode handlers (React, Vue, etc.)
      setupEditableHookHandlers(panel, element);
      setupEditableStateHandlers(panel, element);
      setupClassToggleHandlers(panel, element, refreshOverlay);
      setupStyleToggleHandlers(panel, element, refreshOverlay);
      setupComputedStyleHandlers(panel, element);
      setupAddClassHandlers(panel, element, refreshOverlay);
      setupAddStyleHandlers(panel, element, refreshOverlay);
    }
    
    // Toggle sections handler (common for all modes)
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

    requestComponentInfo(target, state.inspectionMode);
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
      requestComponentInfo(state.currentTarget, state.inspectionMode);
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
    
    // Alt+Shift+M to toggle mode selector
    if (event.altKey && event.shiftKey && event.code === 'KeyM') {
      event.preventDefault();
      toggleModeSelector();
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
    
    // Detect frameworks on page
    setTimeout(() => {
      updateDetectedFrameworks();
      
      // Auto-show mode selector if frameworks detected
      if (state.detectedFrameworks.length > 0) {
        setTimeout(() => {
          const selector = createModeSelector();
          selector.style.display = 'block';
          // Auto-hide after 5 seconds
          setTimeout(() => {
            selector.style.display = 'none';
          }, 5000);
        }, 1000);
      }
    }, 2000);

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
