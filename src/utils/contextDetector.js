/**
 * Context and dependency injection detection
 * For React Context, Vue Provide/Inject, and Svelte Context
 */

/**
 * Detect React Context usage
 * @param {HTMLElement} element - DOM element
 * @returns {Array} Array of context objects
 */
export function detectReactContext(element) {
  try {
    const fiberKey = Object.keys(element).find(key => key.startsWith('__reactFiber'));
    if (!fiberKey) return [];
    
    let fiber = element[fiberKey];
    const contexts = [];
    const seenContexts = new Set();
    let depth = 0;
    const MAX_DEPTH = 50; // Prevent infinite loops
    
    // Walk up the fiber tree to find context providers
    while (fiber && depth < MAX_DEPTH) {
      depth++;
      
      // Limit the number of contexts to prevent memory issues
      if (contexts.length >= 20) break;
      // Check if fiber is a context provider
      if (fiber.type && fiber.type._context) {
        const context = fiber.type._context;
        const contextKey = context.displayName || context._currentValue || 'Context';
        
        if (!seenContexts.has(contextKey)) {
          seenContexts.add(contextKey);
          
          contexts.push({
            name: contextKey,
            type: 'Provider',
            value: context._currentValue,
            defaultValue: context._defaultValue,
          });
        }
      }
      
      // Check if fiber consumes context
      if (fiber.dependencies) {
        let dependency = fiber.dependencies.firstContext;
        while (dependency) {
          const context = dependency.context;
          const contextKey = context.displayName || context._currentValue || 'Context';
          
          if (!seenContexts.has(contextKey)) {
            seenContexts.add(contextKey);
            
            contexts.push({
              name: contextKey,
              type: 'Consumer',
              value: context._currentValue,
              defaultValue: context._defaultValue,
            });
          }
          
          dependency = dependency.next;
        }
      }
      
      fiber = fiber.return;
    }
    
    return contexts;
  } catch (e) {
    return [];
  }
}

/**
 * Detect Vue provide/inject
 * @param {HTMLElement} element - DOM element
 * @returns {Array} Array of provided/injected values
 */
export function detectVueInject(element) {
  try {
    let current = element;
    const injections = [];
    const seenKeys = new Set();
    let depth = 0;
    const MAX_DEPTH = 50; // Prevent infinite loops
    
    // Vue 3
    const vueInstance = current.__vueParentComponent || current.__vnode;
    if (vueInstance) {
      let instance = vueInstance.component || vueInstance;
      
      while (instance && depth < MAX_DEPTH) {
        depth++;
        
        // Limit the number of injections to prevent memory issues
        if (injections.length >= 20) break;
        // Check provides
        if (instance.provides && typeof instance.provides === 'object') {
          for (const key in instance.provides) {
            if (!seenKeys.has(key)) {
              seenKeys.add(key);
              
              injections.push({
                name: key,
                type: 'Provide',
                value: instance.provides[key],
              });
            }
          }
        }
        
        // Check injects
        if (instance.inject && typeof instance.inject === 'object') {
          for (const key in instance.inject) {
            if (!seenKeys.has(key)) {
              seenKeys.add(key);
              
              const injectConfig = instance.inject[key];
              injections.push({
                name: key,
                type: 'Inject',
                value: instance.ctx[key],
                from: injectConfig.from || key,
              });
            }
          }
        }
        
        instance = instance.parent;
      }
      
      return injections;
    }
    
    // Vue 2
    const vue = current.__vue__;
    if (vue) {
      let instance = vue;
      depth = 0; // Reset depth for Vue 2
      
      while (instance && depth < MAX_DEPTH) {
        depth++;
        
        // Limit the number of injections to prevent memory issues
        if (injections.length >= 20) break;
        // Check _provided
        if (instance._provided) {
          for (const key in instance._provided) {
            if (!seenKeys.has(key)) {
              seenKeys.add(key);
              
              injections.push({
                name: key,
                type: 'Provide',
                value: instance._provided[key],
              });
            }
          }
        }
        
        // Check inject option
        if (instance.$options.inject) {
          const injectOptions = instance.$options.inject;
          const injectKeys = Array.isArray(injectOptions) ? injectOptions : Object.keys(injectOptions);
          
          injectKeys.forEach(key => {
            if (!seenKeys.has(key)) {
              seenKeys.add(key);
              
              injections.push({
                name: key,
                type: 'Inject',
                value: instance[key],
              });
            }
          });
        }
        
        instance = instance.$parent;
      }
      
      return injections;
    }
    
    return [];
  } catch (e) {
    return [];
  }
}

