/**
 * Framework detection utilities for dev builds
 */

/**
 * Detects React component from a DOM node
 * @param {HTMLElement} node - DOM node to inspect
 * @returns {Object|null} Component info or null
 */
function detectReact(node) {
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
    while (fiber) {
      const componentType = fiber.type;
      if (componentType) {
        const name =
          componentType.displayName || componentType.name || componentType.constructor?.name;
        if (name && name !== 'Anonymous') {
          return {
            framework: 'React',
            name,
            detail: fiber.elementType?.name || '',
          };
        }
      }
      fiber = fiber.return;
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
function detectVue2(node) {
  try {
    const vue = node.__vue__;
    if (vue) {
      const name =
        vue.$options.name ||
        vue.$options._componentTag ||
        vue.$options.__name ||
        vue.constructor?.name;
      return {
        framework: 'Vue 2',
        name: name || 'Anonymous',
        detail: vue.$options._componentTag || '',
      };
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
function detectVue3(node) {
  try {
    // Check for Vue 3 instance
    const vueInstance = node.__vueParentComponent || node.__vnode;
    if (vueInstance) {
      const component = vueInstance.type || vueInstance.component?.type;
      if (component) {
        const name = component.name || component.__name || component.displayName;
        return {
          framework: 'Vue 3',
          name: name || 'Anonymous',
          detail: component.__file || '',
        };
      }
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
function detectAngular(node) {
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
function detectWebComponent(node) {
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
function detectComponent(node) {
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
