/**
 * HTML mode helpers - for detecting and displaying plain HTML elements
 */

/**
 * Get basic HTML element information (no framework detection)
 * @param {HTMLElement} element - DOM element to inspect
 * @returns {Object} HTML element information
 */
export function getHtmlElementInfo(element) {
  if (!element || !(element instanceof HTMLElement)) {
    return null;
  }

  const tagName = element.tagName.toLowerCase();
  const attributes = {};

  // Get all attributes
  for (const attr of element.attributes) {
    attributes[attr.name] = attr.value;
  }

  // Get computed styles
  const computedStyles = window.getComputedStyle(element);
  const styles = {
    display: computedStyles.display || '',
    position: computedStyles.position || '',
    width: computedStyles.width || '',
    height: computedStyles.height || '',
    margin: computedStyles.margin || '',
    padding: computedStyles.padding || '',
    backgroundColor: computedStyles.backgroundColor || '',
    color: computedStyles.color || '',
    fontSize: computedStyles.fontSize || '',
    fontFamily: computedStyles.fontFamily || '',
    border: computedStyles.border || '',
    borderRadius: computedStyles.borderRadius || '',
    flexDirection: computedStyles.flexDirection || '',
    justifyContent: computedStyles.justifyContent || '',
    alignItems: computedStyles.alignItems || '',
    gridTemplateColumns: computedStyles.gridTemplateColumns || '',
    zIndex: computedStyles.zIndex || '',
  };

  // Get CSS classes
  const classes = Array.from(element.classList);

  // Get inline styles
  const inlineStyles = element.style.cssText || '';

  // Find matched CSS rules
  const matchedRules = [];
  try {
    for (const sheet of document.styleSheets) {
      try {
        for (const rule of sheet.cssRules || []) {
          if (rule instanceof CSSStyleRule) {
            try {
              if (element.matches(rule.selectorText)) {
                matchedRules.push({
                  selector: rule.selectorText,
                  source: sheet.href || 'inline',
                  styles: rule.style.cssText,
                });
              }
            } catch (e) {
              // Invalid selector, skip
            }
          }
        }
      } catch (e) {
        // Cross-origin stylesheet, skip
      }
    }
  } catch (e) {
    // Silent fail
  }

  // Get element hierarchy (parent elements)
  const hierarchy = [];
  let current = element;
  let depth = 0;
  const maxDepth = 5;

  while (current && current.parentElement && depth < maxDepth) {
    current = current.parentElement;
    const parentTag = current.tagName.toLowerCase();
    const parentId = current.id ? `#${current.id}` : '';
    const parentClasses =
      current.classList.length > 0 ? `.${Array.from(current.classList).join('.')}` : '';
    hierarchy.push(`${parentTag}${parentId}${parentClasses}`);
    depth++;
  }

  // Get text content (limited)
  let textContent = element.textContent?.trim() || '';
  if (textContent.length > 100) {
    textContent = textContent.substring(0, 100) + '...';
  }

  // Get child elements count
  const childElementsCount = element.children.length;

  return {
    framework: 'HTML',
    name: tagName.toUpperCase(),
    tagName: tagName,
    id: element.id || null,
    classes: classes,
    attributes: attributes,
    styles: styles,
    inlineStyles: inlineStyles,
    matchedRules: matchedRules,
    hierarchy: hierarchy,
    textContent: textContent,
    childElementsCount: childElementsCount,
    isCustomElement: tagName.includes('-'),
    detail: `${tagName}${element.id ? `#${element.id}` : ''}${classes.length > 0 ? `.${classes.join('.')}` : ''}`,
  };
}

/**
 * Format HTML element info for display
 * @param {Object} info - HTML element information
 * @param {boolean} pinned - Whether panel is pinned
 * @returns {string} Formatted HTML string
 */
