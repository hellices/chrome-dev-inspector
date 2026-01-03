/**
 * Panel positioning utilities
 */

import { PANEL_SPACING, PANEL_MARGIN } from '../config/constants.js';

/**
 * Calculate optimal panel position based on mouse position and panel size
 * @param {number} mouseX - Mouse X position
 * @param {number} mouseY - Mouse Y position
 * @param {DOMRect} panelRect - Panel bounding rectangle
 * @returns {{left: number, top: number}} Position object
 */
export function calculatePanelPosition(mouseX, mouseY, panelRect) {
  // Validate inputs
  if (typeof mouseX !== 'number' || typeof mouseY !== 'number') {
    console.warn('[HoverComp] Invalid mouse position:', mouseX, mouseY);
    return { left: PANEL_MARGIN, top: PANEL_MARGIN };
  }
  
  if (!panelRect) {
    console.warn('[HoverComp] Invalid panel rect');
    return { left: mouseX + PANEL_SPACING, top: mouseY - 20 };
  }
  
  const panelWidth = panelRect.width || 400;
  let panelHeight = panelRect.height || 600;
  const margin = PANEL_MARGIN;
  const maxHeight = window.innerHeight - margin * 2;

  // Limit panel height to viewport
  if (panelHeight > maxHeight) {
    panelHeight = maxHeight;
  }

  let left = mouseX + PANEL_SPACING;
  let top = mouseY - 20; // Slightly above mouse cursor

  // If not enough space on right, show on left
  if (left + panelWidth > window.innerWidth - margin) {
    left = mouseX - panelWidth - PANEL_SPACING;
  }

  // Keep left within bounds
  if (left < margin) {
    left = margin;
  }

  // Keep top within bounds - if not enough space below, show above
  if (top + panelHeight > window.innerHeight - margin) {
    // Try to position above mouse cursor
    const topAbove = mouseY - panelHeight - 20;
    if (topAbove >= margin) {
      top = topAbove;
    } else {
      // Not enough space above or below, fit to viewport
      top = margin;
    }
  }

  if (top < margin) {
    top = margin;
  }

  return { left, top };
}

/**
 * Adjust panel position if it goes off screen
 * @param {HTMLElement} panel - Panel element
 */
export function adjustPanelPosition(panel) {
  if (!panel) {
    console.warn('[HoverComp] adjustPanelPosition called with null panel');
    return;
  }
  
  const panelRect = panel.getBoundingClientRect();
  if (!panelRect) {
    console.warn('[HoverComp] Could not get panel bounding rect');
    return;
  }
  
  const margin = PANEL_MARGIN;

  // Check if panel is cut off at bottom
  if (panelRect.bottom > window.innerHeight - margin) {
    let newTop = parseInt(panel.style.top) || 0;
    const overflow = panelRect.bottom - (window.innerHeight - margin);
    newTop = newTop - overflow - 20; // Extra 20px buffer

    // Make sure it doesn't go above viewport
    if (newTop < margin) {
      newTop = margin;
      const maxHeight = window.innerHeight - margin * 2;
      panel.style.maxHeight = `${maxHeight}px`;
      panel.style.overflowY = 'auto';
    }

    panel.style.top = `${newTop}px`;
  }
}

/**
 * Apply panel positioning styles
 * @param {HTMLElement} panel - Panel element
 * @param {{left: number, top: number}} position - Position object
 * @param {boolean} isPinned - Whether panel is pinned
 */
export function applyPanelPosition(panel, position, isPinned = false) {
  if (!panel) {
    console.warn('[HoverComp] applyPanelPosition called with null panel');
    return;
  }
  
  if (!position || typeof position.left !== 'number' || typeof position.top !== 'number') {
    console.warn('[HoverComp] Invalid position:', position);
    return;
  }
  
  panel.style.left = `${position.left}px`;
  panel.style.top = `${position.top}px`;
  panel.style.transform = 'none';

  if (isPinned) {
    panel.style.transition = 'border 0.2s ease';
    panel.style.border = '2px solid #4caf50';
  } else {
    panel.style.transition = 'left 0.15s ease-out, top 0.15s ease-out, border 0.2s ease';
    panel.style.border = '1px solid rgba(255, 255, 255, 0.1)';
  }
}
