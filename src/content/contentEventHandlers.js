/**
 * Content Event Handlers - Handles mouse, keyboard, and scroll events
 */

import { THROTTLE_MS, TOGGLE_SHORTCUT } from '../config/constants.js';
import { requestComponentInfo } from '../utils/messageHandler.js';
import { getPanel } from '../overlay/overlayManager.js';
import { calculatePanelPosition, applyPanelPosition } from '../utils/panelPosition.js';
import { toggleModeSelector } from './modeSelector.js';

/**
 * Handle mouse move event
 */
export function handleMouseMove(event, state, hideOverlayFns) {
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

/**
 * Handle click event (for pinning)
 */
export function handleClick(event, state) {
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

/**
 * Handle mouse out event
 */
export function handleMouseOut(event, state, hideOverlayFns) {
  if (state.isPinned) return;
  if (!event.relatedTarget || event.relatedTarget === document.documentElement) {
    hideOverlayFns.hideOverlay(state.overlay);
    hideOverlayFns.hideReactOverlay(state.reactOverlay);
    hideOverlayFns.hideVueOverlay(state.vueOverlay);
  }
}

/**
 * Handle scroll event
 */
export function handleScroll(state, resetOverlayStateFn, updateOverlayOnScrollFn, hideOverlayFns) {
  // Check if current target still exists in DOM
  if (state.currentTarget && !document.body.contains(state.currentTarget)) {
    resetOverlayStateFn(
      hideOverlayFns.hideOverlay,
      hideOverlayFns.hideReactOverlay,
      hideOverlayFns.hideVueOverlay
    );
    return;
  }

  // Update overlay positions on scroll
  updateOverlayOnScrollFn(state);
}

/**
 * Handle keyboard shortcut events
 */
export function handleKeyDown(event, state, toggleEnabledFn, hideOverlayFns) {
  // Alt+Shift+C to toggle inspector
  const { altKey, shiftKey, code } = TOGGLE_SHORTCUT;
  if (event.altKey === altKey && event.shiftKey === shiftKey && event.code === code) {
    event.preventDefault();
    toggleEnabledFn(
      hideOverlayFns.hideOverlay,
      hideOverlayFns.hideReactOverlay,
      hideOverlayFns.hideVueOverlay
    );
  }

  // Alt+Shift+M to toggle mode selector
  if (event.altKey && event.shiftKey && event.code === 'KeyM') {
    event.preventDefault();
    toggleModeSelector(state);
  }
}

/**
 * Handle before unload event
 */
export function handleBeforeUnload(resetOverlayStateFn, hideOverlayFns) {
  resetOverlayStateFn(
    hideOverlayFns.hideOverlay,
    hideOverlayFns.hideReactOverlay,
    hideOverlayFns.hideVueOverlay
  );
}
