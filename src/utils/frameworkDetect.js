/**
 * Framework detection utilities for dev builds
 * Refactored to use helper modules for better maintainability
 */

// React helpers are imported but used dynamically in framework detection logic
// eslint-disable-next-line no-unused-vars
import * as reactHelpers from './reactHelpers.js';

import {
  isKnownFrameworkComponent as isKnownFrameworkComponentVue,
  hasFrameworkPattern as hasFrameworkPatternVue,
  calculateComponentScore as calculateComponentScoreVue,
  isUserComponent as isUserComponentVue,
  extractVue2Data,
  extractVue3Data,
  sanitizeProps as sanitizePropsVue,
  extractVue2Computed,
  extractVue3Computed,
} from './vueHelpers.js';

import {
  isKnownFrameworkComponent as isKnownFrameworkComponentSvelte,
  hasFrameworkPattern as hasFrameworkPatternSvelte,
  calculateComponentScore as calculateComponentScoreSvelte,
  isUserComponent as isUserComponentSvelte,
  extractSvelteState,
  extractSvelteProps,
  sanitizeProps as sanitizePropsSvelte,
} from './svelteHelpers.js';

/**
 * Detects React component from a DOM node
 * @param {HTMLElement} node - DOM node to inspect
 * @returns {Object|null} Component info or null
 */
export function detectReact(node) {
  try {
    const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
    if (!hook || !hook.renderers) {
      return null;
    }

    // Find React fiber
    const fiberKey = Object.keys(node).find((key) => key.startsWith('__reactFiber'));
    if (!fiberKey) {
      return null;
    }

    let fiber = node[fiberKey];
    let componentHierarchy = [];

    while (fiber) {
      const componentType = fiber.type;

      // Skip if type is null/undefined
      if (!componentType) {
        fiber = fiber.return;
        continue;
      }

      // Skip primitive types (string, number) and HTML elements
      if (typeof componentType === 'string') {
        fiber = fiber.return;
        continue;
      }

      // Skip built-in types
      if (typeof componentType === 'function') {
        const name = componentType.displayName || componentType.name;

        // Filter out primitives and built-in React types
        if (
          name &&
          name !== 'Anonymous' &&
          name !== 'String' &&
          name !== 'Number' &&
          name !== 'Boolean' &&
          !name.startsWith('_') &&
          name.length > 0
        ) {
          // Better detection: Check file path from source location
          const debugSource = fiber._debugSource || componentType.__source;
          const debugOwner = fiber._debugOwner;
          const fileName = debugSource?.fileName || componentType._source?.fileName || '';

          // Check owner's file path
          let ownerFileName = '';
          if (debugOwner && debugOwner.type) {
            const ownerSource = debugOwner._debugSource || debugOwner.type.__source;
            ownerFileName = ownerSource?.fileName || '';
          }

          // Check if it's a user component based on file path
          const isFromNodeModules =
            fileName.includes('node_modules') ||
            fileName.includes('/next/') ||
            fileName.includes('\\next\\');
          const isFromUserCode =
            fileName &&
            (fileName.includes('/app/') ||
              fileName.includes('\\app\\') ||
              fileName.includes('/src/') ||
              fileName.includes('\\src\\') ||
              fileName.includes('/components/') ||
              fileName.includes('\\components\\') ||
              fileName.includes('/pages/') ||
              fileName.includes('\\pages\\'));

          // Function source check
          const source = componentType.toString();
          const hasUserCodePatterns =
            source.length > 200 || source.includes('jsx') || source.includes('tsx');
          const isMinified = source.length < 100 && !source.includes('return');

          // Known framework components
          const knownFrameworkComponents = [
            'Link',
            'Image',
            'Script',
            'Head',
            'ServerRoot',
            'HotReload',
            'Router',
            'ErrorBoundary',
            'Boundary',
            'Provider',
            'Context',
          ];
          const isKnownFramework =
            knownFrameworkComponents.includes(name) ||
            (name.endsWith('Component') &&
              knownFrameworkComponents.some((fw) => name.includes(fw))) ||
            name.includes('ServerRoot') ||
            name.includes('HotReload') ||
            (name === 'Root' && fileName.includes('next'));

          // Name-based filtering
          const hasFrameworkPattern =
            name.match(
              /^(Fragment|Suspense|StrictMode|Provider|Consumer|Context|Profiler|Router|ErrorBoundary|Boundary|Handler|Root|ServerRoot)$/
            ) ||
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
            name.startsWith('Render');

          // Calculate score
          let score = 0;
          if (isFromUserCode && !isFromNodeModules) score += 10;
          if (ownerFileName && ownerFileName.includes('/app/')) score += 5;
          if (hasUserCodePatterns) score += 3;
          if (!isMinified) score += 2;
          if (!isKnownFramework) score += 5;
          if (!hasFrameworkPattern) score += 3;
          if (componentType.$$typeof || componentType._payload) score += 2;
          if (source.includes('function') || source.includes('=>')) score += 1;

          const isUserComponent = score >= 8;

          // Extract detailed information
          const props = fiber.memoizedProps || {};
          const state = fiber.memoizedState;

          const componentInfo = {
            name,
            isUserComponent,
            score,
            props: props,
            state: state,
            source: debugSource || componentType._source || null,
            fileName: fileName,
            ownerFileName: ownerFileName,
            fiber: fiber,
          };

          componentHierarchy.push(componentInfo);
        }
      }

      fiber = fiber.return;
    }

    // Return the outermost user component (the one wrapping others)
    // Reverse the array since we traverse from child to parent
    const userComponents = componentHierarchy.filter((c) => c.isUserComponent);

    // Prefer the last user component (outermost/parent) that wraps the DOM element
    // This shows MovieCard instead of Link when MovieCard wraps Link
    const targetComponent = userComponents[userComponents.length - 1] || componentHierarchy[0];

    if (targetComponent) {
      // Filter hierarchy to show only user components or key library components
      const filteredHierarchy = componentHierarchy
        .filter((c) => c.isUserComponent || c.name.match(/^(App|Layout|Page|Document|Main)$/))
        .map((c) => c.name);

      return {
        framework: 'React',
        name: targetComponent.name,
        detail: targetComponent.source?.fileName || '',
        isUserComponent: targetComponent.isUserComponent,
        hierarchy: filteredHierarchy.length > 0 ? filteredHierarchy : [targetComponent.name],
        allUserComponents: userComponents.map((c) => c.name),
        fileName: targetComponent.fileName,
      };
    }
  } catch (e) {
    // Silent fail
  }
  return null;
}

