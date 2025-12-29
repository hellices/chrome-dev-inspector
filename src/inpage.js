/**
 * In-page script that runs in the main world context
 * Has access to framework DevTools hooks and global objects
 */

(function () {
  'use strict';

  // Import detection utilities (inline for injection)
  const detectComponent = (function () {
    function detectReact(node) {
      try {
        const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
        if (!hook || !hook.renderers) {
          return null;
        }

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

    function detectVue3(node) {
      try {
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

    function detectAngular(node) {
      try {
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

    return function (node) {
      if (!node || !(node instanceof HTMLElement)) {
        return null;
      }

      const detectors = [detectReact, detectVue3, detectVue2, detectAngular, detectWebComponent];

      for (const detector of detectors) {
        const result = detector(node);
        if (result) {
          return result;
        }
      }

      return null;
    };
  })();

  // Cache for component detection
  const componentCache = new WeakMap();
  const CACHE_DURATION = 1000; // 1 second

  /**
   * Get component info for a DOM node with caching
   */
  function getComponentInfo(node) {
    if (!node) return null;

    // Check cache
    const cached = componentCache.get(node);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached.data;
    }

    // Detect component
    const info = detectComponent(node);

    // Cache result
    componentCache.set(node, {
      data: info,
      timestamp: Date.now(),
    });

    return info;
  }

  /**
   * Listen for messages from content script
   */
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    if (event.data.type !== 'GET_COMPONENT_INFO') return;

    const { targetPath } = event.data;

    // Resolve element from path
    let element = null;
    try {
      if (targetPath) {
        element = document.evaluate(
          targetPath,
          document,
          null,
          XPathResult.FIRST_ORDERED_NODE_TYPE,
          null
        ).singleNodeValue;
      }
    } catch (e) {
      console.error('Error resolving element:', e);
    }

    const componentInfo = element ? getComponentInfo(element) : null;

    // Send response back
    window.postMessage(
      {
        type: 'COMPONENT_INFO_RESPONSE',
        componentInfo,
      },
      '*'
    );
  });

  console.log('[HoverComp Dev Inspector] In-page script loaded');
})();
