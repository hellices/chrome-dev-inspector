/**
 * Component tree visualization utilities
 * Inspired by React DevTools component tree
 */

import { escapeHtml } from './domHelpers.js';

/**
 * Build component tree structure
 * @param {HTMLElement} element - Root element
 * @param {string} framework - Framework name
 * @param {number} maxDepth - Maximum depth to traverse
 * @returns {Object|null} Tree structure
 */
export function buildComponentTree(element, framework = 'react', maxDepth = 5) {
  if (!element) return null;
  
  // Limit max depth to prevent excessive memory usage
  const safeMaxDepth = Math.min(maxDepth, 8);
  
  const builders = {
    react: buildReactTree,
    vue: buildVueTree,
    svelte: buildSvelteTree,
  };
  
  const builder = builders[framework.toLowerCase().split(' ')[0]];
  if (!builder) return null;
  
  return builder(element, safeMaxDepth);
}

/**
 * Build React component tree
 */
function buildReactTree(element, maxDepth) {
  try {
    const fiberKey = Object.keys(element).find(key => key.startsWith('__reactFiber'));
    if (!fiberKey) return null;
    
    let fiber = element[fiberKey];
    const tree = [];
    let currentDepth = 0;
    
    // Walk up the tree
    while (fiber && currentDepth < maxDepth) {
      const componentType = fiber.type;
      
      if (componentType && typeof componentType === 'function') {
        const name = componentType.displayName || componentType.name;
        
        if (name && name.length > 0 && !name.startsWith('_')) {
          const isUserComponent = !name.match(/^(Fragment|Suspense|StrictMode|Provider|Consumer|Context|Profiler)$/);
          
          tree.push({
            name,
            isUserComponent,
            depth: currentDepth,
            hasState: !!fiber.memoizedState,
            hasProps: !!fiber.memoizedProps,
            key: fiber.key,
          });
          
          currentDepth++;
        }
      }
      
      fiber = fiber.return;
    }
    
    return tree.reverse();
  } catch (e) {
    return null;
  }
}

/**
 * Build Vue component tree
 */
function buildVueTree(element, maxDepth) {
  try {
    let current = element;
    const tree = [];
    
    // Vue 3
    const vueInstance = current.__vueParentComponent || current.__vnode;
    if (vueInstance) {
      let instance = vueInstance.component || vueInstance;
      let depth = 0;
      
      while (instance && depth < maxDepth) {
        const component = instance.type;
        if (component) {
          const name = component.name || component.__name || component.displayName;
          
          if (name && !name.startsWith('_')) {
            tree.push({
              name,
              isUserComponent: !name.match(/^(Transition|TransitionGroup|KeepAlive|Suspense|Teleport)$/),
              depth,
              hasState: !!(instance.setupState || instance.data),
              hasProps: !!instance.props,
            });
            
            depth++;
          }
        }
        
        instance = instance.parent;
      }
      
      return tree.reverse();
    }
    
    // Vue 2
    const vue = current.__vue__;
    if (vue) {
      let instance = vue;
      let depth = 0;
      
      while (instance && depth < maxDepth) {
        const name = instance.$options.name || instance.$options._componentTag || instance.constructor?.name;
        
        if (name && name !== 'Vue' && name !== 'VueComponent') {
          tree.push({
            name,
            isUserComponent: true,
            depth,
            hasState: !!(instance.$data && Object.keys(instance.$data).length > 0),
            hasProps: !!(instance.$props && Object.keys(instance.$props).length > 0),
          });
          
          depth++;
        }
        
        instance = instance.$parent;
      }
      
      return tree.reverse();
    }
    
    return null;
  } catch (e) {
    return null;
  }
}

/**
 * Build Svelte component tree
 */
