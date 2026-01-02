/**
 * Content script for HoverComp Dev Inspector - Refactored
 * Handles hover events, overlay rendering, and communication with inpage script
 */

import {
  THROTTLE_MS,
  TOGGLE_SHORTCUT,
  DEFAULT_EXPANDED_SECTIONS,
  OVERLAY_Z_INDEX,
} from './config/constants.js';
import { getXPath, injectScript, escapeHtml } from './utils/domHelpers.js';
import {
  createContentMessageHandler,
  requestComponentInfo,
  invalidateCache,
} from './utils/messageHandler.js';
import {
  calculatePanelPosition,
  adjustPanelPosition,
  applyPanelPosition,
} from './utils/panelPosition.js';
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
  hideReactOverlay,
  createVueOverlay,
  showVueOverlay,
  hideVueOverlay,
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
  setupHtmlStyleToggleHandlers,
} from './overlay/eventHandlers.js';
import { setupAddClassHandlers, setupAddStyleHandlers } from './overlay/advancedHandlers.js';

// ============================================================================
// State Management
// ============================================================================

const state = {
  isEnabled: true,
  overlay: null,
  reactOverlay: null,
  vueOverlay: null,
  currentTarget: null,
  lastHoverTime: 0,
  isPinned: false,
  pinnedPosition: null,
  expandedSections: { ...DEFAULT_EXPANDED_SECTIONS },
  currentUrl: window.location.href,
  inspectionMode: 'auto', // 'auto', 'react', 'html', 'vue', etc.
  detectedFrameworks: [], // List of detected frameworks on the page
  detectedFrameworksFromInpage: new Set(), // Frameworks detected by inpage.js (from actual components)
};

// ============================================================================
// Framework Detection & Mode Management
// ============================================================================

function detectFrameworksOnPage() {
  const frameworks = [];

  // Check for React
  let hasReact = window.__REACT_DEVTOOLS_GLOBAL_HOOK__?.renderers;
  
  // Also check if inpage.js has detected React components
  if (!hasReact && state.detectedFrameworksFromInpage.has('react')) {
    hasReact = true;
  }
  
  if (hasReact) {
    frameworks.push('react');
  }

  // Check for Vue 2
  let hasVue2 = window.Vue;
  if (!hasVue2 && state.detectedFrameworksFromInpage.has('vue2')) {
    hasVue2 = true;
  }
  if (hasVue2) {
    frameworks.push('vue2');
  }

  // Check for Vue 3
  let hasVue3 = window.__VUE__ || window.__VUE_DEVTOOLS_GLOBAL_HOOK__;
  if (!hasVue3 && state.detectedFrameworksFromInpage.has('vue3')) {
    hasVue3 = true;
  }
  if (hasVue3 && !hasVue2) {
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
}

function setInspectionMode(mode) {
  const validModes = ['auto', 'html', ...state.detectedFrameworks];
  if (validModes.includes(mode)) {
    state.inspectionMode = mode;

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
  selector.querySelectorAll('input[name="inspection-mode"]').forEach((input) => {
    input.addEventListener('change', (e) => {
      setInspectionMode(e.target.value);
    });
  });

  document.body.appendChild(selector);
  return selector;
}



function toggleModeSelector() {
  let selector = document.getElementById('hovercomp-mode-selector');
  
  // If selector exists and is hidden, show it (recreate with fresh detection)
  if (selector && (selector.style.display === 'none' || !selector.style.display)) {
    // Re-detect frameworks when opening
    state.detectedFrameworks = detectFrameworksOnPage();
    selector.remove();
    selector = createModeSelector();
    selector.style.display = 'block';
  } 
  // If selector exists and is visible, hide it
  else if (selector) {
    selector.style.display = 'none';
  } 
  // If selector doesn't exist, create it
  else {
    state.detectedFrameworks = detectFrameworksOnPage();
    selector = createModeSelector();
    selector.style.display = 'block';
  }
}

function setupModeSelectorButtonHandler(panel) {
  const modeBtn = panel.querySelector('#hovercomp-mode-btn');
  if (modeBtn) {
    modeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleModeSelector();
    });
    
    // Hover effect
    modeBtn.addEventListener('mouseenter', () => {
      modeBtn.style.background = 'rgba(97, 218, 251, 0.2)';
      modeBtn.style.borderColor = 'rgba(97, 218, 251, 0.5)';
    });
    modeBtn.addEventListener('mouseleave', () => {
      modeBtn.style.background = 'rgba(97, 218, 251, 0.1)';
      modeBtn.style.borderColor = 'rgba(97, 218, 251, 0.3)';
    });
  }
}

