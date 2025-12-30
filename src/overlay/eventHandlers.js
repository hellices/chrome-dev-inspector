/**
 * Event handlers for overlay interactions
 */

import { CSS_CLASSES } from '../config/constants.js';
import { getXPath } from '../utils/domHelpers.js';
import { invalidateCache, requestComponentInfo, updateHook, updateState } from '../utils/messageHandler.js';
import { toggleClass, applyInlineStyle, removeInlineStyle, getDisabledValue } from '../utils/cssHelper.js';

/**
 * Setup editable hook handlers
 * @param {HTMLElement} panel - Panel element
 * @param {HTMLElement} element - Target element
 */
export function setupEditableHookHandlers(panel, element) {
  panel.querySelectorAll(`.${CSS_CLASSES.EDITABLE_HOOK}`).forEach(span => {
    span.setAttribute('contenteditable', 'true');
    span.setAttribute('spellcheck', 'false');
    
    const originalValue = span.textContent;
    
    span.onfocus = (e) => {
      e.stopPropagation();
      span.style.background = 'rgba(76,175,80,0.5)';
      span.style.outline = '2px solid #4caf50';
      span.style.boxShadow = '0 0 8px rgba(76,175,80,0.4)';
      selectAllText(span);
    };
    
    span.onblur = (e) => {
      span.style.background = 'rgba(102,187,106,0.1)';
      span.style.outline = 'none';
      span.style.boxShadow = 'none';
      
      const newValue = span.textContent.trim();
      if (newValue !== originalValue) {
        const hookIndex = parseInt(span.getAttribute('data-hook-index'));
        updateHook(element, hookIndex, newValue);
      }
    };
    
    span.onkeydown = (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        span.blur();
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        span.textContent = originalValue;
        span.blur();
      }
      e.stopPropagation();
    };
    
    span.onclick = (e) => e.stopPropagation();
  });
}

/**
 * Setup editable state handlers
 * @param {HTMLElement} panel - Panel element
 * @param {HTMLElement} element - Target element
 */
export function setupEditableStateHandlers(panel, element) {
  panel.querySelectorAll(`.${CSS_CLASSES.EDITABLE_STATE}`).forEach(div => {
    div.setAttribute('contenteditable', 'true');
    div.setAttribute('spellcheck', 'false');
    
    const originalValue = div.textContent;
    
    div.onfocus = (e) => {
      e.stopPropagation();
      div.style.background = 'rgba(171,71,188,0.5)';
      div.style.outline = '2px solid #ab47bc';
      div.style.boxShadow = '0 0 8px rgba(171,71,188,0.4)';
      selectAllText(div);
    };
    
    div.onblur = (e) => {
      div.style.background = 'rgba(0,0,0,0.3)';
      div.style.outline = 'none';
      div.style.boxShadow = 'none';
      
      const newValue = div.textContent.trim();
      if (newValue !== originalValue) {
        const stateKey = div.getAttribute('data-state-key');
        updateState(element, stateKey, newValue);
      }
    };
    
    div.onkeydown = (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        div.blur();
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        div.textContent = originalValue;
        div.blur();
      }
      e.stopPropagation();
    };
    
    div.onclick = (e) => e.stopPropagation();
  });
}

/**
 * Setup CSS class toggle handlers
 * @param {HTMLElement} panel - Panel element
 * @param {HTMLElement} element - Target element
 * @param {Function} refreshCallback - Callback to refresh overlay
 */
export function setupClassToggleHandlers(panel, element, refreshCallback) {
  panel.querySelectorAll(`.${CSS_CLASSES.TOGGLE_CLASS}`).forEach(span => {
    span.onclick = (e) => {
      e.stopPropagation();
      const className = span.getAttribute('data-class');
      const isActive = span.getAttribute('data-active') === 'true';
      
      toggleClass(element, className, !isActive);
      
      span.setAttribute('data-active', (!isActive).toString());
      span.style.textDecoration = isActive ? 'line-through' : 'none';
      span.style.opacity = isActive ? '0.5' : '1';
      span.style.background = isActive ? 'rgba(255,255,255,0.05)' : 'rgba(66,165,245,0.2)';
    };
  });
  
  panel.querySelectorAll(`.${CSS_CLASSES.DELETE_CLASS}`).forEach(deleteBtn => {
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
  panel.querySelectorAll(`.${CSS_CLASSES.TOGGLE_STYLE}`).forEach(span => {
    span.onclick = (e) => {
      e.stopPropagation();
      const styleProp = span.getAttribute('data-style-prop');
      const styleValue = span.getAttribute('data-style-value');
      const isActive = span.getAttribute('data-active') === 'true';
      const isImportant = span.getAttribute('data-use-important') === 'true' || styleValue.includes('!important');
      
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
      const isImportant = span.getAttribute('data-use-important') === 'true' || styleValue.includes('!important');
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
  
  panel.querySelectorAll(`.${CSS_CLASSES.DELETE_STYLE}`).forEach(deleteBtn => {
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
  panel.querySelectorAll(`.${CSS_CLASSES.COMPUTED_STYLE_ITEM}`).forEach(item => {
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
        item.style.background = 'transparent';
      }
    };
  });
}

/**
 * Setup toggle section handlers (expand/collapse)
 * @param {HTMLElement} panel - Panel element
 * @param {Object} expandedSections - Expanded sections state
 * @param {Function} adjustPositionCallback - Callback to adjust panel position
 */
export function setupToggleSectionHandlers(panel, expandedSections, adjustPositionCallback) {
  panel.querySelectorAll(`.${CSS_CLASSES.TOGGLE_SECTION}`).forEach(toggle => {
    toggle.style.cursor = 'pointer';
    toggle.onclick = (e) => {
      e.stopPropagation();
      const content = toggle.nextElementSibling;
      const isCollapsed = content.style.display === 'none';
      content.style.display = isCollapsed ? 'block' : 'none';
      toggle.textContent = toggle.textContent.replace(isCollapsed ? '▶' : '▼', isCollapsed ? '▼' : '▶');
      
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
  setTimeout(() => {
    panel.querySelectorAll(`.${CSS_CLASSES.TOGGLE_SECTION}`).forEach(toggle => {
      const sectionText = toggle.textContent.toLowerCase();
      let shouldExpand = false;
      
      if (sectionText.includes('css') && expandedSections.css) shouldExpand = true;
      else if (sectionText.includes('props') && expandedSections.props) shouldExpand = true;
      else if (sectionText.includes('state') && expandedSections.state) shouldExpand = true;
      else if (sectionText.includes('hooks') && expandedSections.hooks) shouldExpand = true;
      else if (sectionText.includes('applied') && expandedSections.appliedStyles) shouldExpand = true;
      
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
  const range = document.createRange();
  range.selectNodeContents(element);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
}
