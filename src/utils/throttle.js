/**
 * Creates a throttled function that only invokes the provided function
 * at most once per specified wait period.
 *
 * @param {Function} func - The function to throttle
 * @param {number} wait - The number of milliseconds to throttle invocations to
 * @returns {Function} Returns the new throttled function
 *
 * @example
 * const throttledScroll = throttle(() => {
 *   console.log('Scroll event');
 * }, 100);
 * window.addEventListener('scroll', throttledScroll);
 */
export function throttle(func, wait) {
  let timeout = null;
  let lastRan = null;

  const throttled = function throttled(...args) {
    const context = this;

    if (!lastRan) {
      func.apply(context, args);
      lastRan = Date.now();
    } else {
      clearTimeout(timeout);
      timeout = setTimeout(
        () => {
          if (Date.now() - lastRan >= wait) {
            func.apply(context, args);
            lastRan = Date.now();
          }
        },
        wait - (Date.now() - lastRan)
      );
    }
  };
  
  // Add cancel method to cleanup timeouts
  throttled.cancel = function() {
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
    }
    lastRan = null;
  };
  
  return throttled;
}

/**
 * Creates a debounced function that delays invoking func until after wait
 * milliseconds have elapsed since the last time it was invoked.
 *
 * @param {Function} func - The function to debounce
 * @param {number} wait - The number of milliseconds to delay
 * @returns {Function} Returns the new debounced function
 *
 * @example
 * const debouncedInput = debounce((value) => {
 *   console.log('Input value:', value);
 * }, 300);
 * input.addEventListener('input', (e) => debouncedInput(e.target.value));
 */
export function debounce(func, wait) {
  let timeout = null;

  const debounced = function debounced(...args) {
    const context = this;
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(context, args), wait);
  };
  
  // Add cancel method to cleanup timeouts
  debounced.cancel = function() {
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
    }
  };
  
  return debounced;
}

// Export for Node.js environment (tests)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { throttle };
}
