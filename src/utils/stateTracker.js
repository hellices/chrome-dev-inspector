/**
 * State change tracking utilities
 * Tracks props and state changes with diff visualization
 */

const stateHistory = new WeakMap();
const propsHistory = new WeakMap();

const MAX_HISTORY_LENGTH = 10; // Reduced from 20 to save memory
const MAX_HISTORY_AGE = 300000; // 5 minutes in milliseconds

/**
 * Clean old history entries
 * @param {Array} history - History array
 */
function cleanOldHistory(history) {
  if (!Array.isArray(history)) return;
  
  const now = Date.now();
  const cutoffTime = now - MAX_HISTORY_AGE;
  
  // Remove entries older than MAX_HISTORY_AGE
  while (history.length > 0 && history[0].timestamp < cutoffTime) {
    history.shift();
  }
}

/**
 * Track state change
 * @param {HTMLElement} element - DOM element
 * @param {Object} newState - New state object
 */
export function trackStateChange(element, newState) {
  if (!element || !newState) return;
  
  let history = stateHistory.get(element);
  if (!history) {
    history = [];
    stateHistory.set(element, history);
  }
  
  // Clean old history first
  cleanOldHistory(history);
  
  // Clone state to avoid reference issues and circular references
  let stateCopy;
  try {
    stateCopy = JSON.parse(JSON.stringify(newState));
  } catch (e) {
    // If JSON.stringify fails due to circular references, use a safe copy
    stateCopy = safeObjectCopy(newState);
  }
  
  history.push({
    timestamp: Date.now(),
    state: stateCopy,
  });
  
  // Enforce max length
  if (history.length > MAX_HISTORY_LENGTH) {
    history.shift();
  }
}

/**
 * Track props change
 * @param {HTMLElement} element - DOM element
 * @param {Object} newProps - New props object
 */
export function trackPropsChange(element, newProps) {
  if (!element || !newProps) return;
  
  let history = propsHistory.get(element);
  if (!history) {
    history = [];
    propsHistory.set(element, history);
  }
  
  // Clean old history first
  cleanOldHistory(history);
  
  // Clone props to avoid reference issues and circular references
  let propsCopy;
  try {
    propsCopy = JSON.parse(JSON.stringify(newProps));
  } catch (e) {
    // If JSON.stringify fails due to circular references, use a safe copy
    propsCopy = safeObjectCopy(newProps);
  }
  
  history.push({
    timestamp: Date.now(),
    props: propsCopy,
  });
  
  // Enforce max length
  if (history.length > MAX_HISTORY_LENGTH) {
    history.shift();
  }
}

/**
 * Get state history for element
 * @param {HTMLElement} element - DOM element
 * @returns {Array} State history
 */
export function getStateHistory(element) {
  return stateHistory.get(element) || [];
}

/**
 * Get props history for element
 * @param {HTMLElement} element - DOM element
 * @returns {Array} Props history
 */
export function getPropsHistory(element) {
  return propsHistory.get(element) || [];
}

/**
 * Compare two objects and return diff
 * @param {Object} oldObj - Old object
 * @param {Object} newObj - New object
 * @returns {Object} Diff object with added, removed, changed
 */
export function getDiff(oldObj, newObj) {
  if (!oldObj || !newObj) return { added: [], removed: [], changed: [] };
  
  const added = [];
  const removed = [];
  const changed = [];
  
  // Find added and changed
  for (const key in newObj) {
    if (!(key in oldObj)) {
      added.push({ key, value: newObj[key] });
    } else if (JSON.stringify(oldObj[key]) !== JSON.stringify(newObj[key])) {
      changed.push({ key, oldValue: oldObj[key], newValue: newObj[key] });
    }
  }
  
  // Find removed
  for (const key in oldObj) {
    if (!(key in newObj)) {
      removed.push({ key, value: oldObj[key] });
    }
  }
  
  return { added, removed, changed };
}

