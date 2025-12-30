/**
 * React-specific utilities for component detection and manipulation
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
    fileName.includes('/next/') ||
    fileName.includes('\\next\\')
  );
}

/**
 * Check if component name matches known framework components
 * @param {string} name - Component name
 * @param {string} fileName - File name or path
 * @returns {boolean} True if known framework component
 */
export function isKnownFrameworkComponent(name, fileName = '') {
  return (
    KNOWN_FRAMEWORK_COMPONENTS.includes(name) ||
    (name.endsWith('Component') && KNOWN_FRAMEWORK_COMPONENTS.some((fw) => name.includes(fw))) ||
    name.includes('ServerRoot') ||
    name.includes('HotReload') ||
    name.includes('AppRouter') ||
    (name === 'Root' && fileName.includes('next')) ||
    (name === 'Router' && (fileName.includes('next') || fileName.includes('react-router')))
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
    name.includes('Boundary') ||
    name.includes('Handler') ||
    name.includes('Provider') ||
    name.includes('Context') ||
    name.includes('Overlay') ||
    name.includes('DevRoot') ||
    name.includes('HotReload') ||
    name.includes('ServerRoot') ||
    name.includes('Segment') ||
    name.includes('View') ||
    name.includes('Scroll') ||
    name.includes('Focus') ||
    name.includes('Redirect') ||
    name.includes('Template') ||
    name.includes('Fallback') ||
    name.includes('HTTPAccess') ||
    name.includes('Loading') ||
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
  ownerFileName,
  source,
  isKnownFramework,
  hasFrameworkPattern,
  componentType,
}) {
  let score = 0;

  // Strong negative indicators
  if (isKnownFramework) score -= 10;
  if (hasFrameworkPattern) score -= 5;
  if (isFromNodeModules(fileName)) score -= 10;
  if (fileName.includes('next/dist')) score -= 15;

  // Positive indicators
  if (isFromUserCode(fileName) && !isFromNodeModules(fileName)) score += 10;
  if (ownerFileName && ownerFileName.includes('/app/')) score += 5;

  const hasUserCodePatterns =
    source.length > 200 || source.includes('jsx') || source.includes('tsx');
  const isMinified = source.length < 100 && !source.includes('return');

  if (hasUserCodePatterns) score += 3;
  if (!isMinified) score += 2;

  // Boost score for functional components
  if (componentType.$$typeof || componentType._payload) score += 2;
  if (source.includes('function') || source.includes('=>')) score += 1;

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
 * Extract hooks from React fiber
 * @param {Object} fiber - React fiber object
 * @returns {Array} Array of hook information
 */
export function extractHooks(fiber) {
  try {
    const hooks = [];
    let hook = fiber.memoizedState;

    while (hook) {
      if (hook.memoizedState !== undefined) {
        hooks.push({
          value: sanitizeValue(hook.memoizedState),
        });
      }
      hook = hook.next;
    }

    return hooks;
  } catch (e) {
    return [];
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
 * Sanitize props object
 * @param {Object} props - Props object
 * @returns {Object} Sanitized props
 */
export function sanitizeProps(props) {
  const sanitized = {};
  for (const key in props) {
    // Skip symbol keys
    if (typeof key === 'symbol') continue;

    const value = props[key];

    if (key === 'children') {
      sanitized[key] = typeof value === 'object' ? '[React Children]' : String(value);
    } else if (typeof value === 'function') {
      sanitized[key] = '[Function: ' + (value.name || 'anonymous') + ']';
    } else if (typeof value === 'symbol') {
      sanitized[key] = '[Symbol: ' + value.toString() + ']';
    } else if (typeof value === 'undefined') {
      sanitized[key] = 'undefined';
    } else if (value === null) {
      sanitized[key] = null;
    } else if (typeof value === 'object') {
      try {
        sanitized[key] = JSON.parse(JSON.stringify(value));
      } catch (e) {
        sanitized[key] = '[Object: ' + (value.constructor?.name || 'Unknown') + ']';
      }
    } else if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      sanitized[key] = value;
    } else {
      sanitized[key] = String(value);
    }
  }
  return sanitized;
}

/**
 * Parse value from string (for updating hooks/state)
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
 * Get React fiber root
 * @param {Object} fiber - React fiber
 * @returns {Object} Fiber root
 */
export function getFiberRoot(fiber) {
  let current = fiber;
  while (current.return) {
    current = current.return;
  }
  return current.stateNode;
}
