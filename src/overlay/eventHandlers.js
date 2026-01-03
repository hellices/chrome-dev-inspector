/**
 * Event handlers for overlay interactions
 */

import { CSS_CLASSES } from '../config/constants.js';
import { getXPath } from '../utils/domHelpers.js';
import {
  invalidateCache,
  requestComponentInfo,
  updateHook,
  updateState,
} from '../utils/messageHandler.js';
import {
  toggleClass,
  applyInlineStyle,
  removeInlineStyle,
  getDisabledValue,
} from '../utils/cssHelper.js';

/**
 * Setup editable element handlers (generic)
 * @param {HTMLElement} editableElement - Editable element
 * @param {string} originalValue - Original value
 * @param {Object} config - Configuration object
 */
function setupEditableElementHandlers(editableElement, originalValue, config) {
  const {
    focusStyles = {},
    blurStyles = {},
    onValueChange,
  } = config;

  editableElement.setAttribute('contenteditable', 'true');
  editableElement.setAttribute('spellcheck', 'false');

  editableElement.onfocus = (e) => {
    e.stopPropagation();
    Object.assign(editableElement.style, focusStyles);
    selectAllText(editableElement);
  };

  editableElement.onblur = (e) => {
    Object.assign(editableElement.style, blurStyles);

    const newValue = editableElement.textContent.trim();
    if (newValue !== originalValue && onValueChange) {
      onValueChange(newValue);
    }
  };

  editableElement.onkeydown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      editableElement.blur();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      editableElement.textContent = originalValue;
      editableElement.blur();
    }
    e.stopPropagation();
  };

  editableElement.onclick = (e) => e.stopPropagation();
}

/**
 * Setup editable hook handlers
 * @param {HTMLElement} panel - Panel element
 * @param {HTMLElement} element - Target element
 */
export function setupEditableHookHandlers(panel, element) {
  if (!panel || !element) return;
  
  panel.querySelectorAll(`.${CSS_CLASSES.EDITABLE_HOOK}`).forEach((span) => {
    const originalValue = span.textContent;

    setupEditableElementHandlers(span, originalValue, {
      focusStyles: {
        background: 'rgba(76,175,80,0.5)',
        outline: '2px solid #4caf50',
        boxShadow: '0 0 8px rgba(76,175,80,0.4)',
      },
      blurStyles: {
        background: 'rgba(102,187,106,0.1)',
        outline: 'none',
        boxShadow: 'none',
      },
      onValueChange: (newValue) => {
        const hookIndex = parseInt(span.getAttribute('data-hook-index'));
        updateHook(element, hookIndex, newValue);
      },
    });
  });
}

/**
 * Setup editable state handlers
 * @param {HTMLElement} panel - Panel element
 * @param {HTMLElement} element - Target element
 */
export function setupEditableStateHandlers(panel, element) {
  if (!panel || !element) return;
  
  panel.querySelectorAll(`.${CSS_CLASSES.EDITABLE_STATE}`).forEach((div) => {
    const originalValue = div.textContent;

    setupEditableElementHandlers(div, originalValue, {
      focusStyles: {
        background: 'rgba(171,71,188,0.5)',
        outline: '2px solid #ab47bc',
        boxShadow: '0 0 8px rgba(171,71,188,0.4)',
      },
      blurStyles: {
        background: 'rgba(0,0,0,0.3)',
        outline: 'none',
        boxShadow: 'none',
      },
      onValueChange: (newValue) => {
        const stateKey = div.getAttribute('data-state-key');
        updateState(element, stateKey, newValue);
      },
    });
  });
}

/**
 * Setup CSS class toggle handlers
 * @param {HTMLElement} panel - Panel element
 * @param {HTMLElement} element - Target element
 * @param {Function} refreshCallback - Callback to refresh overlay
 */