/**
 * Detects Vue 2 component from a DOM node
 * @param {HTMLElement} node - DOM node to inspect
 * @returns {Object|null} Component info or null
 */
export function detectVue2(node) {
  try {
    let current = node;
    let componentHierarchy = [];

    // Try to find Vue instance in current or parent nodes
    while (current) {
      const vue = current.__vue__;
      if (vue) {
        let instance = vue;
        
        // Walk up the component tree
        while (instance) {
          const name =
            instance.$options.name ||
            instance.$options._componentTag ||
            instance.$options.__name ||
            instance.constructor?.name;

          if (name && name !== 'Vue' && name !== 'VueComponent') {
            const fileName = instance.$options.__file || instance.$options._componentTag || '';
            
            const isKnownFramework = isKnownFrameworkComponentVue(name, fileName);
            const hasFrameworkPattern = hasFrameworkPatternVue(name);

            // Calculate score
            const score = calculateComponentScoreVue({
              fileName,
              parentFileName: instance.$parent?.$options?.__file || '',
              setupLength: instance.$options.setup?.toString().length || 0,
              isKnownFramework,
              hasFrameworkPattern,
              hasProps: Object.keys(instance.$props || {}).length > 0,
              hasEmits: (instance.$options.emits || []).length > 0,
            });

            const isUserComp = isUserComponentVue(score, isKnownFramework, hasFrameworkPattern);

            componentHierarchy.push({
              name,
              isUserComponent: isUserComp,
              score,
              fileName,
              data: extractVue2Data(instance),
              computed: extractVue2Computed(instance),
              props: sanitizePropsVue(instance.$props || {}),
            });
          }

          instance = instance.$parent;
        }

        // Return the outermost user component
        const userComponents = componentHierarchy.filter((c) => c.isUserComponent);
        const targetComponent = userComponents[userComponents.length - 1] || componentHierarchy[0];

        if (targetComponent) {
          return {
            framework: 'Vue 2',
            name: targetComponent.name,
            detail: targetComponent.fileName || '',
            isUserComponent: targetComponent.isUserComponent,
            hierarchy: componentHierarchy
              .filter((c) => c.isUserComponent || c.name.match(/^(App|Layout|Page|Main)$/))
              .map((c) => c.name),
            allUserComponents: userComponents.map((c) => c.name),
            fileName: targetComponent.fileName,
            data: targetComponent.data,
            computed: targetComponent.computed,
            props: targetComponent.props,
          };
        }
      }
      current = current.parentElement;
    }
  } catch (e) {
    // Silent fail
  }
  return null;
}

