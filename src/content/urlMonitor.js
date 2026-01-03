/**
 * URL Monitor - Monitors URL changes and resets overlay state on navigation
 */

// Store interval and observer for cleanup
let urlCheckInterval = null;
let titleObserver = null;

/**
 * Handle URL change
 */
export function handleUrlChange(state, resetOverlayStateFn, hideOverlayFn, hideReactOverlayFn, hideVueOverlayFn) {
  const newUrl = window.location.href;
  if (newUrl !== state.currentUrl) {
    state.currentUrl = newUrl;
    if (state.isPinned) {
      resetOverlayStateFn(hideOverlayFn, hideReactOverlayFn, hideVueOverlayFn);
    } else {
      // For non-pinned state, just hide the overlay
      hideOverlayFn(state.overlay);
      hideReactOverlayFn(state.reactOverlay);
      hideVueOverlayFn(state.vueOverlay);
      state.currentTarget = null;
    }
  }
}

/**
 * Monitor URL changes (SPA navigation, history API, etc.)
 */
export function monitorUrlChanges(state, resetOverlayStateFn, hideOverlayFn, hideReactOverlayFn, hideVueOverlayFn) {
  const handleChange = () => {
    handleUrlChange(state, resetOverlayStateFn, hideOverlayFn, hideReactOverlayFn, hideVueOverlayFn);
  };

  // Monitor pushState and replaceState
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

  history.pushState = function (...args) {
    const result = originalPushState.apply(this, args);
    setTimeout(() => handleChange(), 0);
    return result;
  };

  history.replaceState = function (...args) {
    const result = originalReplaceState.apply(this, args);
    setTimeout(() => handleChange(), 0);
    return result;
  };

  // Monitor popstate (back/forward buttons)
  window.addEventListener('popstate', () => {
    setTimeout(() => handleChange(), 0);
  });

  // Monitor hash changes
  window.addEventListener('hashchange', () => {
    setTimeout(() => handleChange(), 0);
  });

  // Periodic check for URL changes (fallback for edge cases)
  urlCheckInterval = setInterval(() => {
    handleChange();
  }, 2000); // Reduced frequency to avoid performance impact

  // Monitor DOM mutations that might indicate navigation
  titleObserver = new MutationObserver(() => {
    handleChange();
  });

  // Observe title changes (common during navigation)
  const titleElement = document.querySelector('title');
  if (titleElement) {
    titleObserver.observe(titleElement, { childList: true, characterData: true, subtree: true });
  }
}

/**
 * Cleanup URL monitoring resources
 */
export function cleanupUrlMonitor() {
  if (urlCheckInterval) {
    clearInterval(urlCheckInterval);
    urlCheckInterval = null;
  }
  if (titleObserver) {
    titleObserver.disconnect();
    titleObserver = null;
  }
}
