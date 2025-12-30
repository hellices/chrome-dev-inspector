/**
 * CSS section formatting for the overlay panel
 */

import { escapeHtml } from '../utils/domHelpers.js';
import { CSS_CLASSES } from '../config/constants.js';

/**
 * Format CSS section
 * @param {Object} css - CSS information
 * @returns {string} HTML string
 */
export function formatCSS(css) {
  if (!css) return '';

  const hasClasses = css.classes && css.classes.length > 0;
  const hasInlineStyles = css.inlineStyles && css.inlineStyles.trim().length > 0;
  const hasMatchedRules = css.matchedRules && css.matchedRules.length > 0;

  if (!hasClasses && !hasInlineStyles && !hasMatchedRules) return '';

  let html = `<div class="${CSS_CLASSES.TOGGLE_SECTION}" style="color: #42a5f5; margin-top: 12px; font-weight: bold; padding: 6px 0; border-bottom: 1px solid rgba(66,165,245,0.3); cursor: pointer;">▶ CSS</div>`;
  html += `<div style="margin-left: 0; margin-top: 8px; font-size: 10px; display: none;">`;

  if (hasClasses) {
    html += formatClasses(css.classes);
  }

  if (hasInlineStyles) {
    html += formatInlineStyles(css.inlineStyles);
  } else {
    html += formatEmptyInlineStyles();
  }

  html += formatAppliedStyles(css.styles);

  if (hasMatchedRules) {
    html += formatMatchedRules(css.matchedRules);
  }

  html += `</div>`;
  return html;
}

/**
 * Format CSS classes section
 */
function formatClasses(classes) {
  let html = `<div style="margin: 6px 0; padding: 6px; background: rgba(255,255,255,0.02); border-radius: 3px;">`;
  html += `<span style="color: #64b5f6; font-weight: bold;">Classes:</span><br/>`;
  html += `<div style="margin-top: 4px; color: #90caf9;">`;

  classes.forEach((className) => {
    html += `<span class="${CSS_CLASSES.TOGGLE_CLASS}" data-class="${escapeHtml(className)}" data-active="true" `;
    html += `style="background: rgba(66,165,245,0.2); padding: 2px 6px 2px 6px; border-radius: 2px; margin: 2px; display: inline-flex; align-items: center; gap: 4px; cursor: pointer; transition: all 0.2s;" `;
    html += `title="Click to disable/enable" onmouseover="this.style.opacity='0.7'" onmouseout="this.style.opacity='1'">`;
    html += `<span>${escapeHtml(className)}</span>`;
    html += `<span class="${CSS_CLASSES.DELETE_CLASS}" data-class="${escapeHtml(className)}" `;
    html += `style="color: #ff5252; font-weight: bold; font-size: 11px; line-height: 1; padding: 0 2px;" title="Delete" onclick="event.stopPropagation();">×</span>`;
    html += `</span>`;
  });

  html += `</div>`;
  html += `<button class="${CSS_CLASSES.ADD_CLASS}" style="background: #1976d2; color: #fff; border: none; padding: 3px 8px; border-radius: 3px; font-size: 9px; cursor: pointer; margin-top: 4px;">+ Add Class</button>`;
  html += `</div>`;

  return html;
}

/**
 * Format inline styles section
 */
function formatInlineStyles(inlineStyles) {
  let html = `<div style="margin: 6px 0; padding: 6px; background: rgba(255,255,255,0.02); border-radius: 3px;">`;
  html += `<span style="color: #64b5f6; font-weight: bold;">Inline Styles:</span><br/>`;

  const styleProps = inlineStyles.split(';').filter((s) => s.trim());
  html += `<div style="margin-top: 4px; display: flex; flex-wrap: wrap; gap: 4px;">`;

  styleProps.forEach((prop) => {
    const colonIndex = prop.indexOf(':');
    if (colonIndex > 0) {
      const key = prop.substring(0, colonIndex).trim();
      const value = prop.substring(colonIndex + 1).trim();
      if (key && value) {
        const isImportant = value.includes('!important');
        const escapedKey = escapeHtml(key);
        const escapedValue = escapeHtml(value);

        html += `<span class="${CSS_CLASSES.TOGGLE_STYLE}" data-style-prop="${escapedKey}" data-style-value="${escapedValue}" `;
        html += `data-use-important="${isImportant}" data-active="true" `;
        html += `style="background: rgba(144,202,249,0.2); padding: 3px 8px 3px 8px; border-radius: 3px; font-size: 10px; cursor: pointer; transition: all 0.2s; color: #90caf9; display: inline-flex; align-items: center; gap: 4px;" `;
        html += `title="Click to disable/enable, Right-click to toggle !important" onmouseover="this.style.opacity='0.7'" onmouseout="this.style.opacity='1'">`;
        html += `<span><span style="color: #64b5f6; font-weight: bold;">${escapedKey}</span>: ${escapedValue}</span>`;
        html += `<span class="${CSS_CLASSES.DELETE_STYLE}" data-style-prop="${escapedKey}" `;
        html += `style="color: #ff5252; font-weight: bold; font-size: 12px; line-height: 1; padding: 0 2px;" title="Delete" onclick="event.stopPropagation();">×</span>`;
        html += `</span>`;
      }
    }
  });

  html += `</div>`;
  html += `<button class="${CSS_CLASSES.ADD_INLINE_STYLE}" style="background: #1976d2; color: #fff; border: none; padding: 3px 8px; border-radius: 3px; font-size: 9px; cursor: pointer; margin-top: 6px;">+ Add Style (Shift+Enter for !important)</button>`;
  html += `</div>`;

  return html;
}