// ============================================================================
// Welcome Tip for First-Time Users
// ============================================================================

function showWelcomeTipIfFirstTime() {
  const hasSeenWelcome = localStorage.getItem('hovercomp-seen-welcome');
  
  if (!hasSeenWelcome) {
    setTimeout(() => {
      const tip = document.createElement('div');
      tip.id = 'hovercomp-welcome-tip';
      tip.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        z-index: ${OVERLAY_Z_INDEX + 2};
        background: linear-gradient(135deg, rgba(20, 20, 20, 0.98), rgba(30, 30, 40, 0.98));
        color: white;
        padding: 24px 32px;
        border-radius: 12px;
        font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
        font-size: 13px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(97, 218, 251, 0.3);
        backdrop-filter: blur(10px);
        max-width: 450px;
        animation: fadeIn 0.3s ease-in;
      `;
      
      tip.innerHTML = `
        <style>
          @keyframes fadeIn {
            from { opacity: 0; transform: translate(-50%, -45%); }
            to { opacity: 1; transform: translate(-50%, -50%); }
          }
        </style>
        <div style="text-align: center;">
          <div style="font-size: 32px; margin-bottom: 12px;">👋</div>
          <div style="color: #61dafb; font-size: 16px; font-weight: bold; margin-bottom: 16px;">Welcome to HoverComp Dev Inspector!</div>
          <div style="color: #ccc; line-height: 1.6; margin-bottom: 20px;">
            Hover over any element to inspect components.<br>
            Click the <strong style="color: #61dafb;">🔧 Mode</strong> button in the panel to switch between React, HTML, and other modes.
          </div>
          <div style="color: #888; font-size: 11px; margin-bottom: 16px; padding: 12px; background: rgba(255,255,255,0.05); border-radius: 6px;">
            <strong>Quick Shortcuts:</strong><br>
            • <span style="color: #61dafb;">Alt+Shift+C</span> — Toggle inspector<br>
            • <span style="color: #61dafb;">Alt+Shift+M</span> — Open mode selector<br>
            • <span style="color: #61dafb;">Alt+Click</span> — Pin/unpin overlay
          </div>
          <button id="hovercomp-welcome-close" style="
            background: linear-gradient(135deg, #61dafb, #4a9cc5);
            color: white;
            border: none;
            padding: 10px 24px;
            border-radius: 6px;
            font-size: 12px;
            font-weight: bold;
            cursor: pointer;
            font-family: inherit;
            transition: all 0.2s;
            box-shadow: 0 4px 12px rgba(97, 218, 251, 0.3);
          ">Got it! 🚀</button>
        </div>
      `;
      
      document.body.appendChild(tip);
      
      const closeBtn = tip.querySelector('#hovercomp-welcome-close');
      closeBtn.addEventListener('click', () => {
        tip.style.animation = 'fadeIn 0.2s ease-out reverse';
        setTimeout(() => {
          tip.remove();
          localStorage.setItem('hovercomp-seen-welcome', 'true');
        }, 200);
      });
      
      closeBtn.addEventListener('mouseenter', () => {
        closeBtn.style.transform = 'scale(1.05)';
        closeBtn.style.boxShadow = '0 6px 16px rgba(97, 218, 251, 0.4)';
      });
      closeBtn.addEventListener('mouseleave', () => {
        closeBtn.style.transform = 'scale(1)';
        closeBtn.style.boxShadow = '0 4px 12px rgba(97, 218, 251, 0.3)';
      });
    }, 1500);
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
  // Track detected frameworks from component info
  if (componentInfo?.framework) {
    const framework = componentInfo.framework.toLowerCase();
    if (framework.includes('react')) {
      state.detectedFrameworksFromInpage.add('react');
    } else if (framework.includes('vue 3')) {
      state.detectedFrameworksFromInpage.add('vue3');
    } else if (framework.includes('vue 2') || framework.includes('vue')) {
      state.detectedFrameworksFromInpage.add('vue2');
    }
  }

  if (!state.overlay) {
    state.overlay = createOverlay();
  }
  if (!state.reactOverlay) {
    state.reactOverlay = createReactOverlay();
  }
  if (!state.vueOverlay) {
    state.vueOverlay = createVueOverlay();
  }

  // If HTML mode is forced, use HTML element info
  if (state.inspectionMode === 'html' && element instanceof HTMLElement) {
    const htmlInfo = getHtmlElementInfo(element);
    if (htmlInfo) {
      showOverlay(state.overlay, element);
      hideReactOverlay(state.reactOverlay);
      hideVueOverlay(state.vueOverlay);
// Track detected frameworks from component info
  if (componentInfo?.framework) {
    const framework = componentInfo.framework.toLowerCase();
    if (framework.includes('react')) {
      state.detectedFrameworksFromInpage.add('react');
    } else if (framework.includes('vue 3')) {
      state.detectedFrameworksFromInpage.add('vue3');
    } else if (framework.includes('vue 2') || framework.includes('vue')) {
      state.detectedFrameworksFromInpage.add('vue2');
    }
  }

  
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
      hideVueOverlay(state.vueOverlay);
    }
    return;
  }

  // Add CSS info to component info
  if (element instanceof HTMLElement) {
    componentInfo.css = getCSSInfo(element);
  }

  // Show DOM overlay for the hovered element
  showOverlay(state.overlay, element);

  // Show framework-specific overlay if available
  const framework = componentInfo.framework?.toLowerCase();
  
  if (framework === 'react' && reactComponentXPath) {
    // Show React overlay
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
    hideVueOverlay(state.vueOverlay);
  } else if (framework === 'vue 2' || framework === 'vue 3') {
    // Show Vue overlay on the same element (Vue components map 1:1 with DOM)
    showVueOverlay(state.vueOverlay, element);
    hideReactOverlay(state.reactOverlay);
  } else {
    hideReactOverlay(state.reactOverlay);
    hideVueOverlay(state.vueOverlay);
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
        y: parseInt(panel.style.top),
      };
    }
  });
  
  // Mode selector button handler
  setupModeSelectorButtonHandler(panel);
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
          y: parseInt(panel.style.top),
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
    hideVueOverlay(state.vueOverlay);
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

    // Update Vue overlay if it's visible
    if (state.vueOverlay?.style.display !== 'none') {
      showVueOverlay(state.vueOverlay, element);
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
  hideVueOverlay(state.vueOverlay);
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

  history.pushState = function (...args) {
    const result = originalPushState.apply(this, args);
    setTimeout(() => handleUrlChange(), 0);
    return result;
  };

  history.replaceState = function (...args) {
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
    hideVueOverlay(state.vueOverlay);
    state.isPinned = false;
    state.pinnedPosition = null;
  }
  console.log(`[HoverComp Dev Inspector] ${state.isEnabled ? 'Enabled' : 'Disabled'}`);
}

// ============================================================================
// Message Handler
// ============================================================================

const messageHandler = createContentMessageHandler(updateOverlay, () => state.currentTarget);

// ============================================================================
// Initialization
// ============================================================================

function init() {
  injectInPageScript();
  monitorUrlChanges();

  // Show welcome tip for first-time users
  showWelcomeTipIfFirstTime();

  // Detect frameworks on page - multiple attempts for SPAs
  setTimeout(() => {
    updateDetectedFrameworks();
  }, 1000);
  
  setTimeout(() => {
    updateDetectedFrameworks();
  }, 3000);
  
  // Re-detect on DOM changes (for SPAs)
  const observer = new MutationObserver(() => {
    updateDetectedFrameworks();
  });
  
  // Start observing after initial load
  setTimeout(() => {
    observer.observe(document.body, { 
      childList: true, 
      subtree: true 
    });
    
    // Stop observing after 10 seconds to avoid performance issues
    setTimeout(() => observer.disconnect(), 10000);
  }, 500);

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
