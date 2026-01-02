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

/**
 * Sanitize a value for serialization
 * @param {*} value - Value to sanitize
 * @param {Object} options - Options for sanitization
 * @param {boolean} options.isVue - Whether this is a Vue component (handles reactive objects)
 * @returns {*} Sanitized value
 */
export function sanitizeValue(value, options = {}) {
  if (value === null) return null;
  if (value === undefined) return 'undefined';
  if (typeof value === 'function') return '[Function]';
  if (typeof value === 'symbol') return '[Symbol]';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'object') {
    // Handle Vue reactive objects if isVue is true
    if (options.isVue) {
      try {
        if (value.__v_isRef) {
          return sanitizeValue(value.value, options);
        }
        if (value.__v_isReactive || value.__v_isReadonly) {
          try {
            // Extract raw value from Vue 3 reactive proxy
            const raw = value.__v_raw || value;
            return JSON.parse(JSON.stringify(raw));
          } catch (e) {
            return '[Reactive: ' + (value.constructor?.name || 'Object') + ']';
          }
        }
      } catch (e) {
        // If Vue internals change or access fails, fall through to generic serialization below
        // This protects against breaking changes in future Vue versions
      }
    }
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (e) {
      return '[Object: ' + (value.constructor?.name || 'Unknown') + ']';
    }
  }
  return String(value);
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
