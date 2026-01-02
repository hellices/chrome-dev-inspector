/**
 * Svelte-specific utilities for component detection and manipulation
 */

import {
  KNOWN_FRAMEWORK_COMPONENTS,
  FRAMEWORK_PATTERNS,
  USER_CODE_PATHS,
  USER_COMPONENT_SCORE_THRESHOLD,
} from '../config/constants.js';

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
 * Check if a component is from node_modules
 * @param {string} fileName - File name/path
 * @returns {boolean} True if from node_modules
 */
export function isFromNodeModules(fileName) {
  return (
    fileName.includes('node_modules') ||
    fileName.includes('/svelte/') ||
    fileName.includes('\\svelte\\') ||
    fileName.includes('/sveltekit/') ||
    fileName.includes('\\sveltekit\\')
  );
}

/**
 * Check if component name matches known framework components
 * @param {string} name - Component name
 * @param {string} fileName - File name or path
 * @returns {boolean} True if known framework component
 */
export function isKnownFrameworkComponent(name, fileName = '') {
  const svelteKnownComponents = [
    'svelte:component',
    'svelte:element',
    'svelte:window',
    'svelte:body',
    'svelte:head',
    'svelte:options',
    'svelte:fragment',
    'Layout',
    'Error',
    '+layout',
    '+error',
    '+page',
  ];

  return (
    svelteKnownComponents.includes(name) ||
    KNOWN_FRAMEWORK_COMPONENTS.includes(name) ||
    name.startsWith('svelte:') ||
    name.startsWith('+') ||
    (name.endsWith('Component') && svelteKnownComponents.some((fw) => name.includes(fw))) ||
    name.includes('SvelteKit') ||
    (name === 'Root' && fileName.includes('sveltekit'))
  );
}

/**
 * Check if component name has framework patterns
 * @param {string} name - Component name
 * @returns {boolean} True if has framework pattern
 */
export function hasFrameworkPattern(name) {
  const pattern = new RegExp(`^(${FRAMEWORK_PATTERNS.join('|')})$`);
  return (
    pattern.test(name) ||
    name.includes('Router') ||
    name.includes('Provider') ||
    name.includes('Context') ||
    name.includes('Overlay') ||
    name.includes('DevRoot') ||
    name.includes('HotReload') ||
    name.includes('Layout') ||
    name.includes('View') ||
    name.includes('Scroll') ||
    name.includes('Focus') ||
    name.includes('Redirect') ||
    name.includes('Loading') ||
    name.startsWith('_') ||
    name.startsWith('Inner') ||
    name.startsWith('Outer') ||
    name.startsWith('Render')
  );
}

/**
 * Calculate component score for user component detection
 * @param {Object} params - Component parameters
 * @returns {number} Component score
 */
export function calculateComponentScore({
  fileName,
  parentFileName,
  hasProps,
  hasState,
  isKnownFramework,
  hasFrameworkPattern,
}) {
  let score = 0;

  // Strong negative indicators
  if (isKnownFramework) score -= 10;
  if (hasFrameworkPattern) score -= 5;
  if (isFromNodeModules(fileName)) score -= 10;
  if (fileName.includes('sveltekit/dist')) score -= 15;

  // Positive indicators
  if (isFromUserCode(fileName) && !isFromNodeModules(fileName)) score += 10;
  if (parentFileName && parentFileName.includes('/app/')) score += 5;
  if (fileName.endsWith('.svelte')) score += 5;
  if (hasProps) score += 2;
  if (hasState) score += 2;

  return score;
}

/**
 * Check if component is a user component
 * @param {number} score - Component score
 * @param {boolean} isKnownFramework - Is known framework component
 * @param {boolean} hasFrameworkPattern - Has framework pattern
 * @returns {boolean} True if user component
 */
export function isUserComponent(score, isKnownFramework, hasFrameworkPattern) {
  return score >= USER_COMPONENT_SCORE_THRESHOLD && !isKnownFramework && !hasFrameworkPattern;
}

/**
 * Extract component state from Svelte component
 * @param {Object} component - Svelte component instance
 * @returns {Object} Component state
 */
export function extractSvelteState(component) {
  try {
    const state = {};
    
    // Svelte 3/4 stores component state in $$
    if (component.$$ && component.$$.ctx) {
      const ctx = component.$$.ctx;
      
      // Extract state from context
      // Svelte uses a flat array for state, so we need to be careful
      if (Array.isArray(ctx)) {
        // Try to extract meaningful values
        ctx.forEach((value, index) => {
          if (value !== null && value !== undefined && typeof value !== 'function') {
            state[`state_${index}`] = sanitizeValue(value);
          }
        });
      }
    }
    
    return state;
  } catch (e) {
    return {};
  }
}

/**
 * Extract props from Svelte component
 * @param {Object} component - Svelte component instance
 * @returns {Object} Component props
 */
export function extractSvelteProps(component) {
  try {
    const props = {};
    
    // Svelte stores props in $$
    if (component.$$ && component.$$.props) {
      const propDefs = component.$$.props;
      const ctx = component.$$.ctx;
      
      // propDefs is an object mapping prop names to indices
      for (const propName in propDefs) {
        const index = propDefs[propName];
        if (ctx && ctx[index] !== undefined) {
          props[propName] = sanitizeValue(ctx[index]);
        }
      }
    }
    
    return props;
  } catch (e) {
    return {};
  }
}

/**
 * Sanitize a value for serialization
 * @param {*} value - Value to sanitize
 * @returns {*} Sanitized value
 */
export function sanitizeValue(value) {
  if (value === null) return null;
  if (value === undefined) return 'undefined';
  if (typeof value === 'function') return '[Function]';
  if (typeof value === 'symbol') return '[Symbol]';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'object') {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (e) {
      return '[Object: ' + (value.constructor?.name || 'Unknown') + ']';
    }
  }
  return String(value);
}

/**
 * Sanitize props object for Svelte
 * @param {Object} props - Props object
 * @returns {Object} Sanitized props
 */
export function sanitizeProps(props) {
  const sanitized = {};
  for (const key in props) {
    // Skip Svelte internal keys
    if (key.startsWith('$$') || key.startsWith('$')) continue;

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
      sanitized[key] = sanitizeValue(value);
    }
  }
  return sanitized;
}

/**
 * Parse value from string (for updating state)
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
