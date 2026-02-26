/**
 * Shared utilities for component detection and manipulation across frameworks
 */

import { USER_CODE_PATHS, USER_COMPONENT_SCORE_THRESHOLD } from '../config/constants.js';

/**
 * Check if a component is from user code
 * @param {string} fileName - File name/path
 * @returns {boolean} True if from user code
 */
export function isFromUserCode(fileName) {
  if (!fileName) return false;
  return USER_CODE_PATHS.some((path) => fileName.includes(path));
}

/**
 * Check if component is a user component based on score and framework indicators
 * @param {number} score - Component score
 * @param {boolean} isKnownFramework - Is known framework component
 * @param {boolean} hasFrameworkPattern - Has framework pattern
 * @returns {boolean} True if user component
 */
export function isUserComponent(score, isKnownFramework, hasFrameworkPattern) {
  return score >= USER_COMPONENT_SCORE_THRESHOLD && !isKnownFramework && !hasFrameworkPattern;
}

/**
 * Parse value from string (for updating reactive data/state)
 * @param {string} value - String value
 * @returns {*} Parsed value
 */
export function parseValue(value) {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

const MAX_SERIALIZE_DEPTH = 5;
const MAX_ARRAY_ITEMS = 50;
const MAX_OBJECT_KEYS = 30;

function deepClone(value, depth, seen, options = {}) {
  if (depth > MAX_SERIALIZE_DEPTH) return '[...]';
  if (value === null) return null;
  if (value === undefined) return 'undefined';
  if (typeof value === 'function') return '[Function: ' + (value.name || 'anonymous') + ']';
  if (typeof value === 'symbol') return '[Symbol]';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (typeof value !== 'object') return String(value);

  // Handle Vue reactive objects
  if (options.isVue) {
    try {
      if (value.__v_isRef) return deepClone(value.value, depth, seen, options);
      if (value.__v_isReactive || value.__v_isReadonly) {
        value = value.__v_raw || value;
      }
    } catch {}
  }

  if (seen.has(value)) return '[Circular]';
  seen.add(value);

  if (Array.isArray(value)) {
    const result = value.slice(0, MAX_ARRAY_ITEMS).map(v => deepClone(v, depth + 1, seen, options));
    if (value.length > MAX_ARRAY_ITEMS) result.push(`... +${value.length - MAX_ARRAY_ITEMS} items`);
    seen.delete(value);
    return result;
  }

  const result = {};
  const keys = Object.keys(value).slice(0, MAX_OBJECT_KEYS);
  for (const key of keys) {
    try {
      result[key] = deepClone(value[key], depth + 1, seen, options);
    } catch {
      result[key] = '[Error reading property]';
    }
  }
  const totalKeys = Object.keys(value).length;
  if (totalKeys > MAX_OBJECT_KEYS) {
    result['...'] = `+${totalKeys - MAX_OBJECT_KEYS} more keys`;
  }
  seen.delete(value);
  return result;
}

/**
 * Sanitize a value for serialization (depth-limited, circular-safe)
 * @param {*} value - Value to sanitize
 * @param {Object} options - Options for sanitization
 * @param {boolean} options.isVue - Whether this is a Vue component
 * @returns {*} Sanitized value
 */
export function sanitizeValue(value, options = {}) {
  return deepClone(value, 0, new WeakSet(), options);
}

/**
 * Sanitize props object
 * @param {Object} props - Props object
 * @param {Object} options - Options for sanitization
 * @param {string} options.framework - Framework name ('vue' or 'svelte')
 * @returns {Object} Sanitized props
 */
export function sanitizeProps(props, options = {}) {
  const sanitized = {};
  const { framework } = options;
  
  for (const key in props) {
    // Skip framework internal keys
    if (framework === 'vue') {
      if (key.startsWith('_') || key.startsWith('$') || key.startsWith('v-')) continue;
    } else if (framework === 'svelte') {
      if (key.startsWith('$$') || key.startsWith('$')) continue;
    }

    const value = props[key];

    if (typeof value === 'function') {
      sanitized[key] = '[Function: ' + (value.name || 'anonymous') + ']';
    } else if (typeof value === 'symbol') {
      sanitized[key] = '[Symbol: ' + value.toString() + ']';
    } else if (typeof value === 'undefined') {
      sanitized[key] = 'undefined';
    } else if (value === null) {
      sanitized[key] = null;
    } else {
      sanitized[key] = sanitizeValue(value, { isVue: framework === 'vue' });
    }
  }
  return sanitized;
}