export function setupClassToggleHandlers(panel, element, refreshCallback) {
  if (!panel || !element) return;
  
  // Support both old and new class names
  const selectors = [`.${CSS_CLASSES.TOGGLE_CLASS}`, '.hovercomp-toggle-class'];
  selectors.forEach((selector) => {
    panel.querySelectorAll(selector).forEach((span) => {
      span.onclick = (e) => {
        e.stopPropagation();
        const className = span.getAttribute('data-class');
        const isActive = span.getAttribute('data-active') === 'true';

        toggleClass(element, className, !isActive);

        span.setAttribute('data-active', (!isActive).toString());
        span.style.textDecoration = isActive ? 'line-through' : 'none';
        span.style.opacity = isActive ? '0.5' : '1';
        span.style.background = isActive ? 'rgba(255,255,255,0.05)' : 'rgba(66,165,245,0.2)';

        // Update checkmark for new style
        if (selector === '.hovercomp-toggle-class') {
          const text = span.textContent;
          if (isActive) {
            span.textContent = text.replace('✓ ', '✗ ');
          } else {
            span.textContent = text.replace('✗ ', '✓ ');
          }
        }
      };
    });
  });

  panel.querySelectorAll(`.${CSS_CLASSES.DELETE_CLASS}`).forEach((deleteBtn) => {
    deleteBtn.onclick = (e) => {
      e.stopPropagation();
      const className = deleteBtn.getAttribute('data-class');
      element.classList.remove(className);
      deleteBtn.parentElement.remove();
      refreshCallback(element);
    };
  });
}

/**
 * Setup inline style toggle handlers
 * @param {HTMLElement} panel - Panel element
 * @param {HTMLElement} element - Target element
 * @param {Function} refreshCallback - Callback to refresh overlay
 */
export function setupStyleToggleHandlers(panel, element, refreshCallback) {
  if (!panel || !element) return;
  
  panel.querySelectorAll(`.${CSS_CLASSES.TOGGLE_STYLE}`).forEach((span) => {
    span.onclick = (e) => {
      e.stopPropagation();
      const styleProp = span.getAttribute('data-style-prop');
      const styleValue = span.getAttribute('data-style-value');
      const isActive = span.getAttribute('data-active') === 'true';
      const isImportant =
        span.getAttribute('data-use-important') === 'true' || styleValue.includes('!important');

      if (isActive) {
        removeInlineStyle(element, styleProp);
        span.setAttribute('data-active', 'false');
        span.style.textDecoration = 'line-through';
        span.style.opacity = '0.5';
        span.style.background = 'rgba(255,255,255,0.05)';
      } else {
        applyInlineStyle(element, styleProp, styleValue, isImportant);
        span.setAttribute('data-active', 'true');
        span.style.textDecoration = 'none';
        span.style.opacity = '1';
        span.style.background = 'rgba(144,202,249,0.2)';
      }
    };

    // Right-click to toggle !important
    span.oncontextmenu = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const styleProp = span.getAttribute('data-style-prop');
      const styleValue = span.getAttribute('data-style-value');
      const isImportant =
        span.getAttribute('data-use-important') === 'true' || styleValue.includes('!important');
      const cleanValue = styleValue.replace('!important', '').trim();

      if (isImportant) {
        element.style.setProperty(styleProp, cleanValue);
        span.setAttribute('data-use-important', 'false');
        span.setAttribute('data-style-value', cleanValue);
        const firstSpan = span.querySelector('span:first-child');
        if (firstSpan) {
          firstSpan.innerHTML = `<span style="color: #64b5f6; font-weight: bold;">${styleProp}</span>: ${cleanValue}`;
        }
      } else {
        element.style.setProperty(styleProp, cleanValue, 'important');
        span.setAttribute('data-use-important', 'true');
        span.setAttribute('data-style-value', cleanValue + ' !important');
        const firstSpan = span.querySelector('span:first-child');
        if (firstSpan) {
          firstSpan.innerHTML = `<span style="color: #64b5f6; font-weight: bold;">${styleProp}</span>: ${cleanValue + ' !important'}`;
        }
      }
    };
  });

  panel.querySelectorAll(`.${CSS_CLASSES.DELETE_STYLE}`).forEach((deleteBtn) => {
    deleteBtn.onclick = (e) => {
      e.stopPropagation();
      const styleProp = deleteBtn.getAttribute('data-style-prop');
      removeInlineStyle(element, styleProp);
      deleteBtn.parentElement.remove();
      setTimeout(() => refreshCallback(element), 50);
    };
  });
}

/**
 * Setup computed style toggle handlers
 * @param {HTMLElement} panel - Panel element
 * @param {HTMLElement} element - Target element
 */
