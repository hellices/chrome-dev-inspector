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

  return function throttled(...args) {
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

  return function debounced(...args) {
    const context = this;
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(context, args), wait);
  };
}

// Export for Node.js environment (tests)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { throttle };
}
