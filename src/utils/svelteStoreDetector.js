/**
 * Enhanced Svelte utilities with store detection
 * Detects and tracks Svelte stores (writable, readable, derived)
 */

import {
  isFromUserCode as sharedIsFromUserCode,
  sanitizeValue as sharedSanitizeValue,
} from './componentHelpers.js';

import {
  isFromNodeModules,
  isKnownFrameworkComponent,
  hasFrameworkPattern,
  calculateComponentScore,
  isUserComponent,
  extractSvelteState,
  extractSvelteProps,
  sanitizeProps,
} from './svelteHelpers.js';

/**
 * Detect Svelte stores in component
 * @param {HTMLElement} element - DOM element
 * @returns {Object} Store information
 */
export function detectSvelteStores(element) {
  try {
    const svelteKeys = Object.keys(element).filter(
      key => key.startsWith('__svelte_') || key === '__svelte'
    );
    
    if (svelteKeys.length === 0 && !element.$$) {
      return { stores: [], hasStores: false };
    }
    
    const component = svelteKeys.length > 0 ? element[svelteKeys[0]] : element;
    
    if (!component || !component.$$) {
      return { stores: [], hasStores: false };
    }
    
    const stores = [];
    const ctx = component.$$.ctx;
    
    if (!ctx || !Array.isArray(ctx)) {
      return { stores: [], hasStores: false };
    }
    
    // Check for store subscriptions
    // Svelte stores have a subscribe method
    ctx.forEach((value, index) => {
      if (value && typeof value === 'object' && typeof value.subscribe === 'function') {
        // This is likely a store
        const storeInfo = {
          index,
          type: determineStoreType(value),
          value: getStoreValue(value),
          hasSet: typeof value.set === 'function',
          hasUpdate: typeof value.update === 'function',
        };
        
        stores.push(storeInfo);
      }
    });
    
    return {
      stores,
      hasStores: stores.length > 0,
    };
  } catch (e) {
    return { stores: [], hasStores: false };
  }
}

/**
 * Determine store type
 * @param {Object} store - Store object
 * @returns {string} Store type
 */
function determineStoreType(store) {
  if (!store) return 'unknown';
  
  if (typeof store.set === 'function' && typeof store.update === 'function') {
    return 'writable';
  }
  
  if (typeof store.subscribe === 'function' && !store.set) {
    // Could be readable or derived
    // Derived stores often have a sources property
    if (store.sources || store.deps) {
      return 'derived';
    }
    return 'readable';
  }
  
  return 'custom';
}

/**
 * Get current value from store
 * @param {Object} store - Store object
 * @returns {*} Store value
 */
function getStoreValue(store) {
  if (!store || typeof store.subscribe !== 'function') {
    return undefined;
  }
  
  let value;
  let unsubscribe = null;
  
  try {
    // Subscribe and immediately unsubscribe to get current value
    unsubscribe = store.subscribe(v => {
      value = v;
    });
    
    // Ensure unsubscribe happens even if it's not a function
    if (typeof unsubscribe === 'function') {
      unsubscribe();
      unsubscribe = null;
    }
  } catch (e) {
    // Store subscription failed
    value = undefined;
  } finally {
    // Safety check: ensure unsubscribe is called
    if (unsubscribe && typeof unsubscribe === 'function') {
      try {
        unsubscribe();
      } catch (e) {
        // Ignore unsubscribe errors
      }
    }
  }
  
  return value;
}

/**
 * Format stores info as HTML
 * @param {Object} storesInfo - Stores information
 * @returns {string} HTML string
 */