function buildSvelteTree(element, maxDepth) {
  try {
    let current = element;
    const tree = [];
    
    // Find Svelte component
    const svelteKeys = Object.keys(current).filter(
      key => key.startsWith('__svelte_') || key === '__svelte'
    );
    
    if (svelteKeys.length === 0 && !current.$$) return null;
    
    let component = svelteKeys.length > 0 ? current[svelteKeys[0]] : current;
    let depth = 0;
    
    while (component && component.$$ && depth < maxDepth) {
      const fileName = component.$$.ctx?.__file || '';
      const name = component.constructor?.name || 
                   fileName.split('/').pop()?.replace('.svelte', '') ||
                   'SvelteComponent';
      
      if (name && name !== 'SvelteComponent' && name !== 'ProxyComponent') {
        const hasProps = component.$$ && component.$$.props && 
                        Object.keys(component.$$.props).length > 0;
        
        tree.push({
          name,
          isUserComponent: !fileName.includes('node_modules'),
          depth,
          hasState: true,
          hasProps,
        });
        
        depth++;
      }
      
      component = component.$$.parent;
    }
    
    return tree.reverse();
  } catch (e) {
    return null;
  }
}

/**
 * Format component tree as HTML
 * @param {Array} tree - Component tree array
 * @param {string} currentComponentName - Name of current component
 * @returns {string} HTML string
 */
export function formatComponentTree(tree, currentComponentName) {
  if (!tree || tree.length === 0) return '';
  
  let html = '<div style="margin-bottom: 12px; padding: 8px; background: rgba(255,255,255,0.03); border-radius: 4px;">';
  html += '<div class="toggle-section" style="color: #888; font-size: 10px; font-weight: bold; margin-bottom: 0px; cursor: pointer;">▶ Component Tree (' + tree.length + ')</div>';
  html += '<div style="display: none; margin-top: 6px; font-size: 10px;">';
  
  tree.forEach((node, index) => {
    const indent = '  '.repeat(node.depth);
    const isLast = index === tree.length - 1;
    const connector = node.depth === 0 ? '📦 ' : (isLast ? '└─ ' : '├─ ');
    const isCurrent = node.name === currentComponentName;
    const color = isCurrent ? '#61dafb' : (node.isUserComponent ? '#a5d6a7' : '#999');
    const weight = isCurrent ? 'bold' : 'normal';
    
    html += '<div style="margin: 3px 0; color: ' + color + '; font-weight: ' + weight + ';">';
    html += indent + connector + escapeHtml(node.name);
    
    // Add badges
    if (isCurrent) {
      html += ' <span style="background: #61dafb; color: #000; padding: 1px 4px; border-radius: 2px; font-size: 8px; margin-left: 4px;">CURRENT</span>';
    }
    if (node.hasState) {
      html += ' <span style="background: rgba(171,71,188,0.3); color: #ce93d8; padding: 1px 4px; border-radius: 2px; font-size: 8px; margin-left: 4px;">STATE</span>';
    }
    if (node.hasProps) {
      html += ' <span style="background: rgba(255,167,38,0.3); color: #ffa726; padding: 1px 4px; border-radius: 2px; font-size: 8px; margin-left: 4px;">PROPS</span>';
    }
    if (node.key) {
      html += ' <span style="color: #666; font-size: 9px; margin-left: 4px;">key=' + escapeHtml(String(node.key)) + '</span>';
    }
    
    html += '</div>';
  });
  
  html += '</div></div>';
  
  return html;
}

/**
 * Get component siblings (for navigation)
 * @param {HTMLElement} element - Current element
 * @param {string} framework - Framework name
 * @returns {Array} Array of sibling components
 */
export function getComponentSiblings(element, framework) {
  try {
    if (framework.toLowerCase().includes('react')) {
      const fiberKey = Object.keys(element).find(key => key.startsWith('__reactFiber'));
      if (!fiberKey) return [];
      
      const fiber = element[fiberKey];
      const siblings = [];
      
      // Get sibling fibers
      let current = fiber.sibling;
      while (current) {
        if (current.type && typeof current.type === 'function') {
          const name = current.type.displayName || current.type.name;
          if (name && name.length > 0) {
            siblings.push({
              name,
              element: current.stateNode,
            });
          }
        }
        current = current.sibling;
      }
      
      return siblings;
    }
    
    // TODO: Add Vue and Svelte sibling detection
    
    return [];
  } catch (e) {
    return [];
  }
}