export function formatHtmlElementInfo(info, pinned = false) {
  if (!info) return '';

  let html = '';

  // Header
  html += `<div style="margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.1);">`;
  html += `<div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">`;
  html += `<strong style="color: #ff9800; font-size: 14px;">&lt;${escapeHtml(info.tagName)}&gt;</strong>`;
  html += `<span style="background: #2196f3; color: white; padding: 2px 6px; border-radius: 3px; font-size: 9px; font-weight: bold;">HTML</span>`;

  if (pinned) {
    html += `<span style="background: #4caf50; color: white; padding: 2px 6px; border-radius: 3px; font-size: 9px;">📍 PINNED</span>`;
  }

  html += `</div>`;
  html += `<div style="color: #888; font-size: 10px;">Plain HTML Element</div>`;

  if (info.detail) {
    html += `<div style="color: #64b5f6; font-size: 10px; margin-top: 4px; word-break: break-all;">${escapeHtml(info.detail)}</div>`;
  }

  html += `</div>`;

  // Hierarchy
  if (info.hierarchy && info.hierarchy.length > 0) {
    html += `<div style="margin-bottom: 12px; padding: 8px; background: rgba(255,255,255,0.03); border-radius: 4px;">`;
    html += `<div class="toggle-section" style="color: #888; font-size: 9px; margin-bottom: 0px; cursor: pointer;">▶ Parent Elements (${info.hierarchy.length})</div>`;
    html += `<div style="font-size: 10px; color: #90caf9; display: none; margin-top: 4px;">`;
    info.hierarchy.forEach((parent, i) => {
      const indent = '  '.repeat(i);
      html += `<div style="margin: 2px 0;">${indent}└─ ${escapeHtml(parent)}</div>`;
    });
    html += `</div></div>`;
  }

  // Attributes
  if (info.attributes && Object.keys(info.attributes).length > 0) {
    const attrKeys = Object.keys(info.attributes).filter((k) => k !== 'class' && k !== 'style');
    if (attrKeys.length > 0) {
      html += `<div class="toggle-section" style="color: #ffa726; margin-top: 12px; font-weight: bold; padding: 6px 0; border-bottom: 1px solid rgba(255,167,38,0.3); cursor: pointer;">▶ Attributes (${attrKeys.length}) ✏️</div>`;
      html += `<div style="margin-left: 0; margin-top: 8px; font-size: 10px; display: none;">`;

      attrKeys.forEach((key) => {
        const value = info.attributes[key];
        html += `<div style="margin: 6px 0; padding: 6px; background: rgba(255,255,255,0.02); border-radius: 3px;">`;
        html += `<div style="color: #ce93d8; font-weight: bold; margin-bottom: 4px;">${escapeHtml(key)}:</div>`;
        html += `<div data-editable-attribute data-attribute-name="${escapeHtml(key)}" contenteditable="false" style="color: #a5d6a7; word-break: break-all; padding: 6px; background: rgba(0,0,0,0.2); border-radius: 3px; cursor: text; font-family: 'Courier New', monospace;" title="Click to edit (Enter to save, Esc to cancel)">"${escapeHtml(value)}"</div>`;
        html += `</div>`;
      });

      html += `</div>`;
    }
  }

  // Text Content
  if (info.textContent && info.textContent.length > 0) {
    html += `<div class="toggle-section" style="color: #81c784; margin-top: 12px; font-weight: bold; padding: 6px 0; border-bottom: 1px solid rgba(129,199,132,0.3); cursor: pointer;">▶ Text Content ✏️</div>`;
    html += `<div style="margin-left: 0; margin-top: 8px; font-size: 10px; display: none;">`;
    html += `<div data-editable-text-content contenteditable="false" spellcheck="false" style="padding: 8px; background: rgba(0,0,0,0.3); border-radius: 3px; color: #a5d6a7; word-break: break-word; cursor: text; font-family: 'Courier New', monospace; max-height: 200px; overflow-y: auto;" title="Click to edit (Enter to save, Esc to cancel)">${escapeHtml(info.textContent)}</div>`;
    html += `</div>`;
  }

  // Child Elements
  if (info.childElementsCount > 0) {
    html += `<div style="margin-top: 12px; padding: 8px; background: rgba(255,255,255,0.03); border-radius: 4px;">`;
    html += `<div style="color: #888; font-size: 10px;">Children: <span style="color: #90caf9; font-weight: bold;">${info.childElementsCount}</span> element${info.childElementsCount !== 1 ? 's' : ''}</div>`;
    html += `</div>`;
  }

  // CSS (use existing CSS formatter)
  html += formatCSSSection({
    classes: info.classes,
    styles: info.styles,
    inlineStyles: info.inlineStyles,
    matchedRules: info.matchedRules,
  });

  // Footer
  html += `<div style="margin-top: 14px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.1); color: #666; font-size: 9px; text-align: center;">`;
  html += `Alt+Shift+C to toggle • Alt+Click to ${pinned ? 'unpin' : 'pin'}`;
  html += `</div>`;

  return html;
}

/**
 * Format CSS section (similar to React formatter)
 */
