/**
 * State Management for Content Script
 * Manages the global state of the inspector
 */

import { DEFAULT_EXPANDED_SECTIONS } from '../config/constants.js';

export const state = {
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
  frameworkObserver: null, // MutationObserver for framework detection
  observerInitTimeout: null, // Timeout ID for observer initialization
  observerCleanupTimeout: null, // Timeout ID for observer cleanup
};

/**
 * Reset overlay state (unpin and hide)
 */
export function resetOverlayState(hideOverlayFn, hideReactOverlayFn, hideVueOverlayFn) {
  state.isPinned = false;
  state.pinnedPosition = null;
  state.currentTarget = null;
  hideOverlayFn(state.overlay);
  hideReactOverlayFn(state.reactOverlay);
  hideVueOverlayFn(state.vueOverlay);
}

/**
 * Toggle inspector enabled state
 */
export function toggleEnabled(hideOverlayFn, hideReactOverlayFn, hideVueOverlayFn) {
  state.isEnabled = !state.isEnabled;
  if (!state.isEnabled) {
    hideOverlayFn(state.overlay);
    hideReactOverlayFn(state.reactOverlay);
    hideVueOverlayFn(state.vueOverlay);
    state.isPinned = false;
    state.pinnedPosition = null;
  }
}
