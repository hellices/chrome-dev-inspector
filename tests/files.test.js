/**
 * File existence tests
 */

const fs = require('fs');
const path = require('path');

describe('Required Files', () => {
  const rootDir = path.join(__dirname, '..');

  test('manifest.json exists', () => {
    const manifestPath = path.join(rootDir, 'manifest.json');
    expect(fs.existsSync(manifestPath)).toBe(true);
  });

  test('content-loader.js exists', () => {
    const loaderPath = path.join(rootDir, 'src', 'content-loader.js');
    expect(fs.existsSync(loaderPath)).toBe(true);
  });

  test('content.js exists', () => {
    const contentPath = path.join(rootDir, 'src', 'content.js');
    expect(fs.existsSync(contentPath)).toBe(true);
  });

  test('inpage.js exists', () => {
    const inpagePath = path.join(rootDir, 'src', 'inpage.js');
    expect(fs.existsSync(inpagePath)).toBe(true);
  });

  test('all required utility files exist', () => {
    const utilFiles = [
      'domHelpers.js',
      'messageHandler.js',
      'cssHelper.js',
      'formatters.js',
      'htmlHelpers.js',
      'frameworkDetect.js',
    ];

    utilFiles.forEach((file) => {
      const filePath = path.join(rootDir, 'src', 'utils', file);
      expect(fs.existsSync(filePath)).toBe(true);
    });
  });

  test('all required overlay files exist', () => {
    const overlayFiles = [
      'overlayManager.js',
      'eventHandlers.js',
      'advancedHandlers.js',
      'cssFormatter.js',
    ];

    overlayFiles.forEach((file) => {
      const filePath = path.join(rootDir, 'src', 'overlay', file);
      expect(fs.existsSync(filePath)).toBe(true);
    });
  });

  test('icons exist', () => {
    const icons = ['icon16.png', 'icon48.png', 'icon128.png'];

    icons.forEach((icon) => {
      const iconPath = path.join(rootDir, 'icons', icon);
      expect(fs.existsSync(iconPath)).toBe(true);
    });
  });

  test('styles exist', () => {
    const cssPath = path.join(rootDir, 'styles', 'overlay.css');
    expect(fs.existsSync(cssPath)).toBe(true);
  });
});
