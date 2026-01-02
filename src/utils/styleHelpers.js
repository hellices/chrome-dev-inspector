/**
 * Style utilities for UI components
 */

/**
 * Common input styles
 */
export const INPUT_STYLES = {
  base: 'background: rgba(25,118,210,0.2); color: #fff; border: 1px solid #1976d2; padding: 4px 8px; border-radius: 3px; font-size: 10px; width: 100%; margin-top: 4px; outline: none;',
  focused: 'background: rgba(25,118,210,0.3); border-color: #42a5f5;',
};

/**
 * Common button styles
 */
export const BUTTON_STYLES = {
  primary:
    'background: linear-gradient(135deg, #61dafb, #4a9cc5); color: white; border: none; padding: 10px 24px; border-radius: 6px; font-size: 12px; font-weight: bold; cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 12px rgba(97, 218, 251, 0.3);',
  secondary:
    'background: rgba(25,118,210,0.2); color: #fff; border: 1px solid #1976d2; padding: 6px 12px; border-radius: 4px; font-size: 11px; cursor: pointer; transition: all 0.2s;',
};

/**
 * Create styled element
 * @param {string} tag - HTML tag name
 * @param {Object} options - Element options
 * @returns {HTMLElement} Styled element
 */
export function createStyledElement(tag, options = {}) {
  const element = document.createElement(tag);
  
  if (options.className) {
    element.className = options.className;
  }
  
  if (options.id) {
    element.id = options.id;
  }
  
  if (options.style) {
    element.style.cssText = options.style;
  }
  
  if (options.textContent) {
    element.textContent = options.textContent;
  }
  
  if (options.innerHTML) {
    element.innerHTML = options.innerHTML;
  }
  
  if (options.attributes) {
    Object.entries(options.attributes).forEach(([key, value]) => {
      element.setAttribute(key, value);
    });
  }
  
  return element;
}

/**
 * Apply hover effect to element
 * @param {HTMLElement} element - Target element
 * @param {Object} hoverStyles - Styles to apply on hover
 * @param {Object} defaultStyles - Default styles
 */
export function applyHoverEffect(element, hoverStyles, defaultStyles) {
  element.addEventListener('mouseenter', () => {
    Object.assign(element.style, hoverStyles);
  });
  
  element.addEventListener('mouseleave', () => {
    Object.assign(element.style, defaultStyles);
  });
}

/**
 * Framework color schemes
 */
export const FRAMEWORK_COLORS = {
  react: {
    primary: '#61dafb',
    bg: 'rgba(97, 218, 251, 0.1)',
    border: 'rgba(97, 218, 251, 0.3)',
  },
  vue: {
    primary: '#42b883',
    bg: 'rgba(66, 184, 131, 0.1)',
    border: 'rgba(66, 184, 131, 0.3)',
  },
  svelte: {
    primary: '#ff3e00',
    bg: 'rgba(255, 62, 0, 0.1)',
    border: 'rgba(255, 62, 0, 0.3)',
  },
  angular: {
    primary: '#dd0031',
    bg: 'rgba(221, 0, 49, 0.1)',
    border: 'rgba(221, 0, 49, 0.3)',
  },
  html: {
    primary: '#ff9800',
    bg: 'rgba(255, 152, 0, 0.1)',
    border: 'rgba(255, 152, 0, 0.3)',
  },
};

/**
 * Get framework color scheme
 * @param {string} framework - Framework name
 * @returns {Object} Color scheme
 */
export function getFrameworkColors(framework) {
  const normalizedFramework = framework.toLowerCase();
  
  if (normalizedFramework.includes('react')) {
    return FRAMEWORK_COLORS.react;
  } else if (normalizedFramework.includes('vue')) {
    return FRAMEWORK_COLORS.vue;
  } else if (normalizedFramework.includes('svelte')) {
    return FRAMEWORK_COLORS.svelte;
  } else if (normalizedFramework.includes('angular')) {
    return FRAMEWORK_COLORS.angular;
  }
  
  return FRAMEWORK_COLORS.html;
}

/**
 * Create editable element styles
 * @param {string} color - Primary color
 * @returns {Object} Style configuration
 */
export function createEditableStyles(color) {
  return {
    focus: {
      background: `${color}80`, // 50% opacity
      outline: `2px solid ${color}`,
      boxShadow: `0 0 8px ${color}66`, // ~40% opacity
    },
    blur: {
      background: 'rgba(0, 0, 0, 0.3)',
      outline: 'none',
      boxShadow: 'none',
    },
  };
}