/**
 * Detect Svelte context
 * @param {HTMLElement} element - DOM element
 * @returns {Array} Array of context values
 */
export function detectSvelteContext(element) {
  try {
    // Svelte context is typically accessed via getContext/setContext
    // but is not directly exposed in the component instance
    // We can detect if context is used by checking for context-related code
    
    const svelteKeys = Object.keys(element).filter(
      key => key.startsWith('__svelte_') || key === '__svelte'
    );
    
    if (svelteKeys.length === 0 && !element.$$) return [];
    
    const component = svelteKeys.length > 0 ? element[svelteKeys[0]] : element;
    const contexts = [];
    const MAX_CONTEXTS = 20; // Limit number of contexts
    
    // Check component context (limited access)
    if (component.$$ && component.$$.context) {
      const contextMap = component.$$.context;
      
      if (contextMap instanceof Map) {
        let count = 0;
        for (const [key, value] of contextMap) {
          if (count >= MAX_CONTEXTS) break;
          contexts.push({
            name: String(key),
            type: 'Context',
            value: value,
          });
          count++;
        }
      }
    }
    
    return contexts;
  } catch (e) {
    return [];
  }
}

/**
 * Format context/injection info as HTML
 * @param {Array} contexts - Array of context objects
 * @param {string} framework - Framework name
 * @returns {string} HTML string
 */
export function formatContextInfo(contexts, framework) {
  if (!contexts || contexts.length === 0) return '';
  
  const title = framework.toLowerCase().includes('react') ? 'Context' :
                framework.toLowerCase().includes('vue') ? 'Provide/Inject' :
                'Context';
  
  let html = '<div style="margin-top: 12px; padding: 8px; background: rgba(156,39,176,0.1); border-radius: 4px; border-left: 3px solid #ab47bc;">';
  html += '<div class="toggle-section" style="color: #ce93d8; font-size: 10px; font-weight: bold; margin-bottom: 0px; cursor: pointer;">▶ ' + title + ' (' + contexts.length + ')</div>';
  html += '<div style="display: none; margin-top: 6px; font-size: 10px;">';
  
  contexts.forEach(ctx => {
    html += '<div style="margin: 6px 0; padding: 6px; background: rgba(0,0,0,0.3); border-radius: 3px;">';
    
    html += '<div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">';
    html += '<span style="color: #ce93d8; font-weight: bold;">' + escapeHtml(ctx.name) + '</span>';
    
    const typeColor = ctx.type === 'Provider' || ctx.type === 'Provide' ? '#4caf50' : 
                     ctx.type === 'Consumer' || ctx.type === 'Inject' ? '#ff9800' : '#90caf9';
    html += '<span style="background: ' + typeColor + '; color: white; padding: 1px 4px; border-radius: 2px; font-size: 8px;">' + ctx.type + '</span>';
    html += '</div>';
    
    if (ctx.value !== undefined) {
      html += '<div style="color: #ba68c8; font-size: 9px; margin-top: 4px; padding: 4px; background: rgba(0,0,0,0.2); border-radius: 2px; word-break: break-all;">';
      html += formatValue(ctx.value);
      html += '</div>';
    }
    
    if (ctx.defaultValue !== undefined) {
      html += '<div style="color: #888; font-size: 9px; margin-top: 2px;">Default: ' + formatValue(ctx.defaultValue) + '</div>';
    }
    
    if (ctx.from) {
      html += '<div style="color: #888; font-size: 9px; margin-top: 2px;">From: ' + escapeHtml(ctx.from) + '</div>';
    }
    
    html += '</div>';
  });
  
  html += '</div></div>';
  
  return html;
}

/**
 * Format value for display
 */
function formatValue(value) {
  if (value === null) return '<span style="color: #999;">null</span>';
  if (value === undefined) return '<span style="color: #999;">undefined</span>';
  if (typeof value === 'string') return '<span style="color: #a5d6a7;">"' + escapeHtml(value) + '"</span>';
  if (typeof value === 'number') return '<span style="color: #90caf9;">' + value + '</span>';
  if (typeof value === 'boolean') return '<span style="color: #ce93d8;">' + value + '</span>';
  if (typeof value === 'function') return '<span style="color: #999;">[Function]</span>';
  if (typeof value === 'object') {
    try {
      const str = JSON.stringify(value, null, 2);
      if (str.length > 100) {
        return '<span style="color: #999;">{...}</span>';
      }
      return '<span style="color: #999;">' + escapeHtml(str) + '</span>';
    } catch {
      return '<span style="color: #999;">{Object}</span>';
    }
  }
  return escapeHtml(String(value));
}

/**
 * Escape HTML
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