export function setupComputedStyleHandlers(panel, element) {
  if (!panel || !element) return;
  
  // Support both old and new class names
  const selectors = [`.${CSS_CLASSES.COMPUTED_STYLE_ITEM}`, '.hovercomp-computed-style-item'];
  selectors.forEach((selector) => {
    panel.querySelectorAll(selector).forEach((item) => {
      item.onclick = (e) => {
        e.stopPropagation();
        const styleProp = item.getAttribute('data-style-prop');
        const styleValue = item.getAttribute('data-style-value');
        const isActive = item.getAttribute('data-active') === 'true';

        if (isActive) {
          // Disable by setting to opposite or neutral value with !important
          const disabledValue = getDisabledValue(styleProp);
          element.style.setProperty(styleProp, disabledValue, 'important');
          item.setAttribute('data-active', 'false');
          item.setAttribute('data-disabled-value', disabledValue);
          item.style.textDecoration = 'line-through';
          item.style.opacity = '0.5';
          item.style.background = 'rgba(255,255,255,0.05)';
        } else {
          // Enable by removing our override (let original styles apply)
          element.style.removeProperty(styleProp);
          item.setAttribute('data-active', 'true');
          item.style.textDecoration = 'none';
          item.style.opacity = '1';
          item.style.background =
            selector === '.hovercomp-computed-style-item' ? 'rgba(77,182,172,0.2)' : 'transparent';
        }
      };
    });
  });
}

/**
 * Setup toggle section handlers (expand/collapse)
 * @param {HTMLElement} panel - Panel element
 * @param {Object} expandedSections - Expanded sections state
 * @param {Function} adjustPositionCallback - Callback to adjust panel position
 */
export function setupToggleSectionHandlers(panel, expandedSections, adjustPositionCallback) {
  if (!panel || !expandedSections) return;
  
  panel.querySelectorAll(`.${CSS_CLASSES.TOGGLE_SECTION}`).forEach((toggle) => {
    toggle.style.cursor = 'pointer';
    toggle.onclick = (e) => {
      e.stopPropagation();
      const content = toggle.nextElementSibling;
      const isCollapsed = content.style.display === 'none';
      content.style.display = isCollapsed ? 'block' : 'none';
      toggle.textContent = toggle.textContent.replace(
        isCollapsed ? '▶' : '▼',
        isCollapsed ? '▼' : '▶'
      );

      updateExpandedSectionsState(toggle, isCollapsed, expandedSections);

      if (isCollapsed) {
        setTimeout(() => adjustPositionCallback(), 10);
      }
    };
  });
}

/**
 * Update expanded sections state
 */
function updateExpandedSectionsState(toggle, isExpanded, expandedSections) {
  const sectionText = toggle.textContent.toLowerCase();
  if (sectionText.includes('css')) expandedSections.css = isExpanded;
  else if (sectionText.includes('props')) expandedSections.props = isExpanded;
  else if (sectionText.includes('state')) expandedSections.state = isExpanded;
  else if (sectionText.includes('hooks')) expandedSections.hooks = isExpanded;
  else if (sectionText.includes('applied')) expandedSections.appliedStyles = isExpanded;
}

/**
 * Restore expanded sections
 * @param {HTMLElement} panel - Panel element
 * @param {Object} expandedSections - Expanded sections state
 */
export function restoreExpandedSections(panel, expandedSections) {
  if (!panel || !expandedSections) return;
  
  setTimeout(() => {
    panel.querySelectorAll(`.${CSS_CLASSES.TOGGLE_SECTION}`).forEach((toggle) => {
      const sectionText = toggle.textContent.toLowerCase();
      let shouldExpand = false;

      if (sectionText.includes('css') && expandedSections.css) shouldExpand = true;
      else if (sectionText.includes('props') && expandedSections.props) shouldExpand = true;
      else if (sectionText.includes('state') && expandedSections.state) shouldExpand = true;
      else if (sectionText.includes('hooks') && expandedSections.hooks) shouldExpand = true;
      else if (sectionText.includes('applied') && expandedSections.appliedStyles)
        shouldExpand = true;

      if (shouldExpand) {
        const content = toggle.nextElementSibling;
        if (content && content.style.display === 'none') {
          content.style.display = 'block';
          toggle.textContent = toggle.textContent.replace('▶', '▼');
        }
      }
    });
  }, 10);
}

/**
 * Select all text in element
 * @param {HTMLElement} element - Element to select
 */
function selectAllText(element) {
  if (!element) return;
  
  try {
    const range = document.createRange();
    range.selectNodeContents(element);
    const sel = window.getSelection();
    if (sel) {
      sel.removeAllRanges();
      sel.addRange(range);
    }
  } catch (error) {
    console.warn('[HoverComp] Error selecting text:', error);
  }
}