/**
 * Get latest state diff
 * @param {HTMLElement} element - DOM element
 * @returns {Object|null} Diff object or null
 */
export function getLatestStateDiff(element) {
  const history = getStateHistory(element);
  if (history.length < 2) return null;
  
  const latest = history[history.length - 1].state;
  const previous = history[history.length - 2].state;
  
  return getDiff(previous, latest);
}

/**
 * Get latest props diff
 * @param {HTMLElement} element - DOM element
 * @returns {Object|null} Diff object or null
 */
export function getLatestPropsDiff(element) {
  const history = getPropsHistory(element);
  if (history.length < 2) return null;
  
  const latest = history[history.length - 1].props;
  const previous = history[history.length - 2].props;
  
  return getDiff(previous, latest);
}

/**
 * Format diff for display
 * @param {Object} diff - Diff object
 * @returns {string} HTML string
 */
export function formatDiff(diff) {
  if (!diff || (diff.added.length === 0 && diff.removed.length === 0 && diff.changed.length === 0)) {
    return '';
  }
  
  let html = '<div style="margin-top: 6px; padding: 6px; background: rgba(0,0,0,0.3); border-radius: 3px; font-size: 9px;">';
  html += '<div style="color: #888; margin-bottom: 4px;">Latest Changes:</div>';
  
  diff.added.forEach(item => {
    html += '<div style="color: #4caf50; margin: 2px 0;">+ ' + escapeHtml(item.key) + ': ' + formatValue(item.value) + '</div>';
  });
  
  diff.removed.forEach(item => {
    html += '<div style="color: #f44336; margin: 2px 0;">- ' + escapeHtml(item.key) + ': ' + formatValue(item.value) + '</div>';
  });
  
  diff.changed.forEach(item => {
    html += '<div style="color: #ff9800; margin: 2px 0;">~ ' + escapeHtml(item.key) + ': ';
    html += '<span style="text-decoration: line-through; opacity: 0.5;">' + formatValue(item.oldValue) + '</span>';
    html += ' → ' + formatValue(item.newValue);
    html += '</div>';
  });
  
  html += '</div>';
  
  return html;
}

/**
 * Format value for diff display
 */
function formatValue(value) {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return '"' + escapeHtml(value) + '"';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value === 'object') {
    try {
      const str = JSON.stringify(value);
      return str.length > 50 ? str.substring(0, 47) + '...' : str;
    } catch {
      return '{...}';
    }
  }
  return String(value);
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
 * Clear history for element
 * @param {HTMLElement} element - DOM element
 */
export function clearHistory(element) {
  if (!element) return;
  stateHistory.delete(element);
  propsHistory.delete(element);
}

/**
 * Get change count
 * @param {HTMLElement} element - DOM element
 * @returns {Object} Change counts
 */
export function getChangeCount(element) {
  const stateHist = getStateHistory(element);
  const propsHist = getPropsHistory(element);
  
  return {
    stateChanges: Math.max(0, stateHist.length - 1),
    propsChanges: Math.max(0, propsHist.length - 1),
  };
}

/**
 * Safe object copy that handles circular references
 * @param {Object} obj - Object to copy
 * @param {Set} seen - Set of already seen objects
 * @returns {Object} Safe copy
 */
function safeObjectCopy(obj, seen = new Set()) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  
  // Prevent circular references
  if (seen.has(obj)) {
    return '[Circular]';
  }
  
  seen.add(obj);
  
  if (Array.isArray(obj)) {
    const result = obj.slice(0, 100).map(item => safeObjectCopy(item, seen)); // Limit array size
    seen.delete(obj);
    return result;
  }
  
  const result = {};
  const keys = Object.keys(obj).slice(0, 50); // Limit object keys
  
  for (const key of keys) {
    try {
      result[key] = safeObjectCopy(obj[key], seen);
    } catch (e) {
      result[key] = '[Error]';
    }
  }
  
  seen.delete(obj);
  return result;
}
