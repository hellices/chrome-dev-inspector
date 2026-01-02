/**
 * Framework detection utilities for dev builds
 * Refactored to use helper modules for better maintainability
 */

import {
  isFromUserCode,
  isFromNodeModules,
  isKnownFrameworkComponent,
  hasFrameworkPattern as hasFrameworkPatternCheck,
  calculateComponentScore,
  isUserComponent as checkIsUserComponent,
  extractHooks,
  sanitizeValue,
  sanitizeProps,
} from './reactHelpers.js';

import {
  isFromUserCode as isFromUserCodeVue,
  isFromNodeModules as isFromNodeModulesVue,
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
            
            const isFromNodeModules = isFromNodeModulesVue(fileName);
            const isFromUserCode = isFromUserCodeVue(fileName);
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

            if (name && name !== 'App' && !name.startsWith('_')) {
              const fileName = component.__file || '';
              
              const isFromNodeModules = isFromNodeModulesVue(fileName);
              const isFromUserCode = isFromUserCodeVue(fileName);
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
