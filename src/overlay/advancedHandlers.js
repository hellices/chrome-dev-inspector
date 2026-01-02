/**
 * Advanced UI handlers for adding classes and styles
 */

import { CSS_CLASSES } from '../config/constants.js';
import { getAllCSSProperties, getCommonCSSValues } from '../utils/cssHelper.js';
import { escapeHtml } from '../utils/domHelpers.js';

/**
 * Create simple text input
 * @param {string} placeholder - Input placeholder
 * @returns {HTMLInputElement} Input element
 */
function createTextInput(placeholder) {
  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = placeholder;
  input.style.cssText =
    'background: rgba(25,118,210,0.2); color: #fff; border: 1px solid #1976d2; padding: 4px 8px; border-radius: 3px; font-size: 10px; width: 100%; margin-top: 4px; outline: none;';
  return input;
}

/**
 * Setup input handlers for add operations
 * @param {HTMLInputElement} input - Input element
 * @param {HTMLElement} btn - Button element
 * @param {Function} onSubmit - Submit callback
 * @param {Function} onCancel - Cancel callback
 */
function setupInputHandlers(input, btn, onSubmit, onCancel) {
  input.onkeydown = (keyEvent) => {
    if (keyEvent.key === 'Enter') {
      keyEvent.preventDefault();
      const value = input.value.trim();
      if (value) {
        onSubmit(value, input);
      } else {
        onCancel();
      }
    }
    if (keyEvent.key === 'Escape') {
      keyEvent.preventDefault();
      onCancel();
    }
    keyEvent.stopPropagation();
  };

  input.onblur = () => {
    setTimeout(() => {
      onCancel();
    }, 200);
  };
}

/**
 * Setup add class button handlers
 * @param {HTMLElement} panel - Panel element
 * @param {HTMLElement} element - Target element
 * @param {Function} refreshCallback - Callback to refresh overlay
 */
export function setupAddClassHandlers(panel, element, refreshCallback) {
  panel.querySelectorAll(`.${CSS_CLASSES.ADD_CLASS}`).forEach((btn) => {
    btn.onclick = (e) => {
      e.stopPropagation();

      const input = createTextInput('Enter class name...');
      btn.parentNode.insertBefore(input, btn);
      btn.style.display = 'none';
      input.focus();

      setupInputHandlers(
        input,
        btn,
        (newClass, inputElement) => {
          element.classList.add(newClass);
          inputElement.value = '';
          inputElement.focus();
          refreshCallback(element);
        },
        () => {
          btn.style.display = '';
          input.remove();
        }
      );
    };
  });
}

/**
 * Setup add inline style button handlers
 * @param {HTMLElement} panel - Panel element
 * @param {HTMLElement} element - Target element
 * @param {Function} refreshCallback - Callback to refresh overlay
 */
export function setupAddStyleHandlers(panel, element, refreshCallback) {
  panel.querySelectorAll(`.${CSS_CLASSES.ADD_INLINE_STYLE}`).forEach((btn) => {
    btn.onclick = (e) => {
      e.stopPropagation();

      const allCssProperties = getAllCSSProperties();
      const { input, dropdown, inputContainer } = createStyleInput(
        allCssProperties,
        element,
        btn,
        refreshCallback
      );

      btn.parentNode.insertBefore(inputContainer, btn);
      btn.style.display = 'none';
      input.focus();

      showPropertySuggestions(input, dropdown, allCssProperties);
    };
  });
}

/**
 * Create style input with autocomplete
 */
function createStyleInput(allCssProperties, element, btn, refreshCallback) {
  const inputContainer = document.createElement('div');
  inputContainer.style.cssText = 'position: relative; margin-top: 4px;';

  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'property: value';
  input.style.cssText =
    'background: rgba(25,118,210,0.2); color: #90caf9; border: 1px solid #1976d2; padding: 4px 8px; border-radius: 3px; font-size: 10px; width: 100%; outline: none; font-family: monospace;';

  const dropdown = createAutocompleteDropdown();
  inputContainer.appendChild(input);

  setupStyleInputHandlers(
    input,
    dropdown,
    allCssProperties,
    element,
    btn,
    inputContainer,
    refreshCallback
  );

  return { input, dropdown, inputContainer };
}