/**
 * Format empty inline styles section
 */
function formatEmptyInlineStyles() {
  let html = `<div style="margin: 6px 0; padding: 6px; background: rgba(255,255,255,0.02); border-radius: 3px;">`;
  html += `<span style="color: #64b5f6; font-weight: bold;">Inline Styles:</span><br/>`;
  html += `<button class="${CSS_CLASSES.ADD_INLINE_STYLE}" style="background: #1976d2; color: #fff; border: none; padding: 3px 8px; border-radius: 3px; font-size: 9px; cursor: pointer; margin-top: 4px;">+ Add Style (Shift+Enter for !important)</button>`;
  html += `</div>`;
  return html;
}

/**
 * Format applied/computed styles section
 */
function formatAppliedStyles(styles) {
  let html = `<div style="margin: 6px 0; padding: 6px; background: rgba(255,255,255,0.02); border-radius: 3px;">`;
  html += `<div class="${CSS_CLASSES.TOGGLE_SECTION}" style="color: #64b5f6; font-weight: bold; cursor: pointer; margin-bottom: 0px;">▶ Applied Styles</div>`;
  html += `<div class="computed-styles-content" style="display: none; margin-top: 8px; max-height: 50vh; overflow-y: auto; font-size: 9px; font-family: monospace; scrollbar-width: thin; scrollbar-color: rgba(100,181,246,0.3) rgba(0,0,0,0.2);">`;

  const computedStyles = [
    'display',
    'position',
    'width',
    'height',
    'margin',
    'padding',
    'background-color',
    'color',
    'font-size',
    'font-family',
    'font-weight',
    'border',
    'border-radius',
    'flex-direction',
    'justify-content',
    'align-items',
    'grid-template-columns',
    'z-index',
    'opacity',
    'overflow',
    'text-align',
    'line-height',
    'box-sizing',
    'cursor',
    'pointer-events',
    'transform',
    'transition',
  ];

  computedStyles.forEach((prop) => {
    const value = styles[prop] || styles[prop.replace(/-([a-z])/g, (g) => g[1].toUpperCase())];
    if (value) {
      html += `<div class="${CSS_CLASSES.COMPUTED_STYLE_ITEM}" data-style-prop="${escapeHtml(prop)}" data-style-value="${escapeHtml(value)}" data-active="true" `;
      html += `style="padding: 2px 4px; border-bottom: 1px solid rgba(255,255,255,0.05); cursor: pointer; transition: all 0.2s;" `;
      html += `title="Click to disable/enable" onmouseover="this.style.background='rgba(100,181,246,0.1)'" onmouseout="this.style.background='transparent'">`;
      html += `<span style="color: #ce93d8;">${escapeHtml(prop)}</span>: <span style="color: #a5d6a7;">${escapeHtml(value)}</span>`;
      html += `</div>`;
    }
  });

  html += `</div></div>`;
  return html;
}

/**
 * Format matched CSS rules section
 */
function formatMatchedRules(matchedRules) {
  let html = `<div style="margin: 6px 0; padding: 6px; background: rgba(255,255,255,0.02); border-radius: 3px;">`;
  html += `<div class="${CSS_CLASSES.TOGGLE_SECTION}" style="color: #64b5f6; font-weight: bold; cursor: pointer; margin-bottom: 0px;">▶ Matched CSS Rules (${matchedRules.length})</div>`;
  html += `<div class="matched-rules-content" style="display: none; margin-top: 8px; max-height: 50vh; overflow-y: auto; scrollbar-width: thin; scrollbar-color: rgba(100,181,246,0.3) rgba(0,0,0,0.2);">`;

  matchedRules.forEach((rule, i) => {
    const source = rule.source === 'inline' ? 'inline' : rule.source.split('/').pop();
    html += `<div style="margin: 8px 0; padding: 6px; background: rgba(0,0,0,0.3); border-left: 2px solid #42a5f5; border-radius: 2px;">`;
    html += `<div style="color: #ffb74d; font-size: 10px; margin-bottom: 4px;">${escapeHtml(rule.selector)}</div>`;
    html += `<div style="color: #666; font-size: 8px; margin-bottom: 4px;">${escapeHtml(source)}</div>`;
    html += `<div style="color: #90caf9; font-size: 9px; font-family: monospace; white-space: pre-wrap;">${escapeHtml(rule.styles)}</div>`;
    html += `</div>`;
  });

  html += `</div></div>`;
  return html;
}
