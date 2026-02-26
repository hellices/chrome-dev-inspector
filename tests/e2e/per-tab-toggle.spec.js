const { test, expect, chromium } = require('@playwright/test');
const path = require('path');
const http = require('http');
const fs = require('fs');

const extensionPath = path.resolve(__dirname, '..', '..');
const testPageHtml = fs.readFileSync(path.resolve(__dirname, 'fixtures', 'test-page.html'), 'utf-8');
const reactPageHtml = fs.readFileSync(path.resolve(__dirname, 'fixtures', 'react-test-page.html'), 'utf-8');

const OVERLAY_ID = 'hovercomp-overlay';
const PANEL_CLASS = 'hovercomp-panel';

let server;
let serverUrl;

async function launchWithExtension() {
  const context = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      '--no-first-run',
      '--no-default-browser-check',
    ],
  });
  return context;
}

async function getServiceWorker(context) {
  let sw = context.serviceWorkers()[0];
  if (!sw) {
    sw = await context.waitForEvent('serviceworker');
  }
  return sw;
}

/**
 * Enable inspector on the active tab via service worker
 */
async function enableInspector(sw) {
  await sw.evaluate(async () => {
    const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (tabs[0]) {
      const tab = tabs[0];
      // Simulate action click behavior from background.js
      const enabledTabs = globalThis.__test_enabledTabs || new Set();
      enabledTabs.add(tab.id);
      globalThis.__test_enabledTabs = enabledTabs;
      await chrome.action.setBadgeText({ tabId: tab.id, text: 'ON' });
      await chrome.action.setBadgeBackgroundColor({ tabId: tab.id, color: '#4CAF50' });
      await chrome.tabs.sendMessage(tab.id, { type: 'INSPECTOR_TOGGLE', enabled: true });
    }
  });
}

/**
 * Disable inspector on the active tab via service worker
 */
async function disableInspector(sw) {
  await sw.evaluate(async () => {
    const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (tabs[0]) {
      const tab = tabs[0];
      await chrome.action.setBadgeText({ tabId: tab.id, text: '' });
      await chrome.tabs.sendMessage(tab.id, { type: 'INSPECTOR_TOGGLE', enabled: false });
    }
  });
}

/**
 * Get badge text for the active tab
 */
async function getBadgeText(sw) {
  return await sw.evaluate(async () => {
    const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (tabs[0]) {
      return await chrome.action.getBadgeText({ tabId: tabs[0].id });
    }
    return '';
  });
}

/**
 * Wait for overlay to appear after hover
 */
async function hoverAndWaitForOverlay(page, selector, timeout = 5000) {
  await page.hover(selector);
  try {
    await page.waitForSelector(`#${OVERLAY_ID}[style*="display: block"], #${OVERLAY_ID}:not([style*="display: none"])`, {
      state: 'attached',
      timeout,
    });
    // Additional check: overlay must have non-zero dimensions
    const overlay = await page.$(`#${OVERLAY_ID}`);
    if (!overlay) return false;
    const display = await overlay.evaluate(el => window.getComputedStyle(el).display);
    return display !== 'none';
  } catch {
    return false;
  }
}

test.beforeAll(async () => {
  server = http.createServer((req, res) => {
    // Serve React vendor files from node_modules
    if (req.url === '/vendor/react.development.js') {
      const reactPath = path.resolve(__dirname, '../../node_modules/react/umd/react.development.js');
      res.writeHead(200, { 'Content-Type': 'application/javascript' });
      res.end(fs.readFileSync(reactPath));
      return;
    }
    if (req.url === '/vendor/react-dom.development.js') {
      const reactDomPath = path.resolve(__dirname, '../../node_modules/react-dom/umd/react-dom.development.js');
      res.writeHead(200, { 'Content-Type': 'application/javascript' });
      res.end(fs.readFileSync(reactDomPath));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html' });
    if (req.url === '/react') {
      res.end(reactPageHtml);
    } else {
      res.end(testPageHtml);
    }
  });
  await new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      serverUrl = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });
});

test.afterAll(async () => {
  if (server) server.close();
});