/**
 * Autocomplete dropdown configuration
 */
const AUTOCOMPLETE_CONFIG = {
  DROPDOWN_STYLE: 'position: fixed; width: 250px; max-height: 200px; overflow-y: auto; background: rgba(25,25,25,0.98); border: 1px solid #1976d2; border-radius: 3px; z-index: 2147483647; display: none; box-shadow: 0 4px 12px rgba(0,0,0,0.5);',
  DROPDOWN_CLASS: 'css-autocomplete-dropdown',
  STYLE_ID: 'css-autocomplete-scrollbar-style',
  SCROLLBAR_STYLES: `
    .css-autocomplete-dropdown::-webkit-scrollbar {
      width: 8px;
    }
    .css-autocomplete-dropdown::-webkit-scrollbar-track {
      background: rgba(0,0,0,0.3);
      border-radius: 4px;
    }
    .css-autocomplete-dropdown::-webkit-scrollbar-thumb {
      background: rgba(25,118,210,0.5);
      border-radius: 4px;
    }
    .css-autocomplete-dropdown::-webkit-scrollbar-thumb:hover {
      background: rgba(25,118,210,0.7);
    }
  `,
};

/**
 * Ensure autocomplete scrollbar styles exist
 */
function ensureAutocompleteStyles() {
  if (!document.getElementById(AUTOCOMPLETE_CONFIG.STYLE_ID)) {
    const style = document.createElement('style');
    style.id = AUTOCOMPLETE_CONFIG.STYLE_ID;
    style.textContent = AUTOCOMPLETE_CONFIG.SCROLLBAR_STYLES;
    document.head.appendChild(style);
  }
}

/**
 * Create autocomplete dropdown
 */
function createAutocompleteDropdown() {
  const dropdown = document.createElement('div');
  dropdown.style.cssText = AUTOCOMPLETE_CONFIG.DROPDOWN_STYLE;
  dropdown.className = AUTOCOMPLETE_CONFIG.DROPDOWN_CLASS;

  ensureAutocompleteStyles();
  document.body.appendChild(dropdown);

  return dropdown;
}

/**
 * Setup style input handlers
 */
function setupStyleInputHandlers(
  input,
  dropdown,
  allCssProperties,
  element,
  btn,
  inputContainer,
  refreshCallback
) {
  let currentSuggestions = [];
  let selectedIndex = -1;

  input.oninput = () => {
    const text = input.value;
    const colonIndex = text.indexOf(':');

    if (colonIndex === -1) {
      const filtered = allCssProperties
        .filter((p) => p.toLowerCase().includes(text.toLowerCase()))
        .slice(0, 50)
        .map((p) => p + ': ');
      renderSuggestions(dropdown, filtered, input, currentSuggestions, selectedIndex);
    } else if (colonIndex === text.lastIndexOf(':')) {
      const property = text.substring(0, colonIndex).trim();
      const currentValue = text.substring(colonIndex + 1).trim();
      const suggestions = getCommonCSSValues(property);

      if (suggestions.length > 0) {
        const filtered = currentValue
          ? suggestions.filter((v) => v.toLowerCase().includes(currentValue.toLowerCase()))
          : suggestions;
        const formatted = filtered.map((v) => property + ': ' + v);
        renderSuggestions(dropdown, formatted, input, currentSuggestions, selectedIndex);
      } else {
        dropdown.style.display = 'none';
      }
    }
  };

  input.onkeydown = (keyEvent) => {
    handleStyleInputKeydown(
      keyEvent,
      input,
      dropdown,
      currentSuggestions,
      selectedIndex,
      element,
      btn,
      inputContainer,
      refreshCallback
    );
  };

  input.onblur = () => {
    setTimeout(() => {
      dropdown.style.display = 'none';
      dropdown.remove();
    }, 200);
  };
}

/**
 * Handle keydown in style input
 */
