/**
 * CSS and style management utilities
 */

/**
 * Get CSS information for an element
 * @param {HTMLElement} element - Target element
 * @returns {Object} CSS information
 */
export function getCSSInfo(element) {
  const styles = window.getComputedStyle(element);
  
  return {
    classes: Array.from(element.classList),
    styles: getComputedStyles(styles),
    inlineStyles: element.style.cssText || '',
    matchedRules: getMatchedCSSRules(element)
  };
}

/**
 * Get computed styles for an element
 * @param {CSSStyleDeclaration} styles - Computed styles
 * @returns {Object} Key computed style properties
 */
function getComputedStyles(styles) {
  return {
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
    fontWeight: styles.fontWeight || '',
    border: styles.border || '',
    borderRadius: styles.borderRadius || '',
    flexDirection: styles.flexDirection || '',
    justifyContent: styles.justifyContent || '',
    alignItems: styles.alignItems || '',
    gridTemplateColumns: styles.gridTemplateColumns || '',
    zIndex: styles.zIndex || '',
    opacity: styles.opacity || '',
    overflow: styles.overflow || '',
    textAlign: styles.textAlign || '',
    lineHeight: styles.lineHeight || '',
    boxSizing: styles.boxSizing || '',
    cursor: styles.cursor || '',
    pointerEvents: styles.pointerEvents || '',
    transform: styles.transform || '',
    transition: styles.transition || ''
  };
}

/**
 * Get matched CSS rules for an element
 * @param {HTMLElement} element - Target element
 * @returns {Array} Array of matched rules
 */
function getMatchedCSSRules(element) {
  const matchedRules = [];
  
  try {
    for (const sheet of document.styleSheets) {
      try {
        for (const rule of sheet.cssRules || []) {
          if (rule instanceof CSSStyleRule && element.matches(rule.selectorText)) {
            matchedRules.push({
              selector: rule.selectorText,
              source: sheet.href || 'inline',
              styles: rule.style.cssText
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
  
  return matchedRules;
}

/**
 * Apply inline style to element
 * @param {HTMLElement} element - Target element
 * @param {string} property - CSS property
 * @param {string} value - CSS value
 * @param {boolean} important - Use !important
 */
export function applyInlineStyle(element, property, value, important = false) {
  const cleanValue = value.replace('!important', '').trim();
  if (important) {
    element.style.setProperty(property, cleanValue, 'important');
  } else {
    element.style.setProperty(property, cleanValue);
  }
}

/**
 * Remove inline style from element
 * @param {HTMLElement} element - Target element
 * @param {string} property - CSS property
 */
export function removeInlineStyle(element, property) {
  element.style.removeProperty(property);
}

/**
 * Toggle CSS class on element
 * @param {HTMLElement} element - Target element
 * @param {string} className - Class name
 * @param {boolean} enable - Enable or disable
 */
export function toggleClass(element, className, enable) {
  if (enable) {
    element.classList.add(className);
  } else {
    element.classList.remove(className);
  }
}

/**
 * Get list of all CSS properties
 * @returns {Array<string>} Array of CSS property names
 */
export function getAllCSSProperties() {
  const dummyElement = document.createElement('div');
  document.body.appendChild(dummyElement);
  const computedStyle = window.getComputedStyle(dummyElement);
  const allCssProperties = Array.from(computedStyle).filter(prop => 
    !prop.startsWith('webkit') && !prop.startsWith('moz') && !prop.startsWith('ms')
  ).sort();
  document.body.removeChild(dummyElement);
  return allCssProperties;
}

/**
 * Get common values for a CSS property
 * @param {string} property - CSS property name
 * @returns {Array<string>} Array of common values
 */
export function getCommonCSSValues(property) {
  const commonValues = {
    'display': ['none', 'block', 'inline', 'inline-block', 'flex', 'grid', 'inline-flex', 'inline-grid', 'contents', 'flow-root'],
    'position': ['static', 'relative', 'absolute', 'fixed', 'sticky'],
    'flex-direction': ['row', 'column', 'row-reverse', 'column-reverse'],
    'justify-content': ['flex-start', 'flex-end', 'center', 'space-between', 'space-around', 'space-evenly', 'stretch'],
    'align-items': ['flex-start', 'flex-end', 'center', 'baseline', 'stretch'],
    'text-align': ['left', 'center', 'right', 'justify', 'start', 'end'],
    'cursor': ['auto', 'default', 'pointer', 'grab', 'grabbing', 'move', 'text', 'wait', 'help', 'not-allowed', 'crosshair'],
    'overflow': ['visible', 'hidden', 'scroll', 'auto', 'clip'],
    'overflow-x': ['visible', 'hidden', 'scroll', 'auto', 'clip'],
    'overflow-y': ['visible', 'hidden', 'scroll', 'auto', 'clip'],
    'font-weight': ['normal', 'bold', 'lighter', 'bolder', '100', '200', '300', '400', '500', '600', '700', '800', '900'],
    'font-style': ['normal', 'italic', 'oblique'],
    'text-decoration': ['none', 'underline', 'overline', 'line-through'],
    'text-transform': ['none', 'capitalize', 'uppercase', 'lowercase'],
    'white-space': ['normal', 'nowrap', 'pre', 'pre-wrap', 'pre-line'],
    'visibility': ['visible', 'hidden', 'collapse'],
    'pointer-events': ['auto', 'none'],
    'box-sizing': ['content-box', 'border-box'],
    'object-fit': ['fill', 'contain', 'cover', 'none', 'scale-down']
  };
  
  // Color-related properties
  if (property.includes('color') || property === 'background-color' || property === 'border-color') {
    return ['transparent', 'currentColor', 'white', 'black', 'red', 'blue', 'green', 'yellow', 'gray', 
            '#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff', 
            'rgb(0, 0, 0)', 'rgba(0, 0, 0, 1)', 'hsl(0, 0%, 0%)', 'hsla(0, 0%, 0%, 1)'];
  }
  
  return commonValues[property] || [];
}

/**
 * Get disabled value for a CSS property (used when disabling computed styles)
 * @param {string} property - CSS property name
 * @returns {string} Disabled value
 */
export function getDisabledValue(property) {
  if (property === 'display') return 'none';
  if (property === 'opacity') return '0';
  if (property === 'visibility') return 'hidden';
  if (property.includes('color') || property.includes('background')) return 'transparent';
  if (property.includes('width') || property.includes('height')) return 'auto';
  if (property.includes('margin') || property.includes('padding')) return '0';
  if (property.includes('border')) return 'none';
  return 'unset';
}
