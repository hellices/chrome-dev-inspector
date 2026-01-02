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
        // 1. DevTools Hook 확인 (선택적 - 없어도 계속 진행)
        const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
        const hasDevTools = hook && hook.renderers && hook.renderers.size > 0;

        // 2. Fiber 찾기 - __reactFiber 또는 __reactInternalInstance
        const fiberKey = Object.keys(node).find((key) => 
          key.startsWith('__reactFiber') || 
          key.startsWith('__reactInternalInstance')
        );
        
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
            const name = componentType.displayName || componentType.name || 'Component';

            // 프로덕션 빌드 대응: 더 관대한 필터링
            const isValidName = name && 
              name.length > 0 &&
              name !== 'Anonymous' &&
              name !== 'String' &&
              name !== 'Number' &&
              name !== 'Boolean' &&
              !name.startsWith('_');

            if (isValidName) {
              // Better detection: Check file path from source location
              const debugSource = fiber._debugSource || componentType.__source;
              const debugOwner = fiber._debugOwner;
              const fileName = debugSource?.fileName || componentType._source?.fileName || '';

              // Check owner's file path (who created this component)
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

              // Known framework components (strict list)
              const knownFrameworkComponents = [
                'Link',
                'Image',
                'Script',
                'Head',
                'ServerRoot',
                'HotReload',
                'Router',
                'AppRouter',
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
                name.includes('AppRouter') ||
                (name === 'Root' && fileName.includes('next')) ||
                (name === 'Router' &&
                  (fileName.includes('next') || fileName.includes('react-router')));

              // Name-based filtering (more strict for Next.js components)
              const hasFrameworkPattern =
                name.match(
                  /^(Fragment|Suspense|StrictMode|Provider|Consumer|Context|Profiler|Router|AppRouter|ErrorBoundary|Boundary|Handler|Root|ServerRoot)$/
                ) ||
                name === 'AppRouter' ||
                (name.includes('Router') &&
                  (fileName.includes('next') || fileName.includes('node_modules'))) ||
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

              // Calculate score (higher = more likely user component)
              let score = 0;

              // 프로덕션 환경: 디버그 정보 없으면 기본 점수 부여
              if (!fileName && !debugSource) {
                score += 5; // 프로덕션 빌드는 기본적으로 유효한 컴포넌트로 간주
              }

              // Strong negative indicators
              if (isKnownFramework) score -= 10;
              if (hasFrameworkPattern) score -= 5;
              if (isFromNodeModules) score -= 10;
              if (fileName.includes('next/dist')) score -= 15;

              // Positive indicators
              if (isFromUserCode && !isFromNodeModules) score += 10;
              if (ownerFileName && ownerFileName.includes('/app/')) score += 5;
              if (hasUserCodePatterns) score += 3;
              if (!isMinified) score += 2;

              // Boost score for functional components (React.memo, forwardRef)
              if (componentType.$$typeof || componentType._payload) score += 2;
              if (source.includes('function') || source.includes('=>')) score += 1;

              // 프로덕션: 이름이 의미있으면 점수 추가
              if (name.length > 2 && /[A-Z]/.test(name[0])) {
                score += 3;
              }

              // Must have positive score to be user component (프로덕션에서는 더 관대하게)
              const isUserComponent = score >= 5 && !isKnownFramework && !hasFrameworkPattern;

              // Extract detailed information
              const props = fiber.memoizedProps || {};
              const state = fiber.memoizedState;
              const hooks = extractHooks(fiber);

              const componentInfo = {
                name,
                isUserComponent,
                score,
                props: sanitizeProps(props),
                state: sanitizeValue(state),
                hooks: hooks,
                source: debugSource || componentType._source || null,
                fileName: fileName,
                ownerFileName: ownerFileName,
                isFromNodeModules: isFromNodeModules,
                isKnownFramework: isKnownFramework,
                hasFrameworkPattern: hasFrameworkPattern,
              };

              componentHierarchy.push(componentInfo);

              // Debug logging
              if (name === 'AppRouter' || name.includes('Router')) {
                console.log('[HoverComp Debug]', name, {
                  score,
                  isUserComponent,
                  isKnownFramework,
                  hasFrameworkPattern,
                  fileName: fileName.substring(fileName.lastIndexOf('/') + 1),
                });
              }
            }
          }

          fiber = fiber.return;
        }

        // Select the best user component based on score
        const userComponents = componentHierarchy.filter((c) => c.isUserComponent);

        // Sort by score (highest first), then by position (outermost first)
        userComponents.sort((a, b) => {
          if (b.score !== a.score) return b.score - a.score;
          // If scores equal, prefer outermost (later in array)
          return componentHierarchy.indexOf(b) - componentHierarchy.indexOf(a);
        });

        // Debug logging
        console.log(
          '[HoverComp] All components:',
          componentHierarchy.map((c) => `${c.name}(${c.score}, user:${c.isUserComponent})`)
        );
        console.log(
          '[HoverComp] User components:',
          userComponents.map((c) => `${c.name}(${c.score})`)
        );

        // Select highest scored user component, or fallback to non-framework with positive score
        const targetComponent =
          userComponents[0] ||
          componentHierarchy.find(
            (c) => !c.isKnownFramework && !c.hasFrameworkPattern && c.score >= 0
          ) ||
          componentHierarchy[0];

        console.log(
          '[HoverComp] Selected component:',
          targetComponent?.name,
          'Score:',
          targetComponent?.score
        );

        if (targetComponent) {
          // Filter hierarchy to show only user components or key library components
          const filteredHierarchy = componentHierarchy
            .filter((c) => c.isUserComponent || c.name.match(/^(App|Layout|Page|Document|Main)$/))
            .map((c) => `${c.name}${c.score ? ` (${c.score})` : ''}`);

          // Find React component's root DOM node
          const fiberKey = Object.keys(node).find((key) => key.startsWith('__reactFiber'));
          let componentDomNode = null;
          if (fiberKey) {
            let fiber = node[fiberKey];
            // Walk up to find the target component fiber
            while (fiber) {
              const componentType = fiber.type;
              const name = componentType?.displayName || componentType?.name;
              if (name === targetComponent.name) {
                // Found the component, now find its DOM node
                componentDomNode = findDomNodeForFiber(fiber);
                break;
              }
              fiber = fiber.return;
            }
          }

          return {
            framework: 'React',
            name: targetComponent.name,
            detail: targetComponent.source?.fileName || '',
            props: targetComponent.props,
            state: targetComponent.state,
            hooks: targetComponent.hooks,
            hierarchy: filteredHierarchy.length > 0 ? filteredHierarchy : [targetComponent.name],
            isUserComponent: targetComponent.isUserComponent,
            score: targetComponent.score,
            allUserComponents: userComponents.map((c) => `${c.name} (${c.score})`),
            fileName: targetComponent.fileName,
            ownerFileName: targetComponent.ownerFileName,
            isFromNodeModules: targetComponent.isFromNodeModules,
            componentDomNode: componentDomNode,
          };
        }
      } catch (e) {
        console.error('React detection error:', e);
      }
      return null;
    }

    function extractHooks(fiber) {
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

    function findDomNodeForFiber(fiber) {
      // Try to find a DOM node by traversing down the fiber tree
      let current = fiber;

      // First, try the current fiber's stateNode
      if (current.stateNode && current.stateNode instanceof HTMLElement) {
        return current.stateNode;
      }

      // Traverse children to find a DOM node
      current = fiber.child;
      while (current) {
        if (current.stateNode && current.stateNode instanceof HTMLElement) {
          return current.stateNode;
        }
        // Go deeper if needed
        if (current.child) {
          current = current.child;
        } else if (current.sibling) {
          current = current.sibling;
        } else {
          // No more nodes to check
          break;
        }
      }

      return null;
    }

    function sanitizeValue(value) {
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

    function sanitizeProps(props) {
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
            // Check for circular references and symbols
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
        let current = node;
        let componentHierarchy = [];
        let foundVueInstance = false;

        // Try to find Vue instance in current or parent nodes
        while (current && componentHierarchy.length < 20) {
          // Check multiple Vue 3 properties
          const vueInstance = current.__vueParentComponent || 
                             current.__vnode || 
                             current._vnode;
          
          if (vueInstance) {
            foundVueInstance = true;
            let instance = vueInstance.component || vueInstance;
            
            // Walk up the component tree
            let depth = 0;
            while (instance && depth < 20) {
              const component = instance.type;
              if (component) {
                const name = component.name || component.__name || component.displayName;

                // Filter out framework components and fragments
                if (name && 
                    name !== 'App' && 
                    !name.startsWith('_') &&
                    name !== 'Fragment' &&
                    name !== 'Teleport' &&
                    name !== 'KeepAlive' &&
                    name !== 'Suspense' &&
                    name !== 'Transition' &&
                    name !== 'TransitionGroup') {
                  
                  const fileName = component.__file || '';
                  
                  // Check if it's a user component
                  const isFromNodeModules = fileName.includes('node_modules') || 
                                           fileName.includes('/vue/') ||
                                           fileName.includes('\\vue\\');
                  const isFromUserCode = fileName && (
                    fileName.includes('/src/') ||
                    fileName.includes('\\src\\') ||
                    fileName.includes('/components/') ||
                    fileName.includes('\\components\\') ||
                    fileName.includes('/app/') ||
                    fileName.includes('\\app\\')
                  );

                  // Known Vue framework components
                  const knownFrameworkComponents = [
                    'RouterView', 'RouterLink', 'NuxtLink', 'NuxtPage', 'NuxtLayout',
                    'ClientOnly', 'ServerOnly', 'Teleport', 'KeepAlive', 'Suspense'
                  ];
                  const isKnownFramework = knownFrameworkComponents.includes(name);

                  // Calculate score
                  let score = 0;
                  if (isFromUserCode && !isFromNodeModules) score += 10;
                  if (!isKnownFramework) score += 5;
                  if (component.setup) score += 3;
                  if (instance.props && Object.keys(instance.props).length > 0) score += 2;

                  const isUserComponent = score >= 8;

                  componentHierarchy.push({
                    name,
                    isUserComponent,
                    score,
                    fileName,
                  });
                }
              }

              instance = instance.parent;
              depth++;
            }

            // If we found components, return the best one
            if (componentHierarchy.length > 0) {
              const userComponents = componentHierarchy.filter(c => c.isUserComponent);
              const targetComponent = userComponents[userComponents.length - 1] || componentHierarchy[0];

              return {
                framework: 'Vue 3',
                name: targetComponent.name,
                detail: targetComponent.fileName || '',
                isUserComponent: targetComponent.isUserComponent,
                hierarchy: componentHierarchy.map(c => c.name),
              };
            }
          }

          // Try parent element
          current = current.parentElement;
          if (!current || current === document.body || current === document.documentElement) {
            break;
          }
        }

        // If we found a Vue instance but no valid components, return a default
        if (foundVueInstance) {
          return {
            framework: 'Vue 3',
            name: 'Vue Component',
            detail: '',
            isUserComponent: false,
          };
        }
      } catch (e) {
        console.error('[HoverComp] Vue 3 detection error:', e);
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
   * Get XPath for an element
   */
  function getXPath(element) {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) {
      return '';
    }

    if (element.id) {
      return `//*[@id="${element.id}"]`;
    }

    const parts = [];
    while (element && element.nodeType === Node.ELEMENT_NODE) {
      let index = 0;
      let sibling = element.previousSibling;

      while (sibling) {
        if (sibling.nodeType === Node.ELEMENT_NODE && sibling.nodeName === element.nodeName) {
          index++;
        }
        sibling = sibling.previousSibling;
      }

      const tagName = element.nodeName.toLowerCase();
      const pathIndex = index ? `[${index + 1}]` : '';
      parts.unshift(`${tagName}${pathIndex}`);
      element = element.parentNode;
    }

    return parts.length ? `/${parts.join('/')}` : '';
  }

  /**
   * Get component info for a DOM node with caching
   * Supports both framework detection and plain HTML mode
   */
  function getComponentInfo(node, mode = 'auto') {
    if (!node) return null;

    // Check cache (only for auto/framework modes)
    if (
      mode === 'auto' ||
      mode === 'react' ||
      mode === 'vue2' ||
      mode === 'vue3' ||
      mode === 'angular'
    ) {
      const cached = componentCache.get(node);
      if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        return cached.data;
      }
    }

    let info = null;

    // HTML mode - skip framework detection
    if (mode === 'html') {
      // Return null to let content script handle HTML mode formatting
      // (We can't import htmlHelpers.js here as it's in isolated world)
      return null;
    }

    // Detect component (framework mode)
    info = detectComponent(node);

    // Add CSS information
    if (info && node instanceof HTMLElement) {
      const styles = window.getComputedStyle(node);
      const cssInfo = {
        classes: Array.from(node.classList),
        styles: {
          display: styles.display || '',
          position: styles.position || '',
          width: styles.width || '',
          height: styles.height || '',
          margin: styles.margin || '',
          padding: styles.padding || '',
          backgroundColor: styles.backgroundColor || '',
          color: styles.color || '',
          fontSize: styles.fontSize || '',
          fontFamily: styles.fontFamily || '',
          border: styles.border || '',
          borderRadius: styles.borderRadius || '',
          flexDirection: styles.flexDirection || '',
          justifyContent: styles.justifyContent || '',
          alignItems: styles.alignItems || '',
          gridTemplateColumns: styles.gridTemplateColumns || '',
          zIndex: styles.zIndex || '',
        },
        inlineStyles: node.style.cssText || '',
      };

      // Find which stylesheets contribute to this element
      const matchedRules = [];
      try {
        for (const sheet of document.styleSheets) {
          try {
            for (const rule of sheet.cssRules || []) {
              if (rule instanceof CSSStyleRule && node.matches(rule.selectorText)) {
                matchedRules.push({
                  selector: rule.selectorText,
                  source: sheet.href || 'inline',
                  styles: rule.style.cssText,
                });
              }
            }
          } catch (e) {
            // Cross-origin stylesheet
          }
        }
      } catch (e) {
        // Silent fail
      }

      cssInfo.matchedRules = matchedRules;
      info.css = cssInfo;
    }

    // Cache result (only for framework modes)
    if (mode !== 'html') {
      componentCache.set(node, {
        data: info,
        timestamp: Date.now(),
      });
    }

    return info;
  }

  /**
   * Listen for messages from content script
   */
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;

    if (event.data.type === 'INVALIDATE_CACHE') {
      // Invalidate cache for specific element
      const { targetPath } = event.data;

      try {
        let element = null;
        if (targetPath) {
          element = document.evaluate(
            targetPath,
            document,
            null,
            XPathResult.FIRST_ORDERED_NODE_TYPE,
            null
          ).singleNodeValue;
        }

        if (element) {
          componentCache.delete(element);
          console.log('[HoverComp] Cache invalidated for element');
        }
      } catch (e) {
        console.error('Error invalidating cache:', e);
      }
    } else if (event.data.type === 'GET_COMPONENT_INFO') {
      const { targetPath, inspectionMode } = event.data;

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

      const componentInfo = element ? getComponentInfo(element, inspectionMode || 'auto') : null;

      // Add React component DOM node XPath if available
      let reactComponentXPath = null;
      if (componentInfo && componentInfo.componentDomNode) {
        reactComponentXPath = getXPath(componentInfo.componentDomNode);
        // Remove the componentDomNode before sending (can't clone HTML elements)
        delete componentInfo.componentDomNode;
      }

      // Send response back
      window.postMessage(
        {
          type: 'COMPONENT_INFO_RESPONSE',
          componentInfo,
          reactComponentXPath,
        },
        '*'
      );
    } else if (event.data.type === 'UPDATE_HOOK') {
      // Handle hook updates (current component)
      const { targetPath, hookIndex, newValue } = event.data;

      try {
        let element = null;
        if (targetPath) {
          element = document.evaluate(
            targetPath,
            document,
            null,
            XPathResult.FIRST_ORDERED_NODE_TYPE,
            null
          ).singleNodeValue;
        }

        if (element) {
          const fiberKey = Object.keys(element).find((key) => key.startsWith('__reactFiber'));
          if (fiberKey) {
            const fiber = element[fiberKey];

            // Find the component fiber
            let componentFiber = fiber;
            while (componentFiber) {
              if (componentFiber.type && typeof componentFiber.type === 'function') {
                // Navigate to the specific hook
                let hook = componentFiber.memoizedState;
                let currentIndex = 0;

                while (hook && currentIndex <= hookIndex) {
                  if (currentIndex === hookIndex) {
                    // Found the target hook, update it
                    const parsedValue = parseValue(newValue);

                    // Update the memoizedState
                    hook.memoizedState = parsedValue;

                    // Also update baseState if it exists
                    if (hook.baseState !== undefined) {
                      hook.baseState = parsedValue;
                    }

                    // Try to find and call the setState function
                    if (hook.queue && hook.queue.dispatch) {
                      try {
                        // Temporarily suppress React warnings
                        const originalError = console.error;
                        console.error = (...args) => {
                          if (args[0]?.includes?.('optimistic state update')) {
                            return; // Suppress this specific warning
                          }
                          originalError.apply(console, args);
                        };

                        try {
                          // Also update alternate fiber BEFORE dispatch
                          if (componentFiber.alternate && componentFiber.alternate.memoizedState) {
                            let altHook = componentFiber.alternate.memoizedState;
                            let altIndex = 0;
                            while (altHook && altIndex < hookIndex) {
                              altHook = altHook.next;
                              altIndex++;
                            }
                            if (altHook && altIndex === hookIndex) {
                              altHook.memoizedState = parsedValue;
                              if (altHook.baseState !== undefined) {
                                altHook.baseState = parsedValue;
                              }
                            }
                          }

                          // Mark fiber as needing update
                          componentFiber.lanes = 1;
                          if (componentFiber.alternate) {
                            componentFiber.alternate.lanes = 1;
                          }

                          // Schedule update on root fiber
                          let rootFiber = componentFiber;
                          while (rootFiber.return) {
                            rootFiber = rootFiber.return;
                          }

                          // Try to get React's scheduler
                          const fiberRoot = rootFiber.stateNode;
                          if (fiberRoot && fiberRoot.current) {
                            // Mark root as having pending updates
                            if (typeof fiberRoot.ensureRootIsScheduled === 'function') {
                              fiberRoot.ensureRootIsScheduled(fiberRoot);
                            }
                          }

                          // Call dispatch to trigger re-render
                          hook.queue.dispatch(parsedValue);

                          console.log('[HoverComp] Hook updated and scheduled');
                        } finally {
                          // Restore console.error
                          console.error = originalError;
                        }

                        window.postMessage({ type: 'UPDATE_SUCCESS' }, '*');
                        return;
                      } catch (err) {
                        console.error('[HoverComp] Error calling dispatch:', err);
                      }
                    }

                    // Fallback: Force update using React internals
                    hook.memoizedState = parsedValue;
                    if (hook.baseState !== undefined) {
                      hook.baseState = parsedValue;
                    }

                    // Mark both fibers for update
                    componentFiber.lanes = 1;
                    if (componentFiber.alternate) {
                      componentFiber.alternate.lanes = 1;

                      // Update alternate hook too
                      let altHook = componentFiber.alternate.memoizedState;
                      let altIndex = 0;
                      while (altHook && altIndex < hookIndex) {
                        altHook = altHook.next;
                        altIndex++;
                      }
                      if (altHook && altIndex === hookIndex) {
                        altHook.memoizedState = parsedValue;
                        if (altHook.baseState !== undefined) {
                          altHook.baseState = parsedValue;
                        }
                      }
                    }

                    // Force schedule update on root
                    let rootFiber = componentFiber;
                    while (rootFiber.return) {
                      rootFiber = rootFiber.return;
                    }
                    const fiberRoot = rootFiber.stateNode;
                    if (fiberRoot && fiberRoot.current) {
                      try {
                        // Try to schedule update
                        if (typeof fiberRoot.ensureRootIsScheduled === 'function') {
                          fiberRoot.ensureRootIsScheduled(fiberRoot);
                        }

                        // Try to mark as having pending work
                        if (
                          fiberRoot.callbackNode === null &&
                          typeof fiberRoot.scheduleRefresh === 'function'
                        ) {
                          fiberRoot.scheduleRefresh();
                        }
                      } catch (e) {
                        console.log('[HoverComp] Could not schedule root update:', e.message);
                      }
                    }

                    console.log('[HoverComp] Hook updated (fallback method)');
                    window.postMessage({ type: 'UPDATE_SUCCESS' }, '*');
                    return;
                  }
                  hook = hook.next;
                  currentIndex++;
                }
                break;
              }
              componentFiber = componentFiber.return;
            }

            console.warn('[HoverComp] Hook not found');
            window.postMessage({ type: 'UPDATE_ERROR', error: 'Hook not found' }, '*');
          }
        }
      } catch (e) {
        console.error('Error updating hook:', e);
        window.postMessage({ type: 'UPDATE_ERROR', error: e.message }, '*');
      }
    } else if (event.data.type === 'UPDATE_STATE') {
      // Handle state updates (class component state)
      const { targetPath, stateKey, newValue } = event.data;

      try {
        let element = null;
        if (targetPath) {
          element = document.evaluate(
            targetPath,
            document,
            null,
            XPathResult.FIRST_ORDERED_NODE_TYPE,
            null
          ).singleNodeValue;
        }

        if (element) {
          const fiberKey = Object.keys(element).find((key) => key.startsWith('__reactFiber'));
          if (fiberKey) {
            const fiber = element[fiberKey];

            // Find the component fiber with state
            let componentFiber = fiber;
            while (componentFiber) {
              if (
                componentFiber.stateNode &&
                componentFiber.stateNode.state &&
                stateKey in componentFiber.stateNode.state
              ) {
                // Found the component with state
                const parsedValue = parseValue(newValue);

                // Update the state
                const newState = { ...componentFiber.stateNode.state, [stateKey]: parsedValue };
                componentFiber.stateNode.state = newState;

                // Try to use setState if available
                if (typeof componentFiber.stateNode.setState === 'function') {
                  componentFiber.stateNode.setState({ [stateKey]: parsedValue });
                  console.log('[HoverComp] State updated via setState');
                  window.postMessage({ type: 'UPDATE_SUCCESS' }, '*');
                  return;
                }

                // Fallback: Update memoizedState and force re-render
                if (componentFiber.memoizedState) {
                  componentFiber.memoizedState = newState;
                }

                // Update alternate fiber
                if (componentFiber.alternate) {
                  if (componentFiber.alternate.stateNode) {
                    componentFiber.alternate.stateNode.state = newState;
                  }
                  if (componentFiber.alternate.memoizedState) {
                    componentFiber.alternate.memoizedState = newState;
                  }
                }

                // Mark for update and schedule
                componentFiber.lanes = 1;
                if (componentFiber.alternate) {
                  componentFiber.alternate.lanes = 1;
                }

                // Schedule update on root
                let rootFiber = componentFiber;
                while (rootFiber.return) {
                  rootFiber = rootFiber.return;
                }
                const fiberRoot = rootFiber.stateNode;
                if (fiberRoot && fiberRoot.current) {
                  try {
                    if (typeof fiberRoot.ensureRootIsScheduled === 'function') {
                      fiberRoot.ensureRootIsScheduled(fiberRoot);
                    }
                  } catch (e) {
                    console.log('[HoverComp] Could not schedule root update:', e.message);
                  }
                }

                console.log('[HoverComp] State updated (fallback method)');
                window.postMessage({ type: 'UPDATE_SUCCESS' }, '*');
                return;
              }
              componentFiber = componentFiber.return;
            }

            console.warn('[HoverComp] State not found');
            window.postMessage({ type: 'UPDATE_ERROR', error: 'State not found' }, '*');
          }
        }
      } catch (e) {
        console.error('Error updating state:', e);
        window.postMessage({ type: 'UPDATE_ERROR', error: e.message }, '*');
      }
    }
  });

  function getFiberRoot(fiber) {
    let current = fiber;
    while (current.return) {
      current = current.return;
    }
    return current.stateNode;
  }

  function parseValue(value) {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  console.log('[HoverComp Dev Inspector] In-page script loaded');
})();
