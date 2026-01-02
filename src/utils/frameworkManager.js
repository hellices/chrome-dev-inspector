/**
 * Framework detection and management utilities
 */

/**
 * Detect frameworks on page
 * @param {Set} detectedFromInpage - Frameworks detected from inpage script
 * @returns {Array<string>} Array of detected framework names
 */
export function detectFrameworksOnPage(detectedFromInpage) {
  const frameworks = [];

  // Check for React
  let hasReact = window.__REACT_DEVTOOLS_GLOBAL_HOOK__?.renderers;
  if (!hasReact && detectedFromInpage.has('react')) {
    hasReact = true;
  }
  if (hasReact) {
    frameworks.push('react');
  }

  // Check for Vue 2
  let hasVue2 = window.Vue;
  if (!hasVue2 && detectedFromInpage.has('vue2')) {
    hasVue2 = true;
  }
  if (hasVue2) {
    frameworks.push('vue2');
  }

  // Check for Vue 3
  let hasVue3 = window.__VUE__ || window.__VUE_DEVTOOLS_GLOBAL_HOOK__;
  if (!hasVue3 && detectedFromInpage.has('vue3')) {
    hasVue3 = true;
  }
  if (hasVue3 && !hasVue2) {
    frameworks.push('vue3');
  }

  // Check for Svelte
  let hasSvelte = checkSvelteOnPage();
  if (!hasSvelte && detectedFromInpage.has('svelte')) {
    hasSvelte = true;
  }
  if (hasSvelte) {
    frameworks.push('svelte');
  }

  // Check for Angular
  if (window.ng || window.getAllAngularRootElements) {
    frameworks.push('angular');
  }

  return frameworks;
}

/**
 * Check if Svelte is present on the page
 * @returns {boolean} True if Svelte is detected
 */
function checkSvelteOnPage() {
  // Method 1: Check for Svelte components in development mode
  if (checkSvelteInElements()) {
    return true;
  }

  // Method 2: Check for SvelteKit indicators (production mode)
  if (checkSvelteKitIndicators()) {
    return true;
  }

  // Method 3: Check for Svelte hydration markers
  if (checkSvelteHydrationMarkers()) {
    return true;
  }

  return false;
}

/**
 * Check for Svelte in DOM elements
 * @returns {boolean} True if Svelte properties found
 */
function checkSvelteInElements() {
  const elements = document.querySelectorAll('*');
  for (const el of elements) {
    // Check for __svelte_ keys (dev mode)
    const hasSvelteKey = Object.keys(el).some(
      (key) => key.startsWith('__svelte_') || key === '__svelte'
    );
    if (hasSvelteKey) return true;

    // Check for $$ property (Svelte 4+ dev mode)
    if (el.$$ && typeof el.$$ === 'object') return true;

    // Check for svelte data attributes or classes
    if (
      el.hasAttribute &&
      (el.hasAttribute('data-svelte-h') ||
        (el.className && typeof el.className === 'string' && el.className.includes('svelte-')))
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Check for SvelteKit indicators
 * @returns {boolean} True if SvelteKit found
 */
function checkSvelteKitIndicators() {
  const scripts = document.querySelectorAll('script[src]');
  for (const script of scripts) {
    const src = script.getAttribute('src') || '';
    if (
      src.includes('/_app/') ||
      src.includes('/immutable/') ||
      src.includes('.svelte') ||
      src.includes('sveltekit')
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Check for Svelte hydration markers
 * @returns {boolean} True if hydration markers found
 */
function checkSvelteHydrationMarkers() {
  const hasHydrationMarker =
    document.querySelector('[data-svelte-h]') || document.querySelector('[class*="svelte-"]');
  return !!hasHydrationMarker;
}

/**
 * Track detected framework from component info
 * @param {Object} componentInfo - Component information
 * @param {Set} detectedSet - Set to track detected frameworks
 */
export function trackDetectedFramework(componentInfo, detectedSet) {
  if (componentInfo?.framework) {
    const framework = componentInfo.framework.toLowerCase();
    if (framework.includes('react')) {
      detectedSet.add('react');
    } else if (framework.includes('vue 3')) {
      detectedSet.add('vue3');
    } else if (framework.includes('vue 2') || framework.includes('vue')) {
      detectedSet.add('vue2');
    } else if (framework.includes('svelte')) {
      detectedSet.add('svelte');
    }
  }
}

/**
 * Validate and set inspection mode
 * @param {string} mode - Desired inspection mode
 * @param {Array<string>} detectedFrameworks - List of detected frameworks
 * @returns {boolean} True if mode is valid and set
 */
export function validateInspectionMode(mode, detectedFrameworks) {
  const validModes = ['auto', 'html', ...detectedFrameworks];
  return validModes.includes(mode);
}
