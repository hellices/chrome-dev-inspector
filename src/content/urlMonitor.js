/**
 * URL Monitor - Monitors URL changes and resets overlay state on navigation
 */

/**
 * Handle URL change
 */
export function handleUrlChange(state, resetOverlayStateFn, hideOverlayFn, hideReactOverlayFn, hideVueOverlayFn) {
  const newUrl = window.location.href;
  if (newUrl !== state.currentUrl) {
    console.log('[HoverComp] URL changed from', state.currentUrl, 'to', newUrl);
    console.log('[HoverComp] Pinned state:', state.isPinned);
    state.currentUrl = newUrl;
    if (state.isPinned) {
      console.log('[HoverComp] Unpinning and resetting overlay');
      resetOverlayStateFn(hideOverlayFn, hideReactOverlayFn, hideVueOverlayFn);
    } else {
      console.log('[HoverComp] Hiding overlay (not pinned)');
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
  setInterval(() => {
    handleChange();
  }, 500);

  // Monitor DOM mutations that might indicate navigation
  const observer = new MutationObserver(() => {
    handleChange();
  });

  // Observe title changes (common during navigation)
  const titleElement = document.querySelector('title');
  if (titleElement) {
    observer.observe(titleElement, { childList: true, characterData: true, subtree: true });
  }
}