// ============================================================================
// HTML Mode Handlers
// ============================================================================

/**
 * Setup editable text content handler for HTML mode
 * @param {HTMLElement} panel - Panel element
 * @param {HTMLElement} element - Target DOM element
 */
export function setupEditableTextContentHandler(panel, element) {
  const textContentDiv = panel.querySelector('[data-editable-text-content]');
  if (!textContentDiv) return;

  const originalValue = element.textContent || '';

  // Click to enable editing
  textContentDiv.onclick = (e) => {
    if (textContentDiv.getAttribute('contenteditable') === 'false') {
      e.stopPropagation();
      textContentDiv.setAttribute('contenteditable', 'true');
      textContentDiv.focus();
      selectAllText(textContentDiv);
    }
  };

  textContentDiv.onfocus = (e) => {
    e.stopPropagation();
    textContentDiv.style.background = 'rgba(129,199,132,0.3)';
    textContentDiv.style.outline = '2px solid #81c784';
  };

  textContentDiv.onblur = (e) => {
    textContentDiv.setAttribute('contenteditable', 'false');
    textContentDiv.style.background = 'rgba(0,0,0,0.3)';
    textContentDiv.style.outline = 'none';

    const newValue = textContentDiv.textContent;
    if (newValue !== originalValue) {
      element.textContent = newValue;
      console.log('[HoverComp] Text content updated');
    }
  };

  textContentDiv.onkeydown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      textContentDiv.blur();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      textContentDiv.textContent = originalValue;
      textContentDiv.blur();
    }
  };
}

/**
 * Setup editable attribute handlers for HTML mode
 * @param {HTMLElement} panel - Panel element
 * @param {HTMLElement} element - Target DOM element
 * @param {Function} refreshOverlay - Callback to refresh overlay
 */
export function setupEditableAttributeHandlers(panel, element, refreshOverlay) {
  panel.querySelectorAll('[data-editable-attribute]').forEach((attrDiv) => {
    const attrName = attrDiv.getAttribute('data-attribute-name');
    const originalValue = element.getAttribute(attrName) || '';

    // Click to enable editing
    attrDiv.onclick = (e) => {
      if (attrDiv.getAttribute('contenteditable') === 'false') {
        e.stopPropagation();
        attrDiv.setAttribute('contenteditable', 'true');
        attrDiv.focus();
        selectAllText(attrDiv);
      }
    };

    attrDiv.onfocus = (e) => {
      e.stopPropagation();
      attrDiv.style.background = 'rgba(255,167,38,0.3)';
      attrDiv.style.outline = '2px solid #ffa726';
    };

    attrDiv.onblur = (e) => {
      attrDiv.setAttribute('contenteditable', 'false');
      attrDiv.style.background = 'transparent';
      attrDiv.style.outline = 'none';

      const newValue = attrDiv.textContent.trim().replace(/^"|"$/g, ''); // Remove quotes
      if (newValue !== originalValue) {
        if (newValue === '') {
          element.removeAttribute(attrName);
        } else {
          element.setAttribute(attrName, newValue);
        }
        console.log(`[HoverComp] Attribute ${attrName} updated to: ${newValue}`);
        if (refreshOverlay) {
          setTimeout(() => refreshOverlay(element), 100);
        }
      }
    };

    attrDiv.onkeydown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        attrDiv.blur();
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        attrDiv.textContent = `"${originalValue}"`;
        attrDiv.blur();
      }
    };
  });
}

/**
 * Setup class toggle handlers for HTML mode (similar to React mode)
 * @param {HTMLElement} panel - Panel element
 * @param {HTMLElement} element - Target DOM element
 * @param {Function} refreshOverlay - Callback to refresh overlay
 */
export function setupHtmlClassToggleHandlers(panel, element, refreshOverlay) {
  // Reuse the existing setupClassToggleHandlers
  setupClassToggleHandlers(panel, element, refreshOverlay);
}

/**
 * Setup inline style toggle handlers for HTML mode
 * @param {HTMLElement} panel - Panel element
 * @param {HTMLElement} element - Target DOM element
 * @param {Function} refreshOverlay - Callback to refresh overlay
 */
export function setupHtmlStyleToggleHandlers(panel, element, refreshOverlay) {
  // Reuse the existing setupStyleToggleHandlers
  setupStyleToggleHandlers(panel, element, refreshOverlay);
}
