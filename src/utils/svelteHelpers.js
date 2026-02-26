/**
 * Svelte-specific utilities for component detection and manipulation
 */

import {
  KNOWN_FRAMEWORK_COMPONENTS,
  FRAMEWORK_PATTERNS,
} from '../config/constants.js';
import {
  isFromUserCode as sharedIsFromUserCode,
  isUserComponent as sharedIsUserComponent,
  parseValue as sharedParseValue,
  sanitizeValue as sharedSanitizeValue,
  sanitizeProps as sharedSanitizeProps,
} from './componentHelpers.js';

/**
 * Check if a component is from user code
 * @param {string} fileName - File name/path
 * @returns {boolean} True if from user code
 */
export function isFromUserCode(fileName) {
  return sharedIsFromUserCode(fileName);
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
  return sharedIsUserComponent(score, isKnownFramework, hasFrameworkPattern);
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
      
      if (Array.isArray(ctx)) {
        // Build a map of known prop indices to exclude from state
        const propIndices = new Set();
        if (component.$$.props) {
          for (const propName in component.$$.props) {
            propIndices.add(component.$$.props[propName]);
          }
        }
        
        // Try to recover variable names from $$.vars (Svelte dev mode)
        const varNames = {};
        if (component.$$.vars) {
          // $$.vars is available in dev mode: array of { name, index, ... }
          component.$$.vars.forEach((v) => {
            if (v && v.name && typeof v.index === 'number') {
              varNames[v.index] = v.name;
            }
          });
        }
        
        // Try to recover from $$set parameter names (compiled components)
        if (Object.keys(varNames).length === 0 && component.$$set) {
          try {
            const setStr = component.$$set.toString();
            // Pattern: $$set = $$props => { if ('name' in $$props) ... }
            const propPattern = /['"](\w+)['"]\s*in\s*\$\$props/g;
            let match;
            while ((match = propPattern.exec(setStr)) !== null) {
              // These are props, not state - but helps identify what's what
            }
          } catch {}
        }
        
        // Try to recover variable names from bound callbacks
        if (component.$$.bound && Object.keys(varNames).length === 0) {
          for (const key in component.$$.bound) {
            const boundFn = component.$$.bound[key];
            if (typeof boundFn === 'function') {
              // Bound function name might hint at the variable
              try {
                const fnStr = boundFn.toString();
                // Pattern: ctx[index] = value or $$invalidate(index, name = value)
                const invalidateMatch = fnStr.match(/\$\$invalidate\((\d+)/);
                if (invalidateMatch) {
                  const idx = parseInt(invalidateMatch[1]);
                  if (!varNames[idx]) {
                    varNames[idx] = key;
                  }
                }
              } catch {}
            }
          }
        }
        
        // Try to recover from callbacks (event handlers reference state variables)
        if (component.$$.callbacks && Object.keys(varNames).length === 0) {
          // callbacks can give hints about which indices correspond to which names
        }
        
        ctx.forEach((value, index) => {
          // Skip props (already extracted separately), functions, and DOM elements
          if (propIndices.has(index)) return;
          if (value === null || value === undefined) return;
          if (typeof value === 'function') return;
          if (value instanceof HTMLElement || value instanceof Node) return;
          
          const name = varNames[index] || `state_${index}`;
          state[name] = sanitizeValue(value);
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
  return sharedSanitizeValue(value);
}

/**
 * Sanitize props object for Svelte
 * @param {Object} props - Props object
 * @returns {Object} Sanitized props
 */
export function sanitizeProps(props) {
  return sharedSanitizeProps(props, { framework: 'svelte' });
}

/**
 * Parse value from string (for updating state)
 * @param {string} value - String value
 * @returns {*} Parsed value
 */
export function parseValue(value) {
  return sharedParseValue(value);
}