function handleStyleInputKeydown(
  keyEvent,
  input,
  dropdown,
  currentSuggestions,
  selectedIndex,
  element,
  btn,
  inputContainer,
  refreshCallback
) {
  if (dropdown.style.display === 'block' && currentSuggestions.length > 0) {
    if (keyEvent.key === 'ArrowDown') {
      keyEvent.preventDefault();
      selectedIndex = Math.min(selectedIndex + 1, currentSuggestions.length - 1);
      updateSuggestionSelection(dropdown, selectedIndex);
    } else if (keyEvent.key === 'ArrowUp') {
      keyEvent.preventDefault();
      selectedIndex = Math.max(selectedIndex - 1, -1);
      updateSuggestionSelection(dropdown, selectedIndex);
    } else if (keyEvent.key === 'Tab' && selectedIndex >= 0) {
      keyEvent.preventDefault();
      input.value = currentSuggestions[selectedIndex];
      dropdown.style.display = 'none';
      return;
    }
  }

  if (keyEvent.key === 'Enter') {
    keyEvent.preventDefault();
    const newStyle = input.value.trim();
    if (newStyle && newStyle.includes(':')) {
      let [prop, val] = newStyle.split(':').map((s) => s.trim());
      if (prop && val) {
        const useImportant = keyEvent.shiftKey || val.includes('!important');
        if (!val.includes('!important') && useImportant) {
          val = val + ' !important';
        }

        if (useImportant) {
          element.style.setProperty(prop, val.replace('!important', '').trim(), 'important');
        } else {
          element.style.setProperty(prop, val);
        }

        refreshCallback(element);
      }
    }
    dropdown.remove();
    inputContainer.remove();
    btn.style.display = 'inline-block';
  } else if (keyEvent.key === 'Escape') {
    keyEvent.preventDefault();
    dropdown.remove();
    inputContainer.remove();
    btn.style.display = 'inline-block';
  }
}

/**
 * Show property suggestions
 */
function showPropertySuggestions(input, dropdown, allCssProperties) {
  const suggestions = allCssProperties.map((p) => p + ': ');
  renderSuggestions(dropdown, suggestions, input, [], -1);
}

/**
 * Render suggestions in dropdown
 */
function renderSuggestions(dropdown, suggestions, input, currentSuggestions, selectedIndex) {
  dropdown.innerHTML = '';
  currentSuggestions.length = 0;
  currentSuggestions.push(...suggestions);
  selectedIndex = -1;

  if (suggestions.length === 0) {
    dropdown.style.display = 'none';
    return;
  }

  suggestions.forEach((suggestion, index) => {
    const item = document.createElement('div');
    item.textContent = suggestion;
    item.style.cssText =
      'padding: 6px 10px; cursor: pointer; font-size: 10px; color: #90caf9; font-family: monospace; transition: background 0.1s;';
    item.onmouseover = () => {
      item.style.background = 'rgba(25,118,210,0.3)';
    };
    item.onmouseout = () => {
      if (index !== selectedIndex) {
        item.style.background = 'transparent';
      }
    };
    item.onclick = (e) => {
      e.stopPropagation();
      input.value = suggestion;
      dropdown.style.display = 'none';
      input.focus();
    };
    dropdown.appendChild(item);
  });

  dropdown.style.display = 'block';
  positionDropdown(dropdown, input);
}

/**
 * Position dropdown relative to input
 */
function positionDropdown(dropdown, input) {
  const rect = input.getBoundingClientRect();
  const dropdownHeight = 200;
  const spaceBelow = window.innerHeight - rect.bottom;
  const spaceAbove = rect.top;

  dropdown.style.left = rect.right - 250 + 'px';

  if (spaceBelow >= dropdownHeight || spaceBelow > spaceAbove) {
    dropdown.style.top = rect.bottom + 2 + 'px';
    dropdown.style.bottom = 'auto';
  } else {
    dropdown.style.bottom = window.innerHeight - rect.top + 2 + 'px';
    dropdown.style.top = 'auto';
  }
}

/**
 * Update suggestion selection highlight
 */
function updateSuggestionSelection(dropdown, selectedIndex) {
  const items = dropdown.querySelectorAll('div');
  items.forEach((item, index) => {
    if (index === selectedIndex) {
      item.style.background = 'rgba(25,118,210,0.4)';
      item.scrollIntoView({ block: 'nearest' });
    } else {
      item.style.background = 'transparent';
    }
  });
}