export function formatSvelteStores(storesInfo) {
  if (!storesInfo || !storesInfo.hasStores) return '';
  
  const { stores } = storesInfo;
  
  let html = '<div style="margin-top: 12px; padding: 8px; background: rgba(255,62,0,0.1); border-radius: 4px; border-left: 3px solid #ff3e00;">';
  html += '<div class="toggle-section" style="color: #ff6633; font-size: 10px; font-weight: bold; margin-bottom: 0px; cursor: pointer;">▶ Stores (' + stores.length + ') 📦</div>';
  html += '<div style="display: none; margin-top: 6px; font-size: 10px;">';
  
  stores.forEach((store, idx) => {
    html += '<div style="margin: 6px 0; padding: 6px; background: rgba(0,0,0,0.3); border-radius: 3px;">';
    
    // Store header
    html += '<div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">';
    html += '<span style="color: #ff6633; font-weight: bold;">Store ' + idx + '</span>';
    
    // Store type badge
    const typeColors = {
      writable: '#4caf50',
      readable: '#2196f3',
      derived: '#9c27b0',
      custom: '#ff9800',
    };
    const typeColor = typeColors[store.type] || '#999';
    html += '<span style="background: ' + typeColor + '; color: white; padding: 1px 4px; border-radius: 2px; font-size: 8px;">' + store.type.toUpperCase() + '</span>';
    
    // Editable badge for writable stores
    if (store.hasSet) {
      html += '<span style="background: rgba(76,175,80,0.3); color: #4caf50; padding: 1px 4px; border-radius: 2px; font-size: 8px;">✏️ EDITABLE</span>';
    }
    
    html += '</div>';
    
    // Store value
    if (store.value !== undefined) {
      const displayValue = formatStoreValue(store.value);
      
      if (store.hasSet) {
        // Editable store value
        html += '<div class="editable-store" data-store-index="' + store.index + '" contenteditable="true" spellcheck="false" style="color: #ff6633; font-size: 11px; white-space: pre-wrap; padding: 8px; background: rgba(0,0,0,0.3); border: 1px solid transparent; border-radius: 3px; cursor: text; font-family: \'Courier New\', monospace; transition: all 0.2s; max-height: 200px; overflow-y: auto;" title="Edit directly (Enter to save, Esc to cancel)">' + escapeHtml(displayValue) + '</div>';
      } else {
        // Read-only store value
        html += '<div style="color: #ff9966; font-size: 11px; white-space: pre-wrap; padding: 8px; background: rgba(0,0,0,0.3); border-radius: 3px; max-height: 200px; overflow-y: auto; opacity: 0.7;" title="Read-only store">' + escapeHtml(displayValue) + '</div>';
      }
    }
    
    html += '</div>';
  });
  
  html += '</div></div>';
  
  return html;
}

/**
 * Format store value for display
 */
function formatStoreValue(value) {
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
 * Escape HTML
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Update store value
 * @param {HTMLElement} element - DOM element
 * @param {number} storeIndex - Store index in context
 * @param {*} newValue - New value to set
 * @returns {boolean} Success status
 */
export function updateSvelteStore(element, storeIndex, newValue) {
  try {
    const svelteKeys = Object.keys(element).filter(
      key => key.startsWith('__svelte_') || key === '__svelte'
    );
    
    if (svelteKeys.length === 0 && !element.$$) {
      return false;
    }
    
    const component = svelteKeys.length > 0 ? element[svelteKeys[0]] : element;
    
    if (!component || !component.$$ || !component.$$.ctx) {
      return false;
    }
    
    const ctx = component.$$.ctx;
    const store = ctx[storeIndex];
    
    if (!store || typeof store.set !== 'function') {
      return false;
    }
    
    // Parse value
    const parsedValue = parseValue(newValue);
    
    // Update store
    store.set(parsedValue);
    
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Parse value from string
 */
function parseValue(value) {
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
}

// Re-export commonly used functions
export {
  isFromNodeModules,
  isKnownFrameworkComponent,
  hasFrameworkPattern,
  calculateComponentScore,
  isUserComponent,
  extractSvelteState,
  extractSvelteProps,
  sanitizeProps,
};

// Additional exports from componentHelpers
export const isFromUserCode = sharedIsFromUserCode;
export const sanitizeValue = sharedSanitizeValue;
