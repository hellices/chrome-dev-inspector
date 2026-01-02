/**
 * Vue-specific utilities for component detection and manipulation
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
    fileName.includes('/nuxt/') ||
    fileName.includes('\\nuxt\\') ||
    fileName.includes('/vue/') ||
    fileName.includes('\\vue\\')
  );
}

/**
 * Check if component name matches known framework components
 * @param {string} name - Component name
 * @param {string} fileName - File name or path
 * @returns {boolean} True if known framework component
 */
export function isKnownFrameworkComponent(name, fileName = '') {
  const vueKnownComponents = [
    'Transition',
    'TransitionGroup',
    'KeepAlive',
    'Suspense',
    'Teleport',
    'RouterView',
    'RouterLink',
    'NuxtLink',
    'NuxtPage',
    'NuxtLayout',
    'ClientOnly',
    'ServerOnly',
  ];

  return (
    vueKnownComponents.includes(name) ||
    KNOWN_FRAMEWORK_COMPONENTS.includes(name) ||
    (name.endsWith('Component') && vueKnownComponents.some((fw) => name.includes(fw))) ||
    name.includes('RouterView') ||
    name.includes('NuxtRoot') ||
    name.includes('HotReload') ||
    (name === 'Root' && fileName.includes('nuxt')) ||
    (name === 'Router' && (fileName.includes('nuxt') || fileName.includes('vue-router')))
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
    name.includes('Transition') ||
    name.includes('Keep') ||
    name.includes('Suspense') ||
    name.includes('Teleport') ||
    name.includes('Provider') ||
    name.includes('Inject') ||
    name.includes('Overlay') ||
    name.includes('DevRoot') ||
    name.includes('HotReload') ||
    name.includes('NuxtRoot') ||
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
  setupLength,
  isKnownFramework,
  hasFrameworkPattern,
  hasProps,
  hasEmits,
}) {
  let score = 0;

  // Strong negative indicators
  if (isKnownFramework) score -= 10;
  if (hasFrameworkPattern) score -= 5;
  if (isFromNodeModules(fileName)) score -= 10;
  if (fileName.includes('nuxt/dist')) score -= 15;

  // Positive indicators
  if (isFromUserCode(fileName) && !isFromNodeModules(fileName)) score += 10;
  if (parentFileName && parentFileName.includes('/app/')) score += 5;

  const hasUserCodePatterns = setupLength > 100;
  if (hasUserCodePatterns) score += 3;
  if (hasProps) score += 2;
  if (hasEmits) score += 1;

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
 * Extract reactive data from Vue 2 instance
 * @param {Object} vm - Vue instance
 * @returns {Object} Reactive data
 */
export function extractVue2Data(vm) {
  try {
    const data = {};
    if (vm.$data) {
      for (const key in vm.$data) {
        if (!key.startsWith('_')) {
          data[key] = sanitizeValue(vm.$data[key]);
        }
      }
    }
    return data;
  } catch (e) {
    return {};
  }
}

/**
 * Extract reactive data from Vue 3 instance
 * @param {Object} instance - Vue 3 instance
 * @returns {Object} Reactive data
 */
export function extractVue3Data(instance) {
  try {
    const data = {};
    if (instance.setupState) {
      for (const key in instance.setupState) {
        data[key] = sanitizeValue(instance.setupState[key]);
      }
    }
    if (instance.data) {
      for (const key in instance.data) {
        if (!key.startsWith('_')) {
          data[key] = sanitizeValue(instance.data[key]);
        }
      }
    }
    return data;
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
    // Handle Vue reactive objects
    if (value.__v_isRef) {
      return sanitizeValue(value.value);
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
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (e) {
      return '[Object: ' + (value.constructor?.name || 'Unknown') + ']';
    }
  }
  return String(value);
}

/**
 * Sanitize props object for Vue
 * @param {Object} props - Props object
 * @returns {Object} Sanitized props
 */
export function sanitizeProps(props) {
  const sanitized = {};
  for (const key in props) {
    // Skip Vue internal keys
    if (key.startsWith('_') || key.startsWith('$') || key.startsWith('v-')) continue;

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
 * Parse value from string (for updating reactive data)
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
 * Get Vue root instance (Vue 2)
 * @param {Object} vm - Vue instance
 * @returns {Object} Root instance
 */
export function getVue2Root(vm) {
  let current = vm;
  while (current.$parent) {
    current = current.$parent;
  }
  return current;
}

/**
 * Get Vue root instance (Vue 3)
 * @param {Object} instance - Vue 3 instance
 * @returns {Object} Root instance
 */
export function getVue3Root(instance) {
  let current = instance;
  while (current.parent) {
    current = current.parent;
  }
  return current;
}

/**
 * Extract computed properties from Vue 2 instance
 * @param {Object} vm - Vue instance
 * @returns {Object} Computed properties
 */
export function extractVue2Computed(vm) {
  try {
    const computed = {};
    if (vm.$options.computed) {
      for (const key in vm.$options.computed) {
        computed[key] = sanitizeValue(vm[key]);
      }
    }
    return computed;
  } catch (e) {
    return {};
  }
}

/**
 * Extract computed properties from Vue 3 instance
 * @param {Object} instance - Vue 3 instance
 * @returns {Object} Computed properties
 */
export function extractVue3Computed(instance) {
  try {
    const computed = {};
    if (instance.ctx) {
      for (const key in instance.ctx) {
        const value = instance.ctx[key];
        if (value && value.__v_isRef && value.effect) {
          computed[key] = sanitizeValue(value.value);
        }
      }
    }
    return computed;
  } catch (e) {
    return {};
  }
}
