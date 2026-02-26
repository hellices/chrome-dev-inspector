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
 * Classify React hook type based on internal structure
 * @param {Object} hook - React hook object
 * @returns {string} Hook type name
 */
export function classifyHookType(hook) {
  const ms = hook.memoizedState;

  // useRef: memoizedState is { current: ... } with no queue
  if (ms !== null && typeof ms === 'object' && 'current' in ms && !hook.queue) {
    return 'useRef';
  }

  // useState / useReducer: has a queue with dispatch
  if (hook.queue) {
    const reducer = hook.queue.lastRenderedReducer;
    if (reducer && reducer.name && reducer.name !== 'basicStateReducer' && reducer.name !== '') {
      return 'useReducer';
    }
    return 'useState';
  }

  // useMemo / useCallback: memoizedState is [value, deps]
  if (Array.isArray(ms) && ms.length === 2 && Array.isArray(ms[1])) {
    if (typeof ms[0] === 'function') return 'useCallback';
    return 'useMemo';
  }

  // useEffect / useLayoutEffect: has .create and .destroy
  if (ms !== null && typeof ms === 'object' && 'create' in ms && 'destroy' in ms) {
    if (ms.tag & 4) return 'useLayoutEffect';
    return 'useEffect';
  }

  return 'unknown';
}

/**
 * Extract displayable value from a hook based on its type
 * @param {Object} hook - React hook object
 * @param {string} hookType - Classified hook type
 * @returns {*} Extracted value
 */
export function extractHookValue(hook, hookType) {
  const ms = hook.memoizedState;

  switch (hookType) {
    case 'useState':
    case 'useReducer':
      return sanitizeValue(ms);
    case 'useRef':
      return sanitizeValue(ms?.current);
    case 'useMemo':
      return sanitizeValue(Array.isArray(ms) ? ms[0] : ms);
    case 'useCallback':
      return '[Function: ' + (ms?.[0]?.name || 'anonymous') + ']';
    case 'useEffect':
    case 'useLayoutEffect':
      return undefined;
    default:
      return sanitizeValue(ms);
  }
}

/**
 * Extract hooks from React fiber with type classification
 * @param {Object} fiber - React fiber object
 * @returns {Array} Array of hook information with types
 */
export function extractHooks(fiber) {
  try {
    const hooks = [];
    let hook = fiber.memoizedState;
    let index = 0;

    while (hook) {
      const hookType = classifyHookType(hook);
      const value = extractHookValue(hook, hookType);

      if (hookType !== 'useEffect' && hookType !== 'useLayoutEffect' && value !== undefined) {
        hooks.push({
          type: hookType,
          index: index,
          value: value,
        });
      }

      hook = hook.next;
      index++;
    }

    return hooks;
  } catch (e) {
    return [];
  }
}

const MAX_SERIALIZE_DEPTH = 5;
const MAX_ARRAY_ITEMS = 50;
const MAX_OBJECT_KEYS = 30;

function deepClone(value, depth, seen) {
  if (depth > MAX_SERIALIZE_DEPTH) return '[...]';
  if (value === null) return null;
  if (value === undefined) return 'undefined';
  if (typeof value === 'function') return '[Function: ' + (value.name || 'anonymous') + ']';
  if (typeof value === 'symbol') return '[Symbol]';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (typeof value !== 'object') return String(value);
  if (seen.has(value)) return '[Circular]';
  seen.add(value);

  if (Array.isArray(value)) {
    const result = value.slice(0, MAX_ARRAY_ITEMS).map(v => deepClone(v, depth + 1, seen));
    if (value.length > MAX_ARRAY_ITEMS) result.push(`... +${value.length - MAX_ARRAY_ITEMS} items`);
    seen.delete(value);
    return result;
  }

  const result = {};
  const keys = Object.keys(value).slice(0, MAX_OBJECT_KEYS);
  for (const key of keys) {
    try {
      result[key] = deepClone(value[key], depth + 1, seen);
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
 * @returns {*} Sanitized value
 */
export function sanitizeValue(value) {
  return deepClone(value, 0, new WeakSet());
}

/**
 * Sanitize props object
 * @param {Object} props - Props object
 * @returns {Object} Sanitized props
 */
export function sanitizeProps(props) {
  const sanitized = {};
  for (const key in props) {
    if (typeof key === 'symbol') continue;
    const value = props[key];
    if (key === 'children') {
      sanitized[key] = typeof value === 'object' ? '[React Children]' : String(value);
    } else {
      sanitized[key] = sanitizeValue(value);
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
