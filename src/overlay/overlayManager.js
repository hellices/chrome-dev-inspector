/**
 * Overlay creation and management
 */

import {
  OVERLAY_Z_INDEX,
  PANEL_MIN_WIDTH,
  PANEL_MAX_WIDTH,
  PANEL_MAX_HEIGHT_VH,
  CSS_CLASSES,
} from '../config/constants.js';

/**
 * Create overlay element with panel
 * @returns {HTMLElement} Overlay element
 */
export function createOverlay() {
  const div = document.createElement('div');
  div.id = 'hovercomp-overlay';
  div.className = CSS_CLASSES.OVERLAY;
  div.style.cssText = `
    position: absolute;
    z-index: ${OVERLAY_Z_INDEX};
    pointer-events: none;
    display: none;
    background: rgba(0, 123, 255, 0.1);
    border: 2px solid rgba(0, 123, 255, 0.8);
    box-sizing: border-box;
  `;

  const panel = createPanel();
  div.appendChild(panel);
  document.body.appendChild(div);

  return div;
}

/**
 * Create React component overlay element (lighter, no panel)
 * @returns {HTMLElement} React overlay element
 */
export function createReactOverlay() {
  const div = document.createElement('div');
  div.id = 'hovercomp-react-overlay';
  div.className = CSS_CLASSES.OVERLAY + '-react';
  div.style.cssText = `
    position: absolute;
    z-index: ${OVERLAY_Z_INDEX - 1};
    pointer-events: none;
    display: none;
    background: rgba(156, 39, 176, 0.05);
    border: 2px dashed rgba(156, 39, 176, 0.4);
    box-sizing: border-box;
  `;
  document.body.appendChild(div);

  return div;
}

/**
 * Create panel element
 * @returns {HTMLElement} Panel element
 */
function createPanel() {
  const panel = document.createElement('div');
  panel.className = CSS_CLASSES.PANEL;
  panel.style.cssText = `
    position: fixed;
    background: rgba(20, 20, 20, 0.98);
    color: white;
    padding: 16px;
    font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
    font-size: 11px;
    line-height: 1.5;
    border-radius: 8px;
    white-space: pre-wrap;
    min-width: ${PANEL_MIN_WIDTH}px;
    max-width: ${PANEL_MAX_WIDTH}px;
    max-height: ${PANEL_MAX_HEIGHT_VH}vh;
    overflow-y: auto;
    overflow-x: hidden;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
    pointer-events: auto;
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    z-index: ${OVERLAY_Z_INDEX};
    scrollbar-width: thin;
    scrollbar-color: rgba(255,255,255,0.3) rgba(0,0,0,0.2);
  `;

  return panel;
}

/**
 * Show overlay for element
 * @param {HTMLElement} overlay - Overlay element
 * @param {HTMLElement} element - Target element
 */
export function showOverlay(overlay, element) {
  if (!overlay || !element) return;

  const rect = element.getBoundingClientRect();
  overlay.style.display = 'block';
  overlay.style.top = `${rect.top + window.scrollY}px`;
  overlay.style.left = `${rect.left + window.scrollX}px`;
  overlay.style.width = `${rect.width}px`;
  overlay.style.height = `${rect.height}px`;
}

/**
 * Show React component overlay for element
 * @param {HTMLElement} reactOverlay - React overlay element
 * @param {HTMLElement} element - Target element
 */
export function showReactOverlay(reactOverlay, element) {
  if (!reactOverlay || !element) return;

  const rect = element.getBoundingClientRect();
  reactOverlay.style.display = 'block';
  reactOverlay.style.top = `${rect.top + window.scrollY}px`;
  reactOverlay.style.left = `${rect.left + window.scrollX}px`;
  reactOverlay.style.width = `${rect.width}px`;
  reactOverlay.style.height = `${rect.height}px`;
}

/**
 * Hide overlay
 * @param {HTMLElement} overlay - Overlay element
 */
export function hideOverlay(overlay) {
  if (overlay) {
    overlay.style.display = 'none';
  }
}

/**
 * Hide React component overlay
 * @param {HTMLElement} reactOverlay - React overlay element
 */
export function hideReactOverlay(reactOverlay) {
  if (reactOverlay) {
    reactOverlay.style.display = 'none';
  }
}

/**
 * Get panel element from overlay
 * @param {HTMLElement} overlay - Overlay element
 * @returns {HTMLElement|null} Panel element
 */
export function getPanel(overlay) {
  return overlay?.querySelector(`.${CSS_CLASSES.PANEL}`);
}

/**
 * Update panel content
 * @param {HTMLElement} panel - Panel element
 * @param {string} html - HTML content
 */
export function updatePanelContent(panel, html) {
  if (panel) {
    panel.innerHTML = html;
  }
}