/**
 * Detects Vue 3 component from a DOM node
 * @param {HTMLElement} node - DOM node to inspect
 * @returns {Object|null} Component info or null
 */
export function detectVue3(node) {
  try {
    let current = node;
    let componentHierarchy = [];

    // Try to find Vue instance in current or parent nodes
    while (current) {
      const vueInstance = current.__vueParentComponent || current.__vnode;
      if (vueInstance) {
        let instance = vueInstance.component || vueInstance;
        
        // Walk up the component tree
        while (instance) {
          const component = instance.type;
          if (component) {
            const name = component.name || component.__name || component.displayName;

            if (name && !name.startsWith('_')) {
              const fileName = component.__file || '';
              
              const isKnownFramework = isKnownFrameworkComponentVue(name, fileName);
              const hasFrameworkPattern = hasFrameworkPatternVue(name);

              // Calculate score
              const score = calculateComponentScoreVue({
                fileName,
                parentFileName: instance.parent?.type?.__file || '',
                setupLength: component.setup?.toString().length || 0,
                isKnownFramework,
                hasFrameworkPattern,
                hasProps: Object.keys(instance.props || {}).length > 0,
                hasEmits: (component.emits || []).length > 0,
              });

              const isUserComp = isUserComponentVue(score, isKnownFramework, hasFrameworkPattern);

              componentHierarchy.push({
                name,
                isUserComponent: isUserComp,
                score,
                fileName,
                data: extractVue3Data(instance),
                computed: extractVue3Computed(instance),
                props: sanitizePropsVue(instance.props || {}),
              });
            }
          }

          instance = instance.parent;
        }

        // Return the outermost user component
        const userComponents = componentHierarchy.filter((c) => c.isUserComponent);
        const targetComponent = userComponents[userComponents.length - 1] || componentHierarchy[0];

        if (targetComponent) {
          return {
            framework: 'Vue 3',
            name: targetComponent.name,
            detail: targetComponent.fileName || '',
            isUserComponent: targetComponent.isUserComponent,
            hierarchy: componentHierarchy
              .filter((c) => c.isUserComponent || c.name.match(/^(App|Layout|Page|Main)$/))
              .map((c) => c.name),
            allUserComponents: userComponents.map((c) => c.name),
            fileName: targetComponent.fileName,
            data: targetComponent.data,
            computed: targetComponent.computed,
            props: targetComponent.props,
          };
        }
      }
      current = current.parentElement;
    }
  } catch (e) {
    // Silent fail
  }
  return null;
}

/**
 * Detects Angular component from a DOM node
 * @param {HTMLElement} node - DOM node to inspect
 * @returns {Object|null} Component info or null
 */
export function detectAngular(node) {
  try {
    // Angular Ivy (9+)
    if (window.ng && window.ng.getComponent) {
      const component = window.ng.getComponent(node);
      if (component) {
        const name = component.constructor?.name || 'Anonymous';
        return {
          framework: 'Angular',
          name,
          detail: '',
        };
      }
    }

    // Fallback to __ngContext__
    if (node.__ngContext__) {
      const context = node.__ngContext__;
      if (Array.isArray(context) && context[8]) {
        const component = context[8];
        const name = component.constructor?.name || 'Anonymous';
        return {
          framework: 'Angular',
          name,
          detail: '',
        };
      }
    }
  } catch (e) {
    // Silent fail
  }
  return null;
}

/**
 * Detects Svelte component from a DOM node
 * @param {HTMLElement} node - DOM node to inspect
 * @returns {Object|null} Component info or null
 */
/**
 * Extract Svelte 5 component info from __svelte_meta
 */
