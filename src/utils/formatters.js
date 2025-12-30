/**
 * Value formatting utilities for display
 */

import { escapeHtml } from './domHelpers.js';
import { formatCSS } from '../overlay/cssFormatter.js';

/**
 * Format a value for display in the panel
 * @param {*} value - Value to format
 * @returns {string} HTML formatted string
 */
export function formatValue(value) {
  if (value === null) return '<span style="color: #999;">null</span>';
  if (value === undefined) return '<span style="color: #999;">undefined</span>';
  if (typeof value === 'string')
    return `<span style="color: #a5d6a7;">"${escapeHtml(value)}"</span>`;
  if (typeof value === 'number') return `<span style="color: #90caf9;">${value}</span>`;
  if (typeof value === 'boolean') return `<span style="color: #ce93d8;">${value}</span>`;
  if (Array.isArray(value)) return `<span style="color: #999;">[Array(${value.length})]</span>`;
  if (typeof value === 'object') {
    try {
      const str = JSON.stringify(value, null, 2);
      if (str.length > 100) return `<span style="color: #999;">{Object}</span>`;
      return `<span style="color: #999;">${escapeHtml(str)}</span>`;
    } catch {
      return `<span style="color: #999;">{Object}</span>`;
    }
  }
  return escapeHtml(String(value));
}

/**
 * Format component information into HTML
 * @param {Object} info - Component information
 * @param {boolean} pinned - Whether panel is pinned
 * @returns {string} HTML string
 */
export function formatComponentInfo(info, pinned = false) {
  if (!info) return '';

  let html = formatHeader(info, pinned);
  html += formatUserComponents(info.allUserComponents);
  html += formatHierarchy(info.hierarchy);
  html += formatProps(info.props);
  html += formatState(info.state);
  html += formatHooks(info.hooks);
  html += formatCSSSection(info.css);
  html += formatFooter(pinned);

  return html;
}

/**
 * Format component header
 */
function formatHeader(info, pinned) {
  let html = `<div style="margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.1);">`;
  html += `<div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">`;
  html += `<strong style="color: #61dafb; font-size: 14px;">${escapeHtml(info.name)}</strong>`;

  if (info.isUserComponent) {
    html += `<span style="background: #4caf50; color: white; padding: 2px 6px; border-radius: 3px; font-size: 9px; font-weight: bold;">USER</span>`;
  } else {
    html += `<span style="background: #ff9800; color: white; padding: 2px 6px; border-radius: 3px; font-size: 9px;">LIB</span>`;
  }

  if (pinned) {
    html += `<span style="background: #4caf50; color: white; padding: 2px 6px; border-radius: 3px; font-size: 9px;">📍 PINNED</span>`;
  }

  html += `</div>`;
  html += `<div style="color: #888; font-size: 10px;">${escapeHtml(info.framework)}</div>`;

  if (info.fileName) {
    const shortPath =
      info.fileName.split('/').slice(-3).join('/') ||
      info.fileName.split('\\').slice(-3).join('\\');
    html += `<div style="color: #64b5f6; font-size: 9px; margin-top: 2px; word-break: break-all;" title="${escapeHtml(info.fileName)}">📁 ${escapeHtml(shortPath)}</div>`;
  } else if (info.detail) {
    html += `<div style="color: #888; font-size: 9px; margin-top: 2px; word-break: break-all;">${escapeHtml(info.detail)}</div>`;
  }

  if (info.isFromNodeModules !== undefined) {
    const debugColor = info.isFromNodeModules ? '#ff5252' : '#69f0ae';
    html += `<div style="color: ${debugColor}; font-size: 8px; margin-top: 2px;">`;
    html += info.isFromNodeModules ? '⚠️ From node_modules/framework' : '✓ From your code';
    html += `</div>`;
  }

  html += `</div>`;
  return html;
}

/**
 * Format user components section
 */
function formatUserComponents(allUserComponents) {
  if (!allUserComponents || allUserComponents.length === 0) return '';

  let html = `<div style="margin-bottom: 12px; padding: 8px; background: rgba(76, 175, 80, 0.1); border-radius: 4px; border-left: 3px solid #4caf50;">`;
  html += `<div class="toggle-section" style="color: #4caf50; font-size: 10px; font-weight: bold; margin-bottom: 0px; cursor: pointer;">▶ Your Components (${allUserComponents.length})</div>`;
  html += `<div style="display: none; margin-top: 4px;">`;

  if (allUserComponents.length === 1) {
    html += `<div style="font-size: 10px; color: #a5d6a7;">${escapeHtml(allUserComponents[0])}</div>`;
  } else {
    const reversed = [...allUserComponents].reverse();
    html += `<div style="font-size: 10px; color: #a5d6a7;">`;
    reversed.forEach((comp, i) => {
      const indent = '  '.repeat(i);
      const arrow = i === 0 ? '📦 ' : '└─ ';
      html += `<div style="margin: 2px 0;">${indent}${arrow}${escapeHtml(comp)}</div>`;
    });
    html += `</div>`;
  }

  html += `</div></div>`;
  return html;
}

/**
 * Format hierarchy section
 */
function formatHierarchy(hierarchy) {
  if (!hierarchy || hierarchy.length <= 1 || hierarchy.length > 10) return '';

  let html = `<div style="margin-bottom: 12px; padding: 8px; background: rgba(255,255,255,0.03); border-radius: 4px;">`;
  html += `<div class="toggle-section" style="color: #888; font-size: 9px; margin-bottom: 0px; cursor: pointer;">▶ Hierarchy (${hierarchy.length})</div>`;
  html += `<div style="font-size: 10px; color: #90caf9; display: none; margin-top: 4px;">${hierarchy.map((h) => escapeHtml(h)).join(' → ')}</div>`;
  html += `</div>`;
  return html;
}