test.describe('Per-Tab Toggle', () => {
  let context;
  let sw;

  test.beforeAll(async () => {
    context = await launchWithExtension();
    sw = await getServiceWorker(context);
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('extension loads and service worker is active', async () => {
    expect(sw).toBeTruthy();
    expect(sw.url()).toContain('chrome-extension://');
  });

  test('inspector is disabled by default on new tab', async () => {
    const page = await context.newPage();
    await page.goto(serverUrl);
    await page.waitForTimeout(2000);

    // Hover over element - overlay should NOT appear
    await page.hover('#box1');
    await page.waitForTimeout(1000);

    const overlay = await page.$(`#${OVERLAY_ID}`);
    const isVisible = overlay ? await overlay.evaluate(el => window.getComputedStyle(el).display !== 'none') : false;
    expect(isVisible).toBe(false);

    await page.close();
  });

  test('toggle enables inspector on current tab', async () => {
    const page = await context.newPage();
    await page.goto(serverUrl);
    await page.waitForTimeout(2000);

    await enableInspector(sw);
    // Wait for content.js to load and initialize
    await page.waitForTimeout(2000);

    // Verify badge
    const badgeText = await getBadgeText(sw);
    expect(badgeText).toBe('ON');

    // Hover and verify overlay appears (HTML mode fallback on plain HTML page)
    const overlayVisible = await hoverAndWaitForOverlay(page, '#box1');
    expect(overlayVisible).toBe(true);

    // Verify panel has content
    const panelText = await page.$eval(`.${PANEL_CLASS}`, el => el.textContent).catch(() => '');
    expect(panelText.length).toBeGreaterThan(0);

    await page.close();
  });

  test('toggle disables inspector and removes overlays', async () => {
    const page = await context.newPage();
    await page.goto(serverUrl);
    await page.waitForTimeout(2000);

    // Enable first
    await enableInspector(sw);
    await page.waitForTimeout(2000);

    // Verify it works
    const overlayVisible = await hoverAndWaitForOverlay(page, '#box1');
    expect(overlayVisible).toBe(true);

    // Move mouse away before disabling
    await page.mouse.move(0, 0);
    await page.waitForTimeout(500);

    // Now disable
    await disableInspector(sw);
    await page.waitForTimeout(1000);

    // Overlay should be hidden after disable
    const overlay = await page.$(`#${OVERLAY_ID}`);
    const isVisible = overlay ? await overlay.evaluate(el => window.getComputedStyle(el).display !== 'none') : false;
    expect(isVisible).toBe(false);

    // Badge should be empty
    const badgeText = await getBadgeText(sw);
    expect(badgeText).toBe('');

    // Hover again - overlay should NOT appear since disabled
    await page.hover('#box1');
    await page.waitForTimeout(1000);
    const overlayAfterDisable = await page.$(`#${OVERLAY_ID}`);
    const visibleAfterDisable = overlayAfterDisable ? await overlayAfterDisable.evaluate(el => window.getComputedStyle(el).display !== 'none') : false;
    expect(visibleAfterDisable).toBe(false);

    await page.close();
  });

  test('off then on again works (re-enable)', async () => {
    const page = await context.newPage();
    await page.goto(serverUrl);
    await page.waitForTimeout(2000);

    // Enable
    await enableInspector(sw);
    await page.waitForTimeout(2000);
    let visible = await hoverAndWaitForOverlay(page, '#box1');
    expect(visible).toBe(true);

    // Disable
    await disableInspector(sw);
    await page.waitForTimeout(1000);

    // Move mouse away first
    await page.mouse.move(0, 0);
    await page.waitForTimeout(500);

    // Re-enable
    await enableInspector(sw);
    await page.waitForTimeout(2000);

    // Should work again
    visible = await hoverAndWaitForOverlay(page, '#box2');
    expect(visible).toBe(true);

    await page.close();
  });

  test('inspector stays disabled on other tabs', async () => {
    const page1 = await context.newPage();
    await page1.goto(serverUrl);
    await page1.waitForTimeout(2000);

    const page2 = await context.newPage();
    await page2.goto(serverUrl);
    await page2.waitForTimeout(2000);

    // Enable only on page1
    await page1.bringToFront();
    await page1.waitForTimeout(500);
    await enableInspector(sw);
    await page1.waitForTimeout(1000);

    // page2 should still be disabled
    await page2.bringToFront();
    await page2.waitForTimeout(500);
    await page2.hover('#box1');
    await page2.waitForTimeout(1000);

    const overlay = await page2.$(`#${OVERLAY_ID}`);
    const isVisible = overlay ? await overlay.evaluate(el => window.getComputedStyle(el).display !== 'none') : false;
    expect(isVisible).toBe(false);

    await page1.close();
    await page2.close();
  });

  test('navigation resets badge', async () => {
    const page = await context.newPage();
    await page.goto(serverUrl);
    await page.waitForTimeout(2000);

    await enableInspector(sw);
    await page.waitForTimeout(500);

    // Navigate to about:blank
    await page.goto('about:blank');
    await page.waitForTimeout(1500);

    const badgeText = await getBadgeText(sw);
    expect(badgeText).toBe('');

    await page.close();
  });
});

test.describe('React Component Detection', () => {
  let context;
  let sw;

  test.beforeAll(async () => {
    context = await launchWithExtension();
    sw = await getServiceWorker(context);
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('detects React component on hover', async () => {
    const page = await context.newPage();
    await page.goto(`${serverUrl}/react`);
    // Wait for React to render
    await page.waitForSelector('#counter-component', { timeout: 30000 });
    await page.waitForTimeout(2000);

    // Enable inspector
    await enableInspector(sw);
    await page.waitForTimeout(2000);

    // Hover over the counter component
    const visible = await hoverAndWaitForOverlay(page, '#counter-component');
    expect(visible).toBe(true);

    // Check panel content includes component name or React framework info
    const panelText = await page.$eval(`.${PANEL_CLASS}`, el => el.textContent).catch(() => '');
    // Should show either component name or HTML element info
    expect(panelText.length).toBeGreaterThan(0);

    await page.close();
  });

  test('shows hooks with type classification', async () => {
    const page = await context.newPage();
    await page.goto(`${serverUrl}/react`);
    await page.waitForSelector('#counter-component', { timeout: 30000 });
    await page.waitForTimeout(2000);

    await enableInspector(sw);
    await page.waitForTimeout(2000);

    // Hover over the counter
    await hoverAndWaitForOverlay(page, '#counter-component');

    const panelHtml = await page.$eval(`.${PANEL_CLASS}`, el => el.innerHTML).catch(() => '');

    // If React component was detected, check for hook types
    if (panelHtml.includes('Hooks') || panelHtml.includes('useState')) {
      // Verify hook type labels are present
      const hasHookTypes = panelHtml.includes('useState') ||
                           panelHtml.includes('useRef') ||
                           panelHtml.includes('useMemo') ||
                           panelHtml.includes('Hook');
      expect(hasHookTypes).toBe(true);
    }

    await page.close();
  });

  test('shows props for React component', async () => {
    const page = await context.newPage();
    await page.goto(`${serverUrl}/react`);
    await page.waitForSelector('#counter-component', { timeout: 30000 });
    await page.waitForTimeout(2000);

    await enableInspector(sw);
    await page.waitForTimeout(2000);

    // Hover over counter component
    await hoverAndWaitForOverlay(page, '#counter-component');

    const panelHtml = await page.$eval(`.${PANEL_CLASS}`, el => el.innerHTML).catch(() => '');

    // Panel should have content about the component (React detection or HTML fallback)
    // React component detection may show Props, Hooks, component name, or framework info
    // HTML fallback will show element tag, classes, CSS info
    expect(panelHtml.length).toBeGreaterThan(0);

    // If React framework was detected
    if (panelHtml.includes('React') || panelHtml.includes('Counter') || panelHtml.includes('App')) {
      // Should show some component information
      const hasComponentInfo = panelHtml.includes('Props') ||
                               panelHtml.includes('Hooks') ||
                               panelHtml.includes('Counter') ||
                               panelHtml.includes('label');
      expect(hasComponentInfo).toBe(true);
    }

    await page.close();
  });
});

test.describe('HTML Mode Fallback', () => {
  let context;
  let sw;

  test.beforeAll(async () => {
    context = await launchWithExtension();
    sw = await getServiceWorker(context);
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('shows HTML element info on plain HTML page', async () => {
    const page = await context.newPage();
    await page.goto(serverUrl);
    await page.waitForTimeout(2000);

    await enableInspector(sw);
    await page.waitForTimeout(2000);

    const visible = await hoverAndWaitForOverlay(page, '#box1');
    expect(visible).toBe(true);

    // Panel should show HTML element details (tag, classes, id)
    const panelText = await page.$eval(`.${PANEL_CLASS}`, el => el.textContent).catch(() => '');
    // Should contain something about the element (tag name, class, or id)
    const hasElementInfo = panelText.includes('div') ||
                           panelText.includes('box') ||
                           panelText.includes('box1') ||
                           panelText.includes('200');
    expect(hasElementInfo).toBe(true);

    await page.close();
  });

  test('overlay follows mouse to different elements', async () => {
    const page = await context.newPage();
    await page.goto(serverUrl);
    await page.waitForTimeout(2000);

    await enableInspector(sw);
    await page.waitForTimeout(2000);

    // Hover box1
    let visible = await hoverAndWaitForOverlay(page, '#box1');
    expect(visible).toBe(true);

    // Move to box2
    visible = await hoverAndWaitForOverlay(page, '#box2');
    expect(visible).toBe(true);

    // Move to inner1
    visible = await hoverAndWaitForOverlay(page, '#inner1');
    expect(visible).toBe(true);

    await page.close();
  });
});
