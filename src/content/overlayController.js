/**
 * Overlay Controller - Manages overlay updates and rendering
 */

import { getCSSInfo } from '../utils/cssHelper.js';
import { getHtmlElementInfo, formatHtmlElementInfo } from '../utils/htmlHelpers.js';
import {
  getFrameworkNote,
  showFrameworkOverlay,
  updateReactOverlayPosition,
} from '../utils/overlayHelpers.js';
import {
  calculatePanelPosition,
  adjustPanelPosition,
  applyPanelPosition,
} from '../utils/panelPosition.js';
import { formatComponentInfo } from '../utils/formatters.js';
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
} from '../overlay/overlayManager.js';
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
} from '../overlay/eventHandlers.js';
import { setupAddClassHandlers, setupAddStyleHandlers } from '../overlay/advancedHandlers.js';
import { trackDetectedFramework } from './modeSelector.js';
import { setupModeSelectorButtonHandler } from './modeSelector.js';
import { invalidateCache } from '../utils/messageHandler.js';

/**
 * Setup all event handlers for the panel
 */
function setupAllEventHandlers(panel, element, state, requestComponentInfoFn) {
  const refreshOverlay = (el) => {
    invalidateCache(el);
    setTimeout(() => requestComponentInfoFn(el, state.inspectionMode), 10);
  };

  // HTML mode handlers
  if (state.inspectionMode === 'html') {
    setupEditableTextContentHandler(panel, element);
    setupEditableAttributeHandlers(panel, element, refreshOverlay);
    setupClassToggleHandlers(panel, element, refreshOverlay);
    setupStyleToggleHandlers(panel, element, refreshOverlay);
    setupComputedStyleHandlers(panel, element);
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
  setupModeSelectorButtonHandler(panel, state);
}

/**
 * Update overlay with component info
 */
export function updateOverlay(element, componentInfo, mouseX, mouseY, reactComponentXPath, state, requestComponentInfoFn) {
  // Track detected frameworks from component info
  trackDetectedFramework(componentInfo, state.detectedFrameworksFromInpage);

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
        setupAllEventHandlers(panel, element, state, requestComponentInfoFn);
        restoreExpandedSections(panel, state.expandedSections);
        setTimeout(() => adjustPanelPosition(panel), 100);
      }
      return;
    }
  }

  if (!componentInfo) {
    // If no framework component detected, fallback to HTML mode
    if (element instanceof HTMLElement) {
      const htmlInfo = getHtmlElementInfo(element);
      if (htmlInfo) {
        showOverlay(state.overlay, element);
        hideReactOverlay(state.reactOverlay);
        hideVueOverlay(state.vueOverlay);
        
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

          // Show appropriate note based on detected frameworks
          const frameworkNote = getFrameworkNote(state.detectedFrameworks);
          
          const html = frameworkNote + formatHtmlElementInfo(htmlInfo, state.isPinned);
          updatePanelContent(panel, html);

          // Setup event handlers
          setupAllEventHandlers(panel, element, state, requestComponentInfoFn);
          restoreExpandedSections(panel, state.expandedSections);
          setTimeout(() => adjustPanelPosition(panel), 100);
        }
        return;
      }
    }
    
    // Only hide overlay if we couldn't get any info and not pinned
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
  
  showFrameworkOverlay(framework, reactComponentXPath, element, {
    reactOverlay: state.reactOverlay,
    vueOverlay: state.vueOverlay,
    showReactOverlay,
    showVueOverlay,
    hideReactOverlay,
    hideVueOverlay,
  });

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
  setupAllEventHandlers(panel, element, state, requestComponentInfoFn);

  // Restore expanded sections
  restoreExpandedSections(panel, state.expandedSections);

  // Adjust position after content is rendered
  setTimeout(() => adjustPanelPosition(panel), 100);
}

/**
 * Update overlay positions on scroll
 */
export function updateOverlayOnScroll(state) {
  // Check if current target still exists in DOM
  if (state.currentTarget && !document.body.contains(state.currentTarget)) {
    return false; // Indicate that target is invalid
  }

  // Update overlay positions on scroll
  if (state.currentTarget && state.overlay?.style.display !== 'none') {
    const element = state.currentTarget;
    showOverlay(state.overlay, element);

    // Also update React overlay if it's visible
    const panel = getPanel(state.overlay);
    updateReactOverlayPosition(panel, state.reactOverlay, showReactOverlay);

    // Update Vue overlay if it's visible
    if (state.vueOverlay?.style.display !== 'none') {
      showVueOverlay(state.vueOverlay, element);
    }
  }

  return true;
}
