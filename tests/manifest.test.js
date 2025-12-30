/**
 * Manifest validation tests
 */

const fs = require('fs');
const path = require('path');

describe('Manifest Validation', () => {
  let manifest;

  beforeAll(() => {
    const manifestPath = path.join(__dirname, '..', 'manifest.json');
    const manifestContent = fs.readFileSync(manifestPath, 'utf-8');
    manifest = JSON.parse(manifestContent);
  });

  test('should have valid manifest version 3', () => {
    expect(manifest.manifest_version).toBe(3);
  });

  test('should have required fields', () => {
    expect(manifest.name).toBeTruthy();
    expect(manifest.version).toBeTruthy();
    expect(manifest.description).toBeTruthy();
  });

  test('should have content scripts configured', () => {
    expect(manifest.content_scripts).toBeDefined();
    expect(Array.isArray(manifest.content_scripts)).toBe(true);
    expect(manifest.content_scripts.length).toBeGreaterThan(0);
  });

  test('should have web accessible resources', () => {
    expect(manifest.web_accessible_resources).toBeDefined();
    expect(Array.isArray(manifest.web_accessible_resources)).toBe(true);
  });

  test('should have valid icons', () => {
    expect(manifest.icons).toBeDefined();
    expect(manifest.icons['16']).toBeTruthy();
    expect(manifest.icons['48']).toBeTruthy();
    expect(manifest.icons['128']).toBeTruthy();
  });
});
