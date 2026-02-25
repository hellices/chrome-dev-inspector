const { test, expect, chromium } = require('@playwright/test');
const path = require('path');
const http = require('http');
const fs = require('fs');

const extensionPath = path.resolve(__dirname, '..', '..');
const testPageHtml = fs.readFileSync(path.resolve(__dirname, 'fixtures', 'test-page.html'), 'utf-8');

let server;
let serverUrl;

/**
 * Launch browser with the extension loaded
 */
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

/**
 * Get the extension's service worker
 */
async function getServiceWorker(context) {
  let sw = context.serviceWorkers()[0];
  if (!sw) {
    sw = await context.waitForEvent('serviceworker');
  }
  return sw;
}

test.beforeAll(async () => {
  // Start a local server so content scripts inject properly
  server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(testPageHtml);
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

  test.beforeAll(async () => {
    context = await launchWithExtension();
    // Wait for service worker to be ready
    await getServiceWorker(context);
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('extension loads and service worker is active', async () => {
    const sw = await getServiceWorker(context);
    expect(sw).toBeTruthy();
    expect(sw.url()).toContain('chrome-extension://');
  });

  test('inspector is disabled by default on new tab', async () => {
    const page = await context.newPage();
    await page.goto(serverUrl);
    await page.waitForTimeout(2000);

    // Hover over element - overlay should NOT appear
    await page.hover('#box1');
    await page.waitForTimeout(500);

    const overlay = await page.$('#elements-dev-inspector-overlay');
    const isVisible = overlay ? await overlay.isVisible() : false;
    expect(isVisible).toBe(false);

    await page.close();
  });

  test('toggle enables inspector on current tab', async () => {
    const page = await context.newPage();
    await page.goto(serverUrl);
    await page.waitForTimeout(2000);

    const sw = await getServiceWorker(context);

    // Enable via service worker (simulates action click)
    await sw.evaluate(async () => {
      const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      if (tabs[0]) {
        const tab = tabs[0];
        await chrome.action.setBadgeText({ tabId: tab.id, text: 'ON' });
        await chrome.action.setBadgeBackgroundColor({ tabId: tab.id, color: '#4CAF50' });
        await chrome.tabs.sendMessage(tab.id, { type: 'INSPECTOR_TOGGLE', enabled: true });
      }
    });

    await page.waitForTimeout(1000);

    // Verify badge
    const badgeText = await sw.evaluate(async () => {
      const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      if (tabs[0]) {
        return await chrome.action.getBadgeText({ tabId: tabs[0].id });
      }
      return '';
    });
    expect(badgeText).toBe('ON');

    // Verify inspector actually works - hover should show overlay
    await page.hover('#box1');
    await page.waitForTimeout(500);

    const overlay = await page.$('#elements-dev-inspector-overlay');
    const isVisible = overlay ? await overlay.isVisible() : false;
    expect(isVisible).toBe(true);

    await page.close();
  });

  test('toggle disables inspector on current tab', async () => {
    const page = await context.newPage();
    await page.goto(serverUrl);
    await page.waitForTimeout(2000);

    const sw = await getServiceWorker(context);

    // Enable first
    await sw.evaluate(async () => {
      const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      if (tabs[0]) {
        await chrome.tabs.sendMessage(tabs[0].id, { type: 'INSPECTOR_TOGGLE', enabled: true });
        await chrome.action.setBadgeText({ tabId: tabs[0].id, text: 'ON' });
      }
    });
    await page.waitForTimeout(500);

    // Now disable
    await sw.evaluate(async () => {
      const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      if (tabs[0]) {
        await chrome.tabs.sendMessage(tabs[0].id, { type: 'INSPECTOR_TOGGLE', enabled: false });
        await chrome.action.setBadgeText({ tabId: tabs[0].id, text: '' });
      }
    });
    await page.waitForTimeout(500);

    // Hover - should NOT show overlay
    await page.hover('#box1');
    await page.waitForTimeout(500);

    const overlay = await page.$('#elements-dev-inspector-overlay');
    const isVisible = overlay ? await overlay.isVisible() : false;
    expect(isVisible).toBe(false);

    // Badge should be empty
    const badgeText = await sw.evaluate(async () => {
      const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      if (tabs[0]) {
        return await chrome.action.getBadgeText({ tabId: tabs[0].id });
      }
      return 'UNKNOWN';
    });
    expect(badgeText).toBe('');

    await page.close();
  });

  test('inspector stays disabled on other tabs', async () => {
    const page1 = await context.newPage();
    await page1.goto(serverUrl);
    await page1.waitForTimeout(2000);

    const page2 = await context.newPage();
    await page2.goto(serverUrl);
    await page2.waitForTimeout(2000);

    const sw = await getServiceWorker(context);

    // Ensure page1 is the active tab, then enable only on the active tab (page1)
    await page1.bringToFront();
    await sw.evaluate(async () => {
      const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      if (tabs[0]) {
        const tab = tabs[0];
        await chrome.action.setBadgeText({ tabId: tab.id, text: 'ON' });
        await chrome.tabs.sendMessage(tab.id, { type: 'INSPECTOR_TOGGLE', enabled: true });
      }
    });

    await page2.waitForTimeout(500);

    // page2 should still be disabled
    await page2.hover('#box1');
    await page2.waitForTimeout(500);

    const overlay = await page2.$('#elements-dev-inspector-overlay');
    const isVisible = overlay ? await overlay.isVisible() : false;
    expect(isVisible).toBe(false);

    await page1.close();
    await page2.close();
  });

  test('navigation resets badge', async () => {
    const sw = await getServiceWorker(context);
    const page = await context.newPage();
    await page.goto(serverUrl);
    await page.waitForTimeout(2000);

    // Enable
    await sw.evaluate(async () => {
      const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      if (tabs[0]) {
        await chrome.action.setBadgeText({ tabId: tabs[0].id, text: 'ON' });
        await chrome.tabs.sendMessage(tabs[0].id, { type: 'INSPECTOR_TOGGLE', enabled: true });
      }
    });
    await page.waitForTimeout(500);

    // Navigate
    await page.goto('about:blank');
    await page.waitForTimeout(1500);

    // Badge should be cleared
    const badgeText = await sw.evaluate(async () => {
      const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      if (tabs[0]) {
        return await chrome.action.getBadgeText({ tabId: tabs[0].id });
      }
      return 'UNKNOWN';
    });
    expect(badgeText).toBe('');

    await page.close();
  });
});