function extractSvelte5Component(element, meta) {
  try {
    const instance = meta.instance || meta.component;
    const ctx = meta.ctx || instance?.$$?.ctx;
    
    // Svelte 5 stores component metadata differently
    const name = meta.name || instance?.constructor?.name || 'SvelteComponent';
    const fileName = meta.file || meta.source || '';
    
    // Extract props from Svelte 5 component
    const props = {};
    const state = {};
    
    if (instance) {
      // Svelte 5 runes: $state values are Proxy objects on the instance
      // Props are passed as regular properties
      const ownKeys = Object.getOwnPropertyNames(instance);
      
      for (const key of ownKeys) {
        if (key.startsWith('$$') || key.startsWith('__') || key === 'constructor') continue;
        try {
          const descriptor = Object.getOwnPropertyDescriptor(instance, key);
          const value = descriptor?.get ? descriptor.get() : instance[key];
          
          if (typeof value === 'function') continue;
          
          // Determine if prop or state based on Svelte 5 conventions
          if (meta.props && meta.props.includes(key)) {
            props[key] = sanitizePropsSvelte({ [key]: value })[key];
          } else {
            state[key] = extractSvelteState({ $$: { ctx: [value], props: {} } })[`state_0`] || sanitizeValueForSvelte5(value);
          }
        } catch {
          // Skip inaccessible properties
        }
      }
      
      // Also try Svelte 5's $$ if it exists
      if (instance.$$ && instance.$$.props) {
        const propDefs = instance.$$.props;
        const ctxArr = instance.$$.ctx;
        for (const propName in propDefs) {
          if (!(propName in props) && ctxArr) {
            const idx = propDefs[propName];
            if (ctxArr[idx] !== undefined) {
              props[propName] = sanitizePropsSvelte({ [propName]: ctxArr[idx] })[propName];
            }
          }
        }
      }
    }

    const isKnownFramework = isKnownFrameworkComponentSvelte(name, fileName);
    const hasFrameworkPat = hasFrameworkPatternSvelte(name);
    const score = calculateComponentScoreSvelte({
      fileName,
      parentFileName: '',
      hasProps: Object.keys(props).length > 0,
      hasState: Object.keys(state).length > 0,
      isKnownFramework,
      hasFrameworkPattern: hasFrameworkPat,
    });

    return {
      framework: 'Svelte 5',
      name,
      detail: fileName,
      isUserComponent: isUserComponentSvelte(score, isKnownFramework, hasFrameworkPat),
      hierarchy: [name],
      allUserComponents: [name],
      fileName,
      props,
      state,
    };
  } catch {
    return null;
  }
}

function sanitizeValueForSvelte5(value) {
  if (value === null) return null;
  if (value === undefined) return 'undefined';
  if (typeof value === 'function') return '[Function]';
  if (typeof value === 'symbol') return '[Symbol]';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'object') {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch {
      return '[Object: ' + (value.constructor?.name || 'Unknown') + ']';
    }
  }
  return String(value);
}

/**
 * Try to detect Svelte 5 component by walking up from a Svelte-rendered element
 */
function detectSvelte5FromElement(element) {
  try {
    let current = element;
    while (current && current !== document.body) {
      if (current.__svelte_meta) {
        return extractSvelte5Component(current, current.__svelte_meta);
      }
      // Svelte 5 may use $$host or $$root references
      if (current.$$host && current.$$host.__svelte_meta) {
        return extractSvelte5Component(current.$$host, current.$$host.__svelte_meta);
      }
      current = current.parentElement;
    }
  } catch {}
  return null;
}