function formatCSSSection(css) {
  if (!css) return '';

  let html = '';

  // Classes
  if (css.classes && css.classes.length > 0) {
    html += `<div class="toggle-section" style="color: #64b5f6; margin-top: 12px; font-weight: bold; padding: 6px 0; border-bottom: 1px solid rgba(100,181,246,0.3); cursor: pointer;">`;
    html += `▶ Classes (${css.classes.length}) ✏️</div>`;
    html += `<div style="margin-left: 0; margin-top: 8px; font-size: 10px; display: none;">`;

    css.classes.forEach((className) => {
      html += `<div style="margin: 4px 0; padding: 6px; background: rgba(255,255,255,0.02); border-radius: 3px; display: flex; align-items: center; gap: 8px;">`;
      html += `<span class="hovercomp-toggle-class" data-class="${escapeHtml(className)}" data-active="true" style="cursor: pointer; padding: 4px 8px; border-radius: 3px; background: rgba(66,165,245,0.2); color: #90caf9; flex: 1; transition: all 0.2s;">✓ ${escapeHtml(className)}</span>`;
      html += `</div>`;
    });

    // Add class button
    html += `<div style="margin-top: 8px; padding: 8px; background: rgba(100,181,246,0.1); border-radius: 3px;">`;
    html += `<div style="display: flex; gap: 4px;">`;
    html += `<input type="text" class="add-class-input" placeholder="new-class-name" style="flex: 1; background: rgba(0,0,0,0.5); border: 1px solid rgba(100,181,246,0.3); color: white; padding: 4px 8px; border-radius: 3px; font-size: 10px; font-family: monospace;">`;
    html += `<button class="add-class-btn" style="background: #64b5f6; color: white; border: none; padding: 4px 12px; border-radius: 3px; cursor: pointer; font-size: 10px; font-weight: bold;">Add</button>`;
    html += `</div></div>`;

    html += `</div>`;
  }

  // Inline Styles
  if (css.inlineStyles) {
    html += `<div class="toggle-section" style="color: #ab47bc; margin-top: 12px; font-weight: bold; padding: 6px 0; border-bottom: 1px solid rgba(171,71,188,0.3); cursor: pointer;">`;
    html += `▶ Inline Styles ✏️</div>`;
    html += `<div style="margin-left: 0; margin-top: 8px; font-size: 10px; display: none;">`;

    if (css.inlineStyles.length > 0) {
      const styleProps = css.inlineStyles.split(';').filter((s) => s.trim());
      styleProps.forEach((prop) => {
        const [key, ...valueParts] = prop.split(':');
        const value = valueParts.join(':').trim();
        if (key && value) {
          html += `<div style="margin: 4px 0; padding: 6px; background: rgba(255,255,255,0.02); border-radius: 3px;">`;
          html += `<span class="hovercomp-toggle-style" data-style-prop="${escapeHtml(key.trim())}" data-style-value="${escapeHtml(value)}" data-active="true" style="cursor: pointer; padding: 4px 8px; border-radius: 3px; background: rgba(144,202,249,0.2); display: inline-block; transition: all 0.2s;">`;
          html += `<span style="color: #ce93d8;">${escapeHtml(key.trim())}:</span> `;
          html += `<span style="color: #ba68c8;">${escapeHtml(value)}</span>`;
          html += `</span>`;
          html += `</div>`;
        }
      });
    }

    // Add style button
    html += `<div style="margin-top: 8px; padding: 8px; background: rgba(171,71,188,0.1); border-radius: 3px;">`;
    html += `<div style="display: flex; gap: 4px; margin-bottom: 4px;">`;
    html += `<input type="text" class="add-style-prop-input" placeholder="property" style="flex: 1; background: rgba(0,0,0,0.5); border: 1px solid rgba(171,71,188,0.3); color: white; padding: 4px 8px; border-radius: 3px; font-size: 10px; font-family: monospace;">`;
    html += `<input type="text" class="add-style-value-input" placeholder="value" style="flex: 2; background: rgba(0,0,0,0.5); border: 1px solid rgba(171,71,188,0.3); color: white; padding: 4px 8px; border-radius: 3px; font-size: 10px; font-family: monospace;">`;
    html += `<button class="add-style-btn" style="background: #ab47bc; color: white; border: none; padding: 4px 12px; border-radius: 3px; cursor: pointer; font-size: 10px; font-weight: bold;">Add</button>`;
    html += `</div></div>`;

    html += `</div>`;
  }

  // Computed Styles
  if (css.styles && Object.keys(css.styles).length > 0) {
    const styleKeys = Object.keys(css.styles).filter(
      (k) => css.styles[k] && css.styles[k] !== 'none' && css.styles[k] !== 'auto'
    );
    if (styleKeys.length > 0) {
      html += `<div class="toggle-section" style="colo ✏️</div>`;
      html += `<div style="margin-left: 0; margin-top: 8px; font-size: 10px; display: none;">`;

      styleKeys.forEach((key) => {
        const value = css.styles[key];
        html += `<div style="margin: 4px 0; padding: 6px; background: rgba(255,255,255,0.02); border-radius: 3px;">`;
        html += `<span class="hovercomp-computed-style-item" data-style-prop="${escapeHtml(key)}" data-style-value="${escapeHtml(value)}" data-active="true" style="cursor: pointer; padding: 4px 8px; border-radius: 3px; background: rgba(77,182,172,0.2); display: inline-block; transition: all 0.2s;">`;
        html += `<span style="color: #4db6ac; font-weight: bold;">${escapeHtml(key)}:</span> `;
        html += `<span style="color: #80cbc4; word-break: break-all;">${escapeHtml(value)}</span>`;
        html += `n> `;
        html += `<span style="color: #80cbc4; word-break: break-all;">${escapeHtml(value)}</span>`;
        html += `</div>`;
      });

      html += `</div>`;
    }
  }

  return html;
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text) {
  if (typeof text !== 'string') return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
