/**
 * Module exports validation tests
 */

describe('Module Exports', () => {
  test('constants module exports required values', () => {
    const constants = require('../src/config/constants.js');

    expect(constants.THROTTLE_MS).toBeDefined();
    expect(constants.OVERLAY_Z_INDEX).toBeDefined();
    expect(constants.MESSAGE_TYPES).toBeDefined();
    expect(constants.CSS_CLASSES).toBeDefined();
  });

  test('frameworkDetect exports detection functions', () => {
    const frameworkDetect = require('../src/utils/frameworkDetect.js');

    expect(typeof frameworkDetect.detectComponent).toBe('function');
    expect(typeof frameworkDetect.detectReact).toBe('function');
    expect(typeof frameworkDetect.detectVue2).toBe('function');
    expect(typeof frameworkDetect.detectVue3).toBe('function');
  });
});