export function detectSvelte(node) {
  try {
    let current = node;
    let componentHierarchy = [];

    // Try to find Svelte component in current or parent nodes
    while (current) {
      // Svelte stores component data in different ways:
      // 1. __svelte_meta (Svelte 5 runes)
      // 2. __svelte_* properties (older versions)
      // 3. Direct $$ property (Svelte 3/4)
      // 4. Data attributes with svelte- prefix
      
      let component = null;
      let isSvelte5 = false;
      
      // Method 0: Check for Svelte 5 __svelte_meta
      if (current.__svelte_meta) {
        const meta = current.__svelte_meta;
        const instance = meta.instance || meta.component;
        if (instance) {
          const result = extractSvelte5Component(current, meta);
          if (result) return result;
        }
        isSvelte5 = true;
      }

      // Method 1: Check for __svelte_* keys
      const svelteKeys = Object.keys(current).filter(
        (key) => key.startsWith('__svelte_') || key === '__svelte'
      );
      
      if (svelteKeys.length > 0) {
        component = current[svelteKeys[0]];
      }
      
      // Method 2: Check for direct $$ property (Svelte 3/4)
      if (!component && current.$$) {
        component = current;
      }
      
      // Method 3: Check data-svelte-h or other svelte attributes
      if (!component && !isSvelte5 && current.hasAttribute && 
          (current.hasAttribute('data-svelte-h') || 
           current.hasAttribute('class') && current.className.includes('svelte-'))) {
        // This is a Svelte-rendered element, try Svelte 5 context walk
        const svelte5Result = detectSvelte5FromElement(current);
        if (svelte5Result) return svelte5Result;

        // Fallback: minimal component info
        const classes = current.className.split(' ');
        const svelteClass = classes.find(c => c.startsWith('svelte-'));
        
        if (svelteClass) {
          return {
            framework: 'Svelte',
            name: current.tagName.toLowerCase(),
            detail: 'Svelte-rendered element',
            isUserComponent: false,
            hierarchy: [current.tagName.toLowerCase()],
            allUserComponents: [],
            fileName: '',
            props: {},
            state: {},
          };
        }
      }

      if (component && component.$$) {
        // Walk up the component tree
        let instance = component;
        
        while (instance && instance.$$) {
          const fileName = instance.$$.ctx?.__file || '';
          
          // Try to get component name from various sources
          let name = 
            instance.constructor?.name || 
            fileName.split('/').pop()?.replace('.svelte', '') ||
            'SvelteComponent';

          if (name && name !== 'SvelteComponent' && name !== 'ProxyComponent') {
            const isKnownFramework = isKnownFrameworkComponentSvelte(name, fileName);
            const hasFrameworkPattern = hasFrameworkPatternSvelte(name);

            // Extract props and state
            const props = extractSvelteProps(instance);
            const state = extractSvelteState(instance);

            // Calculate score
            const score = calculateComponentScoreSvelte({
              fileName,
              parentFileName: instance.$$.parent?.$$?.ctx?.__file || '',
              hasProps: Object.keys(props).length > 0,
              hasState: Object.keys(state).length > 0,
              isKnownFramework,
              hasFrameworkPattern,
            });

            const isUserComp = isUserComponentSvelte(score, isKnownFramework, hasFrameworkPattern);

            componentHierarchy.push({
              name,
              isUserComponent: isUserComp,
              score,
              fileName,
              props: sanitizePropsSvelte(props),
              state,
            });
          }

          instance = instance.$$.parent;
        }

        // Return the outermost user component
        const userComponents = componentHierarchy.filter((c) => c.isUserComponent);
        const targetComponent = userComponents[userComponents.length - 1] || componentHierarchy[0];

        if (targetComponent) {
          return {
            framework: 'Svelte',
            name: targetComponent.name,
            detail: targetComponent.fileName || '',
            isUserComponent: targetComponent.isUserComponent,
            hierarchy: componentHierarchy
              .filter((c) => c.isUserComponent || c.name.match(/^(App|Layout|Page|Main)$/))
              .map((c) => c.name),
            allUserComponents: userComponents.map((c) => c.name),
            fileName: targetComponent.fileName,
            props: targetComponent.props,
            state: targetComponent.state,
          };
        }
      }
      current = current.parentElement;
    }
  } catch (e) {
    // NOTE: Error logging strategy
    // - console.error is used for development debugging
    // - In production builds, console statements are removed by the build script
    // - Custom error log (__HOVERCOMP_ERROR_LOG__) persists errors for production debugging
    // - Errors are silently handled in the UI to avoid disrupting the user experience
    console.error('[HoverComp] Error detecting Svelte:', e);
    if (typeof window !== 'undefined') {
      if (!window.__HOVERCOMP_ERROR_LOG__) {
        window.__HOVERCOMP_ERROR_LOG__ = [];
      }
      window.__HOVERCOMP_ERROR_LOG__.push({
        source: 'detectSvelte',
        error: e,
        timestamp: Date.now(),
      });
    }
  }
  return null;
}

/**
 * Detects Web Component
 * @param {HTMLElement} node - DOM node to inspect
 * @returns {Object|null} Component info or null
 */
export function detectWebComponent(node) {
  try {
    const tagName = node.tagName?.toLowerCase();
    if (tagName && tagName.includes('-')) {
      const constructor = window.customElements?.get(tagName);
      if (constructor) {
        return {
          framework: 'Web Component',
          name: constructor.name || tagName,
          detail: node.shadowRoot ? 'Shadow DOM' : '',
        };
      }
      // Even if not registered, it might be a custom element
      if (node.shadowRoot || node.constructor.name !== 'HTMLElement') {
        return {
          framework: 'Web Component',
          name: node.constructor.name || tagName,
          detail: node.shadowRoot ? 'Shadow DOM' : '',
        };
      }
    }
  } catch (e) {
    // Silent fail
  }
  return null;
}

/**
 * Main detection function that tries all framework detectors
 * @param {HTMLElement} node - DOM node to inspect
 * @returns {Object|null} Component info or null
 */
export function detectComponent(node) {
  if (!node || !(node instanceof HTMLElement)) {
    return null;
  }

  // Try each detection method in order
  const detectors = [detectReact, detectVue3, detectVue2, detectAngular, detectWebComponent];

  for (const detector of detectors) {
    const result = detector(node);
    if (result) {
      return result;
    }
  }

  return null;
}

// Export for Node.js environment (tests)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    detectReact,
    detectVue2,
    detectVue3,
    detectAngular,
    detectWebComponent,
    detectComponent,
  };
}
