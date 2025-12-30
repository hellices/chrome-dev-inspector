/**
 * Creates a throttled function that only invokes the provided function
 * at most once per specified wait period.
 *
 * @param {Function} func - The function to throttle
 * @param {number} wait - The number of milliseconds to throttle invocations to
 * @returns {Function} Returns the new throttled function
 */
function throttle(func, wait) {
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

// Export for Node.js environment (tests)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { throttle };
}
