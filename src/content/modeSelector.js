/**
 * Mode Selector - Manages framework detection and inspection mode selection
 */

import { OVERLAY_Z_INDEX } from '../config/constants.js';
import {
  detectFrameworksOnPage,
  validateInspectionMode,
} from '../utils/frameworkManager.js';
import { requestComponentInfo } from '../utils/messageHandler.js';

/**
 * Update detected frameworks state
 */
export function updateDetectedFrameworksState(state) {
  state.detectedFrameworks = detectFrameworksOnPage(state.detectedFrameworksFromInpage);
}

/**
 * Set inspection mode
 */
export function setInspectionMode(mode, state) {
  if (validateInspectionMode(mode, state.detectedFrameworks)) {
    state.inspectionMode = mode;

    // Refresh current overlay if present
    if (state.currentTarget) {
      requestComponentInfo(state.currentTarget, state.inspectionMode);
    }

    return true;
  }
  return false;
}

/**
 * Create mode selector UI
 */
export function createModeSelector(state) {
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

  if (state.detectedFrameworks.includes('svelte')) {
    html += `<label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">`;
    html += `<input type="radio" name="inspection-mode" value="svelte" ${state.inspectionMode === 'svelte' ? 'checked' : ''} style="accent-color: #ff3e00;">`;
    html += `<span style="color: #ff3e00;">🔥 Svelte Mode</span>`;
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
      setInspectionMode(e.target.value, state);
    });
  });

  document.body.appendChild(selector);
  return selector;
}

/**
 * Toggle mode selector visibility
 */
export function toggleModeSelector(state) {
  let selector = document.getElementById('hovercomp-mode-selector');
  
  // If selector exists and is hidden, show it (recreate with fresh detection)
  if (selector && (selector.style.display === 'none' || !selector.style.display)) {
    // Re-detect frameworks when opening
    state.detectedFrameworks = detectFrameworksOnPage(state.detectedFrameworksFromInpage);
    selector.remove();
    selector = createModeSelector(state);
    selector.style.display = 'block';
  } 
  // If selector exists and is visible, hide it
  else if (selector) {
    selector.style.display = 'none';
  } 
  // If selector doesn't exist, create it
  else {
    state.detectedFrameworks = detectFrameworksOnPage(state.detectedFrameworksFromInpage);
    selector = createModeSelector(state);
    selector.style.display = 'block';
  }
}

/**
 * Setup mode selector button handler in panel
 */
export function setupModeSelectorButtonHandler(panel, state) {
  const modeBtn = panel.querySelector('#hovercomp-mode-btn');
  if (modeBtn) {
    modeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleModeSelector(state);
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