/**
 * Format props section
 */
function formatProps(props) {
  if (!props || Object.keys(props).length === 0) return '';

  const propsKeys = Object.keys(props).filter((k) => k !== 'children');
  if (propsKeys.length === 0) return '';

  let html = `<div class="toggle-section" style="color: #ffa726; margin-top: 12px; font-weight: bold; padding: 6px 0; border-bottom: 1px solid rgba(255,167,38,0.3); cursor: pointer;">▶ Props (${propsKeys.length}) 🔒</div>`;
  html += `<div style="margin-left: 0; margin-top: 8px; font-size: 10px; display: none;">`;

  propsKeys.forEach((key) => {
    const value = formatValue(props[key]);
    html += `<div style="margin: 6px 0; padding: 6px; background: rgba(255,255,255,0.02); border-radius: 3px;">`;
    html += `<div style="display: flex; align-items: start; gap: 8px;">`;
    html += `<span style="color: #ce93d8; font-weight: bold; min-width: 60px;">${escapeHtml(key)}:</span>`;
    html += `<span style="flex: 1; word-break: break-all; color: #ffb74d; opacity: 0.7;" title="Read-only. Edit parent state above to change this.">${value}</span>`;
    html += `</div></div>`;
  });

  html += `</div>`;
  return html;
}

/**
 * Format state section
 */
function formatState(state) {
  if (!state || typeof state !== 'object' || Object.keys(state).length === 0) return '';

  const stateKeys = Object.keys(state);
  let html = `<div class="toggle-section" style="color: #ab47bc; margin-top: 12px; font-weight: bold; padding: 6px 0; border-bottom: 1px solid rgba(171,71,188,0.3); cursor: pointer;">▶ State (${stateKeys.length}) ✏️</div>`;
  html += `<div style="margin-left: 0; margin-top: 8px; font-size: 10px; display: none;">`;

  stateKeys.forEach((key) => {
    let displayValue = formatStateValue(state[key]);
    html += `<div style="margin: 6px 0; padding: 6px; background: rgba(255,255,255,0.02); border-radius: 3px;">`;
    html += `<div style="color: #ce93d8; font-weight: bold; margin-bottom: 4px;">${escapeHtml(key)}:</div>`;
    html += `<div class="editable-state" data-state-key="${escapeHtml(key)}" contenteditable="true" spellcheck="false" style="color: #ba68c8; font-size: 11px; white-space: pre-wrap; padding: 8px; background: rgba(0,0,0,0.3); border: 1px solid transparent; border-radius: 3px; cursor: text; font-family: 'Courier New', monospace; transition: all 0.2s; max-height: 400px; overflow-y: auto; scrollbar-width: thin; scrollbar-color: rgba(171,71,188,0.5) rgba(0,0,0,0.3);" title="Edit directly (Enter to save, Esc to cancel)">${escapeHtml(displayValue)}</div>`;
    html += `</div>`;
  });

  html += `</div>`;
  return html;
}

/**
 * Format hooks section
 */
function formatHooks(hooks) {
  if (!hooks || hooks.length === 0) return '';

  let html = `<div class="toggle-section" style="color: #66bb6a; margin-top: 12px; font-weight: bold; padding: 6px 0; border-bottom: 1px solid rgba(102,187,106,0.3); cursor: pointer;">▶ Hooks (${hooks.length}) ✏️</div>`;
  html += `<div style="margin-left: 0; margin-top: 8px; font-size: 10px; display: none;">`;

  hooks.forEach((hook, i) => {
    let displayValue = formatStateValue(hook.value);
    html += `<div style="margin: 6px 0; padding: 6px; background: rgba(255,255,255,0.02); border-radius: 3px;">`;
    html += `<div style="color: #81c784; font-weight: bold; margin-bottom: 4px;">Hook ${i}:</div>`;
    html += `<div class="editable-hook" data-hook-index="${i}" contenteditable="true" spellcheck="false" style="color: #a5d6a7; font-size: 11px; white-space: pre-wrap; padding: 8px; background: rgba(0,0,0,0.3); border: 1px solid transparent; border-radius: 3px; cursor: text; font-family: 'Courier New', monospace; transition: all 0.2s; max-height: 400px; overflow-y: auto; scrollbar-width: thin; scrollbar-color: rgba(102,187,106,0.5) rgba(0,0,0,0.3);" title="Edit directly (Enter to save, Esc to cancel)">${escapeHtml(displayValue)}</div>`;
    html += `</div>`;
  });

  html += `</div>`;
  return html;
}

/**
 * Format state/hook value for display
 */
function formatStateValue(value) {
  if (typeof value === 'string') {
    return `"${value}"`;
  } else if (value === null) {
    return 'null';
  } else if (value === undefined) {
    return 'undefined';
  } else if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  } else {
    try {
      return JSON.stringify(value, null, 2);
    } catch (err) {
      return '{Object}';
    }
  }
}

/**
 * Format CSS section (imported from separate module)
 */
function formatCSSSection(css) {
  return formatCSS(css);
}

/**
 * Format footer
 */
function formatFooter(pinned) {
  return `<div style="margin-top: 14px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.1); color: #666; font-size: 9px; text-align: center;">
    Alt+Shift+C to toggle • Alt+Click to ${pinned ? 'unpin' : 'pin'}
  </div>`;
}
